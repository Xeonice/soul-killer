## Context

v0.4.0 把 README 重构成「soulkiller 是本地启动器」叙事，但装 `.skill` 预制档案仍走 bash 脚本（三套：Claude Code global / project / OpenClaw），Windows 不可用，也没覆盖 Codex CLI / opencode 这两个新兴目标。

现有 zip/tar 生态分裂：
- `src/export/packager.ts` 用 `fflate.zipSync` 写 `.skill` ✓ 纯 TS
- `src/cli/updater.ts` 用 `execSync tar -xzf` + `powershell Expand-Archive` 解释压 release binary
- `src/export/pack/unpacker.ts` 用 `execFile tar` 解 `.soul.pack` / `.world.pack`

`fflate` 只做 zip/gzip，tar 需要独立库。`nanotar` (~2KB) 是纯 TS 实现，配合 `fflate.gunzipSync` 能彻底把解压工作从 shell out 拉回进程内。

四家 CLI 的 skill 加载约定研究结果（均用 `<name>/SKILL.md` 目录格式）：
- **Claude Code**：`~/.claude/skills/` + `<cwd>/.claude/skills/`
- **Codex CLI**：`~/.agents/skills/`（主）+ `<cwd>/.agents/skills/`
- **opencode**：`~/.config/opencode/skills/`（原生）+ 同时读 `~/.claude/skills/` 与 `~/.agents/skills/`（compat）
- **OpenClaw**：`~/.openclaw/workspace/skills/`（无项目级）

Cursor 无 `<name>/SKILL.md` 加载约定（最接近的是 `.cursor/rules/*.mdc`，语义不对等），本次不支持。

## Goals / Non-Goals

**Goals:**
- 所有 zip/tar 解压路径统一到 fflate+nanotar，零 shell spawn、零平台分支
- 一条 `soulkiller skill install` 命令覆盖 4 个目标 CLI 家族（Claude Code / Codex / opencode / OpenClaw）× 全局/项目作用域
- Worker 提供 `catalog.json` 作为远端 skill 目录的事实来源；CI 自动维护
- REPL 内 `/install` 与 `/upgrade` 两条新命令补齐启动器体验
- 跨 Windows / Linux / macOS 等价行为（包括路径分隔符、home 解析）

**Non-Goals:**
- 不改 `.soul.pack` / `.world.pack` 的 tar.gz 格式（保持向后兼容）
- 不支持 Cursor（`.cursor/rules/*.mdc` 语义是 always-on 规则，不是按需加载的 skill；转换会损失大量信息）
- 不在 REPL `/upgrade` 里实现 in-process 替换（JS 进程已加载，必须重启；`/upgrade` 升完提示 `/exit` 即可）
- 不做并发下载调度（串行足够，单个 `.skill` 只 2-3MB）
- 不做 skill 版本回滚 / 多版本共存（单 slug 单版本；`--overwrite` 覆盖旧版）

## Decisions

### 决策 1：zip/tar 库选型 —— fflate + nanotar

**选择**：新增 `nanotar` 依赖（~2KB，纯 TS），覆盖 tar 解包；`fflate` 已有，覆盖 zip/gzip。

```
格式               处理
─────────────────────────────────────────
.skill (zip)       fflate.unzipSync
release .zip       fflate.unzipSync
release .tar.gz    fflate.gunzipSync → nanotar parseTar
.soul/.world.pack  fflate.gunzipSync → nanotar parseTar
```

**理由**：
- fflate 只做 zip/deflate/gzip，tar 必须独立库
- nanotar 比 tar-stream 小一个量级，无 Node 内置流依赖，适合 bundle 进 bun compile
- 两库组合后所有解压路径都是同步纯函数，无 shell spawn，跨平台一致
- 现有 fflate 0.8.2 已装，零迁移成本

**Alternatives considered**：
- `tar-stream`（~30KB，依赖 readable-stream）：太重
- 继续 shell out：Windows `tar.exe` 在 Win10 1803+ 才内置，更早版本只能用 PowerShell `Expand-Archive`，PowerShell 对含空格路径、中文文件名有各种坑
- 自写最小 tar reader：tar 格式虽简单但边界情况（sparse、pax extensions、长文件名）不值得重造

### 决策 2：4 个 target，不靠 opencode compat 省

**选择**：暴露 `claude-code` / `codex` / `opencode` / `openclaw` 四个独立 target，用户可多选。

**理由**：
- opencode 确实兼容 `~/.claude/skills/` 与 `~/.agents/skills/`，但用户用 `--to opencode` 时意图是"只在 opencode 里看到"，此时装到原生 `~/.config/opencode/skills/` 最贴合预期
- 独立 target 让 `skill list` / `skill upgrade` 能准确映射目录到家族；靠 compat 会丢失溯源信息（同一 slug 在 `~/.claude/skills/` 里是给 Claude Code 的、给 opencode 的、还是两边都服务？无法判别）
- UX 层用户按"我主用哪个 CLI"勾选，不需要理解 compat 细节

