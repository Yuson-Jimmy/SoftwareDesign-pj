# SVG File Badge and Outline

Phase2 PART_ONE：VSCode SVG 文件标记与原生大纲扩展。

## 快速启动

```bash
npm install
npm run compile
```

在 VSCode 中打开本目录，按 **F5** 运行 `Run SVG Extension`。扩展开发宿主会自动打开 `fixtures/`：

- `example.svg` 在 Explorer 中显示 `[]`；
- `plain.txt` 和名为 `directory.svg` 的目录不显示标记；
- 用文本编辑器打开 `example.svg`，在原生 **Outline** 中查看嵌套元素并点击定位。

## 验证

```bash
npm run test:unit
npm run test:integration
```

如本机已经安装 VSCode，可设置 `VSCODE_EXECUTABLE_PATH` 指向 `Code.exe`，避免测试工具下载 VSCode。

完整的安装说明、真实运行截图、设计模式分析、Phase1 复用评估及测试覆盖见 [docs/README.md](docs/README.md)。
