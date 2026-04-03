## Context

项目已有 `src/i18n/index.ts` 提供 `t(key, params?)` 函数，`src/i18n/locales/{zh,en,ja}.json` 存放翻译。当前约 50 个翻译键已在使用，但 ~288 处硬编码中文/日文遍布 29 个文件。

## Goals / Non-Goals

**Goals:**
- 所有用户可见字符串通过 `t()` 管道
- LLM prompt 按语言提供最优版本
- zh/en/ja 三语完整翻译

**Non-Goals:**
- 不做运行时语言切换（已有的重启生效机制不变）
- 不引入 ICU MessageFormat 等复杂格式化库
- 不做 RTL 支持

## Decisions

### D1: 翻译键命名规范
按模块分层：`{module}.{component}.{context}`
- `anim.boot.title` — 启动动画标题
- `create.type.personal` — 创建向导的个人灵魂选项
- `distill.prompt.identity` — 蒸馏身份提取 prompt
- `tags.category.personality` — 标签分类名

### D2: LLM prompt 翻译策略
LLM prompt 不做逐句翻译，而是为每种语言单独编写完整 prompt。原因：
- 中文 prompt 的表达习惯和英文/日文差异很大
- 直译会降低 prompt 质量
- prompt 模板键存在 locale JSON 中，每种语言有独立的完整 prompt 文本

### D3: 赛博朋克风味文字的多语言策略
动画中的日文文字（`ソウルキラー端末`、`荒坂産業`）是赛博朋克世界观的一部分：
- **ja**: 保持原样（`ソウルキラー端末 · [荒坂産業]`）
- **zh**: `灵魂杀手终端 · [荒坂工业]`
- **en**: `SOULKILLER TERMINAL · [ARASAKA IND.]`

### D4: 按模块分批实施
按影响范围从小到大：
1. 动画（4 处，影响最小）
2. CLI 命令（150 处，最多但最机械）
3. Ingest 适配器（25 处）
4. 标签系统（35 处）
5. 蒸馏 prompt（55 处，需要最仔细的翻译）
6. 配置向导（19 处）

## Risks / Trade-offs

- **[LLM prompt 翻译质量]** → 三语 prompt 都需要测试蒸馏效果，不能只翻译不验证
- **[翻译键数量爆炸]** → 预计 150+ 新键，JSON 文件变大但仍可维护；未来可拆分为模块级文件
- **[CI 校验缺失]** → 当前没有检查翻译完整性的 CI，可能遗漏某语言的键
