## 1. 配色系统重构

- [x] 1.1 重写 `src/cli/animation/colors.ts`：将 CYAN/MAGENTA/YELLOW/RED/BG/DIM 替换为 PRIMARY (#FF3333) / ACCENT (#FFAAAA) / DIM (#882222) / DARK (#440011) / WARNING (#F3E600) / BG (#080808)
- [x] 1.2 全局替换所有引用旧颜色常量的 import（CYAN → PRIMARY, MAGENTA → ACCENT/PRIMARY, RED → DARK 等），覆盖 `src/cli/animation/` 和 `src/cli/components/` 下所有文件
- [x] 1.3 适配 `heartbeat-line.tsx` 的健康状态颜色映射：health>0.6 → PRIMARY, 0.3-0.6 → DIM, <0.3 → DARK, flatline → DIM
- [x] 1.4 适配 `malfunction-error.tsx` 的严重级别颜色：warning → WARNING, malfunction → PRIMARY, critical → ACCENT
- [x] 1.5 适配 `glitch-text.tsx` 的默认 glitchColor 和 color 为红色系
- [x] 1.6 适配 `crt-scanline.tsx` 扫描线颜色为 PRIMARY
- [x] 1.7 适配 `soul-recall-panel.tsx` 的颜色（相似度条、边框、文字）
- [x] 1.8 适配 `relic-load-animation.tsx` 的各阶段颜色
- [x] 1.9 适配 `soulkiller-protocol-panel.tsx` 的颜色
- [x] 1.10 适配 `prompt.tsx` 的状态颜色（符号、路径、状态标签）
- [x] 1.11 适配 `conversation-view.tsx` 的消息颜色（用户消息 DIM、助手名 PRIMARY、内容 ACCENT、分隔线 DARK）
- [x] 1.12 适配 `streaming-text.tsx` 的默认颜色为 ACCENT

## 2. Arasaka Logo 资源集成

- [x] 2.1 确认 `assets/logo-red-130-r08.ans` 文件已就位（130 列、26 行、ratio 0.8）
- [x] 2.2 创建 logo 加载工具函数：从 .ans 文件读取内容，返回字符串数组（按行分割）
- [x] 2.3 添加终端宽度检测逻辑：宽度 < 130 时使用纯文本 "ARASAKA" 替代
- [x] 2.4 添加文件读取失败时的 fallback（纯文本 "ARASAKA"）

## 3. TrueColor 渐变高亮条组件

- [x] 3.1 创建 `BootingBar` 组件或工具函数：接受文字和宽度参数
- [x] 3.2 实现背景色渐变算法：#440011 → #FF3333 → #FFAAAA → #FF3333 → #440011
- [x] 3.3 使用 `\x1b[48;2;R;G;Bm` ANSI TrueColor 逐字符设置背景色

## 4. 启动动画重构

- [x] 4.1 重写 `boot-animation.tsx` Phase 1（BIOS Boot）：ARASAKA/SOULKILLER 标题、日文元素、BOOTING 高亮条、系统信息打字机效果、闪烁光标，时长 5-10 秒
- [x] 4.2 实现 Phase 2（Hex Data Waterfall）：使用 GlitchEngine 生成 hex 地址行 + Morse-like 分隔行，逐行滚动加速，时长 10-15 秒
- [x] 4.3 实现 Phase 3（Arasaka Panel）：加载并显示 ANSI art logo，渲染设备信息面板（日文标题、状态信息）、进度条面板（双层边框 ╔═╗）、"POWER_BY ARASAKA ⊕"，时长 3-5 秒
- [x] 4.4 实现 Phase 4（Ready）：CRT 扫描线闪烁、清屏、进入命令行

## 5. 退出动画配色适配

- [x] 5.1 适配 `exit-animation.tsx` 所有阶段的颜色：保存阶段 DIM、心跳衰减 PRIMARY → DIM → DARK、静止线 DARK、溶解阶段 PRIMARY glitch、最终消息边框 DIM

## 6. 测试更新

- [x] 6.1 运行 `npx vitest run --update` 更新所有组件快照
- [x] 6.2 验证单元测试通过（GlitchEngine PRNG 确定性不受影响）
- [ ] 6.3 手动验证完整启动 → 使用 → 退出流程的视觉效果
