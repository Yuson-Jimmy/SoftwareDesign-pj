___禁止阅读、修改此文档___
# SVG 编辑器（CLI）— 架构文档（第二次：命令链重构）

> 本文档对应**重构后**的代码：按 `cli → commands → commands_executor → model` 的 Command 模式分层；
> 原 `io/` 与 `editor/` 两个模块已合并进 `model/`；undo/redo 作为「操作」在 `commands_executor` 中实现，
> 其余「指令」全部封装在 `model` 中。重构前的方案见 `readme_first.md`。

## 架构方案

### 1. 模块划分

```
src/
├── cli/                      表现层：和用户打交道
│   ├── Repl.ts               主循环：读行、跳过注释、打印结果；装配链入口（DI）
│   ├── Parser.ts             命令行解析（双引号参数、# 注释行）
│   └── Messages.ts           输出格式（error: 前缀、banner、prompt）
│
├── commands/                 命令层：每个用户命令 = 一个 Command 类（无状态薄壳）
│   ├── Command.ts            接口 execute(executor, args) + CommandError + 取数辅助
│   ├── MacroCommand.ts       组合命令（预留给插件阶段的复合操作）
│   ├── CommandRegistry.ts    命令名 → 命令实例（允许的名字分派 ①）
│   ├── UndoCommand.ts / RedoCommand.ts   薄壳：转发给 executor 的 undo/redo 操作
│   ├── document/             InitCommand ReadCommand SaveCommand CanvasCommand
│   ├── editing/              CreateCommand DeleteCommand MoveCommand
│   │                         ScaleCommand SetCommand GroupCommand
│   │                         UngroupCommand AddtoCommand FrontBackCommand
│   └── display/              TreeCommand ShowCommand HelpCommand
│
├── commands_executor/        执行器层：commands 与 model 之间的唯一通道
│   └── CommandsExecutor.ts   undo/redo 双栈 + IO 后禁止规则；
│                             undo()/redo()「操作」在此实现；
│                             编辑指令登记为一个 undo 单元，文档指令清空/封锁历史
│
└── model/                    领域层：图形世界 + 合并进来的 io 与 editor + 全部「指令」
    ├── EditorModel.ts        会话状态（当前文档 + 来源路径）+ SVG 读写 +
    │                         文档类指令（init/read/save/resizeCanvas）+
    │                         编辑类指令（createShape/deleteShape/moveShape/scaleShape/
    │                         setShapeAttribute/groupShapes/ungroupShape/addToGroup/reorder），
    │                         编辑指令一律返回 EditOutcome（回显 + 逆操作闭包）
    ├── EditOutcome.ts        编辑指令的执行结果：message + undo()/redo() 闭包
    ├── SvgReader.ts          手卷 XML 解析、自动补 id（收集警告而非直接打印）
    ├── SvgWriter.ts          序列化、写文件
    ├── Shape.ts              抽象基类（id、parent、样式、move/scale/set/toSVG）
    ├── shapes/               Rect Circle Ellipse Line Text（一类一文件）
    ├── Group.ts              容器（Composite，操作递归到子孙）
    ├── Document.ts           画布尺寸 + 根容器 + id 注册表
    └── ShapeFactory.ts       类型名 → 类（允许的名字分派 ②）
```

组件图（PlantUML）：

```plantuml
@startuml
package cli { [Repl] [Parser] [Messages] }
package commands { [CommandRegistry] [document cmds] [editing cmds] [display cmds] [Undo/Redo cmds] }
package commands_executor { [CommandsExecutor] }
package model { [EditorModel] [EditOutcome] [SvgReader] [SvgWriter] [Shape] [Group] [Document] [ShapeFactory] }

[Repl] --> [CommandRegistry]
[Repl] --> [Parser]
[Repl] --> [CommandsExecutor] : 装配（持有同一实例）
[CommandRegistry] --> [CommandsExecutor] : execute(executor, args)
[Undo/Redo cmds] --> [CommandsExecutor] : undo()/redo() 操作
[CommandsExecutor] --> [EditorModel] : 指令调用
[CommandsExecutor] --> [EditOutcome] : 登记历史栈
[EditorModel] --> [Document]
[EditorModel] --> [ShapeFactory]
[EditorModel] --> [SvgReader]
[EditorModel] --> [SvgWriter]
[EditorModel] ..> [EditOutcome] : 产出
[SvgReader] --> [ShapeFactory]
[display cmds] --> [Document] : 只读渲染
[Group] --> [Shape]
@enduml
```

