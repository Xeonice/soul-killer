## Context

soulkiller 导出的 skill 归档包含一个 ~1300 行的 SKILL.md，其中引擎指令（~1100 行）和故事内容（~200 行）混合在一起。runtime.ts 已改为直接调用二进制内嵌代码（不再执行 skill 归档里的 runtime/lib/*.ts），所以唯一需要随版本升级的文件是 SKILL.md 中的引擎指令部分。

现有 skill 无版本标识，CLI 无法识别哪些 skill 是 soulkiller 导出的、使用的是哪个版本的引擎。

## Goals / Non-Goals

**Goals:**
- 将 SKILL.md 拆分为故事内容（SKILL.md）+ 引擎指令（runtime/engine.md）
- 新导出的 skill 直接使用拆分格式
- 提供 `soulkiller skill upgrade` 命令，覆盖更新 engine.md
- 旧 skill 的首次迁移：从源数据重建内容，生成拆分文件
- 清理不再需要的 runtime/lib/*.ts

**Non-Goals:**
- 不改变 story-spec.md、souls/、world/ 的格式
- 不改变 runtime/scripts/ 和 runtime/saves/ 的结构
- 不做跨大版本的数据迁移（如 state_schema 格式变更）

## Decisions

### Decision 1: 拆分后的文件结构

```
skill 归档/
  ├── SKILL.md              ← 故事内容 + "Read engine.md" 引导
  ├── soulkiller.json       ← 版本标识
  ├── story-spec.md         ← 不变
  ├── souls/                ← 不变
  ├── world/                ← 不变
  └── runtime/
       ├── engine.md         ← 纯引擎指令（可整体替换）
       ├── scripts/          ← 不变
       └── saves/            ← 不变
```

### Decision 2: SKILL.md 内容部分结构

```markdown
---
name: <skill-name>
description: <description>
allowed-tools: AskUserQuestion Read Write Glob Edit Bash
---

You are a multi-character visual novel engine. You will run the story "<name>"...

**Before executing any phase**, Read `${CLAUDE_SKILL_DIR}/runtime/engine.md` 
in full. It defines the complete execution protocol for all phases.

## Character Path Mapping (Important)
<角色 slug 映射表>

## Prose Style Constraints (Hard Constraints on All Phase 2 Output)
<prose_style 配置>

## Required Reading List
<角色路径枚举>

## Character Scheduling
<appears_from 配置>

## Route Configuration
<route_characters 配置，如有>
```

### Decision 3: engine.md 内容

`skill-template.ts` 拆分为两个函数：
- `generateEngineTemplate()` → 纯引擎指令，无故事参数，返回 engine.md 内容字符串
- `generateContentTemplate(data)` → 故事内容部分，接收角色/世界/配置数据

engine.md 包含：Platform Scope、Phase -1 全流程、Save System、Phase 0 流程框架、Phase 1 Constraints + DSL + 生成规则、Phase 2 运行时规则、Phase 3 结局画廊、Replay Rules、Prohibited Actions。

### Decision 4: soulkiller.json 格式

```json
{
  "engine_version": 1,
  "soulkiller_version": "0.3.1",
  "exported_at": "2026-04-14T12:00:00Z",
  "skill_id": "three-kingdom-in-skill-0003tvip"
}
```

`engine_version` 是递增整数，仅在 engine.md 内容实际变更时递增。与 `soulkiller_version` 解耦。

### Decision 5: upgrade 命令流程

```
soulkiller skill upgrade [--all | <skill-name>]
  │
  ├── 扫描 ~/.claude/skills/
  │   ├── 有 soulkiller.json → 读 engine_version → 比对当前内嵌版本
  │   └── 无 soulkiller.json + 有 runtime/ → 旧版 skill，需首次迁移
  │
  ├── 常规升级（已拆分）：
  │   覆盖 runtime/engine.md → 更新 soulkiller.json
  │
  └── 首次迁移（旧 skill）：
       1. 从 story-spec.md 读取角色列表、acts_options、prose_style 等
       2. 从 souls/ 目录扫描 slug → 角色名映射
       3. 用 generateContentTemplate() 生成新 SKILL.md
       4. 写入 runtime/engine.md（最新引擎）
       5. 创建 soulkiller.json
       6. 备份旧 SKILL.md → SKILL.md.bak
       7. 清理 runtime/lib/（可选，提示用户确认）
```

### Decision 6: list 命令

```
soulkiller skill list

  NAME                          ENGINE    SOULKILLER    STATUS
  fz-in-fate-zero               1         0.3.1         up to date
  three-kingdom                  —         —             needs migration
  wa2-in-white-album-2          —         —             needs migration
```

### Decision 7: CLI 入口

```
soulkiller skill <subcommand>
  ├── list                    列出所有已安装的 soulkiller skill
  ├── upgrade [--all | name]  升级引擎指令
  └── (后续可扩展: info, remove 等)
```

注册在 `src/index.tsx` 中，与 `runtime` 同级。

## Risks / Trade-offs

- **[风险] 首次迁移时 story-spec.md 缺失或格式不兼容** → 迁移前检查，缺失则报错并保留旧 SKILL.md
- **[风险] 旧版 soulkiller 二进制读到拆分后的 SKILL.md** → SKILL.md 里的 "Read engine.md" 引导语对旧版二进制透明（LLM 会照做），不影响功能
- **[风险] engine.md 太大导致 LLM context 压力** → 和原来的单文件 SKILL.md 体积相同，不增加
- **[Trade-off] 首次迁移不 100% 还原旧 SKILL.md 内容** → 从源数据重建保证和最新模板一致，比精确还原更有价值
