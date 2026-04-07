## 1. 数据包格式基础

- [x] 1.1 创建 `src/pack/meta.ts` — PackMeta 接口定义、format_version 常量、createMeta / parseMeta / validateVersion 函数
- [x] 1.2 创建 `src/pack/checksum.ts` — 基于文件列表计算 SHA-256 校验和、验证校验和

## 2. 打包核心

- [x] 2.1 创建 `src/pack/packer.ts` — `packSoul(soulName, options)` 函数：收集 soul 文件（排除 vectors/、examples/、snapshots/）、收集绑定 world 文件、生成 pack-meta.json、调用 tar 创建 .soul.pack
- [x] 2.2 在 packer.ts 中实现 `packWorld(worldName, options)` — 收集 world 文件、生成 pack-meta.json、创建 .world.pack
- [x] 2.3 实现 `--with-snapshots` 支持：当标志启用时将 snapshots/ 目录加入打包列表
- [x] 2.4 实现 `--output <path>` 支持：指定输出目录，默认为 `process.cwd()`

## 3. 解包核心

- [x] 3.1 创建 `src/pack/unpacker.ts` — `unpackFile(filePath)` 函数：解压到临时目录、读取 pack-meta.json、验证 format_version、验证 checksum
- [x] 3.2 实现 soul 解包逻辑：将 soul/ 写入 `~/.soulkiller/souls/<name>/`、创建缺失的 vectors/ 和 examples/ 目录
- [x] 3.3 实现 world 解包逻辑：将 world/ 写入 `~/.soulkiller/worlds/<name>/`
- [x] 3.4 实现捆绑 world 解包：遍历 worlds/ 目录中的每个 world 逐一解包
- [x] 3.5 实现冲突检测：检查本地是否已存在同名 soul/world，返回冲突列表

## 4. 冲突解决交互

- [x] 4.1 创建冲突解决 UI 组件：显示冲突项，提供覆盖 / 重命名 / 跳过三个选项
- [x] 4.2 实现重命名逻辑：自动建议 `<name>-2`（递增直到不冲突），更新重命名后 world 的 binding 引用
- [x] 4.3 实现覆盖逻辑：删除本地目录后写入新数据

## 5. CLI 命令

- [x] 5.1 创建 `src/cli/commands/pack.tsx` — `/pack soul <name>` 和 `/pack world <name>` 命令组件，显示打包进度和结果
- [x] 5.2 创建 `src/cli/commands/unpack.tsx` — `/unpack <path>` 命令组件，集成冲突解决交互，显示解包摘要
- [x] 5.3 在 `src/cli/command-registry.ts` 注册 pack 和 unpack 命令
- [x] 5.4 在 `src/cli/app.tsx` 的 handleInput 中添加 pack/unpack 命令路由
- [x] 5.5 添加 i18n 键：pack/unpack 相关的所有用户可见文本（zh/en/ja）

## 6. 参数补全

- [x] 6.1 为 `/pack` 添加 argCompletionMap：第一级补全 `soul` / `world`，第二级补全对应的名称列表
- [x] 6.2 为 `/unpack` 添加 pathCompletion（主 TextInput 暂不支持混合 slash+path 补全，MVP 阶段用户手动输入路径）：过滤 `.soul.pack` 和 `.world.pack` 文件

## 7. 测试

- [x] 7.1 单元测试 `tests/unit/pack-meta.test.ts` — meta 创建、解析、版本校验
- [x] 7.2 单元测试 `tests/unit/checksum.test.ts` — 校验和计算与验证
- [x] 7.3 组件测试 `tests/component/pack-command.test.tsx` — pack/unpack 命令 UI 渲染
- [x] 7.4 集成测试 `tests/integration/pack-unpack.test.ts` — 完整的打包→解包→验证流程，包括冲突解决场景
