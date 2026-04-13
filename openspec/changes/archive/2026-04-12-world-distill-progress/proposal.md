## Why

World distill 的 history 维度使用三步流程（Pass A/B/C），其中 Pass B 逐个展开时间线事件，每个事件一次 LLM 调用（~50s），总共可能 15-25 个事件。在这 10-20 分钟内，UI 只显示 `▸ history ⠋` spinner 一动不动，agent log 也没有任何中间输出，用户以为进程卡死了。

## What Changes

- **distill.ts Pass B 内部**：每完成一个事件 → emit progress（携带 per-event 子进度）+ agentLog 写入一行
- **WorldDistillProgress 类型**：新增 `historySubProgress?` 可选字段
- **world-distill-panel.tsx**：检测 `historySubProgress`，渲染 Pass A/B/C 子阶段 + Pass B 的 event 级进度

## Capabilities

### New Capabilities

（无新增 capability）

### Modified Capabilities

- `world-distill`: history 三步流程增加 per-event 进度输出

## Impact

- **修改文件**：`src/world/distill.ts`（Pass B 内加 emit + log）、`src/world/distill.ts` 或类型定义（WorldDistillProgress 扩展）、`src/cli/components/world-distill-panel.tsx`（子进度渲染）
- **不影响**：非 history 维度、distill 结果、文件输出格式
