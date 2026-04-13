## 1. Choice History 基础

- [x] 1.1 创建 `src/export/state/history.ts`：readHistory / appendHistory / clearHistory / copyHistory 函数
- [x] 1.2 修改 `apply.ts`：runApply 成功后调用 appendHistory
- [x] 1.3 修改 `init.ts`：runInit 时创建空 history.log
- [x] 1.4 修改 `save.ts`：runSave 时复制 history.log 到 manual save 目录
- [x] 1.5 修改 `reset.ts`：runReset 时清空 history.log
- [x] 1.6 确认 `rebuild.ts` 无需改动（不碰 history.log）

## 2. Branch Tree Server

- [x] 2.1 创建 `src/export/state/tree.ts`：runTree 函数（检查/启动/复用 server 逻辑）
- [x] 2.2 创建 `src/export/state/tree-server.ts`：HTTP server 实现（Bun.serve + 路由 + fs.watch + SSE）
- [x] 2.3 创建 `src/export/state/tree-html.ts`：生成自包含 HTML 字符串的函数（从 demo 迁移，改为动态数据加载 + SSE）
- [x] 2.4 实现端口策略：默认 6677，EADDRINUSE 递增回退，写 server.json
- [x] 2.5 实现 server 复用：检查 server.json + pid 存活 → 复用或清理重启
- [x] 2.6 实现 POST /switch：切换监听的 scriptId，SSE 推送 switch 事件
- [x] 2.7 实现 state tree --stop：kill pid + 删 server.json
- [x] 2.8 实现 2 小时无连接自动退出

## 3. CLI 集成

- [x] 3.1 修改 `main.ts`：注册 `tree` 和 `tree --stop` 子命令
- [x] 3.2 packager 已自动扫描 state/ 下所有 .ts 文件，无需修改

## 4. SKILL.md 模板

- [x] 4.1 修改 `skill-template.ts`：Phase 2 场景转换规则增加 📊 分支树选项
- [x] 4.2 AskUserQuestion 选项追加"📊 View branch tree"+ 所有相关规则同步更新

## 5. 单元测试

- [x] 5.1 创建 `tests/unit/export/state/history.test.ts`：7 个用例全部通过
- [x] 5.2 tree 的 server 相关测试需要真实网络环境，由 6.1 端到端验证覆盖
- [x] 5.3 修改现有测试：apply.test.ts (+1) / reset-rebuild.test.ts (+1) / list-save.test.ts (+1) / main.test.ts (+1)
- [x] 5.4 在 state-fixture.ts 中添加 cyclicScript() fixture

## 6. 验证

- [x] 6.1 本地端到端：init → apply → state tree → /data 正确 → tree --stop 正常关闭
- [x] 6.2 确认 bun run test 全部通过（83 文件 945 用例）
- [x] 6.3 packager 自动扫描 state/*.ts，tree 相关文件自动包含
