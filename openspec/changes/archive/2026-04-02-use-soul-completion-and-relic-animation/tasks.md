## 1. Soul Resolver

- [x] 1.1 创建 `src/cli/soul-resolver.ts`

## 2. CommandPalette 标题可配置

- [x] 2.1 CommandPalette 新增 `title` 和 `showSlash` props

## 3. 命令参数补全

- [x] 3.1 TextInput 新增 `argCompletionMap` prop
- [x] 3.2 补全逻辑：`/command ` 后检查 argCompletionMap，获取候选，前缀过滤
- [x] 3.3 Tab/Enter 行为：填入 `/command argName`
- [x] 3.4 参数补全渲染 CommandPalette with custom title

## 4. Relic Load Animation

- [x] 4.1 创建 `src/cli/animation/relic-load-animation.tsx`
- [x] 4.2 Phase 1：neural link glitch
- [x] 4.3 Phase 2：heartbeat activation + RELIC STATUS 进度条
- [x] 4.4 Phase 3：soul info 展示
- [x] 4.5 Phase 4：tagline + onComplete

## 5. /use 命令改造

- [x] 5.1 use.tsx 播放 RelicLoadAnimation
- [x] 5.2 App 中 /use 已设置 interactiveMode: true

## 6. App 集成

- [x] 6.1 App 创建 ARG_COMPLETION_MAP（use → listLocalSouls），传给 TextInput

## 7. 测试

- [x] 7.1 单元测试：soul-resolver（temp dir fixtures）
- [x] 7.2 组件快照测试：RelicLoadAnimation
- [x] 7.3 组件快照测试：CommandPalette 自定义 title（已有测试覆盖）
- [x] 7.4 回归：141 个测试全部通过
