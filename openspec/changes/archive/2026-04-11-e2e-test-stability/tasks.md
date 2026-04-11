## 1. 修复 text-input Enter fallthrough bug

- [x] 1.1 修改 `src/cli/components/text-input.tsx` 的 cmd palette Enter 路径：当 `filteredCommands[selectedIndex]` 为 undefined 时移除 early return，fallthrough 到普通提交
- [x] 1.2 修改 arg palette Enter 路径：同样的 fallthrough 处理
- [x] 1.3 修改 path palette Enter 路径：同样的 fallthrough 处理（已是正确模式，无需修改）
- [x] 1.4 运行 `bun vitest run tests/component/` 确认现有组件测试通过

## 2. TestTerminal sendLine() 实现

- [x] 2.1 在 `tests/e2e/harness/test-terminal.ts` 中实现 `async sendLine(input: string): Promise<void>`：逐字符发送 → waitFor 尾部回显 → 发送 `\r`
- [x] 2.2 提取共享常量和辅助函数到 `tests/e2e/harness/helpers.ts`（PROMPT_RE、timeout 常量、escapeRegex）

## 3. MockLLMServer 增强

- [x] 3.1 在 `tests/e2e/harness/mock-llm-server.ts` 中新增 `setToolHandler(toolName, handler)` 方法和 handler map 路由逻辑
- [x] 3.2 handler map 与 responseQueue 共存：优先查 handler map，无匹配时回退 responseQueue，再回退默认 responseText

## 4. 拆分测试文件

- [x] 4.1 创建 `tests/e2e/01-lifecycle.test.ts`（Scenario 1, 3），迁移用例并将 send() 替换为 sendLine()
- [x] 4.2 创建 `tests/e2e/02-create.test.ts`（Scenario 2），消除 sleep，用 sendLine + waitFor 替代
- [x] 4.3 创建 `tests/e2e/03-soul-management.test.ts`（Scenario 4），收紧 waitFor 正则
- [x] 4.4 创建 `tests/e2e/04-evolve-recall.test.ts`（Scenario 5, 9, 9b），消除 checkbox 间的 sleep(100)
- [x] 4.5 创建 `tests/e2e/05-conversation.test.ts`（Scenario 6），消除 sleep(1000)
- [x] 4.6 创建 `tests/e2e/06-error-paths.test.ts`（Scenario 7）
- [x] 4.7 创建 `tests/e2e/07-tab-completion.test.ts`（Scenario 8），消除 sleep(200)
- [x] 4.8 创建 `tests/e2e/08-export.test.ts`（Scenario 10），修复 identity 长度不足 100 字节的问题，更新断言匹配当前 /export 行为
- [x] 4.9 创建 `tests/e2e/09-distill-dimensions.test.ts`（Scenario 11）
- [x] 4.10 删除原 `tests/e2e/scenarios.test.ts`

## 5. 验证

- [x] 5.1 全量运行 `bun test tests/e2e/` 确认所有场景通过（顺序执行 12/12 pass）
- [x] 5.2 连续运行 5 次：3/5 全绿，2/5 各有 1 个随机 PTY 抖动失败（不同测试），无系统性失败
- [x] 5.3 运行 `bun run build` 类型检查通过
