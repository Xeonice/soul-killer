## 1. World 补充模式外部入口

- [x] 1.1 WorldCreateWizard 增加 `supplementWorld?: string` prop，传入时加载已有 manifest 并设 supplementMode=true，初始 step 跳到 data-sources
- [x] 1.2 world.tsx 蒸馏操作改为渲染 `<WorldCreateWizard supplementWorld={worldName} onComplete={backToActionMenu} onCancel={backToActionMenu} />`
- [x] 1.3 验证：E2E 测试 world 蒸馏操作进入 wizard 补充模式

## 2. Soul 补充模式

- [x] 2.1 CreateCommand 增加 `supplementSoul?: { name: string; dir: string }` prop，传入时加载已有 manifest，设补充模式 flag，初始 step 跳到 data-sources
- [x] 2.2 CreateCommand 补充模式蒸馏后增加 merge 步骤：createSnapshot → extractFeatures → mergeSoulFiles → generateSoulFiles → appendEvolveEntry
- [x] 2.3 app.tsx `/evolve` 命令（无子命令时）改为渲染 `<CreateCommand supplementSoul={{name, dir}} />`
- [x] 2.4 保留 `/evolve status` 和 `/evolve rollback` 原有路由不变

## 3. 测试与验证

- [x] 3.1 type check: `bun run build`
- [x] 3.2 单元/组件测试: `bun vitest run tests/unit/ tests/component/`
- [x] 3.3 E2E: world 管理→蒸馏 进入 wizard 补充模式
- [x] 3.4 E2E: `/evolve` 进入 CreateCommand 补充模式
