## Context

当前全屏动画有两类独立问题：

1. **布局不一致**：`BootAnimation` 外层有 `alignItems="center"` 但内层文本是左对齐；其他五个全屏动画（exit/batch/export/relic/soulkiller-protocol）使用 `paddingLeft={2}` 硬偏移，完全不居中。六个组件各自为政，居中逻辑散落在不同地方。

2. **Logo 二进制丢失**：`logo-loader.ts` 通过 `readFileSync(fileURLToPath(import.meta.url) + '/../../../assets/logo.ans')` 读取磁盘文件。`bun build --compile` 产出单文件二进制，`import.meta.url` 指向 `$bunfs/` 虚拟路径，`assets/` 不存在 → `catch` 走 fallback 文本框。两个使用 logo 的动画（boot / exit）在二进制下静默降级，体验破碎。

约束：
- 项目只用 Bun，无 Node.js 依赖
- 动画组件用 ink（React for CLI），布局靠 flexbox
- 不引入新 npm 依赖
- 组件测试快照需要重跑，visual 基线需要重录

## Goals / Non-Goals

**Goals:**
- 提供唯一、可重用的居中容器组件 `CenteredStage`，所有全屏动画复用
- 所有全屏动画内容（含文本行、logo、面板）在任意终端宽度下都水平居中
- 在 `bun build --compile` 二进制中 logo ANS 艺术字正常渲染
- 清除全部"假居中"前导空格（`paddingLeft` / `'    '` / `'  ▓ '` 等）
- `contentWidth` 常量统一从 `layout.tsx` 导出，不再各自计算

**Non-Goals:**
- 不改变任何动画的时序、颜色、文本内容
- 不处理 `MalfunctionError`、`SoulRecallPanel`、`GlitchText`、`HeartbeatLine`、`CrtScanline` 等内嵌式工具组件（它们不独占屏幕，居中语义不同）
- 不引入 ANSI strip 库；若 ink 不能正确居中带 escape 的 logo 行，用手工 pad 作局部处理（见 Decision 2）

## Decisions

### Decision 1: `CenteredStage` 组件 + `layout.tsx`

**选择**：新建 `src/cli/animation/layout.tsx`，导出两层嵌套 Box 的 `CenteredStage` 组件和 `getContentWidth(termWidth)` 工具函数。

```tsx
// layout.tsx
export function getContentWidth(termWidth = process.stdout.columns ?? 80) {
  return Math.min(130, termWidth - 4)
}

export function CenteredStage({ children }: { children: React.ReactNode }) {
  const termWidth = process.stdout.columns ?? 80
  const contentWidth = getContentWidth(termWidth)
  return (
    <Box flexDirection="column" alignItems="center" width={termWidth}>
      <Box flexDirection="column" alignItems="center" width={contentWidth}>
        {children}
      </Box>
    </Box>
  )
}
```

**为什么不直接在每个组件里写两层 Box**：六个组件写六遍，下次改居中逻辑还是六处同步。一个 `CenteredStage` 是唯一真相来源。

**为什么不用 `justifyContent` 代替 `alignItems`**：ink 的 `alignItems="center"` 作用于 `flexDirection="column"` 时使 cross-axis（即水平方向）居中，是正确语义。`justifyContent="center"` 对 column 方向是垂直居中（主轴），不是我们要的。

### Decision 2: Logo ANSI 居中 —— 先验 ink，再补手工 pad

**问题**：`logo-red-130-r08.ans` 含 ANSI escape 序列，`line.length` 会远大于视觉宽度。ink 内部是否能剥 ANSI 后按视觉宽度居中，需要实测。

**策略**：
1. 先直接用 `CenteredStage alignItems="center"` 渲染 logo，人眼核验是否居中
2. 若偏移，在 `logo-loader.ts` 中增加 `padLogoLineForCenter(line: string, contentWidth: number): string`：
   - 用 `line.replace(/\x1b\[[0-9;]*m/g, '').length` 得到 visible width（ANS 只含颜色 escape，无复杂序列，简单 regex 足够）
   - 计算 `Math.max(0, Math.floor((contentWidth - visibleWidth) / 2))` 空格前缀
