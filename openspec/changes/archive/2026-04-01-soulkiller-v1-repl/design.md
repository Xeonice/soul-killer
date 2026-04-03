## Context

Soulkiller 是一个从零开始的新项目，目标是构建一个 Cyberpunk 2077 风格的 REPL 应用，让用户从数字痕迹中提取"灵魂"并生成可分发的数字分身。项目无任何现有代码，需要搭建完整技术栈。

核心约束：
- REPL 体验对标 Claude Code，自然语言 + slash 命令混合输入
- 视觉风格严格对齐 Cyberpunk 2077（Soulkiller/Relic/Breach Protocol 设计语言）
- 用户只需一个 OpenRouter API Key，零其他配置即可上手
- Docker 依赖对用户完全透明——有 Docker 自动加速，无 Docker 自动降级

## Goals / Non-Goals

**Goals:**
- 跑通完整链路：导入数据 → 蒸馏灵魂 → 与分身对话 → 发布/分发
- Cyberpunk 风格的沉浸式终端体验（启动/退出动画、glitch 效果、Relic prompt）
- 双模式引擎对用户无感（Docker/Local 自动切换）
- 全自动化 snapshot 测试覆盖视觉和功能
- 支持 Markdown + Twitter Archive 两个数据源
- Soul package 可发布到 GitHub、可通过 MCP 接入 Claude

**Non-Goals:**
- 微信/飞书/Claude 数据源（Phase 2）
- Web 聊天界面（Phase 3）
- 多人格切换（Phase 3）
- 隐私分级/access control（Phase 2）
- Ollama/本地模型支持（Phase 2）
- 增量蒸馏/drift detection（Phase 2）
- 校准测试自动化（Phase 2，V1 手动校准）
- OpenClaw 导出（Phase 2，先确保核心链路稳定）

## Decisions

### D1: REPL 框架 — ink (React for CLI)

**选择**: ink + React
**替代方案**: 自研 readline + ANSI, @clack/prompts, blessed
**理由**:
- ink 的 React 组件模型天然适合复杂 UI 状态管理（动画帧、流式输出、交互式选择器）
- `useState` + `useEffect` 驱动动画逻辑，比手动 setInterval 管理状态更可靠
- ink-testing-library 提供开箱即用的组件测试能力
- 社区活跃，Claude Code 同生态

### D2: 双模式引擎架构 — Engine Adapter 抽象层

**选择**: 统一 EngineAdapter 接口，Docker 和 Local 两个实现
**替代方案**: 仅 Docker、仅 Local
**理由**:
- 纯 Docker 方案门槛太高，很多用户没有 Docker
- 纯 Local 方案在大数据量时 Node.js 跑 BGE-M3 embedding 慢
- 抽象层让两种模式对上层完全透明，REPL 不关心底层是哪个引擎

```
interface EngineAdapter {
  ingest(chunks: SoulChunk[]): Promise<IngestResult>
  recall(query: string, opts?: RecallOptions): Promise<SoulChunk[]>
  distill(config: DistillConfig): Promise<SoulFiles>
  status(): Promise<EngineStatus>
}
```

启动时自动检测逻辑：
1. 检测 Docker daemon 是否运行（`docker info`）
2. 检测 soulkiller-engine 容器是否存在
3. 有 → DockerEngine，无 → LocalEngine
4. 降级时显示 `▓ soul engine: local mode`，不阻断流程

### D3: LLM 通道 — OpenRouter 统一接入

**选择**: 所有 LLM 调用走 OpenRouter，使用 OpenAI SDK 兼容接口
**替代方案**: 直接接各家 API、使用 LangChain
**理由**:
- 一个 Key 覆盖 300+ 模型，用户零选择成本
- OpenAI SDK 兼容意味着代码中用 `openai` npm 包即可，改 baseURL + model ID 就能切模型
- 不依赖 LangChain 减少依赖体积和抽象层

```typescript
const client = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: config.llm.api_key,
})
```

