## Context

Export agent 链路（planning → execution → packaging）生成的故事元数据（genre、tone、constraints、voice_anchor、forbidden_patterns）始终为中文，因为 soul/world 数据通常是中文，agent 自然跟随输入语言。需要让用户在 export wizard 中选择目标语言，并注入到 agent prompt 中。

## Goals / Non-Goals

**Goals:**
- 用户可以在 export 时选择导出语言（zh/en/ja）
- Export agent 输出的所有元数据按选定语言生成
- `set_prose_style.target_language` 自动匹配用户选择
- Phase 1/2 产出内容按选定语言渲染

**Non-Goals:**
- 不翻译 soul/world 蒸馏数据（Phase 1 LLM 有能力基于中文资料输出其他语言）
- 不新增语言（维持 zh/en/ja）

## Decisions

### D1: Wizard 步骤位置

在 `story-direction` 之后、`selecting-output` 之前插入 `selecting-language`。使用与 config.tsx 相同的语言选择 UI 模式（↑↓ 选择，Enter 确认）。默认选中 `config.language`。

### D2: 语言传递方式

`PreSelectedExportData` 新增 `exportLanguage: SupportedLanguage` 字段。Wizard 完成后赋值，随 `preSelected` 对象传入 `runExportAgent`。

### D3: Agent Prompt 注入

不修改 system prompt 常量。在 `buildPlanningPrompt` / `buildExecutionPrompt` / `buildStorySetupPrompt` 等 user prompt builder 函数的**开头**注入语言指令块：

```markdown
# Target Language Directive (mandatory)

ALL output text — genre_direction, tone_direction, prose_direction, 
genre, tone, constraints, dynamics_note, voice_anchor, ip_specific, 
forbidden_patterns — MUST be written in {languageName}.

set_prose_style.target_language MUST be set to "{languageCode}".
```

放在 user prompt 开头（在 "# User Original Intent" 之前），确保 agent 第一眼看到语言要求。

### D4: 语言名映射

| code | languageName (用于 prompt) |
|------|---------------------------|
| zh   | Chinese (中文)            |
| en   | English                   |
| ja   | Japanese (日本語)         |

## Risks / Trade-offs

**[R1] Agent 可能不完全遵守语言指令** → 尤其是 soul/world 数据全是中文时，agent 可能混入中文。  
→ Mitigation: 语言指令放在 prompt 最开头 + `set_prose_style.target_language` 作为结构化约束。Phase 1/2 的 prose_style 会强制输出语言。

**[R2] 日语/英语 forbidden_patterns 需要对应语言** → 中文 anti-translatese patterns 对日语/英语导出无意义。  
→ Mitigation: `formatPatternsForToolDescription()` 已经是语言感知的（上一个 change 实现了），会根据 target_language 返回对应语言的 pattern 库。但当前 `set_prose_style` tool description 里的 pattern 库是静态注入的（构造时确定），不随运行时 target_language 变化。需要让 pattern 库延迟渲染或按语言参数化。
