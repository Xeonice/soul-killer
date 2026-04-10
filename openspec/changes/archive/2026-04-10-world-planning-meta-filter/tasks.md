## 1. Planning Agent Prompt 改造

- [x] 1.1 在 `buildPlanningPrompt()` 中增加 `## Search Target: In-World Information ONLY` 段落（仅当 type === 'world' 时插入）
- [x] 1.2 增加 classification 条件分支段落：FICTIONAL_UNIVERSE（宽松）/ REAL_SETTING（严格限定词）/ UNKNOWN_SETTING（走严格路径）
- [x] 1.3 在 qualityCriteria 示例/指导中增加 meta 排斥条目的要求

## 2. World Dimension Templates 更新

- [x] 2.1 为 `WORLD_DIMENSION_TEMPLATES` 中每个维度的 `qualityCriteria` 追加一条 meta 排斥默认条目
- [x] 2.2 确认 `qualityCriteria` 会被传递到 quality scoring 阶段（追踪现有流程确认）

## 3. 测试验证

- [x] 3.1 编写单元测试：当 type='world' 时 prompt 包含 meta 排斥指令
- [x] 3.2 编写单元测试：当 type='soul' 时 prompt 不包含 meta 排斥指令
- [x] 3.3 编写单元测试：classification='REAL_SETTING' 时 prompt 包含限定词策略
- [x] 3.4 编写单元测试：classification='FICTIONAL_UNIVERSE' 时 prompt 不包含限定词策略
- [x] 3.5 运行全部测试 `bun run test` 确认通过
