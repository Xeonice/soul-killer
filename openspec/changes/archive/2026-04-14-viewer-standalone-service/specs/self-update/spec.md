## MODIFIED Requirements

### Requirement: 更新时同步更新 viewer 目录

`soulkiller --update` SHALL 在替换二进制的同时，将归档中的 `viewer/` 目录解压覆盖到 `~/.soulkiller/viewer/`。

#### Scenario: 更新包含 viewer

- **WHEN** 下载并解压新版本归档
- **THEN** SHALL 替换 `~/.soulkiller/bin/soulkiller` 和 `~/.soulkiller/viewer/` 两部分
