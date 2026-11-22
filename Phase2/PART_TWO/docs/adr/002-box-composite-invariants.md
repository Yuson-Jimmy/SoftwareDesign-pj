# ADR-002：box 复合结构的 id、读回与子部件保护

## 状态

Accepted，2026-11-22。

## 决策

### 1. 子部件 id 与创建原子性

BoxProvider 固定派生 `<id>-rect` 和 `<id>-label`。创建仍由 EditorModel 走统一 Document.attach：它在挂载前通过 assertAbsentDeep 检查整棵新子树，包括派生 id。任一冲突都会在修改父容器前抛错，因此不会遗留 box 容器或单独子部件，也不进入 undo 历史。

### 2. 已安装插件时，非法 box 拒绝整个 read

ShapeProvider 新增可选 validate(shape)，SvgReader 在该元素的全部子元素构建后调用。BoxPlugin.validate 要求存在正确 id 且类型分别为 Rect、Text 的两个必要部件；缺失或类型错误抛 ModelError。选择“明确拒绝”而不是警告降级，避免安装了 box 却生成语义不完整的对象。

SvgReader 始终在临时 Document 中构建，EditorModel.read 仅在完整成功后替换当前文档。因此校验或重复 id 失败时，原文档及其历史引用保持不变。重复 id 由全局注册表拒绝，不能靠降级规避。

### 3. 未安装插件时才降级为普通 g

当 data-kind="box" 对应提供者未注册时，SvgReader 按物理标签 g 读取，不调用 box validate。矩形、文字和嵌套结构仍保留，只丢失 box 的便利属性及复合保护语义。

### 4. 必要子部件不可由普通命令拆走

Shape 公开通用 structuralPart 标记，BoxPlugin 为内部 rect/text 设置。EditorModel 的 delete、group、addto 统一拒绝 structuralPart，报 `cannot modify plugin-owned shape part: <id>`；检查发生在任何 detach/reparent 之前。整个 box 的 delete/group/move 不受影响，ungroup box 仍由 composite 契约拒绝。

该约束只保护结构完整性；子部件的几何或样式编辑不禁止。未来其他复合插件可复用同一标记，内核无需添加 box 条件分支。

### 5. 回显由领域对象和属性处理器提供

Shape.operationLabel 与 creationDetail 让 box 的命令回显使用 box#id 和子部件明细，而树中的物理标签仍为 g#id (box)。AttributeChange 可选 message/undoMessage 提供 fill propagated、label updated/restored 的精确文案。默认图形回显不变。

## 验证

`src/test/boxPlugin.test.ts` 只装配 boxPlugin 与文件内定义的读取测试替身，不依赖其他插件。测试覆盖派生 id 冲突无残留、复合移动/嵌套/删除、属性撤销、必要子部件保护、缺失/错误部件和重复 id 的整读失败、原文档保持，以及合法嵌套 box 读回。