各模块职责：

| 模块 | 职责 | 刻意不做的事 |
|---|---|---|
| `cli/` | 读行、解析、分发、打印；装配整条链 | 不碰命令实现、不碰模型细节 |
| `commands/` | 语法校验（参数个数、数字解析、`in` 尾缀切分），转发给 executor；display 命令做只读渲染 | 不做领域校验、不持有任何状态、不自己打印 |
| `commands_executor/` | 历史栈管理；undo/redo「操作」；文档指令后封锁、编辑指令后解禁 | 不认识命令名与 Command 类、不做参数解析 |
| `model/` | 图形领域 + 会话状态 + SVG 读写 + 全部指令的封装（怎么做、怎么撤销、怎么重做） | 不知道历史栈存在、不知道命令存在、不打印 |

### 2. 设计模式的选择

任务要求使用 **Command 模式**，落地形态为四层链 `cli → commands → commands_executor → model`：

| 模式 | 落地点 | 说明 |
|---|---|---|
| **Command** | `commands/` 全部命令类 | 每个用户命令一个类，统一 `execute(executor, args): string`；`CommandRegistry` 完成「命令名 → 命令」分派；命令只返回结果字符串，不自己打印 |
| **Command（操作语义）** | `commands_executor/CommandsExecutor.ts` | undo/redo 被视为**对历史栈的操作**而非模型指令，由执行器的 `undo()/redo()` 实现；编辑指令执行成功后，执行器把 `EditOutcome` 压栈（一条指令 = 一个 undo 单元），新编辑清空 redo 栈，文档指令执行后置 `ioBlocked` |
| **Composite** | `model/Group.ts` | `Group extends Shape`：容器与叶子统一 `move/scale/set/delete`，容器操作递归到子孙；`tree`/`show`/`toSVG` 一视同仁 |
| **Factory** | `model/ShapeFactory.ts` | 类型名 → 构造器（Creator）与属性表还原器（Loader），`create` 与 `read` 共用这一条名字分派通道；后续插件化阶段由 ShapeProvider 注册取代内核写死 |
| **Template Method**（轻量） | `model/Shape.ts` | 基类统一处理样式属性（fill/stroke/stroke-width），几何属性留给子类 `setGeometryAttribute` 钩子 |
| **Facade**（轻量） | `commands_executor/CommandsExecutor.ts` | commands 层只见执行器一个入口，模型指令的调用 + 历史登记的编排全部藏在执行器内 |

**指令与操作的切分**（本次重构的核心决策）：

- 「指令」（init/read/save/canvas/create/delete/move/scale/set/group/ungroup/addto/front/back）封装在 `model/EditorModel`：每条编辑指令自己捕获逆操作现场（旧坐标、旧父容器与下标、旧属性值），返回 `EditOutcome { message, undo, redo }`——这些现场只有在执行当下才拿得到，闭包是最直接的捕获方式；
- 「操作」（undo/redo）在 `commands_executor`：它们不修改图形世界，只移动历史栈指针，因此不属于模型；
- `EditOutcome` 接口定义在 `model/` 而非 `commands_executor/`：模型产出它、执行器消费它，若定义在执行器侧会造成 model → commands_executor 的反向依赖。

undo/redo 没有采用"每个命令类自带 undo() 方法"的经典 Command 形态，理由与第一版一致：避免执行器反向依赖 commands 层（依赖方向规则的硬性约束）。

### 3. 依赖方向规则

```
cli ──→ commands ──→ commands_executor ──→ model
```

严格单向，不允许任何反向边。

