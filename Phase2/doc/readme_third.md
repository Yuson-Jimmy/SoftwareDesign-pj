# SVG 编辑器（CLI）— 架构文档（第三次：commands 层去模型依赖）

> 本文档对应**第三次重构后**的代码：分层仍是 `cli → commands → commands_executor → model`，
> 但 **commands 层不再 import model 的任何类**——上一版声明的「commands → model 只读边」例外被彻底消除。
> 前两次方案见 `readme_first.md` / `readme_second.md`。

## 架构方案

### 1. 本次重构要解决的问题

第二版中 `commands/` 有两处对 `model/` 的直接依赖（当时作为「有意识的例外」声明）：

1. `tree`/`show` 命令 import `Shape`/`Group`/`Document`，自己遍历图形树做渲染；
2. `move`/`scale` 命令用 `mustFind(document, id)` 做只读预检，以保持「no such shape 优先于 invalid number」的报错顺序；
3. 连带地，`Command.ts` 的公共辅助（`doc`/`mustFind`/`mustContainer`/`rethrow`）全都 import 了模型类，几乎每个命令文件都经由这些辅助间接摸到 `Document`。

结论：**这些逻辑能、且应该封装进 model**。渲染需要图形类型信息，本就是模型内部知识；报错优先序是模型指令内部的校验编排问题。把两者下沉后，命令层只剩参数个数校验与转发，`commands → model` 的边整体删除。

### 2. 模块划分

```
src/
├── cli/                      表现层：读行、解析、打印；装配链入口（DI）
│   ├── Repl.ts / Parser.ts / Messages.ts      （本轮无改动）
│
├── commands/                 命令层：纯薄壳——只依赖 commands_executor
│   ├── Command.ts            Command 接口 + CommandError + rethrow（domainError 结构化判别）
│   │                         + requireDoc（前置检查）+ parseNumber（纯语法级数字解析）
│   ├── MacroCommand.ts / CommandRegistry.ts / UndoCommand.ts / RedoCommand.ts
│   ├── document/             InitCommand ReadCommand SaveCommand CanvasCommand
│   ├── editing/              CreateCommand DeleteCommand MoveCommand ScaleCommand
│   │                         SetCommand GroupCommand UngroupCommand AddtoCommand FrontBackCommand
│   └── display/              TreeCommand ShowCommand HelpCommand   ← 前两个本轮变成薄壳
│
├── commands_executor/        执行器层：commands 与 model 之间的唯一通道
│   └── CommandsExecutor.ts   undo/redo 双栈 + IO 后禁止规则；
│                             新增：tree/show 转发、requireDocument 前置检查；
│                             move/scale 改为透传原始字符串参数；
│                             不再向外暴露 Document
│
└── model/                    领域层：图形世界 + 会话 + SVG 读写 + 全部指令
    ├── EditorModel.ts        文档/编辑指令（同前）+ 新增显示指令 tree(id?)/show(id)；
    │                         moveShape/scaleShape 改为接收原始字符串，
    │                         内部 mustFind 先于数字解析（报错优先序在指令内保证）
    ├── DisplayView.ts        【新增】tree/show 渲染器（原 TreeCommand/ShowCommand 的渲染逻辑）
    ├── EditOutcome.ts        message + undo()/redo() 闭包（同前）
    ├── Shape.ts              ModelError 增加 domainError 标记；parseNum 被指令复用
    └── （SvgReader / SvgWriter / Group / Document / ShapeFactory / shapes 同前）
```

组件图（PlantUML）——注意 `[display cmds] --> [Document]` 这条边已消失：

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

各模块职责（仅列本轮变化）：

| 模块 | 职责变化 |
|---|---|
| `commands/` | 从「语法校验 + display 渲染 + 只读预检」收缩为「参数个数校验 + 透传转发」；不再 import 任何模型类，连 `Document` 类型都见不到 |
| `commands_executor/` | 不再暴露 `document()`；新增 `tree(id?)`/`show(id)` 转发与 `requireDocument()` 前置检查；`move`/`scale` 签名改为原始字符串 |
| `model/` | 新增显示指令 `tree`/`show`（委托 `DisplayView` 渲染）；`moveShape`/`scaleShape` 在指令内部完成「先查 id、再解析数字」的校验编排 |

