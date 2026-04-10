## Context

Soulkiller 当前的 i18n 系统仅覆盖 CLI 用户界面层（590 key, ~1272 次 t() 调用）。导出层（SKILL.md / story-spec / agent prompts）、Agent/Distill 层（维度定义、搜索策略、蒸馏指南）全部硬编码中文。用户选择日语或英语时，导出的 .skill 文件仍为中文内容。

现有架构：
- `src/infra/i18n/index.ts` — 简单 key-value 翻译，`t(key, params)` + `setLocale()`
- `src/infra/i18n/locales/{zh,en,ja}.json` — 590 key，仅覆盖 CLI 文本
- `src/export/spec/skill-template.ts` — 913 行中文模板，直接拼接字符串
- `src/export/agent/prompts.ts` — 335 行中文 system prompt
- `src/export/spec/story-spec.ts` — 208 行中文结构文档
- `src/soul/capture/soul-dimensions.ts` / `src/world/capture/world-dimensions.ts` — 维度定义硬编码中文

## Goals / Non-Goals

**Goals:**
- CLI 层 100% i18n 覆盖（消除所有硬编码运行时中文）
- 导出的 .skill 文件按用户语言设置生成对应语言内容
- Agent/Distill 的 LLM prompt 按语言切换
- Prose style 系统支持日语 anti-translatese
- 维持现有 prompt 质量（不因翻译降低 LLM 输出效果）

**Non-Goals:**
- 不新增语言（维持 zh/en/ja 三语）
- 不做运行时语言热切换（仍需重启生效）
- 不翻译用户生成内容（soul name、distill 产物等）
- 不翻译代码注释
- 英语不需要 anti-translatese pattern（LLM 母语）

## Decisions

### D1: 导出层双层模板架构

**选择**: 引擎指令层用英文（lingua franca），叙事指令层按 `target_language` 动态注入。

**替代方案**:
- A. 全翻译 — SKILL.md 整体翻译 → 维护成本极高，三语各维护一份 900+ 行模板
- B. 注入式 — 保持中文引擎 + 注入语言约束 → 中英混合可能让 LLM 困惑
- C. **双层模板（选中）** — 引擎层英文，叙事层模板化 → 英文是 LLM 最强指令语言，叙事层可按语言参数化

**理由**: 英文引擎指令对所有主流 LLM 最稳定；叙事层（prose style / tone / choice text）本身就需要按语言定制，天然适合参数化。维护一份英文引擎 + 三份叙事参数，而非三份完整模板。

**实现方式**:
```
skill-template.ts 中的函数签名增加 language 参数:
  buildMultiCharacterEngine(config, language) → string
  buildReadBudgetDeclaration(opts, language) → string

引擎指令（Phase 控制流、state 管理、validation 逻辑）→ 重写为英文
叙事指令（prose style、禁止事项、场景渲染规则）→ 按 language 从模板生成
```

### D2: LLM Prompt 的多语言存储策略

**选择**: prompt 以模块内常量存储，按语言用 Record<SupportedLanguage, string> 索引。不使用 locale JSON。

**理由**: LLM prompt 是大段 markdown 文本（几十到几百行），放入 JSON 需要转义所有换行，可读性和可维护性极差。保持 .ts 文件内 template literal，按语言索引。

**结构**:
```typescript
// src/export/agent/prompts.ts
const PLANNING_SYSTEM_PROMPT: Record<SupportedLanguage, string> = {
  zh: `你是多角色视觉小说的规划专家...`,
  en: `You are a multi-character visual novel planning expert...`,
  ja: `あなたはマルチキャラクター・ビジュアルノベルの企画専門家です...`,
}

export function getPlanningPrompt(lang: SupportedLanguage): string {
  return PLANNING_SYSTEM_PROMPT[lang]
}
```

### D3: 维度定义多语言化

**选择**: `soul-dimensions.ts` / `world-dimensions.ts` 的维度模板增加多语言字段。

**结构**:
```typescript
interface DimensionTemplate {
  key: string                    // 不变 — 内部 ID
  display: Record<SupportedLanguage, string>  // '身份' / 'Identity' / 'アイデンティティ'
  description: Record<SupportedLanguage, string>
  signals: string[]              // 保持多语言混合（搜索用，覆盖面越广越好）
  qualityCriteria: Record<SupportedLanguage, string>
}
```

`signals` 保持不变 — 它们用于搜索匹配，中/英/日混合的关键词集覆盖面最广。

### D4: CLI 硬编码清理策略

**选择**: 直接提取到现有 locale JSON，使用 `t()` 替换。

22 处分布在 7 个文件，按常规 i18n key 命名约定添加。不需要架构改动。

### D5: Prose Style 日语扩展

**选择**: 新建 `src/export/support/ja-translatese-patterns.ts`，与现有 `zh-translatese-patterns.ts` 并列。

**理由**: 日语有自己的翻译腔问题（不自然的汉语式表达、过度使用敬语等），需要专门的 pattern 库。英语作为 LLM 母语不需要。

`formatPatternsForToolDescription()` 增加 language 参数，按语言返回对应 pattern 库。

### D6: State Runtime CLI 消息

**选择**: `runtime/lib/*.ts` 中的输出消息（给 LLM 读取）按导出语言硬编码。

**理由**: runtime 文件是 export 时从 src 拷贝到 skill archive 的。导出时根据语言选择拷贝哪个版本的消息常量。由于 runtime 不能有 npm 依赖，不引入 i18n 框架，而是在 export 构建时注入语言常量。

**实现**: 消息字符串提取为顶部常量对象，export 时由 packager 根据 language 做字符串替换或条件注入。

### D7: 语言参数传递链路

```
Config (language)
  │
  ├─→ setLocale() → t() → CLI 用户界面
  │
  └─→ ExportCommand
        │
        ├─→ Planning Agent (getPlanningPrompt(lang))
        ├─→ Execution Agent (getExecutionPrompt(lang))
        ├─→ buildSkillMd(config, language)
        │     ├─→ 引擎指令 (英文, 不变)
        │     └─→ 叙事指令 (按 language 参数化)
        ├─→ generateStorySpec(config, language)
        └─→ packageSkill(config, language)
              └─→ injectRuntimeFiles(language)
                    └─→ state CLI 消息按 language 注入
```

## Risks / Trade-offs

**[R1] Prompt 翻译质量** → 英文/日文 prompt 可能不如原始中文 prompt 精确。  
→ Mitigation: 由熟悉该语言的人 review prompt 翻译；保持英文引擎层不翻译（最稳定）。

**[R2] 维护成本三倍化** → 每次改 prompt 需要同步三语。  
→ Mitigation: 引擎层用英文单一版本；叙事层和维度定义变更频率低；使用 TypeScript 类型系统强制三语完整性（Record<SupportedLanguage, string> 缺少语言会编译报错）。

**[R3] SKILL.md 引擎层中文→英文重写可能引入 bug** → 913 行精心调试的 prompt 工程。  
→ Mitigation: 分阶段重写，每阶段跑完整 E2E 验证。英文 prompt 在 Claude 上通常效果不劣于中文。

**[R4] State Runtime 消息注入增加 packager 复杂度**  
→ Mitigation: 消息量小（~20 条短字符串），注入逻辑简单。
