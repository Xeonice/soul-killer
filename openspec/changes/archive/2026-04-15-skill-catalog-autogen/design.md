## Context

README 顶部的"可装 skill 列表"目前是手写 markdown 表，每次 `/publish` 或新增示例 skill 都要人工同步。现有 `soulkiller.json` 只有技术字段，没有展示用的 slug / 世界名 / 简介，自动生成缺数据源。仓库另一个 `skill-catalog` 能力已经定义了"云端 catalog.json"（Cloudflare Worker `/examples/catalog.json`），但那是给 CLI 的 `soulkiller skill catalog` 远程命令用的，不是给 GitHub 访客阅读的，不可复用。

本变更要解决：**如何用一份"导出即记录"的元数据，同时驱动 README 静态展示和未来可能的其他展示面**。

## Goals / Non-Goals

**Goals:**
- 一次性打通：导出向导产出 → soulkiller.json 存储 → release 时扫描 → README 注入
- 旧归档兼容：不必重导出就能出现在 README（走降级路径，展示质量差一点）
- CI 闭环：PR 干跑校验、tag 触发后 push 同步，作者无需手动改 README
- LLM + 人类协作：agent 产出候选，作者快速确认/编辑；不要纯手填（啰嗦），也不要纯 LLM（失控）

**Non-Goals:**
- **不**替代云端 `skill-catalog` 能力。云端 catalog 用于运行时下载；本变更只写静态 README。
- **不**处理 README 其他段落的自动化（changelog / feature list 等）。占位符段机制是通用的，但本次只落地一处。
- **不**做 i18n。README 就是中文为主混英文的现状，不做多语言表格。
- **不**在 LLM 候选之外给作者更多辅助（比如世界 wiki 自动抓取）。作者手编就够。

## Decisions

### D1. 三字段加在 soulkiller.json，不新增文件

**选项**：
- (a) 扩展 `soulkiller.json` — 选中
- (b) 新增 `catalog.json` 元数据文件
- (c) 写在 `SKILL.md` frontmatter

**理由**：
- `soulkiller.json` 已经是 manifest，扩展字段成本最低；调用方只多读三列。
- `SKILL.md` frontmatter 是 LLM prompt 的一部分，改 shape 影响 Anthropic Skill spec 兼容性，风险高。
- 新文件纯属额外 I/O，多一个 ALLOWED_FILES 白名单项，不值得。

**副作用**：`ALLOWED_FILES` 不变（`soulkiller.json` 本就在列）；向后兼容——解析时三字段缺失视作 `""`。

### D2. 字段语义：`world_slug` / `world_name` / `summary`

**约束**：
- `world_slug`：kebab-case ASCII，`[a-z0-9-]+`，长度 2–32。作为 README 表格首列，必须可 URL 友好、短、稳定。
- `world_name`：自由文本，长度 ≤ 40，允许 CJK / 特殊符号（如 `Fate/Zero` 的斜杠）。
- `summary`：单行文本，长度 ≤ 80，不允许换行。

**与 `skill_id` 的关系**：`skill_id` 是归档技术标识（如 `fz-in-fate-zero`），`world_slug` 是展示短名（如 `fate-zero`）。二者允许不同——这是刻意的，因为 `skill_id` 绑定了作者 handle（`fz-in-`），而 README 里不希望暴露。

### D3. LLM 产出 + Wizard 确认的双层协作（agent 后置确认版）

**工作流**（实现盘点后修订）：
1. LLM 在 `set_story_metadata` 阶段就填三字段候选（从 `user_direction` 抽 `world_name`，slugify 成 `world_slug`，从 genre/tone/character_arcs 合成 `summary`），存入 ExportBuilder
2. agent 跑完所有 character / 路由 / `finalize_export` 工具后，进入 `finalize.ts::finalizeAndPackage`
3. **在 `builder.build()` 之后、`packageSkill()` 之前**，finalize 触发新的桥接事件 `catalog_confirm_request`（携带三字段候选）
4. export.tsx 接到事件，切到新的 UIStep `entering-catalog-info`，依次展示三个 TextInput（预填 LLM 候选），完成后 resolve 一个新的 `catalogConfirmResolverRef`
5. finalize 拿到确认后的值，注入 `story_spec.catalog_info`（新字段），传给 packager
6. packager 在 `buildSoulkillerManifest` 里写入三字段

