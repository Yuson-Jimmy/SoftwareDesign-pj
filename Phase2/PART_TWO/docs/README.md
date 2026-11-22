# PART_TWO 插件式重构说明

## 1. 目标与结论

本版从 Phase1 复制代码后进行插件式重构，保留 `cli → commands → commands_executor → model` 的依赖方向。四个扩展点的接口都放在内核一侧，内核只依赖接口；`box`、`stats`、`dir`、树标签和属性传播均位于 `plugins/`，不进入内核白名单或条件分支。

**后续新增一个插件通常只需两个位置：新增一个实现 `Plugin` 的文件，并在 `app/Application.ts#createDefaultApplication` 的数组中加入该插件。** 不需要修改 REPL、XML 解析器、树渲染器、ShapeFactory 或 AttributeRegistry。若一个插件只贡献某一类扩展，只需填写对应字段。

## 2. 扩展点清单

| 扩展点接口 | 职责 | 内核调用位置 | 本阶段实现 | 禁用可选扩展时的行为 | 违约/缺省处理 |
| --- | --- | --- | --- | --- | --- |
| `ShapeProvider`（`model/ShapeProvider.ts`） | 提供一种图形的 CLI 构造及 SVG 读回 | `ShapeFactory.create/load`；间接触发于 `EditorModel.createShape` 和 `SvgReader.readString` | `BuiltinShapePlugin.ts` 中 rect/circle/ellipse/line/text/g；`BoxPlugin.ts` 中 box | 未注册类型报 `unknown shape type: <type> (is the plugin loaded?)`；无 box 时 `data-kind="box"` 降级为普通 `g` | 重复注册报 `shape provider already registered`；无 loader 结果返回 `null`，读入跳过该元素 |
| `Command`（`commands/Command.ts`） | 一条用户命令的语法校验与执行 | `CommandRegistry.resolve`、`Repl.handleLine` 调 `Command.execute` | Phase1 全部命令；`StatsCommand`；`DirCommand` | 未注册命令报 `unknown command: <name>`；Phase1 内置命令仍由默认注册表提供 | 用户错误转为 `CommandError`，由 REPL 输出 `error:`；非领域程序错误原样抛出，不静默吞掉 |
| `TreeDecorator`（`model/TreeDecorator.ts`） | 返回结构树某节点行尾的零个或多个标签 | `DisplayView.nodeLine`，由 `renderTree/renderChildren` 对每行调用 | `ModifiedStarPlugin.ts` 输出 `*`；`BoxPlugin.ts` 输出 `(box)` | 装饰器数组为空时仍输出 Phase1 原始树行 | 返回 `[]` 表示无标签；标签只拼接展示，不修改图形或树结构 |
| `AttributeHandler`（`model/AttributeHandler.ts`） | 定义某类型某属性的修改，并返回完整 undo/redo 变更闭包 | `EditorModel.setShapeAttribute` 经 `AttributeRegistry.apply` 调用 | `BoxPlugin.ts`：`fill` 转发内部 rect；`label` 转发内部 text | 无匹配处理器时走 Phase1 `Shape.get/set/clearAttribute`，原白名单不变 | 重复键在装配期拒绝；执行失败不回退默认处理；Document 检查点回滚部分修改且历史不变，详见 ADR-001 |

## 3. 默认装配与内核独立性

`app/Application.ts` 是唯一装配入口：

1. `createApplication(plugins)` 创建空的 ShapeFactory、AttributeRegistry、装饰器数组及 Phase1 默认命令注册表；
2. 遍历插件并分别注册四类扩展；
3. 构造 EditorModel 与 CommandsExecutor；
4. `createDefaultApplication()` 分别注册内置六图形、box、modified-star、stats、dir；
5. `Repl` 只接收 Application，不直接 new 图形或插件。

`createApplication([])` 可启动并完成 `init`，但没有图形和可选命令；`createApplication([builtinShapePlugin])` 提供无第三方框架的 Phase1 行为。这说明启动不依赖任何动态插件加载框架，内置实现也只是普通的显式注册。

`statsPlugin` 与 `createDirPlugin()` 是两个独立插件包，可以分别加入或移出代码装配数组。另一种方式是 JSON 配置装配：默认 `plugins.json` 的 `plugins` 数组列出同名插件，`createConfiguredApplication(path)` 经 `PluginCatalog` 创建相同实例。直接启动 CLI 时可设置 `SVG_EDITOR_CONFIG` 指向配置文件；不设置时使用代码装配。两种方式复用同一个 StatsCommand、DirCommand、DirectoryPort 和 NodeDirectoryAdapter。

## 4. box 复合图形

- `create box <id> <x> <y> <w> <h> "<标题>"` 创建一个插件所有的 Group，内部 id 为 `<id>-rect` 和 `<id>-label`；创建回显包含完整派生结构。
- Box 继承 Group，因此移动、缩放、删除、嵌套、加入其他组均复用 Composite 路径；`composite=true` 使 `ungroup` 报 `cannot ungroup composite shape`。
- `(box)` 是 TreeDecorator，不让 DisplayView 判断 Box 类；`fill`、`label` 是 AttributeHandler，不向 Shape 基类添加属性分支，并提供 Phase1 会话规定的领域回显。
- 序列化为普通 `<g data-kind="box">` 和 rect/text。注册 box 时恢复复合语义；未注册时按普通 `g` 降级，内容不丢失。
- 创建前检查整棵新子树的 id，派生 id 冲突不留下任何部件。安装插件后读到缺失/错误部件会拒绝整个 read 并保留原文档；重复 id 同样拒绝。
- 必要子部件带通用 structuralPart 标记，普通 delete/group/addto 不得拆走；整个 box 的删除、移动和编组仍可用。详见 [ADR-002](adr/002-box-composite-invariants.md)。
- box 行可同时显示 `(box)` 与 `*`，默认顺序为 `(box) *`，两个标签互不知晓。

