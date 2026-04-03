## 1. 移除 /publish 和 /link

- [x] 1.1 从 `command-registry.ts` 移除 `publish` 和 `link` 模板
- [x] 1.2 从 i18n 语言文件（en/zh/ja）移除 `cmd.publish` 和 `cmd.link` 键
- [x] 1.3 从 `app.tsx` 移除 `case 'publish'` 和 `case 'link'` 分支，以及 `PublishCommand` 和 `LinkCommand` 的 import
- [x] 1.4 删除 `src/cli/commands/publish.tsx` 和 `src/cli/commands/link.tsx`

## 2. 增强 /use 校验

- [x] 2.1 在 `app.tsx` 的 `case 'use'` 中，于进入 interactiveMode 前调用 `listLocalSouls()` 校验 soul 名称存在性
- [x] 2.2 soul 不存在时设置 error（severity: warning, title: "SOUL NOT FOUND"），suggestions 包含 `/list`，保持 idle 状态

## 3. 测试更新

- [x] 3.1 更新 `help.test.tsx`：移除对 `/publish` 和 `/link` 的断言
- [x] 3.2 更新 `command-palette.test.tsx`：如有 publish/link 相关测试数据，替换为其他命令
- [x] 3.3 更新快照（`--update`）
- [x] 3.4 运行全量测试确认通过