**为什么不能放在 wizard 前**（实现时发现的硬约束）：
- 现有 wizard 流：`entering-version → loading-data → running(agent)`。LLM 候选要在 agent 内部 `set_story_metadata` 阶段才存在；放 entering-version 之前等于无候选可填，违背 D3 初衷。

**为什么不在 `set_story_metadata` 工具内部就 askUser**：
- 工具 `execute` 在 agent loop 里同步 await，连续 askUser 3 次会阻塞 agent；而且现有 askUser 不支持初始值（要扩 API）
- 在 finalize 阶段统一处理更干净——agent 已结束，UI 不与 agent loop 竞争 ink useInput

**为什么不让 wizard 作者纯手填**：
- slug / summary 要想、要键盘打，打字成本高
- LLM 候选作为"起点 + 改"比"从空白起"快得多

**实现要点**：
- 新增 `ExportProgressEvent` 类型 `catalog_confirm_request: { candidates: { world_slug, world_name, summary } }`
- 新增 export.tsx 的 `catalogConfirmResolverRef`（对标 `planConfirmResolverRef`）
- 新增 UIStep `entering-catalog-info`，含三个 sub-step（slug → world → summary）
- 新增 `PackageConfig.catalog_info?: {...}`（finalize 注入）
- Esc 在三步中任意一步：取消整个导出（agent 已不可逆，不能"退回 entering-version"）

### D4. README 占位符机制

**选用标记**：HTML comment `<!-- SKILLS:START -->` 和 `<!-- SKILLS:END -->`（成对）。

**为什么**：
- HTML comment 在 GitHub markdown 渲染时不可见
- 成对检查比单标记定位边界更稳
- 同类机制已被社区广泛使用（profile README、very-good-readme 等）

**脚本行为**：
- 找不到任一标记 → 脚本退出 1 + stderr 提示插入
- 找到但内部内容与目标一致 → 退出 0 无副作用
- 找到且内部需更新 → 默认模式写入 + 退出 0；`--check` 模式打印 diff + 退出 1

### D5. 脚本用 Bun + `fflate`

**解压方案**：
- 优先 `Bun.spawn(['unzip', '-p', file, 'entry'])` 管道读单个 entry — 零依赖、速度快
- 备选 `fflate`（已是项目其他地方的依赖吗？需确认）

**为什么不用 `adm-zip` / `yauzl`**：需要 npm 依赖，且大多是 Node-only API。

**行动项**：实现时先确认 `unzip` 在 CI（ubuntu-latest）默认可用 — 可用则首选，否则退回 `fflate`。

### D6. CI 注入时机：tag 触发后、构建前，push 回 main

**流程**（release.yml）：
```
on: push tags v*
  jobs.release:
    steps:
      - checkout main          (fetch-depth 0)
      - run build-skill-catalog.ts
      - if README modified:
          - git commit
          - git push origin HEAD:main
      - bun test
      - cross-compile
      - gh release create
```

**为什么 tag 后才 push 回 main**：
- tag 是作者 `/publish` 的最后一步触发，此时新的 `.skill` 已经 merge 进 main，README 对应元数据还没同步
- push 的 commit 不会重新触发 release workflow（GitHub Actions 对 github-actions[bot] 的 push 默认不触发 workflow，除非显式配 `pull_request_target` 或 PAT）
- 若分支保护规则禁止 bot push，走 PAT secret 或提前改规则；写在 spec 里作为已知风险

**CI 干跑校验（ci.yml）**：
- PR 上跑 `--check`，和 `examples/skills/` 的 diff 不一致就失败
- 对标已有 `verify-examples` job 的模式

