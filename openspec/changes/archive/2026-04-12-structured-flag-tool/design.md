## Context

`set_prose_style` 已使用结构化对象数组（`forbidden_patterns: [{id, bad, good, reason}]`），效果良好。`set_story_metadata` 和 `set_story_state` 仍用 CSV 字符串，是历史遗留。

## Goals / Non-Goals

**Goals:**
- 消除 CSV 解析错误
- 和 set_prose_style 保持一致的工具参数风格

**Non-Goals:**
- 不改 ExportBuilder 接口（它已经接收对象数组）
- 不改 story-spec 输出格式

## Decisions

### set_story_metadata

```ts
// 之前
acts_options_csv: z.string()  // "3:short:24-36:4|5:medium:40-60:5"

// 之后
acts_options: z.array(z.object({
  acts: z.number(),
  label: z.string(),
  rounds_total: z.string(),
  endings_count: z.number(),
}))
```

### set_story_state

```ts
// 之前
flags_csv: z.string()  // "met_johnny:desc:false|chose_rebellion:desc:false"

// 之后
flags: z.array(z.object({
  name: z.string(),
  desc: z.string(),
  initial: z.boolean(),
}))
```

直接传给 builder，零解析代码。
