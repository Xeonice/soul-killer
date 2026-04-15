## Context

REPL `/install` 的 Installed Tab 由 `src/cli/commands/system/install-views/installed-flow.tsx` 实现。Action 菜单目前 5 项：`update / add-targets / details / uninstall / back`（按是否有 updatable / gap 条件显示）。

Uninstall 选中后进 `confirm-uninstall` Phase，内部带一个 `rec: InstallRecord`——从 `skill.installs[0]!` 取。一个 skill 若在 `(target, scope)` 矩阵上有多条安装记录，`installs[0]` 之外的条目在当前 UI 里完全触达不到。

CLI 侧 `src/cli/skill-install/commands/uninstall.ts` 已处理多 target：`--all-targets` 读取 scanner 结果扫全 `skill.installs`；显式多 `--to` 也支持。底层 `atomicUninstall({ path, backup })` 每条路径独立、幂等（rename → `<path>.old-<ts>` 备份）。

利益相关者：
- **终端用户**：装在多个 Claude Code 兼容平台上的 skill 想一次清掉。
- **maintainer**：Installed Tab 的 UX 与 CLI 批量能力要对齐。

约束：
- 不引入新底层 API；仅 UI 层编排现有 `atomicUninstall`。
- 现有 e2e 场景（`20-install-tabs.test.ts`）不能回归。
- ink `useInput` 多组件不能争用——新 Phase 的按键逻辑在同一个组件的 useInput 分支里处理，跟现有 `add-targets` 多选视图同构。

## Goals / Non-Goals

**Goals:**
- 一次 action 菜单进入，覆盖 skill 的全部 install 记录（默认全选）。
- 多选视图清晰展示每条 `target:scope` 的绝对路径，让用户看到"会删哪儿"。
- 批量执行：一条失败不阻断其他；结果页区分成功/失败项。
- 单 install 的 skill 保留现有直接确认路径，不多按一步。

**Non-Goals:**
- 不处理 "跨 skill 批量卸载"（如 "装了 5 个 skill 全删" 之类）——超出本次范围。
- 不改 CLI 行为。
- 不加 "按 scope 过滤（只拔 project scope）" 的高级筛选——如有需求可跟进迭代。
- 不改 `atomicUninstall` 的 backup 策略。

## Decisions

### D1. 多选默认全选

**Choice:** 进入 pick-targets 时 `selected = new Set(all installs indices)`。

**Why:**
- 用户进 "Uninstall" 的最常见意图是"把这个 skill 拿掉"；全选匹配这一心智。
- 想保留某个 target 的 scope，按 `space` 取消即可；比从零勾选更省操作。
- CLI 的 `--all-targets` 是显式 opt-in（默认单 target），REPL 里不对齐 CLI——因为多选 UI 本身已经明确用户在"管理多安装"的语境，和 CLI 的单行语义不同。

**Alternatives considered:**
- 全不选：强制显式选择，杜绝手滑。**代价**：最常见意图要多点几下 `space`。
- 仅预选 claude-code：对齐 CLI 默认。**代价**：claude-code 先的事实性偏好没道理强加给所有用户。

### D2. `installs.length === 1` 跳过 pick-targets

**Choice:** 只有一个 install 时，Uninstall 直接进 `confirm-uninstall-batch`（单 record 版本），不过 pick-targets。

**Why:**
- 单 install 无歧义，pick step 是噪音。
- 状态机统一走 batch 路径（records 永远是数组），简化 runUninstall 分支。

**Alternatives considered:**
- 永远走 pick-targets：状态机更简单一致。**代价**：99% 场景多一次 Enter。

### D3. 部分失败：继续后续，不中止

**Choice:** `runUninstallBatch` 按数组顺序调 `atomicUninstall`，单条抛错 catch 并记录，继续下一条；结果页展示 `N uninstalled · M failed`，失败项列出 slug:target:scope + 错误 message。

**Why:**
- 每条 install 是独立路径，失败彼此无关联；"继续"不会把状态搞糟。
- 比"中止"体验好：用户一次交互能推进尽量多，失败的再针对性处理。
- 对称 CLI `skill uninstall --all-targets` 的行为（CLI 也是尽力而为）。