### D4: 向量存储 — LanceDB 嵌入式

**选择**: LanceDB (@lancedb/lancedb npm 包)
**替代方案**: ChromaDB, Qdrant, Pinecone
**理由**:
- 嵌入式，单文件，无需服务进程
- 适合打包进 soul package 分发（别人下载后直接加载预计算索引）
- Node.js 和 Python 都有 SDK，Docker/Local 两模式均可用

### D5: Embedding 模型 — BGE-M3

**选择**: BAAI/bge-m3
**替代方案**: text-embedding-3-small (OpenAI), jina-embeddings-v2
**理由**:
- 多语言支持（中英日），匹配用户画像
- 模型体积可控（~570MB），Docker 打包可行，Node.js 端用 @xenova/transformers 加载 ONNX 版本
- dense + sparse 混合检索能力，后续可利用

### D6: 视觉动画实现 — ink 组件 + 可控随机种子

**选择**: 每个动画是一个 ink React 组件，glitch 效果通过 seeded PRNG 实现
**理由**:
- 动画组件化便于独立测试和组合
- 可控种子（`SOULKILLER_SEED` 环境变量）确保 CI 中动画帧完全可复现
- 正常使用时不设种子，保持真随机的 cyberpunk 感

关键动画组件：
- `<BootAnimation />` — 启动序列（hex matrix → glitch → logo → init）
- `<ExitAnimation />` — 退出序列（save → heartbeat decay → flatline → CRT off）
- `<SoulRecallPanel />` — 检索面板（scan → results → collapse）
- `<MalfunctionError />` — 错误展示（glitch 强度 ∝ 严重级别）
- `<GlitchText />` — 基础 glitch 文字效果
- `<HeartbeatLine />` — 心电图波形

### D7: 测试架构 — 四层金字塔

**选择**: 单元 + 组件快照 + 视觉像素快照 + 集成测试

| 层 | 工具 | 验证内容 | CI 耗时 |
|----|------|---------|---------|
| 单元 | vitest | parser, adapter, config | ~5s |
| 组件 | ink-testing-library + vitest snapshot | 文本布局、组件状态 | ~10s |
| 视觉 | playwright + xterm.js + pixelmatch | 颜色、动画帧、整体观感 | ~30s |
| 集成 | vitest + docker (可选) | engine 双模式一致性 | ~60s |

视觉测试流程：
1. playwright 打开内嵌 xterm.js 的测试页面（固定 120×40, monospace 14px, bg #181818）
2. node-pty 通过 WebSocket 连接 soulkiller 进程
3. 脚本驱动输入，在关键帧截图
4. pixelmatch 与 `__baselines__/` 对比，threshold 0.1
5. 失败时输出 diff 图到 CI artifacts

### D8: 项目结构

