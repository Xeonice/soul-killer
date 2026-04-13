## MODIFIED Requirements

### Requirement: Phase 1 使用增量生成模式

SKILL.md 的 Phase 1 SHALL 使用 Plan → Scenes → Endings → Build → Self-check 五步模式替代单次 Write。

#### Scenario: 正常增量生成流程

- **WHEN** Phase 1 执行
- **THEN** SHALL 按顺序：1) 生成 plan 调用 `state script plan` 验证补全，2) 按 generation_order 逐场景生成调用 `state script scene` 验证，3) 场景全部就绪后逐结局生成调用 `state script ending` 验证，4) 调用 `state script build` 合并

#### Scenario: 场景生成读取正确 context

- **WHEN** 生成 scene-X（有 2 个 predecessors + 1 个 context_ref）
- **THEN** LLM SHALL 读取 plan.json + 2 个 predecessors 的 scenes/*.json + 1 个 context_ref 的 scenes/*.json

#### Scenario: 汇合场景路径无关

- **WHEN** 生成 is_convergence == true 的场景
- **THEN** 叙事文本 SHALL 不引用任何特定前驱路径的细节

#### Scenario: 结局基于实际场景内容

- **WHEN** 生成 ending body
- **THEN** LLM SHALL 读取 plan intent + character_arcs 中相关 key_scenes 的实际场景内容

#### Scenario: 验证失败重试

- **WHEN** `state script scene` 返回错误
- **THEN** LLM SHALL 读取错误信息，修复 draft，重试（最多 3 次）

### Requirement: Phase 2 每个场景 choices ≤ 2

Phase 1 plan 阶段和 Phase 2 AskUserQuestion 中，每个场景的剧本 choices SHALL 不超过 2 个。

#### Scenario: 2 choices + 2 系统选项

- **WHEN** 场景有 2 个 choices
- **THEN** AskUserQuestion options SHALL 为 [choice-1, choice-2, 📊 View branch tree, 💾 Save] 共 4 个

### Requirement: Phase 2 自动启动分支树可视化

Phase 2 进入后、首次渲染场景前，SHALL 自动调用 `state tree <script-id>` 启动可视化 server 并告知用户 URL。

#### Scenario: Phase 2 开始时启动 tree

- **WHEN** Phase 2 首次渲染场景前
- **THEN** SHALL 调用 `state tree` 并输出 `分支线可视化已就绪：http://localhost:<port>`
