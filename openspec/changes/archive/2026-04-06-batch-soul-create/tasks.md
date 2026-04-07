## 1. 批量执行管道

- [x] 1.1 创建 `src/agent/batch-pipeline.ts`，定义 `SoulInput`、`SoulTaskStatus`、`BatchResult` 类型和 `BatchProgressEvent` 事件类型
- [x] 1.2 实现 `runBatchPipeline(souls, config, dataSources, onProgress)` 函数：并发池（max 3）、流水线式 capture → distill、失败隔离
- [x] 1.3 实现重试逻辑：接受失败的 soul 名称列表，重新放入并发池执行
- [x] 1.4 为 batch-pipeline 编写单元测试（mock captureSoul / distillSoul，验证并发控制、失败隔离、进度事件）

## 2. 向导流程扩展

- [x] 2.1 在 `CreateCommand` 中新增 `soul-list` 步骤的状态和 UI：显示已添加 Soul 列表、[+] 添加 / [→] 继续 / [✕] 移除 菜单
- [x] 2.2 实现 soul-list 的 `useInput` 处理：↑↓ 移动光标、Enter 确认选项、Esc 取消
- [x] 2.3 实现 soul-list 到 name 步骤的循环：选择"添加"时回到 name，完成后追加到 `soulInputs[]` 并返回 soul-list
- [x] 2.4 实现 soul-list 分流逻辑：单个 Soul 走现有流程（tags → confirm → ...），多个 Soul 跳过 tags 直接进入 data-sources
- [x] 2.5 新增 `batch-capturing` 步骤：调用 `runBatchPipeline`，收集进度事件驱动 UI
- [x] 2.6 新增 `batch-summary` 步骤：渲染结果汇总，处理 完成/重试/查看详情 菜单交互

## 3. 批量进度视图组件

- [x] 3.1 创建 `src/cli/animation/batch-protocol-panel.tsx`，实现紧凑视图：每 Soul 一行（name、phase、进度条、fragment 数）+ 底部 summary 行
- [x] 3.2 实现光标导航：↑↓ 移动选中项高亮
- [x] 3.3 实现 Enter 展开详细视图：根据 Soul 当前阶段渲染 `SoulkillerProtocolPanel`（capture）或 `DistillProgressPanel`（distill）
- [x] 3.4 实现 Esc 从详细视图返回紧凑视图，保留光标位置
- [x] 3.5 实现进度更新节流（throttle），防止高频事件导致渲染闪烁
- [x] 3.6 为 `BatchProtocolPanel` 编写 ink-testing-library 组件测试

## 4. i18n 与收尾

- [x] 4.1 在 `src/i18n/locales/` 的 zh/en/ja JSON 中添加批量相关翻译 key（soul-list 提示、batch 进度标签、summary 文案）
- [x] 4.2 验证单 Soul 创建流程未被破坏（手动回归或现有 E2E 测试）
- [x] 4.3 批量模式下 `onComplete` 调用逻辑：为每个成功的 Soul 调用一次 `onComplete`，确保 app 状态正确更新
