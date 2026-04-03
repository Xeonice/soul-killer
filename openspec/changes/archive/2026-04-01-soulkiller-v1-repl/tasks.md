## 1. 项目初始化

- [x] 1.1 初始化 Node.js + TypeScript 项目（package.json, tsconfig.json, vitest.config.ts）
- [x] 1.2 安装核心依赖：ink, react, chalk, openai, yaml（@lancedb/lancedb, @xenova/transformers 延迟到引擎任务安装）
- [x] 1.3 安装开发依赖：typescript, tsx, vitest, @types/react, ink-testing-library（playwright, pixelmatch, node-pty, xterm 延迟到测试任务安装）
- [x] 1.4 创建项目目录结构（src/cli, src/engine, src/ingest, src/distill, src/soul, src/llm, src/config, tests/）
- [x] 1.5 配置 TypeScript 编译（JSX for ink, paths alias）
- [x] 1.6 配置 CLI 入口（bin 字段，`soulkiller` 命令）

## 2. 配置管理

- [x] 2.1 定义 config.yaml schema（llm.provider, api_key, default_model, distill_model）
- [x] 2.2 实现 config loader：加载/保存 ~/.soulkiller/config.yaml
- [x] 2.3 实现首次启动检测（config 文件不存在 → 触发 setup wizard）

## 3. Cyberpunk 视觉系统 — 基础

- [x] 3.1 实现 GlitchEngine：seeded PRNG（接受 SOULKILLER_SEED 环境变量），字符替换算法
- [x] 3.2 实现 `<GlitchText />` 组件：文字 glitch 效果，可配置强度和持续时间
- [x] 3.3 实现色彩常量模块（cyan, magenta, yellow, red, bg, dim）
- [x] 3.4 实现 CRT scanline 效果组件

## 4. Cyberpunk 视觉系统 — 启动动画

- [x] 4.1 实现 `<BootAnimation />` Phase 1：hex matrix glitch（随机十六进制碎片，cyan/magenta 闪烁，~1s）
- [x] 4.2 实现 `<BootAnimation />` Phase 2：Logo 成形（碎片稳定拼合为 SOULKILLER ASCII art，~1.5s）
- [x] 4.3 实现 `<BootAnimation />` Phase 3：系统初始化（逐行打印 + spinner，~1s）
- [x] 4.4 实现动画完成回调（通知 REPL 主组件进入交互模式）

## 5. Cyberpunk 视觉系统 — 退出动画

- [x] 5.1 实现退出 Phase 1：状态保存（progress bar + "compressing neural state"）
- [x] 5.2 实现 `<HeartbeatLine />` 组件：ECG 波形逐帧渲染
- [x] 5.3 实现退出 Phase 2：心电波衰减（波形从正常到微弱，颜色 cyan→magenta→red）
- [x] 5.4 实现退出 Phase 3：Flatline（直线 + NEURAL LINK SEVERED）
- [x] 5.5 实现退出 Phase 4：Glitch 消散 + CRT 关机效果（从中间向上下收缩）+ 最终消息

## 6. Cyberpunk 视觉系统 — 交互组件

- [x] 6.1 实现 `<SoulPrompt />` 组件：◈ soul://name > 格式，支持 void/loaded/RELIC/RECALL/STREAMING/MALFUNCTION 状态
- [x] 6.2 实现 `<SoulRecallPanel />` 组件：cyan 边框，magenta 标签，动态相似度条，自动收起
- [x] 6.3 实现 `<MalfunctionError />` 组件：三级严重度（WARNING/MALFUNCTION/CRITICAL），对应 yellow/magenta/red + glitch 强度递增
- [x] 6.4 实现 `<StreamingText />` 组件：LLM token 流式渲染，50ms 节流重渲染

## 7. REPL Shell 框架

