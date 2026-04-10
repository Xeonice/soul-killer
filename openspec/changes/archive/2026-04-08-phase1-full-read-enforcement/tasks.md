## 1. Packager 文件计数与大小估算

- [x] 1.1 在 `src/export/packager.ts` 新增辅助函数 `countSkillMdFiles(skillDir: string): number`，扫描即将打包的所有 md 文件（souls/**/*.md + world/**/*.md + story-spec.md），返回总数
- [x] 1.2 新增辅助函数 `estimateSkillTextSizeKb(skillDir: string): number`，累加所有 md 文件的字节数后除 1024 取整
- [x] 1.3 在 packager 调用 `generateSkillMd` 前计算这两个数字，通过新增的 options 字段传入
- [x] 1.4 单测：两个辅助函数对 fixture skill 目录返回正确数字

## 2. generateSkillMd options 扩展

- [x] 2.1 `GenerateSkillMdOptions` interface 新增 `expectedFileCount?: number`、`expectedTextSizeKb?: number` 两个可选字段
- [x] 2.2 `buildMultiCharacterEngine` / `buildSingleCharacterEngine` 接受这两个字段
- [x] 2.3 缺字段时，预算声明段渲染通用 fallback 文案（不带具体数字，但仍含"不得使用 offset/limit"约束）

## 3. Phase 1 读数据段：上下文预算授权

- [x] 3.1 在 `buildMultiCharacterEngine` 的 Phase 1 起始段加"上下文预算与全量读取声明"，含 expected_file_count / expected_text_size_kb 占位
- [x] 3.2 声明明确写出：
  - "本阶段预计 Read 约 N 个文件 / 约 M KB 文本"
  - "你有 1M context，此规模 < 15% 预算"
  - "所有 Read 调用**不得**使用 `offset` 或 `limit` 参数"
  - "每个文件必须全量读取"
  - "不要防御性地节省 token — 这是预期行为"
- [x] 3.3 同步给 `buildSingleCharacterEngine`
- [x] 3.4 缺字段 fallback：通用版声明（"预计需要 Read 多个文件"，保留 offset/limit 禁令）

## 4. Phase 1 Phase 0 污染修复

- [x] 4.1 在 `buildMultiCharacterEngine` 的 Phase 1 章节开头加一段 re-Read 指令："作为 Step 0 的第一步，重新 Read ${CLAUDE_SKILL_DIR}/story-spec.md 的完整内容，忽略 Phase 0 可能已做过的部分读取（Phase 0 为了拿 acts_options 只读了前 50 行，story-spec.md 的 prose_style 和 Story State 章节在后面）"
- [x] 4.2 同步给 `buildSingleCharacterEngine`
- [x] 4.3 明确要求"该次 Read 不得使用 offset/limit"

## 5. Phase 1 Step 0 数据加载报告

- [x] 5.1 在 `buildMultiCharacterEngine` 的 Phase 1 「创作步骤」段，在 Step 1 之前插入 Step 0
- [x] 5.2 Step 0 内容：
  - "完成本阶段所有文件的全量 Read 调用"
  - "输出一个结构化的数据加载报告"（markdown table）
  - 表格格式示例：`| 文件 | 行数 | 备注 |`
  - "这是给你自己的 planning 输出，不需要向用户展示"
  - "列出：story-spec.md (重新 Read 的完整内容) / 每个角色的 identity.md / style.md / capabilities.md / milestones.md / behaviors/*.md / world/**/*.md / history/timeline.md + events"
  - "optional 文件若真的不存在，用 `(not present)` 标注"
- [x] 5.3 同步 `buildSingleCharacterEngine` 的 Phase 1 加 Step 0（角色数 = 1 的版本）
- [x] 5.4 修改现有 Step 1 开头加一句 "**如果你没有先输出 Step 0 加载报告，立刻停下来回去做 Step 0**"
- [x] 5.5 现有 Step 7 保持不变（已经是最后一步）

## 6. Phase 1 Step 5 数据覆盖完整性自检

- [x] 6.1 在 `buildMultiCharacterEngine` 的 Phase 1 Step 5 自检流程末尾（当前 5.g prose_style 反例对照之后）加 **Step 5.h — 数据覆盖完整性自检**
- [x] 6.2 自检内容：
  - "对照 Step 0 加载报告，验证每个角色的 identity / style / 所有 behaviors 文件都在报告里"
  - "对每个文件的行数做 sanity check：identity.md > 80 / style.md > 60 / behaviors/*.md > 30 是典型值"
  - "看到任何文件 < 50 行 → 大概率是 limit 参数漏网 → 立即重新 Read 该文件（不带 limit）→ 更新 Step 0 报告 → 重跑 Step 5.h"
  - "如果 Step 0 报告的文件总数与 Phase 1 开头的预算数字偏差 > 2，Glob 核对真实文件数，补 Read 缺失项"
- [x] 6.3 同步 `buildSingleCharacterEngine` 的 Phase 1 Step 5 加 **Step 5.e — 数据覆盖完整性自检**（单角色版）
- [x] 6.4 更新多角色引擎 Step 5 的"自检通过后"文案从"通过全部 7 重后"改为"通过全部 8 重后"
- [x] 6.5 更新单角色引擎 Step 5 的自检总数文案从"5.a–5.d"改为"5.a–5.e"

