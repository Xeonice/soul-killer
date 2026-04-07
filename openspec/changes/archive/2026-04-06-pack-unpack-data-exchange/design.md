## Context

Soulkiller 已有完整的 soul/world 本地存储体系：

- Soul: `~/.soulkiller/souls/<name>/` — manifest.json + soul/ + bindings/ + snapshots/ + vectors/ + examples/
- World: `~/.soulkiller/worlds/<name>/` — world.json + entries/

现有 `/export` 命令通过 LLM agent 加工生成 Claude Skill 包（含 story-spec.md + SKILL.md），属于"加工品导出"。用户缺少一种无损的静态数据导入导出路径。

现有工具函数可复用：
- `getBoundWorlds(soulDir)` — 获取 soul 绑定的所有 world
- `copyWorldToPackage()` — 复制 world 目录
- `readManifest()` / `loadWorld()` — 读取 manifest
- `worldExists()` — 检查 world 是否已存在

## Goals / Non-Goals

**Goals:**
- 用户可通过 `/pack` 将 soul（含绑定 world）或单独 world 打包为可分享的单文件
- 用户可通过 `/unpack` 将数据包还原到本地存储
- 冲突时提供交互式选择（覆盖 / 重命名 / 跳过）
- 包内携带 `pack-meta.json` 用于版本兼容性校验
- 默认输出到当前工作目录

**Non-Goals:**
- 不支持增量/合并导入（整体替换或跳过）
- 不处理 vectors/ 目录（嵌入向量是运行时产物，导入后可重建）
- 不涉及远程传输（上传到云端等）
- 不替代 `/export` 的 Claude Skill 导出功能
- 不包含 examples/ 目录内容

## Decisions

### D1: 包格式选择 tar.gz

**选择**: tar.gz，扩展名使用 `.soul.pack` / `.world.pack`

**理由**: macOS/Linux 系统自带 `tar` 命令，Bun 可通过 `Bun.spawn` 直接调用，零额外依赖。自定义扩展名让用户一眼区分数据包类型。

**备选**: zip（跨平台更好，但 Bun 无内置 zip API，需要额外依赖或 spawn unzip）、JSON bundle（单文件但丢失目录结构、大文件不友好）。

### D2: 捆绑导出策略

**选择**: `/pack soul` 自动包含所有绑定 world；`/pack world` 只包含 world 本身

**理由**: Soul 是身份，world 是其运行环境，捆绑导出确保接收方获得完整可用的 soul。反向不成立——world 是公共资源，不应假设与特定 soul 绑定。

### D3: Snapshots 默认排除

**选择**: 默认不打包 snapshots/，可通过 `--with-snapshots` 标志显式包含

**理由**: Snapshots 是个人版本历史（最多 10 个），会显著增大包体积。pack 的主要场景是"分享给别人"，而不是"完整备份"。

### D4: 包内结构设计

```
<name>.soul.pack (tar.gz)
├── pack-meta.json          # 元数据 + 校验和
├── soul/                   # soul 根目录的完整镜像
│   ├── manifest.json
│   ├── soul/
│   │   ├── identity.md
│   │   ├── style.md
│   │   ├── capabilities.md
│   │   ├── milestones.md
│   │   └── behaviors/*.md
│   └── bindings/
│       └── <world>.json
└── worlds/                 # 捆绑的 world 数据
    └── <world-name>/
        ├── world.json
        └── entries/*.md

<name>.world.pack (tar.gz)
├── pack-meta.json
└── world/
    ├── world.json
    └── entries/*.md
```

**理由**: soul 包用 `soul/` + `worlds/` 两层分隔，world 包用 `world/` 单层。`pack-meta.json` 始终在包根部，解包时第一个读取。

### D5: 冲突处理策略

**选择**: 逐项交互式询问，三个选项：覆盖 / 重命名 / 跳过

**行为细节**:
- 覆盖: 删除本地目录后写入（先 snapshot 当前状态作为安全网，如果 soul 支持的话不做，太复杂）
- 重命名: 自动建议 `<name>-2`（递增直到不冲突），用户可自定义
- 跳过: 不解包此项，继续下一项
- 如果 world 被重命名，对应 soul 的 binding 文件中的引用需要同步更新

### D6: 打包/解包核心逻辑位置

**选择**: 新建 `src/pack/` 目录

```
src/pack/
├── packer.ts       # 打包核心：收集文件 → 写 pack-meta → tar.gz
├── unpacker.ts     # 解包核心：验证 meta → 解压 → 冲突检测 → 写入
├── meta.ts         # pack-meta.json 的类型定义和读写
└── checksum.ts     # SHA-256 校验和计算与验证
```

CLI 命令在 `src/cli/commands/pack.tsx` 和 `src/cli/commands/unpack.tsx`。

### D7: 校验和方案

**选择**: 打包时计算除 `pack-meta.json` 外所有文件的 SHA-256，存入 meta。解包时验证。

**理由**: 保证包在传输中未被损坏。使用 Bun 内置的 `Bun.CryptoHasher` 或 Node.js `crypto` 模块。

## Risks / Trade-offs

**[跨平台兼容]** → tar 命令在 Windows 上不一定可用。Mitigation: Soulkiller 当前以 Bun + macOS/Linux 为目标平台，Windows 支持为 Non-Goal。未来可切换为 Bun 原生 tar API 如果有的话。

**[大包体积]** → 如果 soul 绑定了很多 world，包可能很大。Mitigation: 可以后续添加 `--exclude-worlds` 或选择性捆绑，当前 MVP 全部打包。

**[格式升级]** → pack-meta.json 的 format_version 只在解包时校验。如果未来格式不兼容需要写迁移代码。Mitigation: v1.0 格式尽量简洁稳定，减少后续变更概率。

**[重命名级联]** → world 重命名后需要更新 binding 引用。如果 binding 结构变化可能出错。Mitigation: 重命名逻辑集中在 unpacker.ts，binding 更新只修改 JSON 中的 world 字段。