| 模块 | 允许依赖 | 禁止依赖 | 理由 |
|---|---|---|---|
| `model/` | 无（仅模块内部） | 一切外层 | 领域最稳定；指令、会话、读写都在这里，谁也不能污染它 |
| `commands_executor/` | `model/` | commands、cli | 执行器被命令调用，绝不能反过来认识命令；`EditOutcome` 定义在 model 侧正是为了保证这条边单向 |
| `commands/` | `commands_executor/`、`model/`（只读） | `cli/` | 命令产生结果字符串，不自己打印；对 model 的引用仅限 display 渲染与只读预检（见下） |
| `cli/` | `commands/`、`commands_executor/`、`model/`（仅装配） | 直接 new 图形类 | 表现层不越过命令层；`new EditorModel()` 属 DI 装配 |

两条有意识的例外，在此声明并限定范围：

1. **commands → model 的只读边**：`tree`/`show` 需要 `Shape`/`Group` 的类型信息做渲染，`move`/`scale` 用 `mustFind` 做只读预检以保持「no such shape 优先于 invalid number」的报错顺序。限定为**只读**，一切状态修改必须经由 executor；
2. **cli → model 的装配边**：`Repl` 构造 `EditorModel` 并注入 `CommandsExecutor`，属一次性 DI 装配，运行期 cli 不直接调用模型。

关键执行手段：

- 历史栈条目是 `EditOutcome`（闭包对）而非 `Command` 引用，切断了 executor → commands 的反向边；
- `SvgReader` 的警告**收集后返回**，由 model 的 `read` 指令拼进输出，model 层不出现 `console`；
- 全局 `grep` 可验证：`model/` 没有任何指向外层的 import，`commands_executor/` 只 import `model/`。

### 4. 变化点假设

| # | 假设的变化 | 留了什么 / 为什么不留 |
|---|---|---|
| 1 | **新增图形类型**（4.4 的 `box` 等插件类型） | 留了：`ShapeFactory.register(type, creator, loader)` 就是 ShapeProvider 插槽的雏形；`EditorModel.createShape` 只认工厂不认识具体类型，内核新增代码为 0 的目标不变 |
| 2 | **命令集合扩张**（如 rotate、align） | 留了：新命令 = 实现 `Command` 接口（语法校验）+ `EditorModel` 加一条指令 + `CommandsExecutor` 加一个登记方法 + 注册表一行，REPL 零改动 |
| 3 | **undo 粒度变化**（宏命令、事务、多指令打包） | 留了：`MacroCommand` 占位；`EditOutcome` 闭包对天然可组合（把多个 outcome 的 undo 逆序串起来即一个宏单元）；历史栈集中在执行器一处，改粒度不动模型 |
| 4 | **交互通道增加**（GUI/agent 复用命令层） | 留了：命令不打印、返回字符串；执行器与模型都不认识 cli，新前端拿到 `CommandRegistry` + `CommandsExecutor` 就能驱动 |
| 5 | **XML 解析器替换**（手卷 → 成熟库） | 留了：解析细节封在 `SvgReader` 内部，对外只暴露 `readFile/readString → {doc, warnings}` |
| 6 | **历史策略变化**（历史上限、持久化历史） | 留了（本次重构的新收益）：历史全部集中在 `CommandsExecutor` 一个类里，改策略不动其它任何层 |
| 7 | 序列化格式变化（JSON 导出等） | **没留**：新增一种格式 = `model/` 里加一个平行 Writer 类 + 一条指令，改动本来就局限在一处，提前抽象"Writer 接口"收益不大 |
| 8 | 样式属性白名单扩张 | **没留**：白名单分散在各图形类的 `setGeometryAttribute` 里正是封装的目的，加一个属性改一个类，符合 OCP 的低成本形态 |

## 过程记录

