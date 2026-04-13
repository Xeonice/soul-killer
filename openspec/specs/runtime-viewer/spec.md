## ADDED Requirements

### Requirement: 通用 viewer 渲染服务

`soulkiller runtime viewer <view-name> <script-id>` SHALL 启动 HTTP server，根据 view-name 路由到对应的可视化页面，并提供数据 API 和 SSE 实时更新端点。

#### Scenario: 启动 tree view

- **WHEN** 执行 `soulkiller runtime viewer tree <script-id>`
- **THEN** SHALL 启动 HTTP server 并输出 `VIEWER_URL http://localhost:<port>`，浏览器访问该 URL 显示分支树可视化

#### Scenario: 未知 view-name

- **WHEN** 执行 `soulkiller runtime viewer unknown <script-id>`
- **THEN** SHALL 输出错误信息列出可用的 view-name，退出码非零

### Requirement: 生产模式 serve 内嵌静态文件

viewer-server 生产模式 SHALL 从内嵌的 barrel 模块中读取前端产物（HTML/JS/CSS），通过 HTTP 响应返回，不依赖文件系统上的静态文件。

#### Scenario: 生产模式响应前端资源

- **WHEN** 浏览器请求 `/` 和 `/assets/*`
- **THEN** SHALL 返回内嵌的 HTML 和对应的 JS/CSS 文件，Content-Type 正确

### Requirement: 开发模式启动 vite dev server

`bun run dev:viewer <view-name> <script-id>` SHALL 在开发环境下启动 vite dev server（支持 HMR），同时在同一进程中提供 API 端点。

#### Scenario: 开发模式热更新

- **WHEN** 修改 `packages/viewer/src/` 下的 React 组件
- **THEN** 浏览器 SHALL 通过 HMR 实时更新，无需手动刷新

### Requirement: viewer workspace 为独立 bun workspace 包

`packages/viewer/` SHALL 拥有独立的 `package.json`，通过根 `package.json` 的 `workspaces` 字段管理。

#### Scenario: bun install 安装所有 workspace 依赖

- **WHEN** 在项目根目录执行 `bun install`
- **THEN** SHALL 同时安装根包和 `packages/viewer` 的所有依赖
