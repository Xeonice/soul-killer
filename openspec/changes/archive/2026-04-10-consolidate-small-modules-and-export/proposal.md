## Why

重构后 src/ 顶层仍有 12 个目录，其中 5 个是不到 400 行的微模块（tags/170, llm/163, engine/251, utils/395, i18n/26），全部是跨领域基础设施却独占顶层位置。export/ 内部 6 个子目录 + 3 个散落文件混合了三种不同层级的关注点。pack/ 只被 export 命令引用，应归入 export 领域。tags/ 中 taxonomy.ts 服务 soul，world-taxonomy.ts 服务 world，应按领域拆分。

## What Changes

- **小模块合并至 infra/**：将 llm/, engine/, utils/, i18n/ 合入 infra/ 对应子目录
- **tags/ 按领域拆分**：taxonomy.ts + parser.ts → soul/tags/，world-taxonomy.ts → world/tags/
- **pack/ 合入 export/**：packer/unpacker/meta/checksum 迁入 export/pack/
- **export/ 三层重组**：
  - 层级 1（流程编排）：agent/ — 不动
  - 层级 2（产物定义）：spec/ — skill-template.ts + story-spec.ts 迁入
  - 层级 3（辅助工具）：support/ — lint/ + prose-style/ + format/ 合并
  - state/ — 不动（独立运行时）
  - pack/ — 从 src/pack/ 迁入
- **更新所有受影响的 import 路径**

## Capabilities

### New Capabilities
- `infra-consolidation`: 定义 infra/ 作为所有跨领域基础设施统一入口的目录规范

### Modified Capabilities

（无行为变更，纯文件重组）

## Impact

- **删除顶层目录**：tags/, llm/, engine/, utils/, i18n/, pack/（6 个 → 0 个）
- **src/ 顶层**：从 12 个目录缩减到 6 个（cli, export, world, soul, infra, config）
- **import 路径变更**：预计影响 ~60 个文件
- **不影响**：任何运行时行为
