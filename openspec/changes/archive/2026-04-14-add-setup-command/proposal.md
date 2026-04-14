## Why

当前 `SetupWizard` 仅在 `isConfigured() === false` 时（首次启动）渲染一次，之后再无入口；想重跑向导只能手动删除 `~/.soulkiller/config.yaml`。对换机器、换 OpenRouter 账号、引导新同事排查链路（LLM + 搜索引擎 + 语言一把梳一遍）的场景而言，这道门槛过高。`/config` 是单字段编辑菜单，不适合"整链路回顾"。

## What Changes

- 新增 `/setup` 命令：已配置状态下重新进入完整 `SetupWizard` 流程，所有步骤用当前 `config.yaml` 的值预填。
- `SetupWizard` 新增 `initialConfig?` prop；无则走首次安装路径（当前行为），有则：
  - 流程最前面插入一个 `confirm` 步骤，`<Confirm>` 询问"已有配置，继续会覆盖"，Esc 取消回到 idle。
  - `language` 初始光标定位到当前语言。
  - `api_key` 输入框预填当前 key；提交时若值未变则跳过 `validateApiKey` 直接进 `model_select`，值有变更仍走完整校验刷新余额。
  - `model_select` 勾选 + 光标预置到当前 model。
  - `search_engine` 光标定位到当前 provider。
  - `exa_key` / `tavily_key` 输入框预填已存在的 key。
- `TextInput` 补充 `initialValue?: string` prop。
- `CheckboxSelect` 补充 `initialCursor?: number` prop。
- `app.tsx` 的 `phase==='setup'` 分支：统一传 `initialConfig={loadConfig() ?? undefined}`；`onComplete` 在保存配置之后追加 `createLLMClient(config)` + `setLocale(config.language)`（从 `/setup` 重入时 app 已在运行，必须重新注入）。

## Capabilities

### New Capabilities
- `setup-command`: `/setup` 命令的行为契约，包括二次确认、预填、key 变更检测、完成后热重载 LLM/locale。

### Modified Capabilities
- `config-command`: 无（`/config` 行为不变）。

## Impact

- 代码：
  - `src/cli/components/text-input.tsx`（`TextInput` + `CheckboxSelect` 两个 prop 扩展）
  - `src/config/setup-wizard.tsx`（新 `confirm` step + 初值回填 + 条件校验）
  - `src/cli/app.tsx`（传 `initialConfig`，`onComplete` 热重载）
  - `src/cli/commands/system/setup.tsx`（新文件，`registerCommand`）
  - `src/cli/command-registry.ts`（`COMMAND_TEMPLATES` 新增 `setup`）
  - `src/infra/i18n/locales/{zh,en,ja}.json`（`cmd.setup` + `setup.confirm_overwrite` 三语文案）
- 测试：
  - `tests/unit/config/setup-wizard.test.tsx`（预填、确认、跳过校验路径）
  - `tests/unit/cli/commands/system/setup.test.tsx`（命令注册、phase 切换）
- 依赖：无新增 npm 依赖。
- 破坏性：无。`SetupWizard` 的新 prop 全部可选；首次安装路径不变。
