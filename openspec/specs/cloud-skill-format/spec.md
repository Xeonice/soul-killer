# Cloud Skill Format

## Purpose

Cloud Skill 导出产物格式定义，包括目录结构、SKILL.md 模板（视觉小说引擎）和 story-spec.md（剧本生成规约）。
## Requirements
### Requirement: Skill 目录结构支持多 Soul
Cloud Skill 导出 SHALL 以故事名（而非单个角色名）作为 skill 身份，并以 `.skill` 归档文件形式产出。

#### Scenario: 命名基于故事名
- **WHEN** 导出 skill
- **THEN** skill 文件名 SHALL 为 `<kebab(storyName)>-in-<kebab(worldName)>.skill`
- **AND** 命名 SHALL 不依赖任何单一角色名
- **AND** kebab-case 转换 SHALL 保留中日韩 unicode 字符

#### Scenario: 多 Soul 子目录布局（归档内部）
- **WHEN** 导出多角色 skill
- **THEN** 归档内部 SHALL 包含 `souls/` 子目录
- **AND** 每个 soul 放在 `souls/<soul-name>/` 下，含 identity.md / style.md / capabilities.md / milestones.md / behaviors/
- **AND** world 放在 `world/` 子目录

#### Scenario: SKILL.md description 使用故事名
- **WHEN** 生成 SKILL.md frontmatter
- **THEN** description 字段 SHALL 使用 storyName 而非某个角色名
- **AND** SHALL 类似 "{storyName} — 在{worldDisplayName}中的视觉小说"

### Requirement: SKILL.md 引擎多角色调度
SKILL.md SHALL 包含多角色故事引擎的完整规则。

#### Scenario: Phase 1 多角色剧本生成
- **WHEN** 引擎进入 Phase 1
- **THEN** SHALL 读取 `souls/` 下所有 soul 目录的完整文件
- **AND** SHALL 按 story-spec.md 的 characters 定义生成多角色剧本

#### Scenario: Phase 2 多角色场景运行
- **WHEN** 引擎运行场景
- **THEN** SHALL 按场景 cast 表调度在场角色
- **AND** 每个角色的对话 SHALL 遵循对应 `souls/{name}/style.md`
- **AND** 用户选择后 SHALL 更新 per-character affinity 状态

#### Scenario: Phase 3 结局图鉴
- **WHEN** 故事到达结局
- **THEN** SHALL 展示结局演绎 + 旅程回顾 + 所有结局预览
- **AND** 旅程回顾 SHALL 按角色分组展示好感轴进度条

### Requirement: SKILL.md 视觉小说引擎模板

SKILL.md SHALL 作为视觉小说引擎的调度器 prompt，包含 YAML frontmatter 和分阶段运行指令。流程 SHALL 包含 Phase -1（剧本选择 + 加载验证）、Phase 0（长度与 Seeds 询问）、Phase 1（剧本生成与持久化，含 state_schema 创作）、Phase 2（剧本运行，使用 Edit 工具更新 state）、Phase 3（结局图鉴）。frontmatter `allowed-tools` SHALL 包含 `AskUserQuestion, Read, Write, Glob, Edit`。

#### Scenario: SKILL.md frontmatter
- **WHEN** SKILL.md 生成
- **THEN** frontmatter 的 `name` 字段 SHALL 使用 `<kebab(storyName)>-in-<kebab(worldName)>` 格式
- **AND** 包含 `description` 字段
- **AND** `allowed-tools` SHALL 是 `AskUserQuestion, Read, Write, Glob, Edit`

#### Scenario: Phase -1 剧本选择 + 验证
- **WHEN** Skill 被加载运行
- **THEN** SKILL.md SHALL 指示 Claude 先列出 `runtime/scripts/*.yaml`
- **AND** 加载某个 script 前 SHALL 执行四重验证（dangling / state_schema / initial_state / consequences 抽样）

#### Scenario: Phase 0 — 长度与 Seeds 询问
- **WHEN** Phase -1 决定生成新剧本
- **THEN** SKILL.md SHALL 指示 Claude 使用 AskUserQuestion 让用户从 acts_options 中选择剧本长度
- **AND** SHALL 询问"你想要一个怎样的故事？"收集 user_direction

#### Scenario: Phase 1 — 剧本生成与持久化（含 state_schema）
- **WHEN** Phase 0 完成
- **THEN** SKILL.md SHALL 指示 Claude 按顺序：设计 state_schema → 写 initial_state → 写 scenes → 写 endings → 自检 → Write
- **AND** Phase 1 章节 SHALL 含 state_schema 命名约束、类型集合、命名空间约定、endings DSL 语法
- **AND** Write 调用 SHALL 一次性写完整 script.yaml 到 `runtime/scripts/script-<id>.yaml`

### Requirement: 场景呈现规则

SKILL.md SHALL 定义场景呈现规则：旁白使用沉浸式第二人称描写；角色台词/动作根据场景指导即兴演绎，遵守 identity.md 人格和 style.md 表达方式；选项通过 AskUserQuestion 呈现。**所有产出的中文文本 SHALL 遵守 story-spec.md 的「叙事风格锚点」章节中的 forbidden_patterns（硬约束）和 ip_specific（术语规范）**。

#### Scenario: 标准场景输出

- **WHEN** Claude 运行到一个场景
- **THEN** SHALL 先输出旁白文本（遵守 prose_style 约束）
- **THEN** 输出角色的台词和动作（基于角色演出指导即兴表演，遵守 prose_style 约束）
- **THEN** 使用 AskUserQuestion 呈现 2-3 个选项

#### Scenario: 用户自由输入

- **WHEN** 用户不通过选项回复而是输入自由文本
- **THEN** Claude SHALL 作为角色在场景内回应该对话（遵守 prose_style 约束）
- **THEN** 再次使用 AskUserQuestion 呈现同一场景的选项（不跳转）

#### Scenario: prose_style 缺失场景
- **WHEN** story-spec.md 不含 prose_style 章节（向后兼容旧 export）
- **THEN** Claude SHALL 使用 story-spec.md 的「叙事风格锚点（fallback）」通用中文写作指引

### Requirement: SKILL.md 引用 prose_style 叙事风格锚点
SKILL.md Phase 1 创作步骤和 Phase 2 场景呈现规则 SHALL 引用 story-spec.md 的「叙事风格锚点」章节，把 ProseStyle.forbidden_patterns 当成写 narration / dialogue 的硬约束，把 ip_specific 当成本故事的术语规范。Phase 1 Step 5 自检流程 SHALL 新增一重 prose_style 反例对照自检（多角色引擎 Step 5.g；单角色引擎 Step 5.d）。

