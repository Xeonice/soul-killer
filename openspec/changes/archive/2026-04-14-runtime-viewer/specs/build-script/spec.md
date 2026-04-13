## MODIFIED Requirements

### Requirement: 构建流程包含 viewer 前端编译

`build.ts` SHALL 在 Phase 1 (Bundle) 之前新增两个步骤：Phase 0 执行 `vite build` 编译 viewer 前端，Phase 0.5 将产物生成为 barrel 模块。

#### Scenario: vite build 成功后生成 barrel 模块

- **WHEN** 执行 `bun scripts/build.ts`
- **THEN** SHALL 先执行 `packages/viewer` 的 vite build，然后将 `dist/` 下所有文件转为字符串常量写入 `src/export/state/viewer-bundle.ts`，最后执行现有的 Bundle + Compile 流程

#### Scenario: vite build 失败时中断构建

- **WHEN** `vite build` 执行失败（非零退出码）
- **THEN** SHALL 打印错误信息并以非零退出码终止，不继续后续编译步骤
