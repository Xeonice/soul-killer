# Export Command

`/export` 命令注册、入口组件和 interactiveMode 集成。

## ADDED Requirements

### Requirement: /export 命令注册

系统 SHALL 在 command registry 中注册 `/export` 命令，描述为"导出 Soul + World 为 Cloud Skill"。

#### Scenario: 命令注册

- **WHEN** REPL 启动
- **THEN** `/export` SHALL 出现在 command registry 中
- **AND** `/help` 输出中列出 `/export` 及其描述

#### Scenario: Tab 补全

- **WHEN** 用户输入 `/exp` 并按 Tab
- **THEN** 自动补全为 `/export`

### Requirement: /export 入口组件

`/export` 命令 SHALL 渲染 ExportCommand 组件，该组件初始化 Export Agent 并挂载 ExportProtocolPanel。组件进入 interactiveMode（隐藏主 TextInput，避免 ink useInput 广播冲突）。

#### Scenario: 进入导出模式

- **WHEN** 用户执行 `/export`
- **THEN** app.tsx SHALL 设置 `interactiveMode: true`
- **AND** 渲染 ExportCommand 组件
- **AND** ExportCommand 初始化 Export Agent 并开始 Agent loop

#### Scenario: 导出完成后退出

- **WHEN** Export Agent 完成导出（或用户按 Esc 取消）
- **THEN** ExportCommand SHALL 调用 onComplete 回调
- **AND** app.tsx 恢复 `interactiveMode: false`
- **AND** 返回主 REPL prompt

#### Scenario: 导出过程中 Esc 取消

- **WHEN** 用户在导出过程中按 Esc
- **THEN** Export Agent loop SHALL 被中止
- **AND** 显示"导出已取消"
- **AND** 退出 interactiveMode 返回主 prompt

### Requirement: Export 命令适配多 Soul
export 命令的 UI SHALL 适配多 Soul 导出流程。

#### Scenario: 进度展示
- **WHEN** export agent 正在分析和打包
- **THEN** SHALL 展示当前阶段（分析/打包）
- **AND** SHALL 展示识别到的角色数量和世界名称

#### Scenario: 完成展示
- **WHEN** export 完成
- **THEN** SHALL 展示导出的 soul 列表、world 名称、输出路径、文件数
- **AND** SHALL 展示角色编排摘要（role + 好感轴）

### Requirement: User-driven selection 流程
export 命令 SHALL 在用户发起 /export 后，依次通过 UI 让用户多选 souls、单选 world、输入故事名、输入故事方向、选择输出位置，然后再进入 agent 创意工作。

#### Scenario: 完整流程
- **WHEN** 用户触发 /export
- **THEN** SHALL 依次展示：
  1. 多选 UI: 所有可用 souls（空格切换，Enter 确认）
  2. 单选 UI: 所有可用 worlds（上下移动，Enter 确认）
  3. 文本输入: 故事名（必填）
  4. 文本输入: 故事方向（可选，Enter 跳过）
  5. 单选 UI: 三个输出位置预设
  6. 数据读取阶段: 读取所选 souls 和 world 的完整文件
  7. Agent 运行阶段: 创意分析 + 打包
- **AND** 每一步完成后自动进入下一步

#### Scenario: 多选 souls
- **WHEN** 进入 selecting-souls 步骤
- **THEN** SHALL 列出所有已 distill 的 souls
- **AND** 使用 multi_select 模式
- **AND** Enter 确认后 SHALL 存储选中列表

#### Scenario: 单选 world
- **WHEN** 进入 selecting-world 步骤
- **THEN** SHALL 列出所有可用 worlds
- **AND** 使用 single select 模式
- **AND** Enter 确认后 SHALL 存储选中的 world name

#### Scenario: 0 个 souls 或 0 个 worlds
- **WHEN** 扫描后发现 souls 或 worlds 列表为空
- **THEN** SHALL 显示友好错误信息
- **AND** 不进入 agent 阶段

#### Scenario: 选中 0 个 souls
- **WHEN** 用户在多选 souls 时未选择任何角色直接 Enter
- **THEN** SHALL 提示至少需要选择 1 个 soul
- **AND** 保持在 selecting-souls 步骤

### Requirement: 代码层数据预读
在进入 agent 阶段之前，export 命令 SHALL 通过代码直接读取所有选中数据。