#### Scenario: Phase 1 创作引用 prose_style
- **WHEN** 生成 SKILL.md
- **THEN** Phase 1 章节 SHALL 在 Step 3 (写 scenes) 前明确指示："写 narration / dialogue 时，先 Read story-spec.md 的『叙事风格锚点』章节，逐条对照 forbidden_patterns 自检"
- **AND** Phase 1 Step 5 自检流程 SHALL 含一重 "prose_style 反例对照"

#### Scenario: Phase 2 场景呈现引用 prose_style
- **WHEN** 生成 SKILL.md
- **THEN** Phase 2 SHALL 含「叙事风格约束」段
- **AND** SHALL 列出度量从句 / 所有格排比 / 直译比喻 / 直译姿态 / 直译否定 五条最高频模式作为硬约束清单
- **AND** SHALL 引导 LLM 把 ip_specific 当成本故事的术语规范

#### Scenario: 缺 prose_style 的 fallback 渲染
- **WHEN** StorySpecConfig 不含 prose_style
- **THEN** story-spec.md SHALL 渲染「叙事风格锚点（fallback）」章节
- **AND** fallback 内容 SHALL 包含通用反例库中至少 5 条最高频条目

### Requirement: prose_style 在 character_voice_summary 存在时的引用
当 story-spec.md 的 prose_style 章节含 `character_voice_summary` 字段时，SKILL.md Phase 2 SHALL 指示 LLM 把对应角色的 character_voice_summary 作为该角色的优先中文声音锚点（高于 style.md 中可能存在的非目标语言原文）。

#### Scenario: 角色含 voice_summary
- **WHEN** prose_style.character_voice_summary["间桐桜"] 存在
- **THEN** SKILL.md Phase 2 SHALL 引导 LLM："演绎含 voice_summary 的角色时，优先使用 voice_summary 作为中文声音锚点；style.md 中的日文/英文台词作为补充事实参考"

#### Scenario: 角色无 voice_summary
- **WHEN** prose_style.character_voice_summary 中没有该角色
- **THEN** Phase 2 按原有方式直接使用 style.md

### Requirement: 幕间过渡规则

SKILL.md SHALL 定义幕间过渡规则：Act 切换时输出过渡旁白（氛围性文字 + 居中 Act 标题），然后通过 AskUserQuestion 呈现反思性选择。

#### Scenario: 幕间过渡

- **WHEN** 故事从 Act 1 推进到 Act 2
- **THEN** Claude SHALL 输出过渡文本块（使用 ━ 分隔线 + Act 标题 + 氛围旁白）
- **THEN** 使用 AskUserQuestion 呈现反思性选择（2-3 个情绪/思绪方向）
- **AND** 该选择不改变剧情走向，但影响下一幕开场时角色的态度/语气

### Requirement: 世界观补充规则

SKILL.md SHALL 指示 Claude 在场景涉及特定世界观知识时，读取 `${CLAUDE_SKILL_DIR}/world/entries/` 下的对应文件来补充细节。

#### Scenario: 场景涉及特定地点

- **WHEN** 场景提及某个世界观中的地点
- **THEN** Claude SHALL 读取 world/entries/ 中与该地点相关的条目
- **AND** 将细节自然融入旁白和角色对话中

### Requirement: 禁止事项

SKILL.md SHALL 明确禁止以下行为：不跳过场景、不编造剧本中没有的分支、不打破第四面墙、不在选项之外主动推进剧情。

#### Scenario: 违规行为约束

- **WHEN** 故事正在运行
- **THEN** Claude SHALL 严格遵循生成的剧本结构
- **AND** 不得跳过任何场景或自行创造未定义的分支

### Requirement: story-spec.md 剧本生成规约

story-spec.md SHALL 包含 YAML frontmatter（genre、tone、acts、endings_min、rounds）和结构化的剧本生成规约。规约定义结构要求、场景格式、叙事约束、角色约束、幕间过渡规则和禁止事项。

#### Scenario: story-spec.md 内容

- **WHEN** `package_skill` 生成 story-spec.md
- **THEN** frontmatter SHALL 包含 Export Agent 收集的 genre、tone、acts、endings_min、rounds 配置
- **AND** 规约 SHALL 包含场景格式定义（[narration]、[character]、[choices] 块）
- **AND** 规约 SHALL 包含角色约束（必须符合 soul/ 下的人格和风格文件）
- **AND** 规约 SHALL 包含叙事约束（选项必须产生实质分歧、结局之间有明显情感差异等）

#### Scenario: story-spec.md 包含 seeds 占位

- **WHEN** story-spec.md 生成
- **THEN** SHALL 包含 Seeds 段落说明，指示 Skill 运行时 Phase 0 收集的 seeds 应插入此处

### Requirement: story-spec.md 状态系统规约

story-spec.md SHALL 包含状态系统规约段落，指导 Phase 1 的 LLM 在生成剧本时定义状态追踪机制。规约内容包括：数值轴（2-3 个，范围 0-10，初始值 5，名称须反映 Soul 人格特征）、关键事件标记（3-5 个布尔值，标记关键剧情节点）、选项状态影响标注格式。

#### Scenario: story-spec.md 包含状态系统段落

- **WHEN** `package_skill` 生成 story-spec.md
- **THEN** SHALL 包含 `## 状态系统` 段落
- **AND** 段落中定义数值轴规则（2-3 个，范围 0-10，初始 5）
- **AND** 段落中定义关键事件标记规则（3-5 个布尔值）
- **AND** 段落中定义选项影响标注格式（如 `trust +1, shared_secret = true`）

### Requirement: story-spec.md 结局判定规约

story-spec.md SHALL 包含结局判定规约段落，定义结局条件格式。每个结局 SHALL 定义由数值阈值和事件标记组合构成的触发条件。条件按优先级排列，最后一个结局 SHALL 为无条件默认结局。

#### Scenario: story-spec.md 包含结局判定段落

- **WHEN** `package_skill` 生成 story-spec.md
- **THEN** SHALL 包含 `## 结局判定` 段落
- **AND** 要求每个结局定义触发条件
- **AND** 要求条件按优先级排列
- **AND** 要求最后一个结局为无条件默认

### Requirement: SKILL.md 状态追踪规则

SKILL.md 的 Phase 2 规则 SHALL 新增状态追踪指令：Claude 必须在内部上下文中维护一个状态对象（包含 axes 和 flags），每次用户做出选择后根据剧本标注更新状态，状态不向用户展示。

#### Scenario: 选择后更新状态

- **WHEN** 用户在场景中选择了一个选项
- **AND** 该选项标注了 `trust +1, understanding +1`
- **THEN** Claude SHALL 在内部将 trust 和 understanding 各加 1

#### Scenario: 状态对用户不可见

