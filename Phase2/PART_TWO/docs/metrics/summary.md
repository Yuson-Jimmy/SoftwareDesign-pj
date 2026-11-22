# CLI 与 VSCode 历史指标

> 本文件由 `scripts/metrics.js` 从 Git 历史生成，请勿手填数字。

- 基线：`final` → `f7498d11eeee7f968acc7cd94941c567adbdaedf`
- 目标：`p2` → `9c600f84506fbe47c97b772ebb94997b30b6bb46`
- 生成命令：`node scripts/metrics.js --from final --to p2`

## CLI 三类范围

| 类别 | final 文件 | p2/目标文件 | final 行数 | p2/目标行数 | 行数增量 | final 复杂度 | p2/目标复杂度 | 复杂度增量 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| kernel | 36 | 42 | 2170 | 2519 | +349 | 306 | 349 | +43 |
| assembly | 0 | 4 | 0 | 299 | +299 | 0 | 76 | +76 |
| plugins | 0 | 11 | 0 | 461 | +461 | 0 | 49 | +49 |

分类规则：final 的 `Phase1/src` 全部归入 kernel；目标的 `src/app` 为 assembly，`src/plugins` 为 plugins，其余运行源码为 kernel。CLI 测试不计入三类增量。

## VSCode 独立指标（不混入上述增量）

| 范围 | 文件 | 行数 | 复杂度 |
| --- | ---: | ---: | ---: |
| 扩展运行源码 | 4 | 274 | 61 |
| 扩展测试源码 | 5 | 260 | 15 |

## 口径与文件清单

- 行数：Git blob 的物理行数，保留空行与注释，保证可重复。
- 圈复杂度：文件级 `1 + TypeScript AST 决策点`；决策点包括 if、for、while、do、case、catch、条件表达式及 `&&`/`||`/`??`。这是统一口径的静态近似，不声称等同于某一商业工具。
- 排除依赖、构建产物和 CLI 测试；VSCode 扩展及测试单列。
- 逐文件行数、复杂度、SHA-256 与职责见 `files.tsv`；机器可读完整数据见 `metrics.json`。
