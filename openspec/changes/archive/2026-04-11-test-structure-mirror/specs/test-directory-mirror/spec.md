## ADDED Requirements

### Requirement: Unit test directory mirrors source directory

`tests/unit/` 的子目录结构 SHALL 镜像 `src/` 的目录结构。对于源码文件 `src/A/B/C.ts`，其单元测试 SHALL 位于 `tests/unit/A/B/` 目录下。

#### Scenario: 通过源码路径定位测试

- **WHEN** 开发者修改了 `src/export/state/apply.ts`
- **THEN** 对应测试位于 `tests/unit/export/state/apply.test.ts`

#### Scenario: 新增测试文件有明确归属

- **WHEN** 开发者为 `src/infra/search/` 下的新模块编写单元测试
- **THEN** 测试文件 SHALL 放入 `tests/unit/infra/search/` 目录

#### Scenario: 非 src 目录的源码

- **WHEN** 源码位于项目根目录下（如 `acceptance/`）而非 `src/` 下
- **THEN** 测试 SHALL 在 `tests/unit/` 下创建对应子目录（如 `tests/unit/acceptance/`）

### Requirement: Component test directory mirrors source directory

`tests/component/` 的子目录结构 SHALL 镜像 `src/cli/` 的子目录结构，分为 `animation/`、`components/`、`commands/` 三个子目录。

#### Scenario: 动画组件测试归属

- **WHEN** 测试的源码在 `src/cli/animation/` 下
- **THEN** 测试 SHALL 位于 `tests/component/animation/`

#### Scenario: 命令组件测试归属

- **WHEN** 测试的源码在 `src/cli/commands/soul/` 下
- **THEN** 测试 SHALL 位于 `tests/component/commands/soul/`

#### Scenario: UI 组件测试归属

- **WHEN** 测试的源码在 `src/cli/components/` 下
- **THEN** 测试 SHALL 位于 `tests/component/components/`

### Requirement: 文件名去除冗余前缀

移动到子目录后，测试文件名 SHALL 去除与目录路径重复的前缀部分。

#### Scenario: export-state 前缀去除

- **WHEN** `export-state-apply.test.ts` 移入 `tests/unit/export/state/`
- **THEN** 文件重命名为 `apply.test.ts`

#### Scenario: world 前缀去除

- **WHEN** `world-binding.test.ts` 移入 `tests/unit/world/`
- **THEN** 文件重命名为 `binding.test.ts`

#### Scenario: 无冗余前缀的文件保留原名

- **WHEN** `glitch-engine.test.ts` 移入 `tests/unit/cli/animation/`
- **THEN** 文件名保持 `glitch-engine.test.ts` 不变

### Requirement: Snapshot 文件跟随测试迁移

`__snapshots__/` 目录及其内容 SHALL 跟随对应的测试文件移动到新位置。

#### Scenario: component snapshot 迁移

- **WHEN** `tests/component/prompt.test.tsx` 移入 `tests/component/components/`
- **THEN** `tests/component/__snapshots__/prompt.test.tsx.snap` SHALL 移入 `tests/component/components/__snapshots__/`

### Requirement: 所有测试移动后通过

移动完成后，`bun run test` SHALL 全部通过，无新增失败。

#### Scenario: vitest 运行验证

- **WHEN** 执行 `bun run test`
- **THEN** 所有 unit 和 component 测试 SHALL 通过，测试数量与移动前一致

### Requirement: Import 路径正确更新

所有被移动的测试文件中的相对 import 路径 SHALL 根据新的目录深度正确更新。

#### Scenario: 子目录深度增加后 import 更新

- **WHEN** 测试文件从 `tests/unit/` 移到 `tests/unit/export/state/`
- **THEN** 文件中 `../../src/` 的相对路径 SHALL 更新为 `../../../../src/`
