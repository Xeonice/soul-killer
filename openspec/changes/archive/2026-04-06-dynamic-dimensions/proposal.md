## Why

三国创建时 factions/systems/species/atmosphere 四个维度反复不达标——不是搜索不够（缓存有数据），而是 base 维度的 qualityCriteria 不适配三国主题。species（族群）对三国几乎无意义，atmosphere（氛围）搜不到文学分析类文章。但因为"base 维度不可删除"的硬约束，补搜 3 轮也无法达标。

根因：维度是半静态的（base 固定 + extension 动态），但不同主题需要的维度集合差异巨大。base 维度应该只是参考模版，不是强制清单。Planning Agent 应该基于模版输出完全动态的维度列表——可以选用、裁剪、合并、新增，不受"不可删除"约束。

## What Changes

- base 维度从"必须保留"改为"参考模版"——Planning Agent 可以不选用不适合的维度
- DimensionDef.source 从 'base'|'extension' 简化为统一的 'planned'
- Planning Agent prompt 从"base 不可删除 + 可增加 extension"改为"从模版中选择适合的 + 自由增删"
- validate 逻辑去掉"base 维度未被删除"的校验
- SOUL_BASE_DIMENSIONS / WORLD_BASE_DIMENSIONS 改名为 DIMENSION_TEMPLATES，语义从"基础维度"变为"维度模版"

## Capabilities

### Modified Capabilities
- `planning-agent`: prompt 和校验逻辑改为全动态
- `dimension-framework`: DimensionDef.source 简化，模版角色明确

## Impact

- 修改 `src/agent/planning/dimension-framework.ts` — DimensionSource 简化
- 修改 `src/agent/planning/planning-agent.ts` — prompt 改为全动态，移除 base 删除校验
- 修改 `src/agent/strategy/soul-dimensions.ts` — SOUL_BASE_DIMENSIONS → SOUL_DIMENSION_TEMPLATES
- 修改 `src/agent/strategy/world-dimensions.ts` — WORLD_BASE_DIMENSIONS → WORLD_DIMENSION_TEMPLATES
- 更新所有引用 source='base'|'extension' 的代码
