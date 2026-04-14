## 1. Updater 修复

- [x] 1.1 在 `src/cli/updater.ts` 引入 `mkdirSync` 和 `dirname`
- [x] 1.2 在 viewer `renameSync` 前调用 `mkdirSync(dirname(viewerDst), { recursive: true })`
- [x] 1.3 `bun vitest run tests/unit/cli/updater.test.ts` 保持全绿

## 2. Installer 修复

- [x] 2.1 `scripts/install.ps1` 将 `$ViewerDst` 改为 `$env:USERPROFILE\.soulkiller\viewer`
- [x] 2.2 在 Move-Item 前用 `New-Item -ItemType Directory -Force` 确保父目录存在

## 3. 回归测试

- [x] 3.1 抽出 `replaceViewer(src, dst)` 并补 2 个单测（父目录缺失自建 + 替换时清理残留）
- [x] 3.2 `bun run build`（tsc --noEmit）通过
- [x] 3.3 `bun run test` 全套通过（1010/1010）

## 4. 验证与收尾

- [ ] 4.1 在 Windows（或 Windows VM / CI runner）上跑通"全新安装 → `soulkiller --update`"端到端，确认不再 ENOENT —— 需 Windows 环境，留待真机验证
- [ ] 4.2 确认 runtime `soulkiller runtime viewer tree <script-id>` 能从 `~/.soulkiller/viewer` 成功加载 index.html —— 同上
- [x] 4.3 `openspec validate fix-windows-viewer-path --strict` 通过
