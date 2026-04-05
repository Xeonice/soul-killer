## Why

`/create` 流程中（agent capture、ingest、distill）发生错误后，error 页面显示"按 Esc 返回 REPL"，但 `useInput` 中完全没有 `step === 'error'` 的处理分支，导致 Esc 键无效、用户被卡死在错误页面。同时也没有"重试"入口，用户只能 Ctrl+C 杀进程后重新启动，丢失已输入的所有配置。

## What Changes

- 在 `useInput` 中为 `step === 'error'` 添加键盘处理
- 将 error UI 从纯文本提示改为双选菜单（重试 / 返回 REPL）
- 重试时保留用户输入（name/type/description/hint），重置 agent 状态后重新触发流程

## Capabilities

### New Capabilities

### Modified Capabilities
- `config-command`: 无需改动（误列，删除）

## Impact

- **修改文件**: `src/cli/commands/create.tsx`（useInput error 分支 + error UI 组件）、`src/i18n/locales/{zh,en,ja}.json`（重试/返回文案）
