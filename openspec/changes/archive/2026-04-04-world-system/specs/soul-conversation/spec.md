## MODIFIED Requirements

### Requirement: 对话 system prompt 通过 Context Assembler 构建
对话流程 SHALL 将 system prompt 构建从直接拼接 soul files 改为通过 `ContextAssembler` 统一组装。ContextAssembler 接收 soul files、已绑定的 world 列表、对话历史和用户输入，返回完整的 system prompt。

#### Scenario: 有世界绑定的对话
- **WHEN** soul "johnny" 绑定了 "night-city"，用户发送消息
- **THEN** ContextAssembler 加载世界条目、执行触发匹配、模板渲染，组装完整 system prompt 后传给 LLM

#### Scenario: 无世界绑定的对话（向后兼容）
- **WHEN** soul "johnny" 没有绑定任何世界，用户发送消息
- **THEN** ContextAssembler 输出与原有 buildSystemPrompt 行为一致
