# SVG 编辑器（CLI）— 项目报告（最终版）

> 本文档按 `phase_cli_1.md` 1.2 节要求组织：架构方案（模块划分 / 设计模式 / 依赖方向规则 / 变化点假设）、
> 过程记录、一致性自查、质量保证手段。对应最终代码：四层 Command 模式架构，
> commands 层完全不依赖 model 层；迭代过程详见 `readme_first.md` / `readme_second.md` / `readme_third.md`。

# 架构方案

## 1. 模块划分

```
src/
├── cli/                      表现层：和用户打交道
│   ├── Repl.ts               主循环：读行、跳过注释、打印结果；装配链入口（DI）
│   ├── Parser.ts             命令行解析（双引号参数、# 注释行）
│   └── Messages.ts           输出格式（error: 前缀、banner、prompt）
│
├── commands/                 命令层：每个用户命令 = 一个 Command 类（纯薄壳，无状态）
│   ├── Command.ts            接口 execute(executor, args) + CommandError
│   │                         + rethrow（domainError 结构化判别）
│   │                         + requireDoc（前置检查）+ parseNumber（纯语法级数字解析）
│   ├── MacroCommand.ts       组合命令（预留给插件阶段的复合操作）
│   ├── CommandRegistry.ts    命令名 → 命令实例（允许的名字分派 ①）
│   ├── UndoCommand.ts / RedoCommand.ts   薄壳：转发给 executor 的 undo/redo 操作
│   ├── document/             InitCommand ReadCommand SaveCommand CanvasCommand
│   ├── editing/              CreateCommand DeleteCommand MoveCommand ScaleCommand
│   │                         SetCommand GroupCommand UngroupCommand AddtoCommand FrontBackCommand
│   └── display/              TreeCommand ShowCommand HelpCommand
│
├── commands_executor/        执行器层：commands 与 model 之间的唯一通道
│   └── CommandsExecutor.ts   undo/redo 双栈 + IO 后禁止规则；
│                             undo()/redo()「操作」在此实现；
│                             编辑指令登记为一个 undo 单元，文档指令清空/封锁历史；
│                             tree/show/requireDocument 只读转发；不向外暴露模型类型
│
└── model/                    领域层：图形世界 + 会话状态 + SVG 读写 + 全部「指令」
    ├── EditorModel.ts        文档类指令（init/read/save/resizeCanvas）+
    │                         编辑类指令（createShape/deleteShape/moveShape/scaleShape/
    │                         setShapeAttribute/groupShapes/ungroupShape/addToGroup/reorder，
    │                         一律返回 EditOutcome）+ 显示类指令（tree/show）
    ├── EditOutcome.ts        编辑指令的执行结果：message + undo()/redo() 闭包
    ├── DisplayView.ts        tree/show 渲染器（显示指令的视图逻辑）
    ├── SvgReader.ts          手卷 XML 解析、自动补 id（收集警告而非直接打印）
    ├── SvgWriter.ts          序列化、写文件
    ├── Shape.ts              抽象基类（id、parent、样式、move/scale/set/toSVG）+ ModelError
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
package model { [EditorModel] [DisplayView] [EditOutcome] [SvgReader] [SvgWriter] [Shape] [Group] [Document] [ShapeFactory] }

[Repl] --> [CommandRegistry]
[Repl] --> [Parser]
[Repl] --> [CommandsExecutor] : 装配（持有同一实例）
[CommandRegistry] --> [CommandsExecutor] : execute(executor, args)
[Undo/Redo cmds] --> [CommandsExecutor] : undo()/redo() 操作
[CommandsExecutor] --> [EditorModel] : 指令调用（含 tree/show/requireDocument）
[CommandsExecutor] --> [EditOutcome] : 登记历史栈
[EditorModel] --> [DisplayView] : 显示指令委托渲染
[EditorModel] --> [Document]
[EditorModel] --> [ShapeFactory]
[EditorModel] --> [SvgReader]
[EditorModel] --> [SvgWriter]
[EditorModel] ..> [EditOutcome] : 产出
[DisplayView] --> [Document]
[DisplayView] --> [Shape]
[DisplayView] --> [Group]
[SvgReader] --> [ShapeFactory]
[Group] --> [Shape]
@enduml
```

各模块职责：

