# world-capture-agent Specification

## Purpose
定义 World Capture Agent 的行为规范，用于搜索和提取世界设定信息。
## Requirements
### Requirement: World Capture 策略
系统 SHALL 提供 `WorldCaptureStrategy`，实现 `CaptureStrategy` 接口，用于 World 搜索。策略 SHALL 包含 World 专用的系统提示词，引导 Agent 按 9 个维度搜索世界设定信息。

#### Scenario: World 策略的系统提示词
- **WHEN** 获取 WorldCaptureStrategy 的 systemPrompt
- **THEN** 提示词包含 9 个 World 维度（geography/history/factions/systems/society/culture/species/figures/atmosphere）的描述和搜索指引

### Requirement: World Agent 搜索工作流
World capture agent SHALL 遵循与 Soul 相同的工作流结构：Phase 1 侦察（2 步广泛搜索）→ Phase 2 规划（调用 planSearch 获取搜索计划）→ Phase 3 收集（按维度搜索）→ checkCoverage → reportFindings。

#### Scenario: World Agent 搜索流程
- **WHEN** 以 "Night City" 为目标启动 World capture
- **THEN** Agent 先进行 2 步侦察搜索，然后调用 planSearch 获取 9 维度搜索计划，再按计划逐维度搜索，最终 reportFindings

### Requirement: World reportFindings 维度标注
World capture agent 的 reportFindings tool SHALL 接受维度参数为 `WorldDimension`（9 个值），而非 SoulDimension（6 个值）。每个 extraction SHALL 标注所属 WorldDimension。

#### Scenario: extraction 使用 WorldDimension 标注
- **WHEN** Agent 调用 reportFindings
- **THEN** 每个 extraction 的 dimension 字段为 WorldDimension 类型（geography/history/factions/systems/society/culture/species/figures/atmosphere）

### Requirement: World Coverage 规则
World capture agent SHALL 使用 `analyzeWorldCoverage()` 进行覆盖率分析。canReport 条件为：至少 4 个维度覆盖，其中至少 2 个 required（geography/history/factions）。

#### Scenario: 满足 coverage 提前 report
- **WHEN** Agent 覆盖了 geography、history、factions、systems、culture 五个维度
- **THEN** checkCoverage 返回 canReport=true

### Requirement: World Agent 最大步数
World capture agent 的 MAX_STEPS SHALL 设为 35（Soul 为 30），因为 World 有 9 个维度（比 Soul 的 6 个多 50%）。

#### Scenario: 达到最大步数强制 report
- **WHEN** Agent 执行到第 34 步（MAX_STEPS - 1）
- **THEN** 强制 toolChoice 为 reportFindings

### Requirement: World 分类标签
World capture agent SHALL 使用 WorldClassification（FICTIONAL_UNIVERSE/REAL_SETTING/UNKNOWN_SETTING）而非 Soul 的 TargetClassification。

#### Scenario: 虚构世界被分类为 FICTIONAL_UNIVERSE
- **WHEN** Agent 搜索 "Night City" 并在 planSearch 中识别为虚构世界设定
- **THEN** classification 为 FICTIONAL_UNIVERSE

### Requirement: captureWorld 函数签名
系统 SHALL 提供 `captureWorld(name: string, config: SoulkillerConfig, onProgress?: OnProgress, hint?: string): Promise<CaptureResult>` 函数。其内部 SHALL 使用通用 capture agent + WorldCaptureStrategy。

#### Scenario: captureWorld 返回 CaptureResult
- **WHEN** 调用 `captureWorld('Night City', config)`
- **THEN** 返回 CaptureResult，包含 classification（WorldClassification）、chunks（SoulChunk[]）、elapsedMs

### Requirement: World system prompt 改为质量筛选模式
WORLD_SYSTEM_PROMPT SHALL 与 Soul 使用相同的质量筛选工作流，不做深度阅读和提取。

#### Scenario: prompt 工作流
- **WHEN** 构建 system prompt
- **THEN** SHALL 指示 Agent 逐维度评估 → 对照 qualityCriteria → 补充搜索 → reportFindings
- **AND** SHALL 注入每个维度的 qualityCriteria 和 minArticles

### Requirement: World system prompt 重写为质量评估模式
WORLD_SYSTEM_PROMPT SHALL 从搜索指令改为质量评估指令，与 Soul 保持一致的模式。

#### Scenario: prompt 内容
- **WHEN** 构建 world capture agent 的 system prompt
- **THEN** SHALL 指示 Agent 逐维度调用 evaluateDimension 审查搜索结果
- **AND** SHALL 指示 Agent 在数据不足时用 supplementSearch 补充
- **AND** SHALL 指示 Agent 审查完所有维度后调用 reportFindings
- **AND** SHALL 不包含任何搜索策略指令

### Requirement: World system prompt 增加深度阅读工作流
WORLD_SYSTEM_PROMPT SHALL 与 Soul 使用相同的深度阅读工作流指令。

#### Scenario: prompt 工作流指令
- **WHEN** 构建 system prompt
- **THEN** SHALL 指示 Agent 对每个维度执行 evaluate → read → extract 循环
- **AND** 最后调 reportFindings 汇总

