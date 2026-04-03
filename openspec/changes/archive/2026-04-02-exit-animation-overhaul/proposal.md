## Why

退出动画需要与新的 Arasaka 风格启动动画形成对称。当前退出动画只有 4.2 秒、风格简陋（░▒▓ 边框文字），与 15-20 秒的沉浸式启动体验不匹配。需要重构为包含系统关闭过程、数据崩溃、Arasaka logo 湮灭效果的完整退出序列。

## What Changes

- **BREAKING**: 完全重写退出动画，从 4.2 秒 4 阶段扩展为 12.5 秒 4 阶段新序列
- Phase 1 — 系统关闭（3s）：关闭警告、日文元素、神经链路状态衰减、心跳平线
- Phase 2 — 数据崩溃（4s）：hex 数据行出现但故障强度递增，从正常到纯乱码（与启动的 hex 瀑布对称）
- Phase 3 — Arasaka Logo 湮灭（4s）：logo 完整显示后，随机像素消散 + 颜色从 PRIMARY → DIM → DARK → 消失
- Phase 4 — 最终消息（1.5s）：暗红色 "flatline. connection terminated" 淡入后退出

## Capabilities

### New Capabilities
- `exit-logo-annihilation`: Arasaka logo 随机像素消散湮灭效果，逐字符替换为空格 + 颜色衰减
- `exit-data-collapse`: 反向数据瀑布效果，hex 数据行故障强度递增直至完全崩溃

### Modified Capabilities
- `cyberpunk-visual-system`: 退出动画从简单的 4 阶段 4.2s 序列改为 Arasaka 风格的 4 阶段 12.5s 序列

## Impact

- `src/cli/animation/exit-animation.tsx` — 完全重写
- `src/cli/animation/logo-loader.ts` — 被退出动画复用（已有）
- `src/cli/animation/glitch-engine.ts` — 被退出动画复用（已有）
- `tests/component/` — 退出动画相关快照需更新