| 模块 | 职责 | 刻意不做的事 |
|---|---|---|
| `cli/` | 读行、解析、分发、打印；装配整条链 | 不碰命令实现、不碰模型细节 |
| `commands/` | 语法校验（参数个数、`in` 尾缀切分），转发给 executor | 不做领域校验、不渲染、不持有状态、不打印、**不认识任何模型类** |
| `commands_executor/` | 历史栈管理；undo/redo「操作」；文档指令后封锁、编辑指令后解禁；只读转发 | 不认识命令名与 Command 类、不做参数解析、不暴露模型类型 |
| `model/` | 图形领域 + 会话状态 + SVG 读写 + 全部指令（文档/编辑/显示）的封装 | 不知道历史栈存在、不知道命令存在、不打印 |

## 2. 设计模式的选择

任务要求使用 **Command 模式**，落地形态为四层链 `cli → commands → commands_executor → model`：

| 模式 | 落地点 | 说明 |
|---|---|---|
| **Command** | `commands/` 全部命令类 | 每个用户命令一个类，统一 `execute(executor, args): string`；`CommandRegistry` 完成「命令名 → 命令」分派；命令只返回结果字符串，不自己打印 |
| **Command（操作语义）** | `commands_executor/CommandsExecutor.ts` | undo/redo 被视为**对历史栈的操作**而非模型指令，由执行器的 `undo()/redo()` 实现；编辑指令执行成功后，执行器把 `EditOutcome` 压栈（一条指令 = 一个 undo 单元），新编辑清空 redo 栈，文档指令执行后置 `ioBlocked` |
| **Composite** | `model/Group.ts` | `Group extends Shape`：容器与叶子统一 `move/scale/set/delete`，容器操作递归到子孙；`tree`/`show`/`toSVG` 一视同仁 |
| **Factory** | `model/ShapeFactory.ts` | 类型名 → 构造器（Creator）与属性表还原器（Loader），`create` 与 `read` 共用这一条名字分派通道；后续插件化阶段由 ShapeProvider 注册取代内核写死 |
| **Template Method**（轻量） | `model/Shape.ts` | 基类统一处理样式属性（fill/stroke/stroke-width），几何属性留给子类 `setGeometryAttribute` 钩子 |
| **Facade**（轻量） | `commands_executor/CommandsExecutor.ts` | commands 层只见执行器一个入口，模型指令的调用 + 历史登记的编排全部藏在执行器内 |

**指令与操作的切分**（架构的核心决策）：

- 「指令」（init/read/save/canvas/create/delete/move/scale/set/group/ungroup/addto/front/back/tree/show）全部封装在 `model/EditorModel`：每条编辑指令自己捕获逆操作现场（旧坐标、旧父容器与下标、旧属性值），返回 `EditOutcome { message, undo, redo }`——这些现场只有在执行当下才拿得到，闭包是最直接的捕获方式；
- 「操作」（undo/redo）在 `commands_executor`：它们不修改图形世界，只移动历史栈指针，因此不属于模型；
- `EditOutcome` 接口定义在 `model/` 而非 `commands_executor/`：模型产出它、执行器消费它，若定义在执行器侧会造成 model → commands_executor 的反向依赖。

___undo/redo 没有采用"每个命令类自带 undo() 方法"的经典 Command 形态，理由：历史栈条目若是 Command 引用，执行器就要反向依赖 commands 层，违反依赖方向规则。___错误的，实际上每个命令均有undo呵呵呵

## 3. 依赖方向规则

```
cli ──→ commands ──→ commands_executor ──→ model
```

严格单向：

| 模块 | 允许依赖 | 禁止依赖 | 理由 |
|---|---|---|---|
| `model/` | 无（仅模块内部） | 一切外层 | 领域最稳定；指令、会话、读写都在这里，谁也不能污染它 |
| `commands_executor/` | `model/` | commands、cli | 执行器被命令调用，绝不能反过来认识命令；`EditOutcome` 定义在 model 侧正是为了保证这条边单向 |
| `commands/` | **仅 `commands_executor/`** | `model/`、`cli/` | 命令的参数与返回值全部是 string，连 `Document` 类型都见不到 |
| `cli/` | `commands/`、`commands_executor/`、`model/`（仅装配） | 直接 new 图形类 | 唯一例外：`Repl` 构造 `EditorModel` 注入 executor，属一次性 DI 装配，运行期 cli 不直接调用模型 |

关键执行手段：

