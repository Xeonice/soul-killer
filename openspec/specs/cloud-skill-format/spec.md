# Cloud Skill Format

Cloud Skill 导出产物格式定义，包括目录结构、SKILL.md 模板（视觉小说引擎）和 story-spec.md（剧本生成规约）。

## ADDED Requirements

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

SKILL.md SHALL 作为视觉小说引擎的调度器 prompt，包含 YAML frontmatter 和分阶段运行指令。流程 SHALL 包含 Phase -1（剧本选择）、Phase 0（长度与 seeds 询问）、Phase 1（剧本生成与持久化）、Phase 2（剧本运行）、Phase 3（结局图鉴）。Phase 1 SHALL 在剧本生成后通过 Write 工具持久化剧本到 `runtime/scripts/`。Phase 1 SHALL 读取 capabilities.md 和 milestones.md。

#### Scenario: SKILL.md frontmatter
- **WHEN** SKILL.md 生成
- **THEN** frontmatter 的 `name` 字段 SHALL 使用 `<kebab(storyName)>-in-<kebab(worldName)>` 格式（不含 `soulkiller:` 前缀）
- **AND** 包含 `description` 字段
- **AND** `allowed-tools` SHALL 包含 `AskUserQuestion`、`Read`、`Write`、`Glob`

#### Scenario: Phase -1 — 剧本选择
- **WHEN** Skill 被加载运行
- **THEN** SKILL.md SHALL 指示 Claude 先列出 `${CLAUDE_SKILL_DIR}/runtime/scripts/*.yaml`
- **AND** 根据结果走"无剧本→Phase 0"或"有剧本→展示菜单"分支

#### Scenario: Phase 0 — 长度与 Seeds 询问
- **WHEN** Phase -1 决定生成新剧本
- **THEN** SKILL.md SHALL 指示 Claude 使用 AskUserQuestion 让用户从 acts_options 中选择剧本长度
- **AND** SHALL 询问"你想要一个怎样的故事？"收集 user_direction（可选）

#### Scenario: Phase 1 — 剧本生成与持久化
- **WHEN** Phase 0 完成
- **THEN** SKILL.md SHALL 指示 Claude 读取 souls/、world/entries/、story-spec.md
- **AND** 基于 user_direction 和长度选择生成完整剧本
- **AND** 生成完成后 SHALL 调用 Write 工具将剧本以 YAML 格式写入 `${CLAUDE_SKILL_DIR}/runtime/scripts/script-<id>.yaml`
- **AND** 写入完成后 SHALL 向用户输出确认信息
- **AND** SHALL 进入 Phase 2

#### Scenario: Phase 1 读取新文件
- **WHEN** Skill 运行 Phase 1
- **THEN** SHALL 读取每个 soul 的 `capabilities.md`（如存在）
- **AND** 读取每个 soul 的 `milestones.md`（如存在）
- **AND** 将能力信息和时间线纳入剧本生成的参考材料

#### Scenario: Phase 2 — 视觉小说交互循环

- **WHEN** Phase 1 完成
- **THEN** SKILL.md SHALL 指示 Claude 从第一个场景开始运行故事
- **AND** 每个场景输出旁白文本（第二人称沉浸式）+ 角色演绎
- **AND** 使用 AskUserQuestion 呈现场景选项
- **AND** 用户选择后跳转到对应的下一场景
- **AND** 到达结局场景后展示结局文字，故事结束

#### Scenario: Phase 2 能力引用规则

- **WHEN** 用户在故事中问及角色的能力、技能或装备
- **THEN** Claude SHALL 参考 capabilities.md 中的描述回答
- **AND** 角色行为不超出 capabilities.md 描述的能力范围

#### Scenario: Phase 2 时间线引用规则

- **WHEN** 用户在故事中问及角色的经历或过去事件
- **THEN** Claude SHALL 参考 milestones.md 中的记录回答
- **AND** 角色只知道 milestones.md 中记录的事件，不知道之后发生的事

### Requirement: 场景呈现规则

SKILL.md SHALL 定义场景呈现规则：旁白使用沉浸式第二人称描写；角色台词/动作根据场景指导即兴演绎，遵守 identity.md 人格和 style.md 表达方式；选项通过 AskUserQuestion 呈现。

