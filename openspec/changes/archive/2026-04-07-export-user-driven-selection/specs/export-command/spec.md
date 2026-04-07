## ADDED Requirements

### Requirement: User-driven selection 流程
export 命令 SHALL 在用户发起 /export 后，依次通过 UI 让用户多选 souls、单选 world，然后再进入 agent 创意工作。

#### Scenario: 完整流程
- **WHEN** 用户触发 /export
- **THEN** SHALL 依次展示：
  1. 多选 UI: 所有可用 souls（空格切换，Enter 确认）
  2. 单选 UI: 所有可用 worlds（上下移动，Enter 确认）
  3. 数据读取阶段: 读取所选 souls 和 world 的完整文件
  4. Agent 运行阶段: 创意分析 + 打包
- **AND** 每一步完成后自动进入下一步

#### Scenario: 多选 souls
- **WHEN** 进入 selecting-souls 步骤
- **THEN** SHALL 列出所有已 distill 的 souls
- **AND** 使用 multi_select 模式
- **AND** 用户可通过空格切换选中状态
- **AND** Enter 确认后 SHALL 存储选中列表

#### Scenario: 单选 world
- **WHEN** 进入 selecting-world 步骤
- **THEN** SHALL 列出所有可用 worlds
- **AND** 使用 single select 模式
- **AND** Enter 确认后 SHALL 存储选中的 world name

#### Scenario: 0 个 souls 或 0 个 worlds
- **WHEN** 扫描后发现 souls 或 worlds 列表为空
- **THEN** SHALL 显示友好错误信息，建议用户先 /create 或 /world create
- **AND** 不进入 agent 阶段

#### Scenario: 选中 0 个 souls
- **WHEN** 用户在多选 souls 时未选择任何角色直接 Enter
- **THEN** SHALL 提示至少需要选择 1 个 soul
- **AND** 保持在 selecting-souls 步骤

### Requirement: 代码层数据预读
在进入 agent 阶段之前，export 命令 SHALL 通过代码直接读取所有选中数据。

#### Scenario: 读取 soul 完整数据
- **WHEN** 进入 loading-data 步骤
- **THEN** 对每个选中的 soul SHALL 调用 `readManifest` + `readSoulFiles` 读取完整数据
- **AND** SHALL 组装为 `{ name, manifest, identity, style, capabilities, milestones, behaviors[] }` 结构

#### Scenario: 读取 world 完整数据
- **WHEN** 进入 loading-data 步骤
- **THEN** 对选中的 world SHALL 调用 `loadWorld` + `loadAllEntries` 读取完整数据
- **AND** SHALL 组装为 `{ name, manifest, entries[] }` 结构

#### Scenario: 数据读取失败
- **WHEN** 任何 soul 或 world 的文件读取失败
- **THEN** SHALL 显示错误信息并返回上一个选择步骤

### Requirement: Esc 返回上一步
用户在任意选择步骤按 Esc SHALL 返回上一步或取消整个流程。

#### Scenario: selecting-souls 按 Esc
- **WHEN** 在 selecting-souls 步骤按 Esc
- **THEN** SHALL 取消整个 export 流程

#### Scenario: selecting-world 按 Esc
- **WHEN** 在 selecting-world 步骤按 Esc
- **THEN** SHALL 返回 selecting-souls 步骤

## REMOVED Requirements

### Requirement: Export agent 全自动多 Soul 流程
**Reason**: 该需求定义 agent 自动扫描并选择角色组合。实测证明 user-driven selection 更符合用户预期，agent 的选择职责完全移除。

**Migration**: Selection 逻辑从 agent 移至 CLI，agent 只接收预选数据做创意工作。参见新的「Export agent 职责收紧为创意工作」和「User-driven selection 流程」。
