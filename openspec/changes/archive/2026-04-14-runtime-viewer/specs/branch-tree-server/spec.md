## MODIFIED Requirements

### Requirement: 分支树可视化页面

分支树 SHALL 以 React 组件形式实现，从 `tree-html.ts` 内嵌字符串迁移为 `packages/viewer/src/views/tree/` 下的组件文件。页面功能保持不变：场景节点布局、连线、选择高亮、gate 菱形、路由着色、拖拽平移、统计面板、悬浮提示。

#### Scenario: 分支树数据加载与渲染

- **WHEN** 浏览器访问 viewer 的 tree view
- **THEN** SHALL 从 `/api/data` 获取场景数据，渲染节点、连线、统计面板和图例，功能与迁移前一致

#### Scenario: SSE 实时更新

- **WHEN** 用户在 skill 中做出选择导致 history.log 变化
- **THEN** SHALL 通过 `/api/events` SSE 端点推送更新，页面实时刷新节点状态

### Requirement: CLI 入口兼容

`soulkiller runtime tree <script-id>` SHALL 作为 `soulkiller runtime viewer tree <script-id>` 的别名保留，确保旧版 SKILL.md 兼容。

#### Scenario: 旧命令兼容

- **WHEN** 执行 `soulkiller runtime tree <script-id>`
- **THEN** SHALL 等同于执行 `soulkiller runtime viewer tree <script-id>`