```
soulkiller/
├─ src/
│  ├─ cli/                    # ink 组件和 REPL 入口
│  │  ├─ app.tsx              # 主应用组件
│  │  ├─ commands/            # slash 命令处理器
│  │  │  ├─ create.tsx
│  │  │  ├─ feed.tsx
│  │  │  ├─ distill.tsx
│  │  │  ├─ recall.tsx
│  │  │  ├─ model.tsx
│  │  │  ├─ source.tsx
│  │  │  ├─ use.tsx
│  │  │  ├─ publish.tsx
│  │  │  ├─ link.tsx
│  │  │  ├─ status.tsx
│  │  │  ├─ list.tsx
│  │  │  └─ help.tsx
│  │  ├─ components/          # 通用 UI 组件
│  │  │  ├─ prompt.tsx        # ◈ soul://name > 提示符
│  │  │  ├─ streaming-text.tsx
│  │  │  ├─ progress-bar.tsx
│  │  │  └─ checkbox-select.tsx
│  │  └─ animation/           # 动画组件
│  │     ├─ boot-animation.tsx
│  │     ├─ exit-animation.tsx
│  │     ├─ soul-recall-panel.tsx
│  │     ├─ malfunction-error.tsx
│  │     ├─ glitch-text.tsx
│  │     ├─ heartbeat-line.tsx
│  │     └─ glitch-engine.ts  # seeded PRNG + glitch 算法
│  │
│  ├─ engine/                 # 引擎层
│  │  ├─ adapter.ts           # EngineAdapter 接口
│  │  ├─ docker-engine.ts     # Docker 模式实现
│  │  ├─ local-engine.ts      # Local 模式实现
│  │  └─ detect.ts            # 引擎自动检测
│  │
│  ├─ ingest/                 # 数据采集
│  │  ├─ types.ts             # SoulChunk 类型定义
│  │  ├─ markdown-adapter.ts
│  │  ├─ twitter-adapter.ts
│  │  └─ pipeline.ts          # 统一采集入口
│  │
│  ├─ distill/                # 蒸馏引擎
│  │  ├─ sampler.ts           # chunk 采样策略
│  │  ├─ extractor.ts         # LLM 特征提取
│  │  └─ generator.ts         # 生成 identity.md / style.md / behaviors/
│  │
│  ├─ soul/                   # Soul package
│  │  ├─ package.ts           # 打包/解包
│  │  ├─ manifest.ts          # manifest.json 生成
│  │  └─ publish.ts           # GitHub 发布
│  │
│  ├─ llm/                    # LLM 通道
│  │  ├─ client.ts            # OpenRouter client (OpenAI SDK)
│  │  ├─ models.ts            # 模型列表和推荐
│  │  └─ stream.ts            # 流式输出处理
│  │
│  ├─ config/                 # 配置管理
│  │  ├─ schema.ts            # config.yaml 结构
│  │  ├─ loader.ts            # 加载/保存
│  │  └─ setup-wizard.ts      # 首次配置向导
│  │
│  └─ index.ts                # CLI 入口
│
├─ engine/                    # Docker engine (Python)
│  ├─ Dockerfile
│  ├─ docker-compose.yml
│  ├─ main.py                 # FastAPI 入口
│  ├─ ingest.py
│  ├─ recall.py
│  └─ requirements.txt
│
├─ tests/
│  ├─ unit/
│  ├─ component/
│  │  └─ __snapshots__/
│  ├─ visual/
│  │  ├─ harness/
│  │  │  ├─ terminal.html
│  │  │  └─ server.ts
│  │  └─ __baselines__/
│  └─ integration/
│
├─ package.json
├─ tsconfig.json
├─ vitest.config.ts
└─ README.md
```

## Risks / Trade-offs

### R1: Node.js 端 BGE-M3 性能
- **风险**: @xenova/transformers 跑 ONNX 模型，首次加载 ~570MB，embedding 速度比 Python 慢 2-3x
- **缓解**: Local 模式定位为「够用就行」的降级方案；显示处理进度让用户有预期；后续可引入 WebGPU 加速

### R2: ink 流式输出复杂度
- **风险**: ink 的 React 渲染循环与 LLM streaming token 的结合可能出现闪烁或性能问题
- **缓解**: 使用 `useStdout` + 手动批量更新，控制重渲染频率（每 50ms 最多一次）

### R3: 视觉快照测试脆弱性
- **风险**: 不同 OS/字体渲染可能导致像素级差异，CI 环境与本地不一致
- **缓解**: CI 使用固定 Docker 镜像（含指定字体）；pixelmatch threshold 设 0.1 容忍抗锯齿差异；xterm.js 固定尺寸和字体消除终端差异

### R4: Docker 自动管理的边界情况
- **风险**: Docker daemon 运行但权限不足、端口冲突、容器状态异常
- **缓解**: 检测失败静默降级到 Local 模式，不阻断用户流程；`/status` 命令显示引擎状态供调试

### R5: OpenRouter 单点依赖
- **风险**: OpenRouter 故障导致整个应用不可用
- **缓解**: V1 接受此风险；config 结构预留 provider 扩展字段，Phase 2 支持 Ollama 等本地方案
