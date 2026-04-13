## 1. 类型扩展

- [x] 1.1 在 `src/world/distill.ts` 的 `WorldDistillProgress` 接口中新增 `historySubProgress?` 字段

## 2. distill.ts 进度输出

- [x] 2.1 Pass A 开始和完成时 emit 携带 `historySubProgress: { pass: 'A' }`
- [x] 2.2 Pass B 内部每个事件完成后 emit progress + agentLog.distillBatch（per-event 粒度）
- [x] 2.3 Pass C 开始和完成时 emit 携带 `historySubProgress: { pass: 'C' }`

## 3. UI 渲染

- [x] 3.1 修改 `world-distill-panel.tsx`：检测 `historySubProgress`，在 history 维度行下方渲染 Pass 子阶段 + Pass B 的 event 进度（最近 3 个 + 当前）

## 4. 验证

- [x] 4.1 运行 `bun run test` 确认全部测试通过（83 文件 945 用例）
