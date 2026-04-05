## Why

DuckDuckGo HTML 抓取被反机器人 CAPTCHA 封杀，web search 完全不工作（所有查询返回 0 条 URL）。Tavily 虽然可用但返回数据偏少，且需要付费 API key。需要一个免费、可靠、多源聚合的搜索后端。SearXNG 是自托管的元搜索引擎，可同时查询 Google/Bing/Reddit/Wikipedia 等，Docker 部署，完全免费。

## What Changes

- 新增 SearXNG Docker 容器自动管理：启动时检测 Docker → 拉起/启动 SearXNG 容器 → 健康检查
- 新增 `engine/searxng/` 目录，包含 SearXNG 的 `settings.yml` 配置（开启 JSON API、选择搜索引擎）
- 新增 SearXNG 搜索执行器，调用 `localhost:8080/search?format=json` 接口
- 改造 search-factory 的降级链：SearXNG（优先）→ Tavily（有 key 时）→ DuckDuckGo（最后兜底）
- 无 Docker 环境自动降级到 Tavily/DuckDuckGo，不影响现有用户

## Capabilities

### New Capabilities

- `searxng-backend`: SearXNG Docker 容器生命周期管理（检测、拉取、启动、健康检查）+ SearXNG JSON API 搜索执行器
- `search-fallback-chain`: 搜索后端降级链逻辑（SearXNG → Tavily → DuckDuckGo）

### Modified Capabilities

- `agent-tool-loop`: search tool 的 execute 函数使用降级链而非固定后端

## Impact

- 新增 `engine/searxng/settings.yml` — SearXNG 配置文件
- 新增 `src/engine/searxng.ts` — SearXNG 容器管理 + 搜索执行器
- 修改 `src/agent/tools/search-factory.ts` — search tool 使用降级链
- 修改 `src/engine/detect.ts` — 启动时加入 SearXNG 容器管理
- 修改 `src/cli/app.tsx` — boot 阶段初始化 SearXNG（如果 Docker 可用）
