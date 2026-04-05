## 1. 配置层

- [x] 1.1 修改 `src/config/schema.ts` — search 类型新增 `searxng_enabled?: boolean`，默认 false
- [x] 1.2 修改 setup-wizard — tavily_key 步骤后新增 SearXNG 启用选项（检测 Docker 可用性，提示用户选择是否启用）
- [x] 1.3 创建 `engine/searxng/settings.yml` — 开启 JSON 格式、配置搜索引擎（google, bing, reddit, wikipedia）、设置 secret_key
- [x] 1.4 添加 SearXNG 相关 i18n key（zh/en/ja）— 设置向导提示文本

## 2. SearXNG 容器管理

- [x] 2.1 创建 `src/engine/searxng.ts` — 实现 Docker 检测（复用 isDockerAvailable 模式）、容器状态检查（running/stopped/absent）、容器创建/启动逻辑（docker run 挂载 settings.yml）、健康检查（最多 15 秒）
- [x] 2.2 实现 `ensureSearxng()` 导出函数 — 当 config.search.searxng_enabled 为 true 时执行检测→启动/创建→健康检查，返回 boolean
- [x] 2.3 实现 `searxngSearch(query)` 导出函数 — 调用 SearXNG JSON API，解析结果为 SearchResult[] 格式

## 3. 搜索降级链

- [x] 3.1 修改 `search-factory.ts` 的 `createAgentTools` — 新增 `searxngAvailable` 参数，search tool 的 execute 按降级链选择后端（SearXNG → Tavily → DuckDuckGo）

## 4. 启动集成

- [x] 4.1 修改 `soul-capture-agent.ts` — captureSoul 中根据 config.search.searxng_enabled 调用 ensureSearxng()，将结果传给 createAgentTools

## 5. 验证

- [x] 5.1 类型检查通过、现有测试不回退
- [ ] 5.2 有 Docker 时验证 SearXNG 容器自动启动 + 搜索正常 — 需运行时验证
- [ ] 5.3 无 Docker / searxng_enabled=false 时验证降级到 Tavily 正常 — 需运行时验证
