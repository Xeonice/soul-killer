## Why

导出的 Cloud Skill 视觉小说目前的结局判定是纯分支树——只有最后一个选择决定结局，前面的选择没有累积影响。这导致体验缺乏"重量感"，玩家的早期选择变成了无意义的装饰。真正的视觉小说需要一个状态系统：每个选择都影响隐藏数值，最终由累积状态决定结局。

此外，结局展示过于简单——只显示当前结局文字，没有回顾、没有其他可能路径的提示、没有重玩入口。

## What Changes

- **状态系统**：story-spec.md 新增状态追踪规约——数值轴（2-3 个，如信任/了解/羁绊，范围 0-10）+ 关键事件标记（3-5 个布尔值），每个选项标注对状态的影响
- **结局判定**：story-spec.md 新增结局条件规约——每个结局定义触发条件（数值阈值 + 事件标记组合），按优先级匹配
- **SKILL.md 状态追踪**：Phase 2 运行规则新增内部状态维护——选择后更新状态、状态对用户不可见
- **结局展示增强**：结局场景后展示旅程回顾（状态数值可视化 + 关键事件）、其他可能结局（标题 + 条件 + 一句预览）、重玩选项（"从头再来" 回到 Phase 0 / "结束故事"）
- **Skill 命名空间前缀**：导出的 Skill name 加上 `soulkiller:` 前缀（如 `soulkiller:v-in-cyberpunk-2077`），与项目内其他 Skill（如 `opsx:explore`）保持一致的命名空间风格

## Capabilities

### New Capabilities

（无新增独立能力）

### Modified Capabilities

- `cloud-skill-format`: story-spec.md 新增状态系统规约（数值轴、事件标记、选项状态影响、结局条件）；SKILL.md 新增状态追踪规则、结局判定规则、结局展示规则（旅程回顾 + 其他结局 + 重玩）；Skill name 新增 `soulkiller:` 命名空间前缀
- `export-agent`: 导出完成提示中的 Skill 名称使用带前缀的格式

## Impact

- **修改文件**：`src/export/story-spec.ts`（新增状态系统和结局条件段落）、`src/export/skill-template.ts`（新增状态追踪、结局判定、结局展示规则 + name 前缀）、`src/export/packager.ts`（目录名加前缀）、`src/agent/export-agent.ts`（完成提示使用带前缀名称）
- **测试更新**：story-spec 和 skill-template 的单元测试需验证新增内容
