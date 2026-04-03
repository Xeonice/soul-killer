## Context

Soulkiller 当前的配置系统（`src/config/`）仅管理 LLM 相关设置，存储在 `~/.soulkiller/config.yaml`。现有接口 `SoulkillerConfig` 只包含 `llm` 和 `search` 两个字段。用户无法在 REPL 内修改配置，也没有语言切换或动画控制能力。

现有命令 `/model` 已实现模型查看/切换，本次设计需要将其纳入统一的 `/config` 命令体系。

## Goals / Non-Goals

**Goals:**
- 扩展配置 schema，新增 `language` 和 `animation` 字段
- 提供 `/config` 命令用于查看和修改所有配置
- 实现 i18n 模块，支持 zh/ja/en 三种语言
- 动画开关能全局控制 cyberpunk 动画组件
- 向后兼容：旧配置文件自动补充缺省值

**Non-Goals:**
- 不实现运行时语言热切换（修改语言后需要重启生效，或在下一次输出时生效即可）
- 不实现自定义翻译或语言包扩展机制
- 不迁移 `/model` 命令为 `/config` 的子命令（保留 `/model` 作为快捷方式）
- 不涉及 Docker Engine 端的配置同步

## Decisions

### 1. 配置 schema 扩展方式

在 `SoulkillerConfig` 接口中平铺新增字段：

```typescript
export interface SoulkillerConfig {
  llm: { provider: 'openrouter'; api_key: string; default_model: string; distill_model?: string }
  search?: { tavily_api_key?: string }
  language: 'zh' | 'ja' | 'en'       // 新增
  animation: boolean                   // 新增
}
```

**为什么平铺而不分组？** 这两个字段是独立的顶层偏好，不属于 llm 或 search 分组。平铺结构与现有 YAML 文件风格一致，用户编辑配置文件时也更直观。

### 2. i18n 方案

采用简单的 JSON 字典 + 工具函数方案：

```
src/i18n/
  index.ts          — t() 函数、setLocale()、getLocale()
  locales/
    zh.json
    ja.json
    en.json
```

**为什么不用 i18next？** Soulkiller 是 CLI 应用，翻译量小（约 50-100 条），不需要复用化、命名空间等特性。一个简单的 `t(key)` 函数配合 JSON 文件足矣，避免引入额外依赖。

翻译 key 采用点号分隔的层级命名：`config.language.label`、`command.help.description` 等。

### 3. /config 命令设计

- `/config` — 显示当前所有配置的表格视图
- `/config set <key> <value>` — 直接设置某项配置
- `/config reset` — 恢复所有配置为默认值（需确认）

支持的 key: `model`、`api_key`、`language`、`animation`。

**为什么不做交互式菜单？** `/config set` 的直接语法更符合 CLI 用户的操作习惯，减少交互步骤。查看用 `/config`，修改用 `/config set`，简洁明了。

### 4. 动画开关实现

在动画组件（GlitchText、BootAnimation 等）中读取配置的 `animation` 字段。当 `animation: false` 时：
- BootAnimation 跳过，直接进入 idle 状态
- GlitchText 渲染纯文本，不做字符替换
- HeartbeatLine 和 RelicLoadAnimation 不渲染

通过一个 `useAnimation()` hook 从配置中读取开关状态，供所有动画组件使用。

### 5. 向后兼容

`loadConfig()` 加载后，对缺失字段填充默认值（`language: 'zh'`、`animation: true`）。不需要迁移脚本，YAML 的灵活性天然支持字段扩展。

## Risks / Trade-offs

- **[翻译覆盖不完整]** → 首版仅翻译核心 UI 文本（命令描述、提示信息、错误消息），不翻译 soul 内容输出。后续按需扩展。
- **[语言切换不即时]** → i18n 模块在启动时读取语言设置，运行中修改后提示用户重启。可接受的 MVP 行为。
- **[/model 命令与 /config 重叠]** → 保留 `/model` 作为快捷方式，`/config set model` 也能修改。两个入口指向同一配置字段，无冲突。
