## 1. Error 状态键盘处理

- [x] 1.1 在 `create.tsx` 的 `useInput` 中添加 `step === 'error'` 分支，处理 Esc（onCancel）、上下键（切换 errorCursor）、Enter（执行选择）
- [x] 1.2 添加 `errorCursor` state（0=重试, 1=返回）

## 2. Error UI 改造

- [x] 2.1 将 error 渲染从纯文本改为双选菜单（重试 / 返回 REPL），使用 errorCursor 高亮
- [x] 2.2 三语 i18n 新增 `create.error.retry` 和 `create.error.back` 文案

## 3. 重试逻辑

- [x] 3.1 实现重试函数：重置 agent 状态（toolCalls、classification、origin、chunks、protocolPhase、agentLogRef、error），根据 soulType 决定入口（public→capturing, personal→data-sources）
