## MODIFIED Requirements

### Requirement: 废弃路径剔除规则集

`scripts/upgrade-example-skills.ts` SHALL 维护一份"废弃路径规则集"，在升级流程中从 `.skill` 归档里移除这些路径。规则集以数组形式在脚本里集中声明，至少包含：

- `runtime/bin/state`（pre skill-runtime-binary 的 bash wrapper）
- `runtime/bin/doctor.sh`（pre skill-runtime-binary 的 doctor 脚本）
- `runtime/bin/`（若为空目录）
- `runtime/lib/`（skill-binary-contract 变更后淘汰；binary 从不读该目录）
- `runtime/lib/**`（嵌套文件，支持前缀匹配）
- `.DS_Store`（macOS Finder 元数据，basename 匹配；任意目录深度都剥离）

未来废弃路径 SHALL 通过追加规则集来清理。匹配规则有三种：
- 以 `/` 结尾：前缀匹配（dir + 子内容）
- 含 `/` 但不以 `/` 结尾：完整路径精确匹配
- 不含 `/`：basename 匹配（任意目录深度）

#### Scenario: 剔除 bash wrapper 残留

- **WHEN** 升级一个归档内含 `runtime/bin/state` 与 `runtime/bin/doctor.sh` 的 archive
- **THEN** 升级后产出的 zip SHALL 不含 `runtime/bin/` 下的任何文件

#### Scenario: 剔除 runtime/lib/ 整个目录

- **WHEN** 升级一个归档内含 `runtime/lib/apply.ts` 等 19 个 .ts 文件的老 archive
- **THEN** 升级后 zip SHALL 不含任何以 `runtime/lib/` 开头的条目

#### Scenario: 不影响干净的归档

- **WHEN** 升级一个不含任何规则集路径的 `.skill`
- **THEN** 归档内容 SHALL 与废弃剔除前完全一致（仅 engine.md + soulkiller.json 按常规流程 bump）

#### Scenario: --check 识别 runtime/lib 为过期

- **WHEN** `scripts/upgrade-example-skills.ts --check` 扫到 `runtime/lib/` 存在
- **THEN** 报告 SHALL 列出该归档过期，过期原因含 `deprecated paths: runtime/lib/...`；退出码 1

#### Scenario: 剔除任意深度的 .DS_Store

- **WHEN** 升级归档含 `.DS_Store` 与 `runtime/.DS_Store` 两个文件
- **THEN** basename 匹配 SHALL 把两个都识别为废弃；升级后 zip 都被剔除
