# SVG 编辑器（CLI）— 架构文档

## 架构方案

### 1. 模块划分

```
src/
├── cli/                  表现层：和用户打交道
│   ├── Repl.ts           主循环：读行、跳过注释、打印结果；组装各层（DI 入口）
│   ├── Parser.ts         命令行解析（双引号参数、# 注释行）
│   └── Messages.ts       输出格式（error: 前缀、banner、prompt）
│
├── commands/             命令层：每个用户命令 = 一个 Command 类
│   ├── Command.ts        接口 + CommandError + 公共取数辅助
│   ├── MacroCommand.ts   组合命令（预留给插件阶段的复合操作）
│   ├── CommandRegistry.ts 命令名 → 命令实例（允许的名字分派 ①）
│   ├── UndoCommand.ts / RedoCommand.ts   撤销重做（见一致性自查）
│   ├── document/         InitCommand ReadCommand SaveCommand CanvasCommand
│   ├── editing/          CreateCommand DeleteCommand MoveCommand
│   │                     ScaleCommand SetCommand GroupCommand
│   │                     UngroupCommand AddtoCommand FrontBackCommand
│   └── display/          TreeCommand ShowCommand HelpCommand
│
├── editor/               应用层：编辑会话的"状态机"
│   └── Editor.ts         当前文档 + 来源路径 + undo/redo 双栈 + IO 后禁用规则（刻意保持薄）
│
├── model/                领域层：图形世界本身，不知道任何外界存在
│   ├── Shape.ts          抽象基类（id、parent、样式、move/scale/set/toSVG）
│   ├── shapes/           Rect Circle Ellipse Line Text（一类一文件）
│   ├── Group.ts          容器（Composite，操作递归到子孙）
│   ├── Document.ts       画布尺寸 + 根容器 + id 注册表
│   └── ShapeFactory.ts   类型名 → 类（允许的名字分派 ②）
│
└── io/                   持久化层：SVG 文本 ⇄ 对象树
    ├── SvgReader.ts      手卷 XML 解析、自动补 id（收集警告而非直接打印）
    └── SvgWriter.ts      序列化、写文件
```

组件图（PlantUML）：

```plantuml
@startuml
package cli { [Repl] [Parser] [Messages] }
package commands { [CommandRegistry] [document cmds] [editing cmds] [display cmds] }
package editor { [Editor] }
package model { [Shape] [Group] [Document] [ShapeFactory] }
package io { [SvgReader] [SvgWriter] }

[Repl] --> [CommandRegistry]
[Repl] --> [Parser]
[CommandRegistry] --> [Editor]
[editing cmds] --> [Document]
[document cmds] --> [SvgReader]
[document cmds] --> [SvgWriter]
[Editor] --> [Document]
[SvgReader] --> [ShapeFactory]
[SvgReader] --> [Document]
[SvgWriter] --> [Document]
[Group] --> [Shape]
@enduml
```

### 2. 设计模式的选择

| 模式 | 落地点 | 说明 |
|---|---|---|
| **Command** | `commands/` 全部命令 | 每个用户命令一个类，`execute(editor, args): string`；编辑命令执行成功后向 `Editor.pushHistory` 登记 `{undo, redo}` 闭包，实现一条命令 = 一个 undo 单元。命令只返回结果字符串，**不自己打印** |
| **Composite** | `model/Group.ts` | `Group extends Shape`：容器与叶子统一 `move/scale/set/delete`，容器操作递归到子孙；`tree`/`show`/`toSVG` 对两者一视同仁 |
| **Factory** | `model/ShapeFactory.ts` | 类型名 → 构造器（Creator）与属性表还原器（Loader），`create` 与 `read` 共用这一条名字分派通道 |
| **Registry（名字分派）** | `commands/CommandRegistry.ts` | 命令名 → 命令实例。全系统按名字分派**仅此两处**，均在此标注为后续插件化的待重构点 |
| **Template Method**（轻量） | `model/Shape.ts` | 基类统一处理样式属性（fill/stroke/stroke-width），几何属性留给子类 `setGeometryAttribute` 钩子 |

undo/redo 没有采用"每个命令类自带 undo() 方法"的经典 Command 形态，而是让编辑命令在执行时生成**逆操作闭包**推进 Editor 的历史栈。原因：undo 所需的现场（旧坐标、旧父容器与下标、旧属性值）只有在执行当下才拿得到，闭包是最直接的捕获方式；同时避免 `Editor` 反向依赖 `commands` 层（依赖方向规则的硬性约束）。

### 3. 依赖方向规则

```
cli ──→ commands ──→ editor ──→ model
            │                   ↑
            └────→ io ──────────┘
```

| 模块 | 允许依赖 | 禁止依赖 | 理由 |
|---|---|---|---|
| `model/` | 无（零依赖） | 一切外层 | 领域最稳定，谁也不能污染它 |
| `io/` | `model/` | commands、editor、cli | 读写只懂图形和文件，不懂会话 |
| `editor/` | `model/` | cli、io 的细节类、commands | 会话编排不碰交互、格式与命令实现 |
| `commands/` | `editor/`、`model/`、`io/` | `cli/` | 命令产生结果字符串，不自己打印 |
| `cli/` | `commands/`、`editor/` | 直接 new 图形类、直接碰 io | 表现层不越过命令层 |

关键执行手段：

- `Editor` 的历史栈条目是**闭包**而非 `Command` 引用，切断了 editor → commands 的反向边；
- `SvgReader` 的警告**收集后返回**，由 ReadCommand 拼进输出，io 层不出现 `console`；
- 全局 `grep` 可验证：`model/`、`io/`、`editor/` 三个目录没有任何指向外层的 import。

### 4. 变化点假设

