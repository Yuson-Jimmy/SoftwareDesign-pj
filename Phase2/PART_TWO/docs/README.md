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
| `AttributeHandler`（`model/AttributeHandler.ts`） | 定义某类型某属性的 get/set/clear，支持撤销 | `EditorModel.setShapeAttribute` 经 `AttributeRegistry.get/set/clear` 调用 | `BoxPlugin.ts`：`fill` 转发内部 rect；`label` 转发内部 text | 无匹配处理器时走 Phase1 `Shape.get/set/clearAttribute`，原白名单不变 | 重复键报 `attribute handler already registered`；未知属性继续报 `unknown attribute`；旧值 `undefined` 也会正确走 handler 的 clear |

## 3. 默认装配与内核独立性

`app/Application.ts` 是唯一装配入口：

1. `createApplication(plugins)` 创建空的 ShapeFactory、AttributeRegistry、装饰器数组及 Phase1 默认命令注册表；
2. 遍历插件并分别注册四类扩展；
3. 构造 EditorModel 与 CommandsExecutor；
4. `createDefaultApplication()` 注册内置六图形、box、modified-star、stats/dir；
5. `Repl` 只接收 Application，不直接 new 图形或插件。

`createApplication([])` 可启动并完成 `init`，但没有图形和可选命令；`createApplication([builtinShapePlugin])` 提供无第三方框架的 Phase1 行为。这说明启动不依赖任何动态插件加载框架，内置实现也只是普通的显式注册。

## 4. box 复合图形

- `create box <id> <x> <y> <w> <h> "<标题>"` 创建一个插件所有的 Group，内部 id 为 `<id>-rect` 和 `<id>-label`；创建回显为 `box#id created`。
- Box 继承 Group，因此移动、缩放、删除、嵌套、加入其他组均复用 Composite 路径；`composite=true` 使 `ungroup` 报 `cannot ungroup composite shape`。
- `(box)` 是 TreeDecorator，不让 DisplayView 判断 Box 类；`fill`、`label` 是 AttributeHandler，不向 Shape 基类添加属性分支。
- 序列化为普通 `<g data-kind="box">` 和 rect/text。注册 box 时恢复复合语义；未注册时按普通 `g` 降级，内容不丢失。
- 新建及 move/scale/set/group 的目标具有 `*`；save 后清除修改标记。撤销 move/scale/set 恢复此前的标记状态。

## 5. stats 与 dir

- `stats` 无参数，需要先 init/read。输出首行 `total N`，之后按领域类型字典序输出 `<type> <count>`；box 的内部 rect/text 作为真实树节点计数。
- `dir [path]` 默认读取当前目录，输出排序后的名称，目录名带 `/`。`DirCommand` 依赖 `DirectoryPort`，`NodeDirectoryAdapter` 负责适配 Node 文件系统，因此测试可注入内存实现。

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

`src/test/plugins.test.ts` 在真实 Repl/注册表/工厂/模型调用链上验证：默认六图形与 Phase1 命令、空插件缺省行为、box 创建和嵌套、两类树装饰、fill/label 传播及 undo/redo、SVG 读回和降级、stats、dir 适配器、save 清除修改标记。

最终验证：strict 类型检查通过，**7 项测试全部通过，0 失败**。