#### Scenario: 标准场景输出

- **WHEN** Claude 运行到一个场景
- **THEN** SHALL 先输出旁白文本
- **THEN** 输出角色的台词和动作（基于角色演出指导即兴表演）
- **THEN** 使用 AskUserQuestion 呈现 2-3 个选项

#### Scenario: 用户自由输入

- **WHEN** 用户不通过选项回复而是输入自由文本
- **THEN** Claude SHALL 作为角色在场景内回应该对话
- **THEN** 再次使用 AskUserQuestion 呈现同一场景的选项（不跳转）

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

结局展示完成后，SKILL.md SHALL 指示 Claude 使用 AskUserQuestion 提供两个选项："从头再来"和"结束故事"。"从头再来"语义 SHALL 为：复用当前 script，重置 state 到剧本声明的 `initial_state`，重新进入 Phase 2 第一个场景，**不**重新生成剧本。

#### Scenario: 从头再来
- **WHEN** 用户在结局后选择"从头再来"
- **THEN** Claude SHALL 重置 state 对象到当前 script 中 `initial_state` 字段定义的值
- **AND** SHALL 清空当前 slot 的 `state.yaml`
- **AND** SHALL 直接进入 Phase 2 第一个场景，使用同一份 script
- **AND** SHALL 不进入 Phase 0、不调用 Write 生成新 script

#### Scenario: 结束故事
- **WHEN** 用户在结局后选择"结束故事"
- **THEN** 故事完结，不再输出任何内容

#### Scenario: 想换故事的用户
- **WHEN** 用户希望玩一个新剧本（而非重玩当前剧本）
- **THEN** SHALL 引导用户重启 skill 进入 Phase -1 菜单选择"生成新剧本"
- **AND** SHALL 不在结局选项中提供"换剧本"入口（保持结局菜单简洁）

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
导出的 skill 归档 SHALL 包含 `runtime/` 占位目录，含 `runtime/scripts/` 和 `runtime/saves/` 两个子目录，用于运行时持久化剧本和存档。空目录通过 `.gitkeep` 占位文件保留。

#### Scenario: 归档包含 runtime 占位
- **WHEN** 解压新生成的 `.skill` 文件
- **THEN** 解压结果 SHALL 包含 `runtime/scripts/.gitkeep` 和 `runtime/saves/.gitkeep`
- **AND** 这两个目录在分发时为空，仅在 skill 运行后被填充

### Requirement: Phase -1 剧本选择菜单
SKILL.md SHALL 在 Phase 0 之前新增 Phase -1 阶段。引擎启动时 SHALL 先列出 `${CLAUDE_SKILL_DIR}/runtime/scripts/` 下所有 `.yaml` 文件，根据结果决定流程。

#### Scenario: 无已有剧本，自动进入 Phase 0
- **WHEN** 引擎启动且 `runtime/scripts/` 为空或不含任何 `.yaml` 文件
- **THEN** SKILL.md SHALL 指示 Claude 直接进入 Phase 0（长度选择 + seeds 询问）
- **AND** SHALL 不展示任何剧本选择菜单

#### Scenario: 已有剧本时展示菜单
- **WHEN** 引擎启动且 `runtime/scripts/` 含一个或多个 `.yaml` 文件
- **THEN** SKILL.md SHALL 指示 Claude 解析每个剧本文件的 frontmatter（id、title、user_direction、acts、generated_at）
- **AND** SHALL 使用 AskUserQuestion 列出所有剧本，每个剧本附带元信息
- **AND** 菜单 SHALL 包含以下顶层选项：「继续某个存档」「重试某个剧本」「重命名剧本」「删除剧本」「生成新剧本」

#### Scenario: 选择"生成新剧本"
- **WHEN** 用户在 Phase -1 菜单选择"生成新剧本"
- **THEN** SKILL.md SHALL 指示 Claude 进入 Phase 0（与无剧本时的流程一致）

