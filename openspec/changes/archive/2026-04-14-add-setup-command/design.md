## Context

`SetupWizard` 是首次启动引导的线性状态机（`language → intro/api_key → validating → model_select → search_engine → exa_key|tavily_key → done`），由 `src/cli/app.tsx:129-142` 在 `isConfigured()===false` 时触发一次。其后 `phase==='setup'` 永远不会再被设置，等效于一次性组件。

`/config` 是单字段菜单编辑器（`src/cli/commands/system/config.tsx`），适合微调，不适合"整链路重走"。两者并不冲突，定位不同。

`TextInput` 的 `value` 硬编码初始为 `''`（`text-input.tsx:56`），`CheckboxSelect` 虽支持 `checked` 但没有 `cursor` 初值——重跑向导要想回填，需要先给这两个组件开口子。

`Confirm` 组件已存在（`text-input.tsx:474`），可直接用于二次确认。

## Goals / Non-Goals

**Goals:**
- 已配置用户通过 `/setup` 能一次性回顾 + 重置所有向导覆盖的字段（语言、LLM key、默认模型、搜索引擎、搜索 key）。
- 重跑时所有输入以当前配置为默认值，Enter 即视为保留；覆盖成功后 LLM 客户端与 locale 立即生效，无需重启。
- 不改动首次安装路径和 `/config` 菜单任何行为。

**Non-Goals:**
- 不改写 `SetupWizard` 的状态机顺序，也不新增字段（`animation` 等仍归 `/config`）。
- 不做部分回滚 / 撤销（按下 Confirm 后即进入线性向导，想中途退出只能 `Ctrl+C`，与首次安装一致）。
- 不处理配置文件手动损坏场景（`loadConfig()` 返回 null 时沿用首次安装路径）。

## Decisions

### 决策 1：API key 变更检测 vs 强制校验

**选择**：只有当用户在 `api_key` 步骤提交的值 **与 `initialConfig.llm.api_key` 不同** 时，才进入 `validating` 调 `validateApiKey`；相同则直接 `setStep('model_select')`，沿用原 `balance` 显示为空或读缓存。

**理由**：
- 用户从 `/setup` 出发的典型意图是"换某个东西，其它保留"；若每次都强制 ~2s 网络校验，体验下降且无新信息。
- 改动的 key 仍走完整校验 → 防止输错密钥静默保存。
- 若将来要加"主动刷新余额"，单独在 `/config` 的 api_key 行增入口比插在向导中更合适。

**Alternatives considered**：
- 全量重校验：简单但慢；且首次向导已显式强调"validating"，重跑时重复该视觉反而噪音。
- 提供开关（"redo checks y/N"）：多一步交互，收益低。

### 决策 2：二次确认放在 Confirm step 还是 `/setup` 命令入口

**选择**：把 Confirm 作为 `SetupWizard` 的 **第一个 step**（仅在 `initialConfig` 存在时插入），不是命令入口处独立渲染。

**理由**：
- 单组件内管理状态机更连贯；`app.tsx` 只管 `phase='setup'` 切换，不关心确认逻辑。
- Esc 取消时 `onComplete` 不触发，`app.tsx` 负责把 `phase` 切回 `idle`（与 `/config` 的 `onClose` 同模式）。
- 首次安装路径无 `initialConfig`，自然跳过这个 step，零分叉。

**Alternatives considered**：
- 在 `setup.tsx` 命令处理器里先渲染 `<Confirm>` 再切 phase：两层组件状态切换，app 状态机要多一个中间态，复杂度不值。

### 决策 3：`TextInput` 的 `initialValue` 语义

**选择**：新增可选 `initialValue?: string`，仅在组件挂载时作为 `useState` 初值，不支持运行时响应 prop 变化。`mask` 模式下预填值也受遮罩显示。

**理由**：
- `SetupWizard` 在 step 切换时重新挂载对应 `<TextInput>`，无需响应 prop 变化。
- 保持组件简单；如果将来真要响应变化，再加 `useEffect`。

**Alternatives considered**：
- 受控模式（外部传 `value` + `onChange`）：改动面大，现有调用点都要改。否决。

### 决策 4：`CheckboxSelect` 的初值 prop 命名

**选择**：新增 `initialCursor?: number`，默认 0；`items[i].checked` 的语义（预选）保持不变。

**理由**：模型场景里"默认勾选的就是高亮的"，但语义上二者独立——有些场景需要高亮在未选项上。分开两个 prop 语义更正交。

### 决策 5：`onComplete` 热重载

**选择**：`app.tsx` 的 `handleSetupComplete`（从 `/setup` 回流）在 `saveConfig` 之后必须显式调用：
1. `createLLMClient(config)` — 刷新 LLM 客户端单例（api_key / model 可能已换）。
2. `setLocale(config.language)` — 刷新 i18n 当前语言。

**理由**：首次安装路径走 `handleBootComplete` 会在 boot→idle 的过渡中自然调这两个函数；`/setup` 重入时 app 已在 idle 态，不会重跑那段逻辑，必须手工补。

## Risks / Trade-offs

- **[用户输错新 key 导致配置被覆盖]** → Mitigation：key 变更时仍走 `validateApiKey`，校验失败回到 `api_key` step（复用现有 `error` 态）；不触达 `finishSetup`。
- **[Confirm step 被误按 Enter 进入向导]** → Mitigation：`<Confirm>` 默认选项设为 "No"（需确认组件接口支持，若不支持则在 warning 行显式提示）。
- **[SearXNG 路径依赖 `isDockerAvailable()` 实时检测]** → Mitigation：与首次安装一致，进入 `search_engine` step 时重新检测；若用户把 Docker 关了就会看到 warning，与当前行为等价。
- **[`/config` 与 `/setup` 定位混淆]** → Mitigation：`/help` 文案、`cmd.setup` 描述里明确定位差异（"重跑完整向导" vs "单项微调"）；`cmd.group.settings` 下两条并列。
- **[向导中途 Ctrl+C 导致 config.yaml 未保存]** → Mitigation：`finishSetup` 仍是原子 `saveConfig`，中途退出旧配置保持完整；与首次安装一致，无需额外处理。

## Migration Plan

无数据/配置迁移；纯新增入口。发布后旧配置直接兼容，不需要任何用户操作。

## Open Questions

1. `/setup` 是否该在 `/help` 里标一个 "restart onboarding" tag？（体验问题，实现上无影响，先不做。）
2. `Confirm` 组件是否支持默认选项设为 "No"？实现阶段先读 `text-input.tsx:474` 对应实现，不支持则加一个 `defaultYes?: boolean` prop 或者改为仅 Enter 继续、Esc 取消的显式两键模式。
