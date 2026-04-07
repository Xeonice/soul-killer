## MODIFIED Requirements

### Requirement: Skill 目录结构支持多 Soul
Cloud Skill 导出目录 SHALL 以故事名（而非单个角色名）作为 skill 身份。

#### Scenario: 目录命名基于故事名
- **WHEN** 导出 skill
- **THEN** skill 目录名 SHALL 为 `soulkiller:<kebab(storyName)>-in-<kebab(worldName)>`
- **AND** 目录命名 SHALL 不依赖任何单一角色名
- **AND** kebab-case 转换 SHALL 保留中日韩 unicode 字符

#### Scenario: 多 Soul 子目录布局
- **WHEN** 导出多角色 skill
- **THEN** skill 根目录 SHALL 包含 `souls/` 子目录
- **AND** 每个 soul 放在 `souls/<soul-name>/` 下，含 identity.md / style.md / capabilities.md / milestones.md / behaviors/
- **AND** world 放在 `world/` 子目录

#### Scenario: SKILL.md description 使用故事名
- **WHEN** 生成 SKILL.md frontmatter
- **THEN** description 字段 SHALL 使用 storyName 而非某个角色名
- **AND** SHALL 类似 "视觉小说 — {storyName}（{worldDisplayName}）"

## REMOVED Requirements

### Requirement: 以 protagonist 角色命名 skill 目录

**Reason**: 多角色场景下选单个角色作为 skill 身份是武断的——4 个角色选谁都不合理。改为用户提供的"故事名"作为身份。

**Migration**: 
- 旧命名格式: `soulkiller:<protagonist>-in-<world>`
- 新命名格式: `soulkiller:<story-name>-in-<world>`
- `getSkillDirName(protagonistName, worldName)` → `getSkillDirName(storyName, worldName)`
- 旧 export 的目录名保留不变（归档中），但不要依赖这个格式生成新的 skill
