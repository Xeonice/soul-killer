# Design: 全量 Pack/Unpack + Examples 档案库

## packer.ts — packAll()

```typescript
export interface PackAllOptions {
  output?: string          // 输出目录，默认 process.cwd()
  withSnapshots?: boolean
  onProgress?: (event: PackAllProgress) => void
}

export interface PackAllProgress {
  type: 'soul' | 'world'
  name: string
  status: 'packing' | 'done' | 'error'
  outputPath?: string
  size?: number
  error?: string
  current: number
  total: number
}

export async function packAll(options: PackAllOptions = {}): Promise<PackAllResult>
```

实现思路：
1. 枚举 `~/.soulkiller/souls/` 下所有目录 → 每个调用 `packSoul()`
2. 枚举 `~/.soulkiller/worlds/` 下所有目录 → 每个调用 `packWorld()`
3. 每完成一项调用 `onProgress` 回调（UI 用来实时更新进度列表）
4. 单项失败不中断整体，收集错误后统一报告

## unpacker.ts — 批量解包

```typescript
export interface BatchUnpackOptions {
  onConflict: 'skip' | 'overwrite'   // 策略 B，无交互
  onProgress?: (event: BatchUnpackProgress) => void
}

export interface BatchUnpackProgress {
  file: string
  status: 'inspecting' | 'applying' | 'done' | 'error' | 'skipped'
  result?: UnpackResult
  error?: string
  current: number
  total: number
}

/** Scan dir for all .soul.pack / .world.pack files and unpack with fixed strategy */
export async function batchUnpackDir(
  dirPath: string,
  options: BatchUnpackOptions,
): Promise<BatchUnpackResult>
```

实现思路：
1. `fs.readdirSync(dirPath)` 收集 `*.soul.pack` + `*.world.pack`
2. 逐文件调用 `inspectPack()`
3. 根据 `onConflict` 策略自动生成 `resolutions Map`（skip → all 'skip'，overwrite → all 'overwrite'）
4. 调用 `applyUnpack()` 安装
5. 子目录递归扫描（`examples/souls/three-kingdoms/` 等结构）

## pack.tsx — UI 重设计

```
无 args → 全量模式
┌─────────────────────────────────────────────┐
│  PACK ALL                                   │
│                                             │
│  souls                                      │
│  ✓ 曹操          → cao-cao.soul.pack  24KB  │
│  ✓ 刘备          → liu-bei.soul.pack  22KB  │
│  ⟳ 诸葛亮        packing...                │
│  · 关羽           waiting               │
│  ...                                        │
│                                             │
│  worlds                                     │
│  · 三国           waiting               │
│  ...                                        │
│                                             │
│  [23/55] packing souls...                   │
└─────────────────────────────────────────────┘
```

有 args（`soul|world <name>`） → 现有单项 UI 不变。

## unpack.tsx — 批量 UI

```
/unpack examples/souls/three-kingdoms/ --overwrite
┌─────────────────────────────────────────────┐
│  UNPACK DIR  examples/souls/three-kingdoms/ │
│  strategy: overwrite                         │
│                                             │
│  ✓ cao-cao.soul.pack    → 曹操 + 三国        │
│  ✓ liu-bei.soul.pack    → 刘备 + 三国        │
│  ⟳ zhuge-liang.soul.pack  applying...       │
│  · guan-yu.soul.pack    waiting             │
│                                             │
│  [3/9] installing...                        │
└─────────────────────────────────────────────┘
```

单文件 arg → 现有交互式冲突 UI 不变。

## 目录参数检测逻辑

```typescript
// unpack.tsx useEffect
const resolvedPath = path.resolve(process.cwd(), filePath)
const stat = fs.statSync(resolvedPath)
if (stat.isDirectory()) {
  // 批量模式
  const strategy = args.includes('--overwrite') ? 'overwrite' : 'skip'
  batchUnpackDir(resolvedPath, { onConflict: strategy, onProgress: ... })
} else {
  // 现有单文件模式
  inspectPack(resolvedPath).then(...)
}
```

## examples/ 目录结构

pack 文件按宇宙子目录组织，对应本地 soul 的命名：

```
examples/
├── skills/
│   ├── fate-zero.skill
│   ├── three-kingdoms.skill
│   └── white-album-2.skill
├── souls/
│   ├── three-kingdoms/      ← /pack --output 到这里的 soul pack
│   ├── fate-zero/
│   ├── fate-stay-night/
│   ├── white-album-2/
│   └── cyberpunk-2077/
└── worlds/
    ├── 三国.world.pack
    ├── Fate Zero.world.pack
    ├── Fate Stay Night.world.pack
    ├── White Album 2.world.pack
    └── cyberpunk 2077.world.pack
```

生成方式（一次性，提交到仓库）：
1. 在 REPL 中分宇宙跑 `/pack soul <name> --output examples/souls/<universe>/`
2. 跑 `/pack world <name> --output examples/worlds/`
3. 复制 skill 文件到 `examples/skills/`

全量 `/pack` 实现后，可以用脚本一次生成，按宇宙 mapping 分发到对应子目录。

