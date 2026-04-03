## Why

创建流程存在三个用户体验问题：(1) 同名灵魂无检测，静默覆盖导致数据丢失；(2) Agent 搜索过程对用户是黑盒，无法确认搜到的是否正确目标；(3) 蒸馏阶段只显示"蒸馏中..."，用户不知道进度。用户需要在关键决策点有控制权，并在全程看到发生了什么。

## What Changes

- 新增重名检测节点：创建灵魂前检测 `~/.soulkiller/souls/<name>/` 是否存在，存在时提供覆盖重建 / 追加数据重新蒸馏 / 换名三个选项
- 新增搜索结果确认节点：Agent 搜索完成后展示结果摘要（分类、来源、片段数），默认选中"确认"，用户可选查看详情或重新搜索
- 蒸馏进度细化：extractor 内部 emit 阶段事件（身份提取、风格提取、行为提取、合并去重、生成文件），UI 实时展示每个子阶段进度
- "追加数据重新蒸馏"模式：读取已有灵魂的数据，与新输入合并后重新走蒸馏流程

## Capabilities

### New Capabilities
- `soul-name-conflict`: 灵魂重名检测与冲突解决（覆盖 / 追加 / 换名）
- `search-result-confirm`: Agent 搜索结果确认节点（摘要展示、确认/重搜/查看详情）
- `distill-progress`: 蒸馏过程细粒度进度事件与 UI 展示

### Modified Capabilities
- `lightweight-intake`: 在信息汇总确认后、进入搜索/数据源步骤前插入重名检测节点
- `soul-capture-agent`: Agent 搜索完成后新增结果确认步骤，而非直接进入数据源选择
- `soul-distill`: extractor 需要 emit 阶段进度事件（identity/style/behavior/merge/generate）

## Impact

- `src/cli/commands/create.tsx` — 状态机新增 `name-conflict`、`search-confirm` 步骤，蒸馏阶段接收细粒度进度
- `src/distill/extractor.ts` — 新增 `onProgress` 回调参数，在各阶段 emit 事件
- `src/cli/animation/soulkiller-protocol-panel.tsx` — 展示搜索结果摘要确认 UI
- `src/soul/package.ts` — 读取已有灵魂数据用于追加模式
- 新增 `src/cli/components/distill-progress.tsx` — 蒸馏进度展示组件
