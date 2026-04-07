## Context

经过 `export-story-naming-and-output` 之后，导出已经能产出干净的目录（含 storyName 命名和 wizard 流程），但产物形态是**展开目录**，且目录名带有非标准的 `soulkiller:` 协议前缀。

用户反馈：Anthropic Skill 的分发格式应该是**单一带专属后缀的归档文件**，方便分享和安装。

本 change 把产物从"目录"改为"`.skill` 归档文件"，并清理命名规范。

## Goals / Non-Goals

**Goals:**
- packageSkill 输出单一 `.skill` 文件（zip 格式归档）
- 文件名: `<kebab(storyName)>-in-<kebab(worldName)>.skill`
- 移除 `soulkiller:` 前缀（来自目录名和 SKILL.md frontmatter `name`）
- 保留 `-in-{world}` 后缀作辨识
- 三个输出位置语义不变（仍是放置 `.skill` 的目录）

**Non-Goals:**
- 不实现 install 命令（本机使用时用户自行解压；后续可加 `/install` 命令）
- 不改 SKILL.md 内部模板（只改 frontmatter `name` 字段）
- 不改 wizard 流程（步骤和 UI 不变）
- 不实现"预览归档内部"功能
- 不引入大型 archive 库（archiver 需要 stream 处理依赖较重）

## Decisions

### D1: 选择 zip 库 — fflate

**决策**: 使用 `fflate` 作为 zip 实现。

**理由**:
- 零依赖、tiny（~30KB）
- 同步 + 异步双 API
- 纯 JS 实现，跨平台（macOS / Linux / Windows / Bun runtime 都 OK）
- 维护活跃，npm 周下载量大

**替代方案**:
- `archiver` → 太重，依赖一堆 stream 模块
- `jszip` → 比 fflate 大一倍，API 更复杂
- 系统 `zip` 命令 → macOS 有，Linux 多数有，Windows 没有 — 不跨平台
- Bun 内置 → 没有 zip 写入 API
- Node `zlib` → 只支持 gzip 单文件，不支持 zip 多文件归档

### D2: 归档结构 = 当前目录结构

`.skill` 文件解压后的结构与现在 packager 生成的目录结构**完全一致**：

```
<extracted-root>/
├── SKILL.md
├── story-spec.md
├── souls/
│   ├── <soul-1>/
│   │   ├── identity.md
│   │   ├── style.md
│   │   ├── capabilities.md
│   │   ├── milestones.md
│   │   └── behaviors/
│   │       └── *.md
│   └── <soul-2>/...
└── world/
    ├── world.json
    └── entries/
        └── *.md
```

**关键**: zip 内的路径**不嵌套额外的根目录**。即解压时直接释放到当前目录，不会多一层 `<name>/` 包裹。这样安装到 `~/.claude/skills/<name>/` 时不会变成 `~/.claude/skills/<name>/<name>/`。

### D3: 实现策略 — 内存构建 + 一次写入

**决策**: 在内存中构建文件映射，然后用 fflate 一次性 zip 并写入磁盘，**不创建任何临时目录**。

```typescript
import { zipSync, strToU8 } from 'fflate'

// Build file map in memory
const files: Record<string, Uint8Array> = {}
files['SKILL.md'] = strToU8(skillContent)
files['story-spec.md'] = strToU8(storySpecContent)
files['souls/<name>/identity.md'] = strToU8(soulFiles.identity)
// ...

// Zip and write
const zipped = zipSync(files)
fs.writeFileSync(targetPath, zipped)
```

**理由**:
- 没有临时目录意味着没有清理逻辑、没有失败时的残留
- soulkiller 的 export 数据量小（~1MB），内存构建无压力
- 实现更简单，错误处理更直接

**替代方案**:
- 临时目录 + zipDirectory → 多了一层文件 IO 和清理
- 流式 zip → fflate 异步 API 可以做但当前无必要

### D4: 命名规则

```typescript
// 旧
function getSkillDirName(storyName, worldName): string {
  return `soulkiller:${kebab(storyName)}-in-${kebab(worldName)}`
}

// 新
function getSkillFileName(storyName, worldName): string {
  return `${kebab(storyName)}-in-${kebab(worldName)}.skill`
}
```

- 移除 `soulkiller:` 前缀（违反 Anthropic 规范）
- 保留 `-in-{worldName}` 后缀（用户明确要求）
- `.skill` 后缀替代目录形态

### D5: SKILL.md frontmatter `name` 同步

```yaml
# 旧
---
name: soulkiller:fate-hf-线反转-in-fate-stay-night
description: ...
---

# 新
---
name: fate-hf-线反转-in-fate-stay-night
description: ...
---
```

`name` 字段只是 Anthropic Skill 的标识符，不应该带协议前缀。

### D6: PackageResult 类型变更

```typescript
// 旧
interface PackageResult {
  output_dir: string  // 创建的目录路径
  files: string[]      // 包含的文件相对路径列表
}

// 新
interface PackageResult {
  output_file: string  // 最终 .skill 文件的绝对路径
  file_count: number   // 归档内部的文件数（用于 UI 显示）
  size_bytes: number   // 归档文件大小
}
```

`files` 列表对外不再有意义（用户拿到的是单文件），改为 `file_count` 和 `size_bytes` 用于 UI 进度展示。

### D7: 三个输出位置不变

仍然是三个预设：
- `~/.soulkiller/exports/`
- `.claude/skills/`（cwd 相对）
- `~/.claude/skills/`

每个位置都生成 `.skill` 文件。如果用户想"安装"，需要手动解压（或后续添加 install 命令）。

**注意**: 之前讨论过"分发 vs 安装"的双轨语义被否决。本 change 严格按用户要求只输出 `.skill`。

### D8: finalize_export tool 输出适配

```typescript
return {
  output_file: result.output_file,
  file_count: result.file_count,
  size_bytes: result.size_bytes,
  skill_file_name: skillFileName,
  soul_count: souls.length,
}
```

`onProgress` 的 `complete` 事件载荷也跟着改。

## Risks / Trade-offs

- **[Risk] fflate 引入新依赖** → 30KB 零依赖，影响极小；alternative 是 shell out 但不跨平台
- **[Risk] 用户下载 .skill 后不知道怎么用** → 后续可加 `/install <file>` 命令；本 change 不做
- **[Risk] 大文件归档可能慢** → soulkiller 数据量小（< 1MB 典型），内存构建瞬时完成
- **[Breaking] 旧的展开目录形态彻底消失** → 已归档的旧 export 仍在文件系统中，但新 export 不再产出目录。下游消费者（如果有）需适配
- **[Risk] PackageResult 字段重命名导致编译错误** → 调用点不多，集中在 finalize_export 和测试，可控
- **[Risk] zip 内路径分隔符** → fflate 用 `/` 作分隔符（zip 标准），跨平台 OK
- **[Trade-off] 不实现 install 命令** → 留给后续 change，避免 scope creep