| # | 假设的变化 | 留了什么 / 为什么不留 |
|---|---|---|
| 1 | **新增图形类型**（4.4 的 `box` 等插件类型） | 留了：`ShapeFactory.register(type, creator, loader)` 就是 ShapeProvider 插槽的雏形；`box` 到来时内核只需扩展工厂注册与 `kind` 标注 |
| 2 | **命令集合扩张**（如 rotate、align） | 留了：`CommandRegistry.register` 一个入口；新命令实现 `Command` 接口即可，REPL 零改动 |
| 3 | **XML 解析器替换**（手卷 → 成熟库） | 留了：解析细节封在 `io/SvgReader` 内部，对外只暴露 `readFile/readString → {doc, warnings}` |
| 4 | **交互通道增加**（GUI/agent 复用命令层） | 留了：命令不打印、返回字符串，任何新前端拿到 `CommandRegistry` 就能驱动 |
| 5 | **undo 粒度变化**（宏命令、事务） | 留了：`MacroCommand` 已占位；历史条目是闭包对，组合多个条目成本很低 |
| 6 | 序列化格式变化（JSON 导出等） | **没留**：新增一种格式 = `io/` 里加一个平行类，改动本来就局限在一处，提前抽象出"Writer 接口"收益不大 |
| 7 | 样式属性白名单扩张 | **没留**：白名单分散在各图形类的 `setGeometryAttribute` 里正是封装的目的，加一个属性改一个类，符合 OCP 的低成本形态 |

## 过程记录

1. **undo 的设计分歧**。最初按经典 Command 模式让 `Editor` 直接持有 `Command` 对象，画依赖图时发现这会产生 editor → commands 的反向依赖，违反方案第 3 条。与 AI 讨论后改为"执行时登记逆操作闭包"：`Editor.pushHistory({undo, redo})`，依赖方向干净了，undo 现场捕获也更准确。
2. **`#` 注释与十六进制颜色冲突**。AI 第一版 Parser 把行内 `#` 之后全部当注释，直接截断了 `create rect bg 0 0 800 600 #ffffff` 的 fill 参数。对照任务文档确认约定是"**`#` 开头为注释**"（整行注释），改为只跳过 `#` 开头的行，回放脚本同样成立。
3. **`in` 子句与 text 内容撞车**。第一版在参数里查找 `in` 关键字，会把 `create text t 10 20 "in"` 误判为 in 子句。改成只认"**倒数第二个 token 是 `in`**"的尾缀形式，与文档语法一致且不会误伤文本内容。
4. **ungroup 撤销的真实 bug**。回放 session3 时 `undo` 报 `error: id already exists: process`。排查发现 `ungroup` 执行时用 `attach` 直接把子图形挂到祖父容器，却没有把它们从原 `group.children` 里摘出，导致撤销时同一子图形被注册两次。修复：`Document.attach` 增加防御性摘离，`UngroupCommand` 改用 `reparent`。这个 bug 是靠 transcript 回放抓出来的，验证了"以文档典型会话为验收脚本"的价值。
5. **错误信息一致性**。逐条对照 4.2 错误表核对输出（id already exists / no such shape / no such container / not a container / unknown shape type / cannot ungroup top-level container / scale factor must be positive / cannot read|write file / no document / undo not allowed after io command），发现 `ungroup 叶子图形` 文档未定义，取了与 `addto` 一致的 `not a container: <id>`。

## 一致性自查

### 1. 模块划分

实际目录与方案**基本一致**，两处有意识的偏差，在此记录：

- `UndoCommand.ts / RedoCommand.ts` 放在 `commands/` 根下而非三个子目录之一——它们不属于 document/editing/display 任何一类，只是走统一分发通道的薄壳（转发给 `Editor.undo/redo`）；
- `MacroCommand.ts` 已按方案实现，但当前没有命令使用它（各编辑命令自行维护逆操作状态），作为插件阶段复合操作的基础设施保留，未删除以保持一致性。

### 2. 依赖方向

抽样核对（`grep -r "from '\.\./" src/`）：

- `model/`：仅内部相对引用，零外向依赖 ✅
- `io/`：只 import `model/` ✅
- `editor/`：只 import `model/`（HistoryEntry 用闭包接口，不碰 commands）✅
- `commands/`：import `editor/`、`model/`、`io/`，无 `cli/` ✅
- `cli/`：import `commands/`、`editor/`、`model/ShapeFactory`（组装工厂属 DI 装配，未直接 new 图形类）、`io/`（仅构造 Reader/Writer 注入 Registry）✅

未发现违反规则的依赖。

## 质量保证手段

1. **类型安全**：`tsc --noEmit` strict 模式全量通过，零 `any` 逃逸。
2. **transcript 回放验收**：把任务文档第 6 节典型会话、6.1 流程图案例分别存成脚本（`test/session1.txt`、`session3.txt`）用管道回放，逐行比对输出与文档一致（含回显文案、错误信息、tree 结构）。
3. **错误表全覆盖**：`test/session2.txt` 覆盖 4.2 全部错误分支（id 重复/不存在、容器不存在/非容器、未知类型、顶层 ungroup、scale 非正、文件不可读、IO 后 undo 禁止）。
4. **undo/redo 语义专项**：`test/session4.txt` 覆盖 group 撤销重做、redo 栈被新编辑清空、容器删除整棵子树恢复、set 撤销还原"未设置"状态、scale 递归与回退、front/back z-order。
5. **round-trip 验证**：`save` 产物再 `read` 回来结构树完全一致（session4 末尾），并人工检查生成的 `flowchart.svg` 为合法 SVG（浏览器可直接打开）。
6. **真实 bug 的修复留痕**：ungroup 撤销 bug 有独立修复提交，提交历史可追溯"测试发现 → 定位 → 修复"全过程。
