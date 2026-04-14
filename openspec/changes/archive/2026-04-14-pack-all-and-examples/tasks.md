## 1. packer.ts — packAll()

- [x] 1.1 新增 `PackAllOptions` / `PackAllProgress` / `PackAllResult` 类型
- [x] 1.2 实现 `packAll(options)`:枚举 souls/ + worlds/，逐项调用 `packSoul` / `packWorld`，触发 `onProgress` 回调，单项失败不中断整体

## 2. unpacker.ts — 批量解包

- [x] 2.1 新增 `BatchUnpackOptions` / `BatchUnpackProgress` / `BatchUnpackResult` 类型
- [x] 2.2 实现 `batchUnpackDir(dirPath, options)`：递归扫描目录中的 `.soul.pack` / `.world.pack` 文件，按 `onConflict` 策略（skip/overwrite）自动生成 resolutions，逐文件 inspect → apply

## 3. pack.tsx — 全量模式 UI

- [x] 3.1 检测 args 是否为空，空 → 触发全量模式
- [x] 3.2 全量模式下展示滚动进度列表（souls 先，worlds 后），每项显示状态（waiting / packing / ✓ done / ✗ error）
- [x] 3.3 完成后显示汇总行（N 个 Soul，M 个 World，K 个失败）
- [x] 3.4 `src/cli/commands/index.ts`：`packCommand.requires` 去掉 `['args']`，更新 `argDef`

## 4. unpack.tsx — 批量模式 UI

- [x] 4.1 检测 arg 是否为目录（`fs.statSync().isDirectory()`），是 → 批量模式
- [x] 4.2 解析 `--overwrite` flag，默认策略为 skip
- [x] 4.3 批量模式下展示扫描结果 + 进度列表，完成后显示汇总行
- [x] 4.4 单文件模式（现有逻辑）保持不变

## 5. i18n

- [x] 5.1 `zh.json` 新增 `pack.all_*` 和 `unpack.batch_*` / `unpack.dir_*` key
- [x] 5.2 `ja.json` 同步新增对应 key
- [x] 5.3 `en.json` 同步新增对应 key

## 6. examples/ 档案库生成

- [x] 6.1 在 REPL 中生成所有 world pack，按宇宙放到 `examples/worlds/`
- [x] 6.2 在 REPL 中生成所有 soul pack，按宇宙分组放到 `examples/souls/<universe>/`（宇宙映射关系见 design.md）
- [x] 6.3 复制 3 个 skill 文件到 `examples/skills/`
- [x] 6.4 提交 examples/ 到仓库（待 README 完成后一起提交）

## 7. README 更新

- [x] 7.1 在"前置准备"之前新增"预制档案库"section
- [x] 7.2 Skill 子节：下载链接 + 如何在 Claude/OpenClaw 中加载
- [x] 7.3 Soul / World 子节：下载后用 `/unpack <dir>` 导入的说明
- [x] 7.4 更新命令表中 `/pack` 和 `/unpack` 的描述

## 8. 验证

- [x] 8.1 `bun run build` 零 TypeScript 错误
- [x] 8.2 `bun run test` 全部通过（974/974，更新了 pack-command.test.tsx 中过时的测试预期）

## 9. Bundle Pack 格式（实现阶段演进）

- [x] 9.1 `meta.ts` 新增 `PackType = 'soul' | 'world' | 'souls-bundle' | 'worlds-bundle'` + `BundleItem { name, display_name, worlds? }`
- [x] 9.2 `packer.ts` 重写：`packAll()` 内部调用 `packSoulsBundle()` + `packWorldsBundle()`，产出单一 `all-souls.soul.pack` + `all-worlds.world.pack`，souls bundle 中去重绑定 world
- [x] 9.3 `unpacker.ts`：`detectConflicts` / `applyUnpack` 新增 `souls-bundle` / `worlds-bundle` 分支，先装 world 再装 soul
- [x] 9.4 `pack.tsx` 全量模式重写：`BundleState` 状态 + `BundleRow` 两行展示

## 10. 交互式 Unpack Wizard

- [x] 10.1 `unpack.tsx` 重写：`WizardPhase` 状态机（type-select / source-select / path-input / url-input / downloading / inspecting / conflict-strategy / conflict-item / applying / done / error）
- [x] 10.2 `initFromArgs()`：带 args 直接跳到 inspecting / conflict-strategy，无 args 从 type-select 开始
- [x] 10.3 `conflictResolutionsRef = useRef(new Map)` 累积每项 resolution，避免 useState 闭包陈旧
- [x] 10.4 CJK-aware `padLabel()` 按双宽度字符计算列宽
- [x] 10.5 `done` 阶段展示概览（type / source / installed / skipped / renamed / errors），`Enter/Esc` 关闭
- [x] 10.6 `commands/index.ts`：`unpackCommand.requires` 去掉 `['args']`，`argDef` 改为 `[path]`

## 11. URL 源 + 线上导入

- [x] 11.1 新增 `src/export/pack/downloader.ts`：`downloadPack(url)` 用 `fetch()` 下载到 `os.tmpdir()`，返回本地路径
- [x] 11.2 wizard `downloading` 阶段调用 `downloadPack`，完成后流入 `inspecting`

## 12. R2 + Worker 托管

- [x] 12.1 `.github/workflows/release.yml` 新增 `Upload examples to R2`，上传 `examples/*.{soul,world}.pack` + `examples/skills/*.skill` 到 `soulkiller-releases/examples/`
- [x] 12.2 `workers/download/src/index.ts` 新增 `serveExample()` + `/examples/skills/:file` + `/examples/:file` 路由（skills 优先匹配），根路径 JSON 同步更新
- [x] 12.3 `.github/workflows/release.yml` 新增 `Deploy download Worker` 步骤，每次发版自动 `wrangler deploy`
- [x] 12.4 `README.md` 全部 `./examples/` 相对路径替换为 `https://soulkiller-download.ad546971975.workers.dev/examples/...`
- [x] 12.5 `scripts/pack-examples.ts` 改为直接调用 `packAll()` 生成两个 bundle
