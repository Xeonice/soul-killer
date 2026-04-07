## Why

当前 export 系统是 1 Soul + 1 World → 1 Skill 的单角色视觉小说。用户已经积累了同一世界观下的多个 soul（如三国系的诸葛亮、司马懿、曹操），但无法将它们组合导出为一个多角色交互的故事。

同时，distill 阶段不保证生成 `behaviors/relationships.md`，导致角色的关系数据散落在 identity.md 和 milestones.md 中，无法被 export agent 结构化消费。

需要：
1. distill 保证输出 relationships.md，建立 capture→distill→export 的关系数据契约
2. export 支持多 Soul + 同一 World 导出，生成多角色状态矩阵式视觉小说（模式 B：所有角色共享场景、好感组合决定结局）

## What Changes

### Distill 层
- distill agent 在 capture 有 relations 维度数据时，**必须**生成 `behaviors/relationships.md`（从"建议"升级为"必须"）
- relationships.md 按角色对分节，包含关系类型、互动模式、情感动态

### Export Agent
- 全自动模式：扫描 souls/worlds/bindings → 自动选择同世界角色组合 → 关系推导 → 编排 → 打包
- 多 Soul 选择策略：选绑定 soul 最多的 world，纳入所有绑定到该 world 的 souls（≤4 个）
- 角色关系推导：读取 N 个 soul 的 relationships.md + identity.md，交叉匹配，推导 role / 好感轴 / 出场时机 / 叙事张力
- 无直接关系数据时，agent 基于角色人格和世界观创意补全关系
- 跨世界角色组合作为后续考虑项，第一版 fallback 到 ask_user

### Story Spec
- 扩展 `StorySpecConfig` 支持 `characters[]` 数组（name / role / axes / initial / appears_from）
- per-character 多轴好感度系统
- 选项必须对不同角色产生差异化好感影响（tradeoff 约束）
- 结局条件 = 多角色好感的组合判定
- 结局总览/图鉴（全展示模式：条件 + 预览 + 达成状态）

### SKILL.md 引擎
- 多角色同框调度：场景 cast 表、多角色对话编排
- per-character 状态追踪（affinity 对象）
- 结局图鉴展示（进度条 + 关键事件 + 其他结局预览）
- 单 soul 向后兼容（characters.length === 1 退化为现有模式）

### Packager
- 目录结构从 `soul/` 变为 `souls/{name}/`
- `package_skill` 接收 N souls + 角色编排配置
- 向后兼容：单 soul 也用 `souls/` 目录

## Capabilities

### New Capabilities
- `multi-soul-export`: 多 Soul + 同一 World 的全自动导出能力，包含角色关系推导、多角色编排、per-character 好感度系统、结局图鉴

### Modified Capabilities
- `export-agent`: export agent 流程重设计为全自动多 Soul 模式，system prompt 和 tool 参数扩展
- `cloud-skill-format`: 导出目录结构从 `soul/` 变为 `souls/{name}/`，SKILL.md 引擎支持多角色调度
- `export-command`: export 命令适配新的 export agent 流程（角色数量显示等 UI 变化）

## Impact

- `src/distill/distill-agent.ts` — system prompt 强化 relationships.md 生成要求
- `src/agent/export-agent.ts` — 全自动流程重写，system prompt + package_skill tool 参数扩展
- `src/export/packager.ts` — 多 soul 目录结构，N souls 复制
- `src/export/story-spec.ts` — StorySpecConfig 扩展 characters[]，story-spec.md 模板重写
- `src/export/skill-template.ts` — SKILL.md 引擎重写：多角色调度、per-character 状态、结局图鉴
- `src/cli/commands/export.tsx` — UI 适配（如有）
- E2E / 集成测试适配
