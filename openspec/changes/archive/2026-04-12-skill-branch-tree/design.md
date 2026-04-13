## Context

script.json 已有完整的场景图（scenes → choices → next → endings），state.yaml 记录当前状态值，meta.yaml 记录 current_scene。但缺失 choice history 和可视化入口。

验证过的技术事实：
- 自包含 HTML（内联 CSS/JS，无外部依赖）可渲染交互式分支树
- Bun.serve() 是 bun 内置，零 npm 依赖
- fs.watch 可监听文件变化
- SSE (Server-Sent Events) 可实现 server → browser 实时推送

## Goals / Non-Goals

**Goals:**
- 每次选择后记录 choice history
- 用户可在浏览器中实时查看分支树（已走过/当前/未探索）
- server 进程自动复用，不泄漏端口

**Non-Goals:**
- 不做树的编辑功能（只读可视化）
- 不做回退到历史选择点（需要完整的 state replay，另一个 change）
- 不做 ASCII 树输出（只做 HTML 可视化）

## Decisions

### 1. history.log 格式

纯文本，一行一条，`scene-id:choice-id` 格式：
```
scene-001:choice-a
scene-002:choice-a
scene-004:choice-a
```

选择独立文件而非嵌入 meta.yaml 的原因：mini-yaml 的 flat 格式不支持数组；append-only 文件操作比读-改-写 yaml 更快且更安全。

位置：`runtime/saves/<script-id>/auto/history.log`（与 state.yaml、meta.yaml 同目录）。manual save 目录同理。

### 2. apply 追加 history

`runApply` 成功写入 state.yaml + meta.yaml 后，append 一行到 history.log。append 失败不影响 apply 结果（history 是辅助信息，不参与状态计算）。

### 3. save/reset/rebuild 适配

| 命令 | history.log 行为 |
|------|-----------------|
| save | 复制 auto/history.log 到 manual/<ts>/history.log |
| reset | 清空（写入空文件）auto/history.log |
| rebuild | 不动 history.log（rebuild 只修复 state drift） |
| init | 创建空 history.log |

### 4. state tree server

```
state tree <script-id>
  → 检查 runtime/tree/server.json
  → 已有 server 且 pid 活着 → POST /switch { scriptId } → 复用
  → 否则 → spawn detached 子进程 → bind 端口 → 写 server.json
  → stdout: TREE_URL http://localhost:<port>

state tree --stop
  → 读 server.json → kill pid → 删 server.json
```

**端口策略：**
- 默认 6677
- EADDRINUSE → 6678, 6679... 最多试 10 次
- 端口写入 server.json

**server 路由：**
```
GET /           → 自包含 HTML 页面
GET /data       → JSON { scenes, history, currentScene, endings }
GET /events     → SSE 端点
POST /switch    → 切换监听的 scriptId
```

**文件监听：** fs.watch 监听 `runtime/saves/<scriptId>/auto/` 目录。检测到 history.log 或 meta.yaml 变化时，读取最新数据，通过 SSE 推送 `data` 事件。

**进程 detach：** 用 Bun.spawn + stdio: 'ignore' + unref()，主进程写完 server.json 后立即退出。

### 5. HTML 可视化

自包含 HTML，从 `/data` 加载初始数据，通过 `/events` SSE 接收实时更新。

- 横向树布局：左→右展开，场景为节点，选择为边
- 颜色编码：cyan(已走过) / yellow(当前) / gray(未探索) / magenta(选择路径)
- Hover 节点显示场景摘要
- 拖拽平移画布
- 自动滚动到当前位置
- 环检测：遇到已布局节点标注回路，不无限展开
- Progress 统计面板

### 6. SKILL.md 模板更新

Phase 2 在首次渲染场景前，调用 `bash runtime/bin/state tree <script-id>`，获取 TREE_URL 并告知用户。

AskUserQuestion 的选项列表在现有的 "💾 Save current progress" 之后追加 "📊 View branch tree"，触发时输出 TREE_URL。

## Risks / Trade-offs

| 风险 | 缓解 |
|------|------|
| fs.watch 跨平台行为差异 | bun 的 fs.watch 在 macOS/Linux/Windows 均有支持；SSE 断连时浏览器自动重连 |
| detached 子进程成为孤儿 | server.json 记录 pid；state tree --stop 主动清理；2 小时无连接自动退出 |
| 大型剧本（30+ scene）布局拥挤 | 默认折叠未探索分支超过 3 层深度；走过的路径始终完全展开 |
| history.log append 非原子 | 可接受——丢一条不影响游戏，tree 渲染做容错 |
| 端口 6677 被其他服务占用 | 自动回退 +1，最多 10 次 |