**Alternatives considered**：
- 三 target + 提示 "opencode 白捞"：UX 省一个选项，但教学成本高、`skill list` 语义模糊
- 单 target `--to all` + 固定三路径：灵活性差，opencode-only 用户被迫装四份

### 决策 3：catalog.json 作为远端事实来源

**选择**：Worker `/examples/catalog.json` 是唯一入口；CLI 启动时拉一次（带短 TTL 缓存到 `~/.soulkiller/cache/catalog.json`）。

**schema**:
```json
{
  "version": 1,
  "updated_at": "2026-04-15T10:00:00Z",
  "soulkiller_version_min": "0.4.0",
  "skills": [
    {
      "slug": "fate-zero",
      "display_name": "Fate/Zero",
      "description": "…",
      "version": "1.0.0",
      "engine_version": 3,
      "size_bytes": 2411724,
      "sha256": "abc123…",
      "url": "/examples/skills/fate-zero.skill",
      "soulkiller_version_min": "0.4.0",
      "characters": ["saber", "archer"],
      "tags": ["visual-novel", "multi-character"]
    }
  ]
}
```

**CI 流水线**：
1. 扫 `examples/skills/*.skill`（假设 `.skill` 构建产物提交到仓库或 CI artifact）
2. 对每个包：`fflate.unzipSync` 读 `soulkiller.json` + `SKILL.md` 的 frontmatter，算 sha256
3. 合成 `catalog.json`，与 `.skill` 一并 `wrangler publish` 到 Worker

**URL 覆盖优先级**：CLI flag `--catalog <url>` > env `SOULKILLER_CATALOG_URL` > 硬编码 `https://soulkiller-download.ad546971975.workers.dev/examples/catalog.json`

**理由**：
- 客户端零维护——新增 skill 只需上传包、跑 CI，用户端自动看到
- sha256 强制校验抵御 CDN 污染 / 中间人
- `soulkiller_version_min` 让 catalog 本身能排除老客户端看到的"装不上"的 skill
- 缓存到磁盘减少网络往返，但每次 `skill install` 强制刷新（避免 stale sha256 阻止用户装新版）

### 决策 4：REPL `/upgrade` 仅做二进制自更，不做 skill 升级

**选择**：`/upgrade` 等价 `soulkiller --update`，走现有 `runUpdate()`；进入前渲染确认界面（当前版本 / 最新版本 / release notes 摘要）。`/upgrade --check` 只查不升。

**升级后行为**：在 REPL 进程内替换二进制后，当前进程仍是旧代码——必须提示用户 `/exit` 重启。Windows 上 `<exe>.old` 清理复用现有 `cleanupStaleOld()` 机制。

**理由**：
- `skill upgrade` 语义是"把 `runtime/engine.md` 刷新"，跟二进制升级完全是两件事；合并会语义混乱
- 现有 `runUpdate()` 的 Windows `rename-self` + 校验 + 原子替换已经久经考验，复用即可
- REPL 做 in-process replace 不现实（JS 解释器 + 已加载的 ink 组件无法热换）

**Alternatives considered**：
- `/upgrade` 兼顾二进制+skill：命令语义不清
- 靠 `--update` CLI flag 不做 REPL 命令：用户从 `/install` 看到 "engine 超本机" 提示后必须 Ctrl+C 出去跑 `--update`，体验断裂

### 决策 5：项目级作用域不做 git repo 校验

**选择**：`--scope project` 直接落到 `<cwd>/.<target>/skills/`，不验证是否 git 仓库根、不验证是否存在 `package.json` 等项目文件。仅做一项检查：`cwd == $HOME` 时显式警告 "global 与 project 此处等价，确认？"（Y/n）。

**理由**：
- Claude Code 官方文档明确说明"skills 在任何目录都能用，无 git 要求"，Codex / opencode 同理
- 加 `.git/` 强制校验反而阻挠合法用法（在 `/tmp` 快速试 skill、在非 git 仓库的 `~/work/` 里装）
- `cwd == $HOME` 是唯一真实歧义场景——project 目录正好等于 global 目录，用户十有八九不是故意的

### 决策 6：catalog 校验失败一律 abort

**选择**：
- slug 不在 catalog → abort（`soulkiller skill install typo-slug` 直接报 "unknown slug"，不 fall-through 尝试拼 URL）
- sha256 不匹配 → abort（安全底线）
- engine_version 超本机 → abort，错误文案直接指路 `/upgrade`
- 用户输的不是 slug 而是 URL 或本地路径 → 跳过 catalog 校验，但仍要求 sha256（本地路径）或新鲜下载（URL）后对内嵌 `soulkiller.json.engine_version` 做本机兼容检查

**理由**：
- slug 不校验会让 typo 悄悄 404，debug 成本高
- sha256 是信任链的关键——容忍不符就失去 catalog 的意义
- engine_version 过高的 skill 即使装进去也跑不起来（Phase -1 会失败），提前 abort 是对用户友好

### 决策 7：自动剥离内层包装目录

