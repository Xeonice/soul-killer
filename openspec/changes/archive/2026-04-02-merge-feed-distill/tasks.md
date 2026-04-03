## 1. 命令注册与 i18n

- [x] 1.1 在 `command-registry.ts` 中移除 `feed` 和 `distill` 模板，新增 `evolve` 模板（`cmd.evolve`, `cmd.group.create`）
- [x] 1.2 在 i18n 语言文件中新增 `cmd.evolve` 键（中英文），移除 `cmd.feed` 和 `cmd.distill`

## 2. 参数补全注册

- [x] 2.1 在 `app.tsx` 的 `ARG_COMPLETION_MAP` 中为 `evolve` 注册条目，provider 复用 `listLocalSouls()`，title 为 `'SOULS'`

## 3. EvolveCommand 组件

- [x] 3.1 创建 `src/cli/commands/evolve.tsx`，包含三阶段状态机：`path-input` → `feeding` → `distilling`
- [x] 3.2 阶段一：路径输入，使用 `TextInput` 的 `pathCompletion` 模式获取数据源路径
- [x] 3.3 阶段二：调用 ingest pipeline 执行 feed，显示进度
- [x] 3.4 阶段三：feed 完成后自动执行 distill，显示蒸馏进度
- [x] 3.5 完成后回调 `onComplete` 退出 interactiveMode
- [x] 3.6 各阶段支持 Escape 退出，调用 `onExit` 回调

## 4. app.tsx 路由集成

- [x] 4.1 移除 `case 'feed'` 和 `case 'distill'` 分支
- [x] 4.2 新增 `case 'evolve'` 分支：校验参数存在性、校验 soul 名称是否在 `listLocalSouls()` 中
- [x] 4.3 soul 不存在时设置 error（severity: warning, title: "SOUL NOT FOUND"），suggestions 包含 `/list`
- [x] 4.4 soul 存在时加载 soul 上下文（soulDir、engine），进入 interactiveMode 渲染 `<EvolveCommand />`

## 5. 测试更新

- [x] 5.1 更新涉及 feed/distill 命令的单元测试，改为测试 evolve 命令
- [x] 5.2 为 evolve 补全添加测试：验证 `/evolve ` 触发 soul 列表补全
- [x] 5.3 为 evolve 的 soul 不存在场景添加测试：验证错误提示和状态回退
- [x] 5.4 为 EvolveCommand 组件添加组件测试：验证三阶段流转