- **WHEN** 故事正在运行中
- **THEN** Claude SHALL 不在任何场景输出中展示状态数值或事件标记

### Requirement: SKILL.md 结局判定规则

SKILL.md SHALL 指示 Claude 在到达结局阶段时，根据累积状态匹配结局条件。按优先级从高到低检查，第一个满足的条件触发对应结局。

#### Scenario: 状态满足最高优先级结局

- **WHEN** 故事到达结局阶段
- **AND** trust ≥ 7 且 shared_secret = true（满足 Ending A 条件）
- **THEN** Claude SHALL 触发 Ending A

#### Scenario: 状态不满足任何特定条件

- **WHEN** 故事到达结局阶段
- **AND** 没有任何特定结局条件被满足
- **THEN** Claude SHALL 触发默认结局（最后一个）

### Requirement: SKILL.md 结局展示三段式

SKILL.md SHALL 指示 Claude 在到达结局时按以下顺序展示：
1. 结局旁白和角色演绎
2. 旅程回顾：展示最终状态数值（用文本进度条可视化）和触发的关键事件
3. 其他可能的结局：每个列出标题、触发条件概述、一句预览文字

#### Scenario: 结局展示完整内容

- **WHEN** 触发 Ending A
- **THEN** Claude SHALL 先输出 Ending A 的旁白和角色演绎
- **THEN** 输出旅程回顾（状态数值进度条 + 关键事件列表）
- **THEN** 输出其他可能结局（Ending B/C/D 的标题 + 条件 + 预览）

#### Scenario: 旅程回顾格式

- **WHEN** 展示旅程回顾
- **THEN** 每个数值轴 SHALL 显示为 `{轴名} {进度条} {当前值}/10` 格式
- **AND** 关键事件 SHALL 显示为 `{事件名} ✓` 或 `{事件名} ✗`

### Requirement: SKILL.md 重玩选项

结局展示完成后，SKILL.md SHALL 指示 Claude 使用 AskUserQuestion 提供两个选项："从头再来"和"结束故事"。"从头再来"语义 SHALL 为：复用当前 script，使用 Write 工具把 state.yaml 整体覆盖为 initial_state（这是允许使用 Write 的另一个例外），重新进入 Phase 2 第一个场景，**不**重新生成剧本。

#### Scenario: 从头再来
- **WHEN** 用户在结局后选择"从头再来"
- **THEN** Claude SHALL 用 Write 工具把 state.yaml 整体覆盖为当前 script 的 initial_state
- **AND** 用 Write 把 meta.yaml 的 current_scene 重置为 scenes[0].id
- **AND** SHALL 直接进入 Phase 2 第一个场景

#### Scenario: 结束故事
- **WHEN** 用户在结局后选择"结束故事"
- **THEN** 故事完结，不再输出任何内容

#### Scenario: 想换故事的用户
- **WHEN** 用户希望玩一个新剧本
- **THEN** SHALL 引导用户重启 skill 进入 Phase -1 菜单选择"生成新剧本"

### Requirement: Skill 产物为 .skill 归档文件
导出 skill 时，packageSkill SHALL 输出单一 `.skill` 后缀的 zip 归档文件，而非展开的目录。

#### Scenario: 输出文件命名
- **WHEN** 生成 skill 文件
- **THEN** 文件名 SHALL 为 `<kebab(storyName)>-in-<kebab(worldName)>.skill`
- **AND** SHALL 不包含 `soulkiller:` 前缀
- **AND** kebab-case 转换 SHALL 保留中日韩 unicode 字符

#### Scenario: 归档内部结构
- **WHEN** 解压 `.skill` 文件
- **THEN** 解压结果 SHALL 直接释放为以下结构（不嵌套额外的根目录）：
  - `SKILL.md`
  - `story-spec.md`
  - `souls/<soul-name>/identity.md`
  - `souls/<soul-name>/style.md`
  - `souls/<soul-name>/capabilities.md`（如存在）
  - `souls/<soul-name>/milestones.md`（如存在）
  - `souls/<soul-name>/behaviors/*.md`
  - `world/world.json`
  - `world/entries/*.md`

#### Scenario: 不再产出展开目录
- **WHEN** packageSkill 完成
- **THEN** 输出位置 SHALL **只有** `.skill` 文件
- **AND** SHALL 不创建任何同名展开目录
- **AND** SHALL 不创建任何临时目录残留

### Requirement: SKILL.md frontmatter name 不带前缀
SKILL.md 的 YAML frontmatter `name` 字段 SHALL 与归档文件名（去掉 `.skill` 后缀）一致，不包含 `soulkiller:` 协议前缀。

#### Scenario: name 字段内容
- **WHEN** 生成 SKILL.md
- **THEN** frontmatter `name` SHALL 等于 `<kebab(storyName)>-in-<kebab(worldName)>`
- **AND** SHALL 不包含 `soulkiller:` 前缀

### Requirement: Skill runtime 目录结构
`runtime/saves/` 不再使用固定 `slot-{1,2,3}` 布局。初始归档仅包含 `runtime/saves/.gitkeep`，运行时由 `state init` 按需创建 `<script-id>/auto/` 目录结构。`runtime/scripts/` 不变。

#### Scenario: 初始归档无 slot 目录
- **WHEN** skill 归档被解压
- **THEN** `runtime/saves/` 目录 SHALL 只包含 `.gitkeep`，不存在任何 `slot-*` 子目录

#### Scenario: 运行时按需创建
- **WHEN** `state init <script-id>` 首次调用
- **THEN** 系统 SHALL 创建 `runtime/saves/<script-id>/auto/` 目录

### Requirement: Phase -1 剧本选择菜单
Phase -1 菜单 SHALL 改为扁平化剧本列表设计：

**Step -1.1**: Glob `runtime/scripts/*.json` 解析所有剧本标题和 id。

**Step -1.2**: 对每个 script-id 调用 `state list <id>` 获取存档状态。

**Step -1.3**: 主菜单通过 AskUserQuestion 展示：
- 每个有 auto 存档的剧本显示为 `"<title> [🔄 <scene> · <relative-time>]"`
- 每个无存档的剧本显示为 `"<title> [无存档]"`
- 分隔线后追加 `"✨ 生成新剧本"` 和 `"📋 管理剧本"`

**Step -1.4**: 选中有存档的剧本后 → 子菜单（AskUserQuestion）：
- `"🔄 自动存档 — <scene> · <time>"` (auto)
- `"💾 手动存档 N — <scene> · <time>"` (每个 manual)
- `"🆕 从头重玩"`

**Step -1.4b**: 选中无存档的剧本 → 直接 `state init <id>` → Phase 2。

**Step -1.5**: 选中存档 → `state validate <id> [<save-type>] --continue` → Phase 2（从存档场景继续）。选择"从头重玩" → `state reset <id>` → Phase 2（从第一个场景开始）。

