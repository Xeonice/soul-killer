## Why

当前 Soul 的 6 维度模型（identity / quotes / expression / thoughts / behavior / relations）偏向人格描写，对虚构角色的能力系统和结构化时间线覆盖不足。经过 9 个案例（3 真实人物 + 6 虚构角色）的系统分析，发现两个维度缺口：

1. **capabilities 缺口**：角色的能力、技能、属性、装备、专业知识没有独立的搜索和蒸馏通道。以 Geralt 为例，法印/炼金/怪物学是他的核心特征，但完全不在 6 维度的覆盖范围内。对真实人物（张一鸣、马化腾），其专业方法论和产品决策框架同样缺失。
2. **milestones 缺口**：identity 虽然能捕获部分事件信息，但缺乏结构化时间线——事件间没有时序、因果关系和对角色状态的影响标注。这直接阻塞了 Era（时间切面）系统的实施，因为 Era 需要结构化时间线作为切分素材。

## What Changes

- 在 `soul-dimensions.ts` 中新增 `capabilities` 和 `milestones` 两个搜索维度（6 → 8 维度）
- 为两个新维度定义 `DIMENSION_SIGNALS`（覆盖度信号检测正则）
- 为三种 classification（DIGITAL_CONSTRUCT / PUBLIC_ENTITY / HISTORICAL_RECORD）定义差异化的搜索模板
- **Tag 感知搜索**：`generateSearchPlan` 接受 tags 参数，capabilities / milestones 的搜索模板基于 domain tags 动态扩展查询词（如骑士→"sword noble phantasm"，赛博佣兵→"cyberware hacking"），thoughts / behavior 可选追加 tag 相关查询
- 在 `distill-agent.ts` 中新增 `writeCapabilities` 和 `writeMilestones` 两个 tool
- 更新蒸馏 system prompt，新增 `capabilities.md` 和 `milestones.md` 的输出规范
- 更新 `reviewSoul` tool 读取新增文件
- 更新 `readSoulFiles()` 函数包含新文件
- 更新 `export/skill-template.ts` 的 SKILL.md 模板引用新文件
- 更新 `export/packager.ts` 复制新文件
- Soul 目录结构从 3 类文件扩展为 5 类

## Capabilities

### New Capabilities
- `soul-capabilities-dimension`: capabilities 搜索维度定义（信号/模板/蒸馏产出）
- `soul-milestones-dimension`: milestones 搜索维度定义（信号/模板/蒸馏产出）

### Modified Capabilities
- `soul-dimensions`: ALL_DIMENSIONS 从 6 扩展到 8，DIMENSIONS record 新增两项，generateSearchPlan 新增 tags 参数支持 tag 感知搜索
- `distill-agent`: system prompt 新增 capabilities.md / milestones.md 输出规范，新增 writeCapabilities / writeMilestones tool，reviewSoul 读取新文件
- `soul-package`: readSoulFiles 返回新增 capabilities / milestones 字段
- `cloud-skill-format`: SKILL.md 模板 Phase 1 新增读取 capabilities.md 和 milestones.md，Phase 2 新增引用规则

## Impact

- **修改文件**：`src/agent/soul-dimensions.ts`、`src/distill/distill-agent.ts`、`src/soul/package.ts`、`src/export/skill-template.ts`、`src/export/packager.ts`
- **Soul 目录结构变更**：新增 `soul/capabilities.md` 和 `soul/milestones.md`（向后兼容，旧 Soul 缺少这些文件时不影响加载）
- **测试更新**：dimensions 单元测试、distill-agent 相关测试、export 单元测试、readSoulFiles 测试
