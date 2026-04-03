## 1. 修复对话状态泄漏

- [x] 1.1 修复 `handleUseComplete` — 清空 `conversationMessages` 和 `conversationRef.current`
- [x] 1.2 修复 `handleCreateComplete` — 同上
- [x] 1.3 修复 evolve 路由中的 soul 切换 — 设置 soulDir 时清空对话状态
- [x] 1.4 编写测试验证 soul 切换时对话状态被清空