## 7. 单测：SKILL.md 模板断言

- [x] 7.1 `tests/unit/export.test.ts` 新增测试 "Phase 1 includes context budget declaration with file count"：生成 SKILL.md 含 "不得使用 offset" / "全量读取" / "1M context" 关键字
- [x] 7.2 新增测试 "Phase 1 includes Step 0 data loading report"：含 "Step 0" + "数据加载报告" + markdown table 提示
- [x] 7.3 新增测试 "Phase 1 re-reads story-spec.md to fix Phase 0 pollution"：含 "重新 Read" + "story-spec.md" + "忽略 Phase 0"
- [x] 7.4 新增测试 "Phase 1 Step 5 includes data coverage self-check"：多角色引擎含 "5.h" + "数据覆盖" + "80" + "60"；单角色引擎含 "5.e" + "数据覆盖"
- [x] 7.5 新增测试 "Phase 1 budget declaration uses fallback when no file count provided"：不传 expectedFileCount 时渲染通用版

## 8. 单测：packager 文件计数

- [x] 8.1 `tests/unit/export-tools.test.ts` 或 `tests/unit/packager.test.ts` 新增测试：`countSkillMdFiles` 对 fixture 目录返回正确值
- [x] 8.2 新增测试：`estimateSkillTextSizeKb` 对 fixture 目录返回合理范围
- [x] 8.3 新增集成测试：packageSkill 端到端跑一次，生成的 SKILL.md 含 expected_file_count 和 expected_text_size_kb 注入的具体数字

## 9. 文档

- [x] 9.1 在 `CLAUDE.md` 的 "Export / Skill format" 小节加一段 Phase 1 full-read enforcement 简述：expected_file_count 预算 / Step 0 加载报告 / Step 5.h 数据覆盖自检 / Phase 0 污染修复

## 10. 端到端验证

- [x] 10.1 由 tests/unit/export.test.ts 的 Phase 1 断言间接覆盖（预算声明 / Step 0 / re-Read / 5.h）
- [ ] 10.2 (manual) 用 three-kingdom-chibi-in-skill-0003tvip 重新 export 一次，在 Claude Code 加载后跑 Phase 1，观察 Read 轨迹是否全部是无 `lines 1-N` 的全量 Read
- [ ] 10.3 (manual) 验证 Phase 1 开头重 Read 了 story-spec.md 完整内容（不是只读 50 行）
- [ ] 10.4 (manual) 验证 Phase 1 输出了结构化的 Step 0 加载报告（markdown table）
- [ ] 10.5 (manual) 检查生成的 script.yaml 中的 scene 是否引用了深层 behaviors/*.md 的细节（以前看不到的细节现在出现）
- [ ] 10.6 (manual) 比对 fsn 间桐桜的新 skill 输出，prose_style 约束是否生效（之前因为 Phase 0 污染看起来像没生效）

## 11. Phase 2 LLM trained-default 行为抑制（scope 扩展）

在本 change 的 apply 阶段，用户观察到另一个同类 LLM 默认行为问题：Phase 2 运行时 LLM 会自主插入 "要继续吗？" 之类的 meta 暂停、暴露存档细节（"存档已保存至 slot-2"）、展示进度指示（"剧情已进入第三幕中段"），在 AskUserQuestion 混入 "继续/状态/存档" 伪菜单选项。根因与 Phase 1 partial-Read 同属"LLM chatbot 训练默认行为在 visual novel 场景里水土不服"这一大类，决定在同一个 change 里一次性修掉。

- [x] 11.1 多角色引擎 `buildMultiCharacterEngine` 的「场景流转规则」段新增「你只在 3 种情况下停止渲染」子段，枚举 3 种合法停止点，其他情况视为错误
- [x] 11.2 多角色引擎「场景流转规则」第一条改为 "apply_consequences → **立即渲染下一场景**"，明确这是单个原子动作
- [x] 11.3 多角色引擎「禁止事项」段重构为 5 个分类：剧情结构 / 控制流自暂停 / 进度存档暴露 / 聊天机器人式元叙述 / 选项标签污染
- [x] 11.4 禁止事项里明确列出观察到的具体反例：`"要继续吗"` / `"回复过长"` / `"第三幕中段"` / `"scene-007"` / `"存档已保存至 slot-2"` / `"故事状态更新"` / `"友善路线"`
- [x] 11.5 同步单角色引擎 `buildSingleCharacterEngine` 的对应段落
- [x] 11.6 单测 `tests/unit/export.test.ts` 新增 "Phase 2 forbids LLM trained-default self-pause and fourth-wall breaks"：覆盖 4 个分类关键字 + 3 种停止情况文案 + 单角色引擎同步
- [x] 11.7 更新 `CLAUDE.md` 的 phase1-full-read-enforcement 条目，加一段说明 scope 扩展到 Phase 2 trained-default 抑制
- [ ] 11.8 (manual) 用重新 export 的三国 skill 跑 Phase 2，验证不再出现 "要继续吗"/"第 N 幕"/"slot-X" 这种 meta 输出，场景能一路推进到结局
