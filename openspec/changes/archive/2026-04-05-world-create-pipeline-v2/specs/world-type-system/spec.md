## ADDED Requirements

### Requirement: WorldType 用户选择
系统 SHALL 定义 `WorldType` 类型，包含三个值：`'fictional-existing'`（已有作品的虚构世界）、`'fictional-original'`（原创虚构世界）、`'real'`（真实世界设定）。

#### Scenario: WorldType 可用值
- **WHEN** 导入 `WorldType` 类型
- **THEN** 可用值为 `'fictional-existing' | 'fictional-original' | 'real'`

### Requirement: WorldClassification Agent 分类
系统 SHALL 定义 `WorldClassification` 类型，包含三个值：`'FICTIONAL_UNIVERSE'`（识别为已知虚构世界）、`'REAL_SETTING'`（识别为真实世界设定）、`'UNKNOWN_SETTING'`（搜索无结果）。

#### Scenario: WorldClassification 可用值
- **WHEN** 导入 `WorldClassification` 类型
- **THEN** 可用值为 `'FICTIONAL_UNIVERSE' | 'REAL_SETTING' | 'UNKNOWN_SETTING'`

### Requirement: WorldType 驱动流程分支
系统 SHALL 根据用户选择的 WorldType 决定创建流程分支：`fictional-existing` 和 `real` SHALL 进入 AI Agent 搜索流程；`fictional-original` SHALL 跳过 AI 搜索，直接进入数据源选择。

#### Scenario: fictional-existing 触发 AI 搜索
- **WHEN** 用户选择 WorldType 为 `fictional-existing`
- **THEN** 流程进入 AI Agent 搜索阶段

#### Scenario: fictional-original 跳过 AI 搜索
- **WHEN** 用户选择 WorldType 为 `fictional-original`
- **THEN** 流程跳过 AI 搜索，直接进入数据源选择步骤

#### Scenario: real 触发 AI 搜索
- **WHEN** 用户选择 WorldType 为 `real`
- **THEN** 流程进入 AI Agent 搜索阶段

### Requirement: UNKNOWN_SETTING 处理逻辑
当 AI Agent 搜索返回 UNKNOWN_SETTING 时，系统 SHALL 根据原始 WorldType 提供不同的引导：`fictional-existing` SHALL 提示"是否切换为原创模式"；`real` SHALL 提示"是否换关键词重试"。

#### Scenario: fictional-existing 搜索失败的引导
- **WHEN** 用户选择 `fictional-existing` 且 Agent 返回 `UNKNOWN_SETTING`
- **THEN** 系统提示用户选择：切换为原创模式 或 换关键词重试

#### Scenario: real 搜索失败的引导
- **WHEN** 用户选择 `real` 且 Agent 返回 `UNKNOWN_SETTING`
- **THEN** 系统提示用户选择：换关键词重试 或 手动输入数据源
