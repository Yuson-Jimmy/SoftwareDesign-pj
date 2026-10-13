# 编译与运行

> **注意：先进入项目目录再执行**——`package.json` 在 `Phase1/` 下，在仓库根目录直接跑会报 `ENOENT: no such file ... package.json`。
>
> ```powershell
> cd Phase1
> ```

```bash
# 1. 安装依赖（首次）
npm install

# 2. 运行 CLI（REPL，提示符 svg>）
npm run cli

# 3. 类型检查（tsc strict，不产出文件）
npm run typecheck

# 4. 编译到 dist/（可选，运行不依赖此步）
npm run build

# 5. 回放测试脚本（验收用）
cat test/session1.txt | npm run cli
cat test/session2.txt | npm run cli
cat test/session3.txt | npm run cli
cat test/session4.txt | npm run cli
```

说明：

- 运行环境：Node.js（开发用 v24 验证），TypeScript 源码由 `tsx` 直接执行，无需先编译。
- `npm run cli` 即任务文档约定的入口；`#` 开头的行是注释，可把命令序列存成脚本用管道回放。
- 生成的 `*.svg` 文件可直接拖进浏览器预览效果。
