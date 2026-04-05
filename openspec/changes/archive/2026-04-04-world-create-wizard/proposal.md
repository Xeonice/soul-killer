## Why

当前世界创建流程只有 display_name 和 description 两个文本输入，创建完是一个空目录，没有引导用户建立世界骨架。相比 Soul 创建流程的 14 步状态机（类型选择、AI 搜索、数据导入、蒸馏、审查），World 创建体验过于单薄。需要一个完整的创建向导，让用户在创建时就能选择数据来源（手动/蒸馏/URL）并建立世界的核心内容。

## What Changes

- **替换** `WorldCreateCommand` 为完整的 `WorldCreateWizard`，包含多步状态机
- 新增「创建方式选择」步骤：手动创建、从数据蒸馏、从 URL 抓取、空白世界
- **手动创建分支**：引导式收集核心条目（背景/规则/氛围），自动分配 mode/scope 元数据，可选循环添加知识条目
- **蒸馏分支**：选择 markdown 数据源路径 → 蒸馏 → 审查，整合进创建流程
- **URL 抓取分支**：复用现有 page extractor + soul capture agent 的搜索逻辑，输入 URL → 抓取 → 蒸馏 → 审查
- 新增名称冲突处理：覆盖/重命名（与 Soul 创建一致）
- 新增创建完成前的确认摘要
- 修改 `world.tsx` 菜单：「创建」直接进入 Wizard，不再由菜单收集 name
- 移除蒸馏分支对 twitter adapter 的支持（世界蒸馏仅支持 markdown + URL）

## Capabilities

### New Capabilities
- `world-create-wizard`: 完整的世界创建向导——多步状态机、4 种创建方式分支、引导式条目收集、名称冲突处理、确认摘要

### Modified Capabilities
- `world-commands`: `/world` 菜单的「创建」选项改为直接进入 Wizard，移除菜单层的 name 收集逻辑

## Impact

- **替换** `src/cli/commands/world-create.tsx`（完全重写为 Wizard）
- **修改** `src/cli/commands/world.tsx`（创建分支简化为直接渲染 Wizard）
- **复用** `src/ingest/pipeline.ts`（markdown adapter）、page extractor、WorldDistiller、WorldDistillReview
- **新增** i18n key（向导步骤提示文案，zh/en/ja）
- **更新** 组件测试（world-list.test.tsx 中涉及创建的部分）