#### Scenario: 选择"继续某个存档"
- **WHEN** 用户在 Phase -1 菜单选择某个存档
- **THEN** Claude SHALL 读取 `runtime/saves/slot-<N>/meta.yaml` 的 `script_ref` 字段
- **AND** SHALL 读取对应的 `runtime/scripts/script-<id>.yaml`
- **AND** SHALL 读取 `runtime/saves/slot-<N>/state.yaml`
- **AND** 直接进入 Phase 2，从 state 中记录的 `current_scene` 继续

#### Scenario: 选择"重试某个剧本"
- **WHEN** 用户在 Phase -1 菜单选择重试某个剧本
- **THEN** Claude SHALL 读取该剧本的 `script-<id>.yaml`
- **AND** SHALL 重置 state 到剧本中声明的 `initial_state`（不读取任何已有 save）
- **AND** SHALL 直接进入 Phase 2 第一个场景

### Requirement: 剧本持久化为 YAML 文件
Phase 1 完成剧本生成后 SHALL 通过 Write 工具将完整剧本以 YAML 格式写入 `${CLAUDE_SKILL_DIR}/runtime/scripts/script-<id>.yaml`。剧本 SHALL 一次性写入，不分段追加。

#### Scenario: 剧本写入路径与命名
- **WHEN** Phase 1 LLM 完成剧本创作
- **THEN** Claude SHALL 调用 Write 工具
- **AND** 文件路径 SHALL 为 `${CLAUDE_SKILL_DIR}/runtime/scripts/script-<8位短hash>.yaml`
- **AND** 8 位短 hash SHALL 由 LLM 基于时间戳和 user_direction 生成

#### Scenario: 剧本 frontmatter 字段
- **WHEN** Phase 1 写入 yaml 文件
- **THEN** 文件顶部 SHALL 包含以下 frontmatter 字段：
  - `id`: 与文件名 hash 一致的字符串
  - `title`: LLM 给剧本起的简短标题
  - `generated_at`: ISO 8601 时间戳
  - `user_direction`: 用户在 Phase 0 输入的命题文本（无则为空）
  - `acts`: 用户选择的幕数
- **AND** frontmatter 之后 SHALL 是剧本正文（scenes、choices、endings、initial_state 等）

#### Scenario: 写入失败的容错
- **WHEN** Write 工具调用失败
- **THEN** Claude SHALL 输出错误提示
- **AND** SHALL 仍然进入 Phase 2 运行剧本（剧本保留在 LLM 上下文中）
- **AND** 用户被告知本次剧本无法持久化、重试将不可复现

#### Scenario: 写入完成确认
- **WHEN** Write 工具成功完成
- **THEN** Claude SHALL 向用户输出一句确认（"剧本已保存为 script-xxx"）
- **AND** SHALL 进入 Phase 2

### Requirement: 存档结构与 script 关联
每个存档 SHALL 位于 `runtime/saves/slot-<N>/` 目录下，含 `meta.yaml` 和 `state.yaml` 两个文件。`meta.yaml` 的 `script_ref` 字段 SHALL 指向具体的 script id。第一版 SHALL 支持固定 3 个 slot（slot-1、slot-2、slot-3）。

#### Scenario: 存档 meta 字段
- **WHEN** Phase 2 在场景流转后写入存档
- **THEN** `runtime/saves/slot-<N>/meta.yaml` SHALL 包含：
  - `script_ref`: 当前剧本的 id
  - `last_played_at`: ISO 8601 时间戳
  - `current_scene`: 当前所在场景的 id（用于人类可读）

#### Scenario: 存档 state 字段
- **WHEN** Phase 2 写入 state
- **THEN** `runtime/saves/slot-<N>/state.yaml` SHALL 包含：
  - `affinity`: 完整的 per-character 好感轴当前值
  - `flags`: 完整的 flag 当前值
  - `current_scene`: 当前所在场景的 id
- **AND** 写入 SHALL 在每次场景流转后发生

#### Scenario: 删除剧本时级联删除关联存档
- **WHEN** 用户在 Phase -1 菜单选择删除某个剧本
- **THEN** Claude SHALL 删除 `runtime/scripts/script-<id>.yaml`
- **AND** SHALL 扫描所有 `runtime/saves/slot-<N>/meta.yaml`
- **AND** SHALL 删除 `script_ref` 等于该剧本 id 的存档目录
- **AND** SHALL 向用户确认删除的剧本和关联存档数量

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
