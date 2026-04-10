## Context

当前 skill 运行时使用 3 个固定 `slot-{1,2,3}` 存档槽，与 script 通过 `meta.yaml.script_ref` 松耦合。Phase -1 是 5 层菜单（继续游戏 / 重玩 / 重命名 / 删除 / 新建），用户需要逐层点进才能定位到目标剧本和存档。

state CLI 的所有子命令（init, apply, validate, rebuild, reset）均以 `slot` 标识符为核心参数，路径解析通过 `resolveSavePaths(skillRoot, slot)` → `runtime/saves/slot-<N>/`。

Phase 2 中每次选择通过 `state apply <slot> <scene> <choice>` 写入状态，但没有手动存档机制——Phase 2 模板明确禁止暴露"保存/存档"UI。

## Goals / Non-Goals

**Goals:**
- 将存档模型从全局 slot 改为 per-script 目录，每个剧本拥有独立的存档空间
- 每个剧本支持 1 个自动存档（每次选择自动更新）+ 最多 3 个手动存档（用户主动触发）
- Phase -1 改为扁平化剧本列表，首屏直接展示所有剧本及其存档状态
- Phase 2 在每个 AskUserQuestion 的选项末尾追加"💾 保存当前进度"，保存后重弹原选项
- state CLI 新增 `save` 和 `list` 子命令

**Non-Goals:**
- 不做旧 slot 结构的迁移兼容（断代）
- 不改变 state.yaml / meta.yaml 的文件格式（仅改目录位置）
- 不改变 script.json 的格式
- 不增加存档的导入/导出功能
- 不增加 Phase 3（结局）的存档行为

## Decisions

### D1: 存档目录结构 — per-script 嵌套

**选择**: `runtime/saves/<script-id>/auto/` + `runtime/saves/<script-id>/manual/<timestamp>/`

```
runtime/saves/
└── <script-id>/           ← 8字符 hex id，如 "a3f9c2e1"
    ├── auto/
    │   ├── state.yaml
    │   └── meta.yaml
    └── manual/
        ├── 1712345678/    ← Unix timestamp 秒级
        │   ├── state.yaml
        │   └── meta.yaml
        ├── 1712349012/
        │   └── ...
        └── 1712356789/    ← 上限 3 个
            └── ...
```

**替代方案**: 继续用 slot 编号但增加 `save_type` 字段 → 拒绝，因为 slot 与 script 的 N:M 关系让菜单逻辑复杂化。

**理由**: script-id 作为目录名天然建立 1:N 归属关系；删除剧本时 `rm -rf saves/<id>/` 即可级联清理。timestamp 目录名按字典序排列即时间序，无需额外索引。

### D2: resolveSavePaths 参数签名变更

**旧签名**: `resolveSavePaths(skillRoot, slot)` → `runtime/saves/slot-<N>/`

**新签名**: `resolveSavePaths(skillRoot, scriptId, saveType)` 其中 `saveType` 为 `'auto'` 或 `{ manual: string }` (timestamp)

```typescript
type SaveType = 'auto' | { manual: string }

function resolveSavePaths(skillRoot: string, scriptId: string, saveType: SaveType): SavePaths
// 'auto'           → runtime/saves/<scriptId>/auto/
// { manual: '...'} → runtime/saves/<scriptId>/manual/<timestamp>/
```

**理由**: 单一函数覆盖两种路径模式，所有下游子命令只需传入 `(scriptId, saveType)` 即可。

### D3: state CLI 新增子命令