**选择**：解包 `.skill` 后，如果 root 只有单一目录（如 `fate-zero/SKILL.md` 这种 `fate-zero/` 套壳），自动 `strip-components=1` 到目标路径；如果 root 已直接是 `SKILL.md`，原样写入。

**理由**：
- 历史原因：旧版 soulkiller 打包 skill 带一层 wrapper 目录，新版本平铺；catalog 里两种都可能存在
- strip-1 逻辑与 CLAUDE.md 里描述的 `docs: 修正 skill 一键安装命令，剥离 zip 内层包装目录` 前序工作一致
- 检测条件严格："root 单一目录 + 其中有 `SKILL.md`" 才 strip，避免误伤合法结构（如 root 有 `SKILL.md` + `souls/`）

### 决策 8：`skill list` 合并列 / `skill upgrade` 遍历所有 target

**选择**：`skill list` 扫 4 全局 + 3 项目 = 7 个目录，按 slug 分组，单行显示 `<slug>  <engine>  <version>  <status>  <targets...>`，targets 列用逗号分隔（如 `claude-code,codex,openclaw`）。`skill upgrade <slug>` 对同 slug 在所有出现位置都升一遍；`skill upgrade --all` 对所有 slug 的所有实例都升。

**理由**：
- 合并列 UX 清爽，一眼看出该 skill 在几处有副本
- 升级不能漏目录——否则 Claude Code 下用新版、opencode 下用旧版，诡异 bug
- list 对同 slug 只读一次 `soulkiller.json`（假设所有副本同版本），跨副本版本漂移单独用 warning 列标注

## Risks / Trade-offs

- **[nanotar 作为小众依赖的 bus factor]** → Mitigation：nanotar 源码仅 ~500 行，必要时可 vendor 到 `src/infra/tar.ts`；API 足够稳定不需频繁升级
- **[catalog.json 从 CDN 被篡改]** → Mitigation：每个 skill 都有独立 sha256，catalog 本身没签名，但篡改 catalog 后 sha256 对不上，装不进去；高价值场景可未来加 ed25519 签名字段
- **[用户在 `$HOME` 跑 `--scope project` 被警告但不理解含义]** → Mitigation：警告文案明确说 "global 与 project 在此目录等价，将覆盖 global 装法"；提供 `--scope global` 的一键切换建议
- **[opencode 用户不懂 compat，以为 `--to claude-code` 装完 opencode 看不见]** → Mitigation：`skill install` 预览矩阵（Step 4）打印一行 "opencode 也会在以下路径识别此 skill：~/.claude/skills/fate-zero/"
- **[内层包装目录检测误判]** → Mitigation：strip 条件严格（root 单一目录 + 其中有 SKILL.md）；任何其他结构保留原样；写失败前先渲染目标文件树给用户预览
- **[fflate/nanotar 替换后 `.tar.gz` 解压性能退化]** → Mitigation：对 2-3MB 级 `.skill` 和 `.soul.pack` 影响忽略不计；release binary 较大（~30MB），但自更本来就慢，用户体感差别不大
- **[Worker catalog.json 端点 404 / 临时不可达]** → Mitigation：`skill install` 优先读磁盘缓存（`~/.soulkiller/cache/catalog.json`），network fail 后提示 "using cached catalog from <time>"；catalog 老于 7 天时警告

## Migration Plan

**客户端**：
- 无数据迁移。现有 `~/.claude/skills/` 下已装的 skill 被新版 `skill list` 识别，自动归类到 `claude-code` target。

**Worker**：
- 首次部署前 CI 生成 `catalog.json` 并上传到 `/examples/catalog.json`
- 本次 CLI 发布的同一版本（≥ v0.5.0）同步上线 catalog endpoint

**README**：
- v0.5.0 发布时同步 PR 替换 bash 脚本块为 CLI 示例（三语同步）

**Rollback**：
- 如果 fflate/nanotar 替换出现兼容性问题：`git revert` 回到 shell-out 版本；用户端装 skill 仍可用旧 bash（README 旧版仍能 access）
- catalog 出问题可临时禁用（`SOULKILLER_CATALOG_URL=` 空值），让 install 只接受本地路径 / 完整 URL

## Open Questions

1. `skill install` 对同 slug 在多 target 硬拷三份——是否值得提供 `--dedup-to-claude` 之类的选项让用户只装一次 + 让 opencode 靠 compat 捞？现在的决定是不做（UX 复杂），但如果磁盘占用反馈真的来了再说
2. CI 如何获取 `.skill` 档案：要求 `examples/skills/*.skill` 提交到仓库？还是从某个 GitHub release 下载？取决于 examples 仓库的实际形态（本次提案设 `examples/skills/` 在主仓库 `examples/` 目录下，由作者手动更新；后续可换成独立仓库）
3. Cursor 如果未来确实加了 skills 支持（传闻在做），本 CLI 要不要开个 extension point？设计上 `TargetDefinition` 是接口化的，添加新 target 只需在枚举里加条记录 + 路径解析函数
