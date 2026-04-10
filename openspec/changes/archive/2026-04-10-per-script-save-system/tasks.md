## 1. IO 层路径模型重构

- [x] 1.1 重构 `io.ts` 的 `resolveSavePaths(skillRoot, scriptId, saveType)` 签名，支持 `'auto'` 和 `{ manual: string }` 两种 SaveType
- [x] 1.2 删除旧的 `slotDirOf()` 工具函数，替换为基于 scriptId + saveType 的路径工具
- [x] 1.3 更新 `resolveScriptPath()` 确认不受影响（仅涉及 scripts/ 目录，不变）
- [x] 1.4 更新所有 io.ts 的单元测试适配新路径模型

## 2. state CLI 新增子命令

- [x] 2.1 实现 `src/export/state/list.ts` — 扫描 `saves/<scriptId>/auto/` + `manual/*/` 目录，输出 JSON 存档概要
- [x] 2.2 实现 `src/export/state/save.ts` — 复制 auto/ 到 manual/<timestamp>/，处理上限检查和 `--overwrite` 参数
- [x] 2.3 更新 `src/export/state/main.ts` 注册 `save` 和 `list` 子命令的 dispatch
- [x] 2.4 为 list.ts 编写单元测试（正常列出、无存档、manual 排序）
- [x] 2.5 为 save.ts 编写单元测试（正常创建、上限错误 MANUAL_SAVE_LIMIT_REACHED、--overwrite 覆盖）

## 3. 现有子命令路径适配

- [x] 3.1 重构 `init.ts` — 参数从 `(slot, scriptId)` 改为 `(scriptId)`，固定写入 auto/
- [x] 3.2 重构 `apply.ts` — 参数从 `(slot, sceneId, choiceId)` 改为 `(scriptId, sceneId, choiceId)`，固定写入 auto/
- [x] 3.3 重构 `validate.ts` — 参数从 `(slot, flags)` 改为 `(scriptId, saveType, flags)`
- [x] 3.4 重构 `rebuild.ts` — 参数从 `(slot)` 改为 `(scriptId, saveType)`
- [x] 3.5 重构 `reset.ts` — 参数从 `(slot)` 改为 `(scriptId, saveType)`
- [x] 3.6 更新 `state.sh` bash wrapper 的参数解析逻辑
- [x] 3.7 更新所有现有子命令的单元测试适配新参数签名

## 4. Packager 归档结构更新

- [x] 4.1 更新 `packager.ts` 的 `injectRuntimeFiles`，将新增的 `save.ts` 和 `list.ts` 加入复制列表
- [x] 4.2 更新归档中 `runtime/saves/` 的 scaffolding — 仅保留 `.gitkeep`，移除 `slot-*` 目录创建
- [x] 4.3 更新 `tests/unit/export-packager-runtime.test.ts` 验证新文件被复制、旧 slot 目录不存在

## 5. SKILL.md 模板更新

- [x] 5.1 重写 `skill-template.ts` 中 Phase -1 菜单段落 — 扁平化剧本列表 + 存档子菜单设计
- [x] 5.2 更新 Phase -1 的 `state` CLI 调用示例（init/validate/reset 新签名）
- [x] 5.3 在 Phase 2 场景呈现规则中追加"💾 保存当前进度"选项注入逻辑
- [x] 5.4 在 Phase 2 中描述手动存档满时的覆盖流程
- [x] 5.5 更新 Phase 2 禁止事项 — 将"每个 AskUserQuestion 必须包含💾选项"加入约束
- [x] 5.6 更新 Phase -1 和 Phase 2 中所有 `slot` 相关的文本引用

## 6. Export Lint 适配

- [x] 6.1 检查 `src/export/lint/` 中是否有涉及 slot 或存档路径的 lint 规则，如有则适配新结构
- [x] 6.2 确认 `STATE_APPLY_PRESENT` 和 `PHASE_0_DOCTOR_PRESENT` 等现有规则不受影响

## 7. 集成验证

- [x] 7.1 运行全部单元测试 `bun run test` 确认通过
- [ ] 7.2 运行 E2E 测试 `bun run test:e2e` 确认导出相关场景通过
- [ ] 7.3 手动导出一个 skill，检查归档内目录结构符合新布局
