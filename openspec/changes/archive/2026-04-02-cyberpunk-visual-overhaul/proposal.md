## Why

当前 Soulkiller 的视觉风格（cyan/magenta 多彩配色、简单的 ASCII logo、短暂的启动序列）与 Cyberpunk 2077 游戏中 Arasaka 企业终端的真实视觉语言存在显著差距。需要将整个视觉系统重构为接近游戏中 Arasaka 终端的红色单色系、BIOS 风格启动、数据瀑布和企业面板风格，以提供更沉浸的体验。

## What Changes

- **BREAKING**: 全局配色从 cyan/magenta 多色方案切换为红色单色系（#FF3333 亮红、#882222 暗红、#FFAAAA 白红、#440011 深红、#080808 纯黑背景），仅保留 #F3E600 黄色作为警告色
- 启动动画从当前 4 秒 3 阶段序列重构为 15-25 秒的 4 阶段 Arasaka 终端启动体验：BIOS Boot → Hex Data Waterfall → Arasaka Panel → Ready
- 新增高精度 ANSI art Arasaka logo（130 列宽、26 行高、ratio 0.8），作为启动面板的核心视觉元素
- 新增日文元素：ソウルキラー端末、[荒坂産業] 等标识
- 新增 "BOOTING..." ANSI TrueColor 渐变高亮条
- 新增 Hex + Morse-like 数据瀑布滚动效果
- 新增 Arasaka 企业信息面板（设备状态、进度条、发光双层边框）
- 所有现有动画组件（GlitchText、HeartbeatLine、MalfunctionError、SoulRecallPanel 等）配色适配红色系

## Capabilities

### New Capabilities
- `arasaka-boot-sequence`: 全新的 4 阶段 Arasaka 风格启动序列（BIOS Boot、Hex Waterfall、Arasaka Panel、Ready），时长 15-25 秒
- `arasaka-logo-asset`: 高精度 ANSI art Arasaka logo 资源及其在启动面板中的集成
- `booting-highlight-bar`: ANSI TrueColor 渐变背景的 "BOOTING..." 高亮条组件

### Modified Capabilities
- `cyberpunk-visual-system`: 配色方案从 cyan/magenta 多色切换为红色单色系；所有动画组件配色适配；退出动画配色适配

## Impact

- `src/cli/animation/colors.ts` — 完全重写颜色定义
- `src/cli/animation/boot-animation.tsx` — 完全重写启动序列
- `src/cli/animation/exit-animation.tsx` — 配色适配
- `src/cli/animation/glitch-text.tsx` — 默认颜色适配
- `src/cli/animation/heartbeat-line.tsx` — 健康状态颜色映射适配
- `src/cli/animation/malfunction-error.tsx` — 边框和文字颜色适配
- `src/cli/animation/relic-load-animation.tsx` — 配色适配
- `src/cli/animation/soul-recall-panel.tsx` — 配色适配
- `src/cli/animation/soulkiller-protocol-panel.tsx` — 配色适配
- `src/cli/animation/crt-scanline.tsx` — 颜色适配
- `src/cli/components/prompt.tsx` — 状态颜色适配
- `src/cli/components/conversation-view.tsx` — 消息颜色适配
- `assets/logo-red-130-r08.ans` — 新增 ANSI logo 资源文件
- `tests/component/` — 所有快照测试需要更新
