## MODIFIED Requirements

### Requirement: Soul 打包包含 World 快照
系统在打包 soul 时 SHALL 检测绑定的世界，交互式让用户选择包含哪些世界，将选中世界的完整目录内联到包的 `worlds/` 下。Binding 配置保留在包的 `bindings/` 目录中。

#### Scenario: 打包时选择世界
- **WHEN** soul "johnny" 绑定了 "night-city" 和 "corpo-life"，用户执行 publish
- **THEN** 交互式列出两个世界供用户勾选，选中的世界内联到包中

#### Scenario: 无世界绑定时打包
- **WHEN** soul 没有绑定任何世界
- **THEN** 打包流程与现有行为一致，包中不含 worlds 目录

### Requirement: Soul 安装处理 World 冲突
安装 soul 包时，对于包中的每个世界：若本地不存在则直接安装到 `~/.soulkiller/worlds/`；若本地已存在则 SHALL 提示用户选择——保留本地版本（k）、替换为包内版本（r）、或安装为命名副本（n，格式 `<world>-<soul>`）。

#### Scenario: 安装新世界
- **WHEN** 包中含世界 "night-city"，本地不存在该世界
- **THEN** 安装到 `~/.soulkiller/worlds/night-city/`

#### Scenario: 世界已存在冲突
- **WHEN** 包中含世界 "night-city" v0.1.0，本地已有 "night-city" v0.2.0
- **THEN** 提示用户选择保留/替换/副本，显示两个版本号
