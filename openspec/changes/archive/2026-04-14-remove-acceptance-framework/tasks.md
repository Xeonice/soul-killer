## 1. 删除 acceptance 框架代码

- [x] 1.1 删除 `acceptance/` 目录（7 个文件）
- [x] 1.2 从 `package.json` 中移除 `verify` 和 `diagnose` 脚本

## 2. 删除 acceptance 框架的 OpenSpec specs

- [x] 2.1 删除 `openspec/specs/acceptance-cli/` 目录
- [x] 2.2 删除 `openspec/specs/acceptance-dsl/` 目录
- [x] 2.3 删除 `openspec/specs/acceptance-runner/` 目录

## 3. 验证

- [x] 3.1 `bun run build`（tsc --noEmit）确认零 TypeScript 错误
- [x] 3.2 `bun run test` 确认所有单元测试通过（974/974）
