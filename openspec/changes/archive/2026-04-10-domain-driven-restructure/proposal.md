## Why

项目当前按"机制"组织目录（agent/, distill/, ingest/, engine/），但实际有三个明确的业务领域（soul, world, export）。导致代码散落：export-agent.ts（2,453 行）在 agent/ 下但服务 export 领域；distill/ 全部 5 个文件服务 soul 领域；agent/strategy/ 下的文件按 soul/world 分成两组但混在同一目录。开发者需要跨 3-4 个目录才能理解一个领域的完整流程。cli/commands/ 24 个文件全部平铺，world 系列 7 个文件用 `-` 做伪命名空间。

## What Changes

- **BREAKING** 按领域重组 `src/` 目录结构：将分散在 agent/, distill/, ingest/ 中属于特定领域的文件迁移到对应的领域目录（soul/, world/, export/）
- 新增 `src/infra/` 目录，收纳被多个领域共用的基础设施（搜索后端、通用 agent 循环、planning 框架、数据适配器）
- `cli/commands/` 按领域建子目录（soul/, world/, export/, system/），消除平铺的 24 文件列表
- 拆分 `agent/export-agent.ts`（2,453 行）为 `export/agent/` 下的多个模块
- 更新所有受影响文件的 import 路径
- 更新 `cli/commands/index.ts` 的注册表 import 路径

## Capabilities

### New Capabilities
- `domain-directory-layout`: 定义 src/ 按领域（soul, world, export）+ 基础设施（infra）+ UI（cli）组织的目录规范

### Modified Capabilities

（无行为变更，纯文件重组）

## Impact

- **全量 import 路径变更**：预计影响 ~100 个文件的 import 语句
- **测试文件**：tests/ 中引用 src/ 路径的 import 需要同步更新
- **不影响**：任何运行时行为、API、配置文件格式、用户可见功能
- **风险**：一次性大量文件移动，git blame 历史会断裂（可用 `git log --follow` 追溯）
