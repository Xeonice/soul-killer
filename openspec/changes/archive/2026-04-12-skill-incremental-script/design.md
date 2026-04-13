## Context

Phase 1 的 LLM 用 Write 工具一次性写入 50KB+ 的 script.json。中文叙事中的未转义 ASCII 双引号导致 JSON 解析失败。self-check 有 8 项语义验证但无 JSON 语法检查。AskUserQuestion options 上限 4 个，choices + 系统选项容易超限。

## Goals / Non-Goals

**Goals:**
- Phase 1 改为 Plan → Scenes → Endings → Build 四步，JSON 错误被场景级隔离
- 每步由 CLI 命令验证 JSON 语法 + 语义一致性
- plan.json 作为叙事蓝图保证全局连贯性，CLI 自动计算前驱关系和拓扑生成顺序
- 分支图中的汇合场景自动标注，LLM 生成时遵守路径无关约束
- endings 在所有场景就绪后才生成 body，基于实际场景内容而非凭空想象
- 每个场景 choices ≤ 2，+ 📊 + 💾 ≤ 4

**Non-Goals:**
- plan 不暴露给用户审批（后续单独加）
- 不改 Phase 2 的运行逻辑（只改 choices 数量限制 + 自动启动 tree）
- 不改 script.json 最终格式（build 后的产物和现在完全一致）

## Decisions

### 1. Phase 1 五步流程

```
Step A: PLAN (LLM 生成骨架 + CLI 验证 + CLI 自动补全)
         ↓
Step B: SCENES (LLM 按拓扑序逐个生成 + CLI 逐个验证)
         ↓
Step C: ENDINGS (LLM 逐个生成 body + CLI 验证)
         ↓
Step D: BUILD (CLI 合并 + 全量验证)
         ↓
Step E: SELF-CHECK (LLM 自查 prose style + data coverage)
```

### 2. Plan JSON 结构

plan.json 包含叙事蓝图但不含叙事文本。LLM 写入后由 CLI 自动补全 predecessors / is_convergence / generation_order。

```json
{
  "id": "<8-char hash>",
  "state_schema": { /* 和现在一样 */ },
  "initial_state": { /* 和现在一样 */ },

  "narrative": {
    "arc": "整体叙事弧一句话描述",
    "acts": [
      { "act": 1, "title": "幕标题", "theme": "主题", "scenes": ["scene-001", "scene-002"] }
    ],
    "character_arcs": {
      "<char_slug>": { "arc": "角色成长弧", "key_scenes": ["scene-003", "scene-007"] }
    }
  },

  "scenes": {
    "scene-001": {
      "act": 1,
      "title": "场景标题",
      "cast": ["char-a", "char-b"],
      "outline": "2-3 句话描述这个场景发生什么",
      "emotional_beat": "情感基调",
      "state_changes_intent": { "flags.xxx": true },
      "choices": [
        { "id": "c1", "text": "选项文本", "intent": "叙事意图", "next": "scene-002" },
        { "id": "c2", "text": "选项文本", "intent": "叙事意图", "next": "scene-003" }
      ],
      "continuity": "和前后场景的衔接说明",
      "context_refs": []
    },
    "scene-004": {
      "outline": "无论从哪条路到达，观察员在新都遇到 Saber 阵营",
      "context_refs": [],

      "predecessors": ["scene-002", "scene-003"],
      "is_convergence": true
    },
    "scene-008": {
      "outline": "再次遇到绮礼，他提起第一晚的对话",
      "context_refs": ["scene-001"]
    }
  },

  "endings": [
    {
      "id": "ending-A",
      "title": "继承者",
      "condition": { "all_of": [{ "key": "affinity.kirei.bond", "op": ">=", "value": 7 }] },
      "intent": "切嗣认可观察员，传承理想"
    },
    {
      "id": "ending-default",
      "title": "旁观者",
      "condition": "default",
      "intent": "观察员完成任务离开，什么都没有改变"
    }
  ],

  "generation_order": ["scene-001", "scene-002", "scene-003", "scene-004", "..."]
}
```

注意：
- endings 只有 `condition` + `title` + `intent`，**没有 `body`**。body 在 Step C 生成。
- `predecessors`、`is_convergence`、`generation_order` 由 CLI 自动计算并写回 plan.json，LLM 不需要手写。
- `context_refs` 由 LLM 手写，用于非前驱的远距回扣。

