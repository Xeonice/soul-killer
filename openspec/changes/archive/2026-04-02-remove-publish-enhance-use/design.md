## Context

当前 `/publish` 通过 `execSync` 同步执行 git init/add/commit/push，安全性和用户体验都有问题。`/link` 依赖已发布的 soul，也一并移除。

`/use <soul>` 已有 `ARG_COMPLETION_MAP` 中的 soul 名称补全，但 handler 层不做存在性校验 — 直接进入 `UseCommand` 组件，由组件内部判断 not-found。这导致用户输入不存在的名称时会看到加载动画再显示 not-found，体验不如 `/evolve` 那样即时反馈。

## Goals / Non-Goals

**Goals:**
- 完全移除 `/publish` 和 `/link` 命令（registry、handler、组件、i18n）
- `/use` handler 层增加 `listLocalSouls()` 校验，不存在时设置 error + suggestions 并跳回 idle
- 保留 `UseCommand` 组件内部的 not-found 处理作为防御性逻辑

**Non-Goals:**
- 不改变 `/use` 的核心加载逻辑（RelicLoadAnimation、soulDir 解析）
- 不实现远程 soul 下载（`UseCommand` 中的 "远程下载功能暂未实现" 保持不变）
- 不改变 `ARG_COMPLETION_MAP` 中 `/use` 的补全配置（已正常工作）

## Decisions

### D1: `/use` handler 层校验复用 `/evolve` 模式

**选择**: 在 `case 'use'` 中调用 `listLocalSouls()` 查找目标 soul，不存在时 setState error，与 `/evolve` 行为一致。
**理由**: 统一命令行为模式。用户在补全面板中选择的 soul 一定存在，但手动输入可能有误，需要快速反馈。

### D2: 直接删除 publish.tsx 和 link.tsx

**选择**: 物理删除文件，而非保留空壳。
**理由**: 这些文件不再被引用，保留只会造成困惑。

## Risks / Trade-offs

- **[Breaking Change]** `/publish` 和 `/link` 移除 → 已使用的用户无法继续使用。缓解：输入旧命令时 `suggestCommand` 不会匹配到已删除的命令，会显示 "unknown command"。
- **[UseCommand 重复校验]** handler 层和组件层都检查 soul 存在性 → 轻微冗余。缓解：组件层作为防御性逻辑保留，不增加维护负担。
