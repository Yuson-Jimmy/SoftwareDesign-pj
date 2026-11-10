# 测试报告 — SVG 编辑器（CLI）

## 1. 范围与方法

- **依据**：`phase_cli_1.md` 第 3 节命令总表（20 条命令）、4.2 错误信息约定、4.3 undo/redo 粒度、第 2 节自动补 id 警告、4.1 `set` 白名单。
- **方法**：脚本回放（`cat 脚本 | npm run cli`），逐行核对实际输出与规范文案；`tsc --noEmit`（strict）类型检查。
- **原则**：尽可能少的文本量——两份脚本共 49 行（含注释），覆盖全部命令与全部规范要求的报错。

## 2. 测试文件

| 文件 | 内容 |
|---|---|
| `test/cmds.txt`（31 行） | 正常路径：20 条命令全覆盖（六类 create + `in` 子句、容器级 move/scale、`save` 有参/无参、`canvas` 查/改等） |
| `test/errs.txt`（21 行） | 错误路径：4.2 错误表 + 4.3 IO 后 undo 禁止 + `set` 白名单 + 自动补 id 警告，每行一个场景 |
| `test/fix.svg`（1 行） | 含一个无 id `<rect>` 的外部 SVG，供 `read` 触发自动补 id 警告 |

## 3. 覆盖矩阵与结果

### 3.1 命令覆盖（`cmds.txt`，全部通过 ✅）

| 规范（第 3 节） | 脚本行 | 验证点 |
|---|---|---|
| `init [w] [h]` | 2 | 默认 800×600（带参在 session 历史与 `canvas` 改尺寸处覆盖） |
| `canvas [w] [h]` | 3–4 | 无参查询 `canvas 800x600`；带参修改 `canvas resized to 400x300` |
| `create rect/circle/ellipse/line/text/g` | 5–10 | 六种类型逐条创建，回显正确 |
| `create … in <containerId>` | 11 | `rect#r2 created in g#g1` |
| `addto`（叶子与容器） | 12, 14 | 叶子入容器；容器 `g2` 入 `g1`（为 ungroup 造非根父级） |
| `group` / `ungroup` | 13, 15 | `g#g2 created with 2 children`；`ungrouped, 2 children moved into g#g1` |
| `move` / `scale`（容器递归） | 16–17 | `g#g1 moved by (1,1)` / `scaled by 2`；tree 中子孙坐标递归生效（`cx=12 cy=12 r=4`） |
| `set`（text 内容与样式） | 18–19 | `text="yo"`；`fill="blue"` |
| `front` / `back` | 20–21 | `moved to front/back` |
| `delete` | 22 | `rect#r2 deleted`；undo 恢复、redo 再删（27–28 行） |
| `tree` / `tree <id>` / `show` / `help` | 23–26 | 全文档树、子树、属性明细、命令清单，格式符合 5.1/5.2 |
| `undo` / `redo` | 27–28 | 一个编辑 = 一个 undo 单元 |
| `save [file]` / `read` / `save`（无参） | 29–31 | 保存到指定路径；读回；无参保存到来源路径（round-trip 元素数一致：6） |

### 3.2 错误覆盖（`errs.txt`，全部通过 ✅）

| 规范（4.2/4.3） | 脚本行 | 期望输出 | 实际 |
|---|---|---|---|
| 未 read/init 执行其他命令 | 2 | `error: no document. use 'init' or 'read' first` | ✅ 一致 |
| id 已存在 | 5 | `error: id already exists: r1` | ✅ 一致 |
| id 不存在 | 6 | `error: no such shape: r9` | ✅ 一致 |
| `in` 目标不存在 | 7 | `error: no such container: node9` | ✅ 一致 |
| `in` 目标不是容器 | 8 | `error: not a container: r1` | ✅ 一致 |
| 未注册的图形类型 | 9 | `error: unknown shape type: hexagon (is the plugin loaded?)` | ✅ 一致 |
| ungroup 叶子图形 | 10 | （规范未定义叶子场景） | `error: not a container: r1`，语义合理 |
| group 目标含容器与其子孙 | 13 | `error: cannot group a container into its own descendant: g1` | ✅ 一致 |
| ungroup 根级容器 | 14 | `error: cannot ungroup top-level container: g1` | ✅ 一致 |
| scale 非正数 | 15 | `error: scale factor must be positive` | ✅ 一致 |
| `set` 白名单外属性（4.1） | 16 | `error: unknown attribute: bogus` | ✅ 一致 |
| 文件不可读 | 17 | `error: cannot read file: nope.svg` | ✅ 一致 |
| 文件不可写 | 18 | `error: cannot write file: nope/x.svg` | ✅ 一致 |
| IO 后 undo 禁止（4.3） | 19–20 | `error: undo not allowed after io command` | ✅ 一致 |
| 自动补 id 警告（第 2 节） | 21 | `warning: assigned id rect1 to unnamed <rect>` | ✅ 一致 |

**不适用项**：4.2 的 `cannot ungroup composite shape: n1` 针对 4.4 的插件类型 `box`，规范明确本阶段不要求实现，故不测。

**附带验证**：报错优先序（`move badid xx yy` 先报 `no such shape` 而非 `invalid number`）在第三次重构后已专项回放确认；`tsc --noEmit` strict 全量通过。

## 4. 测试发现的问题（已修复）

**`create ellipse` 参数个数错位（off-by-one）**——`ShapeFactory` 中 ellipse 的 Creator 写成 `need(a, 5, 6, …)` 且 fill 取 `a[5]`，而规范 4.1 是 `<cx> <cy> <rx> <ry> [fill]`（4–5 个参数，fill 在 `a[4]`）。后果：`create ellipse e1 1 2 3 4` 报 `invalid arguments`，带 fill 时颜色被静默丢弃。原 session 脚本从未用 CLI 创建过 ellipse（只经 `read` 读入，Loader 路径不受影响），因此前两轮测试未暴露；本轮按类型逐条 `create` 的最小测试当场抓到。已修复为 `need(a, 4, 5, …)` + `a[4]`，修复后 `cmds.txt` 第 7 行通过且 tree 中几何/样式正确。

## 5. 结论

- 20 条命令、14 个错误/警告场景全部符合 `phase_cli_1.md` 规范文案，**通过率 100%**；
- 测试过程发现 1 个真实 bug（ellipse 参数错位），已修复并复测通过；
- 类型检查 strict 模式通过。

## 6. 运行方式

```bash
cat test/cmds.txt | npm run cli   # 正常路径
cat test/errs.txt | npm run cli   # 错误路径
```
