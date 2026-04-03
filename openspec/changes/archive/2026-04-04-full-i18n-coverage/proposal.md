## Why

项目的 i18n 系统（`src/i18n/`）已经就位，支持 zh/ja/en 三语，`t(key)` 函数也在部分模块使用。但代码中仍有约 288 处硬编码的中文/日文字符串散布在 29 个文件中，这些字符串完全没有经过 i18n。切换语言时，用户看到的是中英混杂的界面。

受影响范围：
- **CLI 动画**（约 4 处）：boot/exit 动画中的日文标题和中文状态文字
- **CLI 命令**（约 150 处）：create 向导、evolve 流程、feedback 评分、config、model、recall、source、list、help、use
- **蒸馏系统**（约 55 处）：extractor 和 merger 的 LLM 系统 prompt
- **标签系统**（约 35 处）：tag parser prompt、taxonomy 分类定义
- **Ingest 适配器**（约 25 处）：synthetic、feedback、markdown 中的文字
- **配置**（约 19 处）：setup-wizard 的引导文字

## What Changes

- 将所有硬编码的中文/日文字符串替换为 `t(key)` 调用
- 在 zh.json / en.json / ja.json 中添加对应的翻译键
- 对 LLM prompt 类字符串（distill、tags、merger），使用专门的 prompt 模板键，保持 prompt 质量在每种语言下都最优
- 动画中的赛博朋克风味文字（如 `ソウルキラー端末`）按语言适配

## Capabilities

### New Capabilities
（无）

### Modified Capabilities
- `i18n`: 从部分覆盖扩展为全量覆盖，所有用户可见字符串通过 t() 管道
- `cyberpunk-visual-system`: 动画文字支持多语言
- `repl-shell`: 所有命令输出通过 i18n

## Impact

- `src/i18n/locales/{zh,en,ja}.json` — 大幅扩展翻译键（预计新增 150+ 键）
- `src/cli/commands/*.tsx` — 所有硬编码字符串替换为 t() 调用（约 15 个文件）
- `src/cli/animation/{boot,exit}-animation.tsx` — 动画文字 i18n 化
- `src/distill/{extractor,merger}.ts` — LLM prompt 模板 i18n 化
- `src/tags/{parser,taxonomy}.ts` — 标签分类和 parser prompt i18n 化
- `src/ingest/{synthetic,feedback,markdown}-adapter.ts` — 适配器文字 i18n 化
- `src/config/setup-wizard.tsx` — 设置向导 i18n 化
