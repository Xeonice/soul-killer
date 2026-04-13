## Why

当前生成的 script.json 是单线叙事——每个场景的两个 choice 的 `next` 指向同一个场景，选择只影响好感度不影响走向。可视化分支树是一条直线。这不符合 Galgame 的经典路线模型：共通线 → 好感度+关键选择判定 → 分入角色路线 → 路线内结局。

## What Changes

### 1. script.json 格式扩展
- 新增 `affinity_gate` 场景类型：基于好感度+flag 组合条件自动路由到不同路线
- endings 新增 `route` 字段：每条路线有独立的 endings 集合

### 2. state CLI 新命令
- `state route <script-id> <gate-scene-id>`：读 state.yaml，按优先级评估 routing conditions，输出应进入的路线和场景
- `state script plan` 扩展：验证 gate 场景的 routing 合法性

### 3. SKILL.md Phase 1 / Phase 2 更新
- Phase 1 plan 阶段：设计路线结构（共通线 + gate + 各路线场景 + 路线内 endings）
- Phase 2：遇到 affinity_gate 时调用 `state route`，自动转场不展示选择；ending 评估只看当前路线

### 4. export agent 扩展
- 新增 `select_route_characters` 工具：agent 分析角色数据推荐焦点角色，展示预选列表，用户确认/调整（最多 4 个）
- story-spec.md 新增 Routes 段落：定义路线 id、焦点角色、主题、场景数、endings 数

### 5. 分支树可视化增强
- 按路线着色（共通线/各路线不同颜色）
- gate 节点特殊渲染

## Capabilities

### New Capabilities

- `route-system`: affinity_gate 场景类型 + state route 命令 + 路线感知的 ending 评估
- `route-character-selection`: export agent 的焦点角色选取交互

### Modified Capabilities

- `script-builder`: plan 验证扩展支持 gate + routing
- `skill-runtime-state`: Phase 1 路线设计 + Phase 2 gate 自动路由
- `branch-tree-server`: 路线着色 + gate 节点渲染

## Impact

- **新文件**：`src/export/state/route.ts`（state route 命令）、export agent 的 `select_route_characters` 工具
- **修改文件**：`script-builder.ts`（gate 验证）、`main.ts`（route 命令）、`skill-template.ts`（Phase 1/2 路线规则）、`story-spec.ts`（Routes 段落）、`tree-html.ts`（路线着色）、`tree-server.ts`（/data 返回路线信息）
- **格式变更**：script.json 新增 affinity_gate 类型 + endings.route 字段
- **测试**：新增 route.test.ts、更新 script-builder.test.ts
