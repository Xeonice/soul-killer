## MODIFIED Requirements

### Requirement: Step cap 保证充足步数

Capture agent 的 maxSteps SHALL 保证普通角色至少 30 步。

#### Scenario: 7 维度的 step cap

- **WHEN** dimCount 为 7
- **THEN** maxSteps SHALL 为 max(30, min(7*3+8, 80)) = 30

#### Scenario: 3 维度的 step cap

- **WHEN** dimCount 为 3
- **THEN** maxSteps SHALL 为 max(30, min(3*3+8, 80)) = 30

#### Scenario: 12 维度的 step cap

- **WHEN** dimCount 为 12
- **THEN** maxSteps SHALL 为 max(30, min(12*3+8, 80)) = 44

### Requirement: prepareStep 引导 reportFindings

当模型不支持 toolChoice:'required' 时，prepareStep SHALL 在接近 step cap 时通过 prompt 引导模型调用 reportFindings。

#### Scenario: 接近 step cap 时追加引导消息

- **WHEN** stepNumber >= maxSteps - 3
- **AND** 模型不支持 toolChoice:'required'
- **THEN** prepareStep SHALL 返回追加的 system 消息引导调用 reportFindings
