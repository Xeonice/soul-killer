## 1. soul-dimensions.ts 扩展

- [x] 1.1 SoulDimension 类型新增 `'capabilities' | 'milestones'`
- [x] 1.2 DIMENSIONS record 新增 capabilities（important, `capabilities.md`）和 milestones（important, `milestones.md`）
- [x] 1.3 DIMENSION_SIGNALS 新增 capabilities 和 milestones 的正则模式
- [x] 1.4 三种 classification 的搜索模板新增 capabilities 和 milestones 查询
- [x] 1.5 更新 ALL_DIMENSIONS 数组确认包含 8 个维度
- [x] 1.6 调整覆盖度阈值：MIN_TOTAL_COVERED = 4
- [x] 1.7 `generateSearchPlan` 新增 `tags?: { domain?: string[] }` 参数
- [x] 1.8 capabilities / milestones 模板基于 domain tags 动态追加关键词
- [x] 1.9 thoughts / behavior 模板可选追加 domain tags（通过 TAG_ENHANCED_DIMENSIONS 集合统一处理）

## 2. Capture Agent 集成

- [x] 2.1 CaptureStrategy 接口和 SoulCaptureStrategy / search-factory 更新，支持传入 tags

## 3. distill-agent.ts 扩展

- [x] 3.1 system prompt Output Files 新增 capabilities.md 和 milestones.md 的规范描述
- [x] 3.2 system prompt Recommended Workflow 新增 writeCapabilities 和 writeMilestones 步骤
- [x] 3.3 新增 writeCapabilities tool（写入 soul/capabilities.md）
- [x] 3.4 新增 writeMilestones tool（写入 soul/milestones.md）
- [x] 3.5 更新 reviewSoul tool 读取 capabilities.md 和 milestones.md
- [x] 3.6 sampleChunks 的 dimension 参数描述更新为 8 维度

## 4. soul/package.ts 扩展

- [x] 4.1 readSoulFiles 返回类型新增 capabilities 和 milestones 字段
- [x] 4.2 读取 capabilities.md 和 milestones.md，不存在时返回空字符串

## 5. export 模板更新

- [x] 5.1 skill-template.ts Phase 1 新增读取 capabilities.md 和 milestones.md 的指令
- [x] 5.2 skill-template.ts Phase 2 新增能力引用规则和时间线引用规则
- [x] 5.3 packager.ts 新增 capabilities.md 和 milestones.md 复制逻辑（非空时写入）

## 6. 单元测试

- [x] 6.1 更新 dimensions 单元测试：验证 ALL_DIMENSIONS 长度为 8、DIMENSION_SIGNALS 包含 capabilities 和 milestones 的正则匹配、搜索模板包含新维度
- [x] 6.2 新增 tag 感知搜索测试：验证 domain tags 扩展 capabilities/milestones 查询词、thoughts/behavior 可选追加、无 tags 时退回默认模板、identity/quotes/expression/relations 不受影响
- [x] 6.3 新增 analyzeCoverage 阈值测试：验证 MIN_TOTAL_COVERED=4 下的 canReport 判定
- [x] 6.4 更新 readSoulFiles 单元测试：验证新字段（capabilities/milestones）返回内容、缺失文件返回空字符串
- [x] 6.5 更新 export 单元测试（generateSkillMd）：验证 SKILL.md 包含 capabilities.md/milestones.md 读取指令和引用规则
- [x] 6.6 更新 export 单元测试（generateStorySpec）：story-spec 已在上一次 change 中包含 capabilities 约束
- [x] 6.7 更新 packager 集成测试：创建包含 capabilities.md/milestones.md 的 soul 并导出，验证目录结构完整

## 7. E2E 测试

- [x] 7.1 更新 /export E2E 测试（Scenario 10）：创建包含 capabilities.md 和 milestones.md 的 soul fixture，验证导出的 Skill 目录包含这两个文件
- [ ] 7.2 新增 /create E2E 验证：完整 create 流程后检查 soul 目录是否产出 capabilities.md 和 milestones.md（依赖 mock LLM 模拟 distill agent 的 writeCapabilities/writeMilestones 调用）— 复杂度高，后续实现
- [x] 7.3 E2E 回归通过：9/11 pass，2 个 fail (Scenario 4/6) 为 main 分支已有问题，与本次改动无关
