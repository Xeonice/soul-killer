## 0. StorySpecConfig 类型重构（acts → acts_options）

- [x] 0.1 修改 `src/export/story-spec.ts` 的 `StorySpecConfig`：移除 `acts: number` / `rounds: string` / `endings_min: number`，新增 `acts_options: ActOption[]` 和 `default_acts: number`
- [x] 0.2 定义 `ActOption` 类型：`{ acts: number, label_zh: string, rounds_total: string, endings_count: number }`
- [x] 0.3 更新 packager.ts 中生成 story-spec.md 的逻辑，输出新的 frontmatter 字段
- [x] 0.4 更新 SKILL.md 模板（`skill-template.ts`）：Phase 0 增加幕数选择步骤
- [x] 0.5 SKILL.md 引擎文档：appears_from 截断规则（出场幕 > 总幕数 → 最后一幕）
- [x] 0.6 旧版本 story-spec.md 兼容性：暂不支持加载旧格式（破坏性变更，旧 export 需要重新生成）

## 1. ExportBuilder 累积器

- [x] 1.1 在 `export-agent.ts` 中定义 `ExportBuilder` 类（或函数 + 闭包）：维护 metadata、characters Map
- [x] 1.2 实现 `setMetadata` / `addCharacter` / `setAxes` / `build` 方法，包含完整的状态校验
- [x] 1.3 build() 时检查 metadata 存在、至少 1 个 character、所有 character 都有 axes
- [x] 1.4 addCharacter 强制 max 4 角色限制（与 multi-soul-export 角色上限保持一致）
- [x] 1.5 build() 输出符合 packager 的 `StorySpecConfig` 完整契约（souls / world_name / 完整 story_spec 嵌套结构）
- [x] 1.6 setMetadata 校验 acts_options 非空且 default_acts 在 acts_options 中

## 2. 分阶段工具实现

- [x] 2.1 实现 `set_story_metadata` tool：input 含 genre/tone/constraints/acts_options/default_acts，调用 builder.setMetadata
- [x] 2.2 实现 `add_character` tool：input 含 name/role/display_name/appears_from/dynamics_note，校验 name 在 preSelected.souls 中、未重复添加
- [x] 2.3 实现 `set_character_axes` tool：input 含 character_name + axes 数组，校验角色已添加、axes 长度 2-3
- [x] 2.4 实现 `finalize_export` tool：调用 builder.build()，捕获错误返回 `{ error }`；成功时调用 packageSkill 并发出 complete 事件
- [~] 2.5 z.preprocess 包裹 — 不再需要：input 拆小后 LLM 不会生成成字符串字面量；preprocess 与 AI SDK v6 ZodPipe 不兼容
- [x] 2.6 所有工具的 execute 用 try/catch 包裹，错误返回 `{ error }` 而非 throw

## 3. 删除旧工具 + 重写 SYSTEM_PROMPT

- [x] 3.1 从 tools 对象中删除 `package_skill`
- [x] 3.2 保留 `ask_user`（兜底）
- [x] 3.3 重写 `SYSTEM_PROMPT`，必须包含以下要素：
  - **工作流**: 引导 set_story_metadata → add_character + set_character_axes (per character) → finalize_export
  - **简短输入**: 强调每次调用 input 简短
  - **错误重试**: 说明遇到 error 应根据信息修正
  - **acts_options 推荐**: ≤2 角色 → [3, 5] default 3；3-4 角色 → [3, 5, 7] default 5；rounds_total ≈ acts × 8-12；endings_count ≈ acts + 1
  - **幕数 runtime 选择说明**: 明确告知 agent，幕数最终由用户在 skill 启动时选择，agent 只负责给出合理选项
  - **基调独特性** (来自 multi-soul-export): tone 必须反映角色组合独特性，禁止"悬疑/温情/冒险"等通用词
  - **tradeoff 约束** (来自 multi-soul-export): 在 set_story_metadata 的 constraints 里要求至少一条 tradeoff（每个选项对不同角色差异化影响）
  - **role 分配** (来自 multi-soul-export): 至少 1 个 protagonist，多角色时建议 1 个 deuteragonist；antagonist 可选
  - **数据来源**: 数据已在初始 prompt 中，不要调用 list/read（保留 user-driven selection 的契约）
- [x] 3.4 更新 `stopWhen`：将 `hasToolCall('package_skill')` 改为 `hasToolCall('finalize_export')`
- [x] 3.5 调高 `stepCountIs` 到 20（4 角色 ≈ 10 步预算 20）
- [x] 3.6 保留 `runExportAgent` 签名 `(config, preSelected, onProgress, askUser)` 不变
- [x] 3.7 保留 `buildInitialPrompt` 函数和它对完整 souls/world 数据的传递

## 4. 进度反馈适配

- [x] 4.1 删除 `packageSkillCalled` 标志，改为 `finalizeExportCalled`
- [x] 4.2 检查 stream 结束兜底逻辑使用新标志
- [x] 4.3 确认 trail 在多 tool 调用下展示正常（每个 tool 都发 tool_start/tool_end 事件，trail 会自然累积）

## 5. 验证

- [x] 5.1 `bun run build` 类型检查通过
- [x] 5.2 `bun run test` 单元测试通过（559 tests passed）
- [~] 5.3 手动测试：单 soul + world ≈ 4 步 — 待用户运行 `/export` 端到端验证
- [~] 5.4 手动测试：4 souls + world = 10 步 — 待用户运行 `/export` 端到端验证
- [~] 5.5 手动测试：故意漏 set_axes 触发错误恢复 — 待用户 LLM 实际交互验证
- [~] 5.6 查看 export agent log 验证 input 尺寸 — 待运行后查看 `~/.soulkiller/logs/export/`
- [~] 5.7 验证 multi-soul-export 契约 — 代码层已通过单元测试保证（StorySpecConfig 类型、acts_options frontmatter、generateSkillMd Phase 0 选择、ExportBuilder max 4 角色等）。SKILL.md 运行时行为需端到端验证
- [~] 5.8 验证 user-driven selection 契约 — runExportAgent 签名和 buildInitialPrompt 未改动，代码层保证契约；端到端验证待用户运行 `/export`
