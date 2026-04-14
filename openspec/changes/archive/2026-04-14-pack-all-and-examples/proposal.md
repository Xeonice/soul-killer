# Proposal: 全量 Pack/Unpack + Examples 档案库

## 问题

当前 `/pack` 和 `/unpack` 命令只支持单个 soul 或 world 的操作：
- `/pack soul <name>` — 打包单个 soul
- `/pack world <name>` — 打包单个 world
- `/unpack <file>` — 解包单个 pack 文件

这使得生成示例档案库需要手动执行几十次命令，且无法一次性批量导入社区分发的 examples 目录。

## 决策

### 1. `/pack` 全量模式

`/pack`（无 args）打包所有 soul + 所有 world 到输出目录。有 args 的单项用法保持兼容。

```
/pack                    → 全量打包到当前目录
/pack --output <dir>     → 全量打包到指定目录
/pack soul <name>        → 兼容：打包单个 soul（不变）
/pack world <name>       → 兼容：打包单个 world（不变）
```

### 2. `/unpack` 批量模式 + 策略 B

`/unpack <dir>` 扫描目录下所有 `.soul.pack` / `.world.pack` 文件并批量解包。冲突统一采用策略 B（flag 控制）：

```
/unpack <dir>             → 批量解包，冲突时默认跳过（skip）
/unpack <dir> --overwrite → 批量解包，冲突时全部覆盖
/unpack <file>            → 兼容：解包单个文件，交互式冲突解决（不变）
```

### 3. Bundle Pack 格式（实现阶段调整）

N 个独立 pack 改为两个 bundle pack：

- `all-souls.soul.pack` — 内部 `souls/<name>/` + 去重后的 `worlds/<name>/`，一次导入全部角色
- `all-worlds.world.pack` — 内部 `worlds/<name>/`，一次导入全部世界

新增 `PackType`：`souls-bundle` / `worlds-bundle`；`PackMeta.items: BundleItem[]` 列出 bundle 内每项。旧的单项 `soul` / `world` pack 格式保持兼容。

### 4. 交互式 Unpack Wizard（实现阶段调整）

`/unpack` 无 args 时进入 wizard：type-select → source-select → path/url input → inspecting → conflict → applying → done overview。单文件冲突仍逐项选择；bundle 沿用 skip/overwrite 批量策略。

新增 `downloader.ts`：fetch URL → 写 tmp → 返回路径，让 wizard 能从线上 URL 直接导入。

### 5. R2 + Worker 托管（实现阶段调整）

Examples 不依赖 GitHub 仓库流量，改托管到 Cloudflare R2：

- CI 发版时 `wrangler r2 object put` 上传到 `soulkiller-releases/examples/`
- Worker 新增 `/examples/:file` + `/examples/skills/:file` 路由，从 R2 读取后 `Content-Disposition: attachment` 返回
- CI 自动 `wrangler deploy` 同步 Worker 逻辑
- README 所有示例链接改为 `https://soulkiller-download.ad546971975.workers.dev/examples/...`

### 6. README 文档更新

在 README 中新增"预制档案库"section（位于 30秒速览之前），skill 部分靠前，完整说明三种导入路径。

## 影响范围

- `src/export/pack/meta.ts` — 新增 `souls-bundle` / `worlds-bundle` type + `BundleItem[]`
- `src/export/pack/packer.ts` — `packAll()` 产出两个 bundle 而非 N 个 pack
- `src/export/pack/unpacker.ts` — `detectConflicts` / `applyUnpack` 支持 bundle 类型
- `src/export/pack/downloader.ts` — 新增，支持 URL 源
- `src/cli/commands/export/pack.tsx` — 全量模式展示两个 bundle 行
- `src/cli/commands/export/unpack.tsx` — 交互式 wizard 状态机（type/source/path/url/inspect/conflict/apply/done）
- `src/cli/commands/index.ts` — pack/unpack 命令 `requires` 去掉 `['args']`
- `src/infra/i18n/locales/{zh,ja,en}.json` — 新增 bundle + wizard i18n key
- `examples/` — `all-souls.soul.pack` + `all-worlds.world.pack` + `skills/*.skill`
- `.github/workflows/release.yml` — 新增 examples 上传到 R2 + Worker deploy 步骤
- `workers/download/src/index.ts` — 新增 `/examples/` 路由
- `scripts/pack-examples.ts` — 直接调用 `packAll()` 生成 bundle
- `README.md` — 预制档案库 section 使用 R2 CDN 链接
