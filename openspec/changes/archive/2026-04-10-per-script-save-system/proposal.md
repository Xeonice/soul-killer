## Why

当前 skill 的存档系统使用 3 个固定 slot，与剧本（script）松耦合。用户打开 skill 后需要在 5 层菜单中层层点进才能找到自己的存档，体验割裂。同时缺少手动存档功能——用户无法在关键决策点主动保存进度快照，只有每次选择时的自动覆盖写入。

改造目标：将存档模型从"全局 slot"转为"per-script 目录"，让每个剧本自带 1 个自动存档 + 最多 3 个手动存档；重设计 Phase -1 为扁平化剧本列表，一眼可见所有剧本及存档状态；在 Phase 2 的每个选择点追加"💾 保存"选项，保存后重弹原选项继续剧情。

## What Changes

- **BREAKING** 存档目录结构从 `runtime/saves/slot-{1,2,3}/` 改为 `runtime/saves/<script-id>/{auto/, manual/<timestamp>/}`，废弃旧 slot 模型
- Phase -1 菜单重设计：首屏直接展示剧本列表（含存档状态标注），选中有存档的剧本后展示存档子菜单（自动存档 + 手动存档列表 + 从头重玩）
- Phase 2 每个 AskUserQuestion 选项列表末尾追加"💾 保存当前进度"选项，用户选择保存后写入手动存档，然后重新弹出同一组剧情选项
- Phase 2 每次剧情选择时，`state apply` 同时更新对应剧本的 `auto/` 目录（自动存档）
- state CLI 新增 `save`（创建手动快照）和 `list`（列出某剧本所有存档）子命令
- 手动存档上限 3 个，满时让用户选择覆盖哪个
- `state init` / `apply` / `validate` / `rebuild` / `reset` 路径参数从 slot 编号改为 script-id + save-type

## Capabilities

### New Capabilities
- `per-script-save`: 存档模型从全局 slot 重构为 per-script 目录结构，包括自动存档和手动存档的生命周期管理

### Modified Capabilities
- `skill-runtime-state`: state CLI 子命令路径参数和目录布局全面适配 per-script 存档模型
- `cloud-skill-format`: SKILL.md 模板的 Phase -1 菜单流程重写和 Phase 2 手动存档选项逻辑

## Impact

- `src/export/state/` — 所有 state CLI 模块（io.ts, init.ts, apply.ts, validate.ts, rebuild.ts, reset.ts, main.ts）路径逻辑重写
- `src/export/skill-template.ts` — SKILL.md 模板 Phase -1 和 Phase 2 段落大改
- `src/export/packager.ts` — 目录结构 scaffolding 更新
- `src/export/state/state.sh` — bash wrapper 参数签名变更
- `tests/unit/export-state-*.test.ts` — 全部适配新路径模型
- `tests/unit/export-packager-runtime.test.ts` — 目录结构断言更新
- 已导出的旧 skill 不兼容（断代，不做迁移）
