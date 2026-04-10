## 1. 创建共享 repairToolCall 函数

- [x] 1.1 创建 `src/infra/utils/repair-tool-call.ts`，导出 `createArrayArgRepair()` 函数
- [x] 1.2 实现修复逻辑：检测 string 类型的 array 参数 → JSON.parse → 正则 fallback → 返回修复后的 tool call
- [x] 1.3 为 repair 函数编写单元测试（`tests/unit/repair-tool-call.test.ts`）

## 2. 回滚 z.preprocess

- [x] 2.1 `story-setup.ts`：移除 `coerceStringArray`/`coerceObjectArray` 的 `z.preprocess` 包装，恢复 `z.array()` 定义（3 个参数：options, constraints, ip_specific）
- [x] 2.2 `planning.ts`：移除 `coerceStringArray` 的 `z.preprocess` 包装（flags 参数）
- [x] 2.3 `supplement-search.ts`：移除 `coerceStringArray` 的 `z.preprocess` 包装（keywords 参数）
- [x] 2.4 `report-findings.ts`：移除 `coerceObjectArray` 的 `z.preprocess` 包装（dimensionStatus 参数）
- [x] 2.5 `distill-agent.ts`：移除 `coerceObjectArray` 的 `z.preprocess` 包装（messages 参数）
- [x] 2.6 删除 `src/infra/utils/zod-preprocess.ts`
- [x] 2.7 移除各文件中 `zod-preprocess.ts` 的 import

## 3. 添加 inputExamples

- [x] 3.1 `story-setup.ts` `set_story_metadata`：添加 inputExamples（含 constraints 数组样例）
- [x] 3.2 `story-setup.ts` `set_prose_style`：添加 inputExamples（含 ip_specific 数组样例 + forbidden_patterns_csv 样例）
- [x] 3.3 `story-setup.ts` `ask_user`：添加 inputExamples（含 options 对象数组样例）
- [x] 3.4 `planning.ts` `plan_story`：添加 inputExamples（含 flags 数组样例）
- [x] 3.5 `supplement-search.ts`：添加 inputExamples（含 keywords 数组样例）
- [x] 3.6 `report-findings.ts`：添加 inputExamples（含 dimensionStatus 对象数组样例）
- [x] 3.7 `distill-agent.ts` `writeExampleTool`：添加 inputExamples（含 messages 对象数组样例）

## 4. 启用 strict mode

- [x] 4.1 `story-setup.ts` `set_prose_style`：添加 `strict: true`
- [x] 4.2 `story-setup.ts` `set_story_metadata`：添加 `strict: true`

## 5. 挂载 repairToolCall

- [x] 5.1 `story-setup.ts` ToolLoopAgent 构造：添加 `experimental_repairToolCall: createArrayArgRepair()`
- [x] 5.2 `character.ts` ToolLoopAgent 构造：添加 `experimental_repairToolCall: createArrayArgRepair()`
- [x] 5.3 检查其他 ToolLoopAgent 构造点（distill-agent、capture-agent），酌情添加

## 6. 验证

- [x] 6.1 `bun run build` 通过
- [x] 6.2 `bun run test` 全部通过（81 files, 918 tests）
- [x] 6.3 手动测试 `/export` 流程，set_prose_style 首次类型通过，forbidden_patterns 改为 object array 后分隔符问题消除
