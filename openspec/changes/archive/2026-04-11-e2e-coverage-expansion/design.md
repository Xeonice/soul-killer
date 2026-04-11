## Context

现有 E2E harness（TestTerminal + MockLLMServer + fixtures）已稳定。新测试遵循相同模式：`send()` 发 slash 命令，`sendLine()` 发数据输入，`sendKeyAfter()` 处理 wizard 步骤，`waitFor` 语义等待。

## Goals / Non-Goals

**Goals:**
- 覆盖 `/world` create 向导的交互 UI 步骤
- 覆盖 batch create 的多 soul 输入和 batch 启动
- 覆盖 `/pack` + `/unpack` 的端到端数据完整性
- 覆盖 arg completion（`/use <Tab>`）交互

**Non-Goals:**
- 不测试需要真实 LLM 的 capture/distill 流程（agent 流程由 MockLLMServer 覆盖，已有 Scenario 5/11）
- 不测试 world distill/review 步骤（需要复杂的 mock 编排）
- 不测试 unpack 冲突解决（需要预制冲突 pack 文件，复杂度高收益低）

## Decisions

### D1: /world 测试范围限于 UI 向导步骤

测试 create 向导到 data-sources 选择为止（type-select → name → display-name → description → confirm）。data-sources 后的 capture/distill 需要 LLM，不在 scope 内。验证 world 目录和 manifest 文件被创建。

由于 `/world create` 在选择数据源后需要 LLM capture，测试在 data-sources 步骤选择"不选任何数据源直接跳过"或用 Esc 退出。需要确认实际 UI 是否支持空数据源跳过——如果不支持，测试到 confirm 步骤即可。

### D2: batch create 测试聚焦 soul-list 循环

验证：输入 2 个 soul → soul-list 显示两个 → 选 Continue → 到达 data-sources。不验证 batch-capturing 的并行执行（需要 MockLLMServer 编排多轮 agent 调用，已有 Scenario 11 覆盖单 soul distill）。

### D3: pack/unpack 测试用预制的 distilled soul

用 `createDistilledSoul` fixture 创建 soul → `/pack soul <name>` → 验证 .soulkiller-pack 文件存在 → 删除原 soul → `/unpack <path>` → 验证 soul 恢复。无冲突路径。

### D4: arg completion 用 sendKey 逐键输入

输入 `/use `（带空格） → waitFor palette 显示 → 验证 soul 名称出现。不用 Tab 补全（Tab 已有 Scenario 8 覆盖），只验证 arg palette 渲染。
