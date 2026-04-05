## Context

当前 web search 有三个后端：Tavily API（付费）、DuckDuckGo HTML 抓取（被 CAPTCHA 封杀）、Wikipedia API（只返回百科内容）。需要一个免费、可靠、数据丰富的搜索后端。

SearXNG 是开源的元搜索引擎，通过 Docker 自托管，一次搜索聚合 Google/Bing/Reddit/Wikipedia 等多源结果。JSON API 输出，无限量，无费用。

项目已有 Docker 容器管理模式（`engine/detect.ts`），可复用。

## Goals / Non-Goals

**Goals:**
- SearXNG 作为首选搜索后端，启动时自动管理 Docker 容器
- 搜索降级链：SearXNG → Tavily → DuckDuckGo
- 首次启动自动 pull 镜像 + 创建容器
- 无 Docker 环境无感降级
- SearXNG 配置文件随项目分发

**Non-Goals:**
- 不替换 Wikipedia tool（Wikipedia API 单独保留，用于精确百科查询）
- 不修改 agent loop 或维度系统
- 不做 SearXNG 的高级配置（限流、缓存等）

## Decisions

### 1. SearXNG 容器管理

复用 `engine/detect.ts` 的模式，新建 `src/engine/searxng.ts`：

```typescript
const CONTAINER_NAME = 'soulkiller-searxng'
const SEARXNG_IMAGE = 'searxng/searxng:latest'
const SEARXNG_PORT = 8080
const SEARXNG_URL = `http://localhost:${SEARXNG_PORT}`

// 状态检测
function isSearxngRunning(): boolean  // docker ps --filter name=soulkiller-searxng
function isSearxngStopped(): boolean  // docker ps -a (存在但停止)

// 生命周期
async function ensureSearxng(): Promise<boolean>
  // 1. Docker 不可用 → return false
  // 2. 容器运行中 → 健康检查 → return true
  // 3. 容器停止 → docker start → 健康检查 → return true
  // 4. 容器不存在 → docker run (挂载 settings.yml) → 健康检查 → return true
  // 5. 任何失败 → return false

// 搜索
async function searxngSearch(query: string): Promise<SearchResult[]>
  // GET ${SEARXNG_URL}/search?q=${query}&format=json&engines=google,bing
  // 解析 results 数组，映射到 SearchResult 格式
```

### 2. settings.yml 配置

放在 `engine/searxng/settings.yml`，Docker 启动时挂载到容器内 `/etc/searxng/settings.yml`。

关键配置：
```yaml
search:
  formats:
    - html
    - json          # 必须开启 JSON 输出

server:
  secret_key: "soulkiller-dev-key"

engines:
  # 通用搜索（覆盖最广）
  - name: google
    engine: google
    shortcut: g
  - name: bing
    engine: bing
    shortcut: b
    
  # 社区/讨论（quotes/expression/behavior 维度）
  - name: reddit
    engine: reddit
    shortcut: r
    
  # 百科（identity 维度补充）
  - name: wikipedia
    engine: wikipedia
    shortcut: wp
```

### 3. Docker 启动命令

```bash
docker run -d \
  --name soulkiller-searxng \
  -p 8080:8080 \
  -v /absolute/path/engine/searxng/settings.yml:/etc/searxng/settings.yml:ro \
  searxng/searxng:latest
```

首次启动需要 pull 镜像（~150MB），后续启动秒级。

### 4. 搜索降级链

在 `search-factory.ts` 的 `createAgentTools` 中，search tool 的 execute 改为降级链：

```
1. SearXNG 可用？ → searxngSearch(query)
2. Tavily key 存在？ → executeTavilySearch(key, query)
3. fallback → executeWebSearch(query)  (DuckDuckGo，可能被 CAPTCHA)
```

降级判断在 `createAgentTools` 调用时确定（非每次搜索时），避免重复检测。

### 5. 启动集成点

在 `src/cli/app.tsx` 的 boot 阶段（现有的 `detectEngine` 调用附近）加入 SearXNG 初始化。`ensureSearxng()` 返回 boolean 存入 AppState，后续传给 `createAgentTools`。

### 6. 健康检查

```typescript
async function healthCheck(): Promise<boolean> {
  // 尝试搜索一个简单查询
  const res = await fetch(`${SEARXNG_URL}/search?q=test&format=json`)
  return res.ok
}
```

最多等 15 秒（首次 pull 后），每秒检查一次。

## Risks / Trade-offs

**[Docker 依赖]** 没有 Docker 的用户无法使用 SearXNG → 降级到 Tavily/DuckDuckGo，不影响功能

**[首次启动慢]** pull 镜像需要 30-60 秒 → 只发生一次，显示进度提示

**[端口冲突]** 8080 可能被占用 → 可通过 config 或环境变量自定义端口

**[SearXNG 被上游封]** Google/Bing 可能封 SearXNG 的请求 → 多引擎聚合降低风险，单个引擎挂了还有其他
