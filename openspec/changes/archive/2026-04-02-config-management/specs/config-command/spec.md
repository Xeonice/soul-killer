## ADDED Requirements

### Requirement: View current configuration
系统 SHALL 在用户输入 `/config` 时显示当前所有配置项及其值，以表格形式呈现。

#### Scenario: Display all config items
- **WHEN** 用户输入 `/config`
- **THEN** 系统以表格形式显示以下配置项：model（当前模型）、api_key（脱敏显示，仅展示前4位和后4位）、language（当前语言）、animation（是否启用动画）

### Requirement: Set configuration via command
系统 SHALL 支持 `/config set <key> <value>` 语法直接修改配置项，并立即持久化到 `~/.soulkiller/config.yaml`。

#### Scenario: Set language
- **WHEN** 用户输入 `/config set language en`
- **THEN** 系统将 language 设置为 `en`，写入配置文件，并显示确认消息

#### Scenario: Set animation toggle
- **WHEN** 用户输入 `/config set animation false`
- **THEN** 系统将 animation 设置为 `false`，写入配置文件，并显示确认消息

#### Scenario: Set model
- **WHEN** 用户输入 `/config set model deepseek/deepseek-chat`
- **THEN** 系统将 default_model 设置为 `deepseek/deepseek-chat`，写入配置文件，并显示确认消息

#### Scenario: Invalid key
- **WHEN** 用户输入 `/config set unknown_key value`
- **THEN** 系统显示错误消息，列出所有可用的 key

#### Scenario: Invalid language value
- **WHEN** 用户输入 `/config set language fr`
- **THEN** 系统显示错误消息，提示支持的语言列表（zh, ja, en）

### Requirement: Reset configuration
系统 SHALL 支持 `/config reset` 将所有配置恢复为默认值，执行前 MUST 要求用户确认。

#### Scenario: Reset with confirmation
- **WHEN** 用户输入 `/config reset` 并确认
- **THEN** 系统将所有配置恢复为默认值（language: zh, animation: true, model: google/gemini-2.5-flash），写入配置文件

#### Scenario: Reset cancelled
- **WHEN** 用户输入 `/config reset` 并取消
- **THEN** 系统不做任何修改，显示取消消息

### Requirement: Config schema extension
`SoulkillerConfig` 接口 SHALL 包含 `language` 字段（类型 `'zh' | 'ja' | 'en'`，默认 `'zh'`）和 `animation` 字段（类型 `boolean`，默认 `true`）。

#### Scenario: Load legacy config without new fields
- **WHEN** 加载的 config.yaml 不包含 language 或 animation 字段
- **THEN** 系统自动填充默认值 `language: 'zh'`、`animation: true`

### Requirement: Animation toggle effect
当配置 `animation` 为 `false` 时，系统 SHALL 跳过所有 cyberpunk 动画效果（BootAnimation、GlitchText 字符替换、HeartbeatLine、RelicLoadAnimation），直接显示最终内容或跳过渲染。

#### Scenario: Boot with animation disabled
- **WHEN** 配置 `animation: false` 且应用启动
- **THEN** 跳过 BootAnimation，直接进入 idle 状态

#### Scenario: GlitchText with animation disabled
- **WHEN** 配置 `animation: false` 且显示 GlitchText 组件
- **THEN** 直接渲染纯文本，不执行字符替换动画
