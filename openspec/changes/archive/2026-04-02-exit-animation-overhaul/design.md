## Context

启动动画已重构为 Arasaka 风格的 4 阶段序列（BIOS Boot → Hex Waterfall → Arasaka Panel → Ready），退出动画需要与之形成对称的反向过程。Logo 加载器（`logo-loader.ts`）和 GlitchEngine 已经存在可以复用。

## Goals / Non-Goals

**Goals:**
- 退出动画与启动动画形成对称：系统关闭 ↔ BIOS 启动、数据崩溃 ↔ 数据瀑布、Logo 湮灭 ↔ Logo 出现
- 总时长 10-15 秒（目标 ~12.5s）
- Logo 湮灭使用方向 B 随机像素消散 + 颜色衰减

**Non-Goals:**
- 不改变启动动画
- 不改变退出的触发逻辑（/exit 和 Ctrl+C）
- 不实现 CRT 关机视觉效果（纵向压缩等）

## Decisions

### Decision 1: Logo 湮灭算法 — 随机像素消散

加载 ANSI art logo 后，将其解析为字符网格。每个动画帧：
1. 随机选择当前非空字符的 ~5% 替换为空格
2. 剩余字符的颜色按进度衰减：PRIMARY (#FF3333) → DIM (#CC4444) → DARK (#440011) → 消失

需要对 ANSI 转义序列进行解析，提取纯文本字符位置，然后逐步清空。

实现方式：将 logo 行转为字符数组，维护一个 `alive` boolean 数组，每帧将部分 `alive` 设为 false。渲染时 `alive=false` 的位置输出空格。

颜色衰减不需要修改 ANSI 转义——直接在 ink `<Text color={...}>` 中动态设置整体颜色即可（logo 内嵌的 ANSI 颜色会被覆盖，因此需要另一种方案：将 logo 按原始 ANSI 输出但随机将字符替换为空格）。

**最终方案**: logo 以原始 ANSI 字符串渲染（保持颜色），湮灭通过逐字符替换可见字符为空格实现。由于 ANSI 转义序列中间插入空格会破坏序列，改为在渲染前对 logo 文本进行处理：遍历每行，识别非转义序列的可见字符位置，按 alive 数组决定是否输出原字符或空格。

### Decision 2: 数据崩溃 — 反向故障瀑布

与启动的正向 hex 瀑布对称。使用 GlitchEngine 生成 hex 行，但随时间推移，故障强度从 0 → 1.0 递增：
- 0-1.5s：正常 hex 行（故障 0-0.2）
- 1.5-3s：半故障（0.3-0.6）
- 3-4s：重度故障（0.7-1.0），最后几行全是 glitch 字符

行加速生成（跟启动相反：从快到慢，造成"卡顿崩溃"感）。

### Decision 3: 退出序列不区分 /exit 和 Ctrl+C

统一播放完整退出动画。当前的 Ctrl+C 加速退出暂时移除，因为 12.5 秒的退出时间可接受。

## Risks / Trade-offs

- **[ANSI logo 字符替换复杂性]** logo 包含 ANSI 转义序列，逐字符操作需要区分转义序列和可见字符 → 实现一个 ANSI-aware 的字符位置映射函数
- **[退出时间较长]** 12.5 秒可能让急性子用户不耐烦 → 后续可加 --quick 选项跳过动画
