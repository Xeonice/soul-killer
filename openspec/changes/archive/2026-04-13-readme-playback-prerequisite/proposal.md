## Why

skill-runtime-binary 改动后，导出的 `.skill` 文件运行时依赖 `soulkiller runtime` 命令而非独立的 bun + bash wrapper。三份 README（中/英/日）没有提到游玩方需要安装 soulkiller，也没有反映 Windows 原生支持。用户收到 `.skill` 文件后会因为找不到 `soulkiller` 命令而卡在 Phase -1。

## What Changes

- 三份 README（README.md / README.en.md / README.ja.md）的"怎么玩"段落补充：接收方也需要安装 soulkiller CLI（首次游玩时 Skill 会自动提示安装）
- 平台支持描述更新：Windows 从 "使用 PowerShell" 的暗示改为明确的全平台支持声明
- 安装命令和其他内容不变

## Capabilities

### New Capabilities

### Modified Capabilities

## Impact

- **修改文件**: `README.md`、`README.en.md`、`README.ja.md`
- **不改**: 安装脚本、构建脚本、源码
