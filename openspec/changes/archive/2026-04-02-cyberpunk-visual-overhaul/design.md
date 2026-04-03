## Context

Soulkiller 当前使用 cyan (#00F7FF) / magenta (#ED1E79) 多色配色方案和 4 秒启动动画。视觉参考来自 Cyberpunk 2077 中的 Arasaka 企业终端界面——红色单色系、BIOS 风格启动序列、十六进制数据瀑布和企业信息面板。已通过 Python PIL + 半块字符方案生成了 130 列宽的 ANSI art Arasaka logo（存于 `assets/logo-red-130-r08.ans`）。

当前动画系统基于 ink (React for CLI) + setTimeout/setInterval 的时间驱动架构，所有组件通过 `colors.ts` 引用颜色常量。GlitchEngine 提供确定性 PRNG 用于可复现的随机效果。

## Goals / Non-Goals

**Goals:**
- 将全局配色切换为红色单色系，匹配 Arasaka 终端风格
- 重构启动序列为 15-25 秒的 4 阶段沉浸式体验
- 集成高精度 ANSI art Arasaka logo
- 加入日文元素（ソウルキラー端末、荒坂産業）增强赛博朋克氛围
- 实现 ANSI TrueColor 渐变高亮条
- 适配所有现有动画组件到新配色

**Non-Goals:**
- 不改变动画系统的底层架构（仍然使用 ink + setTimeout）
- 不改变 GlitchEngine 的 PRNG 机制
- 不修改非视觉层的功能逻辑（engine、ingest、distill、llm 等）
- 不重新设计退出动画的阶段结构，仅做配色适配
- 不实现图形化 UI（保持纯终端 ANSI）

## Decisions

### Decision 1: 红色单色配色方案

采用 5 级红色梯度 + 1 个功能警告色：

| 名称 | 色值 | 用途 |
|------|------|------|
| PRIMARY | #FF3333 | 主要文字、活跃状态、logo |
| ACCENT | #FFAAAA | 强调、选中、高亮条中心 |
| DIM | #882222 | 次要信息、暗色文字 |
| DARK | #440011 | 边框、背景元素 |
| WARNING | #F3E600 | 警告信息（唯一非红色） |
| BG | #080808 | 背景色 |

**替代方案**: 保持多色但调暗 → 否决，参考图明确是红色单色风格。

**替代方案**: 纯红无警告色 → 否决，警告信息需要视觉区分度。

### Decision 2: 启动序列 4 阶段设计

```
Phase 1 — BIOS Boot (5-10s)
  时间驱动的打字机效果，逐行输出系统信息
  包含 "BOOTING..." TrueColor 渐变高亮条
  日文标识 + 系统版本信息

Phase 2 — Hex Data Waterfall (10-15s)
  十六进制地址行 + Morse-like 分隔行交替
  逐行滚动，速度递增（加速瀑布效果）
  使用 GlitchEngine 生成随机 hex 数据

Phase 3 — Arasaka Panel (3-5s)
  显示 ANSI art logo (从 .ans 文件加载)
  设备信息面板 + 进度条
  双层边框（╔═╗ 外框）模拟发光效果

Phase 4 — Ready (0.5-1s)
  CRT 扫描线闪烁
  清屏，进入命令行
```

**替代方案**: 保持 4 秒短启动 → 否决，用户明确要求 15-25 秒沉浸式体验。

### Decision 3: Logo 加载策略

启动时从 `assets/logo-red-130-r08.ans` 文件读取 ANSI art 字符串，在 Phase 3 中逐行渐显。

Logo 参数已确认：130 列宽、26 行高、ratio 0.8。

**替代方案**: 将 logo 硬编码为 TypeScript 字符串常量 → 可行但维护性差。选择文件加载方式，便于后续替换或调整。

**替代方案**: 运行时用 Python 生成 → 否决，引入不必要的 Python 依赖。

### Decision 4: TrueColor 渐变高亮条

"BOOTING..." 高亮条使用 ANSI TrueColor (24-bit) 转义序列实现背景色渐变：

```
从左到右: #440011 → #FF3333 → #FFAAAA → #FF3333 → #440011
```

中心亮两侧暗，模拟发光/辉光效果。使用 `\x1b[48;2;R;G;Bm` 逐字符设置背景色。

**前提**: 目标终端支持 TrueColor。现代终端（iTerm2、Terminal.app、Windows Terminal）均支持。

### Decision 5: 配色适配策略

`colors.ts` 中的颜色常量重命名并重新映射：

```typescript
// Before
export const CYAN = chalk.hex('#00F7FF')
export const MAGENTA = chalk.hex('#ED1E79')

// After
export const PRIMARY = chalk.hex('#FF3333')
export const ACCENT = chalk.hex('#FFAAAA')
export const DIM = chalk.hex('#882222')
export const DARK = chalk.hex('#440011')
export const WARNING = chalk.hex('#F3E600')
```

所有引用旧颜色常量的组件需要更新 import。采用全局替换策略，不做渐进式迁移。

## Risks / Trade-offs

- **[启动时间过长]** 15-25 秒启动可能让用户不耐烦 → 可考虑后续加入 `--quick` 跳过动画的选项（本次不实现）
- **[TrueColor 兼容性]** 极少数终端不支持 24-bit 色 → 降级到 ANSI 256 色可接受，但本次不实现 fallback
- **[Logo 文件依赖]** .ans 文件丢失会导致启动异常 → 加入文件读取 try/catch，失败时用简单文字替代
- **[快照测试全部失效]** 所有组件颜色变化导致快照全部需要更新 → 一次性 `--update` 快照，在 PR 中标注为预期变更
- **[130 列宽度假设]** 窄终端可能无法完整显示 logo → 检测终端宽度，窄于 130 列时使用缩小版 logo 或跳过