菜单不再包含旧的 5 选项结构（继续游戏 / 重玩某个剧本 / 重命名 / 删除 / 生成新剧本）。"重命名"和"删除"功能收入"📋 管理剧本"子菜单。

#### Scenario: 首次使用无剧本
- **WHEN** `runtime/scripts/` 为空
- **THEN** Phase -1 SHALL 跳过菜单，直接进入 Phase 0

#### Scenario: 有剧本且有存档
- **WHEN** 存在 2 个剧本，其中 1 个有 auto 存档
- **THEN** 主菜单 SHALL 展示 2 个剧本条目（一个带存档标注、一个标记"无存档"），加上"✨ 生成新剧本"和"📋 管理剧本"

#### Scenario: 选中有存档的剧本后展示存档子菜单
- **WHEN** 用户选中有 1 auto + 2 manual 存档的剧本
- **THEN** 子菜单 SHALL 展示 3 个存档选项和 1 个"🆕 从头重玩"选项

#### Scenario: 选中无存档的剧本直接开始
- **WHEN** 用户选中无存档的剧本
- **THEN** 系统 SHALL 调用 `state init` 并直接进入 Phase 2

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
SKILL.md Phase 1 SHALL 在现有 Step 1 (设计 state_schema) 之前新增 **Step 0: 数据加载报告**。LLM 在 Step 0 SHALL 完成所有 Read 调用，然后输出一个结构化的加载报告（markdown table 或等效格式），列出每个角色的每个文件 + 行数 + world 文件的读取状态。只有 Step 0 报告完整后才能进入 Step 1。Phase 1 创作流程的整体顺序因此变为 **Step 0 - Step 7**（8 个步骤）。

#### Scenario: Step 0 报告内容
- **WHEN** 生成 SKILL.md
- **THEN** Phase 1 章节 SHALL 在 Step 1 之前含一个 "Step 0: 数据加载报告" 段
- **AND** SHALL 说明报告必须以结构化格式列出每个文件的路径 + 行数
- **AND** SHALL 说明 `(not present)` 用来标记真实不存在的 optional 文件

#### Scenario: Step 0 作为 Step 1 硬门槛
- **WHEN** 生成 SKILL.md
- **THEN** Step 1 的开头 SHALL 含一句 "如果你没有先输出 Step 0 加载报告，立刻停下来回去做 Step 0"
- **AND** Step 0 的说明 SHALL 明确 "这个报告是给你自己用的 planning 输出，不需要向用户展示对话内容"

#### Scenario: Phase 1 创作流程共 8 步
- **WHEN** 生成 SKILL.md
- **THEN** Phase 1 章节 SHALL 明确列出 Step 0 → Step 1 → Step 2 → Step 3 → Step 4 → Step 5 → Step 6 → Step 7 的顺序
- **AND** Step 0 SHALL 是数据加载报告（新增）
- **AND** Step 1 SHALL 依赖 Step 0 完成

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

### Requirement: Phase 2 LLM trained-default 行为抑制
SKILL.md Phase 2 SHALL 明确禁止 LLM 的 4 类 chatbot 训练默认行为：(1) 控制流自暂停（"要继续吗"、"回复过长"、AskUserQuestion 混入 "继续/状态/存档" 伪菜单）；(2) 进度/存档暴露（"第 N 幕"、scene ID、"存档已保存至 slot-X"）；(3) 聊天机器人式元叙述（"以上是 X，接下来让我..."）；(4) 选项标签污染（在 choices 文本后加 "(友善路线)" 之类后缀）。「禁止事项」段 SHALL 以这 4 个分类重组，每条规则引用具体反例文字。「场景流转规则」段 SHALL 声明 apply_consequences → 渲染下一场景为**同一个原子动作**，并显式枚举"你只在 3 种情况下停止渲染"（场景末 AskUserQuestion / 自由文本回应后 AskUserQuestion / ending 节点）。

#### Scenario: 禁止事项 5 分类结构
- **WHEN** 生成 SKILL.md
- **THEN** Phase 2 的「禁止事项」段 SHALL 分为：剧情结构 / 控制流自暂停 / 进度存档暴露 / 聊天机器人式元叙述 / 选项标签污染
- **AND** SHALL 在控制流自暂停类别下明确禁止 "要继续吗" 和 "回复过长"
- **AND** SHALL 在进度存档暴露类别下明确禁止 "第三幕中段"、scene ID、"slot-X" 等字样
- **AND** SHALL 在选项标签污染类别下明确禁止 "(友善路线)" 之类后缀

#### Scenario: 场景流转规则声明原子动作
- **WHEN** 生成 SKILL.md
- **THEN** Phase 2「场景流转规则」SHALL 含 "你只在 3 种情况下停止渲染" 子段
- **AND** SHALL 列出 3 种合法停止点：场景末 AskUserQuestion、自由文本回应后 AskUserQuestion、ending
- **AND** SHALL 声明 "apply_consequences → 渲染下一场景是**同一个原子动作**"
- **AND** SHALL 明确 "连续渲染多个场景是**正常行为**"

#### Scenario: AskUserQuestion options 逐字复制
- **WHEN** 生成 SKILL.md
- **THEN** Phase 2 SHALL 明确 AskUserQuestion 的 options 必须是剧本 choices[i].text 的逐字复制
- **AND** SHALL 禁止混入 "继续/状态/存档/下一步" 等控制流选项

### Requirement: 存档结构与 script 关联
存档 SHALL 按 script-id 组织在 `runtime/saves/<script-id>/` 下，包含 `auto/` 子目录（自动存档）和 `manual/` 子目录（手动存档）。每个存档目录包含 `meta.yaml`（script_ref, current_scene, last_played_at）和 `state.yaml`（状态数据）。

删除剧本时 SHALL 级联删除 `runtime/saves/<script-id>/` 整个目录。

#### Scenario: 存档与剧本的 1:N 关系
- **WHEN** 剧本 a3f9c2e1 有 auto 和 2 个 manual 存档
- **THEN** 存档 SHALL 位于 `runtime/saves/a3f9c2e1/auto/`、`runtime/saves/a3f9c2e1/manual/<ts1>/`、`runtime/saves/a3f9c2e1/manual/<ts2>/`

#### Scenario: 删除剧本级联清理
- **WHEN** 用户删除剧本 a3f9c2e1
- **THEN** `runtime/saves/a3f9c2e1/` 整个目录 SHALL 被删除

### Requirement: Phase 2 手动存档选项
Phase 2 的每个 AskUserQuestion 选项列表末尾 SHALL 追加一个固定选项 `💾 保存当前进度`。此选项不属于 script.json 的 choices 定义，由 LLM 运行时注入。

