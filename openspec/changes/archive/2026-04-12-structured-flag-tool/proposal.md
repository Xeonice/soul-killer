## Why

export agent 的 `set_story_state` 和 `set_story_metadata` 工具使用 CSV 字符串格式（`name:desc:initial` pipe 分隔）。LLM 在生成 flags 时经常搞错分隔符（用逗号代替冒号），导致解析失败。实际报错：`flags format error: each entry needs 3 fields (name:desc:initial), got: "lancer_betrayal:Lancer is forced to commit suicide by Command Spell,false"`。

根因：desc 可能包含逗号，冒号在自然语言描述中不直观，LLM 倾向于用逗号分隔最后一个字段。

## What Changes

将 `set_story_metadata` 和 `set_story_state` 工具的 CSV 字符串参数改为结构化对象数组，和已有的 `set_prose_style`（使用 `forbidden_patterns: [{id, bad, good, reason}]`）保持一致的风格。

- `acts_options_csv: string` → `acts_options: Array<{acts, label, rounds_total, endings_count}>`
- `flags_csv: string` → `flags: Array<{name, desc, initial}>`
- 删除手动 CSV 解析逻辑

## Capabilities

### New Capabilities

（无）

### Modified Capabilities

- `export-agent`: set_story_metadata 和 set_story_state 工具参数从 CSV 改为结构化对象

## Impact

- **修改文件**：`src/export/agent/story-setup.ts`（工具定义 + 解析逻辑）
- **测试**：更新相关测试
- **不影响**：story-spec 输出格式、ExportBuilder 接口（它们已经接收对象数组）
