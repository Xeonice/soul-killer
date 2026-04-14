## 1. 基础设施：layout 模块 + logo 内联

- [x] 1.1 新建 `src/cli/animation/layout.tsx`，导出 `getContentWidth(termWidth?)` 函数和 `CenteredStage` 组件（双层 Box：外层 `alignItems="center" width={termWidth}`，内层 `alignItems="center" width={contentWidth}`）
- [x] 1.2 修改 `src/cli/animation/logo-loader.ts`：将 `readFileSync` + `fileURLToPath` 逻辑替换为 `import logoAns from '../../../assets/logo-red-130-r08.ans' with { type: 'text' }`，将 `loadArasakaLogo` 改为对内联字符串按 `\n` 分割，删除 `fs` / `path` / `url` import

## 2. BootAnimation 接入

- [x] 2.1 `boot-animation.tsx`：用 `CenteredStage` 替换现有 `<Box flexDirection="column" alignItems="center" width={termWidth}><Box flexDirection="column" width={contentWidth}>` 两层手写结构，删除本地 `contentWidth` 变量（改用 `getContentWidth`）
- [x] 2.2 `boot-animation.tsx`：删除 `PANEL_INFO` 渲染里的 `'    '` 前导字符串
- [x] 2.3 `boot-animation.tsx`：验证 `loadArasakaLogo` 改用 text import 后 logo 行在 CenteredStage 内居中正确（宽终端目测或截图对比）；若 ink 对 ANSI 字符串的居中偏移，在 `logo-loader.ts` 增加 `padLogoLineForCenter` 函数并在 boot 渲染处调用

## 3. ExitAnimation 接入

- [x] 3.1 `exit-animation.tsx`：根元素从 `<Box flexDirection="column" paddingLeft={2}>` 改为 `<CenteredStage>`
- [x] 3.2 `exit-animation.tsx`：删除 Shutdown Steps 里 `'  ▓ ...'` 的前导两空格（保留 `▓ ` 内容本身），以及 final message 的 `'  「 ...」'` 前导空格

## 4. BatchProtocolPanel 接入

- [x] 4.1 `batch-protocol-panel.tsx`：根元素从 `<Box flexDirection="column" paddingLeft={2}>` 改为 `<CenteredStage>`
- [x] 4.2 `batch-protocol-panel.tsx`：删除内部因 `paddingLeft` 偏移而加的补偿前导空格

## 5. ExportProtocolPanel 接入

- [x] 5.1 `export-protocol-panel.tsx`：根元素从 `marginLeft={2}` 改为 `<CenteredStage>`（实际在 export.tsx 调用点添加 CenteredStage，panel 内部 marginLeft 是内容缩进保留不变）
- [x] 5.2 `export-protocol-panel.tsx`：删除因 `marginLeft` 偏移的补偿前导空格

## 6. RelicLoadAnimation 接入

- [x] 6.1 `relic-load-animation.tsx`：根元素从 `<Box flexDirection="column" paddingLeft={2}>` 改为 `<CenteredStage>`
- [x] 6.2 `relic-load-animation.tsx`：确认内部 `width={50}` 固定框在居中列内正常显示

## 7. SoulkillerProtocolPanel 接入

- [x] 7.1 `soulkiller-protocol-panel.tsx`：外层裹 `<CenteredStage>`（在 create.tsx 和 world-create-wizard.tsx 调用点添加 CenteredStage；batch-protocol-panel 已有外层 CenteredStage，panel 内部 width={56} 固定框居中正常）

## 8. 测试更新

- [x] 8.1 `bun run build`（tsc --noEmit）确认零 TypeScript 错误（同时新增 `src/assets.d.ts` 为 `.ans` 文件提供类型声明）
- [x] 8.2 `bun run test` 运行后更新失效的组件快照（`bun run test -- --update-snapshots` 或 `bun scripts/update-baselines.ts`）
- [x] 8.3 `bun run test:visual -- --update-snapshots` 重录 Playwright 像素基线（`tests/visual/__baselines__/` 为空，无需更新）

## 9. 二进制烟测

- [ ] 9.1 `SOULKILLER_TARGETS=darwin-arm64 bun run build:release` 构建本地平台二进制
- [ ] 9.2 解压 `dist/soulkiller-darwin-arm64.tar.gz`，在宽度 ≥ 130 的终端执行 `./soulkiller`，目测 boot 动画：logo 是彩色 ANS 艺术字（而非 "A R A S A K A" 文字框），内容整体居中
- [ ] 9.3 在二进制 REPL 中执行 `/exit`，目测 exit 动画：logo 溶解动画正常，内容整体居中