1. **editor 的拆分归属**。重构要求 io 与 editor 合并、undo/redo 在 commands_executor。原 `Editor` 恰好跨了这条线：它既持有会话状态（当前文档、来源路径），又持有历史栈。与 AI 讨论后把它拆成两半——会话状态 + 指令逻辑随 io 一起并入 `model/EditorModel`；历史栈 + IO 禁止规则上移为 `commands_executor/CommandsExecutor`。原 `HistoryEntry` 接口演变为 `EditOutcome`，由模型产出、执行器消费。
2. **`EditOutcome` 放在哪一层**。AI 第一稿把该接口定义在 `commands_executor/`，画依赖图时发现这会让 model 反向依赖执行器（model 的方法签名要返回它），违反规则 3。改为一开始就定义在 `model/EditOutcome.ts`，接口不含任何外层概念，依赖保持单向。
3. **undo/redo 命令类去留**。讨论过让 cli 对 `undo`/`redo` 两个名字特判、直连 executor（这样 commands 层完全没有撤销重做）。否决理由：这会引入除 `CommandRegistry`、`ShapeFactory` 之外的**第三个按名字分派点**，违反"按名字分派只允许两处"的约定。最终保留 `UndoCommand`/`RedoCommand` 薄壳走注册表统一分发，操作本体在 executor。
4. **报错优先序的保持**。原实现中 `move badid xx yy` 先报 `no such shape`（mustFind 先于数字解析）。指令下沉到 model 后，若命令层先把 `xx` 解析成数字再调 executor，错误顺序会变成 `invalid number`。决定：commands 层保留对 `move`/`scale` 的 `mustFind` **只读预检**，并在代码注释与规则 3 中标注这是有意识的例外。
5. **AI 生成代码的两处导入错误**。重写 `UndoCommand`/`RedoCommand` 时 AI 沿用了子目录命令的相对路径（`'../Command'`、`'../../commands_executor/...'`），而这两个文件在 `commands/` 根下，`tsc --noEmit` 立即报 TS2307，改为 `'./Command'` 与 `'../commands_executor/...'` 后通过。教训：批量重写文件后必须第一时间跑类型检查，而不是等全部写完。
6. **重构正确性的验证方式**。不满足于"新代码跑通"，用 `git worktree` 把重构前代码检出到临时目录，对 `test/session1~4.txt` 四个回放脚本逐字节 `diff` 新旧输出，四份全部一致才提交。这抓住了重构的验收本质：**架构变了，可观察行为一个字都不能变**。

## 一致性自查

### 1. 模块划分

实际目录与方案**一致**，两处有意识的安排，在此记录：

- `UndoCommand.ts / RedoCommand.ts` 放在 `commands/` 根下而非三个子目录之一——它们不属于 document/editing/display 任何一类，只是走统一分发通道的薄壳（转发给 `CommandsExecutor.undo/redo`），理由见过程记录 3；
- `MacroCommand.ts` 已按方案实现，但当前没有命令使用它（各编辑指令在 model 中自行维护逆操作状态），作为插件阶段复合操作的基础设施保留。

### 2. 依赖方向

抽样核对（`grep` 各层 import）：

- `model/`：仅内部相对引用，零外向依赖 ✅
- `commands_executor/`：只 import `model/`（`Document`、`EditOutcome`、`EditorModel`、`ModelError`）✅
- `commands/`：import `commands_executor/` 与 `model/`（后者限只读：display 渲染与 mustFind 预检），无 `cli/` ✅
- `cli/`：import `commands/`、`commands_executor/`、`model/EditorModel`（仅装配）✅

未发现违反规则的依赖；规则 3 中声明的两条例外与实际代码一一对应。

## 质量保证手段

1. **类型安全**：`tsc --noEmit` strict 模式全量通过。
2. **重构前后逐字节比对**：用 `git worktree` 检出重构前提交，四份回放脚本（`test/session1~4.txt`）的新旧输出 `diff` 完全一致——架构重构不改变任何可观察行为，这是本轮最强的一项验收。
3. **transcript 回放验收**：session1/session3 复现任务文档第 6 节与 6.1 节典型会话，逐行比对回显文案、错误信息、tree 结构。
4. **错误表全覆盖**：session2 覆盖 4.2 全部错误分支（id 重复/不存在、容器不存在/非容器、未知类型、顶层 ungroup、scale 非正、文件不可读、IO 后 undo 禁止）。
5. **undo/redo 语义专项**：session4 覆盖 group 撤销重做、redo 栈被新编辑清空、容器删除整棵子树恢复、set 撤销还原"未设置"状态、scale 递归与回退、front/back z-order。
6. **round-trip 验证**：`save` 产物再 `read` 回来结构树完全一致；io 指令后 `undo` 正确报 `error: undo not allowed after io command`；**失败的 save 不封锁 undo**（命令失败不改变任何状态）。
7. **依赖方向机器可查**：第 3 节的规则可用两条 `grep` 复验（model 无外向 import、executor 只 import model），不依赖人工记忆。