| 子命令 | 签名 | 作用 |
|--------|------|------|
| `state save <script-id>` | 从 auto/ 快照到 manual/<now>/ | 创建手动存档 |
| `state list <script-id>` | 列出 auto + manual/* | JSON 输出所有存档 |

**`state save` 语义**: 将当前 auto/ 的 state.yaml + meta.yaml **复制**到 `manual/<timestamp>/`。不影响 auto/ 本身。如果 manual/ 已有 3 个子目录，返回错误 `MANUAL_SAVE_LIMIT_REACHED` + 现有存档列表，由 LLM 提示用户选择覆盖。

**`state list` 输出格式**:
```json
{
  "scriptId": "a3f9c2e1",
  "auto": { "currentScene": "scene-12", "lastPlayedAt": "2026-04-10T15:30:00Z" },
  "manual": [
    { "timestamp": "1712345678", "currentScene": "scene-5", "lastPlayedAt": "2026-04-10T14:00:00Z" },
    { "timestamp": "1712349012", "currentScene": "scene-8", "lastPlayedAt": "2026-04-10T14:30:00Z" }
  ]
}
```

### D4: state CLI 现有子命令路径适配

所有现有子命令的 `<slot>` 参数替换为 `<script-id> <save-type>`：

| 旧签名 | 新签名 |
|--------|--------|
| `state init <slot> <script-id>` | `state init <script-id>` (始终写入 auto/) |
| `state apply <slot> <scene> <choice>` | `state apply <script-id> <scene> <choice>` (始终写入 auto/) |
| `state validate <slot> [--continue]` | `state validate <script-id> [<save-type>] [--continue]` |
| `state rebuild <slot>` | `state rebuild <script-id> [<save-type>]` |
| `state reset <slot>` | `state reset <script-id> [<save-type>]` |

`save-type` 参数: `auto`（默认）或 `manual:<timestamp>`。`init` 和 `apply` 固定操作 auto/，不接受 save-type 参数。

### D5: 手动存档覆盖流程

当 `state save` 返回 `MANUAL_SAVE_LIMIT_REACHED` 时，Phase 2 的 SKILL.md 模板指导 LLM：
1. 用 `state list` 获取现有手动存档列表
2. 通过 AskUserQuestion 展示列表，让用户选择覆盖哪个
3. 新增 `state save <script-id> --overwrite <timestamp>` 参数，删除旧目录并创建新快照

### D6: Phase -1 菜单重设计

```
Step -1.0: doctor (不变)
Step -1.1: Glob scripts/*.json → 解析标题
Step -1.2: 对每个 script，运行 state list <id> → 聚合存档信息
Step -1.3: 主菜单 (AskUserQuestion)
  - 每个有 auto 存档的剧本: "<title> [🔄 <scene> · <time>]"
  - 每个无存档的剧本: "<title> [无存档]"
  - 分隔线后: "✨ 生成新剧本" / "📋 管理剧本"
Step -1.4: 选中剧本后
  - 如果有存档 → 子菜单: 列出 auto + manual + "从头重玩"
  - 如果无存档 → 直接 init → Phase 2
Step -1.5: validate 选中的存档 → Phase 2
```

### D7: Phase 2 手动存档选项注入

在 SKILL.md 的 Phase 2 场景呈现规则中追加：

- 每个 AskUserQuestion 的 choices 数组末尾追加一个固定选项: `💾 保存当前进度`
- 此选项不属于 script.json 的 choices 定义，由 LLM 运行时注入
- 用户选择此选项时:
  1. 调用 `state save <script-id>`
  2. 如果成功 → 输出确认信息 → 重新弹出相同的 AskUserQuestion（含所有原始剧情选项 + 💾）
  3. 如果 `MANUAL_SAVE_LIMIT_REACHED` → 展示覆盖菜单 → 完成后重弹原选项
- 此选项不触发 `state apply`，不推进剧情，不消耗回合

## Risks / Trade-offs

**[LLM 可能忘记注入💾选项]** → 在 SKILL.md 的 Phase 2 禁止事项中明确要求"每个 AskUserQuestion 必须包含💾选项"，与现有的"选项标签污染"禁令形成对偶约束。

**[state list 增加 Phase -1 启动延迟]** → 每个 script 需要一次 `state list` 调用（读取 auto/ + 最多 3 个 manual/ 的 meta.yaml）。对于 <10 个剧本的典型场景，额外 IO 可忽略。

**[手动存档 timestamp 冲突]** → 使用秒级 Unix timestamp。同一秒内两次手动保存的概率极低（需要在 1 秒内完成选择覆盖流程 + 再次保存），不做额外处理。

**[断代不兼容]** → 旧 skill 的 `slot-*` 目录不会被新代码识别。已确认当前 skill 未正式发版，可接受。
