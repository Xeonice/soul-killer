## 1. 提取共用基础设施

- [x] 1.1 提取 stream-loop 辅助函数 `runAgentLoop`（封装 watchdog + 熔断器 + stream event 处理 + 日志），供 3 个子 agent 复用
- [x] 1.2 提取 `finalizeAndPackage` 函数（从 finalize_export tool 的 execute 逻辑中提取为独立函数）

## 2. Story Setup Agent

- [x] 2.1 编写 `STORY_SETUP_PROMPT`（精简版，只包含 story-level 指引 §1-3.5）
- [x] 2.2 编写 `buildStorySetupPrompt`（plan + world + 所有角色 style.md，不含 identity/milestones/behaviors）
- [x] 2.3 实现 `runStorySetup` 函数（ToolLoopAgent，工具集 = metadata + state + prose + ask_user，step cap 8）

## 3. Character Loop

- [x] 3.1 编写 `CHARACTER_LOOP_PROMPT`（精简版，只包含角色注册 + 轴设置指引 §4-5）
- [x] 3.2 编写 `buildCharacterPrompt`（plan 中该角色方向 + 该角色完整 soul data + shared_axes 名称）
- [x] 3.3 实现 `runCharacterLoop` 函数（遍历 plan.characters，每角色独立 ToolLoopAgent，step cap 5）

## 4. 重构 runExportAgent

- [x] 4.1 重构 Execution 阶段为 runStorySetup → runCharacterLoop → finalizeAndPackage 三阶段
- [x] 4.2 删除原有的单循环 Execution Agent 代码（大 tools 对象 + 大 stream loop）
- [x] 4.3 确保 builder 实例在三阶段间共享

## 5. 测试

- [x] 5.1 验证编译通过 + 现有 892 测试全过
- [ ] 5.2 端到端测试：实际导出验证三阶段流程
