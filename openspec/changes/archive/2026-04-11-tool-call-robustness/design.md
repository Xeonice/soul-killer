## Context

项目使用 Vercel AI SDK 的 `ToolLoopAgent` 驱动多个 agent 流程（export planning/setup/character、soul capture/distill）。7 个 tool 含 `z.array()` 参数。LLM（通过 OpenRouter 路由）频繁把 array 参数序列化为 JSON 字符串，zod 验证失败。

之前尝试 `z.preprocess` 方案不可靠：zod-to-json-schema 转换时 preprocess 被丢弃（[MCP SDK #702](https://github.com/modelcontextprotocol/typescript-sdk/issues/702)），模型看不到预处理逻辑。

## Goals / Non-Goals

**Goals:**
- 消除 array 参数类型错误导致的 tool call 失败
- 使用 AI SDK 官方推荐 API，不依赖 hack
- 统一防御，不逐个 tool 加 workaround

**Non-Goals:**
- 不改变 tool 的 inputSchema 定义（保持 `z.array()` 语义正确）
- 不迁移到 CSV string 参数（牺牲类型安全）
- 不针对特定 provider 做特殊处理

## Decisions

### D1: 三层防御架构

```
Layer 1: inputExamples (生成前)
  ↓ 模型看到正确格式样例
Layer 2: strict: true (生成时)
  ↓ provider 端约束
Layer 3: repairToolCall (生成后)
  ↓ 本地修复，不调模型
```

### D2: inputExamples 策略

每个含 array 参数的 tool 添加 `inputExamples: [{ input: {...} }]`，至少提供一组完整的正确输入。

示例数据选择原则：
- 用**真实世界的典型输入**，不用 placeholder
- array 参数至少包含 3 个元素（展示"这确实是个数组"）
- 字符串内容含引号、逗号等特殊字符（展示正确转义方式）

### D3: strict mode 策略

对 export 流程中的关键 tool 启用 `strict: true`：
- `set_prose_style` — 出错频率最高
- `set_story_metadata` — constraints 数组

其他 tool 暂不启用（strict mode 对 OpenRouter 透传的支持需实测验证）。

### D4: repairToolCall 共享实现

创建 `src/infra/utils/repair-tool-call.ts`，导出一个通用修复函数：

```typescript
export function createArrayArgRepair(): ToolCallRepairFunction {
  return async ({ toolCall, error }) => {
    if (NoSuchToolError.isInstance(error)) return null
    
    // toolCall.input 是原始 JSON 字符串
    const args = JSON.parse(toolCall.input)
    let modified = false
    
    for (const [key, val] of Object.entries(args)) {
      if (typeof val !== 'string') continue
      const trimmed = (val as string).trim()
      if (!trimmed.startsWith('[')) continue
      
      // 尝试 JSON.parse
      try {
        args[key] = JSON.parse(trimmed)
        modified = true
        continue
      } catch {}
      
      // JSON.parse 失败（裸引号等）→ 正则清理
      const cleaned = trimmed
        .replace(/^\[/, '').replace(/\]$/, '')  // 去掉外层括号
        .split(/",\s*"/)                         // 按 ", " 分割
        .map(s => s.replace(/^"|"$/g, '').trim()) // 去掉首尾引号
        .filter(Boolean)
      if (cleaned.length > 0) {
        args[key] = cleaned
        modified = true
      }
    }
    
    return modified
      ? { ...toolCall, input: JSON.stringify(args) }
      : null
  }
}
```

在各 `ToolLoopAgent` 构造点挂载：
```typescript
const agent = new ToolLoopAgent({
  model,
  tools,
  experimental_repairToolCall: createArrayArgRepair(),
  // ...
})
```

### D5: 回滚 z.preprocess

删除所有之前添加的 `z.preprocess(coerceStringArray/coerceObjectArray, ...)` 包装，恢复为纯 `z.array()` 定义。删除 `src/infra/utils/zod-preprocess.ts`。

理由：有了三层防御后 preprocess 是冗余的，且它的实际效果不确定（被 JSON Schema 转换丢弃）。

## Risks / Trade-offs

**[R1] OpenRouter 不透传 strict mode** → 可能无效。  
→ Mitigation: strict 是 Layer 2，即使失效还有 Layer 1 和 3。实测后根据效果决定保留或移除。

**[R2] inputExamples 增加 prompt token** → 每个 tool 多 ~200 token。  
→ Mitigation: export agent 的 context 窗口充足（用的都是大模型），200 token 可忽略。

**[R3] repairToolCall 的正则清理可能误修** → 字符串内含 `[` 的非 array 参数被错误修改。  
→ Mitigation: 只修复 `trimmed.startsWith('[')` 且整体看起来像 JSON array 的字符串。非 array 参数不会以 `[` 开头。
