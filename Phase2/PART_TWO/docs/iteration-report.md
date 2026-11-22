# Phase 1 → Phase 2 迭代报告

## 结论

Phase 2 将 Phase 1 的集中式编辑器拆成“稳定内核 + 四个内核侧扩展点 + 唯一组合根 + 可插拔扩展”。原有命令链和文档领域行为保留，box、stats、dir、树标签均通过统一注册路径接入；代码装配和字符串配置装配共享事务校验，新增 ping 演示插件的 A/B 提交满足既有内核零差异要求。

## 架构对比

PlantUML 源文件：

- [Phase 1 final](architecture/phase1-final.puml)
- [Phase 2 插件式架构](architecture/phase2-plugins.puml)

主要变化：

1. Phase 1 的 `Editor` 同时管理会话、领域操作和 IO；Phase 2 由 `EditorModel` 提供领域服务，`CommandsExecutor` 独立管理历史。
2. ShapeFactory 不再只是集中构造点，而是消费 `ShapeProvider`；属性传播和树行尾标签分别抽象为 `AttributeHandler`、`TreeDecorator`。
3. 应用启动时才决定插件集合。内核不 import box、stats、dir 或 modified-star，也没有按插件名分派的 switch。
4. 插件注册从“逐项直接写入”升级为暂存、同类查重、清单集合校验、一次提交；失败插件不改变已有状态。
5. `dir` 通过 DirectoryPort 访问目录，NodeDirectoryAdapter 隔离真实文件系统；命令测试可使用内存替身。

## 扩展点收益

| 变化 | Phase 1 | Phase 2 |
| --- | --- | --- |
| 新图形 | 修改工厂及关联模型 | 新增 ShapeProvider 并在组合根/配置登记 |
| 新命令 | 修改默认命令注册表 | 插件贡献 Command |
| 新树标签 | 修改 DisplayView | 插件贡献 TreeDecorator |
| 复合属性 | 在 Shape/set 中增加分支 | 插件贡献 AttributeHandler，一次 undo |
| 插件选择 | 修改运行逻辑 | 方式 A 改组合根；方式 B 只改配置 |

## 量化结果

完整数字及口径见 [metrics/summary.md](metrics/summary.md)，逐文件职责见 [metrics/files.tsv](metrics/files.tsv)。所有数字由 `scripts/metrics.js` 从 Git 历史生成；final 的 CLI 全归入内核，目标按 kernel/assembly/plugins 分类，VSCode 独立统计。复杂度采用统一的 TypeScript AST 决策点口径，便于横向比较，不与外部商业工具混用。

## 质量与风险处理

- 属性处理器部分失败通过 Document checkpoint 回滚，既有历史闭包保持对象身份。
- box 派生 id 冲突、非法读回不留下半成品；无 box 插件时按普通 g 降级。
- dirty 按内容快照判定，undo 回保存点即清除；子树变化传播祖先。
- 配置 loader 不硬编码插件；四条失败路径、重复注册和回滚均有独立测试。
- 三组 transcript 分离命令与预期输出，A/B 输出逐字节比较；dir 使用固定 cwd，日志写在其外部。

## 后续工作

本轮按用户要求不打 `p2`、不推送远程。发布时只需在最终验收提交上创建标签，推送同一远程仓库，并用 `--to p2` 重新生成指标。
