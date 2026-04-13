## 1. 清理 barrel hack

- [x] 1.1 删除 `src/export/state/viewer-bundle.ts`
- [x] 1.2 `.gitignore` 已无 viewer-bundle 条目
- [x] 1.3 `viewer-server.ts` 完全重写：从 `~/.soulkiller/viewer/` 磁盘 serve（Bun.file），production/dev 双模式

## 2. viewer-server 改为 detached 进程

- [x] 2.1 `viewer-server.ts` 重构为独立进程入口：`import.meta.main` + env vars 控制模式
- [x] 2.2 `main.ts` viewer 子命令 spawn detached viewer-server 进程
- [x] 2.3 `tree` 子命令保持不变（tree.ts 已指向 viewer）

## 3. build.ts 适配

- [x] 3.1 删除 Phase 0.5（barrel 生成逻辑）
- [x] 3.2 Phase 3 改为将 viewer dist 作为 viewer/ 目录打进 tar.gz 和 zip 归档

## 4. 安装脚本适配

- [x] 4.1 `install.sh` 改为解压到临时目录，分别安装 binary 和 viewer/
- [x] 4.2 `install.ps1` 同上适配 Windows 路径

## 5. updater 适配

- [x] 5.1 `updater.ts` 解压归档后，替换二进制 + viewer/ 目录

## 6. 验证

- [x] 6.1 全量测试通过（89 文件 1008 测试）
- [x] 6.2 开发模式（vite dev + API）和生产模式（磁盘 serve + API）均验证通过
