# Phase2 PART_TWO：CLI 插件式重构

完整交付与验收：

- [扩展点、装配格式与 ADR](docs/README.md)
- [验收矩阵与证据](docs/acceptance.md)
- [Phase 1 → Phase 2 迭代报告](docs/iteration-report.md)
- [历史指标](docs/metrics/summary.md)
- [人工验收清单](docs/todo.md)

```bash
npm install
npm run build
npm run cli
```

默认提供 Phase1 的全部命令与六种图形，并加入 `box`、`stats`、`dir`、`modified-star` 和 `(box)` 树标签。扩展点清单、依赖约束及后续插件接入方式见 [docs/README.md](docs/README.md)。
