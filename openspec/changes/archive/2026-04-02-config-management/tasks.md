## 1. Config Schema 扩展

- [x] 1.1 在 `src/config/schema.ts` 的 `SoulkillerConfig` 接口中新增 `language: 'zh' | 'ja' | 'en'` 和 `animation: boolean` 字段
- [x] 1.2 更新 `DEFAULT_CONFIG`，设置 `language: 'zh'`、`animation: true`
- [x] 1.3 在 `src/config/loader.ts` 的 `loadConfig()` 中增加缺失字段的默认值填充逻辑

## 2. i18n 模块

- [x] 2.1 创建 `src/i18n/index.ts`，实现 `t(key, params?)`、`setLocale()`、`getLocale()` 函数
- [x] 2.2 创建 `src/i18n/locales/zh.json`，包含所有中文翻译
- [x] 2.3 创建 `src/i18n/locales/ja.json`，包含所有日文翻译
- [x] 2.4 创建 `src/i18n/locales/en.json`，包含所有英文翻译
- [x] 2.5 在应用启动流程（`src/cli/app.tsx`）中根据配置初始化 i18n locale

## 3. /config 命令

- [x] 3.1 在 `src/cli/command-registry.ts` 中注册 `config` 命令
- [x] 3.2 实现 `/config` 查看功能：表格形式展示当前配置（api_key 脱敏显示）
- [x] 3.3 实现 `/config set <key> <value>` 功能：支持 model、api_key、language、animation 四个 key
- [x] 3.4 实现参数校验：无效 key 报错并列出可用 key，无效 language 值提示支持列表
- [x] 3.5 实现 `/config reset` 功能：恢复默认值前要求用户确认
- [x] 3.6 在 `app.tsx` 的命令路由中集成 config 命令处理

## 4. 动画开关

- [x] 4.1 创建 `useAnimation()` hook 或工具函数，从配置中读取 animation 开关
- [x] 4.2 在 BootAnimation 中接入开关：关闭时跳过动画直接进入 idle
- [x] 4.3 在 GlitchText 中接入开关：关闭时直接渲染纯文本
- [x] 4.4 在 HeartbeatLine、RelicLoadAnimation 等组件中接入开关

## 5. 现有文本 i18n 化

- [x] 5.1 将 `command-registry.ts` 中的命令描述替换为 `t()` 调用
- [x] 5.2 将核心系统消息（启动、退出、错误提示）替换为 `t()` 调用

## 6. 测试

- [x] 6.1 为配置 schema 扩展和默认值填充编写单元测试
- [x] 6.2 为 i18n `t()` 函数编写单元测试（含插值、fallback）
- [x] 6.3 为 `/config` 命令编写组件测试（查看、set、reset、错误处理）
- [x] 6.4 为动画开关编写组件测试（验证 animation: false 时跳过动画）
