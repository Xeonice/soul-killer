## MODIFIED Requirements

### Requirement: state CLI 工具六子命令契约
state CLI 提供 **八** 个子命令：`doctor`、`init`、`apply`、`validate`、`rebuild`、`reset`、`save`、`list`。

- `doctor` — 运行时健康检查（不变）
- `init <script-id>` — 初始化剧本的 auto/ 存档槽（从 script.json 的 initial_state 写入）
- `apply <script-id> <scene-id> <choice-id>` — 应用选择后果到 auto/ 存档
- `validate <script-id> [<save-type>] [--continue]` — JSON 诊断，save-type 为 `auto`（默认）或 `manual:<timestamp>`
- `rebuild <script-id> [<save-type>]` — 修复指定存档的 state.yaml
- `reset <script-id> [<save-type>]` — 重置指定存档到 initial_state
- `save <script-id> [--overwrite <timestamp>]` — 将 auto/ 快照到 manual/<timestamp>/；`--overwrite` 先删旧再建新
- `list <script-id>` — JSON 输出该剧本的所有存档概要

不提供 `get` 或 `set` 子命令（不变）。

#### Scenario: init 创建 per-script auto 存档
- **WHEN** `state init a3f9c2e1` 被调用
- **THEN** 系统 SHALL 在 `runtime/saves/a3f9c2e1/auto/` 创建 state.yaml 和 meta.yaml

#### Scenario: apply 写入 auto 存档
- **WHEN** `state apply a3f9c2e1 scene-5 choice-2` 被调用
- **THEN** 系统 SHALL 更新 `runtime/saves/a3f9c2e1/auto/state.yaml` 和 `auto/meta.yaml`

#### Scenario: validate 支持 save-type 参数
- **WHEN** `state validate a3f9c2e1 manual:1712345678 --continue` 被调用
- **THEN** 系统 SHALL 对 `runtime/saves/a3f9c2e1/manual/1712345678/` 执行诊断

#### Scenario: save 创建手动快照
- **WHEN** `state save a3f9c2e1` 被调用且手动存档 < 3
- **THEN** 系统 SHALL 复制 auto/ 内容到 `manual/<unix-timestamp>/`

#### Scenario: save 覆盖指定存档
- **WHEN** `state save a3f9c2e1 --overwrite 1712345678` 被调用
- **THEN** 系统 SHALL 删除 `manual/1712345678/` 并创建新的 `manual/<new-timestamp>/`

#### Scenario: list 输出 JSON
- **WHEN** `state list a3f9c2e1` 被调用
- **THEN** 系统 SHALL 输出 JSON 包含 auto + manual 存档概要

### Requirement: 共享 TypeScript 源码路径
`src/export/state/` 目录中的源文件被 packager 原封不动复制到 `runtime/lib/`，并由 vitest 测试覆盖。新增的 `save.ts` 和 `list.ts` 模块 SHALL 遵循相同模式：零 npm 依赖，仅使用 bun stdlib + inline mini-yaml parser。

#### Scenario: 新模块被 packager 复制
- **WHEN** packager 构建 skill 归档
- **THEN** `src/export/state/save.ts` 和 `src/export/state/list.ts` SHALL 被复制到 `runtime/lib/save.ts` 和 `runtime/lib/list.ts`

#### Scenario: 新模块有测试覆盖
- **WHEN** `bun run test` 执行
- **THEN** `save.ts` 和 `list.ts` 的逻辑 SHALL 被 vitest 测试覆盖

## REMOVED Requirements

### Requirement: state validate 返回 JSON 诊断不自动修复
**Reason**: 本需求的内容未被删除，而是合并到上方 MODIFIED 的"state CLI 工具八子命令契约"中。validate 的行为不变，仅参数签名从 `<slot>` 改为 `<script-id> [<save-type>]`。
**Migration**: 参见 MODIFIED 中 validate 的新签名。
