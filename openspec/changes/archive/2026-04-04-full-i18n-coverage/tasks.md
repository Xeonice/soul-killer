## 1. 动画 i18n

- [x] 1.1 boot-animation.tsx — 将 `ソウルキラー端末`、`荒坂産業` 替换为 t() 调用，三语翻译
- [x] 1.2 exit-animation.tsx — 将 `接続切断中` 替换为 t() 调用，三语翻译

## 2. CLI 命令 i18n — 创建向导

- [x] 2.1 create.tsx — 灵魂类型选项（个人灵魂/公开灵魂）、分类标签、向导步骤标题、placeholder、确认/冲突界面全部 i18n 化
- [x] 2.2 三语翻译键添加到 zh/en/ja.json

## 3. CLI 命令 i18n — evolve/feedback/其他

- [x] 3.1 evolve.tsx — 源选项标签、维度选项、pipeline 步骤名称全部 i18n 化
- [x] 3.2 feedback.tsx — 评分标签（很像本人/基本像/不太像/完全不像）i18n 化
- [x] 3.3 recall.tsx / source.tsx — 检索状态文字 i18n 化
- [x] 3.4 list.tsx / use.tsx — 列表和加载提示 i18n 化
- [x] 3.5 model.tsx / config.tsx — 模型切换和配置界面 i18n 化
- [x] 3.6 app.tsx — 剩余硬编码错误提示 i18n 化
- [x] 3.7 distill-progress.tsx — 蒸馏进度文字 i18n 化
- [x] 3.8 三语翻译键添加到 zh/en/ja.json

## 4. 配置向导 i18n

- [x] 4.1 setup-wizard.tsx — 初始设置向导引导文字 i18n 化
- [x] 4.2 三语翻译键添加

## 5. Ingest 适配器 i18n

- [x] 5.1 synthetic-adapter.ts — `关于【X】的描述` 等模板文字 i18n 化
- [x] 5.2 feedback-adapter.ts — 反馈 chunk 内容模板（蒸馏提示、评价标签）i18n 化
- [x] 5.3 markdown-adapter.ts / url-adapter.ts — 截断提示等 i18n 化
- [x] 5.4 三语翻译键添加

## 6. 标签系统 i18n

- [x] 6.1 taxonomy.ts — 标签分类名（性格特质/沟通风格/价值取向/行为模式/领域标签）i18n 化
- [x] 6.2 parser.ts — LLM 标签解析 prompt 按语言提供完整版本
- [x] 6.3 三语翻译键添加

## 7. 蒸馏系统 LLM prompt i18n

- [x] 7.1 extractor.ts — identity/style/behavior 三个提取 prompt 按语言编写独立版本
- [x] 7.2 merger.ts — identity/style/behavior 三个合并 prompt 按语言编写独立版本
- [x] 7.3 三语 prompt 翻译键添加到 zh/en/ja.json

## 8. 验证

- [x] 8.1 运行全量测试，确保无回归
- [x] 8.2 扫描 src/ 确认无残留硬编码中文（grep 验证）
