## 1. Skill 命名空间前缀

- [x] 1.1 更新 `src/export/packager.ts` 的 `getSkillDirName()` 输出加 `soulkiller:` 前缀
- [x] 1.2 更新 `src/export/skill-template.ts` 的 SKILL.md frontmatter name 字段使用带前缀格式（通过 packager 传入的 dirName 自动生效）
- [x] 1.3 更新 `src/agent/export-agent.ts` 完成事件中 `getSkillDirName` 调用确保使用新命名（已使用 getSkillDirName，自动生效）

## 2. story-spec.ts 模板更新

- [x] 2.1 在 `generateStorySpec()` 输出中新增「状态系统」段落：数值轴规则（2-3 个，0-10，初始 5）、关键事件标记规则（3-5 个布尔）、选项影响标注格式
- [x] 2.2 在 `generateStorySpec()` 输出中新增「结局判定」段落：条件格式（数值阈值 + 事件组合）、优先级排列、默认结局要求
- [x] 2.3 更新现有「结局展示」部分，新增旅程回顾和其他结局预览的生成规约

## 3. skill-template.ts 模板更新

- [x] 3.1 在 Phase 2 规则中新增「状态追踪规则」：内部状态对象格式、选择后更新逻辑、不向用户暴露
- [x] 3.2 在 Phase 2 规则中新增「结局判定规则」：到达结局阶段时评估条件、优先级匹配
- [x] 3.3 在 Phase 2 规则中新增「结局展示规则」：三段式展示（结局文字 → 旅程回顾 → 其他结局预览）
- [x] 3.4 在 Phase 2 规则中新增「重玩规则」：AskUserQuestion 提供"从头再来"/"结束故事"、重置逻辑、回到 Phase 0

## 4. 测试

- [x] 4.1 更新 `tests/unit/export.test.ts` 中 `generateStorySpec` 的测试：验证输出包含状态系统、结局判定段落
- [x] 4.2 更新 `tests/unit/export.test.ts` 中 `generateSkillMd` 的测试：验证输出包含状态追踪、结局展示、重玩规则
- [x] 4.3 更新 `tests/unit/export-tools.test.ts` 中 `getSkillDirName` 的测试：验证 `soulkiller:` 前缀
- [x] 4.4 更新 `tests/component/export-protocol-panel.test.tsx` 完成面板测试：验证提示文字包含带前缀的 skill name
