## MODIFIED Requirements

### Requirement: Skill 目录结构支持多 Soul
导出的 Skill 目录 SHALL 使用 `souls/{name}/` 结构存放多个 soul。

#### Scenario: 多 Soul 目录结构
- **WHEN** 导出包含 N 个 soul
- **THEN** 目录结构 SHALL 为：
  ```
  skill-dir/
    souls/{soul-name-1}/identity.md, style.md, capabilities.md, milestones.md, behaviors/
    souls/{soul-name-2}/...
    world/world.json, entries/
    story-spec.md
    SKILL.md
  ```

#### Scenario: 单 Soul 也用 souls/ 结构
- **WHEN** 导出只有 1 个 soul
- **THEN** SHALL 同样使用 `souls/{name}/` 目录结构（不使用旧的 `soul/` 扁平结构）

### Requirement: SKILL.md 引擎多角色调度
SKILL.md SHALL 包含多角色故事引擎的完整规则。

#### Scenario: Phase 1 多角色剧本生成
- **WHEN** 引擎进入 Phase 1
- **THEN** SHALL 读取 `souls/` 下所有 soul 目录的完整文件
- **AND** SHALL 按 story-spec.md 的 characters 定义生成多角色剧本

#### Scenario: Phase 2 多角色场景运行
- **WHEN** 引擎运行场景
- **THEN** SHALL 按场景 cast 表调度在场角色
- **AND** 每个角色的对话 SHALL 遵循对应 `souls/{name}/style.md`
- **AND** 用户选择后 SHALL 更新 per-character affinity 状态

#### Scenario: Phase 3 结局图鉴
- **WHEN** 故事到达结局
- **THEN** SHALL 展示结局演绎 + 旅程回顾 + 所有结局预览
- **AND** 旅程回顾 SHALL 按角色分组展示好感轴进度条