#### Scenario: 读取 soul 完整数据
- **WHEN** 进入 loading-data 步骤
- **THEN** 对每个选中的 soul SHALL 调用 `readManifest` + `readSoulFiles` 读取完整数据
- **AND** SHALL 组装为 `{ name, manifest, identity, style, capabilities, milestones, behaviors[] }` 结构

#### Scenario: 读取 world 完整数据
- **WHEN** 进入 loading-data 步骤
- **THEN** 对选中的 world SHALL 调用 `loadWorld` + `loadAllEntries` 读取完整数据
- **AND** SHALL 组装为 `{ name, manifest, entries[] }` 结构

#### Scenario: 数据读取失败
- **WHEN** 任何 soul 或 world 的文件读取失败
- **THEN** SHALL 显示错误信息并返回上一个选择步骤

### Requirement: Esc 返回上一步
用户在任意步骤按 Esc SHALL 返回上一步或取消整个流程。

#### Scenario: selecting-souls Esc
- **WHEN** 在 selecting-souls 步骤按 Esc
- **THEN** SHALL 取消整个 export 流程

#### Scenario: selecting-world Esc
- **WHEN** 在 selecting-world 步骤按 Esc
- **THEN** SHALL 返回 selecting-souls 步骤

#### Scenario: naming-story Esc
- **WHEN** 在 naming-story 步骤按 Esc
- **THEN** SHALL 返回 selecting-world 步骤

#### Scenario: story-direction Esc
- **WHEN** 在 story-direction 步骤按 Esc
- **THEN** SHALL 返回 naming-story 步骤

#### Scenario: selecting-output Esc
- **WHEN** 在 selecting-output 步骤按 Esc
- **THEN** SHALL 返回 story-direction 步骤

### Requirement: Wizard 新增故事命名步骤
在 selecting-world 之后，export 命令 SHALL 新增 `naming-story` 步骤让用户输入故事名。该字段必填。

#### Scenario: 显示故事名输入
- **WHEN** 进入 naming-story 步骤
- **THEN** SHALL 显示一个 TextInput 组件
- **AND** prompt 标签 SHALL 引导用户输入故事名（如 "故事名（必填）"）

#### Scenario: 提交非空故事名
- **WHEN** 用户输入非空名称并按 Enter
- **THEN** SHALL 保存到 state.storyName
- **AND** 进入 story-direction 步骤

#### Scenario: 提交空名称
- **WHEN** 用户直接按 Enter 而未输入任何内容
- **THEN** SHALL 不进入下一步
- **AND** 保持在 naming-story 步骤（可选显示提示）

#### Scenario: Esc 返回上一步
- **WHEN** 在 naming-story 步骤按 Esc
- **THEN** SHALL 返回 selecting-world 步骤

### Requirement: Wizard 新增故事方向步骤
在 naming-story 之后，export 命令 SHALL 新增 `story-direction` 步骤让用户输入故事走向描述。该字段可选。

#### Scenario: 显示方向输入
- **WHEN** 进入 story-direction 步骤
- **THEN** SHALL 显示一个 TextInput 组件
- **AND** prompt 标签 SHALL 提示"（可选，Enter 跳过）"

#### Scenario: 用户提供方向
- **WHEN** 用户输入内容并按 Enter
- **THEN** SHALL 保存到 state.storyDirection
- **AND** 进入 selecting-output 步骤

#### Scenario: 用户跳过方向
- **WHEN** 用户直接按 Enter
- **THEN** state.storyDirection SHALL 为空字符串或 undefined
- **AND** 进入 selecting-output 步骤

#### Scenario: Esc 返回上一步
- **WHEN** 在 story-direction 步骤按 Esc
- **THEN** SHALL 返回 naming-story 步骤

### Requirement: Wizard 新增输出位置选择步骤
在 story-direction 之后，export 命令 SHALL 新增 `selecting-output` 步骤让用户从三个固定预设中选择输出位置。

#### Scenario: 显示三个固定选项
- **WHEN** 进入 selecting-output 步骤
- **THEN** SHALL 展示恰好三个选项：
  1. "默认 (~/.soulkiller/exports/)"
  2. "当前项目 (.claude/skills/)"
  3. "全局 Claude skills (~/.claude/skills/)"
- **AND** 使用 single-select 模式
- **AND** 默认高亮第一项（默认位置）