### 3. 三个关键决策

**(1) 显示指令下沉：`tree`/`show` 的渲染逻辑移入 `model/DisplayView.ts`。**
渲染必须认识 `Shape`/`Group`（`instanceof`、`label`、`geometrySummary()`……），这是典型的模型内部知识。下沉后 `EditorModel` 增加两条只读显示指令 `tree(id?): string` / `show(id): string`，`TreeCommand`/`ShowCommand` 变成与其它命令无异的薄壳。渲染代码本身原样平移，输出一字不变。

**(2) 报错优先序下沉：`move`/`scale` 的数字解析移入模型指令内部，安排在 `mustFind` 之后。**
上一版为了「no such shape 优先于 invalid number」，命令层不得不在解析数字前先向模型要 `Document` 做预检——这正是依赖的来源。现在命令层把 `dx`/`dy`/`factor` 以**原始字符串**透传，模型指令内先 `mustFind(id)` 再 `parseNum(...)`（复用 `Shape.ts` 已有 helper，错误文案一致），顺序天然正确，预检彻底消失。这是「校验顺序属于谁」的重新归属：凡涉及文档状态的校验顺序，只能由持有状态的模型编排。

**(3) `instanceof ModelError` 改为 `domainError` 结构化判别。**
`Command.ts` 的 `rethrow` 负责把领域错误转成 `CommandError`，原先要 import `ModelError`。为切断这条边，`ModelError` 自带 `readonly domainError = true` 标记，`rethrow` 检查该标记而非类型——模型不知道谁在消费这个标记，命令层不知道错误类的名字，依赖保持单向；非领域错误（程序 bug）依旧原样上抛，语义不变。

### 4. 依赖方向规则

```
cli ──→ commands ──→ commands_executor ──→ model
```

严格单向，且 **commands 层例外已删除**：

| 模块 | 允许依赖 | 禁止依赖 | 理由 |
|---|---|---|---|
| `model/` | 无（仅模块内部） | 一切外层 | 领域最稳定 |
| `commands_executor/` | `model/` | commands、cli | 被命令调用，绝不能反过来认识命令 |
| `commands/` | **仅 `commands_executor/`** | `model/`、`cli/` | 本轮核心成果：命令只见执行器接口，参数与返回值全部是 string |
| `cli/` | `commands/`、`commands_executor/`、`model/`（仅装配） | 直接 new 图形类 | 唯一保留的例外：`Repl` 构造 `EditorModel` 注入 executor，属一次性 DI 装配 |

机器可查的验证：

- `grep -rn "model/" src/commands/` → 零命中（只剩注释里的汉字「model」字样，无 import）；
- `grep -n "^import" src/commands_executor/` → 只 import `model/`；
- `grep -rn "from '\.\./" src/model/` → 只有 `shapes/` 到模块内 `../Shape` 的内部引用。

### 5. 变化点假设（相对第二版的增量）

| # | 假设的变化 | 本轮的新增收益 |
|---|---|---|
| 1 | **命令集合扩张** | 新命令的接入面进一步收窄：实现 `Command` 接口（参数个数校验）+ 注册表一行；若需要新领域能力，executor/model 各加一个透传方法——命令类永远不需要学习新的模型类型 |
| 2 | **前端替换/复用命令层**（GUI、agent、测试驱动） | 第二版已让命令返回字符串；本轮后命令层的**完整类型签名里不含任何模型类**，前端对接 `CommandRegistry + CommandsExecutor` 即可，编译期就不会误触模型 |
| 3 | **模型实现替换**（如换成远程文档服务） | commands 与 model 之间只剩 executor 的 string 签名接口，模型可被整体替换而命令层零改动——这是「命令完全不依赖模型」最直接的兑现 |
| 4 | **显示格式变化**（tree 改缩进风格、show 增加字段） | 渲染集中在 `DisplayView` 一个文件，改格式不动命令层 |

## 过程记录

