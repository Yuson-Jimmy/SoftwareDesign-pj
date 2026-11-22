# PART_TWO 六部分人工验证清单

本文用于人工验收 `Phase2/PART_TWO`。以下命令默认在仓库的 `Phase2/PART_TWO` 目录执行，Shell 示例使用 Git Bash；交互命令中的 `svg>` 是程序提示符，不需要输入。

## 0. 准备与通用约定

```bash
npm install
npm run test:all
npm run build
mkdir -p .test-output
```

自动测试通过不能替代下面的人工检查。当前完整基线应为：**33 项测试通过，0 失败**。

启动方式：

```bash
# 方式 A：代码装配
node dist/cli/Repl.js

# 方式 B：配置装配
node dist/cli/Repl.js --config plugins.config.json
```

除非某个步骤明确要求保持同一会话，每个部分都重新启动一次 CLI，避免上一个文档和历史栈影响结果。`Ctrl+D` 可结束输入。

---

## 1. 插件式重构与 Phase 1 基线

### 1.1 默认能力仍可用

启动方式 A，逐行输入：

```text
init 800 600
create rect r 0 0 10 20 red
create circle c 100 100 20
create ellipse e 100 100 30 10
create line l 0 0 50 50 black
create text t 20 30 "hello"
create g group
tree
stats
```

通过标准：

- 六种图形均创建成功，没有 `unknown shape type`。
- `tree` 展示刚创建的节点；`stats` 能遍历文档。
- `init/create/move/scale/set/group/undo/redo/tree/show/save` 等 Phase 1 命令仍可使用。

### 1.2 不加载可选插件时，内核仍可启动

在 PART_TWO 目录执行：

```bash
node -e "const {createApplication}=require('./dist/app/Application'); const {Repl}=require('./dist/cli/Repl'); const r=new Repl(createApplication([])); console.log(r.handleLine('init')); console.log(r.handleLine('create rect r 0 0 1 1')); console.log(r.handleLine('stats'));"
```

通过标准：

- 第一行输出 `canvas 800x600 created`。
- rect 创建报 `error: unknown shape type: rect (is the plugin loaded?)`。
- stats 报 `error: unknown command: stats`。
- 进程没有崩溃。这说明图形和扩展命令不是内核硬编码的必备能力。

### 1.3 无树标签时输出保持 Phase 1 原样

```bash
node -e "const {createApplication}=require('./dist/app/Application'); const {Repl}=require('./dist/cli/Repl'); const {builtinShapePlugin}=require('./dist/plugins/builtin/BuiltinShapePlugin'); const r=new Repl(createApplication([builtinShapePlugin])); r.handleLine('init'); r.handleLine('create rect r 0 0 1 1'); console.log(r.handleLine('tree'));"
```

通过标准：输出严格为下面两行，没有 `*` 或其他标签。

```text
svg (800x600)
└── rect#r  x=0 y=0 w=1 h=1
```

---

## 2. box 图形插件

重新启动默认 CLI，逐行输入：

```text
init 800 600
create box n1 120 100 160 60 "开始"
tree n1
set n1 fill #f5a623
set n1 label "处理数据"
show n1-rect
show n1-label
undo
undo
show n1-rect
show n1-label
```

通过标准：

1. 创建回显为：

   ```text
   box#n1 created (g#n1 + rect#n1-rect + text#n1-label)
   ```

2. 树中包含 `g#n1 (box) *`、`rect#n1-rect` 和 `text#n1-label`。
3. `fill` 修改的是内部 rect，`label` 修改的是内部 text；两次 `show` 分别显示 `#f5a623` 和 `处理数据`。
4. 第一次 undo 只撤销 label，第二次只撤销 fill；最终标题恢复为 `开始`，填充恢复为 `#4a90d9`。

继续在同一 CLI 中验证整体操作和子部件保护：

```text
move n1 0 100
show n1-rect
delete n1-rect
ungroup n1
delete n1
tree
undo
tree n1
```

通过标准：

