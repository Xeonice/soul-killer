## ADDED Requirements

### Requirement: state tree 启动本地可视化 server

`state tree <script-id>` SHALL 启动一个 detached bun HTTP server，serve 实时分支树 HTML 页面。

#### Scenario: 首次启动

- **WHEN** 执行 `state tree script-001`（无已有 server）
- **THEN** SHALL 启动 server，写 `runtime/tree/server.json`（含 port, pid, scriptId），stdout 输出 `TREE_URL http://localhost:<port>`

#### Scenario: 复用已有 server

- **WHEN** 执行 `state tree script-001`（server.json 存在且 pid 活着）
- **THEN** SHALL 不启动新进程，stdout 输出已有 `TREE_URL`

#### Scenario: 切换剧本

- **WHEN** 已有 server 监听 script-001，执行 `state tree script-002`
- **THEN** SHALL POST /switch 通知 server 切换目标，更新 server.json

#### Scenario: 已死 server 清理

- **WHEN** server.json 存在但 pid 已死
- **THEN** SHALL 清理 server.json，启动新 server

### Requirement: 端口策略

SHALL 默认使用端口 6677，冲突时递增，最多尝试 10 次。

#### Scenario: 默认端口可用

- **WHEN** 端口 6677 未被占用
- **THEN** server SHALL bind 6677

#### Scenario: 端口冲突回退

- **WHEN** 端口 6677 被占用
- **THEN** SHALL 尝试 6678, 6679... 直到成功或超过 10 次失败报错

### Requirement: state tree --stop 关闭 server

`state tree --stop` SHALL 关闭后台 server 并清理 server.json。

#### Scenario: 正常关闭

- **WHEN** 执行 `state tree --stop`（server 运行中）
- **THEN** SHALL kill server 进程，删除 server.json，stdout 输出 `TREE_STOPPED`

#### Scenario: 无 server 运行

- **WHEN** 执行 `state tree --stop`（无 server.json）
- **THEN** SHALL stdout 输出 `TREE_NOT_RUNNING`

### Requirement: SSE 实时推送

server SHALL 通过 SSE (GET /events) 在 history.log 或 meta.yaml 变化时推送更新。

#### Scenario: apply 后浏览器收到更新

- **WHEN** 浏览器已连接 SSE，LLM 执行 `state apply`
- **THEN** server SHALL 检测文件变化并推送包含最新 history + currentScene 的 data 事件

### Requirement: HTML 可视化

GET / 返回的 HTML SHALL 渲染交互式分支树。

#### Scenario: 基础渲染

- **WHEN** 浏览器打开 TREE_URL
- **THEN** SHALL 显示所有场景节点和选择边，区分已走过（cyan）、当前（yellow）、未探索（gray）

#### Scenario: 实时更新

- **WHEN** LLM 执行 apply 后
- **THEN** 浏览器 SHALL 自动更新树，新节点亮起，路径线变色

#### Scenario: 环检测

- **WHEN** 场景图存在回路（scene-A → scene-B → scene-A）
- **THEN** SHALL 标注回路节点，不无限展开

### Requirement: server 自动超时退出

server SHALL 在 2 小时内无 SSE 连接时自动退出。

#### Scenario: 无人连接超时

- **WHEN** 所有浏览器关闭 SSE 连接，超过 2 小时无新连接
- **THEN** server SHALL 自动退出并清理 server.json
