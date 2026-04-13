## ADDED Requirements

### Requirement: apply 追加 choice history

每次 `state apply` 成功后 SHALL 在 `runtime/saves/<script-id>/auto/history.log` 追加一行 `<scene-id>:<choice-id>`。

#### Scenario: 首次 apply 创建 history.log

- **WHEN** 执行 `state apply script-001 scene-001 choice-a`（history.log 不存在）
- **THEN** SHALL 创建 history.log，内容为 `scene-001:choice-a\n`

#### Scenario: 连续 apply 追加

- **WHEN** 执行两次 apply（scene-001:choice-a → scene-002:choice-b）
- **THEN** history.log SHALL 包含两行，按序排列

#### Scenario: append 失败不影响 apply

- **WHEN** history.log append 失败（如磁盘满）
- **THEN** state.yaml 和 meta.yaml SHALL 已正常写入，apply 返回成功

### Requirement: init 创建空 history.log

`state init` SHALL 创建空的 history.log 文件。

#### Scenario: init 后 history.log 存在但为空

- **WHEN** 执行 `state init script-001`
- **THEN** `runtime/saves/script-001/auto/history.log` SHALL 存在且内容为空

### Requirement: save 复制 history.log

`state save` SHALL 将 auto/history.log 复制到 manual save 目录。

#### Scenario: manual save 包含 history

- **WHEN** 执行若干 apply 后 `state save script-001`
- **THEN** `manual/<timestamp>/history.log` SHALL 与 `auto/history.log` 内容一致

### Requirement: reset 清空 history.log

`state reset` SHALL 清空 history.log。

#### Scenario: reset 后 history 为空

- **WHEN** 执行若干 apply 后 `state reset script-001`
- **THEN** `auto/history.log` SHALL 存在且内容为空

### Requirement: rebuild 不动 history.log

`state rebuild` SHALL 不修改 history.log。

#### Scenario: rebuild 保留 history

- **WHEN** 执行若干 apply 后 `state rebuild script-001`
- **THEN** `auto/history.log` SHALL 内容不变