- 移动 box 后，内部 rect 的 `y` 从 100 变为 200，说明整体移动传播到了子部件。
- 删除必要子部件报 `error: cannot modify plugin-owned shape part: n1-rect`。
- `ungroup n1` 报 `error: cannot ungroup composite shape: n1`。
- 删除整个 box 后树中不再出现 n1；undo 后 box 和两个必要部件完整恢复。

保存并检查普通 SVG：

```text
save .test-output/manual-box.svg
```

打开 `.test-output/manual-box.svg`，应看到普通 `<g data-kind="box">` 内包含 rect/text，不依赖私有 XML 标签。

---

## 3. stats 命令插件

重新启动默认 CLI，输入：

```text
init
stats
create text t 0 0 "first"
create rect r1 0 0 1 1
create g group
create circle c 0 0 1 in group
create rect r2 0 0 1 1
create box b 0 0 10 10 "box"
stats
undo
stats
```

通过标准：

- 空文档输出 `(total 0, containers 0)`。
- 完整文档输出：

  ```text
  text: 2  rect: 3  circle: 1  (total 6, containers 2)
  ```

- 类型顺序是深度优先首次出现顺序，不是字典序。
- 普通 g 和 box 只计入 containers，box 内部 rect/text 仍作为叶子计数，根 SVG 不计数。
- undo 删除 box 后输出：

  ```text
  text: 1  rect: 2  circle: 1  (total 4, containers 1)
  ```

---

## 4. dir 命令与 Adapter

先准备内容固定的工作目录：

```bash
rm -rf .test-output/manual-dir
mkdir -p .test-output/manual-dir/alpha .test-output/manual-dir/zeta
printf 'a' > .test-output/manual-dir/a.txt
printf 'hidden' > .test-output/manual-dir/.hidden
cd .test-output/manual-dir
node ../../dist/cli/Repl.js
```

只输入：

```text
dir
```

通过标准：

```text
[DIR]  alpha
[DIR]  zeta
[FILE]  .hidden
[FILE]  a.txt
```

继续输入：

```text
dir extra
```

应报参数错误。随后可启动一个带 `stats` 的会话验证 `dir` 不需要文档，也不会清空 undo/redo 历史。

目录角色人工核对：

- `DirCommand` 只校验参数和格式化输出。
- `DirectoryPort` 是 Target 接口。
- `NodeDirectoryAdapter` 使用 Node `fs.readdirSync` 读取并排序。
- `dir` 读取进程当前工作目录，与 SVG 文件路径无关；目录在前、文件在后，各组按名称升序。

验证结束后返回 PART_TWO：

```bash
cd ../..
```

---

## 5. 树标签插件

### 5.1 modified-star 完整状态机

重新启动默认 CLI，逐行输入：

```text
init
create rect r 0 0 1 1
tree
save .test-output/manual-star.svg
tree
set r fill red
tree
undo
tree
redo
tree
```

通过标准：

1. 新建后 `svg (800x600) *` 和 `rect#r ... *` 都带星号。
2. 第一次 save 后，整棵树没有 `*`。
3. set 后星号重新出现。
4. undo 回到保存点后星号消失。
5. redo 后星号再次出现。

### 5.2 祖先传播和标签共存

继续输入：

```text
save .test-output/manual-star.svg
create g parent
create box child 10 10 100 50 "child" in parent
save .test-output/manual-star.svg
set child-label fill white
tree
undo
tree
```

通过标准：

- 修改内部子部件后，子部件、祖先 box、g 和 SVG 根行都带 `*`。
- undo 回到保存内容后，这些星号全部消失。
- box 行同时有 `(box)` 和 `*` 时，顺序固定为 `(box) *`。

标签状态只保存在各插件实例中，不应通过增加模块级 dirty 集合实现；具体取舍见 `docs/adr/003-tree-label-state-and-order.md`。

---

## 6. 同一插件的代码装配与配置装配

### 6.1 两组会话逐字节比较

先确保已构建：

```bash
npm run build
mkdir -p .test-output/manual-assembly
```

基础会话：

```bash
node dist/cli/Repl.js < docs/transcript/cli-1.txt > .test-output/manual-assembly/basic-a.log
node dist/cli/Repl.js --config plugins.config.json < docs/transcript/cli-1.txt > .test-output/manual-assembly/basic-b.log
cmp .test-output/manual-assembly/basic-a.log .test-output/manual-assembly/basic-b.log
```