### 4.1 树标签与 modified-star 状态机

`modified-star` 按“当前普通 SVG 内容与上次保存快照不一致”判定 dirty，而不是按是否执行过编辑命令判定。新建节点没有保存快照，因此立即显示 `*`；`init/read` 建立初始基线，`save` 成功后更新基线；编辑后 undo 回到保存点时 `*` 消失，redo 后恢复。子图形变化会传播到祖先容器，完整树的 `svg (WxH)` 根行也会显示 `*`。

快照保存在每个装饰器实例的 `WeakMap` 字段中，不使用模块级集合，也不再占用 Shape 内核字段。内核只提供通用 `documentLoaded/documentSaved` 通知；DisplayView 按插件注册顺序用空格拼接标签，不识别具体标签。无装饰器时根行和节点行保持 Phase1 原样。完整决策见 [ADR-003](adr/003-tree-label-state-and-order.md)。

### 4.2 属性事务契约

处理器通过公开 Shape 或插件公开的子部件访问器执行修改，并返回 AttributeChange 闭包；一次 set 无论修改多少子部件都只登记一个 undo 单元。同类型同属性多个处理器在装配期明确拒绝。apply 抛错时 Document.checkpoint() 原地恢复字段、子节点顺序和 id 注册表，既有历史闭包的对象身份不变，也不新增历史或清空 redo。无处理器命中才进入 Phase1 白名单。完整决策见 [ADR-001](adr/001-attribute-handler-transactions.md)。

## 5. stats 与 dir

### 5.1 stats

`stats` 无参数，需要先 init/read。它从画布根按当前子节点顺序深度优先遍历：普通 g 与 box 只计入 containers，内部叶子继续计数，根 SVG 不计入。输出为单行 `rect: 3  circle: 1  (total 6, containers 2)`，类型按首次出现顺序而非字典序；空文档只输出 `(total 0, containers 0)`。它只读模型，不进入 undo 栈。

### 5.2 dir 及 Adapter 角色

`dir` 不接收参数，只读取 CLI 进程的当前工作目录，与当前 SVG 路径无关。输出目录在前、文件在后，各组按名称升序，每项一行，使用 `[DIR]  name` 或 `[FILE]  name` 两个空格分隔；包含隐藏项，空目录输出 `(empty directory)`。符号链接和其他特殊项不访问目标，作为 `[FILE]` 显示。

适配器模式的对应关系：

| 角色 | 本实现 |
| --- | --- |
| Client | `DirCommand`，负责无参数校验和精确输出格式 |
| Target | `DirectoryPort.list(): DirectoryEntry[]`，公开目录读取端口 |
| Adaptee | Node `fs.readdirSync(..., { withFileTypes: true })` |
| Adapter | `NodeDirectoryAdapter`，固定 process.cwd()，转换 Dirent，分组并稳定排序 |

读取失败输出 `error: cannot read directory: <path>`。dir 不需要 init/read，也不修改文档、dirty、cwd 或 undo/redo 历史。

## 6. 后续插件式修改示例

假设新增菱形及 `rotate` 命令：

1. 新增 `plugins/diamond/DiamondPlugin.ts`，实现 ShapeProvider，可同时声明其 AttributeHandler 或 TreeDecorator；
2. 新增 `plugins/rotate/RotatePlugin.ts`，实现 Command；
3. 在 `createDefaultApplication()` 数组登记两个插件。

无需修改 ShapeFactory、SvgReader、DisplayView、Shape 基类或 Repl。若 rotate 需要此前不存在的领域操作，只需在公开执行器/模型服务增加该通用操作；命令解析、树渲染和其他插件均不受影响。

## 7. 测试

```bash
npm run test:all
```

`src/test/plugins.test.ts` 在真实 Repl/注册表/工厂/模型调用链上验证：默认六图形与 Phase1 命令、空插件缺省行为、box 创建和嵌套、两类树装饰、fill/label 传播及 undo/redo、SVG 读回和降级、stats 深度优先顺序及容器排除、stats/dir 独立启停、dir 格式/空目录/隐藏项/失败、undo/redo 不变，以及临时目录中代码装配与配置装配的真实适配器输出一致。属性专项还覆盖普通白名单回退、多子字段单次撤销、重复处理器拒绝和故障后的文档/历史回滚。

最终验证：strict 类型检查通过，**28 项测试全部通过，0 失败**。其中 `boxPlugin.test.ts` 的 8 项独立测试不依赖其他插件，另含 Phase1 §6.1 box 会话端到端复现；`treeLabelPlugin.test.ts` 的 4 项测试独立覆盖 Phase1 树基线、新建/保存/编辑/undo/redo 状态机、祖先传播和插件实例隔离。