### 3. CLI 子命令

**`state script plan <id>`**

- LLM 先 Write `.build-<id>/plan.json`，然后调用此命令
- **验证：**
  - JSON 语法合法
  - state_schema 结构正确
  - initial_state 字段集 == schema 字段集
  - 每个 scene 有 outline + choices
  - 每个 scene choices ≤ 2
  - choices 的 next 指向已知 scene-id（无孤立节点）
  - context_refs 引用的 scene-id 存在
  - endings 的 condition 引用存在于 schema
- **自动补全（写回 plan.json）：**
  - 反查 scene graph，为每个 scene 计算 `predecessors: string[]`
  - `predecessors.length > 1` → 标记 `is_convergence: true`
  - 拓扑排序计算 `generation_order: string[]`（保证每个 scene 的所有前驱排在它前面）
- stdout:
  ```
  PLAN_OK
    scenes: 15
    fields: 68
    acts: 3
    endings: 4
    generation_order: scene-001,scene-002,scene-003,scene-004,...
    convergence_points: scene-004,scene-010
  ```

**`state script scene <id> <scene-id>`**

- LLM 先 Write `.build-<id>/draft/<scene-id>.json`，然后调用此命令
- 读取 draft JSON + 已补全的 plan.json
- **验证：**
  - JSON 语法合法
  - scene-id 存在于 plan.scenes
  - text 字段非空
  - choices 数量和 id 匹配 plan
  - consequences keys ⊂ plan.state_schema
  - consequences values 类型匹配 schema（int/bool/enum/string）
  - next 和 plan 一致
  - 所有 predecessors 的 `scenes/<pred>.json` 已存在（拓扑序检查）
- 通过 → 移动 draft 到 `.build-<id>/scenes/<scene-id>.json`
- stdout: `SCENE_OK <scene-id> choices=<N> keys=<N>`

**`state script ending <id> <ending-id>`**

- LLM 先 Write `.build-<id>/draft/<ending-id>.json`，然后调用此命令
- 读取 draft JSON + plan.json
- draft 格式：`{ "id": "ending-A", "title": "...", "condition": {...}, "body": "结局文本..." }`
- **验证：**
  - JSON 语法合法
  - ending-id 存在于 plan.endings
  - condition 和 plan 一致
  - body 非空
  - condition 中引用的 keys 存在于 schema
- 通过 → 移动到 `.build-<id>/endings/<ending-id>.json`
- stdout: `ENDING_OK <ending-id>`

**`state script build <id>`**

