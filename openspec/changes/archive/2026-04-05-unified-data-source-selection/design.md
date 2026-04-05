## Context

当前 `create.tsx` 的状态机在 `proceedAfterConflictCheck` 中根据 soulType 分叉：public → `capturing`（直接搜索），personal → `data-sources`（选择本地数据源）。搜索完成后 public 才能补充数据源。

`DataSourceOption` 类型当前为 `'markdown' | 'twitter'`，`CheckboxSelect` 组件已支持多选。

## Goals / Non-Goals

**Goals:**
- confirm 后统一进入 data-sources 选择界面
- public 默认勾选联网搜索，可附加选择 Markdown/Twitter
- personal 只显示 Markdown/Twitter
- 选中的数据源按顺序执行：联网搜索 → 本地 ingest → 合并 → distill
- 不选任何数据源可直接进入 distill

**Non-Goals:**
- 不改变 type-select 的存在
- 不改变联网搜索、ingest、distill 各阶段的内部逻辑
- 不支持并行执行多个数据源

## Decisions

### D1: DataSourceOption 扩展

新增 `'web-search'` 选项：

```typescript
type DataSourceOption = 'web-search' | 'markdown' | 'twitter'
```

### D2: proceedAfterConflictCheck 统一走 data-sources

不再根据 soulType 分叉，统一进入 `data-sources`：

```typescript
function proceedAfterConflictCheck() {
  setStep('data-sources')
}
```

### D3: data-sources UI 根据 soulType 构建选项

```typescript
const items = [
  ...(soulType === 'public' ? [{ value: 'web-search', label: '联网搜索', defaultChecked: true }] : []),
  { value: 'markdown', label: 'Markdown' },
  { value: 'twitter', label: 'Twitter Archive' },
]
```

### D4: 数据源执行编排

`handleSourcesSubmit` 接收选中项列表后，按顺序编排执行：

```
selectedSources = ['web-search', 'markdown']

1. 如果包含 'web-search' → setStep('capturing') + runAgentCapture
   → search-confirm 确认后继续
2. 如果包含 'markdown'/'twitter' → 逐个 source-path → ingesting
3. 全部完成 → 合并 chunks → distilling
```

关键是 search-confirm 的"确认并继续"要恢复到剩余数据源的处理，而不是直接进入 distill。

### D5: search-confirm 后的去向

当前 search-confirm 的 `confirm` 选项走 `data-sources`（补充数据），`supplement` 也走 `data-sources`。

新逻辑：confirm 后检查是否还有未处理的本地数据源。如果有 → 进入 source-path 处理下一个。如果没有 → 直接 distilling。

### D6: 空选择

如果用户什么都不选就提交（CheckboxSelect 返回空数组），直接进入 distilling，使用已有的 synthetic chunks + appendChunks。

### D7: search-confirm 菜单简化

因为数据源已经在前面选好了，search-confirm 的菜单不再需要"补充数据源"选项。简化为：确认并继续 / 查看详情 / 重新搜索。
