## ADDED Requirements

### Requirement: 导出向导的 "catalog info" 步骤（agent 后置）

REPL `/export` 命令的向导 SHALL 在 agent 完成所有工具调用、`finalize.ts` 即将调用 `packageSkill()` 之前，新增一个 `entering-catalog-info` 阶段：通过新的桥接事件 `catalog_confirm_request` 由 finalize 触发，依次展示三个输入框（slug / 世界 / 说明），每个输入框都预填 LLM 在 `set_story_metadata` 阶段写入 builder 的候选值。作者 SHALL 可以 Enter 接受默认，或编辑后 Enter 提交。空值不允许提交。

#### Scenario: 三字段全部有 LLM 候选

- **WHEN** agent 跑完 finalize_export，finalize 触发 catalog_confirm_request 事件
- **THEN** export.tsx SHALL 切到 UIStep `entering-catalog-info`，按 slug → 世界 → 说明顺序展示输入框，每个预填 builder 中的 LLM 候选
- **AND** 作者在每个输入框按 Enter 即接受
- **AND** 三字段最终值通过新的 catalogConfirmResolverRef 回传 finalize，作为 packageSkill 的入参写入 soulkiller.json

#### Scenario: 作者编辑候选

- **WHEN** LLM 候选 slug 为 `"fate-zero-4th"`，作者改为 `"fate-zero"`
- **THEN** 提交值 SHALL 为 `"fate-zero"`，不保留 LLM 原值

#### Scenario: 作者留空

- **WHEN** 作者清空某个输入框直接按 Enter
- **THEN** 向导 SHALL 阻止提交并显示提示 "不允许留空"，直至作者填入值

#### Scenario: LLM 候选格式非法

- **WHEN** LLM 候选 `world_slug` 为 `"Fate_Zero"`（含大写/下划线）
- **THEN** 向导 SHALL 在预填前按格式规则规范化（lowercase + 下划线转连字符）；若仍然非法则 hint 提示作者手改

#### Scenario: 触发时机

- **WHEN** agent 完成 finalize_export 工具调用，进入 `finalizeAndPackage`
- **THEN** finalize SHALL 在 `builder.build()` 之后、`packageSkill()` 之前触发事件并 await resolver；resolve 后才继续 packaging

### Requirement: 步骤的取消语义

agent 已经走完，无法回退到 wizard 早期步骤。Esc 在 `entering-catalog-info` 任一子输入框 SHALL 取消整个导出流程：catalogConfirmResolver 以"已取消"信号 resolve，finalize 跳过 packageSkill，整体退出导出模式回到 REPL 主提示符。

#### Scenario: Esc 取消

- **WHEN** 作者在 `entering-catalog-info` 编辑世界名时按 Esc
- **THEN** finalize SHALL 不调用 packageSkill；不会写出任何归档文件；export.tsx SHALL 退出 interactiveMode 返回主 prompt
