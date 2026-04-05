# Acceptance DSL

## ADDED Requirements

### Requirement: Acceptance Block 嵌入格式

Spec.md 文件中的 `#### Scenario` 下方 SHALL 支持 ` ```acceptance ` fenced block，内容为合法 YAML，定义该场景的可执行验收步骤。acceptance block 是可选的，缺少时不影响现有 spec 流程。

#### Scenario: Spec 包含合法 acceptance block

- **WHEN** spec.md 中某个 Scenario 下有 ` ```acceptance ` block
- **THEN** parser SHALL 提取该 block 并解析为 AcceptanceScenario 对象
- **AND** 该对象 SHALL 包含场景名称（从 `#### Scenario: <name>` 提取）、环境声明和步骤列表

#### Scenario: Spec 不包含 acceptance block

- **WHEN** spec.md 中某个 Scenario 没有 acceptance block
- **THEN** parser SHALL 跳过该 Scenario，不报错
- **AND** verify 输出中 SHALL 标记该 Scenario 为 "no acceptance defined"

#### Scenario: Acceptance block 包含非法 YAML

- **WHEN** acceptance block 内容不是合法 YAML 或缺少必需字段（steps）
- **THEN** parser SHALL 报告 PARSE_ERROR 并标明 spec 文件路径和行号
- **AND** 不 SHALL 静默跳过

### Requirement: 环境声明

Acceptance block 的顶层 SHALL 支持以下环境声明字段，所有字段均为可选：

- `fixture`: 预置环境类型，取值为 `void`（默认）、`bare-soul`、`distilled-soul`、`evolved-soul`
- `soul-name`: fixture 使用的 soul 名称，默认 `"test-soul"`
- `persona`: 覆盖 fixture 默认 persona，含 `identity`、`style`、`behaviors` 子字段
- `mock-llm`: MockLLMServer 配置。设为 `true` 使用默认配置，或提供 `response` 字段自定义回复文本
- `env`: 额外环境变量的 key-value 映射
- `timeout`: 全局超时，格式为数字（毫秒）或带单位字符串（如 `30s`、`2m`），默认 `30s`

#### Scenario: 使用 distilled-soul fixture 和 mock-llm

- **WHEN** acceptance block 声明 `fixture: distilled-soul`、`soul-name: johnny`、`mock-llm: { response: "I am Johnny." }`
- **THEN** runner SHALL 调用 `createDistilledSoul(homeDir, "johnny")` 创建预置环境
- **AND** SHALL 启动 MockLLMServer 并设置 responseText 为 "I am Johnny."
- **AND** SHALL 将 mock server URL 传入 TestTerminal

#### Scenario: 使用默认环境

- **WHEN** acceptance block 没有声明任何环境字段
- **THEN** runner SHALL 使用 `void` fixture（仅 config.yaml）
- **AND** 不 SHALL 启动 MockLLMServer
- **AND** 全局超时 SHALL 为 30 秒

### Requirement: 交互指令

Steps 列表 SHALL 支持以下交互指令：

- `send: <text>` — 发送文本并追加 Enter 键
- `send-key: <key>` — 发送特殊键，支持 `tab`、`enter`、`up`、`down`、`escape`、`backspace`
- `send-raw: <text>` — 发送文本但不追加 Enter 键
- `wait: <pattern>` — 等待终端输出匹配正则表达式（since: last）
- `wait-prompt:` — 等待 `soul://xxx>` 提示符出现
- `wait-exit: <code>` — 等待进程退出并断言退出码
- `sleep: <ms>` — 硬等待指定毫秒数

#### Scenario: send 发送文本并回车

- **WHEN** 步骤为 `send: "/use johnny"`
- **THEN** runner SHALL 调用 `terminal.send("/use johnny")`，该方法逐字符写入并追加 `\r`

#### Scenario: send-key 发送特殊键

- **WHEN** 步骤为 `send-key: tab`
- **THEN** runner SHALL 调用 `terminal.sendKey("tab")`，发送 `\t` 字符

#### Scenario: send-raw 不追加回车

- **WHEN** 步骤为 `send-raw: "/cr"`
- **THEN** runner SHALL 逐字符写入 "/cr" 但不追加 `\r`

#### Scenario: wait 等待正则匹配

- **WHEN** 步骤为 `wait: "soul://johnny"`
- **THEN** runner SHALL 调用 `terminal.waitFor(/soul:\/\/johnny/, { since: 'last' })`
- **AND** 如果在超时时间内未匹配，SHALL 抛出 WaitForTimeout 错误

