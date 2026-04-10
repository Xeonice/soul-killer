## ADDED Requirements

### Requirement: Phase 1 显式上下文预算授权
SKILL.md Phase 1 的读数据段 SHALL 包含一段显式的上下文预算授权声明，告诉 LLM：本阶段需要 Read 约 `expected_file_count` 个文件 / 约 `expected_text_size_kb` KB 文本；用户使用的 1M 上下文窗口下这不是负担；**所有 Read 调用不得使用 `offset` 或 `limit` 参数**，每个文件必须全量读取。

#### Scenario: 预算授权段存在
- **WHEN** 生成 SKILL.md
- **THEN** Phase 1 章节 SHALL 含一段"上下文预算与全量读取"声明
- **AND** SHALL 明确写出 "预计 Read N 个文件、约 M KB"（N 和 M 由 packager 计算注入）
- **AND** SHALL 明确写出 "不得使用 offset / limit 参数"
- **AND** SHALL 明确写出 "本阶段有充足 context 预算，不要节省"

#### Scenario: 缺预算数字时 fallback
- **WHEN** packager 未传入 expected_file_count / expected_text_size_kb（向后兼容路径）
- **THEN** SKILL.md SHALL 渲染一段通用版预算声明（不带具体数字，但仍含 "不得使用 offset/limit" 约束）

### Requirement: Phase 1 Step 0 数据加载报告
SKILL.md Phase 1 SHALL 在现有 Step 1 (设计 state_schema) 之前新增 **Step 0: 数据加载报告**。LLM 在 Step 0 SHALL 完成所有 Read 调用，然后输出一个结构化的加载报告（markdown table 或等效格式），列出每个角色的每个文件 + 行数 + world 文件的读取状态。只有 Step 0 报告完整后才能进入 Step 1。

#### Scenario: Step 0 报告内容
- **WHEN** 生成 SKILL.md
- **THEN** Phase 1 章节 SHALL 在 Step 1 之前含一个 "Step 0: 数据加载报告" 段
- **AND** SHALL 说明报告必须以结构化格式列出每个文件的路径 + 行数
- **AND** SHALL 说明 `(not present)` 用来标记真实不存在的 optional 文件

#### Scenario: Step 0 作为 Step 1 硬门槛
- **WHEN** 生成 SKILL.md
- **THEN** Step 1 的开头 SHALL 含一句 "如果你没有先输出 Step 0 加载报告，立刻停下来回去做 Step 0"
- **AND** Step 0 的说明 SHALL 明确 "这个报告是给你自己用的 planning 输出，不需要向用户展示对话内容"

### Requirement: Phase 0 → Phase 1 污染修复
SKILL.md Phase 1 开头 SHALL 含一段明确的 re-Read 指令："忽略之前 Phase 0 对 story-spec.md 的部分读取，作为 Step 0 的第一步重新 Read 整个 story-spec.md 文件（不带 offset/limit）"。这保证 prose_style 章节 / Story State 章节 / characters 列表一定进入 Phase 1 的上下文，哪怕 Phase 0 已经做过一次部分读取。

#### Scenario: Phase 1 开头含 re-Read 指令
- **WHEN** 生成 SKILL.md
- **THEN** Phase 1 章节开头 SHALL 含一句 re-Read story-spec.md 的指令
- **AND** SHALL 说明这是为了避免 Phase 0 的部分读取污染
- **AND** SHALL 明确要求不带 offset/limit

### Requirement: Phase 1 Step 5 数据覆盖完整性自检
SKILL.md Phase 1 Step 5 自检流程 SHALL 新增一重"数据覆盖完整性自检"子步骤（多角色引擎为 Step 5.h；单角色引擎为 Step 5.e）。自检 SHALL 基于 Step 0 加载报告，验证每个角色的 identity / style / 所有 behaviors 文件都在报告里，且每个文件的行数通过 sanity check。

#### Scenario: 数据覆盖自检存在（多角色引擎）
- **WHEN** 生成多角色引擎的 SKILL.md
- **THEN** Phase 1 Step 5 自检 SHALL 含 Step 5.h 数据覆盖完整性
- **AND** SHALL 说明：对照 Step 0 报告，每个角色的 identity / style / behaviors 都必须在
- **AND** SHALL 说明行数 sanity check：identity.md > 80 行 / style.md > 60 行 / behaviors/*.md > 30 行是典型值
- **AND** SHALL 说明违规修复路径：看到 < 50 行 → 重新 Read 该文件（不带 limit）→ 更新 Step 0 报告 → 重跑 5.h

#### Scenario: 数据覆盖自检存在（单角色引擎）
- **WHEN** 生成单角色引擎的 SKILL.md
- **THEN** Phase 1 Step 5 自检 SHALL 含 Step 5.e 数据覆盖完整性
- **AND** 自检内容同多角色引擎的 Step 5.h，只是角色数 = 1

#### Scenario: 数据漂移检测
- **WHEN** Step 0 报告的文件总数与 Phase 1 开头的预算数字偏差 > 2
- **THEN** Step 5.h 自检 SHALL 要求 LLM 重新 Glob skill 目录核对真实文件数
- **AND** 如果确实少于预算，说明有漏 Read → 补 Read → 重跑

## MODIFIED Requirements

### Requirement: Phase 1 剧本生成与持久化

SKILL.md Phase 1 章节 SHALL 包含完整的 script.yaml 创作流程，顺序为：**Step 0 (数据加载报告)** → Step 1 (设计 state_schema) → Step 2 (写 initial_state) → Step 3 (写 scenes) → Step 4 (写 endings) → Step 5 (多重自检) → Step 6 (Write 持久化) → Step 7 (进入 Phase 2)。所有 Read 调用 SHALL 不得使用 offset / limit 参数。

#### Scenario: Phase 1 含 8 个步骤（0-7）
- **WHEN** 生成 SKILL.md
- **THEN** Phase 1 章节 SHALL 明确列出 Step 0 到 Step 7 的顺序
- **AND** Step 0 SHALL 是数据加载报告（新增）
- **AND** Step 1 SHALL 依赖 Step 0 完成

#### Scenario: Phase 1 读数据全量约束
- **WHEN** 生成 SKILL.md
- **THEN** Phase 1 章节 SHALL 包含"不得使用 offset / limit 参数"的显式约束
- **AND** SHALL 包含上下文预算授权声明

#### Scenario: Phase 1 必须完成剧本持久化
- **WHEN** Phase 1 完成 Step 5 自检（含 Step 5.h 数据覆盖自检）
- **THEN** Phase 1 SHALL 通过 Write 工具把 script.yaml 写入 runtime/scripts/
- **AND** Write 失败时 Phase 1 SHALL 在上下文中保留剧本，继续进入 Phase 2
