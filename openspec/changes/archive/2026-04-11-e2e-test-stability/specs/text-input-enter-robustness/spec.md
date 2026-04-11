## ADDED Requirements

### Requirement: Enter fallthrough when palette selection is undefined

当 command/arg/path palette 处于打开状态但 `selectedIndex` 对应的项为 `undefined` 时，Enter 键 SHALL fallthrough 到普通提交路径（提交当前 `value` 原文），而不是被静默吞掉。

#### Scenario: cmd palette open but selectedIndex out of bounds
- **WHEN** 用户输入 `/list`，cmd palette 打开且 `filteredCommands` 有结果，但 `selectedIndex` 因 React 渲染时序指向了 undefined 位置
- **THEN** Enter 键 SHALL 将当前 `value`（即 `/list`）通过 `onSubmit` 提交，而不是静默 return

#### Scenario: cmd palette open with empty filter results
- **WHEN** 用户输入了以 `/` 开头的文本但 `filteredCommands` 为空（无匹配命令），且 `showCmdPalette` 因状态延迟仍为 true
- **THEN** Enter 键 SHALL fallthrough 到普通提交路径，提交当前 `value` 原文

#### Scenario: arg palette open but selected arg is undefined
- **WHEN** 用户输入 `/use bob`，arg palette 打开但 `argCompletion.items[selectedIndex]` 为 undefined
- **THEN** Enter 键 SHALL fallthrough 到普通提交路径，提交完整的 `/use bob`

#### Scenario: path palette open but selected path is undefined
- **WHEN** path palette 打开但 `pathItems[selectedIndex]` 为 undefined
- **THEN** Enter 键 SHALL fallthrough 到普通提交路径，提交当前 `value`

### Requirement: Normal palette selection behavior unchanged

当 palette 处于打开状态且 `selectedIndex` 指向有效项时，Enter 键的行为 SHALL 保持不变（提交选中项的 name）。

#### Scenario: cmd palette normal selection
- **WHEN** 用户输入 `/cr`，cmd palette 显示 `/create` 为选中项（selectedIndex=0 有效）
- **THEN** Enter 键 SHALL 提交 `/create`（即 `/${selected.name}`），行为与当前一致
