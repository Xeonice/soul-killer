### Requirement: 创建向导状态机
系统 SHALL 提供 `WorldCreateWizard` 组件，实现完整的世界创建向导。向导 SHALL 包含以下步骤：name → name-conflict（条件） → display-name → description → method-select → [分支流程] → confirm → done。向导 SHALL 自包含，从 name 收集到世界写入全在组件内部完成。

#### Scenario: 完整创建流程（空白方式）
- **WHEN** 用户进入向导，输入名称、显示名、描述，选择「空白世界」
- **THEN** 跳过数据导入，显示确认摘要（0 条目），确认后创建世界目录

#### Scenario: ESC 取消
- **WHEN** 用户在任何步骤按 ESC
- **THEN** 取消创建，调用 onCancel 回调

### Requirement: 创建方式选择
向导 SHALL 在收集基本信息后提供 4 种创建方式选择：手动创建、从 Markdown 蒸馏、从 URL 抓取、空白世界。用户通过方向键选择、Enter 确认。

#### Scenario: 展示创建方式
- **WHEN** 用户完成描述输入后
- **THEN** 显示 4 个选项，每个带有说明文字，可用方向键导航

### Requirement: 手动创建分支 — 引导式条目收集
选择「手动创建」后 SHALL 按顺序引导用户输入三个核心条目：世界背景（必填）、世界规则（可选）、氛围基调（可选）。每个条目的 mode/scope/priority 元数据 SHALL 自动分配，用户只需输入内容。

#### Scenario: 输入世界背景
- **WHEN** 用户选择手动创建后
- **THEN** 显示提示 "用一段话描述这个世界的基本设定"，用户输入内容后自动创建 entry（name: core-background, mode: always, scope: background, priority: 900）

#### Scenario: 跳过可选条目
- **WHEN** 用户在「世界规则」步骤直接按 Enter
- **THEN** 不创建 core-rules 条目，直接进入下一步

#### Scenario: 添加额外知识条目
- **WHEN** 用户完成三个核心条目后选择「添加知识条目」
- **THEN** 收集条目名称、触发关键词（逗号分隔）、内容，创建 keyword/lore 条目，然后询问是否继续添加

#### Scenario: 完成手动创建
- **WHEN** 用户在「是否添加更多条目」选择「完成」
- **THEN** 进入确认摘要

### Requirement: 蒸馏分支
选择「从 Markdown 蒸馏」后 SHALL 收集 markdown 目录路径（支持 Tab 路径补全），然后调用 WorldDistiller 执行蒸馏，最后进入 WorldDistillReview 审查。

#### Scenario: 蒸馏流程
- **WHEN** 用户选择蒸馏方式并输入路径
- **THEN** 显示蒸馏进度（classify/cluster/extract），完成后进入条目审查

### Requirement: URL 抓取分支
选择「从 URL 抓取」后 SHALL 允许用户逐行输入多个 URL（空行结束）。系统 SHALL 逐个 URL 调用 page extractor 提取文本，将结果作为 chunks 送入 WorldDistiller 蒸馏，然后进入审查。

#### Scenario: 多 URL 输入
- **WHEN** 用户选择 URL 方式并输入 3 个 URL 后按 Enter 提交空行
- **THEN** 依次抓取 3 个 URL 的内容，合并后蒸馏

#### Scenario: URL 抓取失败
- **WHEN** 某个 URL 无法访问
- **THEN** 显示警告但继续处理其他 URL，不中断整体流程

### Requirement: 名称冲突处理
当输入的世界名称已存在时 SHALL 进入冲突处理步骤，提供两个选项：覆盖（删除现有世界重新创建）、重命名（返回 name 步骤重新输入）。

#### Scenario: 名称冲突 — 覆盖
- **WHEN** 输入的名称 "night-city" 已存在，用户选择「覆盖」
- **THEN** 删除现有 night-city 世界，继续创建流程

#### Scenario: 名称冲突 — 重命名
- **WHEN** 用户选择「重命名」
- **THEN** 返回 name 输入步骤

### Requirement: 确认摘要
向导 SHALL 在写入前展示确认摘要，包含：世界名、显示名、描述、创建方式、条目数量及分类统计。用户可选择「确认」（执行创建）或「修改」（返回 method-select 步骤）。

#### Scenario: 确认并创建
- **WHEN** 用户在摘要页面选择「确认」
- **THEN** 创建世界目录，写入 world.json 和所有条目，显示完成信息

#### Scenario: 修改
- **WHEN** 用户在摘要页面选择「修改」
- **THEN** 返回创建方式选择步骤，之前收集的 name/display_name/description 保留
