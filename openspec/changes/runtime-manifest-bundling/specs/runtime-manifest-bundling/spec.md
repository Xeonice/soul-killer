## ADDED Requirements

### Requirement: state 目录自动 manifest 生成

系统 SHALL 提供 `scripts/gen-state-manifest.ts`，扫描 `src/export/state/*.ts`（排除 `manifest.ts` 自身、隐藏文件、`.test.ts` / `.spec.ts`），生成 `src/export/state/manifest.ts`：每个文件一条 `import X from './<file>' with { type: 'text' }` 语句；输出 `export const RUNTIME_FILES: Record<string, string>`，键为文件名（含 `.ts`），值为对应 import。按文件名字母序稳定排序。生成器是幂等的：当 committed manifest 内容与将要生成的内容字节相等时 SHALL 不写入，保留 mtime。

#### Scenario: 新增 state 文件后重新生成

- **WHEN** 向 `src/export/state/` 添加 `foo.ts` 并运行 `bun scripts/gen-state-manifest.ts`
- **THEN** `manifest.ts` SHALL 新增 `import foo from './foo.ts' with { type: 'text' }` 与 `RUNTIME_FILES['foo.ts']: foo`；其他 import 保持字母序

#### Scenario: 无变更时不写文件

- **WHEN** state 目录无变化，重复运行生成器
- **THEN** `manifest.ts` 不被写入；进程退出码 0

#### Scenario: 排除 manifest 自身

- **WHEN** 生成器扫描目录
- **THEN** 输出 SHALL 不含 `manifest` 的 import 或 key（避免循环引用）

#### Scenario: kebab-case 文件名转 camelCase 变量

- **WHEN** state 目录含 `mini-yaml.ts`
- **THEN** 生成的 import 变量名 SHALL 为 `miniYaml`；key 仍为原文件名 `"mini-yaml.ts"`

### Requirement: packager 从 manifest 注入 runtime 文件

`src/export/packager.ts` 的 `injectRuntimeFiles(files)` SHALL 从 `src/export/state/manifest.ts` 导入 `RUNTIME_FILES`，对每个 entry 向 `files` map 写入 `runtime/lib/<key>` = `TextEncoder().encode(value)`。**不得**使用 `fs.readdirSync` / `fs.readFileSync` / `fileURLToPath(import.meta.url)` 访问 state 目录——这些调用在 compiled binary 下失效。

#### Scenario: 正常注入

- **WHEN** 调用 `injectRuntimeFiles({})`
- **THEN** 输出 map SHALL 含 `runtime/lib/<name>.ts` 键；每个值为 `Uint8Array`，内容等于 `src/export/state/<name>.ts` 的源字节

#### Scenario: 空 manifest 触发错误

- **WHEN** `RUNTIME_FILES` 为空（例如 manifest 过期或手工删空）
- **THEN** `injectRuntimeFiles` SHALL 抛出可诊断错误，错误消息提示运行 `bun scripts/gen-state-manifest.ts`

#### Scenario: 字节保持跟源文件一致

- **WHEN** `injectRuntimeFiles` 写入 `runtime/lib/apply.ts`
- **THEN** 其字节 SHALL 与 `src/export/state/apply.ts` 磁盘字节完全一致（单元测试可直接 diff）

### Requirement: manifest 与 state 目录 parity 测试

单元测试 `tests/unit/export/state/manifest-parity.test.ts` SHALL 验证 committed `manifest.ts` 与 `src/export/state/` 当前内容一致。实现方式：测试里在内存中跑一遍生成器逻辑，对比产出与磁盘 committed 文件；不一致 → fail 并在错误消息中提示运行生成脚本。

#### Scenario: 无新增 state 文件

- **WHEN** state 目录与 committed manifest 一致
- **THEN** 测试通过

#### Scenario: state 多出未登记文件

- **WHEN** state 目录新增 `foo.ts` 但 manifest 未更新
- **THEN** 测试 SHALL fail；错误消息含 `foo.ts is in src/export/state/ but not in manifest — run 'bun scripts/gen-state-manifest.ts'`

#### Scenario: manifest 含已删除文件

- **WHEN** state 删除 `old.ts` 但 manifest 保留它
- **THEN** 测试 SHALL fail；错误消息含 `old.ts is in manifest but not in src/export/state/`

### Requirement: dev / build / test 脚本前置生成

`package.json` 的 `dev`、`build`、`test`、`test:integration`、`test:e2e` scripts SHALL 在主命令前串联 `bun scripts/gen-state-manifest.ts`，保证 manifest 永远跟 state 目录一致；手工运行子步骤（如 `bun vitest run <specific-file>`）仍可正常工作，因 committed manifest 已在磁盘。

#### Scenario: 启动 dev server

- **WHEN** 运行 `bun run dev`
- **THEN** 先执行生成器（无变更时 <50ms）；然后启动 REPL

#### Scenario: 本地 CI 模拟

- **WHEN** 运行 `bun run test`
- **THEN** 先生成 manifest，然后跑 vitest；若 state 有新增而脚本漏写（理论不可能，因同一命令第一步就生成），parity 测试兜底捕获

### Requirement: CI 守护 manifest 同步

`.github/workflows/ci.yml` SHALL 新增 `verify-state-manifest` job：在 PR 触发时跑 `bun scripts/gen-state-manifest.ts && git diff --exit-code src/export/state/manifest.ts`。任何 diff → 非零退出 → 阻断合并；错误日志引导贡献者运行生成脚本。

#### Scenario: 合规 PR

- **WHEN** PR 修改了 state 目录并同步 commit 新 manifest
- **THEN** `verify-state-manifest` job 通过

#### Scenario: 漏同步

- **WHEN** PR 改了 `state/new.ts` 但没重新生成 manifest
- **THEN** job SHALL fail；check 列表在 PR 页面标红

### Requirement: CI compiled binary smoke

`.github/workflows/ci.yml` SHALL 新增 `compiled-binary-smoke` job：在 ubuntu 上用 `SOULKILLER_TARGETS=linux-x64 bun scripts/build.ts` 产出单平台二进制；运行 `./dist/soulkiller-linux-x64 --version` 验证 binary 可启动；运行 `scripts/ci/compiled-export-smoke.ts`（或类似）触发 `injectRuntimeFiles` 关键路径，断言产物含预期 `runtime/lib/*.ts` 键。失败即阻断。

#### Scenario: 健康 binary

- **WHEN** 代码处于健康状态，compiled-binary-smoke 执行
- **THEN** binary 成功启动；smoke script 确认 `runtime/lib/` 含非空 .ts 清单；job 通过

#### Scenario: runtime 资源未打包

- **WHEN** 有人把 `injectRuntimeFiles` 改回 `fs.readdirSync` 模式
- **THEN** smoke script SHALL 捕获 ENOENT / 空键集合；job fail

### Requirement: 文档防回归

`CLAUDE.md` "Export / Skill format" 段落 SHALL 含一条 authoring guideline：**任何 packager 需要注入归档的运行时资源（源文件、模板、二进制资产）必须通过静态 import 进 bundle；禁止在 packager 代码里用 `fs.readdir` / `fs.readFileSync(path.join(dirname(import.meta.url), ...))` 访问被打包的资源**。违反此规则的 diff 在 code review 阶段应被拦截。

#### Scenario: 新贡献者加类似功能

- **WHEN** 新贡献者想给 archive 注入新类资源
- **THEN** 参照 CLAUDE.md 指引采用 manifest 或 `with { type: 'text' }` 模式；不依赖运行时 fs 扫描
