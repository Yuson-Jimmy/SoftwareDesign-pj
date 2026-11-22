# ADR-001：AttributeHandler 的冲突、撤销与失败回滚

## 状态

Accepted，2026-11-22。

## 背景

仅提供 `handles(shapeId, attr)` 与 `apply(shapeId, attr, value)` 无法说明目标访问、多处理器冲突、复合修改的撤销粒度及失败后的状态。box 的 fill/label 又是针对内部子部件的领域语义，不能进入内核属性白名单。

## 决策

### 1. 公开目标访问

`AttributeHandler.apply(shape: Shape, value: string): AttributeChange` 直接接收内核公开的 Shape 抽象。处理器通过公开 `type`、图形公开方法或插件自己公开的 Box 访问器获取子部件，不依赖宿主装配模块，也不访问 Document 私有注册表。shapeType + attribute 是注册唯一键。

### 2. 多处理器冲突：拒绝注册

同一 shapeType + attribute 只允许一个处理器。AttributeRegistry 在装配时发现重复立即抛 `attribute handler already registered: <type>.<attr>`，不采用隐式覆盖、优先级猜测或不确定的组合顺序。不同键互不冲突。处理器存在但执行失败时，绝不再转入默认属性处理。

### 3. 一次 set = 一个 undo 单元

`AttributeChange` 包含 `undo()` 与 `redo()` 闭包。处理器在 apply 时捕获全部旧值，因此即使修改多个子部件，也由一个 EditOutcome 持有整组逆操作。CommandsExecutor 只登记这一个 outcome；undo/redo 不重新匹配或新建处理器。

### 4. 失败回滚与历史不变

EditorModel 在调用处理器前创建 `Document.checkpoint()`。检查点记录画布、现有 Shape 的标量字段、Group.children、parent 与 id 注册表。apply 或默认白名单处理抛错时立即 restore，再将错误原样上抛。

恢复采用**原对象原地修复**，而非反序列化替换 Document：旧 EditOutcome 闭包仍引用同一批 Shape 对象，所以既有 undo/redo 历史继续有效。失败发生在 EditorModel 返回 EditOutcome 之前，CommandsExecutor 不会新增历史条目，也不会清空 redo。

### 5. 缺省行为

AttributeRegistry.apply 返回 undefined 才表示无处理器命中，此时使用 Phase1 `Shape.get/set/clearAttribute`。普通 rect 的 fill 无需插件；rect 的 label 等未定义属性仍报 `unknown attribute`。

## 后果

- 插件必须让返回的闭包捕获完整逆操作；内核不猜测复合属性的旧值。
- 检查点适用于当前以标量字段和 Group.children 构成的图形模型；未来引入嵌套可变值对象时，应扩展检查点的深复制策略。
- 重复处理器在启动/装配期失败，而不是用户编辑时才产生不确定行为。
