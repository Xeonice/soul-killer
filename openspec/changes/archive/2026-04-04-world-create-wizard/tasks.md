## 1. WorldCreateWizard 核心状态机

- [x] 1.1 创建 `src/cli/commands/world-create-wizard.tsx` — 20 步状态机骨架，props: `{ onComplete, onCancel }`，实现 name → display-name → description → method-select → confirm → done 主干路径（空白世界分支先通）
- [x] 1.2 实现名称冲突处理 — name-conflict 步骤，覆盖（deleteWorld + 继续）/ 重命名（回到 name）
- [x] 1.3 实现确认摘要步骤 — 展示世界名/显示名/描述/方式/条目数分类统计，确认/修改两个选项

## 2. 手动创建分支

- [x] 2.1 实现 manual-background 步骤 — 引导提示 + 自动创建 always/background/900 条目
- [x] 2.2 实现 manual-rules 和 manual-atmosphere 步骤 — 可选（Enter 跳过），自动创建 always/rule/800 和 always/atmosphere/700 条目
- [x] 2.3 实现 manual-more 循环 — 「添加知识条目」/ 「完成」选择，添加时收集 name + keywords + content，创建 keyword/lore/100 条目，循环直到选择完成

## 3. 蒸馏分支

- [x] 3.1 实现 distill-path 步骤 — TextInput 带 pathCompletion 收集 markdown 目录路径
- [x] 3.2 实现 distilling 步骤 — 调用 WorldDistiller.distill()，显示进度事件
- [x] 3.3 实现 distill-review 步骤 — 渲染 WorldDistillReview，审查完成后将 accepted entries 存入状态

## 4. URL 抓取分支

- [x] 4.1 实现 url-input 步骤 — 逐行输入 URL（每次 Enter 添加一条，空行结束），实时展示已输入的 URL 列表
- [x] 4.2 实现 url-fetching 步骤 — 逐个 URL 调用 page extractor 提取文本，转为 chunks，失败的 URL 显示警告但不中断
- [x] 4.3 将提取的 chunks 送入 WorldDistiller 的 classify → cluster → extract 流程，复用 distill-review 审查

## 5. 菜单集成与 i18n

- [x] 5.1 修改 `world.tsx` — 「创建」选项直接渲染 `WorldCreateWizard`，移除 collect-name 步骤和 worldName 状态
- [x] 5.2 删除旧的 `world-create.tsx`（已被 Wizard 替代）
- [x] 5.3 添加向导相关的 i18n key（zh/en/ja）— 步骤提示、创建方式描述、冲突选项、摘要标签

## 6. 测试

- [x] 6.1 为 WorldCreateWizard 编写组件测试 — 空白方式完整流程、手动方式核心条目收集、名称冲突处理
- [x] 6.2 更新 `world-list.test.tsx` — 移除对旧 WorldCreateCommand 的引用（如有）
