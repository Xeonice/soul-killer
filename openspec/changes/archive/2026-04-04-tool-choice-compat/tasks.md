## 1. Agent 修改

- [x] 1.1 将 `toolChoice: 'required'` 改为 `'auto'`
- [x] 1.2 移除 prepareStep 中的 activeTools 阶段控制（Phase 1/Phase 2 的 activeTools 返回），保留 doom loop 检测和最后一步强制
- [x] 1.3 更新 CAPTURE_SYSTEM_PROMPT — 在 Workflow 部分加入明确的工具调用优先指令和步骤顺序引导

## 2. 验证

- [x] 2.1 类型检查通过、现有测试不回退
- [x] 2.2 用 deepseek-v3.2 测试 agent 能正常多步搜索 — 已验证通过