3. 若 ink 能正确居中（likely，ink 依赖 `yoga-layout` 底层，现代版本通常能处理），不需要手工 pad

**为什么不直接上手工 pad**：ANS 文件每次更新都要重测，而 ink 居中 likely 能用 —— 先简单路径，有问题再加 pad。

### Decision 3: logo-loader.ts 改用 Bun text import

**选择**：

```ts
// Before
import { readFileSync } from 'fs'
const content = readFileSync(join(__dirname, '../../../assets/logo-red-130-r08.ans'), 'utf-8')

// After
import logoAns from '../../../assets/logo-red-130-r08.ans' with { type: 'text' }
```

`with { type: 'text' }` 是 Bun 原生支持的 Import Assertions，bundle 阶段把文件内容内联为字符串常量。`bun build` + `--compile` 都支持。删掉 `readFileSync` / `fs` / `path` / `fileURLToPath` 全部 import。

**为什么不用 `define` 注入**：`define` 是 build-time 替换，需要在 `scripts/build.ts` 里额外读文件、塞进常量名 —— 逻辑分散。text import 是语言层面的声明，Bun 自动处理，build.ts 不需要改。

**为什么不把 assets/ 放进 archive**：安装后用户只有 binary，不会有 assets/ 目录；install.sh 和 install.ps1 也没有拷贝 assets 的逻辑。要维持零散件分发，必须内联。

### Decision 4: 硬编码前导空格清理策略

各组件里为了"视觉上缩进"用了 `paddingLeft` / `'  ▓ '` / `'    '` 等。接入 CenteredStage 后这些都变为相对居中列的偏移，应该删除。

- `paddingLeft={N}` on root Box → 删除（由 CenteredStage 替代）
- `'  ▓ compressing...'` → `'▓ compressing...'`（前导空格去掉，两字符 `▓ ` 是内容本身）
- `'    '` in PANEL_INFO 行 → 去掉（CenteredStage 的 `alignItems` 负责居中）
- `borderStyle` 的固定宽度框（如 `width={50}` / `width={56}`）保持不变，它们的宽度是设计值

## Risks / Trade-offs

- **ink 版本对 ANSI 居中的支持** → 参照 Decision 2 先验后补 pad，有明确回退方案
- **component 快照全失效**：居中 pad 改变后所有组件 snapshot 都失效，需要统一 update-baselines → 只是 CI 噪音，不是功能回归；在 tasks 里明确加一步 `bun run test:update-snapshots`
- **visual 基线（Playwright）失效**：像素级截图全需重录 → 预期中，tasks 里加 `bun run test:visual -- --update-snapshots`
- **contentWidth 各文件局部计算被删除**：目前 `boot-animation.tsx` 有 `const contentWidth = Math.min(130, termWidth - 4)`，其他文件直接用 `termWidth`；统一到 `getContentWidth` 后各文件删本地计算 → 无逻辑风险，纯重构

## Migration Plan

无数据迁移，无 API break，无外部依赖变化。

部署验证步骤：
1. `bun run build` — tsc 类型检查通过
2. `bun run test` — 组件快照 update 后通过
3. `SOULKILLER_TARGETS=darwin-arm64 bun run build:release` — 本地构建 darwin 二进制
4. 解压 `dist/soulkiller-darwin-arm64.tar.gz`，在宽度 ≥ 130 的终端执行 `./soulkiller`，目测 boot 动画 logo 和居中
5. 执行 `/exit`，目测 exit 动画 logo 和居中

回滚：git revert，无状态副作用。

## Open Questions

- ink 的 `alignItems="center"` 对含 ANSI escape 的字符串能否正确居中？（需实测，Decision 2 有回退方案）
- `soul-recall-panel.tsx` / `malfunction-error.tsx` 的调用点需要在 tasks 阶段确认——它们是内嵌式还是全屏独占？本次先不改，若确认是全屏接管则后续单独处理。
