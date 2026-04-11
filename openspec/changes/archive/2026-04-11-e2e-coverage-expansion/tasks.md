## 1. /world create 向导测试

- [x] 1.1 创建 `tests/e2e/10-world.test.ts`：Scenario 12 — `/world` → top menu → Create → type-select → name → display-name → description → confirm，验证 world 目录和 manifest 被创建

## 2. batch create 测试

- [x] 2.1 创建 `tests/e2e/11-batch-create.test.ts`：Scenario 13 — `/create` → type-select → name+desc (soul 1) → soul-list → Add → name+desc (soul 2) → soul-list 显示 2 个 → Continue → 到达 data-sources 步骤

## 3. pack/unpack 测试

- [x] 3.1 创建 `tests/e2e/12-pack-unpack.test.ts`：Scenario 14 — createDistilledSoul → `/pack soul <name>` → 验证 pack 文件存在 → 删除原 soul → `/unpack <path>` → 验证 soul 目录恢复

## 4. arg completion 测试

- [x] 4.1 创建 `tests/e2e/13-arg-completion.test.ts`：Scenario 15 — createDistilledSoul × 2 → 输入 `/use ` → waitFor arg palette 显示 → 验证两个 soul 名称出现

## 5. 验证

- [x] 5.1 运行新增测试确认全部通过
- [x] 5.2 运行全量 `bun tests/e2e/run-sequential.ts` 确认无回归（2/3 全绿，13 files 16 scenarios）
