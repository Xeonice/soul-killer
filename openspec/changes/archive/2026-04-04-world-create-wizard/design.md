## Context

当前 `WorldCreateCommand` 只有 4 步（display-name → description → creating → done），创建一个空世界目录。Soul 的 `CreateCommand` 有 14 步状态机，包含类型选择、AI 搜索、数据导入、蒸馏等完整流程。

现有可复用的基础设施：
- `WorldDistiller`（`src/world/distill.ts`）：四阶段蒸馏流程
- `WorldDistillReview`（`src/cli/commands/world-distill-review.tsx`）：条目审查 UI
- `IngestPipeline`（`src/ingest/pipeline.ts`）：markdown adapter
- Page extractor（`src/ingest/`）：URL 内容提取
- `captureSoul`（`src/agent/soul-capture-agent.ts`）：AI 搜索 agent 的搜索工具可复用

## Goals / Non-Goals

**Goals:**
- 创建向导自包含，从 name 到 done 全在 Wizard 内部完成
- 4 种创建方式：手动、蒸馏、URL、空白
- 手动创建时引导用户按 scope 分类输入核心条目，自动分配元数据
- 蒸馏和 URL 分支复用现有组件
- 名称冲突处理（覆盖/重命名）
- 创建完成前有确认摘要

**Non-Goals:**
- 不实现世界模板/预设系统（可作为后续扩展）
- 不支持 twitter adapter（世界蒸馏只支持 markdown + URL）
- 不实现 AI agent 自动搜索世界设定（只支持用户提供 URL）

## Decisions

### D1: 状态机设计

```
type WizardStep =
  | 'name'              // 输入世界名称
  | 'name-conflict'     // 名称冲突处理
  | 'display-name'      // 输入显示名
  | 'description'       // 输入描述
  | 'method-select'     // 选择创建方式
  // 手动分支
  | 'manual-background' // 输入世界背景 (always/background)
  | 'manual-rules'      // 输入世界规则 (always/rule, 可选)
  | 'manual-atmosphere' // 输入氛围基调 (always/atmosphere, 可选)
  | 'manual-more'       // 是否添加更多条目
  | 'manual-entry-name' // 知识条目名
  | 'manual-entry-kw'   // 知识条目关键词
  | 'manual-entry-content' // 知识条目内容
  // 蒸馏分支
  | 'distill-path'      // 输入 markdown 目录路径
  | 'distilling'        // 蒸馏进行中
  | 'distill-review'    // 审查条目
  // URL 分支
  | 'url-input'         // 输入 URL（多条）
  | 'url-fetching'      // 抓取 + 蒸馏中
  | 'url-review'        // 审查条目
  // 通用
  | 'confirm'           // 确认摘要
  | 'creating'          // 写入中
  | 'done'
  | 'error'
```

**为什么不做更扁平的设计？** 手动分支的引导式输入需要多个独立步骤，每步有不同的提示文案和 scope 映射。拆分步骤让每步职责单一，也方便跳过可选步骤。

### D2: 手动创建 — 引导式条目收集

三个核心条目按 scope 引导，用户只输入内容，元数据自动生成：

| 向导步骤 | 用户看到的提示 | 自动生成的 entry 元数据 |
|---------|--------------|----------------------|
| manual-background | "用一段话描述这个世界的基本设定" | name: `core-background`, mode: always, scope: background, priority: 900 |
| manual-rules | "这个世界有哪些规则或约束？（Enter 跳过）" | name: `core-rules`, mode: always, scope: rule, priority: 800 |
| manual-atmosphere | "回复时应该带有什么氛围？（Enter 跳过）" | name: `core-atmosphere`, mode: always, scope: atmosphere, priority: 700 |

用户跳过（直接 Enter）则不创建对应条目。

之后进入 manual-more 循环：
- 选择「添加知识条目」→ 收集 name、keywords、content → 创建 keyword/lore 条目 → 回到 manual-more
- 选择「完成」→ 进入 confirm

### D3: URL 抓取分支

复用现有的 page extractor 逻辑：
1. 用户输入多个 URL（每行一个，空行结束）
2. 逐个 URL 调用 page extractor 提取文本
3. 提取结果作为 chunks 送入 WorldDistiller 的 classify → cluster → extract 流程
4. 进入审查

**为什么不用 soul-capture-agent？** Agent 是为搜索人物设计的，有 classification 和 search strategy 逻辑。世界的 URL 抓取是用户直接提供链接，不需要搜索策略。只需要 page extractor + distiller。

### D4: 名称冲突处理

```
type ConflictChoice = 'overwrite' | 'rename'
```

不提供「追加」选项（与 Soul 不同）。原因：Soul 的追加是往已有 chunks 里加数据再重新蒸馏。World 的条目是独立文件，不存在「追加重新蒸馏」的概念。用户如果想往已有世界加内容，应该用 evolve。

### D5: 确认摘要

创建完成前展示摘要，包含：
- 世界名 / 显示名 / 描述
- 创建方式（手动/蒸馏/URL/空白）
- 条目数量和分类（N 个 always, M 个 keyword, ...）
- 确认 / 修改（修改返回 method-select 重新走流程）

### D6: 菜单集成

`world.tsx` 中「创建」选项的处理简化为：

```tsx
case 'create':
  setAction('create')  // 不再收集 name，直接进入 Wizard
```

Wizard 组件签名变为 `WorldCreateWizard({ onComplete, onCancel })`，与 Soul 的 CreateCommand 对齐。

## Risks / Trade-offs

**[URL 抓取质量]** → 网页内容可能很杂，提取出大量无关条目。Mitigation：蒸馏后必须经过审查。

**[手动输入体验]** → ink TextInput 对多行内容不友好。Mitigation：每个输入框收集一段话即可，不要求长文本。用户可以创建后再通过 `/world` → 条目 来编辑。

**[状态机复杂度]** → 20 个步骤比较多。Mitigation：分支之间隔离，每条路径实际只走 7-9 步。
