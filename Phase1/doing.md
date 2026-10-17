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
cat test/cmds.txt | npm run cli   # 正常路径：20 条命令全覆盖
cat test/errs.txt | npm run cli   # 错误路径：4.2 错误表 + 4.3 + set 白名单 + 自动补 id 警告
```

测试报告见 `test/test.md`（覆盖矩阵、规范文案逐条比对、发现的 bug 记录）；`test/fix.svg` 是 `errs.txt` 所需的含无 id 元素的 fixture。

说明：

- 运行环境：Node.js（开发用 v24 验证），TypeScript 源码由 `tsx` 直接执行，无需先编译。
- `npm run cli` 即任务文档约定的入口；`#` 开头的行是注释，可把命令序列存成脚本用管道回放。
- 生成的 `*.svg` 文件可直接拖进浏览器预览效果。
