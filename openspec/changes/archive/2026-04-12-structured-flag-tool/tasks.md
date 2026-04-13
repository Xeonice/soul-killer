## 1. 工具参数重构

- [x] 1.1 `set_story_metadata`：`acts_options_csv: string` → `acts_options: z.array(z.object({acts, label, rounds_total, endings_count}))`，删除 CSV 解析
- [x] 1.2 `set_story_state`：`flags_csv: string` → `flags: z.array(z.object({name, desc, initial}))`，删除 CSV 解析
- [x] 1.3 更新两个工具的 `inputExamples`

## 2. 验证

- [x] 2.1 运行 `bun run test` 确认全部测试通过（85 文件 983 用例）
