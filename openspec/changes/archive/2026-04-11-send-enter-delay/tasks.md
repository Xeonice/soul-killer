## 1. text-input useRef 修复

- [x] 1.1 ~~修改 send() \r 延迟~~ 已证伪并还原
- [x] 1.2 修改 `src/cli/components/text-input.tsx`：为 value 和 cursor 添加 useRef，useInput 回调从 ref 读取，每次修改后同步更新 ref
- [x] 1.3 运行 `bun vitest run tests/component/` 确认组件测试通过（140/140 pass）
- [x] 1.4 连续运行 10 次 `bun tests/e2e/run-sequential.ts`：9/10 全绿（改前 0/5）
