## 1. Distill: relationships.md 保证

- [x] 1.1 修改 `distill-agent.ts` 的 system prompt：当 sessionDir 包含 relations 维度缓存时，relationships behavior 从"建议"升级为"必须"
- [x] 1.2 在 `prepareStep` 中添加检测逻辑：如果即将 finalize 但 `behaviors/relationships.md` 不存在且有 relations 数据，强制引导 agent 先写 relationships
- [x] 1.3 更新 system prompt 的 relationships 格式指引：按角色对分节，每节含关系类型/互动模式/情感动态

## 2. Story Spec 多角色扩展

- [x] 2.1 扩展 `StorySpecConfig` 接口：新增 `characters: CharacterSpec[]`（name/role/axes/appears_from）
- [x] 2.2 重写 `generateStorySpec()` 模板：多角色 cast 规则、per-character 好感轴定义、选项 tradeoff 约束、多角色好感组合结局条件、结局图鉴格式
- [x] 2.3 向后兼容：characters 为空或单项时退化为现有模板

## 3. SKILL.md 引擎重写

- [x] 3.1 重写 `generateSkillMd()`：Phase 1 读取 `souls/*/` 下所有 soul 目录，按 characters 定义生成多角色剧本
- [x] 3.2 Phase 2 多角色场景运行规则：cast 表调度、多角色对话编排、per-character affinity 状态追踪、选项→多角色好感影响
- [x] 3.3 Phase 3 结局图鉴：结局演绎 + 旅程回顾（per-character 进度条）+ 所有结局预览 + 重玩选项
- [x] 3.4 单角色退化：characters.length === 1 时引擎行为与现有一致

## 4. Packager 多 Soul 目录结构

- [x] 4.1 修改 `packageSkill()` 接收 `souls[]` 数组替代单个 `soul_name`
- [x] 4.2 目录结构从 `soul/` 改为 `souls/{name}/`，复制 N 个 soul 的完整文件
- [x] 4.3 更新 `getSkillDirName()`：多 soul 时名称包含主角名（如 `soulkiller:诸葛亮-in-三国`，取 protagonist 的名字）
- [x] 4.4 `SkillTemplateConfig` 扩展：传入 characters 信息供 SKILL.md 模板使用

## 5. Export Agent 全自动流程

- [x] 5.1 重写 `SYSTEM_PROMPT`：全自动流程指引（扫描→自动选择→关系推导→编排→打包），自动决策规则，角色分析指引，好感轴设计指引
- [x] 5.2 修改 `package_skill` tool 的 inputSchema：`souls[]` 替代 `soul_name`，story_spec 包含 characters
- [x] 5.3 添加自动决策逻辑注释/指引到 system prompt：world 选择策略、soul 筛选策略、角色数量上限、异常 fallback
- [x] 5.4 调整 MAX_STEPS：从 20 提升到 25（全自动流程步数预算更宽松）

## 6. Export Command UI 适配

- [x] 6.1 进度展示适配：tool_end 的 result_summary 携带 souls 数量信息，i18n 添加 export.copy_souls
- [x] 6.2 完成展示适配：复用现有 trail/complete 渲染（panel 自动展示输出文件树和 skill_name）

## 9. Export Agent 日志接入（补丁）

- [x] 9.1 `AgentLogger` 构造函数新增 `subdir` 配置，导出日志目录可配置
- [x] 9.2 导出新的 `EXPORT_LOG_DIR` 常量区分于 capture/distill 的 `AGENT_LOG_DIR`
- [x] 9.3 `export-agent` 接入 `AgentLogger`，使用 `subdir: 'export'` 写入 `~/.soulkiller/logs/export/`
- [x] 9.4 stream 循环记录 start-step / text-delta / tool-call / tool-result / error 事件
- [x] 9.5 错误路径（异常、watchdog abort、fallback 终止）统一 close 日志并在错误消息中附带日志路径

## 8. ask_user 多选支持（补丁）

- [x] 8.1 扩展 `ExportProgressEvent` 的 `ask_user_start` 事件：新增 `multi_select?: boolean` 字段
- [x] 8.2 扩展 `AskUserHandler` 类型：增加 multiSelect 参数，返回值为逗号分隔 label 列表
- [x] 8.3 扩展 `ask_user` tool 的 inputSchema：新增 `multi_select?: boolean` 参数
- [x] 8.4 `ExportProtocolPanel` 的 select 模式支持多选：空格切换选中状态，Enter 确认，checkbox UI 渲染
- [x] 8.5 `export.tsx` 的 `handleAskUser` 和 `handleSelectConfirm` 适配多选：保持选中集合，Enter 时返回逗号分隔结果
- [x] 8.6 system prompt 更新：当需要选多个角色时使用 `multi_select: true`，并增加语义推断指引

## 7. 验证

- [x] 7.1 `bun run build` 类型检查通过
- [x] 7.2 `bun run test` 单元测试通过 — 63 files / 558 tests
- [~] 7.3 手动测试：全自动流程验证 — 实测发现"全自动"方向本身不符合用户预期（用户希望主动选择而非系统推测），流程重设计移至新 change `export-user-driven-selection`
- [~] 7.4 手动测试：SKILL.md 引擎多角色运行 — 架构和模板已就绪，待新 change 的流程完成后端到端验证
- [~] 7.5 手动测试：单 soul 向后兼容 — 代码和模板层已支持，同上
