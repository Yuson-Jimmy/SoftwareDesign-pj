# Phase 2 验收矩阵与证据

## 1. 交付物状态

| 交付物 | 位置 | 状态 |
| --- | --- | --- |
| VSCode 扩展源码、宿主注册与测试 | `Phase2/PART_ONE/src` | 已完成 |
| CLI 内核、四类扩展点、插件、宿主与组合根 | `Phase2/PART_TWO/src` | 已完成 |
| 统一文档入口 | `Phase2/PART_TWO/doc/README.md` | 已完成 |
| PlantUML 前后依赖图 | `docs/architecture/` | 已完成 |
| ADR | `docs/adr/001` 至 `004` | 4 条，满足至少 3 条 |
| 历史指标脚本与结果 | `scripts/metrics.js`、`docs/metrics/` | 已从 Git 历史生成并核对汇总 |
| 人工验收步骤 | `docs/todo.md` | 已提供六部分操作清单 |
| 远程仓库 tag `p2` | Git 标签 | **本轮按要求不打 tag、不推送** |

## 2. 第一部分：VSCode 实践

| 验收项 | 证据 | 结果 |
| --- | --- | --- |
| SVG 文件 badge 为 `[]`，文件内容不变 | `PART_ONE/docs/images/vscode-svg-badge.png`；文件装饰集成测试 | 已覆盖 |
| 普通文件与 `.svg` 目录不误标 | `extension.test.ts` 的 decoration 测试 | 已覆盖 |
| 原生 Outline 层级、无 id 节点和点击定位 | `PART_ONE/docs/images/vscode-svg-outline.png`；符号提供者集成测试 | 已覆盖 |
| 编辑后大纲更新 | WorkspaceEdit 集成测试 | 已覆盖 |
| 未闭合、错配、未终止属性/注释等异常输入 | 解析器单元测试及真实扩展宿主异常测试 | 已覆盖，不抛出宿主崩溃 |
| Image Preview 跳转修复 | 默认文本编辑器关联及导航回归测试 | 已覆盖 |
| 模式分析、A.3 复用评估 | `PART_ONE/docs/README.md` 第 4–6 节 | 已完成 |

VSCode 指标独立列在 `docs/metrics/summary.md`，不混入 CLI 增量。

## 3. 第二部分：插件式 CLI

| 项 | 扩展点 | stats / dir | box | 标签 | 两种装配 |
| --- | --- | --- | --- | --- | --- |
| 接口在内核侧 | `ShapeProvider`、`Command`、`TreeDecorator`、`AttributeHandler` | Command | ShapeProvider + AttributeHandler + TreeDecorator | TreeDecorator | PluginContext 由装配层实现 |
| 以类实现扩展点 | 接口与注册表齐备 | StatsCommand、DirCommand、NodeDirectoryAdapter | Box extends Group；处理器/装饰器对象实现接口 | ModifiedStarDecorator | PluginCatalog / PluginRegistrar |
| 不反向依赖内核实现 | 内核只调用接口 | 依赖公开 Executor/Model | 依赖公开 Shape/Group API | 只接收 Shape 与文档通知 | loader 不导入具体插件 |
| 禁用可选扩展的缺省行为 | 未注册类型/命令报错，无属性处理器回退白名单 | unknown command | 无 provider 时普通 g 降级 | 无标签时 Phase1 树逐字节不变 | 非法配置回退默认能力 |
| 独立可测 | 空插件与单内置插件测试 | stats/dir 独立启停；dir 测试替身和真实 fs | `boxPlugin.test.ts` 8 项独立测试 | `treeLabelPlugin.test.ts` 4 项独立测试 | `configLoading.test.ts`；ping 独立测试 |
| 插件间协作 | 统一注册路径 | 与 box 共同统计 | `(box)` 来自 box 插件 | `(box) *` 顺序共存 | 同一 ping 插件 A/B 行为相同 |
| 输出逐字节一致 | Phase1 基线 | 三组 transcript 含 stats/dir | box transcript | 无标签基线 | 三组 A/B transcript + 真实 CLI cmp |
| Adapter | — | DirectoryPort / NodeDirectoryAdapter / Node fs | — | — | A/B 共用 Application.installPlugin |

