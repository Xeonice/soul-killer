## Why

全屏动画（boot / exit / batch / export / relic / soulkiller protocol）在终端内水平对齐不统一 —— 目前 `BootAnimation` 是"外壳居中、列内左对齐"，其余动画直接 `paddingLeft={2}` 贴左；且 `loadArasakaLogo` 通过 `readFileSync(assets/logo-red-130-r08.ans)` 在开发态能读到彩色 ANS 艺术字，但在 `bun build --compile` 产出的二进制里因为 assets 未嵌入 → 异常 → 回退到简陋的 `ARASAKA` 文字框，直接砸掉品牌一致性。现在同时修复两类问题，避免在后续每加一个动画时都踩同一个坑。

## What Changes

- 引入共享的"居中舞台"布局能力：新增 `CenteredStage` 组件 + 共享 `contentWidth` 常量，作为全屏动画的外层容器，保证列本身相对终端居中、且列内所有行相对列居中。
- `BootAnimation`、`ExitAnimation`、`BatchProtocolPanel`、`ExportProtocolPanel`、`RelicLoadAnimation`、`SoulkillerProtocolPanel` 六个全屏动画接入 `CenteredStage`，并清理各自为居中服务的硬编码前导空格（例如 `'    '` / `'  ▓ '`）。
- `loadArasakaLogo` 改用 Bun 原生 text import（`import logoAns from '...' with { type: 'text' }`），在编译期将 ANS 艺术字内联进 bundle，删除 `readFileSync` + `fileURLToPath` 运行时路径。Fallback 保留为"logo 文件内联后仍然可能因为终端宽度过窄而使用文字回退"，但不再依赖磁盘。
- 不改变：`MalfunctionError`、`SoulRecallPanel`（可能是内嵌式组件）以及 `GlitchText` / `HeartbeatLine` / `CrtScanline` 等工具组件 —— 先不纳入本次范围，除非 tasks 阶段确认它们的调用点需要。

## Capabilities

### New Capabilities

- `animation-layout`: 规范所有全屏动画的水平居中语义、共享 `CenteredStage` 组件 API、共享内容列宽度（`contentWidth = min(130, termWidth - 4)`），以及带 ANSI escape 的字符串在居中时的宽度计算约定。

### Modified Capabilities

- `cyberpunk-visual-system`: 给 Boot / Exit 动画增加"必须通过 CenteredStage 容器渲染"与"ARASAKA logo 在 `--compile` 二进制中必须嵌入，不得依赖运行时磁盘读取"的行为约束。

## Impact

- 代码
  - `src/cli/animation/logo-loader.ts` — 从 fs 读取改为编译期 text import
  - `src/cli/animation/layout.tsx`（新增）— 导出 `CenteredStage` + `contentWidth`
  - `src/cli/animation/boot-animation.tsx` — 接入 CenteredStage，移除 `<Box alignItems="center" width={termWidth}>` 手写结构与 `PANEL_INFO` 的 4 空格缩进
  - `src/cli/animation/exit-animation.tsx` — 接入 CenteredStage，移除 `paddingLeft={2}` 与 `'  ▓ ...'` / `'  「 ...」'` 前导空格
  - `src/cli/animation/batch-protocol-panel.tsx` — 同上
  - `src/cli/animation/export-protocol-panel.tsx` — 同上
  - `src/cli/animation/relic-load-animation.tsx` — 同上
  - `src/cli/animation/soulkiller-protocol-panel.tsx` — 外层裹 CenteredStage
- 构建 / 打包
  - `scripts/build.ts` 不需要改（text import 由 Bun bundle 原生处理）
  - 二进制大小增加约 `logo-red-130-r08.ans` 的字节数（~10KB 量级）
- 测试
  - `tests/component/animation/*` 快照全部需要重跑（居中后每行左侧 pad 长度变化）
  - `tests/visual/*` Playwright 像素基线需重录
  - 建议新增一次真机二进制烟测（`bun run build:release` + 跑 dist 产物）验证 logo 能正常渲染
- 依赖：无新增 npm 依赖；仅使用 Bun 原生 `with { type: 'text' }` 导入
