## 1. 小模块迁入 infra

- [x] 1.1 迁移 llm/ → infra/llm/（client.ts, models.ts, stream.ts）
- [x] 1.2 迁移 engine/ → infra/engine/（adapter.ts, detect.ts, local-engine.ts, docker-engine.ts）
- [x] 1.3 迁移 utils/ → infra/utils/（logger.ts, agent-logger.ts）
- [x] 1.4 迁移 i18n/ → infra/i18n/（index.ts + locales/*.json）

## 2. Tags 按领域拆分

- [x] 2.1 迁移 tags/taxonomy.ts + tags/parser.ts → soul/tags/
- [x] 2.2 迁移 tags/world-taxonomy.ts → world/tags/

## 3. Pack 迁入 export

- [x] 3.1 迁移 pack/ → export/pack/（packer.ts, unpacker.ts, meta.ts, checksum.ts）

## 4. Export 三层重组

- [x] 4.1 创建 export/spec/ 并迁入 skill-template.ts + story-spec.ts
- [x] 4.2 创建 export/support/ 并合并 lint/ + prose-style/ + format/ 的文件
- [x] 4.3 删除空的旧目录 lint/, prose-style/, format/

## 5. Import 路径更新

- [x] 5.1 更新所有引用 llm/ 的 import（→ infra/llm/）
- [x] 5.2 更新所有引用 engine/ 的 import（→ infra/engine/）
- [x] 5.3 更新所有引用 utils/ 的 import（→ infra/utils/）
- [x] 5.4 更新所有引用 i18n/ 的 import（→ infra/i18n/）
- [x] 5.5 更新所有引用 tags/ 的 import（→ soul/tags/ 或 world/tags/）
- [x] 5.6 更新所有引用 pack/ 的 import（→ export/pack/）
- [x] 5.7 更新 export/ 内部引用 skill-template, story-spec 的 import（→ spec/）
- [x] 5.8 更新 export/ 内部引用 lint/, prose-style/, format/ 的 import（→ support/）
- [x] 5.9 更新迁移后文件自身的内部 import 路径

## 6. 清理与验证

- [x] 6.1 删除空的旧目录：tags/, llm/, engine/, utils/, i18n/, pack/
- [x] 6.2 运行 `bun run build` 确认类型检查通过
- [x] 6.3 运行 `bun run test` 确认测试通过（909/909）