- [x] 7.1 实现主 `<App />` ink 组件：状态机（boot → setup_wizard → idle → command → conversation → exit）
- [x] 7.2 实现命令解析器：`/` 前缀识别 slash 命令，提取命令名 + 参数
- [x] 7.3 实现命令路由器：根据命令名分派到对应处理组件，未知命令提示相近命令
- [x] 7.4 实现自然语言输入分流：无 `/` 前缀时判断是否有已加载 soul，有则进入对话模式
- [x] 7.5 实现交互式输入组件：文本输入、checkbox 多选（◉/◯）、确认（Y/n）、文件路径输入
- [x] 7.6 实现 /help 命令：按分类列出所有命令及简介
- [x] 7.7 实现 /quit 命令：触发退出动画 → process.exit

## 8. OpenRouter 集成

- [x] 8.1 实现 setup wizard 组件：API Key 输入 → 调用 OpenRouter 验证 → 显示余额
- [x] 8.2 实现模型选择组件：显示推荐模型列表（含价格），用户单选，保存到 config
- [x] 8.3 实现 OpenRouter client：基于 openai npm 包，设置 baseURL 和 apiKey
- [x] 8.4 实现流式 chat completion 封装：返回 AsyncIterable<string> 供 StreamingText 消费
- [x] 8.5 实现 /model 命令：无参显示当前模型 + 列表，有参切换模型，suggest 子命令按用途推荐

## 9. 数据采集管线

- [x] 9.1 定义 SoulChunk TypeScript 类型（id, source, content, timestamp, context, type, metadata）
- [x] 9.2 定义 DataAdapter 接口（adapt(path: string): AsyncIterable<SoulChunk>）
- [x] 9.3 实现 Markdown adapter：递归扫描 .md 文件，按 h1/h2 heading 分块，提取元数据
- [x] 9.4 实现 Twitter adapter：解析 tweets.js，过滤 RT/纯链接，合并 <30min 相邻推文为 thread
- [x] 9.5 实现 ingest pipeline：接受 adapter 选择 + 路径列表，运行 adapters，收集 chunks，传递给 engine
- [x] 9.6 实现进度事件发射器：files_scanned, chunks_created, embedding_progress 事件供 UI 绑定

## 10. 双模式引擎

- [x] 10.1 定义 EngineAdapter 接口（ingest, recall, distill, status 方法）
- [x] 10.2 实现引擎自动检测：检查 docker daemon → 检查容器 → 选择 DockerEngine 或 LocalEngine
- [x] 10.3 实现 LocalEngine：TF-IDF 文本检索（MVP），预留 @xenova/transformers + @lancedb/lancedb 升级路径
- [x] 10.4 实现 DockerEngine：HTTP client 调用 localhost:6600 API（ingest/recall/status）
- [x] 10.5 实现 Docker 容器静默管理：无容器时自动 pull + start soulkiller-engine 镜像
- [x] 10.6 创建 Docker engine 项目：Dockerfile, docker-compose.yml, Python FastAPI 入口
- [x] 10.7 实现 Python engine API：/ingest、/recall、/status（BGE-M3 embedding 待集成）
- [x] 10.8 实现 /status 命令 UI：显示引擎模式、chunk 数量、索引大小

## 11. 蒸馏引擎

