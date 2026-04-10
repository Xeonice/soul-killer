## 1. 修改 maxSteps 公式

- [x] 1.1 将 `maxSteps = Math.min(dimCount * 2 + 5, 80)` 改为 `Math.max(30, Math.min(dimCount * 3 + 8, 80))`

## 2. prepareStep prompt 引导

- [x] 2.1 在 prepareStep 的 fallback 分支，用 `activeTools: ['reportFindings']` 限制可用工具，强制模型只能调 reportFindings

## 3. 验证

- [x] 3.1 编译通过 + 测试全过