#### Scenario: 选择确认
- **WHEN** 用户按 Enter
- **THEN** SHALL 根据所选选项解析绝对路径：
  - 默认 → `~/.soulkiller/exports/`（展开 home）
  - 项目 → `path.resolve('.claude/skills')`（基于 cwd）
  - 全局 → `~/.claude/skills/`（展开 home）
- **AND** 保存到 state.outputBaseDir
- **AND** 进入 loading-data 步骤

#### Scenario: 不做路径存在性检查
- **WHEN** 解析路径
- **THEN** SHALL 不检查目录是否存在
- **AND** packager 在创建时会用 `mkdirSync({ recursive: true })` 兜底

#### Scenario: Esc 返回上一步
- **WHEN** 在 selecting-output 步骤按 Esc
- **THEN** SHALL 返回 story-direction 步骤

### Requirement: 传递故事信息到 runExportAgent
CLI 在调用 runExportAgent 时 SHALL 将 storyName / storyDirection / outputBaseDir 作为 preSelected 的一部分传入。

#### Scenario: preSelected 完整结构
- **WHEN** 进入 running 阶段
- **THEN** 传给 runExportAgent 的 preSelected SHALL 包含:
  - souls, worldName, soulsData, worldData（已有）
  - storyName（新增，必填）
  - storyDirection（新增，可选）
  - outputBaseDir（新增，必填，绝对路径）


## ADDED Requirements

### Requirement: 导出向导的 "catalog info" 步骤（agent 后置）

REPL `/export` 命令的向导 SHALL 在 agent 完成所有工具调用、`finalize.ts` 即将调用 `packageSkill()` 之前，新增一个 `entering-catalog-info` 阶段：通过新的桥接事件 `catalog_confirm_request` 由 finalize 触发，依次展示三个输入框（slug / 世界 / 说明），每个输入框都预填 LLM 在 `set_story_metadata` 阶段写入 builder 的候选值。作者 SHALL 可以 Enter 接受默认，或编辑后 Enter 提交。空值不允许提交。

#### Scenario: 三字段全部有 LLM 候选

- **WHEN** agent 跑完 finalize_export，finalize 触发 catalog_confirm_request 事件
- **THEN** export.tsx SHALL 切到 UIStep `entering-catalog-info`，按 slug → 世界 → 说明顺序展示输入框，每个预填 builder 中的 LLM 候选
- **AND** 作者在每个输入框按 Enter 即接受
- **AND** 三字段最终值通过新的 catalogConfirmResolverRef 回传 finalize，作为 packageSkill 的入参写入 soulkiller.json

#### Scenario: 作者编辑候选

- **WHEN** LLM 候选 slug 为 `"fate-zero-4th"`，作者改为 `"fate-zero"`
- **THEN** 提交值 SHALL 为 `"fate-zero"`，不保留 LLM 原值

#### Scenario: 作者留空

- **WHEN** 作者清空某个输入框直接按 Enter
- **THEN** 向导 SHALL 阻止提交并显示提示 "不允许留空"，直至作者填入值

#### Scenario: LLM 候选格式非法

- **WHEN** LLM 候选 `world_slug` 为 `"Fate_Zero"`（含大写/下划线）
- **THEN** 向导 SHALL 在预填前按格式规则规范化（lowercase + 下划线转连字符）；若仍然非法则 hint 提示作者手改

#### Scenario: 触发时机

- **WHEN** agent 完成 finalize_export 工具调用，进入 `finalizeAndPackage`
- **THEN** finalize SHALL 在 `builder.build()` 之后、`packageSkill()` 之前触发事件并 await resolver；resolve 后才继续 packaging

### Requirement: 步骤的取消语义

agent 已经走完，无法回退到 wizard 早期步骤。Esc 在 `entering-catalog-info` 任一子输入框 SHALL 取消整个导出流程：catalogConfirmResolver 以"已取消"信号 resolve，finalize 跳过 packageSkill，整体退出导出模式回到 REPL 主提示符。

#### Scenario: Esc 取消

- **WHEN** 作者在 `entering-catalog-info` 编辑世界名时按 Esc
- **THEN** finalize SHALL 不调用 packageSkill；不会写出任何归档文件；export.tsx SHALL 退出 interactiveMode 返回主 prompt