### D7. 字段降级优先级

老归档缺三字段时，脚本按如下回退：

| 列 | 首选 | 回退 1 | 回退 2 |
|---|---|---|---|
| slug | `soulkiller.json.world_slug` | `soulkiller.json.skill_id` | — |
| 世界 | `soulkiller.json.world_name` | `"—"` 字面值 | — |
| 说明 | `soulkiller.json.summary` | `SKILL.md` frontmatter `description` | 文件名（不含 `.skill`）|

回退路径触发时 stderr 打 warning，但脚本仍然以 0 退出（PR 不 block）。

## Risks / Trade-offs

- **[Risk] 分支保护规则禁止 bot push 回 main** → Mitigation: 部署前检查仓库 branch protection；如启用，则维护者生成 fine-grained PAT 存 secret，workflow 用 `${{ secrets.README_PUSH_PAT }}` 做 checkout / push。默认工作流所用的 `GITHUB_TOKEN` 能绕过保护规则的一部分限制，但不能绕过 required reviews。
- **[Risk] bot 回推 commit 触发二次 workflow 形成循环** → Mitigation: release.yml 只由 `push tags` 触发，不由 `push branches main` 触发；ci.yml 虽由 main push 触发但只跑 `--check`，已是 idempotent 状态。
- **[Risk] LLM 产出的 slug 与 `skill_id` 冲突/重复** → Mitigation: wizard 显示输入框让作者改；若两个 skill 的 slug 相同，脚本在 build 时检测重复直接 fail（`--check` 和默认模式都失败）。
- **[Risk] 三字段对已导出归档"污染"** → Mitigation: 不强制重导出。老归档进降级路径，README 里世界列是 `—`，能看但不完美，作者有动力下次导出时顺手补上。
- **[Risk] set_story_metadata 成为唯一产出口，若 LLM 漏传字段，作者要经历 tool error + retry** → Mitigation: 在 prompts.ts 里强调三字段必填，并提供 inputExamples；strict:true 确保 schema 校验在 SDK 层拦截。
- **[Trade-off] 脚本运行依赖 `unzip` 命令** → Accept：ubuntu-latest 默认含；本地开发 macOS/Linux 默认含；Windows 作者需 WSL 或 Git Bash（soulkiller 整体就这么要求）。
- **[Trade-off] README 表格只有三列** → Accept：够用。若要显示角色数量、版本等，未来以同机制扩列，不影响当前架构。

## Migration Plan

1. **Phase A（数据面）**：落地 soulkiller.json 三字段、ExportBuilder、set_story_metadata tool schema、wizard 步骤、单测。合入后**不**影响现有 CI 行为。
2. **Phase B（自动化）**：落地脚本、README 占位符、release.yml + ci.yml 改动。首次 PR 合并前本地跑一次 `bun scripts/build-skill-catalog.ts`，把老归档的降级行写入 README；之后 ci.yml 守护一致性。
3. **回滚**：
   - Phase A 单独回滚 = 恢复 manifest 为 6 字段；老归档继续走降级路径，无副作用。
   - Phase B 单独回滚 = 删除 workflow 改动 + README 占位符段；数据面保留，下次发版前手动编 README。

## Open Questions

1. 归档内 `SKILL.md` frontmatter 的 `description` 现在格式是 `"fz — 在Fate Zero中的多角色视觉小说。每次运行都是全新剧本。"`。这是否作为 `summary` 的降级源？——**初步决定：是**（见 D7）。但降级结果会比手编的 "第四次圣杯战争，含…完整卡司" 信息量低。接受该差距。
2. `world_slug` 如果被两个 skill 意外撞名（作者自己误填），是在导出时阻断还是 build 时阻断？——**初步决定：build 时**（scripts/build-skill-catalog.ts）。导出时不知道其他 skill 存在。
3. PAT 是否需要？先用默认 `GITHUB_TOKEN` 试试，如果实际跑 release 失败就补 PAT。**验收时在 staging 仓库先跑一轮确认**。
