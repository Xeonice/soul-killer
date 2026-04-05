## Why

当前创建流程中，数据源选择被分散在不同位置：public soul 直接进入联网搜索（无选择），搜索完成后才能可选补充 Markdown/Twitter；personal soul 跳过搜索直接进入 data-sources 选择。这导致用户无法在统一入口决定数据来源组合，且本地数据源（Markdown/Twitter）作为"补充"被埋在后面，容易被忽略。

## What Changes

- 将数据源选择提前到 confirm 之后，作为统一入口
- public soul：显示 ☑联网搜索（默认开启）+ ☐Markdown + ☐Twitter Archive
- personal soul：显示 ☐Markdown + ☐Twitter Archive（无联网搜索选项）
- 按选中顺序依次执行：联网搜索 → search-confirm → 本地数据源 ingesting → 合并 → distill
- 什么都不选时直接跳到 distilling（只用 synthetic chunks）
- 移除 `proceedAfterConflictCheck` 中的 public/personal 分叉，统一走数据源选择

## Capabilities

### New Capabilities

### Modified Capabilities
- `create-command`: 创建流程状态机重构 — confirm 后统一进入 data-sources，data-sources UI 根据 soulType 显示不同选项，选中后按顺序执行

## Impact

- **修改文件**: `src/cli/commands/create.tsx`（状态机重构 + data-sources UI 改造 + 执行顺序编排）、`src/i18n/locales/{zh,en,ja}.json`（联网搜索选项文案）
