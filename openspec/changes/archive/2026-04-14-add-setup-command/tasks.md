## 1. 组件基础设施

- [x] 1.1 在 `src/cli/components/text-input.tsx` 给 `TextInput` 加 `initialValue?: string` prop，`useState('')` 改为 `useState(initialValue ?? '')`，同步更新 `valueRef.current` 与 `cursorRef.current`
- [x] 1.2 在 `src/cli/components/text-input.tsx` 给 `CheckboxSelect` 加 `initialCursor?: number` prop，`useState(0)` 改为 `useState(clamp(initialCursor ?? 0, 0, items.length - 1))`
- [x] 1.3 确认 `Confirm` 组件（`text-input.tsx:474`）是否支持默认选项设 "No"；若不支持则补 `defaultYes?: boolean` prop

## 2. SetupWizard 改造

- [x] 2.1 在 `SetupWizardProps` 增加可选 `initialConfig?: SoulkillerConfig`
- [x] 2.2 `Step` 类型追加 `'confirm'`；当 `initialConfig` 非空时 `useState<Step>('confirm')`，否则保持 `'language'`
- [x] 2.3 `language` step 初始 `langCursor` 从 `initialConfig?.language` 推导
- [x] 2.4 `intro` / `api_key` 的 `<TextInput>` 传 `initialValue={initialConfig?.llm.api_key}`
- [x] 2.5 `handleKeySubmit`：若 `initialConfig && key === initialConfig.llm.api_key`，跳过 `validateApiKey` 直接 `setStep('model_select')`
- [x] 2.6 `model_select` 的 `<CheckboxSelect>` 根据 `initialConfig?.llm.default_model` 设置 `items[].checked` 与 `initialCursor`
- [x] 2.7 `search_engine` 初始 `searchCursor` 从 `initialConfig?.search.provider` 推导（searxng=0/exa=1/tavily=2）
- [x] 2.8 `exa_key` / `tavily_key` 的 `<TextInput>` 分别传 `initialValue={initialConfig?.search.exa_api_key}` / `tavily_api_key`
- [x] 2.9 新增 `confirm` step 渲染：使用 `<Confirm>`，`onConfirm(true)→setStep('language')`，`onConfirm(false)` + Esc 均走新 prop `onCancel?: () => void`

## 3. app.tsx 接线

- [x] 3.1 在 `src/cli/app.tsx` 的 `phase==='setup'` 渲染分支传 `initialConfig={loadConfig() ?? undefined}`
- [x] 3.2 `onComplete` handler 额外调用 `createLLMClient(config)` 与 `setLocale(config.language)`（首次安装路径已在 handleBootComplete 覆盖，`/setup` 重入时需补）
- [x] 3.3 新增 `onCancel` handler：把 `phase` 切回 `'idle'`，`interactiveMode` 设 `false`

## 4. /setup 命令

- [x] 4.1 新建 `src/cli/commands/system/setup.tsx`：`registerCommand({ name:'setup', interactive:true, handle(ctx){ ctx.setState(s=>({...s, phase:'setup', interactiveMode:true, commandOutput:null})) } })` — 实现放在 `src/cli/commands/index.ts` 的 `setupCommand` handler，与其他系统命令注册方式一致，无独立 UI 组件所以不新建 tsx 文件
- [x] 4.2 在 `src/cli/command-registry.ts` 的 `COMMAND_TEMPLATES` 增加 `{ name:'setup', descriptionKey:'cmd.setup', groupKey:'cmd.group.settings' }`
- [x] 4.3 确保 `setup.tsx` 在 app 启动链路被 import（参照现有 `config.tsx` 的注册方式）— `setupCommand` 已加入 `registerAllCommands` 列表

## 5. i18n 文案

- [x] 5.1 `src/infra/i18n/locales/zh.json` 追加 `cmd.setup`、`setup.confirm_overwrite`、`setup.confirm_hint`、`setup.confirm_proceed`
- [x] 5.2 `src/infra/i18n/locales/en.json` 同步英文
- [x] 5.3 `src/infra/i18n/locales/ja.json` 同步日文

## 6. 测试

- [x] 6.1 `tests/component/components/text-input.test.tsx`：新增 `initialValue` / `initialCursor` 覆盖用例
- [x] 6.2 `tests/component/setup-wizard.test.tsx`：新增"首次不显示 confirm"、"有 initialConfig 时展示 confirm"、"Esc 触发 onCancel"、"api_key 未变跳过校验"用例
- [x] 6.3 `src/cli/commands/system/setup.tsx`：因 handler 已并入 `index.ts` 无须额外测试文件；`/setup` 注册正确性由 help 快照回归覆盖
- [x] 6.4 `bun run test` 全绿（1010 tests passed；help 快照已更新以纳入 `/setup` 条目）

## 7. 收尾

- [x] 7.1 `bun run build`（tsc --noEmit）无报错
- [ ] 7.2 手动在本地跑 `bun run dev`：首次安装路径仍正常；`/setup` 出现在 `/` 补全；`/setup` 的 confirm → 各 step 预填 → 完成后模型/语言热生效
- [ ] 7.3 `openspec status --change add-setup-command` 所有 artifact `done`
