## Context

Export 流程在经过 `export-user-driven-selection` 和 `export-staged-tool-calls` 两轮重构后，agent 的工具体系和选择流程都合理化了。但还有三个"机械决策交给 agent 或代码硬编码"的遗留问题：

1. Skill 命名由 agent 决定的 "protagonist" 角色派生 → 多角色场景下武断
2. 故事意图完全由 agent 自主发挥 → 用户失去引导权
3. 输出路径硬编码 `~/.soulkiller/exports/` → 无法导出到 `.claude/skills/`

这三个都属于"用户知道自己想要什么，系统应该问"的范畴。

## Goals / Non-Goals

**Goals:**
- 故事有明确的"身份名"，由用户提供，用作 skill dir 和 description
- 用户可以用自由文本注入故事方向，agent 必须将其作为最高优先级引导
- 输出位置三选一（exports / 全局 claude skills / 项目 claude skills），由用户主动选
- 保持 export-agent 的分阶段工具体系不变

**Non-Goals:**
- 不记住用户上次的选择（跨 session 持久化以后再说）
- 不支持自定义任意路径（只提供三个预设，避免开放路径带来的权限/冲突问题）
- 不改动 packager 的底层复制逻辑（只改参数和目录计算）
- 不做路径存在性检查或自动创建（`fs.mkdirSync(..., { recursive: true })` 覆盖所有情况）

## Decisions

### D1: 三个输出位置固定预设，不做动态检测

**决策**: 展示三个固定选项：

```
- 默认      ~/.soulkiller/exports/
- 项目       .claude/skills/           (解析为当前工作目录下的 .claude/skills)
- 全局       ~/.claude/skills/
```

**理由**:
- 用户明确提到这三种场景
- 不检测 `.claude/` 存在性——反正创建目录用 `recursive: true`，不存在也会创建
- 不提供"自定义路径"——避免用户输入诡异路径导致权限问题或 skill 被写到错误位置
- 实现简单，可预测

### D2: 故事名直接作为 kebab-case 目录名

**决策**: 
```
用户输入: "姐妹救赎"
  ↓
storyName 保留: "姐妹救赎" (写入 story-spec frontmatter / SKILL.md description)
  ↓
目录转换: toKebabCase("姐妹救赎") = "姐妹救赎"  (中文字符保留)
  ↓
skill dir name: "soulkiller:姐妹救赎-in-fate-stay-night"
```

现有 `toKebabCase` 函数已经保留中日韩字符，直接复用。

**理由**: 
- 原名用于展示和 frontmatter（给 SKILL.md / 用户看）
- kebab-case 用于文件系统（避免空格和特殊字符）
- 中文不转拼音——保持识别度，且 Claude Skills 支持 unicode 文件名

### D3: 故事方向作为 initial prompt 顶部的"用户原始意图"块

**决策**: 

```typescript
function buildInitialPrompt(data: PreSelectedExportData): string {
  const userIntentBlock = data.storyDirection
    ? `# 用户原始意图（最高优先级）\n\n${data.storyDirection}\n\n---\n\n`
    : ''

  const storyNameBlock = `# 故事名\n\n${data.storyName}\n\n---\n\n`

  return `${userIntentBlock}${storyNameBlock}以下是用户选定的角色组合和世界...`
}
```

SYSTEM_PROMPT 新增指引：

```
如果 initial prompt 中包含"用户原始意图"块：
- 这是用户的最高优先级引导
- 你生成的 tone / constraints / 角色 role 分配必须反映这个意图
- 用户没提到的细节可以自主决定，但不要偏离用户方向
```

**理由**:
- 注入在顶部确保 agent 首先看到
- "最高优先级"的表述让 agent 不会被其他自由发挥覆盖
- 用户没提到的部分 agent 仍可创意补全（不是完全锁死）

**替代方案**: 
- 把 direction 作为 constraint 塞到 set_story_metadata → 太间接，agent 可能忽略
- 拆成多个结构化字段（protagonist 选谁 / tone 偏向 / ...）→ 摩擦太大

### D4: finalize_export 不再接受 output_dir

**决策**: 

```typescript
// 旧
finalize_export({ output_dir?: string })
  → packageSkill({ ..., output_dir: resolvedDir })

