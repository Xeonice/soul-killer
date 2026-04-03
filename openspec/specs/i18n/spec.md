### Requirement: Full i18n coverage for all user-visible strings
The i18n system SHALL provide translations for ALL user-visible strings in the application. No hardcoded Chinese, Japanese, or English text SHALL appear outside of locale JSON files.

#### Scenario: CLI command output in English
- **WHEN** the user's language is set to `en`
- **THEN** all command output, error messages, prompts, and status text SHALL be in English
- **AND** no Chinese or Japanese characters appear in the output (except soul names and user data)

#### Scenario: CLI command output in Japanese
- **WHEN** the user's language is set to `ja`
- **THEN** all command output SHALL be in Japanese

#### Scenario: LLM prompts match configured language
- **WHEN** the user's language is set to `en`
- **THEN** LLM system prompts (distillation, tag parsing, merging) SHALL be in English
- **AND** the prompts SHALL be natively written (not machine-translated) to maintain quality

#### Scenario: Missing translation key falls back to key name
- **WHEN** a translation key has no entry in the current locale
- **THEN** the system SHALL display the key name as fallback (existing behavior preserved)

### Requirement: Locale JSON structure supports multiline prompt templates
The locale JSON files SHALL support long multiline strings for LLM prompt templates using `\n` escapes.

#### Scenario: Prompt template in locale file
- **WHEN** a distillation prompt is stored as a locale key
- **THEN** the value SHALL contain the complete prompt text with `\n` for line breaks
- **AND** the `t()` function SHALL return the prompt with newlines preserved

### Requirement: Translation function
系统 SHALL 提供 `t(key: string, params?: Record<string, string>)` 函数，根据当前语言设置返回对应的翻译文本。

#### Scenario: Get translation for current locale
- **WHEN** 当前语言为 `ja`，调用 `t('config.saved')`
- **THEN** 返回日文翻译文本

#### Scenario: Translation with interpolation
- **WHEN** 调用 `t('config.set.success', { key: 'language', value: 'en' })`
- **THEN** 返回包含实际 key 和 value 的翻译文本

#### Scenario: Missing translation key
- **WHEN** 调用 `t('nonexistent.key')`
- **THEN** 返回 key 本身作为 fallback

### Requirement: Locale files
系统 SHALL 在 `src/i18n/locales/` 目录下维护 `zh.json`、`ja.json`、`en.json` 三个翻译文件，覆盖以下类别的文本：
- 命令描述（command group 名称、各命令描述）
- 配置相关提示（设置成功、错误消息、配置项标签）
- 系统消息（启动、退出、错误提示）

#### Scenario: All locales have consistent keys
- **WHEN** 检查三个语言文件
- **THEN** 每个文件 MUST 包含相同的 key 集合，不允许某个语言缺少 key

### Requirement: Locale initialization
系统 SHALL 在启动时从 `SoulkillerConfig.language` 读取语言设置，并初始化 i18n 模块。

#### Scenario: Initialize with configured language
- **WHEN** config.yaml 中 language 为 `en`，系统启动
- **THEN** i18n 模块以英文作为当前语言，所有 `t()` 调用返回英文文本

#### Scenario: Initialize with default language
- **WHEN** config.yaml 中未设置 language 字段
- **THEN** i18n 模块以 `zh`（中文）作为默认语言
