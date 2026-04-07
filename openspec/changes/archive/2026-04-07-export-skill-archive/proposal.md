## Why

当前 export 流程产出的是一个**目录拷贝**（带 `soulkiller:` 前缀和复合名），不是 Anthropic Skill 的标准分发格式。这有几个问题：

1. **不可分发** — 用户拿不到一个单一文件可以分享，只能 `tar` 整个目录
2. **协议前缀违反命名规范** — `soulkiller:` 让 skill name 变成"协议:identifier"格式，YAML 与文件系统都不规范
3. **三种输出位置语义混乱** — 现在三个选项都是"放在哪里"，但其实意图是"如何使用"——分发场景需要打包，本机使用场景只想要解压安装

正确的分发格式应该是：**单一 `.skill` 后缀的归档文件**，包含完整的目录结构。

## What Changes

### 输出格式：单一 .skill 归档文件

- packageSkill 改为输出 `<dir-name>.skill` 文件，而非展开的目录
- `.skill` 是 zip 格式归档（内部就是当前的目录结构：SKILL.md + souls/ + world/ + story-spec.md）
- **BREAKING**: 不再产出展开的目录（用户/Claude Code 自行解压安装）

### 命名规则去掉前缀

- 移除 `soulkiller:` 协议前缀
- 保留 `-in-{world}` 后缀（用户明确要求保留作为辨识）
- 新格式: `<kebab(storyName)>-in-<kebab(worldName)>.skill`
- 例: `fate-hf-线反转-in-fate-stay-night.skill`
- SKILL.md frontmatter 的 `name` 字段同步去掉前缀

### 输出位置三选一不变

三个预设位置仍然是放置 `.skill` 文件的目录：
- 默认 `~/.soulkiller/exports/`
- 项目 `.claude/skills/`
- 全局 `~/.claude/skills/`

每个位置都只产出 `.skill` 文件——无论用户后续是想分发还是想本机使用，都用同一种产物。本机使用时用户自行解压（或后续可加一个 install 命令）。

## Capabilities

### Modified Capabilities
- `cloud-skill-format`: skill 产出格式从展开目录改为 `.skill` 归档；目录命名移除 `soulkiller:` 前缀；SKILL.md frontmatter `name` 同步
- `export-agent`: finalize_export 工具的 result_summary 反映归档文件路径而非目录路径
- `multi-soul-export`: 文档/说明同步更新（如有提到目录格式）

## Impact

- `src/export/packager.ts` — packageSkill 流程：先在临时目录构建内容，然后 zip → 写入目标 `.skill` 文件，最后清理临时目录
- `src/export/packager.ts` — `getSkillDirName` 改为 `getSkillFileName`，去掉 `soulkiller:` 前缀，返回值变为 `<name>.skill`
- `src/export/skill-template.ts` — `generateSkillMd` 的 frontmatter `name` 字段去掉前缀
- 依赖：需要一个 zip 库（建议复用已有的，或引入 `archiver` / `jszip`）
- `src/agent/export-agent.ts` — finalize_export 的 result 字段返回 `.skill` 文件路径
- `src/cli/animation/export-protocol-panel.tsx` — 完成态显示 `.skill` 路径（小调整）
- 测试：`export-tools.test.ts` 的 packager 集成测试需要适配（验证 `.skill` 文件存在 + 解压验证内部结构）
- 旧的 export 目录在归档中保留作历史，新流程不再产出目录
