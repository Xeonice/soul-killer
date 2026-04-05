## ADDED Requirements

### Requirement: Binding 数据结构
系统 SHALL 定义 `WorldBinding` 接口，包含：`world`（世界名）、`enabled`（boolean）、`order`（number，越小越优先，0 = 最高）、`overrides`（可选，含 `context_budget` 和 `injection_position`）、`entry_filter`（可选，含 `include_scopes`、`exclude_entries`、`priority_boost`）、`persona_context`（可选，Mustache 模板字符串）。

#### Scenario: 创建默认绑定
- **WHEN** 将 soul "johnny" 绑定到世界 "night-city" 且不提供额外配置
- **THEN** 创建 binding 文件，enabled 为 true，order 为 0，无 overrides、entry_filter 和 persona_context

### Requirement: Binding 存储位置
Binding SHALL 存储在 `~/.soulkiller/souls/<soul-name>/bindings/<world-name>.json`。

#### Scenario: 绑定文件位置
- **WHEN** soul "johnny" 绑定到世界 "night-city"
- **THEN** 创建文件 `~/.soulkiller/souls/johnny/bindings/night-city.json`

### Requirement: Binding CRUD 操作
系统 SHALL 提供 `bindWorld`、`unbindWorld`、`loadBindings`、`updateBinding` 函数。`unbindWorld` SHALL 删除对应的 binding 文件。

#### Scenario: 绑定世界
- **WHEN** 调用 `bindWorld("johnny", "night-city", { order: 0 })`
- **THEN** 在 johnny 的 bindings 目录写入 night-city.json

#### Scenario: 解绑世界
- **WHEN** 调用 `unbindWorld("johnny", "night-city")`
- **THEN** 删除 `bindings/night-city.json` 文件

#### Scenario: 加载所有绑定
- **WHEN** soul "johnny" 有 2 个 binding 文件
- **THEN** `loadBindings("johnny")` 返回 2 个 WorldBinding 对象，按 order 升序排列

### Requirement: N:M 关联
一个 Soul SHALL 能绑定多个 World，一个 World SHALL 能被多个 Soul 绑定。绑定关系仅存在于 Soul 侧。

#### Scenario: 多 Soul 绑定同一世界
- **WHEN** soul "johnny" 和 soul "v" 都绑定到世界 "night-city"
- **THEN** 两个 soul 各自的 bindings 目录下都有 `night-city.json`，互不影响

### Requirement: 绑定世界存在性校验
`bindWorld` SHALL 验证目标世界存在于 `~/.soulkiller/worlds/` 中。若世界不存在 SHALL 抛出错误。

#### Scenario: 绑定不存在的世界
- **WHEN** 调用 `bindWorld("johnny", "nonexistent")`
- **THEN** 抛出错误，提示世界 "nonexistent" 不存在