**Alternatives considered:**
- 遇错中止：一致性强。**代价**：用户得再次进入 UI 处理剩余条目。
- 遇错回滚已卸载的：`atomicUninstall` 留了 `.old-<ts>` 备份，理论可 rename 回去；但复杂度大幅上升，且"回滚"到底回滚到哪条也要设计。不值。

### D4. 空选不进入下一步

**Choice:** pick-targets 视图，如果 `selected.size === 0`，`Enter` 不生效；底部显示 `install.uninstall_empty_selection` 引导文案（"至少勾选一项"）。

**Why:**
- 空选 batch 行为无意义——防止静默成"成功卸载 0 项"。
- 显式拒绝比静默过更清晰。

### D5. 批量确认视图展示完整备份路径预览

**Choice:** `confirm-uninstall-batch` Phase 渲染所选条目清单，每行 `target:scope` + `路径` + `备份到 <path>.old-<ts>`（`<ts>` 是占位；实际生成在 atomicUninstall 里）。

**Why:**
- 用户看到"会删哪儿 + 会备份到哪儿"，降低误操作风险。
- 符合现有单 record 确认视图（`uninstall_confirm_backup`）的信息密度，只是扩展成列表。

## Risks / Trade-offs

- **[多选 UI 复杂度]** → 复用现有 `add-targets` Phase 的多选实现（ALL_TARGET_IDS 过滤版）作为参照，结构几乎同构。
- **[部分失败 UX 模糊]** → result 页必须让失败项一目了然（WARNING 色 + 错误 message）；汇总行用"✓ N · ✗ M"格式减少误读。
- **[向后兼容]** → 单 install 场景完全不变，现有 e2e 不会回归。多 install 场景之前是**错的**（只删 1/N），改后变"对"——严格讲是 bug fix，不是行为变更。
- **[REPL 输入冲突]** → 多选 Phase 跟 pick-targets 共用按键（space / a / ↑↓ / Enter / Esc），useInput 分支里用 `phase.kind === 'uninstall-pick-targets'` 分派，不会跟 add-targets 的同套按键冲突。

## Migration Plan

**阶段 1：Phase 重构**
1. `Phase` 类型新增 `uninstall-pick-targets` + 替换 `confirm-uninstall` 为 `confirm-uninstall-batch`（持 `records: InstallRecord[]`）。
2. action 菜单的 Uninstall handler 按 installs 数量分流：1 → confirm-batch(single)，>1 → pick-targets。
3. 新增 `runUninstallBatch(slug, records)` 循环调 `atomicUninstall`；catch 每条错误；汇总结果。
4. 删除旧 `runUninstall` 单 record 版本（或让它转发到 batch）。

**阶段 2：UI 渲染**
5. pick-targets 视图：沿用现有多选样式（◉/◯ + cursor ❯）。
6. confirm-batch 视图：列表展示所选 records。
7. result 视图：成功/失败分色渲染。

**阶段 3：i18n + e2e**
8. 7 个新 i18n 键（zh / en / ja）。
9. `tests/e2e/20-install-tabs.test.ts` 追加场景：2 个 target 的 skill → Uninstall → 看到多选 UI → 全选默认 → Enter → 确认 → Y → 两条都被备份。

**Rollback:** 单 commit 可 revert；`atomicUninstall` 未动，底层安全。

## Open Questions

1. **结果页是否给"再次进入"的快捷跳转？** 失败项可能需要重试。当前方案：进结果页后 Esc / Enter 回 Installed 列表，用户手动再进 action 菜单。MVP 接受此成本，观察反馈。
2. **是否暴露 scope 筛选？** 例如"只拔 project scope 的"。当前方案：不加；用户按 `space` 手动取消 global scope 的勾选达到等效。若后续需求强烈再加 hint 行提示。
3. **备份路径预览的时间戳** 写 `<ts>` 占位 or 在确认时固化成具体时间？倾向占位——Y 按下时才 Date.now()，和 atomicUninstall 的 timestamp 计算一致，不误导。
