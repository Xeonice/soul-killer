## Why

当前 Soul Capture Agent 使用 `generateText` 一次性调用——所有 tool calls 在内部完成，UI 无法实时看到搜索过程。用户输入名字后只看到 "initiating soul capture..." 然后直接跳到结果（或 UNKNOWN_ENTITY），没有中间过程的动画展示。

此外，"强尼银手" 这样的知名角色被判定为 UNKNOWN_ENTITY，说明 agent 的 tool call 可能没有正确执行，或搜索结果解析失败。

## What Changes

- 将 agent 从单次 `generateText` 改为 **manual agent loop**（循环调用 streamText + 手动执行 tool）
- 每次 tool call 实时通知 UI：哪个工具被调用、查询了什么、返回了多少结果
- Soulkiller Protocol Panel 实时展示每个 tool call 的进度
- 修复 UNKNOWN_ENTITY 误判：确保搜索工具正确执行并返回结果
- Agent 的分类逻辑从"解析最终 JSON"改为"每步实时分析"

## Capabilities

### Modified Capabilities

- `soul-capture-agent`: 从 generateText 单次调用改为 manual agent loop，每步 tool call 实时回调
- `soulkiller-protocol-panel`: 实时显示 tool call 进度（搜索查询、结果数量、当前步骤）

## Impact

- **修改文件**: `src/agent/soul-capture-agent.ts`（核心重构）、`src/cli/animation/soulkiller-protocol-panel.tsx`（实时进度）、`src/cli/commands/create.tsx`（对接新进度回调）
- **无新增文件**