选择此选项时：
1. 调用 `state save <script-id>`
2. 成功 → 输出确认 → 重新弹出相同 AskUserQuestion（含原始选项 + 💾）
3. `MANUAL_SAVE_LIMIT_REACHED` → 展示覆盖菜单 → 用户选择后覆盖 → 确认 → 重弹原选项

此选项不触发 `state apply`，不推进剧情，不消耗回合。

#### Scenario: 正常保存流程
- **WHEN** 用户选择"💾 保存当前进度"且手动存档未满
- **THEN** 系统 SHALL 创建手动存档，确认成功，然后重新弹出完全相同的选择点

#### Scenario: 存档满时覆盖流程
- **WHEN** 用户选择"💾 保存当前进度"且手动存档已有 3 个
- **THEN** 系统 SHALL 展示覆盖菜单让用户选择，覆盖后确认成功，然后重弹原选项

#### Scenario: 保存不影响剧情
- **WHEN** 用户在某选择点保存 2 次后选择了剧情选项 A
- **THEN** 剧情 SHALL 按选项 A 正常推进，2 次保存不产生任何剧情副作用

### Requirement: 剧本重命名能力
Phase -1 菜单 SHALL 允许用户重命名已生成的剧本。重命名仅修改剧本 frontmatter 的 `title` 字段，不修改文件名（文件名仍是 `script-<id>.yaml`）。

#### Scenario: 用户重命名剧本
- **WHEN** 用户在 Phase -1 菜单选择"重命名剧本"
- **THEN** Claude SHALL 列出所有剧本让用户选一个
- **AND** SHALL 询问新标题
- **AND** SHALL 用 Read 工具读取目标剧本，修改 frontmatter 的 `title` 字段
- **AND** SHALL 用 Write 工具写回原文件
- **AND** 完成后回到 Phase -1 菜单

### Requirement: 损坏剧本文件的容错
当 Phase -1 解析某个 `.yaml` 文件失败时，SKILL.md SHALL 指示 Claude 跳过该文件并标记为损坏，不阻塞其他剧本的列出。

#### Scenario: 解析失败时跳过
- **WHEN** Phase -1 解析某剧本的 frontmatter 失败
- **THEN** Claude SHALL 在菜单中标记该文件为「(损坏)」
- **AND** SHALL 在该项下提供"删除"操作
- **AND** SHALL 继续列出其他正常剧本

### Requirement: SKILL.md 声明文件工具依赖
SKILL.md frontmatter 的 `allowed-tools` 字段 SHALL 包含 `Read`、`Write`、`Glob`（或等价的目录列出工具），以便引擎执行剧本持久化。

#### Scenario: allowed-tools 字段内容
- **WHEN** 生成 SKILL.md frontmatter
- **THEN** `allowed-tools` SHALL 列出 `AskUserQuestion`、`Read`、`Write`、`Glob`
- **AND** 这些工具是 Phase -1/1 操作 runtime 目录的最小依赖集合

### Requirement: SKILL.md frontmatter `name` 字段 ASCII slug
SKILL.md frontmatter 的 `name` 字段 SHALL 严格遵守 Anthropic Skill 官方 spec：

- 只允许小写字母 / 数字 / 连字符
- 长度 1-64 字符
- 不允许首尾连字符或连续连字符
- 必须匹配正则 `^[a-z0-9]+(-[a-z0-9]+)*$`
- 必须与归档顶层目录名一致

packager SHALL 自动把用户输入的 storyName / worldName 通过 formatter sluglify 成合规字符串。如果输入纯 CJK 等无法产生 ASCII 内容时，formatter SHALL 用 deterministic hash 生成 fallback slug（如 `skill-<8位hash>`）。

#### Scenario: 纯 ASCII 输入
- **WHEN** storyName 为 "v-relic-story"，worldName 为 "cyberpunk-2077"
- **THEN** name 字段 SHALL 为 `v-relic-story-in-cyberpunk-2077`

#### Scenario: 含 CJK 字符的输入被 sluglify
- **WHEN** storyName 为 "FSN伊莉雅线"，worldName 为 "Fate Stay Night"
- **THEN** name 字段 SHALL 仅含 ASCII 小写 / 数字 / 连字符
- **AND** SHALL 匹配 `^[a-z0-9]+(-[a-z0-9]+)*$`

#### Scenario: 全 CJK 输入 fallback 到 hash
- **WHEN** storyName 为 "伊莉雅线"，worldName 为 "命运长夜"
- **THEN** name 字段 SHALL 不为空
- **AND** SHALL 匹配 `^[a-z0-9]+(-[a-z0-9]+)*$`
- **AND** SHALL 是 deterministic 的（相同输入产生相同 slug）

#### Scenario: 长度限制
- **WHEN** sluglify 后超过 64 字符
- **THEN** SHALL 截断到 64 字符内，且不以连字符结尾

### Requirement: Skill 归档顶层目录嵌套
导出的 `.skill` 归档 SHALL 把所有内容嵌套在一个跟 frontmatter `name` 字段同名的顶层目录下。例如 name=`fsn-illya-route-in-fate-stay-night` 时，归档结构为：

```
fsn-illya-route-in-fate-stay-night/
├── SKILL.md
├── story-spec.md
├── souls/
├── world/
└── runtime/
```

而非把 `SKILL.md` 直接放在 zip 根。这是 Anthropic Skill spec 的硬性要求——personal skills 安装路径是 `~/.claude/skills/<name>/SKILL.md`。

#### Scenario: 归档顶层目录
- **WHEN** 解压 `.skill` 文件
- **THEN** 顶层 SHALL 只有一个目录条目，名字 == frontmatter `name` 字段
- **AND** SKILL.md SHALL 位于 `<name>/SKILL.md`
- **AND** 不存在与 `name` 不同的顶层目录或文件

### Requirement: 归档内文件路径 ASCII
归档内的所有文件路径 SHALL 只含 ASCII 字符（小写字母 / 数字 / 连字符 / 下划线 / 点 / 斜杠）。souls 子目录用 character slug 而非原始角色名。

#### Scenario: souls 子目录路径
- **WHEN** 一个角色名为 "伊莉雅丝菲尔·冯·爱因兹贝伦"
- **THEN** 归档中对应的路径 SHALL 不含任何 CJK 字符
- **AND** 类似 `<skill-name>/souls/<slug>/identity.md`

#### Scenario: 角色 slug 与 SKILL.md 路径引用一致
- **WHEN** packager 把角色映射为 slug 后写入归档
- **THEN** 生成的 SKILL.md 中所有 `souls/.../...` 路径引用 SHALL 使用同一个 slug
- **AND** SKILL.md 顶部 SHALL 包含一个角色路径映射表，让 LLM 知道每个原始角色名对应哪个 slug

