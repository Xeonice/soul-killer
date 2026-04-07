## Context

当前 export 是 1 Soul + 1 World → 1 Skill 的单角色视觉小说。export-agent 通过 ask_user 引导用户逐步选择 soul、world、基调，最后打包。

用户积累了同一世界观下的多个 soul，需要组合导出。同时 distill 不保证生成 relationships.md，导致关系数据无法被 export 结构化消费。

## Goals / Non-Goals

**Goals:**
- distill 保证生成 relationships.md，建立 capture→distill→export 的关系数据契约
- export 全自动：扫描 → 自动选择角色组合 → 关系推导 → 编排 → 打包，零用户交互（正常路径）
- 多角色状态矩阵式视觉小说（模式 B）：多角色同框、per-character 好感轴、好感组合决定结局
- 结局图鉴：通关后展示所有结局的达成状态、条件、预览
- 单 soul 向后兼容

**Non-Goals:**
- 跨世界角色组合（第一版不支持全自动，fallback 到 ask_user）
- 角色退场机制（只有 appears_from，无 exits_after）
- 跨 session 结局持久化（每次运行独立）
- 旧格式 skill 增量升级（需要重新导出）

## Decisions

### D1: 全自动 export 流程

**决策**: export-agent 正常路径零用户交互。

流程：
1. list_souls + list_worlds + 分析 bindings
2. 自动选择 world（绑定 soul 最多的）
3. 自动纳入绑定到该 world 的所有 souls（≤4）
4. read_soul × N + read_world
5. agent 内部推导角色关系、role、好感轴、出场时机、基调、幕数、结局数
6. package_skill 打包到默认目录

**理由**: Agent 有足够信息做所有决策。只在真正歧义时（多 world 绑定数相同、0 soul/world、跨世界组合）fallback 到 ask_user。

**替代方案**: 保持交互式 → 多 Soul 场景下交互步骤太多（选 N 个 soul + 确认编排 + 选基调 + ...），体验差。

### D2: 角色数量上限 4

**决策**: 单次导出最多 4 个角色。超出时选好感轴数量最丰富（distill 产物最完整）的前 4 个。

**理由**: 5+ 角色时选项 tradeoff 设计爆炸，story-spec 复杂度不可控。4 = protagonist + deuteragonist + 2 supporting 是经典叙事结构。

### D3: 关系推导靠 LLM 推理而非专门 tool

**决策**: 不新增 analyze_relationships tool。agent 读取 N 个 soul 的完整数据后，在 system prompt 指引下自然推导关系、role、好感轴。推导结果作为 package_skill 的输入参数。

**理由**: LLM 天然擅长从非结构化文本提取关系。额外 tool 增加复杂度但不增加能力。agent log 可追溯推理过程。

### D4: relationships.md 作为关系数据契约

**决策**: distill-agent 的 system prompt 将 relationships behavior 从"建议"升级为"必须"（当 capture 有 relations 维度数据时）。无 relations 数据时不强制。

relationships.md 按角色对分节，包含：
- 关系类型（宿敌/君臣/同盟/师徒/...）
- 互动模式（一段描述）
- 情感动态（态度变化）

export agent 读取 relationships.md 做交叉匹配：A.relationships 提到 B + B.relationships 提到 A → 双向关系。只有单侧提到时仍可推导。完全无关系数据时 agent 基于人格和世界观创意补全。

### D5: story-spec 多角色扩展

**决策**: StorySpecConfig 新增 `characters` 数组：

```typescript
interface CharacterSpec {
  name: string
  role: 'protagonist' | 'deuteragonist' | 'antagonist' | 'supporting'
  axes: { name: string; english: string; initial: number }[]
  appears_from?: string  // "act_1" | "act_2" | ...
}
```

story-spec.md 模板新增：
- 多角色 cast 表和场景编排规则
- per-character 好感轴定义
- 选项 tradeoff 约束（每选项必须对不同角色产生差异化影响）
- 结局条件 = 多角色好感组合
- 结局图鉴格式定义

### D6: SKILL.md 引擎多角色调度

**决策**: SKILL.md 引擎支持：
- 场景 [cast] 表指定在场角色
- 多角色对话编排（旁白中交替展现不同角色）
- per-character 状态对象 `{ affinity: { "角色名": { 轴: 值 } }, flags: {} }`
- 结局图鉴展示（全展示模式：进度条 + 条件 + 预览）
- characters.length === 1 时退化为现有单角色模式

### D7: 目录结构 soul/ → souls/

**决策**: 导出目录从 `soul/` 变为 `souls/{name}/`。单 soul 也用此结构。

```
skill-dir/
  souls/
    诸葛亮/
      identity.md, style.md, capabilities.md, milestones.md, behaviors/
    司马懿/
      ...
  world/
    world.json, entries/
  story-spec.md
  SKILL.md
```

**理由**: 统一结构，SKILL.md 引擎不需要区分单/多模式的目录读取逻辑。

### D8: 自动决策规则

| 条件 | 决策 |
|------|------|
| 1 个 world | 直接使用 |
| N 个 world | 选绑定 soul 最多的 |
| N 个 world 绑定数相同 | fallback ask_user |
| 0 world 或 0 soul | fallback ask_user 提示创建 |
| 绑定 soul > 4 | 选 distill 产物最完整的前 4 个 |
| 跨世界角色 | 第一版 fallback ask_user |
| 角色间无关系数据 | agent 创意补全 |

## Risks / Trade-offs

- **[Risk] 全自动决策可能不符合用户意图** → fallback 到 ask_user 兜底；后续可加 `--interactive` flag 强制交互
- **[Risk] 4 角色上限可能不够** → 故事叙事上 4 角色已很丰富，后续可视需求调高
- **[Risk] story-spec 和 SKILL.md 复杂度大增** → 通过角色数量限制控制组合爆炸；模板本身的复杂度由 LLM 生成质量兜底
- **[Risk] relationships.md 质量不稳定** → distill agent 有 reviewSoul 步骤可自检；export agent 对缺失数据有创意补全能力
- **[Risk] 目录结构 breaking change** → 旧格式 skill 需要重新导出，不可增量升级