box 会话：

```bash
node dist/cli/Repl.js < docs/transcript/box.txt > .test-output/manual-assembly/box-a.log
node dist/cli/Repl.js --config plugins.config.json < docs/transcript/box.txt > .test-output/manual-assembly/box-b.log
cmp .test-output/manual-assembly/box-a.log .test-output/manual-assembly/box-b.log
```

stats/dir 会话必须使用固定目录，且日志放在该目录之外：

```bash
cd .test-output/manual-dir
node ../../dist/cli/Repl.js < ../../docs/transcript/commands.txt > ../manual-assembly/commands-a.log
node ../../dist/cli/Repl.js --config ../../plugins.config.json < ../../docs/transcript/commands.txt > ../manual-assembly/commands-b.log
cmp ../manual-assembly/commands-a.log ../manual-assembly/commands-b.log
cd ../..
```

通过标准：三条 `cmp` 都没有输出且退出码为 0。还可将日志与 `docs/transcript/*.expected.txt` 对照；真实 CLI 日志含 banner 和提示符，因此主要判据是 A/B 两者完全相同。

### 6.2 配置项、options 和禁用语义

打开 `plugins.config.json`，确认：

- `plugins` 是数组，数组顺序与方式 A 的装配顺序一致。
- 每项使用字符串 `module`；相对路径以配置文件所在目录为基准。
- 可附加 `options` 对象，加载器原样传给 `activate(context, options)`。
- `enabled: false` 的模块完全跳过，不要求该模块存在。

加载器独立性人工检查：查看 `src/app/PluginCatalog.ts` 和 `src/app/ConfiguredApplication.ts`，不应出现对 box、stats、dir、modified-star 等具体插件的 import、名称映射或 switch。两种方式最终都必须调用 `Application.installPlugin`。

### 6.3 加载失败、回滚和继续启动

先运行过 `npm run test:all`，测试会生成现成故障插件及配置。然后执行：

```bash
node dist/cli/Repl.js --config .test-output/plugin-loading/failures.json
```

通过标准：程序打印相应错误但仍进入 REPL，不退出。应依次看到：

- `error: plugin not found: ./missing-plugin`
- `error: plugin has no default export: .../no-default`
- `error: plugin manifest mismatch: manifest-mismatch (...)`
- `error: plugin failed to activate: failing (boom)`
- `error: duplicate registration: shapes/rect`
- 依赖求值失败显示 `plugin failed to activate`，不能误报成顶层 `plugin not found`

在仍运行的 REPL 中输入：

```text
init
create rect r 0 0 1 1
tree
```

通过标准：

- 内置 rect 插件仍可用。
- 最后的 `later` 插件仍成功加载，因此 rect 行尾有 `later`。
- 失败插件暂存的 `leaked` 标签完全不出现，证明激活失败已回滚。
- duplicate/mismatch 不会破坏此前成功的插件。

非法配置回退检查：

```bash
node dist/cli/Repl.js --config .test-output/plugin-loading/invalid.json
```

应先输出 `error: invalid plugin config`，随后仍可进入默认 REPL；输入 `init` 和 `create box b 0 0 1 1 "ok"` 应成功，说明已回退到默认内置能力。

---

## 最终验收记录

人工验收完成时，建议记录：

| 部分 | 结果 | 证据 |
| --- | --- | --- |
| 1. 插件式重构与 Phase 1 基线 | □ | 默认会话、空插件会话、无标签树 |
| 2. box 图形插件 | □ | 属性/undo、整体操作、子部件保护、SVG |
| 3. stats | □ | 空文档、完整文档、undo 后计数 |
| 4. dir 与 Adapter | □ | 固定目录输出、参数错误 |
| 5. 树标签 | □ | 保存/编辑/undo/redo、祖先传播、标签顺序 |
| 6. 双装配 | □ | 三组 cmp、故障配置、非法配置回退 |

最后再次执行：

```bash
npm run test:all
git diff --check
```

两者均成功，且上述六部分人工现象全部符合，即可认为 PART_TWO 的六个部分完成。
