## Why

当前 Soulkiller 的配置仅包含 LLM 相关设置（provider、api_key、model），缺少用户偏好管理。用户无法切换界面语言、控制动画效果，也不能通过统一的 `/config` 命令查看和修改配置。需要将散落的配置项整合为一个完整的配置管理系统，提供 CLI 命令进行交互式修改。

## What Changes

- 扩展 `SoulkillerConfig` 接口，新增 `language`（界面语言）和 `animation`（是否启用动画）字段
- 支持中文（zh）、日文（ja）、英文（en）三种语言
- 新增 `/config` 命令，支持查看当前配置和交互式修改各项配置
- 新增 `/config set <key> <value>` 快捷设置语法
- 所有用户可见文本通过 i18n 层按当前语言输出
- 动画开关控制所有 cyberpunk 视觉动画的启用/禁用

## Capabilities

### New Capabilities
- `config-command`: `/config` CLI 命令，支持查看和交互式修改配置（model、api_key、language、animation）
- `i18n`: 多语言支持系统，管理 zh/ja/en 三种语言的翻译文本

### Modified Capabilities
- （无现有 spec 需要修改）

## Impact

- `src/config/schema.ts` — 扩展接口和默认值
- `src/config/loader.ts` — 配置迁移逻辑（向后兼容旧配置文件）
- `src/cli/` — 新增 `/config` 命令注册和交互组件
- `src/cli/animation/` — 动画组件需读取 animation 开关
- `src/i18n/` — 新增 i18n 模块（翻译文件 + 工具函数）
- `~/.soulkiller/config.yaml` — 文件结构变更（新增字段）
