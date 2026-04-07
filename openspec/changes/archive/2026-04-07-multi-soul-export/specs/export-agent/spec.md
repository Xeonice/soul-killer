## MODIFIED Requirements

### Requirement: Export agent 全自动多 Soul 流程
export agent SHALL 以全自动模式运行，自动选择角色组合并推导编排方案。

#### Scenario: 全自动正常路径
- **WHEN** 用户触发 export
- **THEN** agent SHALL 依次执行：list_souls → list_worlds → 分析 bindings → 自动选择 world 和 souls → read_soul × N + read_world → 内部推导角色关系/编排/基调 → package_skill
- **AND** 正常路径 SHALL 零用户交互

#### Scenario: 自动选择 world
- **WHEN** 只有 1 个 world
- **THEN** SHALL 直接使用
- **WHEN** 多个 world
- **THEN** SHALL 选绑定 soul 最多的
- **WHEN** 多个 world 绑定数相同
- **THEN** SHALL fallback 到 ask_user 让用户选择

#### Scenario: 自动选择 souls
- **WHEN** world 确定后
- **THEN** SHALL 纳入所有绑定到该 world 且有完整 distill 产物的 souls
- **AND** 数量超过 4 个时选产物最完整的前 4 个

#### Scenario: 角色关系推导
- **WHEN** agent 读取了 N 个 soul 的完整数据
- **THEN** SHALL 从 relationships.md + identity.md + milestones.md 交叉匹配角色关系
- **AND** SHALL 为每个角色推导 role（protagonist/deuteragonist/antagonist/supporting）
- **AND** SHALL 为每个角色设计 2-3 个好感轴（轴名反映角色人格特征）
- **AND** SHALL 推导出场时机和叙事张力点

#### Scenario: 无关系数据时创意补全
- **WHEN** 两个角色的 relationships.md 中互无提及
- **THEN** agent SHALL 基于角色人格、世界观和时代背景创意推导可能的关系
- **AND** SHALL 在 agent log 中标注为"推导关系"而非"提取关系"

#### Scenario: 跨世界角色组合
- **WHEN** 选中的 souls 绑定了不同的 world
- **THEN** SHALL fallback 到 ask_user 提示跨世界组合暂不支持全自动
- **AND** SHALL 建议用户手动选择同一世界的角色

#### Scenario: 异常 fallback
- **WHEN** 0 个 soul 或 0 个 world
- **THEN** SHALL 通过 ask_user 告知用户需要先创建

### Requirement: package_skill 多 Soul 支持
package_skill tool SHALL 接收多个 soul 及角色编排配置。

#### Scenario: package_skill 输入参数
- **WHEN** agent 调用 package_skill
- **THEN** SHALL 传入 `souls[]`（每个含 name/role/axes/appears_from）、`world_name`、`story_spec`
- **AND** story_spec SHALL 包含 characters 数组

#### Scenario: 输出目录
- **WHEN** 未指定 output_dir
- **THEN** SHALL 使用默认目录 `~/.soulkiller/exports/`