## README 新增 section 位置

```
[标题 + 项目描述]
    ↓
[预制档案库]  ← 新增，在"前置准备"之前
  1. Skill 档案（直接下载玩）
  2. Soul 档案（/unpack 导入）
  3. World 档案（/unpack 导入）
    ↓
[前置准备]
[安装]
[30秒速览]
...
```

## i18n 新增 key

```json
"pack.all_start": "开始全量打包...",
"pack.all_souls_total": "共 {count} 个 Soul",
"pack.all_worlds_total": "共 {count} 个 World",
"pack.all_item_packing": "打包中",
"pack.all_item_done": "完成",
"pack.all_item_error": "失败: {message}",
"pack.all_summary": "全量打包完成：{souls} 个 Soul，{worlds} 个 World，{errors} 个失败",
"unpack.dir_scanning": "扫描目录: {path}",
"unpack.dir_found": "发现 {count} 个数据包",
"unpack.batch_strategy_skip": "冲突策略: 跳过",
"unpack.batch_strategy_overwrite": "冲突策略: 覆盖",
"unpack.batch_item_done": "✓ {file}",
"unpack.batch_item_error": "✗ {file}: {message}",
"unpack.batch_summary": "解包完成：{installed} 安装，{skipped} 跳过，{errors} 失败"
```

---

## 实现阶段演进

### Bundle Pack 格式

原设计：N 个独立 pack 放进 `examples/souls/<universe>/` 子目录。
新设计：两个 bundle pack，用户只需执行两次 unpack。

```typescript
// meta.ts
export type PackType = 'soul' | 'world' | 'souls-bundle' | 'worlds-bundle'

export interface BundleItem {
  name: string
  display_name?: string
  worlds?: string[]      // souls-bundle 中每个 soul 的绑定 world
}

export interface PackMeta {
  type: PackType
  items?: BundleItem[]   // 仅 bundle 类型有值
  // ...其余字段不变
}
```

**`packSoulsBundle()`**：staging `souls/<name>/` + 去重后的 `worlds/<name>/`，一个 `pack-meta.json` 列出所有 items。
**`packWorldsBundle()`**：staging `worlds/<name>/`。
**`applyUnpack()` bundle 分支**：先装 worlds（避免 soul 依赖缺失）再装 souls，复用现有 `ConflictResolution` 逐项处理。

单项 `soul` / `world` pack 格式完全保留，向前兼容。

### 交互式 Unpack Wizard

```typescript
type WizardPhase =
  | 'type-select'       // 1. 选 soul pack / world pack
  | 'source-select'     // 2. 选本地 / 线上
  | 'path-input'        // 3a. 本地路径
  | 'url-input'         // 3b. 线上 URL
  | 'downloading'       // 4a. 下载中（URL 源）
  | 'inspecting'        // 4. 读 meta + 冲突检测
  | 'conflict-strategy' // 5a. bundle：skip / overwrite 二选一
  | 'conflict-item'     // 5b. 单项：逐个选 skip/overwrite/rename
  | 'applying'          // 6. 执行安装
  | 'done'              // 7. 概览
  | 'error'
```

- 带 args：`initFromArgs()` 跳过前几步
- `conflictResolutionsRef`：`useRef(new Map)` 避免 useState 闭包陈旧
- CJK 列对齐：`padLabel()` 按双宽度字符补空格

### URL 源

```typescript
// downloader.ts
export async function downloadPack(url: string): Promise<string> {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText}`)
  const basename = path.basename(new URL(url).pathname) || 'download.pack'
  const tmpFile = path.join(os.tmpdir(), `soulkiller-dl-${Date.now()}-${basename}`)
  fs.writeFileSync(tmpFile, Buffer.from(await response.arrayBuffer()))
  return tmpFile
}
```

Wizard `downloading` phase 调用它，完成后 `phase ← 'inspecting'` 流入既有分支。

### R2 + Worker 路由

**R2 目录结构**：
```
soulkiller-releases/
├── releases/...             ← 原有（binary）
├── scripts/...              ← 原有（install.sh/ps1）
└── examples/                ← 新增
    ├── all-souls.soul.pack
    ├── all-worlds.world.pack
    └── skills/
        ├── fate-zero.skill
        ├── three-kingdoms.skill
        └── white-album-2.skill
```

**Worker 路由**（`workers/download/src/index.ts`）：
```typescript
// skills 必须优先匹配，避免被 pack 路由拦截
/^\/examples\/skills\/([\w.-]+)$/ → serveExample(`examples/skills/${name}`)
/^\/examples\/([\w.-]+)$/         → serveExample(`examples/${name}`)
```

`serveExample()` 从 R2 读取，返回 `Content-Type: application/octet-stream` + `Content-Disposition: attachment`。

**CI 步骤**（`.github/workflows/release.yml`）：
1. `Upload examples to R2` — 循环上传 `examples/*.{soul,world}.pack` + `examples/skills/*.skill`
2. `Deploy download Worker` — `cd workers/download && npx wrangler deploy`

README 所有示例链接改为 `https://soulkiller-download.ad546971975.workers.dev/examples/...`。
