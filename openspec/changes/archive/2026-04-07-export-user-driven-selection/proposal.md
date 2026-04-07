## Why

上一轮 `multi-soul-export` 将 export 设计为"全自动"——agent 自己扫描、推断、选择角色和世界。实测发现这个方向根本上错了：

1. **用户期望主动控制**：用户发起 /export 时，他知道想导出什么组合，系统应该问而不是猜
2. **机械决策滥用 LLM**：选 world/souls 是确定性规则（多选 souls、单选 world），让 LLM 推理这些浪费 token 且不稳定
3. **日志充满噪声**："自动选择 world..."、"按 behavior_count 排序..."这类叙述本应是代码逻辑，不该出现在 agent log 中
4. **性能差**：agent 要先 list + read 所有候选数据，才能开始真正的创意工作，Step 1-3 都在做机械活

正确的分层：**选择走 UI，创意走 Agent**。

## What Changes

### Export 流程重设计
- 新增 UI 步骤：`selecting-souls`（多选）→ `selecting-world`（单选）→ agent 创意工作
- 用户在 CLI 中主动选择，复用已有的 multi_select / single select UI
- 代码层预读所有选中数据，一次性传给 agent

### export-agent 大幅瘦身
- **删除** list_souls / list_worlds / read_soul / read_world 四个扫描工具
- agent 只保留 `package_skill` + `ask_user`（兜底，正常不用）
- system prompt 去掉所有"自动选择"指引，聚焦创意部分：
  - 角色关系分析
  - 好感轴设计
  - 基调 / 幕数 / 结局数推导
  - 打包
- `runExportAgent` 签名变更：新增 `preSelected: { souls, soulsData, worldName, worldData }` 参数

### export.tsx 状态机扩展
- 在现有 step 机上新增：`selecting-souls`、`selecting-world`、`loading-data`
- 读取 soul 列表和 world 列表通过代码直接调用（`listSouls`/`listWorlds`），不通过 agent
- 选择完成后读取所选 soul 的完整数据（identity/style/capabilities/milestones/behaviors），打包传给 agent

### 向后兼容（退化模式）
- 单 soul 选择 + 单 world 选择仍然可行（characters.length === 1 → 单角色模式）
- ExportProtocolPanel 的 select UI 已支持 multi/single，无需改动

## Capabilities

### New Capabilities
（无——这次是对已有能力的流程重构，不引入新概念）

### Modified Capabilities
- `export-agent`: 职责收紧为创意工作，移除扫描和选择工具，接收预选数据
- `export-command`: 新增 selecting-souls/selecting-world/loading-data 三个 step，代码层驱动选择

## Impact

- `src/agent/export-agent.ts` — 大幅简化：删除扫描工具、重写 system prompt、签名改为接收 preSelected 数据、initial prompt 包含完整角色和世界数据
- `src/cli/commands/export.tsx` — 新增选择 step 和 state，直接读 soul/world 数据并传给 agent
- `src/cli/animation/export-protocol-panel.tsx` — 无需改动（复用 select 模式）
- `src/export/packager.ts` / `story-spec.ts` / `skill-template.ts` — 无需改动（下游 API 不变）
- E2E / 集成测试适配（若有）