// 新
finalize_export({})
  → packageSkill({ ..., story_name, output_base_dir })  
       ^                  ^                ^
       用 builder          CLI 预设        CLI 预设
```

`packageSkill` 的参数从 agent 决策收回到 CLI，符合"机械决策归 CLI"的原则。

**理由**:
- 输出路径不是 LLM 能推理的东西
- 避免 agent 误用 output_dir（有时会传 undefined、"."、"/exports" 等诡异值）
- 参数更少，tool input 更小

### D5: packageSkill 接口重构

```typescript
// 旧
interface PackageConfig {
  souls: string[]
  world_name: string
  story_spec: StorySpecConfig
  output_dir?: string  // 原意: 父目录，不含 skill 自身
}

// 新
interface PackageConfig {
  souls: string[]
  world_name: string
  story_name: string       // 新增: 必填，用于 skill dir name
  story_spec: StorySpecConfig
  output_base_dir: string  // 改名 + 必填: 父目录，CLI 预先解析
}
```

`getSkillDirName` 签名：

```typescript
// 旧
getSkillDirName(soulNames: string | string[], worldName: string): string
  → "soulkiller:<protagonist>-in-<world>"

// 新
getSkillDirName(storyName: string, worldName: string): string
  → "soulkiller:<story>-in-<world>"
```

### D6: Wizard 新增 3 个 step

```typescript
type UIStep =
  | 'loading-lists'
  | 'empty-souls' | 'empty-worlds'
  | 'selecting-souls'
  | 'selecting-world'
  | 'naming-story'       // NEW — TextInput, required
  | 'story-direction'    // NEW — TextInput, optional (Enter 跳过)
  | 'selecting-output'   // NEW — select, 3 options
  | 'loading-data'
  | 'running'
```

Esc 导航：
```
selecting-souls  → Esc = cancel
selecting-world  → Esc = selecting-souls
naming-story     → Esc = selecting-world
story-direction  → Esc = naming-story
selecting-output → Esc = story-direction
```

### D7: 输出位置的路径解析

```typescript
const OUTPUT_OPTIONS = [
  { key: 'default', label: '默认 (~/.soulkiller/exports/)', path: path.join(os.homedir(), '.soulkiller', 'exports') },
  { key: 'project', label: '当前项目 (.claude/skills/)', path: path.resolve('.claude/skills') },
  { key: 'global', label: '全局 Claude skills (~/.claude/skills/)', path: path.join(os.homedir(), '.claude', 'skills') },
]
```

`.claude/skills` 的 `path.resolve` 基于 `process.cwd()`，即 CLI 启动时的目录。

### D8: story-spec.md 新增 story_name / user_direction frontmatter

```yaml
---
genre: 都市奇幻
tone: 姐妹羁绊下的救赎与黑化
story_name: 姐妹救赎
user_direction: 围绕凛与樱的姐妹关系，凛作为 protagonist。希望有明显的黑暗转折，但不要太甜。
acts_options:
  - { acts: 3, ... }
default_acts: 5
characters:
  - ...
---
```

`user_direction` 可选；若用户跳过则不输出该字段。

## Risks / Trade-offs

- **[Risk] 故事名与已有 skill 冲突** → packageSkill 已经 `rmSync(outputDir)` + `mkdirSync`，会覆盖。未来可加冲突检测并提示
- **[Risk] agent 忽略 user_direction** → 通过顶部注入 + SYSTEM_PROMPT 强调两头拦截。若仍忽略，可考虑再加 `user_direction` 到每个 tool 的 description 里重复提醒
- **[Risk] 项目路径 `.claude/skills` 在 nested 目录调用时错位** → `process.cwd()` 是用户执行命令的目录，通常正确；文档里说明
- **[Trade-off] 不提供自定义路径** → 简化了 90% 的场景，少数特殊需求用户可事后 mv
- **[Breaking] getSkillDirName / packageSkill 签名变更** → 所有调用点和测试必须同步更新
- **[Risk] 已归档的 spec 提到的 protagonist-based 命名会过时** → 同步时修改 multi-soul-export 和 export-agent 主 spec