### 3.1 加载器失败与回滚

`configLoading.test.ts` 实际覆盖：模块找不到、无默认导出、manifest mismatch、activate 抛错、依赖求值失败、duplicate registration、暂存回滚、后续插件继续加载、非法配置回退、options 和 enabled。要求中的四条失败路径均有精确错误断言，模块依赖失败不会误报顶层 not found。

### 3.2 A/B 接入差异的可审计演示

早期功能提交承担过扩展点硬化，不能冒充“既有内核差异为零”。因此最终历史增加了专门的 `ping` 最小演示：

- 方式 A：`96f9d11 演示方式A：新增ping插件并仅修改组合根 byKimi`
- 方式 B：`7339731 演示方式B：仅修改配置装入ping插件 byKimi`

方式 A 的运行代码差异仅为新增 `src/plugins/demo/` 和修改 `src/app/Application.ts`；测试文件属于允许的测试变化。方式 B 只修改 `plugins.config.json`，传入与 A 相同的 `{ "text": "configured" }`。两种启动均输出 `pong configured`。

人工复核：

```bash
# A：内核与既有插件差异应为空；Application.ts 是唯一允许的既有运行文件变化
git diff --name-status 96f9d11^ 96f9d11 -- \
  Phase2/PART_TWO/src/cli Phase2/PART_TWO/src/commands \
  Phase2/PART_TWO/src/commands_executor Phase2/PART_TWO/src/model \
  Phase2/PART_TWO/src/plugins ':(exclude)Phase2/PART_TWO/src/plugins/demo'

# B：全部既有运行源码差异应为空
git diff --name-status 7339731^ 7339731 -- Phase2/PART_TWO/src

# 完整 A 文件清单：应只有 Application、demo 新包和独立测试
git diff --name-status 96f9d11^ 96f9d11

# 完整 B 文件清单：应只有 plugins.config.json
git diff --name-status 7339731^ 7339731
```

上述路径均实际存在；不是对不存在路径取得的“空差异”。

## 4. ADR 对照

| ADR | 决策主题 |
| --- | --- |
| 001 | 属性扩展点事务、undo 单元和失败回滚 |
| 002 | box 读回校验、无插件降级与子部件保护 |
| 003 | dirty 内容语义、保存点 undo、祖先传播和标签顺序 |
| 004 | A/B 同一路径、配置清单校验时机、暂存提交和 options |

## 5. 过程节点

| 节点 | 普通 commit | 状态 |
| --- | --- | --- |
| VSCode 实践 | `ccb0bfb` 至 `d80c603` 等 PART_ONE 提交 | 文件标记、大纲、异常与复用分析完成 |
| 框架可扩展 | `8d68c80 2-1` | 四扩展点和 Phase1 回归就位；指标脚本在收尾补齐，未伪称当时已存在 |
| 命令插件完成 | `00c4e62 2-2` | stats、dir、Adapter 和测试完成 |
| box 接入 | `dda0efd 2-3`、`ac74a0e 2-4` | 属性事务、复合边界与独立测试完成 |
| 标签完成 | `f1a418f 2-5` | 两标签并存及 dirty 状态机完成 |
| 双装配 | `a5aa38e 2-6` | 通用 loader、失败回滚和 transcript 完成 |
| A/B 判据演示 | `96f9d11`、`7339731` | 两次普通 commit，信息均以 byKimi 结尾 |
| 收尾 | 本轮文档/指标提交 | 依赖图、迭代报告、验收矩阵与指标 |

## 6. 最终验证与发布边界

- CLI：`npm run test:all`，33 项测试通过。
- VSCode：单元测试 6 项通过；首次集成测试因下载 VSCode 超时未进入用例，随后按项目说明指定本机 `Code.exe` 重跑，真实扩展宿主 6 项通过、1 个截图场景默认跳过。两张既有演示截图已重新打开核对。
- 指标：脚本输出总数已与逐文件明细自动核对。
- 格式：`git diff --check` 通过。
- 本轮未创建 `p2`，未执行远程推送。后续获准发布时，可在最终提交上创建 `p2`，再执行 `npm run metrics -- --to p2` 重新生成以 p2 为目标的指标并提交。
