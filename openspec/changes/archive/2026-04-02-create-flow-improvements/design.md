## Context

当前 create 流程的路径输入是纯文本，用户需要精确输入路径。终端里拖拽文件夹可以粘贴路径，但手动输入很痛苦。同时 create 是多步交互式流程，一旦启动无法退出。

## Goals / Non-Goals

**Goals:**
- 路径输入时实时文件系统补全（类似 Claude Code 的 @ 模式）
- `~` 自动展开为 home 目录
- 目录和文件视觉区分（目录 cyan + `/` 后缀，文件 dim）
- Tab 选中目录时展开下一级，选中文件时填入完整路径
- create 流程所有输入步骤（name, bio, sources, source-path）支持 Esc 退出
- ingesting/distilling 阶段 Esc 退出，保留已有数据

**Non-Goals:**
- 通配符匹配（`*.md`）
- 多选文件
- 远程路径补全

## Decisions

### D1: PathPalette 组件 — 复用 CommandPalette 结构

与 CommandPalette 结构相同（列表 + 选中高亮 + 滚动），数据源从 `COMMANDS` 变为 `fs.readdirSync()`。

```typescript
interface PathItem {
  name: string       // 文件/目录名
  fullPath: string   // 完整路径
  isDirectory: boolean
}
```

过滤逻辑：
1. 解析当前输入，拆分为 `parentDir` + `prefix`
2. `fs.readdirSync(parentDir)` 列出内容
3. 前缀匹配 `prefix` 过滤
4. 限制最多显示 8 项

### D2: Tab 行为 — 目录展开 vs 文件确认

```
选中目录: Tab → 填入 "parentDir/dirName/"，触发新一轮补全
选中文件: Tab → 填入 "parentDir/fileName"，关闭补全
Enter:    填入选中项，提交路径
```

### D3: ~ 展开

输入 `~` 或 `~/` 时，展开为 `os.homedir()`。展开发生在 fs 查询层，显示层仍然保留 `~` 前缀以节省空间。

### D4: TextInput 扩展 — pathCompletion prop

```typescript
interface TextInputProps {
  // 现有 props...
  completionItems?: CommandDef[]     // 命令补全（已有）
  pathCompletion?: boolean           // 新增：路径补全模式
  onEscape?: () => void              // 新增：Esc 回调
}
```

当 `pathCompletion` 为 true 时，输入变化时触发文件系统查询并渲染 PathPalette。与 `completionItems` 互斥——一个 TextInput 要么做命令补全，要么做路径补全。

### D5: Esc 退出 create 流程

CreateCommand 新增 `onCancel` prop。在每个输入步骤中，TextInput 的 `onEscape` 被连接到 create 的退出逻辑：

```
输入阶段（name, bio, sources, source-path）:
  Esc → 调用 onCancel() → 无副作用退出

处理阶段（ingesting, distilling）:
  Esc → 调用 onCancel() → 保留已创建的 soul 目录和已导入数据
  用户后续可用 /distill 补完
```

App 端处理 onCancel：
- `interactiveMode: false`
- `commandOutput: null`

### D6: Esc 优先级

TextInput 中 Esc 的处理优先级：
1. 如果命令补全列表打开 → 关闭列表（已有行为）
2. 如果路径补全列表打开 → 关闭列表
3. 否则 → 调用 `onEscape`（退出 create 等）

## Risks / Trade-offs

### R1: 大目录性能
- **风险**: home 目录可能有数百个条目，`readdirSync` 可能阻塞
- **缓解**: 限制最多读取前 100 个条目，过滤后最多显示 8 个

### R2: 权限错误
- **风险**: 用户输入的路径可能没有读取权限
- **缓解**: `readdirSync` 用 try-catch 包裹，出错时静默不显示补全列表
