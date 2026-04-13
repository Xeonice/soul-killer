## Why

导出的 .skill 视觉小说在 Phase 2 运行时，玩家无法查看当前剧本的分支全貌——不知道走过了哪些路、错过了哪些选择、离哪个结局更近。script.json 里已经有完整的场景图（scenes → choices → next），但没有 choice history 记录，也没有可视化入口。

## What Changes

- **state apply 追加 history**：每次 apply 成功后，在 `runtime/saves/<script-id>/auto/history.log` 追加 `scene-id:choice-id` 一行
- **state save/reset/rebuild 适配 history.log**：save 复制、reset 清空、rebuild 不动
- **新增 `state tree` 子命令**：启动本地 bun HTTP server，serve 实时分支树 HTML 可视化
  - 固定默认端口 6677，冲突回退 +1（最多 10 次）
  - `runtime/tree/server.json` 管理 { port, pid, scriptId }
  - 已有 server 复用，切换剧本通过 HTTP 通知
  - fs.watch 监听 save 目录变化，SSE 推送到浏览器
  - 浏览器实时更新分支树（已走过/当前/未探索/结局）
- **SKILL.md 模板更新**：Phase 2 开始时调用 `state tree`，在 AskUserQuestion 中加"📊 查看分支线"选项

## Capabilities

### New Capabilities

- `choice-history`: state apply 记录选择历史到 history.log
- `branch-tree-server`: state tree 子命令启动本地可视化 server

### Modified Capabilities

- `skill-runtime-state`: save/reset/rebuild 适配 history.log
- `state-schema`: SKILL.md Phase 2 模板增加分支树入口

## Impact

- **新文件**：`src/export/state/tree.ts`（server + HTML 生成）、`src/export/state/history.ts`（history.log 读写）
- **修改文件**：`apply.ts`（追加 history）、`save.ts`（复制 history.log）、`reset.ts`（清空 history.log）、`main.ts`（注册 tree/tree --stop）、`skill-template.ts`（Phase 2 模板）
- **运行时产物**：`runtime/tree/server.json`（pid 文件）
- **端口占用**：默认 6677
- **测试**：新增 history.test.ts + tree.test.ts，修改 apply/save/reset 现有测试
