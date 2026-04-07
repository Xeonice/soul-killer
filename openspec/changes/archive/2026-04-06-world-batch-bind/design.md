## Context

当前绑定系统:
- 数据存储在 soul 侧: `~/.soulkiller/souls/<name>/bindings/<world>.json`
- `WorldBinding` 接口含 world, enabled, order, overrides, entry_filter, persona_context
- `WorldBindCommand` 接受 `soulDir` prop，一次绑定一个 world 到一个 soul
- action menu 中 bind/unbind 是两个独立入口，都标记 `needsSoul: true`

相关函数:
- `bindWorld(soulDir, worldName, options)` — 写入 binding 文件
- `unbindWorld(soulDir, worldName)` — 删除 binding 文件
- `loadBindings(soulDir)` — 读取 soul 的所有 binding（只返回 enabled 的）
- `listLocalSouls()` — 列出所有本地 soul（name, description, chunkCount）
- `getSoulsDir()` — 返回 souls 根目录

## Goals / Non-Goals

**Goals:**
- 从 world 视角一次性管理所有 soul 的绑定关系
- checkbox 多选列表，已绑定的预勾选
- 合并 bind/unbind 为单一操作
- 不再依赖当前 loaded soul

**Non-Goals:**
- 不改变 binding 文件格式
- 不在 world 侧存储反向索引
- 不支持批量设置 order/overrides（用默认值，用户后续单独调整）
- 不改变 `/use` 加载 soul 后的 context assembly 逻辑

## Decisions

### D1: 新增反向查询函数

在 `src/world/binding.ts` 新增 `findSoulsBoundToWorld(worldName)`:
- 扫描 `~/.soulkiller/souls/*/bindings/<worldName>.json`
- 返回绑定了该 world 的 soul 名称列表
- 不走 `loadBindings`（那个只返回 enabled 的），直接检查文件是否存在

**理由**: checkbox 列表需要知道哪些 soul 已经绑定了这个 world，包括 disabled 的。

### D2: 重写 WorldBindCommand 为 checkbox 多选

新组件结构:
```
WorldBindCommand({ worldName, onComplete })
  ├── state: soulItems[] — { name, description, checked, wasBound }
  ├── cursor: number
  ├── useInput: ↑↓移动, Space 切换, Enter 确认, Esc 取消
  └── onSubmit:
        新勾选的 → bindWorld(soulDir, worldName, { order: 0 })
        取消勾选的 → unbindWorld(soulDir, worldName)
        不变的 → 不操作
```

**移除 `soulDir` 和 `action` props** — 组件自己通过 `getSoulsDir()` + soul name 计算 soulDir。不再区分 bind/unbind。

### D3: action menu 合并

`ACTION_ITEMS` 中:
- 删除 `unbind` 条目
- `bind` 条目改为"绑定管理"语义，移除 `needsSoul: true`

### D4: 空 soul 列表处理

如果本地没有任何 soul，显示提示信息并自动返回 action menu。

## Risks / Trade-offs

**[性能]** → 扫描所有 soul 的 bindings/ 目录可能在 soul 很多时稍慢。Mitigation: 本地 soul 数量预期在几十个以内，文件系统操作毫秒级。

**[信息丢失]** → unbind 操作（取消勾选）会删除 binding 文件，包括用户可能自定义过的 order/overrides。Mitigation: 这是预期行为——取消勾选就是"我不想要这个绑定了"。如果用户只是想 disable，那是另一个功能。
