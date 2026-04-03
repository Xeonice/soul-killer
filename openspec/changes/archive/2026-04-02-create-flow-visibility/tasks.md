## 1. 蒸馏进度事件系统

- [x] 1.1 在 `src/distill/extractor.ts` 中定义 `DistillPhase` 和 `DistillProgress` 类型
- [x] 1.2 修改 `extractFeatures()` 签名，新增可选 `onProgress` 回调参数
- [x] 1.3 在 identity/style/behavior 提取循环中 emit started/in_progress/done 事件（含 batch 进度）
- [x] 1.4 在 `mergeResults()` 调用前后 emit merge started/done 事件
- [x] 1.5 创建 `src/cli/components/distill-progress.tsx` — 蒸馏进度展示组件（阶段列表 + spinner）

## 2. 重名检测与冲突解决

- [x] 2.1 在 `src/cli/commands/create.tsx` 新增 `name-conflict` 步骤到 CreateStep 类型
- [x] 2.2 在 confirm 确认后插入重名检测逻辑：检查 soul 目录是否存在，读取 manifest 信息
- [x] 2.3 实现冲突解决 UI：三选一（覆盖重建 / 追加数据 / 换名），展示已有灵魂元数据
- [x] 2.4 实现"覆盖重建"逻辑：删除已有 soul 目录后继续正常流程
- [x] 2.5 实现"追加数据"逻辑：读取已有灵魂的 chunks.json，合并到 allChunks 后进入蒸馏
- [x] 2.6 实现"换名"逻辑：回退到 name 步骤

## 3. 搜索结果确认节点

- [x] 3.1 在 `src/cli/commands/create.tsx` 新增 `search-confirm` 步骤到 CreateStep 类型
- [x] 3.2 修改 Agent 搜索完成后的流转：成功时进入 `search-confirm` 而非 setTimeout 跳转
- [x] 3.3 实现搜索结果确认 UI：展示分类/来源/片段数，三选一（确认 / 重新搜索 / 补充数据源），默认选中确认
- [x] 3.4 实现"重新搜索"逻辑：清空 agent 状态，回退到 name 步骤
- [x] 3.5 实现"补充数据源"逻辑：保留搜索结果，跳转到 data-sources 步骤

## 4. 创建流程集成蒸馏进度

- [x] 4.1 修改 `startDistill()` 中的 `extractFeatures()` 调用，传入 onProgress 回调
- [x] 4.2 在 distilling 步骤的 UI 中使用 DistillProgress 组件替换简单的"蒸馏中..."文本
- [x] 4.3 在 generate 阶段（generateSoulFiles + generateManifest）前后 emit generate started/done

## 5. 测试

- [x] 5.1 为蒸馏进度事件编写单元测试：验证 onProgress 在各阶段被正确调用
- [x] 5.2 为重名检测编写组件测试：验证存在同名灵魂时展示冲突选项
- [x] 5.3 为搜索结果确认编写组件测试：验证确认/重搜/补充三个选项的流转