- 历史栈条目是 `EditOutcome`（闭包对）而非 `Command` 引用，切断了 executor → commands 的反向边；
- 显示渲染下沉为模型指令：`tree`/`show` 需要 `Shape`/`Group` 类型信息，渲染器 `DisplayView` 放在模型内，命令层只拿字符串；
- 报错优先序下沉为模型指令的校验编排：`move`/`scale` 的数字参数以原始字符串透传，模型指令内先 `mustFind` 再 `parseNum`，「no such shape 优先于 invalid number」的顺序在指令内天然成立，命令层无需只读预检；
- 领域错误用 `ModelError.domainError` 标记做结构化判别，命令层的 `rethrow` 无需 import `ModelError` 即可把它转成 `CommandError`，非领域错误（程序 bug）原样上抛；
- `SvgReader` 的警告**收集后返回**，由 model 的 `read` 指令拼进输出，model 层不出现 `console`。

机器可查的验证：

- `grep -rn "model/" src/commands/` → 零命中；
- `grep -n "^import" src/commands_executor/` → 只 import `model/`；
- `grep -rn "from '\.\./" src/model/` → 仅 `shapes/` 到模块内 `../Shape` 的内部引用。

## 4. 变化点假设

| # | 假设的变化 | 留了什么 / 为什么不留 |
|---|---|---|
| 1 | **新增图形类型**（4.4 的 `box` 等插件类型） | 留了：`ShapeFactory.register(type, creator, loader)` 就是 ShapeProvider 插槽的雏形；`EditorModel.createShape` 只认工厂不认识具体类型，「内核新增代码为 0」的目标不变 |
| 2 | **命令集合扩张**（如 rotate、align） | 留了：新命令 = 实现 `Command` 接口（参数个数校验）+ executor/model 各加一个透传方法 + 注册表一行，REPL 零改动，命令类永远不需要学习新的模型类型 |
| 3 | **undo 粒度变化**（宏命令、事务、多指令打包） | 留了：`MacroCommand` 占位；`EditOutcome` 闭包对天然可组合（多个 outcome 的 undo 逆序串起来即一个宏单元）；历史栈集中在执行器一处，改粒度不动模型 |
| 4 | **交互通道增加**（GUI/agent 复用命令层） | 留了：命令不打印、返回字符串；命令层的完整类型签名里不含任何模型类，新前端拿到 `CommandRegistry` + `CommandsExecutor` 就能驱动，编译期就不会误触模型 |
| 5 | **模型实现替换**（如换成远程文档服务） | 留了：commands 与 model 之间只剩 executor 的 string 签名接口，模型可整体替换而命令层零改动 |
| 6 | **显示格式变化**（tree 改缩进风格、show 增加字段） | 留了：渲染集中在 `DisplayView` 一个文件，改格式不动命令层 |
| 7 | **XML 解析器替换**（手卷 → 成熟库） | 留了：解析细节封在 `SvgReader` 内部，对外只暴露 `readFile/readString → {doc, warnings}` |
| 8 | **历史策略变化**（历史上限、持久化历史） | 留了：历史全部集中在 `CommandsExecutor` 一个类里，改策略不动其它任何层 |
| 9 | 序列化格式变化（JSON 导出等） | **没留**：新增一种格式 = `model/` 里加一个平行 Writer 类 + 一条指令，改动本来就局限在一处，提前抽象"Writer 接口"收益不大 |
| 10 | 样式属性白名单扩张 | **没留**：白名单分散在各图形类的 `setGeometryAttribute` 里正是封装的目的，加一个属性改一个类，符合 OCP 的低成本形态 |

# 过程记录

项目经历三次生成/重构与一轮测试，关键讨论与迭代如下（详见各版 readme）：

