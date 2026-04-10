## ADDED Requirements

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
SKILL.md frontmatter 的 `allowed-tools` 字段 SHALL 包含 `Edit`，作为 state.yaml 和 meta.yaml 行级更新的标准工具。完整 allowed-tools 列表 SHALL 是 `AskUserQuestion Read Write Glob Edit`，使用 Anthropic spec 要求的**空格分隔格式**（不是逗号分隔）。

#### Scenario: frontmatter Edit 工具声明
- **WHEN** 生成 SKILL.md
- **THEN** frontmatter `allowed-tools` SHALL 包含 `Edit`
- **AND** 同时包含 `AskUserQuestion`、`Read`、`Write`、`Glob`
- **AND** 多个工具之间 SHALL 用单个空格分隔，**不使用逗号**

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
SKILL.md Phase 2「场景流转规则」章节 SHALL 包含一段结构化的 apply_consequences 伪代码，指示 LLM 按以下流程执行：
1. 对每个 (key, value) in choice.consequences:
   - 查 state_schema[key] 拿 type
   - 不存在 → 错误并停止
   - 查 state[key] 拿当前值
   - 按 type 计算新值（int=delta, bool/enum/string=覆盖）
   - 范围/values 校验
   - 用 Edit 工具行级替换
2. 用 Edit 更新 current_scene
3. 用 Edit 更新 meta.yaml 的 last_played_at 与 current_scene
4. 跳转到 next scene

#### Scenario: 伪代码结构存在
- **WHEN** 生成 SKILL.md
- **THEN** Phase 2 章节 SHALL 包含 `apply_consequences` 伪代码块
- **AND** 伪代码 SHALL 明确写出 Edit 工具的调用形态

#### Scenario: 禁止 Write 全文件
- **WHEN** Phase 2 章节描述 state 更新
- **THEN** SHALL 明确指示"不要用 Write 重写整个 state.yaml"
- **AND** SHALL 明确两种允许 Write 的例外（Phase 2 初始化、Phase -1 重玩重置）

### Requirement: Phase -1 四重加载验证
SKILL.md Phase -1 章节 SHALL 在加载某个 script 之前对其执行四重验证：
1. **dangling reference 检查**：meta.yaml.script_ref 指向的 script 文件必须存在；不存在 → 标 (孤儿)，提供"删除存档"
2. **state_schema 完整性**：script.yaml 顶部必须含 state_schema 块；缺失 → 标 (legacy 不可重玩)，提供"删除剧本"
3. **initial_state 字段集对齐**：initial_state 字段集必须 == state_schema 字段集；不对齐 → 标 (损坏)，提供删除入口
4. **scenes consequences 抽样**：抽样 5 个 scene，每个 consequences key 必须存在于 state_schema；不通过 → 标 (损坏)

「继续游戏」额外验证：
5. **state.yaml 字段集对齐**：state.yaml 字段集必须 == state_schema 字段集；不对齐 → 弹「修复菜单」（缺失补 default / 多余丢弃 / 类型不符重置 / 完全重置 / 取消加载）

#### Scenario: dangling 检查
- **WHEN** Phase -1 选择某个存档
- **AND** 该存档的 meta.yaml.script_ref 指向的 script 文件不存在
- **THEN** SKILL.md 指示 LLM 标该存档为 (孤儿)，提供"删除存档"入口

#### Scenario: legacy hard fail
- **WHEN** 用户选择某个 script
- **AND** 该 script.yaml 顶部没有 state_schema 块
- **THEN** SKILL.md 指示 LLM 标该 script 为 (legacy 不可重玩)
- **AND** 仅提供"删除"入口，不提供加载/重玩入口

#### Scenario: initial_state 不对齐
- **WHEN** 加载某 script，其 state_schema 含 5 个字段但 initial_state 含 4 个
- **THEN** SKILL.md 指示标 (损坏)，提供删除入口

#### Scenario: consequences 抽样发现非法 key
- **WHEN** 抽样 5 个 scene，发现某个 consequences 引用了 schema 之外的 key
- **THEN** SKILL.md 指示标 (损坏)

#### Scenario: 继续游戏 state 字段集修复菜单
- **WHEN** 「继续游戏」时 state.yaml 缺一个 schema 字段
- **THEN** SKILL.md 指示弹出修复菜单
- **AND** 选项包含「补缺失字段为 default」「完全重置」「取消加载」

### Requirement: 重玩规则使用 Write 重置
SKILL.md「重玩当前剧本」流程 SHALL 使用 `Write` 工具把 state.yaml 整体覆盖为 initial_state，并把 meta.yaml 的 current_scene 重置为 scenes[0].id。这是允许 Write 的唯一另一处例外（除 Phase 2 初始化外）。

#### Scenario: 重玩 → Write state.yaml
- **WHEN** 用户在 Phase -1 菜单选「重玩某剧本」
- **THEN** SKILL.md 指示 LLM 用 Write 工具把 state.yaml 重置为 initial_state（一次性写完整文件）
- **AND** 用 Write 把 meta.yaml 的 current_scene 重置为 scenes[0].id
- **AND** 进入 Phase 2 第一个场景

### Requirement: SKILL.md 引用 state_schema 创作约束
SKILL.md Phase 1 章节 SHALL 包含 state_schema 的命名约束、类型集合、字段元信息要求、命名空间约定等完整规则，作为 LLM 写 schema 时的参考。

#### Scenario: 命名约束在 Phase 1 章节
- **WHEN** 生成 SKILL.md
- **THEN** Phase 1 章节 SHALL 明确说明 schema key 必须 ASCII / snake_case / dot 分隔 / 带引号

#### Scenario: 类型集合在 Phase 1 章节
- **WHEN** 生成 SKILL.md
- **THEN** Phase 1 章节 SHALL 列出四种合法 type：`int / bool / enum / string`
- **AND** 明确说明 list/float 等不支持

#### Scenario: 命名空间约定
- **WHEN** 生成 SKILL.md
- **THEN** Phase 1 章节 SHALL 推荐 affinity / flags / custom 三个命名空间前缀
- **AND** 说明系统不解析这些前缀，纯命名约定

### Requirement: SKILL.md 引用 endings DSL 语法
SKILL.md Phase 1 章节 SHALL 包含 endings condition 结构化 DSL 的完整语法说明（比较节点 / 逻辑组合 / 兜底），让 LLM 知道怎么写。

#### Scenario: DSL 语法在 Phase 1 章节
- **WHEN** 生成 SKILL.md
- **THEN** Phase 1 章节 SHALL 包含至少一个 endings condition 的 DSL 示例
- **AND** 列出支持的算子 `>= / <= / > / < / == / !=`
- **AND** 列出支持的逻辑节点 `all_of / any_of / not`
- **AND** 说明 `condition: default` 兜底语义

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

## MODIFIED Requirements

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
