## ADDED Requirements

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

## MODIFIED Requirements

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
