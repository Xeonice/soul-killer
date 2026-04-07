## Why

Soulkiller 目前只有一条导出路径：通过 `/export` 将 soul + world 加工为 Claude Skill 包。但用户缺少一种方式来直接导入导出 soul/world 的原始静态数据——用于备份、迁移到另一台机器、或与他人分享已蒸馏好的 soul。现有的 `/export` 是"加工品"（生成 story-spec + SKILL.md），而 `/pack` `/unpack` 是"原材料"的无损搬运。

## What Changes

- 新增 `/pack` 命令：将 soul 或 world 打包为 `.soul.pack` / `.world.pack` 文件（tar.gz 格式）
- Soul 打包时自动捆绑所有绑定的 world（捆绑导出）
- Soul 打包默认不含 snapshots，可通过 `--with-snapshots` 显式包含
- 包内含 `pack-meta.json` 记录格式版本、来源、校验和等元数据
- 新增 `/unpack` 命令：从 `.soul.pack` / `.world.pack` 解包到本地 `~/.soulkiller/`
- 解包遇到同名冲突时交互式询问用户：覆盖 / 重命名 / 跳过
- Soul 解包时同步还原绑定的 world，重命名时自动更新 binding 引用
- 默认输出到当前工作目录，支持 `--output <path>` 指定

## Capabilities

### New Capabilities

- `pack-command`: `/pack` CLI 命令，支持 `soul` 和 `world` 子类型，打包为可分享的静态数据包
- `unpack-command`: `/unpack` CLI 命令，从数据包解包到本地存储，含冲突解决交互
- `pack-format`: 数据包格式定义，包括 tar.gz 结构、pack-meta.json schema、校验和验证

### Modified Capabilities

- `create-command`: 命令注册表需新增 `/pack` 和 `/unpack` 条目

## Impact

- **新文件**: `src/pack/` 目录（打包/解包核心逻辑）、`src/cli/commands/pack.tsx`、`src/cli/commands/unpack.tsx`
- **修改文件**: `src/cli/command-registry.ts`（注册新命令）
- **依赖**: 无新依赖，使用系统 `tar` 命令
- **数据**: 不改变现有 soul/world 存储结构，pack 是只读操作，unpack 是写入操作
