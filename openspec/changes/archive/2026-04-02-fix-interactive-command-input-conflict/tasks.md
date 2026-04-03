## 1. App 修改

- [x] 1.1 在 AppState 中新增 `interactiveMode: boolean`，默认 false
- [x] 1.2 交互式命令（create, use, publish, link, feed, distill）启动时设置 `interactiveMode: true`
- [x] 1.3 交互式命令的 onComplete/error 回调中恢复 `interactiveMode: false`
- [x] 1.4 主 REPL 渲染中：`interactiveMode` 为 true 时不渲染 TextInput 和 SoulPrompt

## 2. 验证

- [x] 2.1 运行现有测试确认无回归（108 个测试全部通过）
- [x] 2.2 编译通过，interactiveMode 逻辑正确：/create 启动时隐藏主 TextInput，完成后恢复
