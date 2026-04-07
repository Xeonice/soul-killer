## Context

上一轮 `multi-soul-export` 实现了完整的多角色导出能力（story-spec 扩展、SKILL.md 多角色引擎、结局图鉴、packager 支持 N souls），但把 export 设计为"全自动扫描+选择+分析+打包"。实测证明全自动方向违反用户直觉：

- 用户主动发起 /export 时知道想要什么组合
- 确定性规则被用 LLM 推理执行，低效、不稳定、日志噪声
- agent 消耗大量步数在 list/read 工具调用上，真正的创意工作被推迟

## Goals / Non-Goals

**Goals:**
- export 变为 **user-driven** 流程：先多选 souls → 再单选 world → 才进入创意工作
- export-agent 职责收紧到"创意工作"：角色关系分析、好感轴设计、基调推导、打包
- 代码层驱动选择和数据预读，agent 不再处理机械任务
- 保留 multi-soul-export 的全部已有成果（story-spec、SKILL.md、结局图鉴、packager、distill relationships）

**Non-Goals:**
- 不改动 story-spec / SKILL.md / packager 的下游 API
- 不重构 ExportProtocolPanel（已支持 multi/single select）
- 不引入新的 UI 框架或状态管理
- 不改动 distill-agent 的 relationships.md 保证

## Decisions

### D1: 选择走 UI，创意走 Agent

**决策**: 选择逻辑完全从 agent 中剥离，放到 CLI 层。

```
现状（multi-soul-export）:
  /export → agent [list → analyze → select → read → analyze → package]

新架构:
  /export → UI [select souls] → UI [select world] → code [read data]
          → agent [analyze + package]
```

**理由**: 
- 选择是用户交互，属于 React/ink 的领域，不该走 LLM
- 确定性操作（读文件）用代码直接做，比 LLM tool call 快 10-100 倍
- agent 专注在 LLM 擅长的创意工作上

**替代方案**: 保持 agent 驱动但强制用 ask_user → 仍然浪费步数在 tool loop 上，没必要。

### D2: runExportAgent 签名变更

**决策**: 

```typescript
// 旧
runExportAgent(config, onProgress, askUser)

// 新
runExportAgent(config, preSelected, onProgress, askUser)

interface PreSelectedExportData {
  souls: string[]           // 选中的 soul 名称列表
  worldName: string         // 选中的 world 名称
  soulsData: SoulFullData[] // 预读的完整 soul 数据
  worldData: WorldFullData  // 预读的完整 world 数据
}
```

**理由**: 所有机械数据预先备好，agent 不需要 tool call 去拿。

### D3: 删除扫描工具

**决策**: 从 export-agent 的 tools 对象中**删除**：
- `list_souls`
- `list_worlds`
- `read_soul`
- `read_world`

只保留：
- `package_skill` — 最终打包
- `ask_user` — 兜底（如 agent 在分析中发现数据不足需要确认）

**理由**: 这些 tool 只有在 agent 驱动选择的旧流程里才需要。新流程数据已预先传入。

### D4: Initial prompt 包含全部数据

**决策**: Agent 的初始 user message 直接携带所有选中数据，不依赖 tool call。

```
# World: Fate Stay Night
[world.manifest JSON]

## World Entries
[entries concatenated]

# Characters (4)

## 远坂凛 [identity.md]
...

## 远坂凛 [style.md]
...

## 远坂凛 [behaviors/relationships.md]
...

## 間桐桜 [identity.md]
...
```

**理由**: 一次性提供完整上下文，agent 第一步就能开始分析，不需要多步 tool 调用。

**Risk**: prompt 会很大（可能 50K+ chars）。但经过 distill，每个文件通常 < 10K chars，4 角色 × 5 文件 + world 数据总量约 200K chars ≈ 50K tokens，在 glm-5 (163K) 内。如果超限，需要截断 behaviors 或减少角色数。

### D5: export.tsx 状态机扩展

**决策**: 新增 3 个 step：

```
step: 'type-select'           → (unchanged)
     | 'selecting-souls'       → NEW: multi-select UI for souls
     | 'selecting-world'       → NEW: single-select UI for worlds
     | 'loading-data'          → NEW: code reads all selected files
     | 'running'               → agent runs (was: running from start)
     | 'complete' | 'error'
```

- selecting-souls：复用 ExportProtocolPanel 的 select mode with `multi: true`
- selecting-world：复用 select mode with `multi: false`
- loading-data：显示"读取数据..." spinner，同步读文件系统
- running：调用 runExportAgent 传入预选数据

### D6: 数据读取由代码直接做

**决策**: CLI 层直接调 `readManifest` / `readSoulFiles` / `loadWorld` / `loadAllEntries`，不通过 agent。

**理由**: 这些都是文件系统操作，同步、快速、确定。走 LLM tool 是舍近求远。

### D7: Agent system prompt 彻底简化

**决策**: 新的 system prompt 只讲创意工作：

```
你是多角色视觉小说的剧本生成器。用户已经选好了角色和世界，
你的任务是：

1. 分析角色之间的关系（从 relationships.md + identity.md 交叉提取）
2. 为每个角色设计 2-3 个好感轴（反映人格特征）
3. 推导故事基调、幕数（4 角色用 4 幕）、结局数（≥5）
4. 调用 package_skill 打包导出

不要调用任何 list/read 工具——数据已经在用户消息里。
正常情况下零用户交互，只在分析中发现数据严重不足时才用 ask_user。
```

**理由**: 去掉所有和选择相关的指引，prompt 大幅缩短，agent 目标更明确。

## Risks / Trade-offs

- **[Risk] Initial prompt 过大超出模型上下文** → 监控 prompt token 数；必要时按 soul 数量动态截断 behaviors 或 milestones
- **[Risk] loading-data 阶段同步 IO 可能慢** → 4 角色的文件读取通常 < 100ms，可接受；如果太慢加 loading spinner
- **[Risk] 删除 tools 后，若 agent 判断需要更多数据怎么办** → 靠 ask_user 询问用户，而不是自己去 list/read；前置代码层应该已经读齐所需数据
- **[Trade-off] 失去"agent 自适应选择"的灵活性** → 但这正是我们要的，mechanical 的事应该由代码做
- **[Risk] 新增 step 后，Esc 取消逻辑需要适配** → 每个 step 都允许 Esc 返回上一步或取消
