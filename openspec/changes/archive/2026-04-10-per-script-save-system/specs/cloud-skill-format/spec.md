## MODIFIED Requirements

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

## REMOVED Requirements

### Requirement: 剧本持久化为 YAML 文件
**Reason**: 此需求在 skill-runtime-bun-state 变更中已被替换为 JSON 格式（script-<id>.json）。本次变更不涉及剧本文件格式，仅确认使用 JSON。此需求条目本身已过时。
**Migration**: 无需迁移，JSON 格式已是现状。
