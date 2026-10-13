___禁止修改本文档___
# 架构方案
## 1 模块划分
__src__/<br>
├── __cli__/                  表现层：和用户打交道<br>
│$~~~~~~~$├── Repl.ts           主循环：读行、跳过注释、打印结果<br>
│$~~~~~~~$├── Parser.ts         命令行解析（双引号参数、# 注释）<br>
│$~~~~~~~$└── Messages.ts       输出格式（error: 前缀、成功回显文案）<br>
│<br>
├── __commands__/             命令层：每个用户命令 = 一个 Command 类<br>
│$~~~~~~~~~~~~~$├── Command.ts        接口：execute() / undo()<br>
│$~~~~~~~~~~~~~$├── MacroCommand.ts   组合命令（group 等复合操作）<br>
│$~~~~~~~~~~~~~$├── CommandRegistry.ts 命令名 → 命令工厂（允许的名字分派）<br>
│$~~~~~~~~~~~~~$├── document/         InitCommand ReadCommand SaveCommand CanvasCommand<br>
│$~~~~~~~~~~~~~$├── editing/          CreateCommand DeleteCommand MoveCommand<br>
│$~~~~~~~~~~~~~$│                     ScaleCommand SetCommand GroupCommand<br>
│$~~~~~~~~~~~~~$│                     UngroupCommand AddtoCommand FrontBackCommand<br>
│$~~~~~~~~~~~~~$└── display/          TreeCommand ShowCommand HelpCommand<br>
│<br>
├── __editor__/               应用层：编辑会话的"状态机"<br>
│$~~~~~~~~~~$├── Editor.ts         持有当前文档 + undo/redo 双栈、io 后禁用规则<br>
│$~~~~~~~~~~$└── （无其他类，刻意保持薄）<br>
│<br>
├── __model__/                领域层：图形世界本身，不知道任何外界存在<br>
│$~~~~~~~~~~$├── Shape.ts          抽象基类（id、parent、move/scale/set/toSVG）<br>
│$~~~~~~~~~~$├── shapes/           Rect Circle Ellipse Line Text（一类一文件）<br>
│$~~~~~~~~~~$├── Group.ts          容器（Composite）<br>
│$~~~~~~~~~~$├── Document.ts       画布尺寸 + 根节点 + id 注册表<br>
│$~~~~~~~~~~$└── ShapeFactory.ts   类型名 → 类（允许的名字分派）<br>
│<br>
└── __io__/                   持久化层：SVG 文本 ⇄ 对象树<br>
$~~~~~~~~$├── SvgReader.ts      解析 XML、自动补 id（收集警告而非直接打印）<br>
$~~~~~~~~$└── SvgWriter.ts      序列化、写文件<br>

## 2 设计模式选择
command模式
## 3 依赖方向规则
'cli ──→ commands ──→ editor ──→ model<br>
$~~~~~~~~~~~~~~~~~~~~$│$~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~$↑<br>
$~~~~~~~~~~~~~~~~~~~~$└────→ io ─────────┘'<br>
| 模块          | 允许依赖                                     | 禁止依赖                | 理由                 |
| ----------- | ---------------------------------------- | ------------------- | ------------------ |
| `model/`    | 无（零依赖）                                   | 一切外层                | 领域最稳定，谁也不能污染它      |
| `io/`       | `model/`                                 | commands、editor、cli | 读写只懂图形和文件，不懂会话     |
| `editor/`   | `model/`                                 | cli、io 的细节类         | 会话编排不碰具体交互与格式      |
| `commands/` | `editor/`、`model/`、`io/`（仅经 Editor 调用读写） | `cli/`              | 命令产生**结果对象**，不自己打印 |
| `cli/`      | `commands/`、`editor/`                    | 直接 new 图形类          | 表现层不越过命令层碰模型       |

## 4 变化点假设
| 变化理由        | 例子                           | 对应模块             |
| ----------- | ---------------------------- | ---------------- |
| 交互方式变了      | 将来从 CLI 换成 GUI 或 AI agent 通道 | `cli/`（表现层）      |
| 命令集变了       | 新增命令、调整语法                    | `commands/`（命令层） |
| 图形种类/领域规则变了 | 新增图形类型、改 set 白名单             | `model/`（领域层）    |
| 存储格式变了      | SVG 解析细节、将来支持其他格式            | `io/`（持久化层）      |
中间再加一个 editor/ 把它们串起来。于是得到五层。

# 过程记录
使用的AGENT为kimi K3<dr>
1.首先与K3交流，得到模块划分的建议<dr>
2.之后将修改后phase1_cli_1.md和README.md文件喂给agent，最后生成一份名为readme.md文件供我参考，为自主撰写README.md做准备。<dr>
___发现Agent生成的readme.md文档中“伪造”了与AI对话的过程记录！！！___<dr>
3.询问AI关于Node.js的用法吗。<dr>



# 一致性自查
## 1.模块划分
## 2.依赖方向
# 质量保证手段