### Requirement: SKILL.md frontmatter 含 Edit 工具
SKILL.md frontmatter 的 `allowed-tools` 字段 SHALL 包含 `Bash`，作为调用 `runtime/bin/state` wrapper 的执行工具。完整 allowed-tools 列表 SHALL 是 `AskUserQuestion Read Write Glob Edit Bash`，使用 Anthropic spec 要求的**空格分隔格式**（不是逗号分隔）。

`Edit` 和 `Write` 保留在 allowed-tools 中，用于 script.yaml 的生成（Phase 1）和非 state 文件的编辑，但 SHALL NOT 被用于修改 `state.yaml` 或 `meta.yaml`。

#### Scenario: frontmatter Bash 工具声明
- **WHEN** 生成 SKILL.md
- **THEN** frontmatter `allowed-tools` SHALL 包含 `Bash`
- **AND** 同时包含 `AskUserQuestion`、`Read`、`Write`、`Glob`、`Edit`
- **AND** 多个工具之间 SHALL 用单个空格分隔，**不使用逗号**

#### Scenario: Bash 工具用途限定
- **WHEN** SKILL.md 的 Phase 2 章节描述 state 更新
- **THEN** SHALL 指示 LLM 只通过 `bash runtime/bin/state <subcommand>` 修改 state/meta
- **AND** SHALL 明确禁止用 Edit 或 Write 直接修改 state.yaml 和 meta.yaml

### Requirement: Skill 归档前 formatter 自动修复
packager SHALL 在生成 SKILL.md 内容和写入归档之前，对所有 spec deterministic 可修复的违规自动 format：

- frontmatter `name` 字段：自动 sluglify
- 角色路径：自动 sluglify
- `allowed-tools`：从内部表示（数组）格式化为空格分隔字符串
- 归档顶层：自动包一层 `<name>/` 目录

formatter 是 packager 内部行为，作者无需了解。lint 报告只列出 formatter 无法修复的非 deterministic 问题（如 schema key 拼写错位）。

#### Scenario: formatter 透明工作
- **WHEN** 用户传入 `storyName: "FSN伊莉雅线"` `worldName: "Fate Stay Night"` 给 packager
- **THEN** packager SHALL 内部计算合规 slug
- **AND** 生成的归档完全符合 Anthropic spec
- **AND** 用户无需在 export UI 中手动输入英文名

#### Scenario: lint 仍然抓非 deterministic 问题
- **WHEN** SKILL.md 模板里某个 yaml 示例的 schema key 含拼写错位（如 `affinity.judy.trsut`）
- **THEN** lint 仍然 SHALL 报告该问题（因为 formatter 无法判断正确拼写）
- **AND** 不阻塞 export，但写入 stderr 报告

### Requirement: Phase 1 创作流程严格定步
SKILL.md Phase 1 章节 SHALL 明确指示 LLM 按以下顺序创作 script.yaml：
1. 设计 state_schema（基于 story-spec 的 CharacterSpec.axes 和剧本需要的 flags）
2. 写 initial_state（字段集严格 == schema 字段集，每个值取自 schema.default）
3. 写 scenes（consequences key 必须 copy 自 schema 字面 key）
4. 写 endings（condition 用结构化 DSL；最后一个必须是 default 兜底）
5. 自检（列出 scenes/endings 引用的所有 key，对照 schema 字面比对）
6. 自检通过 → Write 整个 script.yaml
7. 输出确认 + 进入 Phase 2

#### Scenario: Phase 1 章节包含完整步骤
- **WHEN** 生成 SKILL.md
- **THEN** Phase 1 章节 SHALL 明确包含上述 7 个步骤的描述
- **AND** 每步对应的指令（Read/Write/自检 等）SHALL 清晰

#### Scenario: 自检失败时重写
- **WHEN** Phase 1 LLM 完成 Step 5 自检发现引用错误
- **THEN** SKILL.md 指示 LLM 回到 Step 3 重写对应 scene/ending，再次自检

### Requirement: Phase 2 场景流转用 Edit + 标准伪代码
SKILL.md Phase 2「场景流转规则」章节 SHALL 指示 LLM 通过 `bash runtime/bin/state apply <slot> <scene-id> <choice-id>` 完成 consequences 应用，**不再**手动执行 delta 计算或 Edit 操作。LLM 的职责限定为：

1. 接收用户的选择（choice id）
2. 调用 `state apply` 命令
3. 读取命令的 stdout（结构化变更摘要）用于渲染下一场景的过渡叙述
4. 渲染下一场景

consequences 的 delta 计算、clamp、enum 校验、state.yaml + meta.yaml 的写入 SHALL 全部由 `state apply` 脚本内部完成，LLM SHALL NOT 参与。

#### Scenario: Phase 2 段落命令形态
- **WHEN** 生成 SKILL.md
- **THEN** Phase 2 章节 SHALL 含至少一个 `bash runtime/bin/state apply` 的完整示例
- **AND** SHALL NOT 含"Edit state.yaml"形态的指令

#### Scenario: LLM 不算 delta
- **WHEN** Phase 2 章节描述状态转移
- **THEN** SHALL 明示 "LLM 不再计算 consequences delta，全部由脚本完成"
- **AND** SHALL NOT 含"查 state_schema[key] 拿 type → 按 type 计算新值"这类伪代码

#### Scenario: 禁止 Edit/Write state.yaml
- **WHEN** Phase 2 章节描述状态更新
- **THEN** SHALL 明确指示"不要用 Edit 或 Write 直接修改 state.yaml 或 meta.yaml"
- **AND** SHALL 说明"所有状态写入必须通过 state init/apply/reset/rebuild"

### Requirement: Phase -1 四重加载验证
SKILL.md Phase -1 章节 SHALL 通过调用 `bash runtime/bin/state validate <slot>` 执行加载时验证。脚本返回 JSON 诊断，LLM 根据诊断进入修复菜单或继续加载。

`state validate` 内部实现六重校验（沿用原有语义）：

1. **dangling reference 检查**：meta.yaml.script_ref 指向的 script 文件必须存在
2. **state_schema 完整性**：script.yaml 顶部必须含 state_schema 块
3. **initial_state 字段集对齐**：initial_state 字段集必须 == state_schema 字段集
4. **scenes consequences 抽样**：抽样 5 个 scene，每个 consequences key 必须存在于 state_schema
5. **共享 axes 完整性**：每个角色必须有完整的 3 个共享 axes（bond + story_state.shared_axes_custom 中的 2 个）
6. **flags 集合一致性**：script.state_schema 中所有 `flags.<name>` 字段的 name 集合必须严格等于 story_spec.flags 的 name 列表

