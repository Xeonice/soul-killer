## ADDED Requirements

### Requirement: Skill 产物为 .skill 归档文件
导出 skill 时，packageSkill SHALL 输出单一 `.skill` 后缀的 zip 归档文件，而非展开的目录。

#### Scenario: 输出文件命名
- **WHEN** 生成 skill 文件
- **THEN** 文件名 SHALL 为 `<kebab(storyName)>-in-<kebab(worldName)>.skill`
- **AND** SHALL 不包含 `soulkiller:` 前缀
- **AND** kebab-case 转换 SHALL 保留中日韩 unicode 字符

#### Scenario: 归档内部结构
- **WHEN** 解压 `.skill` 文件
- **THEN** 解压结果 SHALL 直接释放为以下结构（不嵌套额外的根目录）：
  - `SKILL.md`
  - `story-spec.md`
  - `souls/<soul-name>/identity.md`
  - `souls/<soul-name>/style.md`
  - `souls/<soul-name>/capabilities.md`（如存在）
  - `souls/<soul-name>/milestones.md`（如存在）
  - `souls/<soul-name>/behaviors/*.md`
  - `world/world.json`
  - `world/entries/*.md`

#### Scenario: 不再产出展开目录
- **WHEN** packageSkill 完成
- **THEN** 输出位置 SHALL **只有** `.skill` 文件
- **AND** SHALL 不创建任何同名展开目录
- **AND** SHALL 不创建任何临时目录残留

### Requirement: SKILL.md frontmatter name 不带前缀
SKILL.md 的 YAML frontmatter `name` 字段 SHALL 与归档文件名（去掉 `.skill` 后缀）一致，不包含 `soulkiller:` 协议前缀。

#### Scenario: name 字段内容
- **WHEN** 生成 SKILL.md
- **THEN** frontmatter `name` SHALL 等于 `<kebab(storyName)>-in-<kebab(worldName)>`
- **AND** SHALL 不包含 `soulkiller:` 前缀

## MODIFIED Requirements

### Requirement: Skill 目录结构支持多 Soul
Cloud Skill 导出 SHALL 以故事名（而非单个角色名）作为 skill 身份，并以 `.skill` 归档文件形式产出。

#### Scenario: 命名基于故事名
- **WHEN** 导出 skill
- **THEN** skill 文件名 SHALL 为 `<kebab(storyName)>-in-<kebab(worldName)>.skill`
- **AND** 命名 SHALL 不依赖任何单一角色名
- **AND** kebab-case 转换 SHALL 保留中日韩 unicode 字符

#### Scenario: 多 Soul 子目录布局（归档内部）
- **WHEN** 导出多角色 skill
- **THEN** 归档内部 SHALL 包含 `souls/` 子目录
- **AND** 每个 soul 放在 `souls/<soul-name>/` 下，含 identity.md / style.md / capabilities.md / milestones.md / behaviors/
- **AND** world 放在 `world/` 子目录

#### Scenario: SKILL.md description 使用故事名
- **WHEN** 生成 SKILL.md frontmatter
- **THEN** description 字段 SHALL 使用 storyName 而非某个角色名
- **AND** SHALL 类似 "{storyName} — 在{worldDisplayName}中的视觉小说"

## REMOVED Requirements

### Requirement: 以 soulkiller: 协议前缀命名 skill 目录

**Reason**: `soulkiller:` 前缀违反 Anthropic Skill 命名规范，且 `:` 在文件路径和 YAML 中是特殊字符容易引发歧义。同时旧的目录形态被 `.skill` 归档文件替代。

**Migration**:
- 旧目录格式: `soulkiller:<storyName>-in-<world>/`（含展开文件）
- 新归档格式: `<storyName>-in-<world>.skill`（zip 归档）
- 旧的归档目录如已分发，建议重新 export 生成新格式
- SKILL.md frontmatter `name` 字段同步去掉 `soulkiller:` 前缀