- 读取 plan.json + 所有 scenes/*.json + 所有 endings/*.json
- **验证：**
  - plan 中每个 scene-id 都有对应 scene 文件
  - plan 中每个 ending-id 都有对应 ending 文件
- 合并为完整 script-<id>.json（格式和现在完全一致）
- 写入 `runtime/scripts/script-<id>.json`
- 删除 `.build-<id>/`
- stdout: `BUILD_OK script-<id>.json scenes=<N> endings=<N> size=<N>KB`

### 4. 文件布局

```
runtime/scripts/
├── .build-f4z0a9b2/              ← 构建中的临时目录
│   ├── plan.json                  ← 叙事蓝图（含 CLI 补全的字段）
│   ├── draft/                     ← LLM Write 的临时文件
│   │   └── scene-005.json         ← 待验证
│   ├── scenes/                    ← 验证通过的场景
│   │   ├── scene-001.json
│   │   ├── scene-002.json
│   │   └── ...
│   └── endings/                   ← 验证通过的结局
│       ├── ending-A.json
│       └── ending-default.json
└── script-f4z0a9b2.json          ← build 后的最终产物
```

### 5. 连贯性保障

生成 scene-X 时的 context 读取规则：

```
1. plan.json（必读）
   → 整体蓝图 + scene-X outline + character_arcs
   → is_convergence 标记

2. 所有前驱场景（自动，从 plan.predecessors）
   → 拓扑序保证已生成
   → 全部读取 scenes/<pred>.json

3. context_refs 场景（手动，LLM 在 plan 中声明）
   → 非前驱的远距回扣
   → 读取 scenes/<ref>.json（跳过已在 predecessors 中的）

4. is_convergence == true 时：
   → 叙事不能引用任何特定前驱路径的细节
   → 使用路径无关的开场
```

生成 ending-X 时的 context 读取规则：

```
1. plan.json → ending intent + condition
2. character_arcs 中相关角色的 key_scenes
3. 读取那些 key_scenes 的 scenes/*.json
```

### 6. SKILL.md Phase 1 改写

```
Step A: Plan
  - 读取所有源材料
  - 设计 state_schema + initial_state
  - 规划叙事弧、幕结构、每个场景的 outline/cast/choices/continuity/context_refs
  - endings 只写 condition + title + intent（不写 body）
  - Write .build-<id>/plan.json
  - bash state script plan <id>
  - 获取 generation_order 和 convergence_points
  - 失败 → 读错误 → 修复 → 重试

Step B: Generate scenes (按 generation_order)
  For each scene-id:
    - Read plan.json (蓝图 + outline + character_arcs)
    - Read 所有 predecessors 的 scenes/<pred>.json
    - Read context_refs 中非 predecessors 的 scenes/<ref>.json
    - 如果 is_convergence: 叙事路径无关
    - 生成 text + choices (含 consequences)
    - Write .build-<id>/draft/<scene-id>.json
    - bash state script scene <id> <scene-id>
    - 失败 → 读错误 → 修复 → 重试(最多 3 次)

Step C: Generate endings (场景全部就绪后)
  For each ending:
    - Read plan.json (intent + condition)
    - Read character_arcs 相关 key_scenes 的 scenes/*.json
    - 生成 ending body
    - Write .build-<id>/draft/<ending-id>.json
    - bash state script ending <id> <ending-id>
    - 失败 → 读错误 → 修复 → 重试

Step D: Build
  - bash state script build <id>
  - BUILD_OK → 进入 Step E

Step E: Self-check (精简版)
  - prose style 验证 (LLM 自查)
  - data coverage 验证 (LLM 自查)
  - 其余检查已由 CLI 增量完成
```

### 7. Phase 2 choices 限制 + 分支树自动启动

SKILL.md Phase 2 规则修改：
- 每个场景 choices ≤ 2（plan 阶段由 CLI 强制）
- \+ 📊 View branch tree + 💾 Save = 总计 ≤ 4
- Phase 2 进入后、首次渲染场景前，自动 `bash runtime/bin/state tree <script-id>`，告知用户可视化 URL

### 8. 场景 / 结局 draft JSON 格式

单个场景 draft：

```json
{
  "text": "完整叙事+对话文本...",
  "choices": [
    {
      "id": "c1",
      "text": "选项A文本",
      "consequences": { "affinity.kirei.bond": 2, "flags.saw_battle": true },
      "next": "scene-002"
    },
    {
      "id": "c2",
      "text": "选项B文本",
      "consequences": { "affinity.tokiomi.bond": 1 },
      "next": "scene-003"
    }
  ]
}
```

单个结局 draft：

```json
{
  "id": "ending-A",
  "title": "继承者",
  "condition": { "all_of": [{ "key": "affinity.kirei.bond", "op": ">=", "value": 7 }] },
  "body": "结局叙事文本..."
}
```

## Risks / Trade-offs

| 风险 | 缓解 |
|------|------|
| Phase 1 步骤变多，总耗时可能增加 | 每步更小更快，失败只重试单场景；总体可靠性大幅提升 |
| plan.json 本身也可能有 JSON 错误 | plan 不含叙事文本（最容易出错的部分），只有结构数据 |
| LLM 可能不遵循 plan 的 outline | scene 验证检查 choice.id/next 匹配 plan；内容一致性靠 plan context |
| choices ≤ 2 限制叙事自由度 | 2 个选择覆盖绝大多数二分叙事；复杂分支通过连续场景拆分 |
| 汇合场景文本可能意外引用特定路径 | is_convergence 自动标注 + SKILL.md 明确约束 |
| context_refs 手动遗漏 | predecessors 自动读取兜底；context_refs 只补充远距回扣 |
| 拓扑排序在有环图上不完整 | plan 验证阶段检测环并报错（视觉小说不应有叙事环） |