「继续游戏」额外验证：

7. **state.yaml 字段集对齐**：state.yaml 字段集必须 == state_schema 字段集；不对齐 → LLM 弹「修复菜单」

`state validate` SHALL NOT 自动修复——它只返回诊断 JSON。修复动作由 LLM 通过 AskUserQuestion 驱动，可选动作可能调用 `state rebuild` 或 `state reset`。

#### Scenario: 验证调用形态
- **WHEN** Phase -1 加载存档
- **THEN** SKILL.md 指示 LLM 执行 `bash runtime/bin/state validate <slot>`
- **AND** 读取命令 stdout 解析 JSON
- **AND** 根据 `errors` 数组决定下一步

#### Scenario: dangling 检查
- **WHEN** Phase -1 选择某个存档
- **AND** 该存档的 meta.yaml.script_ref 指向的 script 文件不存在
- **THEN** `state validate` stdout 返回 `errors` 含 `code: DANGLING_SCRIPT_REF`
- **AND** SKILL.md 指示 LLM 标该存档为 (孤儿)，提供"删除存档"入口

#### Scenario: legacy hard fail
- **WHEN** 用户选择某个 script
- **AND** 该 script.yaml 顶部没有 state_schema 块
- **THEN** `state validate` 返回 `errors` 含 `code: STATE_SCHEMA_MISSING`
- **AND** SKILL.md 指示 LLM 标该 script 为 (legacy 不可重玩)

#### Scenario: 共享 axes 不完整
- **WHEN** 加载某 script，story_state.shared_axes_custom = ["trust", "rivalry"]
- **AND** 某角色的 state_schema 只含 `affinity.<char>.bond` 和 `affinity.<char>.trust`（缺 rivalry）
- **THEN** `state validate` 返回 `code: SHARED_AXES_INCOMPLETE`
- **AND** SKILL.md 指示 LLM 标 (损坏)

#### Scenario: Flags 集合不匹配
- **WHEN** script.state_schema 含 `flags.some_random_flag` 但 story_spec.flags 中没有该 name
- **THEN** `state validate` 返回 `code: FLAGS_SET_MISMATCH`

#### Scenario: 继续游戏 state 字段集修复菜单
- **WHEN** 「继续游戏」时 state.yaml 缺一个 schema 字段
- **THEN** `state validate` 返回 `code: FIELD_MISSING`
- **AND** SKILL.md 指示 LLM 弹出修复菜单
- **AND** 选项包含「补缺失字段为 default（调用 state rebuild）」「完全重置（调用 state reset）」「取消加载」

### Requirement: 重玩规则使用 Write 重置
SKILL.md「重玩当前剧本」流程 SHALL 使用 `bash runtime/bin/state reset <slot>` 把存档重置到 `initial_state`。LLM SHALL NOT 使用 `Write` 工具直接覆盖 state.yaml 或 meta.yaml。

#### Scenario: 重玩 → state reset
- **WHEN** 用户在 Phase -1 菜单选「重玩某剧本」
- **THEN** SKILL.md 指示 LLM 执行 `bash runtime/bin/state reset <slot>`
- **AND** 脚本内部从 script.initial_state 一次性重建 state.yaml
- **AND** 脚本内部把 meta.yaml.current_scene 重置为 scenes[0].id
- **AND** 进入 Phase 2 第一个场景

### Requirement: SKILL.md 引用 state_schema 创作约束

SKILL.md Phase 1 章节 SHALL 包含 state_schema 的命名约束、**三层结构**（共享 axes / 角色特异 axes / flags）、类型集合、字段元信息要求、命名空间约定，作为 LLM 写 schema 时的参考。Phase 1 LLM **必须**严格遵守：

- 每个角色必须有完整的 3 个共享 axes（`bond` + story_state.shared_axes_custom 里的 2 个）
- 每个角色可额外有 0-2 个特异 axes
- `flags.<name>` 字段集合必须等于 story_spec.flags 的 name 列表，**不能增删或改名**

#### Scenario: 命名约束在 Phase 1 章节
- **WHEN** 生成 SKILL.md
- **THEN** Phase 1 章节 SHALL 明确说明 schema key 必须 ASCII / snake_case / dot 分隔 / 带引号

#### Scenario: 三层结构在 Phase 1 章节
- **WHEN** 生成 SKILL.md
- **THEN** Phase 1 章节 SHALL 清晰说明共享 axes 层（bond + 2 story-defined）
- **AND** SHALL 说明角色特异 axes 层（0-2 个/角色）
- **AND** SHALL 说明 flags 层 —— "flags 必须从 story_spec.flags 逐条 copy，不能创造新 flag"

#### Scenario: 类型集合在 Phase 1 章节
- **WHEN** 生成 SKILL.md
- **THEN** Phase 1 章节 SHALL 列出四种合法 type：`int / bool / enum / string`

#### Scenario: 命名空间约定
- **WHEN** 生成 SKILL.md
- **THEN** Phase 1 章节 SHALL 推荐 affinity / flags / custom 三个命名空间前缀
- **AND** 说明系统不解析这些前缀，纯命名约定

### Requirement: SKILL.md 引用 endings DSL 语法

SKILL.md Phase 1 章节 SHALL 包含 endings condition 结构化 DSL 的完整语法说明，**包含跨角色聚合 primitive**。除了现有的比较节点和布尔组合节点外，DSL SHALL 支持 `all_chars` 和 `any_char` 聚合节点。

#### Scenario: DSL 语法在 Phase 1 章节
- **WHEN** 生成 SKILL.md
- **THEN** Phase 1 章节 SHALL 包含至少一个 endings condition 的 DSL 示例
- **AND** SHALL 列出支持的算子 `>= / <= / > / < / == / !=`
- **AND** SHALL 列出支持的逻辑节点 `all_of / any_of / not`
- **AND** SHALL 列出跨角色聚合节点 `all_chars / any_char`，含可选 `except` 字段
- **AND** SHALL 说明 `condition: default` 兜底语义

#### Scenario: 聚合节点 axis 限制
- **WHEN** 生成 SKILL.md
- **THEN** Phase 1 章节 SHALL 明确 `all_chars` / `any_char` 节点的 `axis` 字段只能引用共享 axes（bond 或 story_state.shared_axes_custom 中的 2 个），不能引用角色特异 axes

### Requirement: 模板 lint 在 export 末尾运行
soulkiller export 流程 SHALL 在生成 .skill 归档之后调用 `lintSkillTemplate(skillContent)` 函数对 SKILL.md 模板做静态检查。lint 失败 SHALL 输出报告但**不阻塞** export（软警告，由作者自审）。

