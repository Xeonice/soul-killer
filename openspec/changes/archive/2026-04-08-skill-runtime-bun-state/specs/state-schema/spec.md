## MODIFIED Requirements

### Requirement: state 更新使用 Edit 工具行级替换
Phase 2 场景流转期间，`state.yaml` 和 `meta.yaml` 的更新 SHALL 通过 `runtime/bin/state` wrapper 调用 bun 脚本完成，**不再**使用 `Edit` 工具行级替换或 `Write` 工具全量重写。LLM SHALL NOT 直接 Read-then-Edit 或 Read-then-Write `state.yaml` / `meta.yaml` 任一文件。

允许的写入路径（全部通过 `bash runtime/bin/state <subcommand>`）：

- `state init <slot> <script-id>`：Phase 2 首次进入场景时从 `initial_state` 初始化
- `state apply <slot> <scene-id> <choice-id>`：场景流转时的事务性状态转移
- `state reset <slot>`：Phase -1「重玩当前剧本」时把存档重置到 `initial_state`
- `state rebuild <slot>`：修复菜单用于从 `initial_state` 重建 `state.yaml`（例如缺字段时）

所有写入 SHALL 使用 temp-file + `rename` 的原子替换语义，`state.yaml` 和 `meta.yaml` 作为一个事务单元，要么都更新成功，要么都不变。

#### Scenario: 场景流转用 state apply
- **WHEN** 玩家选某选项触发 consequences
- **THEN** SKILL.md 指示 LLM 调用 `bash runtime/bin/state apply <slot> <scene-id> <choice-id>`
- **AND** 脚本内部从 script.json 读取 consequences 自行计算 delta
- **AND** 写入 state.yaml 和 meta.yaml
- **AND** LLM SHALL NOT 在这次流转中调用 Edit 或 Write

#### Scenario: 初始化用 state init
- **WHEN** Phase 2 第一次进入第一个场景
- **THEN** SKILL.md 指示 LLM 调用 `bash runtime/bin/state init <slot> <script-id>`
- **AND** 脚本内部从 script.initial_state 一次性写完整 state.yaml
- **AND** 同时写 meta.yaml

#### Scenario: 重玩重置用 state reset
- **WHEN** Phase -1 选「重玩当前剧本」
- **THEN** SKILL.md 指示 LLM 调用 `bash runtime/bin/state reset <slot>`
- **AND** 脚本内部把 state.yaml 重置为 initial_state
- **AND** 脚本内部把 meta.yaml.current_scene 重置为 scenes[0].id

#### Scenario: 禁止直接 Edit / Write
- **WHEN** Phase 2 或 Phase -1 的任何阶段
- **THEN** SKILL.md SHALL 明示 LLM 不得用 Edit 或 Write 直接修改 state.yaml 或 meta.yaml
- **AND** 任何对这两个文件的修改 SHALL 通过 state wrapper 命令进行

#### Scenario: 事务性保证
- **WHEN** `state apply` 需要同时写 state.yaml 和 meta.yaml
- **THEN** 脚本 SHALL 先写临时文件
- **AND** 再用 fs.rename 原子替换两个目标文件
- **AND** 若中途 crash，两个目标文件 SHALL 保持 crash 前的旧内容

### Requirement: state 字段集运行时强制对齐 schema
任何时候，state.yaml 的字段集 SHALL 等于对应 script 的 state_schema 字段集（字面字符串相等）。Phase -1 加载存档时通过 `bash runtime/bin/state validate <slot>` 验证这个 invariant，不一致 SHALL 返回诊断 JSON，LLM 根据诊断弹出修复菜单。

修复动作 SHALL 通过以下脚本命令完成（LLM 不直接编辑文件）：

- 补缺失字段为 default → 调用 `state rebuild <slot>`（从 schema 重建）
- 完全重置 → 调用 `state reset <slot>`
- 取消加载 → 返回存档列表

#### Scenario: 对齐通过
- **WHEN** state.yaml 字段集与 script.state_schema 字段集完全相同
- **THEN** `state validate` 返回 `{"ok": true, "errors": []}`
- **AND** 加载流程继续

#### Scenario: 缺失字段
- **WHEN** state.yaml 缺少 schema 中的某个字段
- **THEN** `state validate` 返回 `errors` 含 `code: FIELD_MISSING`
- **AND** SKILL.md 指示 LLM 弹出修复菜单
- **AND** 用户选择"补"时，LLM 调用 `state rebuild <slot>`

#### Scenario: 多余字段
- **WHEN** state.yaml 含 schema 中没有的字段
- **THEN** `state validate` 返回 `errors` 含 `code: FIELD_EXTRA`
- **AND** SKILL.md 指示 LLM 弹出修复菜单（丢弃多余 / 完全重置 / 取消）

#### Scenario: 类型不符
- **WHEN** state.yaml 中某字段值类型与 schema 类型不匹配（如 int 字段存了字符串）
- **THEN** `state validate` 返回 `errors` 含 `code: FIELD_TYPE_MISMATCH`
- **AND** SKILL.md 指示 LLM 弹出修复菜单

## REMOVED Requirements

### Requirement: state.yaml 行格式严格化
**Reason**: 行格式约束从"LLM 手写时的硬性要求"降级为"脚本写入的实现细节"。LLM 不再直接写 state.yaml，行格式由 `runtime/lib/*.ts` 中的 serializer 保证。原来的行格式（两空格缩进、带引号 key、无嵌套、无 block scalar）作为 mini-yaml.ts parser 的输入契约继续有效，但不再作为面向 LLM 的规范存在。

**Migration**: 行格式的等价约束迁移到新的 `skill-runtime-state` 能力中的 `mini-yaml 零依赖扁平解析器` 要求——parser 只接受扁平 `"<quoted-key>": <value>` 结构，serializer 只产出同一格式。作者和 LLM 不再需要记住这些格式细节。