- [x] 11.1 实现 chunk 采样器：从向量库随机采样 200 条，按 source 和 type 分组
- [x] 11.2 实现 LLM 特征提取器：将分组 chunks 分批发送给 OpenRouter LLM，prompt 要求提取 identity/style/behavior 特征
- [x] 11.3 实现灵魂文件生成器：合并去重多批结果，生成 identity.md / style.md / behaviors/*.md
- [x] 11.4 实现 /distill 命令：触发蒸馏流程，显示进度，完成后提示查看生成的文件
- [x] 11.5 在 /create 流程末尾集成自动蒸馏（数据导入完成后自动触发）

## 12. 分身对话

- [x] 12.1 实现对话引擎：加载 soul 文件 → RAG recall → 构建 prompt（soul context + retrieved chunks + user query）→ OpenRouter 流式生成
- [x] 12.2 集成 SOUL_RECALL 动画：对话前显示检索面板（文件路径 + 相似度），面板收起后开始流式输出
- [x] 12.3 实现 /source 命令：重新展示上一次回答的检索来源
- [x] 12.4 实现灵魂自我标识：首次对话和重要建议时自动声明 AI 身份
- [x] 12.5 实现边界感知：无相关数据时回答 "我的记忆中没有相关信息"
- [x] 12.6 实现 /recall <query> 命令：手动 RAG 检索测试，显示 top-k 结果 + 相似度分数

## 13. Soul Package 与分发

- [x] 13.1 实现 soul package 打包：生成 manifest.json + 整合 soul/ + vectors/ + examples/ 目录结构
- [x] 13.2 实现 /publish 命令：打包 → 用户输入 GitHub repo → push 到 GitHub（通过 gh CLI 或 git）
- [x] 13.3 实现 /use <name> 命令：从 GitHub 下载 soul package → 解压到 ~/.soulkiller/souls/<name>/ → 加载到 REPL → 切换 prompt 为 RELIC 模式
- [x] 13.4 实现 /link 命令：检测 Claude Desktop / Claude Code → 写入 MCP server 配置 → 提示重启
- [x] 13.5 实现 /list 命令：列出 ~/.soulkiller/souls/ 下所有本地分身（含创建的和下载的）

## 14. /create 交互式流程整合

- [x] 14.1 实现 /create 命令组件：串联姓名输入 → 简介输入 → 数据源 checkbox → 路径输入 → ingest pipeline → 自动 distill
- [x] 14.2 实现 /feed <path> 命令：增量导入新数据到已有 soul

## 15. 测试基础设施

- [x] 15.1 配置 vitest（单元 + 组件测试）
- [x] 15.2 搭建 visual test harness：terminal.html（xterm.js 固定 120×40）+ server.ts（node-pty WebSocket bridge）
- [x] 15.3 实现 pixelmatch 对比工具函数：加载 baseline、截图对比、生成 diff 图
- [x] 15.4 编写 update-baselines.ts 脚本：一键重新生成所有视觉 baselines

## 16. 单元测试

- [x] 16.1 Markdown adapter 测试：分块逻辑、元数据提取、空文件/无 heading 边界情况
- [x] 16.2 Twitter adapter 测试：tweets.js 解析、RT 过滤、thread 合并逻辑
- [x] 16.3 命令解析器测试：slash 命令识别、参数提取、自然语言分流
- [x] 16.4 Config loader 测试：加载/保存/默认值/缺失字段处理
- [x] 16.5 GlitchEngine 测试：seeded 输出可复现、无 seed 时随机

## 17. 组件快照测试

- [x] 17.1 SoulPrompt 快照：各状态（void, loaded, RELIC, RECALL, STREAMING, MALFUNCTION）
- [x] 17.2 SoulRecallPanel 快照：显示/收起状态，不同数量的检索结果
- [x] 17.3 MalfunctionError 快照：三个严重级别
- [ ] 17.4 Setup wizard 快照：各步骤状态（延迟到 setup wizard 稳定后）
- [x] 17.5 Help 命令输出快照

## 18. 视觉快照测试

- [ ] 18.1 启动动画视觉测试：5 个关键帧截图 + baseline 对比
- [ ] 18.2 退出动画视觉测试：4 个关键帧截图 + baseline 对比
- [ ] 18.3 SOUL_RECALL 面板视觉测试：展开态 + 收起态截图
- [ ] 18.4 错误展示视觉测试：WARNING / MALFUNCTION / CRITICAL 三级截图
- [ ] 18.5 /create 流程视觉测试：各步骤截图

## 19. 集成测试

- [x] 19.1 Local engine 集成测试：ingest → recall 完整链路（使用 test fixtures）— 12 个测试覆盖 markdown/twitter/pipeline 全链路
- [ ] 19.2 Docker engine 集成测试：同上，通过 Docker（需要 docker compose up）
- [ ] 19.3 双模式一致性测试：同一组 test cases 在两种模式下输出对比（依赖 19.2）

## 20. CI 配置

- [x] 20.1 配置 GitHub Actions workflow：unit → component → visual → integration 四阶段
- [x] 20.2 Visual 阶段配置：SOULKILLER_SEED=42、失败时上传 diff artifacts
- [x] 20.3 Integration 阶段配置：local engine（docker 可选扩展）
