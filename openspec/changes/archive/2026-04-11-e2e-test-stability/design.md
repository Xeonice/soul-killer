## Context

E2E 测试通过 Bun.spawn PTY 启动真实 CLI 进程，用 `TestTerminal.send()` 逐字符（10ms 间隔）模拟用户输入。text-input 组件在输入 `/` 前缀时会打开 command palette，Enter 键的处理分为 palette 路径和普通提交路径。当 Enter 到达时 palette 状态与 value 不一致（React 渲染延迟），Enter 会被静默吞掉。

当前测试架构：单文件 602 行含 12 个场景，MockLLMServer 在多个 describe 块各自创建，用固定序列 responseQueue 模拟 agent tool calling。

## Goals / Non-Goals

**Goals:**
- 消除 Scenario 4 和 Scenario 10 的 flaky 失败
- 修复 text-input 组件 Enter 被静默吞掉的产品 bug
- 让 TestTerminal 的输入方法具备"发送前确认就绪"的能力
- 提高测试的可维护性和可独立运行性

**Non-Goals:**
- 不迁移到其他测试框架（bun:test 是正确选择）
- 不改变 PTY spawn 的基本架构（已是最佳实践）
- 不增加新的 E2E 场景（专注修复现有场景的稳定性）
- 不重构 text-input 的 autocomplete 核心逻辑（只修 Enter 边界情况）

## Decisions

### D1: text-input Enter 处理改为 fallthrough 而非 early return

**选择**：当 palette 打开但 `filteredCommands[selectedIndex]` 为 undefined 时，不再 `return` 吞掉 Enter，而是 fallthrough 到普通提交路径（提交 `value` 原文）。

**替代方案**：clamp selectedIndex 到合法范围。拒绝原因：即使 clamp 了，palette 中的选中项可能不是用户意图的命令（用户打完了 `/list` 但 palette 可能还在显示旧的过滤结果）。直接提交 value 更符合用户意图。

**影响范围**：cmd palette、arg palette、path palette 三处 Enter 路径都需要同样的 fallthrough 处理。

### D2: 新增 sendLine() 方法，send() 保持不变

**选择**：TestTerminal 新增 `async sendLine(input: string)` 方法——逐字符发送后，等待终端回显（waitFor 输入文本的尾部片段），确认 React 渲染完成后再发 `\r`。原 `send()` 保留为低级 fire-and-forget API。

**回显匹配策略**：等待输入文本的最后 4 个字符出现在 `since: 'last'` 的 buffer 中。不用完整匹配，因为 palette 菜单文本可能包含命令名；用尾部片段 + cursor 位置更可靠。

**替代方案**：在 `\r` 前加固定 sleep（如 50ms）。拒绝原因：仍是猜测性延迟，在 CI 慢环境下可能不够，在本地又浪费时间。

### D3: 拆分测试文件，按 group 独立

**选择**：将 `scenarios.test.ts` 拆分为：
- `01-lifecycle.test.ts` — Scenario 1, 3
- `02-create.test.ts` — Scenario 2
- `03-soul-management.test.ts` — Scenario 4
- `04-evolve-recall.test.ts` — Scenario 5, 9, 9b
- `05-conversation.test.ts` — Scenario 6
- `06-error-paths.test.ts` — Scenario 7
- `07-tab-completion.test.ts` — Scenario 8
- `08-export.test.ts` — Scenario 10
- `09-distill-dimensions.test.ts` — Scenario 11

每个文件自包含 setup/teardown。共享的常量和辅助函数提取到 `harness/helpers.ts`。

**注意**：bun:test 支持文件级并行但不会自动并行（需要多个文件才能并行）。拆分后可用 `bun test tests/e2e/03-*` 单独运行某组。

### D4: MockLLMServer 增加 handler map 模式

**选择**：新增 `setToolHandler(toolName, handler)` 方法，按 tool name 动态响应，替代固定的 responseQueue 序列。保留 responseQueue 作为向后兼容选项。

```typescript
mockServer.setToolHandler('list_souls', (args) => ({
  type: 'tool_result',
  content: JSON.stringify([{ name: 'alice' }]),
}))
```

**原因**：固定序列脆弱——agent 流程中任何一步的顺序变化都会导致后续所有 mock 对不上。按 tool name 响应则只关心"什么 tool 被调用"，不关心调用顺序。

### D5: 消除硬编码 sleep

**选择**：所有 5 处 `await new Promise(r => setTimeout(r, N))` 替换为对应的 `waitFor` 语义等待。

| 位置 | 当前 | 替换为 |
|------|------|--------|
| create wizard soul-list 后 | sleep(100) | sendLine 内部已等待回显 |
| evolve checkbox 每步之间 | sleep(100) ×3 | sendKey 后 waitFor 下一状态 |
| conversation 流式响应后 | sleep(1000) ×2 | waitFor prompt 返回 |
| list 后 Esc | sleep(200) | waitFor prompt |

## Risks / Trade-offs

- **[Risk] sendLine 的回显匹配可能被 palette 菜单文本干扰** → Mitigation：使用 `since: 'last'` + cursor-aware 匹配，palette 文本在之前帧已出现不会被重复匹配
- **[Risk] 拆分文件后 MockLLMServer 端口冲突** → Mitigation：所有 MockLLMServer 使用 port=0（随机端口），已有此实现
- **[Risk] text-input fallthrough 改变了 palette Enter 的语义** → Mitigation：只在 selected===undefined 时 fallthrough（正常情况下 selectedIndex 不会越界，这是防御性修复）
