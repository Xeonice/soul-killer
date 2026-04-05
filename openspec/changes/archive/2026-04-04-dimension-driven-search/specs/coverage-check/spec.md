## ADDED Requirements

### Requirement: checkCoverage tool
Agent SHALL 提供 `checkCoverage` tool，LLM 在采集阶段中可随时调用。tool 的 execute 函数 SHALL 使用纯系统逻辑（关键词模式匹配）分析已收集的 extractions，返回各维度的覆盖报告。

#### Scenario: 检查覆盖度
- **WHEN** LLM 调用 checkCoverage，传入已收集的 extractions 数组
- **THEN** 返回 6 个维度的 count 和 covered 状态
- **AND** 返回 totalCovered、requiredCovered、canReport、suggestion

#### Scenario: 建议继续搜索
- **WHEN** canReport 为 false
- **THEN** suggestion 中 SHALL 列出缺失的维度名称和中文描述
- **AND** 建议搜索的方向

#### Scenario: 允许报告
- **WHEN** totalCovered ≥ 3 且 requiredCovered ≥ 2
- **THEN** canReport SHALL 为 true
- **AND** suggestion 中可以提示仍缺失的非必需维度但不阻止 report

### Requirement: checkCoverage 不使用 LLM
checkCoverage 的 execute 函数 SHALL 使用正则表达式模式匹配来判断维度覆盖，不依赖 LLM 调用。每个维度 SHALL 有预定义的中英文关键词模式。

#### Scenario: 台词维度匹配
- **WHEN** 某条 extraction 内容包含直接引用（引号包裹的长文本）或 "台词"/"quote"/"said" 等关键词
- **THEN** 该 extraction 命中 quotes 维度

#### Scenario: 多维度命中
- **WHEN** 某条 extraction 内容同时包含身份描述和性格分析
- **THEN** 该 extraction 同时命中 identity 和 behavior 维度