lint 检查范围：
1. SKILL.md 模板中给 LLM 的 yaml 示例能 yaml.parse 通过
2. SKILL.md 模板中所有 schema 示例字段名命名一致（snake_case + dot + ASCII）
3. story-spec.md 中 CharacterSpec.axes 命名跟 SKILL.md 模板里 schema 示例的 affinity 命名空间一致
4. SKILL.md 模板中所有 placeholder 格式一致

#### Scenario: lint 通过
- **WHEN** export 生成的 SKILL.md 模板符合所有 lint 规则
- **THEN** lint 报告 `ok: true`，export 正常完成

#### Scenario: lint 警告但 export 通过
- **WHEN** SKILL.md 模板中某个 yaml 示例无法 parse
- **THEN** lint 报告 `ok: false` + 错误清单
- **AND** export **仍然完成**（生成 .skill 归档）
- **AND** 错误清单输出到 stderr 让作者审

#### Scenario: lint 不依赖外部工具
- **WHEN** lint 函数运行
- **THEN** 不调用任何子进程
- **AND** 不依赖 npm install 的运行时包之外的工具

### Requirement: Phase -1 Step 0 doctor 健康检查
SKILL.md Phase -1 章节 SHALL 在所有其他 Phase -1 逻辑之前插入 **Step 0：Runtime 健康检查**。这一步通过 `bash runtime/bin/state doctor` 调用 doctor.sh，根据返回的结构化 stdout 决定后续流程。

可能的分支：

- `STATUS: OK` → 继续正常 Phase -1 流程
- `STATUS: BUN_MISSING` → 触发首次 bootstrap 引导（AskUserQuestion 三档选项）
- `STATUS: BUN_OUTDATED` → 提示用户升级 bun，继续 bootstrap 引导
- `STATUS: PLATFORM_UNSUPPORTED` → 告知用户切换到 WSL，进入只读模式或退出
- `STATUS: PLATFORM_UNKNOWN` → 进入只读模式

#### Scenario: Step 0 存在
- **WHEN** 生成 SKILL.md
- **THEN** Phase -1 章节 SHALL 在任何存档列表 / 新建剧本逻辑之前包含 Step 0
- **AND** Step 0 SHALL 指示 LLM 调用 `bash runtime/bin/state doctor`

#### Scenario: BUN_MISSING 触发三档 AskUserQuestion
- **WHEN** doctor 返回 `STATUS: BUN_MISSING`
- **THEN** SKILL.md 指示 LLM 用 AskUserQuestion 呈现三档选项：
  - "我来帮你装" → LLM 调 Bash 执行 install 命令
  - "我自己装，告诉我命令" → 展示命令等待用户外部执行
  - "取消" → 进入只读模式
- **AND** AskUserQuestion 的 question body SHALL 含完整 curl 命令、bun.sh 官方链接、安装目录、大小预估、卸载说明

#### Scenario: 平台不支持进入只读
- **WHEN** doctor 返回 `STATUS: PLATFORM_UNSUPPORTED`
- **THEN** SKILL.md 指示 LLM 告知 "本 skill 需要在 Unix-like 环境运行，请切换到 WSL"
- **AND** 提供只读模式入口（查看已有存档和结局图鉴）

### Requirement: runtime 目录平台范围声明
SKILL.md 顶部（frontmatter 之后、Phase -1 之前）SHALL 包含一段平台范围声明，明示 skill 需要 Unix-like 环境，Windows 原生 shell 不支持，推荐 WSL。

#### Scenario: 平台范围声明存在
- **WHEN** 生成 SKILL.md
- **THEN** 文件 SHALL 在 Phase -1 之前包含至少一段关于平台要求的说明
- **AND** SHALL 明确列出支持的平台：macOS / Linux / Windows+WSL
- **AND** SHALL 明确不支持：Windows 原生 cmd / PowerShell / Git Bash

### Requirement: Phase 1 剧本文件使用 JSON 格式
SKILL.md Phase 1 章节 SHALL 指示 LLM 把生成的剧本写入 `runtime/scripts/script-<id>.json`（而非 `.yaml`）。文件内容 SHALL 是合法 JSON，通过 `JSON.parse` 解析。Phase 1 模板中展示的所有 script 示例 SHALL 使用 JSON 语法。

#### Scenario: Phase 1 Write 到 .json 路径
- **WHEN** Phase 1 LLM 完成 script 创作
- **THEN** SKILL.md 指示 LLM 用 Write 工具写入 `runtime/scripts/script-<id>.json`
- **AND** SHALL NOT 写入任何 `.yaml` 路径

#### Scenario: Phase 1 模板展示 JSON 示例
- **WHEN** 生成 SKILL.md
- **THEN** Phase 1 章节的 script 结构示例 SHALL 是合法 JSON
- **AND** SHALL NOT 含 yaml 特有语法（`-` 序列、block scalar、裸 key）

#### Scenario: Phase -1 列举 .json
- **WHEN** Phase -1 列出已有剧本
- **THEN** SKILL.md 指示 LLM glob `runtime/scripts/*.json`
- **AND** SHALL NOT glob `*.yaml`

### Requirement: packager 打包 runtime/bin 和 runtime/lib
packager SHALL 在生成 skill 归档时自动注入 `runtime/bin/state`、`runtime/bin/doctor.sh` 和 `runtime/lib/` 下所有 `src/export/state/*.ts` 文件。注入的文件内容 SHALL 与 Soulkiller 源码中的版本字节相同。

#### Scenario: 归档含完整 runtime
- **WHEN** 执行 export 生成 skill 归档
- **THEN** 归档 SHALL 包含 `runtime/bin/state` 和 `runtime/bin/doctor.sh`
- **AND** 包含 `runtime/lib/main.ts` / `apply.ts` / `init.ts` / `validate.ts` / `rebuild.ts` / `reset.ts` / `schema.ts` / `mini-yaml.ts`

#### Scenario: runtime 文件可执行位
- **WHEN** 归档被解压
- **THEN** `runtime/bin/state` 和 `runtime/bin/doctor.sh` SHALL 有可执行位（归档内保留 mode 0755 或由 SKILL.md 指示 `chmod +x`）

### Requirement: expectedFileCount 排除 runtime 代码
packager 在 Phase 1 上下文预算锚点（`expectedFileCount` / `expectedTextSizeKb`）计算中 SHALL 排除 `runtime/bin/` 和 `runtime/lib/` 下的所有文件。这些是运行时代码，不属于 Phase 1 LLM 需要读取的创作素材。

#### Scenario: 预算不含 runtime
- **WHEN** packager 计算 `expectedFileCount`
- **THEN** runtime/bin/ 和 runtime/lib/ 下的文件 SHALL 不被计入
- **AND** 只计入 characters/ / world/ / story-spec.md / SKILL.md 等创作素材

