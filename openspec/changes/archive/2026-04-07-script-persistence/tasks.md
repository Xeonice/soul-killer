## 1. Packager 与目录结构

- [x] 1.1 修改 `src/export/packager.ts`，打包时创建 `runtime/scripts/.gitkeep` 和 `runtime/saves/.gitkeep` 占位文件
- [x] 1.2 单测：验证生成的 `.skill` 归档解压后含 `runtime/scripts/` 和 `runtime/saves/` 空目录

## 2. Skill 模板：frontmatter 与 allowed-tools

- [x] 2.1 修改 `src/export/skill-template.ts` 中 SKILL.md frontmatter 生成逻辑，`allowed-tools` 加入 `Read`、`Write`、`Glob`
- [x] 2.2 单测：验证生成的 SKILL.md frontmatter 含全部必需工具

## 3. Skill 模板：Phase -1 剧本选择菜单

- [x] 3.1 在 `src/export/skill-template.ts` 中新增 `buildPhaseMinusOne()` 函数，输出 Phase -1 章节文本
- [x] 3.2 Phase -1 章节包含：列出 `runtime/scripts/*.yaml` 的指令、解析 frontmatter 的指令、AskUserQuestion 菜单结构、五个顶层选项（继续/重试/重命名/删除/生成新剧本）的处理流程
- [x] 3.3 在 `buildMultiCharacterEngine()` 和 `buildSingleCharacterEngine()` 的输出中插入 Phase -1 章节（在 Phase 0 之前）
- [x] 3.4 单测：snapshot 测试生成的 SKILL.md 含 Phase -1 章节及五个菜单选项

## 4. Skill 模板：Phase 1 剧本持久化

- [x] 4.1 修改 Phase 1 章节文本：移除"剧本保存在内部上下文"相关措辞
- [x] 4.2 新增 Phase 1 退出条件：调用 Write 工具写入 `${CLAUDE_SKILL_DIR}/runtime/scripts/script-<id>.yaml`
- [x] 4.3 Phase 1 章节明确剧本 yaml frontmatter 必含字段：id、title、generated_at、user_direction、acts
- [x] 4.4 Phase 1 章节包含写入失败的容错指令（输出错误后仍进 Phase 2，提示无法重试）
- [x] 4.5 Phase 1 章节包含写入成功的确认输出指令
- [x] 4.6 单测：snapshot 验证 Phase 1 章节含 Write 工具调用指令和 frontmatter 字段说明

## 5. Skill 模板：存档系统

- [x] 5.1 在 SKILL.md 中新增"存档机制"章节，定义 `runtime/saves/slot-<N>/meta.yaml` 和 `state.yaml` 结构
- [x] 5.2 修改 Phase 2 场景流转规则：每次场景切换后写入对应 slot 的 state.yaml 和 meta.yaml
- [x] 5.3 存档章节定义"继续存档"流程：读 meta.yaml 的 script_ref → 读 script → 读 state → 跳到 current_scene
- [x] 5.4 存档章节定义"重试剧本"流程：读 script → 重置到 initial_state → 不读取 save → 进入 Phase 2 第一场景
- [x] 5.5 第一版存档槽位固定为 slot-1/2/3，菜单显示空槽和占用槽
- [x] 5.6 单测：验证 SKILL.md 含存档机制章节和 slot-1~3 引用

## 6. Skill 模板：重命名与删除剧本

- [x] 6.1 Phase -1 菜单"重命名剧本"流程：列剧本→选目标→询问新 title→Read→改 frontmatter.title→Write 回原文件
- [x] 6.2 Phase -1 菜单"删除剧本"流程：选目标→删 script 文件→扫所有 save meta→删关联存档→输出统计
- [x] 6.3 删除流程要求 AskUserQuestion 二次确认
- [x] 6.4 单测：snapshot 验证重命名/删除流程文本

## 7. Skill 模板：损坏文件容错

- [x] 7.1 Phase -1 章节增加损坏文件处理指令：解析失败→在菜单中标 (损坏)→提供单独的删除入口
- [x] 7.2 单测：snapshot 验证容错指令存在

## 8. "从头再来" 语义修正

- [x] 8.1 修改 `src/export/story-spec.ts` 中"重玩选项"章节文本：从"重置 + 回 Phase 0 + 重新生成"改为"复用当前 script + 重置 state 到 initial_state + 进 Phase 2 首场景"
- [x] 8.2 修改 `src/export/skill-template.ts` 中 SKILL.md 的"重玩规则"章节，与 story-spec 同步
- [x] 8.3 重玩规则明确说明：如需换故事，请重启 skill 进 Phase -1 菜单
- [x] 8.4 单测：验证生成的 story-spec.md 和 SKILL.md 重玩文本与新语义一致

## 9. 文档与示例

- [x] 9.1 在 `CLAUDE.md` 项目说明中添加 runtime 目录约定的简短说明
- [x] 9.2 在 `src/export/` 内更新代码注释，解释 Phase -1 流程

## 10. 端到端验证

- [x] 10.1 用一个测试 soul + world 调用 export，生成新格式的 .skill（由 `tests/unit/export-tools.test.ts` 自动覆盖）
- [x] 10.2 解压 .skill 验证 runtime/ 目录结构正确（由 1.2 新增断言覆盖）
- [ ] 10.3 在 Claude Code 环境加载该 skill，手动验证 Phase -1 → Phase 0 → Phase 1（写文件）→ Phase 2 流程
- [ ] 10.4 重启 skill 验证 Phase -1 菜单正确列出已生成剧本
- [ ] 10.5 选择"重试"验证剧本可复现（同样的场景、同样的选项、同样的结局判定逻辑）
- [ ] 10.6 选择"生成新剧本"验证可创建第二份剧本，两份共存
- [ ] 10.7 验证重命名和删除功能
- [ ] 10.8 验证存档系统：玩到中途存档→重启→选"继续"恢复进度
