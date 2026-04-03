## Context

当前 `/feed <path>` 和 `/distill` 是两个独立命令。`/feed` 需要手动传入文件路径并要求已加载 soul，`/distill` 同样要求已加载 soul。用户典型工作流是先 `/use <soul>` → `/feed <path>` → `/distill`，三步操作。

现有基础设施：
- `ARG_COMPLETION_MAP` 已为 `/use` 命令提供 soul 列表补全（`listLocalSouls()`）
- `TextInput` 组件支持 `argCompletionMap`、`pathCompletion`、`completionItems` 三种补全模式
- `FeedCommand` 和 `DistillCommand` 已作为独立 ink 组件存在

## Goals / Non-Goals

**Goals:**
- 将 `/feed` + `/distill` 合并为 `/evolve <soul>` 一个命令
- `/evolve` 后的参数带 soul 名称补全，来源为 `listLocalSouls()`
- 用户输入可实时筛选 soul 列表
- 输入不存在的 soul 名称时，显示错误并跳回 `/` 初始状态（清空输入、恢复命令面板）
- 进入 `/evolve` 后的交互流程：先选数据源路径 → feed → 自动 distill

**Non-Goals:**
- 不改变 feed 或 distill 的内部逻辑（ingest pipeline、distill sampler/extractor/generator）
- 不改变 `TextInput` 组件的补全核心机制
- 不增加批量 evolve 多个 soul 的能力

## Decisions

### D1: 新命令命名为 `/evolve`

**选择**: `/evolve <soul>`
**替代方案**: `/update`、`/refresh`、`/sync`
**理由**: "evolve" 契合赛博朋克主题，暗示 soul 的进化和成长，语义上涵盖"喂入新数据并重新蒸馏"的完整流程。

### D2: 创建 `EvolveCommand` 组合组件

**选择**: 新建 `src/cli/commands/evolve.tsx`，内部编排 feed → distill 两阶段
**替代方案**: 在 `app.tsx` 的 `handleInput` 中内联编排
**理由**: 保持 `app.tsx` 的路由职责单一。`EvolveCommand` 作为状态机管理两阶段流转，内部可复用现有 `FeedCommand` 的 ingest 逻辑和 `DistillCommand` 的蒸馏逻辑（或直接调用底层 pipeline/distill 函数）。

### D3: 复用 `ARG_COMPLETION_MAP` 机制

**选择**: 在 `ARG_COMPLETION_MAP` 中注册 `evolve` 条目，provider 与 `use` 相同
**替代方案**: 为 evolve 定制新的补全机制
**理由**: 现有 `argCompletionMap` 机制已经满足需求（soul 列表补全 + 筛选 + Tab/Enter 确认），无需重复造轮子。

### D4: 不存在的 soul 名称处理 — 错误提示 + 跳回初始态

**选择**: 在 `handleInput` 的 `case 'evolve'` 中校验 soul 名称是否存在于 `listLocalSouls()`，不存在则 setState 设置 error 并保持在 idle 状态（非 interactiveMode），用户自动回到 `/` 命令输入
**替代方案**: 在补全面板中完全阻止提交不存在的名称
**理由**: 用户可能绕过补全直接回车输入，需要在 handler 层做兜底校验。补全面板已经提供筛选能力来引导正确输入，handler 层做最终校验。

### D5: Evolve 交互流程

阶段一：选择数据源路径（复用 pathCompletion）→ 执行 feed（ingest pipeline）
阶段二：feed 完成后自动触发 distill（无需用户额外确认）
全流程在 `interactiveMode: true` 下运行，完成后恢复 idle。

## Risks / Trade-offs

- **[Breaking Change]** `/feed` 和 `/distill` 移除 → 已习惯旧命令的用户需要适应。缓解：help 面板已无这两个命令，用户输入旧命令时 `suggestCommand` 可以建议 `/evolve`。
- **[组件复用]** `EvolveCommand` 需要编排路径选择 + ingest + distill 三步 → 比单独命令复杂度高。缓解：拆分为内部子阶段状态机，每阶段逻辑独立。
- **[自动 distill]** feed 后自动 distill 可能在大数据量时耗时较长 → 用户无法跳过。缓解：distill 阶段有进度显示（已有 `DistillCommand` 的进度 UI），用户可通过 Escape 退出 interactiveMode。
