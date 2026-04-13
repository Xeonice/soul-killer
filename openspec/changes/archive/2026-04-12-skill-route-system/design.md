## Context

当前 script.json 所有 choice 的 next 指向同一场景，形成单线叙事。需要引入经典 Galgame 路线模型：共通线 → 好感度+关键选择判定（affinity_gate）→ 分入角色路线 → 路线内结局。

已有基础设施：
- script-builder 的 plan/scene/ending/build 增量构建流程
- ending condition DSL（all_of / any_of / key-op-value）
- state apply 的好感度+flag 状态管理
- tree-server 分支可视化

## Goals / Non-Goals

**Goals:**
- 共通线 → affinity_gate → 角色路线 → 路线内多结局的完整模型
- gate 判定基于好感度 + 关键选择 flag 组合
- export agent 交互式选取焦点角色（agent 推荐 + 用户确认，最多 4 个）
- 路线不汇合，各走各的
- 分支树按路线着色

**Non-Goals:**
- 不做路线间交叉（一旦分入路线就不再切换）
- 不做路线内二次大分支（路线内线性，选择只影响好感度/flag → 决定 ending）
- 不做路线解锁机制（所有路线首次游玩都可达）

## Decisions

### 1. affinity_gate 场景格式

复用已有的 ending condition DSL：

```json
{
  "scene-gate": {
    "type": "affinity_gate",
    "text": "叙事文本（可选的转场描写）",
    "routing": [
      {
        "route_id": "kiritsugu-route",
        "condition": {
          "all_of": [
            { "key": "affinity.char-015svd29.bond", "op": ">=", "value": 6 },
            { "key": "flags.chose_pragmatism", "op": "==", "value": true }
          ]
        },
        "next": "scene-k01"
      },
      {
        "route_id": "saber-route",
        "condition": {
          "all_of": [
            { "key": "affinity.char-01ex85wq.bond", "op": ">=", "value": 6 },
            { "key": "flags.honored_duel", "op": "==", "value": true }
          ]
        },
        "next": "scene-s01"
      },
      {
        "route_id": "kiritsugu-route",
        "condition": "default",
        "next": "scene-k01"
      }
    ]
  }
}
```

按顺序评估，第一个满足的 condition 生效。最后一条必须是 `"default"`。

### 2. state route 命令

`state route <script-id> <gate-scene-id>`

- 读 state.yaml 当前状态
- 读 script.json 中 gate 场景的 routing
- 按顺序评估 conditions（复用 ending condition 评估逻辑）
- 输出: `ROUTE <route_id> → <next-scene-id>`
- 同时写入 `meta.yaml` 一个 `current_route` 字段，Phase 2 用它限定 ending 评估范围

### 3. endings 路线归属

```json
{
  "endings": [
    { "id": "ending-k1", "route": "kiritsugu-route", "title": "继承者",
      "condition": { ... }, "intent": "..." },
    { "id": "ending-k2", "route": "kiritsugu-route", "title": "对立者",
      "condition": { ... }, "intent": "..." },
    { "id": "ending-k-default", "route": "kiritsugu-route", "title": "旁观者",
      "condition": "default", "intent": "..." },
    
    { "id": "ending-s1", "route": "saber-route", "title": "骑士的誓约",
      "condition": { ... }, "intent": "..." },
    ...
  ]
}
```

Phase 2 到达路线末尾时，只评估 `ending.route == current_route` 的 endings。每条路线的最后一个 ending 必须是 `condition: "default"`。

### 4. plan.json 路线结构

plan 新增顶层 `routes` 和 gate 场景：

```json
{
  "routes": [
    {
      "id": "kiritsugu-route",
      "focus_character": "char-015svd29",
      "name": "切嗣线",
      "theme": "功利主义与牺牲",
      "scenes": ["scene-k01", "scene-k02", "scene-k03", "scene-k04"]
    }
  ],
  "scenes": {
    "scene-gate": {
      "type": "affinity_gate",
      "outline": "共通线结束，好感度判定路线",
      "routing": [ ... ]
    },
    "scene-k01": {
      "route": "kiritsugu-route",
      "act": 2,
      "outline": "...",
      "choices": [ ... ]
    }
  }
}
```

