## Why

E2E 测试存在概率性失败（flaky），12 个场景中 Scenario 4 和 Scenario 10 每 3-5 次运行就有 1 次超时。根因是 text-input 组件的 Enter 键处理在 palette 打开时会静默吞掉输入（产品 bug），加上 TestTerminal 的 `send()` 方法在 `\r` 发送前不等待 React 渲染完成（测试基础设施缺陷）。测试代码本身也有结构性债务影响可维护性。

## What Changes

- 修复 `text-input.tsx` 的 Enter 处理逻辑：当 cmd/arg/path palette 打开但 `selectedIndex` 越界时，fallthrough 到普通提交路径而不是静默吞掉 Enter
- TestTerminal 新增 `sendLine()` 方法：逐字符发送后等待终端回显确认再发 `\r`，保留原 `send()` 作为低级 API
- 拆分 `scenarios.test.ts`（602 行单文件）为按 group 独立的测试文件
- MockLLMServer 增加按 tool name 动态响应模式，替代脆弱的固定序列 responseQueue
- 移除硬编码 `sleep(100-1000ms)`，替换为 `waitFor` 语义等待
- 收紧 `waitFor` 的正则模式，避免误匹配 palette 菜单文本
- 更新 Scenario 10 以匹配当前 `/export` 的实际行为

## Capabilities

### New Capabilities
- `e2e-harness-reliability`: TestTerminal 的 sendLine() 回显等待机制和 MockLLMServer 的动态响应模式
- `text-input-enter-robustness`: text-input 组件 Enter 键处理的 fallthrough 修复

### Modified Capabilities

## Impact

- `src/cli/components/text-input.tsx` — Enter 键处理逻辑变更（产品代码）
- `tests/e2e/harness/test-terminal.ts` — 新增 sendLine()
- `tests/e2e/harness/mock-llm-server.ts` — 新增 tool name 动态响应
- `tests/e2e/scenarios.test.ts` — 拆分为多个文件 + 更新用例
- 不影响任何外部 API 或用户可见行为（除了 Enter 键边界情况修复）
