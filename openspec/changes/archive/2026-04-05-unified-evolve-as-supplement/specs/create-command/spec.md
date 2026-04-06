## ADDED Requirements

### Requirement: supplementSoul prop 外部补充模式入口
CreateCommand SHALL 接受可选的 `supplementSoul?: { name: string; dir: string }` prop。当提供时，SHALL 加载已有 Soul 的 manifest（soulType/tags/description），初始步骤直接跳到 `data-sources`，跳过 type-select/name/description/tags/confirm/name-conflict。

#### Scenario: 通过 prop 进入补充模式
- **WHEN** 渲染 `<CreateCommand supplementSoul={{ name: 'alice', dir: '/path/to/alice' }} />`
- **THEN** 加载 alice 的 manifest，直接显示数据源选择步骤

### Requirement: 补充模式蒸馏增加 merge 逻辑
CreateCommand 在补充模式下，蒸馏完成后 SHALL 执行 merge 步骤：创建 snapshot → 提取 delta features → 与现有 soul files 合并 → 写入合并结果 → 记录 evolve history。

#### Scenario: 补充模式 merge 已有 Soul
- **WHEN** 补充模式蒸馏完成
- **THEN** 创建快照，提取新 features，与已有 identity.md/style.md/behaviors 合并，写入合并结果

#### Scenario: 补充模式记录进化历史
- **WHEN** 补充模式 merge 完成
- **THEN** manifest.evolve_history 追加一条记录
