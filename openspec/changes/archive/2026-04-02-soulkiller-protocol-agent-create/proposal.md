## Why

当前 /create 流程要求用户手动选择数据源并提供路径，只支持本地 Markdown 和 Twitter Archive。用户需要知道自己有什么数据、在哪里。对于虚构角色和公众人物，用户根本无法提供本地数据——但互联网上有大量公开信息可以自动采集。

需要一个智能的 /create 流程：用户只输入一个名字，系统自动判断是什么类型的人物，自动选择采集策略，自动从互联网获取数据。只有当搜不到足够信息时，才回退到手动数据源选择。整个过程以 Cyberpunk 2077 的 Soulkiller Protocol 为视觉主题。

## What Changes

- 引入 Vercel AI SDK 作为 Agent 框架，实现 Soul Capture Agent
- 集成 Tavily Search API 作为首选互联网搜索工具
- 集成通用 WebSearch 作为 Tavily 的无 key 降级方案
- 集成 Wikipedia API 作为权威信息源
- 重构 /create 流程：用户输入名字 → Agent 自动识别（虚构角色/公众人物/历史人物/未知）→ 自动采集或回退到手动模式
- Agent 内部每步搜索后用 LLM 提取 SoulChunk[]，最终合流到现有蒸馏管线
- 新增 `<SoulkillerProtocolPanel />` 动画组件：灵魂捕获协议的 Cyberpunk 风格进度展示
- 新增 web source adapter：将 Agent 搜索结果转为标准 SoulChunk 格式

## Capabilities

### New Capabilities

- `soul-capture-agent`: Vercel AI SDK agent——输入名字，自动识别人物类型，自动选择搜索策略（Tavily + Wikipedia），逐步提取 SoulChunk[]，搜索不足时回退到手动模式
- `soulkiller-protocol-panel`: Soulkiller Protocol 动画面板——target acquired / classification / extracting neural patterns / soul fragments captured，逐行 reveal + cyberpunk 配色
- `web-source-adapter`: 将 agent 搜索结果转为 SoulChunk[] 格式（source: "web"），与本地 adapter 合流

### Modified Capabilities

- `data-ingest`: /create 流程重构为 agent-first，手动数据源选择变为 fallback
- `repl-shell`: /create 命令接入新的 agent 流程

## Impact

- **新增依赖**: `ai` (Vercel AI SDK), `@ai-sdk/openai` (OpenRouter 兼容), Tavily API key（可选，无 key 时跳过 agent 直接走手动）
- **新增文件**: `src/agent/soul-capture-agent.ts`, `src/agent/tools/` (tavily-search, web-search, wikipedia-search, search-factory), `src/cli/animation/soulkiller-protocol-panel.tsx`, `src/ingest/web-adapter.ts`
- **修改文件**: `src/cli/commands/create.tsx`, `src/cli/app.tsx`, `src/config/schema.ts`（新增 tavily_api_key 可选配置）
- **测试**: agent 工具的单元测试，protocol panel 快照测试