1. **第一版的问题：cli 越层依赖**。初版代码中 cli 直接依赖 io，不符合 Command 模式的分层意图；与 AI 的沟通偏差没有在第一时间发现。由此确立四层链 `cli → commands → commands_executor → model`，io 与 editor 合并进 model。
2. **第二版：editor 的拆分归属**。原 `Editor` 既持有会话状态又持有历史栈，恰好跨层。拆成两半——会话状态 + 指令逻辑并入 `model/EditorModel`；历史栈 + IO 禁止规则上移为 `commands_executor/CommandsExecutor`。原 `HistoryEntry` 演变为 `EditOutcome`，由模型产出、执行器消费；该接口一度被放到执行器侧，画依赖图时发现会让 model 反向依赖执行器，改回 model 侧。
3. **对 AI 论断的存疑与求证**。第二版文档中"undo/redo 不采用每个命令类自带 undo() 的经典形态"的论述一度造成误导；通过追问与画依赖图确认：真正的约束是"执行器不能反向依赖 commands 层"，而非经典形态本身错误。教训：AI 给出的"理由"要对照依赖图独立验证。
4. **第三版：commands 层去模型依赖**。第二版留了两条"有意识的例外"——`tree`/`show` 自己遍历 `Shape`/`Group` 渲染，`move`/`scale` 用 `mustFind` 只读预检保持报错顺序。讨论后确认这些逻辑都能、且应该封装进 model：渲染需要图形类型信息，本就是模型内部知识（下沉为 `DisplayView` + 显示指令）；报错优先序是模型指令内部的校验编排问题（数字参数原始字符串透传，`mustFind` 先于 `parseNum`）；`instanceof ModelError` 改为 `domainError` 标记判别。重构后 commands 层零 model import。
5. **重构正确性的验证方式**。不满足于"新代码跑通"：先暂存改动、在旧代码上回放测试脚本取黄金输出，恢复后逐字节 `diff`，四份会话输出完全一致才接受重构——架构变了，可观察行为一个字都不能变。
6. **最小测试抓到隐藏 bug**。按"逐类型 create"设计的最小测试当场发现 `create ellipse` 参数个数错位（`need(a,5,6)` 应为 `need(a,4,5)`，fill 取 `a[5]` 应为 `a[4]`）——旧测试从未用 CLI 创建过 ellipse（只经 `read` 走 Loader 路径），两轮回归都没暴露。已修复并复测通过。这印证了"覆盖命令总表每一条语法"比"回放典型会话"更能抓边界 bug。
7. **AI 生成代码的典型失误模式**。批量重写文件时沿用错误的相对导入路径（`tsc --noEmit` 立即报 TS2307）；文档中"伪造"与 AI 的对话过程记录（需人工剔除）；对既有代码做"理由化"叙述而非如实描述。对策：批量改动后第一时间跑类型检查；文档中的过程记录以真实对话为准。

# 一致性自查

## 1. 模块划分

实际目录与方案**一致**。两处有意识的安排，在此记录：

- `UndoCommand.ts / RedoCommand.ts` 放在 `commands/` 根下而非三个子目录之一——它们不属于 document/editing/display 任何一类，只是走统一分发通道的薄壳（转发给 `CommandsExecutor.undo/redo`）；若让 cli 对这两个名字特判，会引入除 `CommandRegistry`、`ShapeFactory` 之外的第三个按名字分派点，违反"按名字分派只允许两处"的约定；
- `MacroCommand.ts` 已实现但当前没有命令使用（各编辑指令在 model 中自行维护逆操作状态），作为插件阶段复合操作的基础设施保留。

## 2. 依赖方向

按第 3 节的三条 `grep` 命令抽样复验（均可重跑）：

- `commands/`：零 model import ✅（第三版重构消除了最后的只读例外）
- `commands_executor/`：只 import `model/`（`EditOutcome`、`EditorModel`、`ModelError`）✅
- `model/`：零外向依赖 ✅
- `cli/`：仅装配边 `new EditorModel()` ✅

方案里的规则没有被违反；唯一保留的例外（cli → model 的 DI 装配边）已在规则中声明并与代码一一对应。

# 质量保证手段

1. **类型安全**：`tsc --noEmit` strict 模式全量通过。
2. **重构前后逐字节比对**：每次重构都先取旧代码的黄金输出，恢复后回放脚本逐字节 `diff`，可观察行为零变化才提交。
3. **最小覆盖测试（`test/`，报告见 `test/test.md`）**：
   - `test/cmds.txt`（31 行）：第 3 节命令总表 20 条命令正常路径全覆盖（六类 create + `in` 子句、容器级 move/scale 递归、save 有参/无参 round-trip、undo/redo）；
   - `test/errs.txt`（21 行）：4.2 错误表 10 个场景 + 4.3「IO 后 undo 禁止」+ `set` 白名单 + 自动补 id 警告，实际输出与规范文案逐字一致；
   - 测试过程发现并修复 1 个真实 bug（ellipse 参数个数错位）。
4. **报错优先序专项**：未 init 时各命令先报 `no document`；`move/scale` 对不存在 id 先报 `no such shape` 再报 `invalid number`；`scale 0` 报 `scale factor must be positive`——重构后逐条回放确认。
5. **round-trip 验证**：`save` 产物再 `read` 回来结构树与元素数完全一致；失败的 save 不封锁 undo（命令失败不改变任何状态）。
6. **依赖方向机器可查**：第 3 节的三条 `grep` 即验证脚本，不依赖人工记忆。
