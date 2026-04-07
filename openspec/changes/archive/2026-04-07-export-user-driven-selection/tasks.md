## 1. Export Agent 瘦身

- [x] 1.1 定义 `PreSelectedExportData` 接口：`{ souls, worldName, soulsData, worldData }` 及 `SoulFullData` / `WorldFullData` 类型
- [x] 1.2 修改 `runExportAgent` 签名：新增 `preSelected: PreSelectedExportData` 参数
- [x] 1.3 从 tools 对象中**删除** `list_souls`, `list_worlds`, `read_soul`, `read_world`
- [x] 1.4 删除对应的 impl 函数 `listSoulsImpl`, `listWorldsImpl`, `readSoulImpl`, `readWorldImpl`
- [x] 1.5 重写 `SYSTEM_PROMPT`：去掉所有扫描/选择/自动决策相关内容，只保留创意工作指引
- [x] 1.6 构造 initial user message：包含 world 完整数据 + 每个 soul 的完整文件内容
- [x] 1.7 保留 `package_skill` 和 `ask_user`（兜底）两个工具

## 2. Export Command UI 扩展

- [x] 2.1 在 `ExportCommand` 中新增 state：`uiStep: 'loading-lists' | 'empty-souls' | 'empty-worlds' | 'selecting-souls' | 'selecting-world' | 'loading-data' | 'running'`
- [x] 2.2 组件挂载时扫描 souls 和 worlds：直接调文件系统 + `listWorlds()`（不通过 agent）
- [x] 2.3 selecting-souls 步骤：通过 `showSoulSelector` 直接构造 panel state（multi: true）
- [x] 2.4 selecting-world 步骤：通过 `showWorldSelector` 构造 panel state（multi: false）
- [x] 2.5 0 个 souls 或 worlds 的空状态处理：showError + i18n 提示
- [x] 2.6 多选 souls 时选中 0 个的校验：保持当前 state，不进入下一步
- [x] 2.7 loading-data 步骤：调用 `readManifest` + `readSoulFiles` + `loadWorld` + `loadAllEntries` 读取所选数据
- [x] 2.8 将预读数据打包为 `PreSelectedExportData`，调用 `runExportAgent(config, preSelected, onProgress, askUser)`

## 3. Esc 导航

- [x] 3.1 selecting-souls 按 Esc → 取消 export（onCancel）
- [x] 3.2 selecting-world 按 Esc → 返回 selecting-souls

## 4. i18n 适配

- [x] 4.1 添加 i18n key: `export.step.select_souls` / `export.step.select_world` / `export.step.loading_data`
- [x] 4.2 添加 soul 和 world 列表为空时的提示文案
- [x] 4.3 添加"至少选择一个角色"的校验提示

## 5. 验证

- [x] 5.1 `bun run build` 类型检查通过
- [x] 5.2 `bun run test` 单元测试通过（558 tests 全部通过，无需适配）
- [~] 5.3 手动测试：/export 流程 — 验证零 list/read 调用 — 已通过日志确认（log 中 package_skill 是唯一 tool 调用）
- [~] 5.4 手动测试：单 soul + 单 world — 架构兼容，但端到端验证移至 `export-staged-tool-calls` change
- [~] 5.5 手动测试：4 个同世界 souls 多角色 — package_skill 大输入暴露了 LLM 工具设计缺陷，重构由 `export-staged-tool-calls` change 处理
- [~] 5.6 手动测试：Esc 行为 — 代码已实现，待新 change 端到端验证
