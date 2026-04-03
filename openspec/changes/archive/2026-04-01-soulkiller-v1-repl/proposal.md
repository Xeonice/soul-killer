## Why

Soulkiller 需要一个可用的 V1 版本：一个 Cyberpunk 2077 风格的 REPL 应用，让用户从自己的数字痕迹中提取"灵魂"，生成可分发的数字分身，并允许其他人通过 CLI/Claude/OpenClaw 与之对话。当前项目从零开始，需要搭建完整的 REPL 交互层、数据采集管线、蒸馏引擎、向量检索和分发链路。

## What Changes

- 新建 Node.js + TypeScript + ink 项目，实现完整的 REPL 应用
- Cyberpunk 2077 风格视觉系统：启动动画（hex matrix glitch → logo → init）、退出动画（heartbeat flatline → CRT off）、Relic 风格 prompt、SOUL_RECALL 检索面板、Malfunction 错误展示
- 色彩方案：cyan `#00F7FF`、magenta `#ED1E79`、yellow `#F3E600`、red `#880425`、bg `#181818`
- 首次启动 OpenRouter API Key 配置向导 + 模型选择
- `/create` 交互式创建分身（姓名、简介、数据源选择、路径输入、处理进度）
- 两个数据源 adapter：Markdown 文档（heading 分块）、Twitter Archive（tweet.js 解析 + thread 合并）
- 统一 SoulChunk 格式，embedding（BGE-M3）+ LanceDB 向量存储
- 双模式引擎：Docker engine（Python + FastAPI）优先，无 Docker 时降级到 Node.js 本地模式（@xenova/transformers + @lancedb/lancedb），对用户透明
- 蒸馏管线：采样 chunks → OpenRouter 调 LLM 提取特征 → 生成 identity.md / style.md / behaviors/
- REPL 内自然语言对话：加载 soul + RAG 检索 + OpenRouter LLM 生成回答，流式输出
- Soul package 打包格式（manifest.json + soul/ + vectors/ + examples/）
- `/publish` 发布到 GitHub、`/use <name>` 下载加载、`/link` 自动配置到 Claude Desktop/Code
- 全自动化 snapshot 测试：ink-testing-library 文本快照 + playwright + xterm.js 像素级视觉快照（可控随机种子）

## Capabilities

### New Capabilities

- `cyberpunk-visual-system`: Cyberpunk 2077 风格视觉系统——启动/退出动画、glitch 效果、CRT scanline、Relic prompt、SOUL_RECALL 面板、Malfunction 错误展示、色彩方案
- `repl-shell`: ink 基础 REPL 框架——命令解析、slash 命令路由、自然语言输入分流、流式输出、交互式 prompt（checkbox/input/confirm）
- `openrouter-integration`: OpenRouter LLM 通道——首次配置向导、API Key 验证、模型选择/切换、OpenAI SDK 兼容调用、config.yaml 持久化
- `data-ingest`: 数据采集管线——Markdown adapter（heading 分块）、Twitter Archive adapter（tweets.js 解析 + thread 合并）、统一 SoulChunk 格式、adapter 扩展接口
- `engine-dual-mode`: 双模式引擎抽象——统一 Engine Adapter 接口、Docker engine（Python + FastAPI + BGE-M3 + LanceDB）、Local engine（Node.js in-process）、启动时自动检测切换、对用户透明
- `soul-distill`: 灵魂蒸馏引擎——从向量库采样 chunks、通过 OpenRouter 调 LLM 提取 identity/style/behavior 特征、生成结构化灵魂文件（identity.md / style.md / behaviors/）
- `soul-conversation`: 分身对话能力——加载 soul 文件 + RAG 语义检索 + LLM 生成回答、检索来源溯源（/source）、流式输出 + SOUL_RECALL 动画
- `soul-package`: Soul package 打包与分发——manifest.json 生成、package 目录结构、`/publish` 发布到 GitHub、`/use <name>` 下载加载远程 package、`/link` 自动配置到 Claude Desktop/Code
- `visual-snapshot-testing`: 全自动化视觉测试——ink-testing-library 文本快照、playwright + xterm.js 像素级截图对比（pixelmatch）、可控随机种子、CI 集成、baseline 管理

### Modified Capabilities

（无，项目从零开始）

## Impact

- **新项目初始化**：需要创建完整的 Node.js + TypeScript 项目结构、package.json、tsconfig、vitest 配置
- **依赖项**：ink, react, chalk, openai (OpenRouter 兼容), @lancedb/lancedb, @xenova/transformers, playwright (dev), ink-testing-library (dev), pixelmatch (dev)
- **Docker**：需要构建 Python + FastAPI engine 镜像（BGE-M3 + LanceDB），但用户可选——无 Docker 时自动降级
- **外部服务**：OpenRouter API（必需，用户自备 Key）、GitHub（/publish 发布，可选）
- **文件系统**：`~/.soulkiller/` 存放配置和本地 soul packages
- **Claude 生态**：`/link` 命令会修改用户的 Claude Desktop/Code MCP 配置文件
