## ADDED Requirements

### Requirement: 存档目录结构为 per-script 嵌套
每个 script 在 `runtime/saves/` 下拥有独立子目录，以 script-id（8字符 hex）命名。目录内包含 `auto/` 子目录（自动存档，恰好 1 个）和 `manual/` 子目录（手动存档，最多 3 个）。每个存档目录包含 `state.yaml` 和 `meta.yaml`，格式与现有文件一致。

#### Scenario: 新剧本首次游玩时创建目录结构
- **WHEN** `state init <script-id>` 被调用
- **THEN** 系统 SHALL 创建 `runtime/saves/<script-id>/auto/` 目录，写入 initial_state 到 `auto/state.yaml` 和 `auto/meta.yaml`

#### Scenario: 目录按 script-id 隔离
- **WHEN** 存在两个剧本 script-a 和 script-b
- **THEN** `runtime/saves/script-a/` 和 `runtime/saves/script-b/` 的存档 SHALL 完全独立，互不影响

### Requirement: 自动存档在每次选择时更新
Phase 2 中用户每次做出剧情选择时，`state apply` SHALL 将状态写入对应 script 的 `auto/` 目录。自动存档始终只有一个，每次选择覆盖上一次。

#### Scenario: 剧情选择触发自动存档
- **WHEN** 用户在 Phase 2 选择了一个剧情选项
- **THEN** `state apply <script-id> <scene> <choice>` SHALL 更新 `runtime/saves/<script-id>/auto/state.yaml` 和 `auto/meta.yaml`

#### Scenario: 自动存档只保留最新状态
- **WHEN** 用户连续做了 3 次选择
- **THEN** `auto/` 目录中 SHALL 只有最后一次选择的状态，不保留历史

### Requirement: 手动存档由用户主动触发
用户在 Phase 2 的选择点可以选择"💾 保存当前进度"选项，触发 `state save <script-id>`，将 auto/ 的当前状态快照到 `manual/<timestamp>/`。

#### Scenario: 手动存档创建成功
- **WHEN** 用户选择"💾 保存当前进度"且手动存档数 < 3
- **THEN** 系统 SHALL 将 `auto/state.yaml` 和 `auto/meta.yaml` 复制到 `manual/<unix-timestamp>/`，并向用户确认保存成功

#### Scenario: 手动存档不影响自动存档
- **WHEN** 手动存档创建完成
- **THEN** `auto/` 目录内容 SHALL 保持不变

#### Scenario: 保存后重弹原选项
- **WHEN** 手动存档完成（或覆盖完成）
- **THEN** LLM SHALL 重新弹出相同的 AskUserQuestion，包含所有原始剧情选项和"💾 保存当前进度"选项

### Requirement: 手动存档上限为 3 个
每个剧本的 `manual/` 目录下最多保存 3 个手动存档。

#### Scenario: 达到上限时返回错误
- **WHEN** `state save <script-id>` 被调用且 `manual/` 已有 3 个子目录
- **THEN** 系统 SHALL 返回 `MANUAL_SAVE_LIMIT_REACHED` 错误码及现有存档列表

#### Scenario: 用户选择覆盖
- **WHEN** LLM 收到 `MANUAL_SAVE_LIMIT_REACHED`
- **THEN** LLM SHALL 通过 AskUserQuestion 展示现有手动存档列表，让用户选择覆盖哪一个

#### Scenario: 覆盖指定存档
- **WHEN** `state save <script-id> --overwrite <timestamp>` 被调用
- **THEN** 系统 SHALL 删除 `manual/<timestamp>/` 目录，然后创建新的 `manual/<new-timestamp>/` 快照

### Requirement: state list 列出剧本所有存档
`state list <script-id>` SHALL 返回 JSON 格式的存档信息，包含 auto 存档和所有 manual 存档的 currentScene 和 lastPlayedAt。

#### Scenario: 正常列出
- **WHEN** 剧本有 1 个 auto 存档和 2 个手动存档
- **THEN** 输出 SHALL 为 JSON 对象，包含 `scriptId`、`auto` 对象（currentScene, lastPlayedAt）、`manual` 数组（每项含 timestamp, currentScene, lastPlayedAt）

#### Scenario: 无存档的剧本
- **WHEN** 剧本存在于 scripts/ 但 saves/ 下无对应目录
- **THEN** 输出 SHALL 为 `{ "scriptId": "...", "auto": null, "manual": [] }`

### Requirement: 删除剧本时级联清理存档
当用户在 Phase -1 删除一个剧本时，LLM SHALL 同时删除 `runtime/saves/<script-id>/` 整个目录。

#### Scenario: 级联删除
- **WHEN** 用户确认删除剧本 script-a
- **THEN** `runtime/scripts/script-a.json` 和 `runtime/saves/a/` 目录 SHALL 被完整删除