plan 验证新增：
- gate 场景的 routing 每条都有 route_id + condition + next
- routing 最后一条必须是 default
- 每条路线的 scenes 都存在于 plan.scenes
- 每条路线至少有 1 个 ending

### 5. story-spec Routes 段落

export agent 写入 story-spec.md：

```markdown
## Routes

route_model: affinity_gate
common_scenes: 4

routes:
  - id: kiritsugu-route
    focus_character: char-015svd29
    name: "切嗣线 — 魔术师杀手的理想"
    theme: "功利主义与牺牲"
    route_scenes: 4
    endings: 2
    gate_condition_hint: "高切嗣好感度 + 选择过功利主义立场"

  - id: saber-route
    focus_character: char-01ex85wq
    name: "Saber 线 — 骑士王的苦恼"
    theme: "王道理想的崩塌与重建"
    route_scenes: 4
    endings: 2
    gate_condition_hint: "高 Saber 好感度 + 尊重过骑士决斗"
```

### 6. export agent 焦点角色选取

新增 `select_route_characters` 工具，在所有 `add_character` 完成后调用：

1. Agent 分析所有角色的蒸馏数据（identity.md, behaviors/, style.md）
2. 按以下标准评估"路线潜力"：
   - 内在矛盾/冲突深度（identity 中的矛盾描述）
   - 与其他角色的关系张力
   - 角色弧线完整度（behaviors 文件数）
   - 数据丰富度（总字数）
3. 排序后预选 top 2-3，生成推荐理由
4. 展示预选列表，用户可勾选/取消/补充
5. 确认后写入 story-spec.md Routes 段落

工具输入：`{ selected_characters: [{ slug, reason }], deselected?: [slug] }`
工具输出：写入 story-spec，返回确认

### 7. 场景预算

story-spec 的 acts_options 根据路线数动态调整：

```
N 个路线:
  共通线: 4 场景 (固定)
  gate: 1 场景 (固定)
  每条路线: floor((total_scenes - 5) / N) 场景
  
  N=2, total=15: 共通 4 + gate 1 + 路线 5×2 = 15
  N=3, total=17: 共通 4 + gate 1 + 路线 4×3 = 17
  N=4, total=17: 共通 4 + gate 1 + 路线 3×4 = 17
```

### 8. 分支树可视化

tree-html.ts / tree-server.ts 改动：
- `/data` 返回新增 `routes` 字段（从 script.json 提取）
- HTML 按 route_id 着色节点和边：
  - 共通线: 白色 (#c0c0c0)
  - 路线 1: 青色 (#00f7ff)
  - 路线 2: 品红 (#ed1e79)
  - 路线 3: 黄色 (#f3e600)
  - 路线 4: 绿色 (#00ff88)
- gate 节点渲染为菱形（区别于普通场景的矩形）

### 9. Phase 2 行为变更

遇到 affinity_gate 场景时：
1. 如果 gate 有 text → 先渲染叙事文本
2. 调用 `bash runtime/bin/state route <script-id> scene-gate`
3. 解析 `ROUTE <route_id> → <next-scene-id>`
4. 不展示 AskUserQuestion，直接转场到路线首个场景
5. 告知用户进入了哪条路线（可以是叙事化的：「你的脚步不由自主地追随了切嗣的背影——」）
6. 后续 ending 评估只看 `route == current_route` 的 endings

## Risks / Trade-offs

| 风险 | 缓解 |
|------|------|
| gate condition 设计不当导致所有人走 default | gate_condition_hint 引导 LLM 设计合理阈值；共通线选择充分影响好感度 |
| 路线间内容量不平衡 | plan 验证检查每条路线场景数差距不超过 2 |
| export agent 推荐的角色用户不满意 | 用户可自由调整列表，agent 只是预选 |
| condition DSL 复用可能有边界情况 | routing 和 ending 用完全相同的评估逻辑，已有大量测试覆盖 |
