## Why

E2E 覆盖了 9/13 个命令。高风险的 `/world`（16 步向导）和 batch create（并行流程）、中风险的 `/pack`+`/unpack`（数据完整性）和 arg completion（交互补全）缺少覆盖。

## What Changes

新增 4 个 E2E 测试文件：
- `10-world.test.ts` — `/world` create 向导的交互 UI 步骤（到 data-sources 为止，不需要真实 LLM）
- `11-batch-create.test.ts` — 多 soul 输入 → soul-list 循环 → batch 启动
- `12-pack-unpack.test.ts` — `/pack soul <name>` 生成文件 → `/unpack <path>` 安装
- `13-arg-completion.test.ts` — `/use ` + Tab 显示 soul 列表补全

## Capabilities

### New Capabilities

### Modified Capabilities

## Impact

- 仅新增 `tests/e2e/` 下的测试文件
- 可能需要在 `tests/e2e/fixtures/soul-fixtures.ts` 中添加辅助函数
- 不修改任何产品代码
