## Context

创建流程刚完成了轻量录入改造（create-flow-redesign），状态机已支持 type-select → name → description → tags → confirm → capturing/data-sources → distilling → done。现在需要在关键节点插入确认/冲突处理，并提升全程可见性。

当前痛点：
- `packageSoul()` 使用 `mkdirSync({ recursive: true })`，同名目录静默存在不报错
- Agent 搜索完成后直接跳到 data-sources 或 distill，用户无法确认搜索目标是否正确
- `extractFeatures()` 是一个同步黑盒，无任何中间状态输出

## Goals / Non-Goals

**Goals:**
- 用户在创建同名灵魂时能做出知情决策（覆盖/追加/换名）
- 用户在 Agent 搜索后能确认目标正确性
- 蒸馏阶段展示 5 个子阶段的实时进度
- "追加数据"模式能读取已有灵魂 chunks 并与新数据合并重新蒸馏

**Non-Goals:**
- 创建流程全局进度条/步骤条（后续动画改造中做）
- 搜索结果的详细内容展示（"查看详情"本期只展示 chunk 列表摘要，不做富文本渲染）
- 灵魂版本管理（追加后不保留旧版本快照）

## Decisions

### D1: 重名检测时机 — confirm 之后、搜索/数据源之前

**决策**: 在信息汇总确认（confirm）通过后，检测 `~/.soulkiller/souls/<name>/` 是否存在。如果存在，插入 `name-conflict` 步骤。

**理由**: 在 confirm 之前检测会打断录入节奏；在搜索之后检测会浪费已完成的搜索。confirm 后是自然的决策点。

```
confirm ✓ → 检测重名 → [无冲突] → capturing / data-sources
                      → [有冲突] → name-conflict 步骤
```

### D2: 冲突解决三选一

**决策**: 检测到同名灵魂时展示已有灵魂信息并提供三个选项：

```
"老张" 已存在
  类型: 个人灵魂 | fragments: 42 | 创建于 2026-03-15

  ● 覆盖重建 — 删除现有数据，从头创建
  ○ 追加数据 — 保留现有数据，补充新内容后重新蒸馏
  ○ 换个名字 — 返回重新输入名字
```

**覆盖**: 删除整个 soul 目录，正常流程继续。
**追加**: 读取已有灵魂的 engine chunks（LocalEngine 的 JSON 存储），在蒸馏前合并到 allChunks 中。不删除目录，蒸馏输出覆盖 soul 文件。
**换名**: 回退到 `name` 步骤。

### D3: 搜索结果确认 — 轻量确认，默认继续

**决策**: Agent 搜索完成后，用 `capture_done` 步骤替代当前的 setTimeout 自动跳转。展示搜索结果摘要，默认选中"确认"。

```
▓ 搜索完成
  目标: V
  分类: DIGITAL CONSTRUCT
  来源: Cyberpunk 2077 (CD Projekt RED, 2020)
  片段: 23 个

  ● 确认，继续
  ○ 不对，重新搜索
  ○ 补充数据源
```

用户直接按回车即可确认（默认选中第一项），不增加摩擦。选"不对，重新搜索"回到 name 步骤重新输入。选"补充数据源"跳到 data-sources 步骤。

### D4: 蒸馏进度事件系统

**决策**: 给 `extractFeatures()` 新增可选 `onProgress` 回调，定义以下事件：

```typescript
type DistillPhase =
  | 'identity'      // 提取身份特征
  | 'style'         // 提取语言风格
  | 'behavior'      // 提取行为模式
  | 'merge'         // 合并去重
  | 'generate'      // 生成灵魂文件

type DistillProgress = {
  phase: DistillPhase
  status: 'started' | 'in_progress' | 'done'
  batch?: number      // 当前 batch
  totalBatches?: number  // 总 batch 数
}
```

create.tsx 接收事件后更新 UI，展示为带 spinner 的阶段列表：

```
▓ 蒸馏中...
  ▸ 提取身份特征 (2/3) ✓
  ▸ 提取语言风格 (1/3) ⠹
  ○ 提取行为模式
  ○ 合并去重
  ○ 生成灵魂文件
```

### D5: 追加模式的数据合并策略

**决策**: 追加模式下，从已有灵魂目录读取 engine 存储的 chunks（LocalEngine 的 `chunks.json`），与新采集的 chunks + 合成 chunks 合并后走完整蒸馏流程。蒸馏输出覆盖 `soul/` 下的文件，但不删除 `vectors/` 等其他数据。

**理由**: 重新蒸馏而非增量 merge 更简单且质量更好——增量 merge 需要处理特征冲突，而完整蒸馏自然包含去重逻辑。

## Risks / Trade-offs

**[追加模式读取 chunks]** LocalEngine 的 chunks.json 可能不存在（未 ingest 过）或格式变化 → 读取失败时降级为普通覆盖模式，提示用户。

**[搜索确认增加一次交互]** 对于快速创建场景多了一步 → 默认选中"确认"，直接回车即可，摩擦极小。

**[蒸馏进度回调改变 extractor 接口]** 所有调用方需适配 → 参数可选，现有调用无需改动。
