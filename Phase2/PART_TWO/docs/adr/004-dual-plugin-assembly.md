# ADR-004：代码装配与配置装配共用事务注册路径

## 状态

已接受。

## 背景

同一插件需要既能由组合根显式装入，也能仅通过 `plugins.config.json` 动态装入。两种方式必须行为一致，并支持清单校验、同类查重和失败回滚；加载器不得认识具体插件。

## 决策

### 1. 只有一个安装路径

`Application.installPlugin` 委托 `PluginRegistrar`。方式 A 在 `createDefaultApplication` 中显式导入并实例化插件；方式 B 的 `ConfiguredApplication` 通过通用 `PluginCatalog` 解析模块。两者最终都进入同一个 `installPlugin`，没有第二条直接写注册表的旁路。

### 2. 暂存后一次提交

`PluginContext` 只暴露四类注册方法。安装器暂存本插件的全部扩展，检查已有注册和本插件内部重名，再比较 `package.json#contributes` 与实际注册的类别及名称集合。任一检查失败均不提交；成功后才写入真实注册表，因此没有半安装状态。

属性处理器使用稳定的 `name`，缺省名为 `<shapeType>.<attribute>`。清单类别固定为 `shapes`、`commands`、`decorators`、`attributes`，缺省数组视为空。

### 3. 动态加载属于装配层

`PluginCatalog` 只按配置字符串调用运行环境的 `require.resolve/require`，没有具体插件 import、名称映射或 switch。相对路径以配置文件目录为基准，包名遵循 Node 模块解析规则。模块求值或依赖失败与顶层模块找不到分开处理。

配置数组决定加载顺序；`enabled: false` 完全跳过。`options` 对象原样作为 `activate(context, options)` 的第二个参数传入。配置语法或结构非法时报告 `error: invalid plugin config` 并回退到默认内置能力。

### 4. 默认导出与包清单

可配置插件包使用 CommonJS 编译后的默认导出。每个包目录的 `package.json` 声明 `main` 和 `contributes`。当前仓库内插件的 `main` 指向对应 `dist` 文件，因此配置 CLI 入口先构建再启动；测试同样先构建。

### 5. 用 transcript 证明行为一致

`docs/transcript` 将输入命令与预期输出分开保存。同一输入分别经方式 A/B 执行并逐字节比较，覆盖基础会话、box 会话及 stats/dir；dir 使用固定工作目录，输出文件不写入该目录。

## 后果

- 方式 A 新增插件只需新增插件包并修改 `Application.ts` 组合根，然后重新构建。
- 方式 B 新增插件只需安装/新增插件包并修改 `plugins.config.json`，无需修改既有运行源码。
- 加载错误逐条报告并继续后续插件，主程序保持可用。
