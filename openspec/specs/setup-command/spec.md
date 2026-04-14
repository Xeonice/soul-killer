## ADDED Requirements

### Requirement: `/setup` 命令入口
系统 SHALL 将 `/setup` 注册为 `cmd.group.settings` 分组下的交互式命令，在 REPL 处于 `idle` 或 `command` 阶段时可用。调用后 MUST 把 `AppState.phase` 切换为 `setup`，并由 `app.tsx` 渲染 `<SetupWizard initialConfig={loadConfig() ?? undefined}>`。

#### Scenario: 已配置用户调用 /setup
- **WHEN** `~/.soulkiller/config.yaml` 存在且合法，用户在 idle 态输入 `/setup`
- **THEN** REPL 隐藏 TextInput，屏幕渲染 `SetupWizard` 的二次确认界面，`initialConfig` 对应当前磁盘配置

#### Scenario: 未配置用户调用 /setup
- **WHEN** `~/.soulkiller/config.yaml` 不存在，用户通过某种方式（如直接输入 `/setup`，或首次 boot 自动进入）触发
- **THEN** 系统按首次安装流程渲染，不显示二次确认步骤，与现有 `isConfigured()===false` 行为一致

#### Scenario: /setup 出现在补全列表中
- **WHEN** 用户输入 `/` 触发命令补全
- **THEN** 补全列表在 "Settings" / `cmd.group.settings` 分组下展示 `setup` 条目及其描述

### Requirement: 重跑向导的二次确认
系统 SHALL 在 `initialConfig` 非空时，在 `SetupWizard` 的第一个 step 渲染二次确认组件，默认不应直接进入覆盖流程。用户取消 MUST 触发 `onComplete` 以外的退出路径，使 `app.tsx` 把 phase 切回 `idle`。

#### Scenario: 用户确认继续
- **WHEN** 二次确认界面上用户确认（按组件的 "Yes" 路径）
- **THEN** `SetupWizard` 进入 `language` step，后续流程与首次安装一致但所有输入预填当前值

#### Scenario: 用户取消
- **WHEN** 二次确认界面上用户取消（按 Esc 或选 "No"）
- **THEN** `SetupWizard` 不调用 `onComplete`，`app.tsx` 把 `phase` 切回 `idle`，`config.yaml` 保持不变

### Requirement: 所有向导字段以当前配置预填
系统 SHALL 在 `initialConfig` 非空时，把 `SetupWizard` 每一个输入 step 的默认值设为 `initialConfig` 对应字段。`TextInput` 通过 `initialValue` prop 注入，`CheckboxSelect` 通过 `initialCursor` prop + `items[].checked` 同时注入。

#### Scenario: 语言 step 预填
- **WHEN** 用户通过二次确认后进入 `language` step
- **THEN** 光标初始定位到 `initialConfig.language` 对应选项，按 Enter 即保留该语言

#### Scenario: API key 输入框预填
- **WHEN** 用户进入 `intro`/`api_key` step
- **THEN** `TextInput` 预填 `initialConfig.llm.api_key`，以 mask 模式显示

#### Scenario: 模型选择预填
- **WHEN** 用户进入 `model_select` step
- **THEN** `CheckboxSelect` 勾选状态和光标都定位到 `initialConfig.llm.default_model` 对应行

#### Scenario: 搜索引擎预填
- **WHEN** 用户进入 `search_engine` step
- **THEN** 光标初始定位到 `initialConfig.search.provider` 对应的 SearXNG/Exa/Tavily 选项

#### Scenario: 搜索 key 预填
- **WHEN** 用户在 `search_engine` 选择 Exa 或 Tavily 并进入 `exa_key` / `tavily_key` step
- **THEN** `TextInput` 预填 `initialConfig.search.exa_api_key` 或 `initialConfig.search.tavily_api_key`（mask 模式）

### Requirement: API key 变更检测
系统 SHALL 在 `api_key` step 提交时比对新值与 `initialConfig.llm.api_key`；相同则跳过 `validateApiKey` 直接进入 `model_select`；不同则走完整校验流程（进入 `validating`，失败回到 `api_key` 并展示错误）。

#### Scenario: 保留原有 key
- **WHEN** 用户在预填的 `api_key` step 不修改输入直接 Enter
- **THEN** 系统不调用 `validateApiKey`，`SetupWizard` 直接进入 `model_select`，`balance` 状态保持未知

#### Scenario: 修改 key 且校验通过
- **WHEN** 用户修改 `api_key` 并 Enter，`validateApiKey` 返回 `{valid: true, balance}`
- **THEN** `SetupWizard` 展示余额并进入 `model_select`

#### Scenario: 修改 key 且校验失败
- **WHEN** 用户修改 `api_key` 并 Enter，`validateApiKey` 返回 `{valid: false, error}`
- **THEN** `SetupWizard` 回到 `api_key` step 展示错误，`config.yaml` 未被修改

### Requirement: 完成后热重载运行态
系统 SHALL 在 `/setup` 流程完成（`finishSetup` 调用 `saveConfig` 成功）后，除落盘新配置外，MUST 额外调用 `createLLMClient(config)` 刷新 LLM 客户端单例，并调用 `setLocale(config.language)` 刷新 i18n 语言。首次安装路径不受本要求影响（其已在 boot→idle 过渡中完成等价动作）。

#### Scenario: 通过 /setup 修改了模型
- **WHEN** 用户在 `/setup` 中把 `default_model` 从 A 换为 B，完成向导
- **THEN** 后续任何 LLM 调用使用模型 B，无需重启 REPL

#### Scenario: 通过 /setup 修改了语言
- **WHEN** 用户在 `/setup` 中把 `language` 从 `zh` 换为 `en`，完成向导
- **THEN** 退出向导后屏幕上的 i18n 文案立即变为英文，无需重启 REPL

### Requirement: TextInput 支持 initialValue
组件 `TextInput` SHALL 接受可选 `initialValue?: string` prop，在组件首次挂载时作为 `value` state 的初始值；未提供时保持当前行为（空字符串初始）。在 `mask` 模式下，预填值的显示同样受遮罩规则约束。

#### Scenario: 预填值可编辑
- **WHEN** 调用方传入 `initialValue="existing"`，用户挂载后按一次 Backspace
- **THEN** 当前输入变为 `existin`，提交时回调值为 `existin`

#### Scenario: 未传时保持空初值
- **WHEN** 调用方未传 `initialValue`
- **THEN** 组件行为与引入本 prop 前完全一致，现有调用点不受影响

### Requirement: CheckboxSelect 支持 initialCursor
组件 `CheckboxSelect` SHALL 接受可选 `initialCursor?: number` prop 控制首次挂载时的光标位置；越界值（负数或 ≥ items.length）MUST 被夹到合法范围；未提供时光标初始为 0。`items[].checked` 的预选语义保持独立、不受本 prop 影响。

#### Scenario: 高亮合法下标
- **WHEN** 调用方传入 `initialCursor=2` 且 `items.length > 2`
- **THEN** 组件挂载后第 3 项高亮

#### Scenario: 越界下标被夹
- **WHEN** 调用方传入 `initialCursor=-1` 或 `initialCursor=items.length`
- **THEN** 光标落在合法范围内（0 或 items.length-1），不抛异常
