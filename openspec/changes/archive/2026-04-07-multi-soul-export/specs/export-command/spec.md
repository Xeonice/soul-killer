## MODIFIED Requirements

### Requirement: Export 命令适配多 Soul
export 命令的 UI SHALL 适配多 Soul 导出流程。

#### Scenario: 进度展示
- **WHEN** export agent 正在扫描和分析
- **THEN** SHALL 展示当前阶段（扫描/分析/编排/打包）
- **AND** SHALL 展示识别到的角色数量和世界名称

#### Scenario: 完成展示
- **WHEN** export 完成
- **THEN** SHALL 展示导出的 soul 列表、world 名称、输出路径、文件数
- **AND** SHALL 展示角色编排摘要（role + 好感轴）