#### Scenario: wait-prompt 等待提示符

- **WHEN** 步骤为 `wait-prompt:`
- **THEN** runner SHALL 调用 `terminal.waitForPrompt()`

#### Scenario: wait-exit 等待退出

- **WHEN** 步骤为 `wait-exit: 0`
- **THEN** runner SHALL 调用 `terminal.waitForExit()` 并断言退出码等于 0

### Requirement: 断言指令

Steps 列表 SHALL 支持以下断言指令：

- `expect: <pattern>` — 等待并断言终端输出匹配正则表达式，等同于 `wait` 但语义更明确表示断言意图
- `not-expect: <pattern>` — 断言当前终端 buffer 中不包含匹配项（不等待，立即检查）
- `expect-file:` — 断言文件系统状态：
  - `path: <relative-path>` — 相对于 HOME 目录的路径
  - `exists: true|false` — 断言文件/目录是否存在
  - `contains: <text>` — 断言文件内容包含指定文本（需 exists 为 true）
- `expect-request:` — 断言 MockLLMServer 收到的请求：
  - `index: <n>` — 请求索引，-1 表示最后一个
  - `user-messages: <n>` — 精确匹配 user role 消息数量
  - `user-messages-gte: <n>` — user role 消息数量 >= n
  - `has-system: true` — 断言请求包含 system message
  - `stream: true|false` — 断言请求的 stream 标志

#### Scenario: expect 匹配成功

- **WHEN** 步骤为 `expect: "SOUL NOT FOUND"`
- **THEN** runner SHALL 调用 `terminal.waitFor(/SOUL NOT FOUND/, { since: 'last' })`
- **AND** 如果匹配成功，该步骤 SHALL 标记为 pass

#### Scenario: expect 匹配超时

- **WHEN** 步骤为 `expect: "SOUL NOT FOUND"` 且在超时时间内未匹配
- **THEN** runner SHALL 标记该步骤为 fail
- **AND** SHALL 记录诊断信息（期望 pattern、实际 buffer、timeline）

#### Scenario: not-expect 通过

- **WHEN** 步骤为 `not-expect: "error|ERROR"` 且当前 buffer 不包含匹配
- **THEN** 该步骤 SHALL 标记为 pass

#### Scenario: not-expect 失败

- **WHEN** 步骤为 `not-expect: "error|ERROR"` 且当前 buffer 包含 "ERROR"
- **THEN** 该步骤 SHALL 标记为 fail 并报告匹配到的内容

#### Scenario: expect-file 检查文件存在

- **WHEN** 步骤为 `expect-file: { path: ".soulkiller/souls/johnny", exists: true }`
- **THEN** runner SHALL 检查 `${homeDir}/.soulkiller/souls/johnny` 是否存在

#### Scenario: expect-file 检查文件内容

- **WHEN** 步骤为 `expect-file: { path: ".soulkiller/souls/johnny/identity.md", contains: "hacker" }`
- **THEN** runner SHALL 读取文件内容并断言包含 "hacker"

#### Scenario: expect-request 检查最后一个请求

- **WHEN** 步骤为 `expect-request: { index: -1, user-messages-gte: 2, stream: true }`
- **THEN** runner SHALL 获取 mockServer.requests 的最后一个元素
- **AND** SHALL 断言 user role 消息数 >= 2
- **AND** SHALL 断言 stream 标志为 true

### Requirement: 单步超时覆盖

任何包含等待行为的步骤（wait、wait-prompt、expect、wait-exit）SHALL 支持 `timeout` 字段覆盖全局超时。

#### Scenario: 单步指定超时

- **WHEN** 步骤为 `expect: "long operation done"` 且带 `timeout: 60s`
- **THEN** 该步骤的等待超时 SHALL 为 60 秒而非全局默认值

### Requirement: Step Executor 注册表

DSL 指令的执行 SHALL 通过注册表模式实现。每个指令类型对应一个 StepExecutor 函数，新增指令只需注册新的 executor，不修改 runner 核心循环。

#### Scenario: 注册自定义指令

- **WHEN** 通过 `executors.set('capture', captureExecutor)` 注册新指令
- **THEN** runner 在遇到 `capture:` 步骤时 SHALL 调用 captureExecutor
- **AND** runner 核心循环代码 SHALL 不需要修改
