## Why

当前 skill 的 Phase 1 要求 LLM "把剧本保存在内部上下文中，不要输出给用户"（见 `src/export/skill-template.ts`），剧本只存在 Claude 的对话上下文里。一旦对话被压缩或结束，剧本就丢失；"从头再来"重玩时 LLM 会重新创作一个不同的故事，**重试不能复现同一个剧本**——这让"重试"语义失效。用户需要的是：第一次生成的剧本被持久化到 skill 内部文件系统，重试时加载同一份剧本再跑一遍。

## What Changes

- **BREAKING** Phase 1 行为变更：LLM 生成剧本后 SHALL 将完整剧本以 YAML 格式写入 `runtime/scripts/script-<id>.yaml`，而非仅保存在对话上下文。
- 新增 **Phase -1 剧本选择**：Skill 加载时先检查 `runtime/scripts/` 目录：
  - 为空或不存在 → 直接进入 Phase 0（长度选择）→ Phase 1（生成剧本）
  - 非空 → 列出所有已缓存剧本，通过 AskUserQuestion 让用户选择：继续某个存档 / 重试某个剧本 / 重命名剧本 / 生成新剧本
- 新增 **Script 文件格式**：YAML 文件包含 id、generated_at、user_direction、acts、characters、scenes、endings、initial_state，足以让 Phase 2 完整复现剧本。
- 新增 **Runtime 目录约定**：`runtime/scripts/` 存剧本，`runtime/saves/slot-<N>/` 存档，每个存档 SHALL 包含 `script_ref` 字段指向具体剧本 id。
- **"从头再来" 语义修正**：旧 = 重置 state 回 Phase 0（可能重新生成剧本）；新 = 重置 state 回当前 script 的初始状态，重跑同一剧本的 Phase 2。
- **新增"生成新剧本"入口**：在 Phase -1 菜单里作为显式选项，让用户主动触发新剧本创作。
- Skill 模板 (`src/export/skill-template.ts`) SHALL 生成包含上述 Phase -1 逻辑和文件读写指令的 SKILL.md。

## Capabilities

### New Capabilities
（无——所有变更都是对现有 cloud-skill-format 能力的增强）

### Modified Capabilities
- `cloud-skill-format`: SKILL.md 引擎 SHALL 新增 Phase -1 剧本选择流程；Phase 1 剧本输出目的地从"对话上下文"变为 `runtime/scripts/script-<id>.yaml` 文件；新增 runtime 目录结构要求（scripts/ 和 saves/）；"从头再来"重玩语义变更为复用当前 script。

## Impact

**代码**：
- `src/export/skill-template.ts` — Phase 流程重写，新增 Phase -1 和文件 IO 指令
- `src/export/story-spec.ts` — "重玩选项"章节的语义更新（从 Phase 0 重启 → script 重启）
- `src/export/packager.ts` — 导出产物 SHALL 确保 `runtime/` 目录结构被创建（可为空占位）

**Skill 运行时**：
- 生成 skill 的 SKILL.md 需要增加 Write/Read 工具的使用约定
- skill 运行依赖 Claude 宿主环境提供的 Read/Write 文件工具

**对已导出 skill 的影响**：
- 本 change 不会向后兼容旧 skill —— 旧 skill 继续使用旧 Phase 流程，无 script 持久化
- 新导出的 skill 全面启用新流程

**用户体验**：
- 首次运行 skill：与旧行为一致（无剧本 → 自动生成）
- 后续运行：新增剧本选择菜单，"重试"真正可复现
- 支持多剧本并存和重命名，用户可以在同一 skill 里保存多个不同命题的剧本