1. **先定验收线再动手**。动手前用 `git stash -u` 暂存全部改动、在旧代码上回放 `test/session1~4.txt` 取四份黄金输出，恢复后逐字节 `diff`，四份完全一致才收工——延续第二版「架构变了，可观察行为一个字都不能变」的验收标准。
2. **`tree`/`show` 下沉几乎是纯平移**，唯一需要决策的是落点：放进 `EditorModel` 会让它继续膨胀，放进 `Document` 又混淆了「文档数据」与「文档视图」。最终独立为 `model/DisplayView.ts` 渲染器，`EditorModel` 的两条显示指令只做委托，保持模型内的单一职责。
3. **`mustFind` 预检的消除路径**。讨论过两个方案：(a) 命令层继续解析数字、executor 暴露 `requireShape(id)` 预检；(b) 数字解析下沉到指令内部。选了 (b)：(a) 只是从「依赖模型类」降级为「依赖 executor 的查询接口」，报错顺序仍由命令层编排，而顺序本质上依赖文档状态，应由模型负责；(b) 让命令层连「顺序」都不知道。代价是 `moveShape`/`scaleShape` 签名从 number 退化为 string，但「指令接收原始参数、自行校验」本就是 EditorModel 既有的风格（`createShape` 的 params 就是 `string[]`）。
4. **`doc()` 辅助的替代**。`doc(executor)` 原有两个职责：触发「no document」统一错误、返回 `Document`。后者随渲染/预检下沉而消失，前者保留为 `requireDoc(executor)` → `executor.requireDocument()`，返回 void，类型上不再泄漏 `Document`。这保住了「no document 优先于 invalid arguments」的报错顺序（如 `tree a b` 在未 init 时仍报 no document）。
5. **`rethrow` 的判别方式**。曾考虑让 executor 捕获 `ModelError` 后改抛通用 `Error`，命令层一律包装——否决，因为这会把模型内的程序 bug（TypeError 等）也包装成用户可见的 `error:` 输出，掩盖故障。`domainError` 标记方案零行为变化，且不需要任何一方 import 对方的类。
6. **重复代码的顺手清理**。下沉时发现 `Shape.ts` 已有 `parseNum`（与命令层 `parseNumber` 逻辑、文案完全一致），`EditorModel` 直接复用，删掉了一开始顺手写的重复函数。命令层的 `parseNumber` 仍保留给 `canvas`/`init` 的宽高解析——那是与文档状态无关的纯语法校验，顺序无关紧要，留在命令层名正言顺。
7. **环境小坑**。本机 `node_modules` 里实际装的是 TypeScript 5.9.3，不认 `tsconfig.json` 里的 `"ignoreDeprecations": "6.0"`（该值面向 TS 6.x）；验证时用 `tsc -p tsconfig.json --noEmit --ignoreDeprecations 5.0` 覆盖，不改项目配置。

## 一致性自查

### 1. 模块划分

- 目录结构与第 2 节方案一致，新增文件仅 `model/DisplayView.ts`；
- `TreeCommand`/`ShowCommand`/`MoveCommand`/`ScaleCommand` 已收缩为薄壳，与其它命令同构：参数个数校验 → `requireDoc`（按需）→ try/转发 → `rethrow`。

### 2. 依赖方向

`grep` 复验（见第 4 节三条命令，均可重跑）：

- `commands/`：零 model import ✅（第二版的例外条款删除）
- `commands_executor/`：只 import `model/`（`EditOutcome`、`EditorModel`、`ModelError`）✅
- `model/`：零外向依赖 ✅
- `cli/`：仅装配边 `new EditorModel()` ✅

## 质量保证手段

1. **类型安全**：`tsc --noEmit` strict 全量通过（本机 TS 5.9.3 需 `--ignoreDeprecations 5.0` 覆盖，见过程记录 7）。
2. **重构前后逐字节比对**：`git stash -u` 回到旧代码取黄金输出，恢复后四份回放脚本（`test/session1~4.txt`）新旧输出 `diff` 完全一致。
3. **报错优先序专项回放**（覆盖本轮动过的三条顺序）：未 init 时 `tree`/`move …`/`tree a b` 均先报 `no document`；`move badid xx yy` 与 `scale badid xx` 先报 `no such shape`；`move r1 xx 1`/`scale r1 xx` 报 `invalid number`；`scale r1 0` 报 `scale factor must be positive`——全部符合原行为。
4. **依赖方向机器可查**：第 4 节三条 `grep` 命令即验证脚本，不依赖人工记忆。
