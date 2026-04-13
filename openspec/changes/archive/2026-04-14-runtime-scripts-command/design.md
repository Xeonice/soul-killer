## Context

SKILL.md Phase -1 Step -1.1 指示 LLM 用 Glob 工具搜索 `${CLAUDE_SKILL_DIR}/runtime/scripts/*.json`。该模式在 Claude Code 的 Glob 工具下行为不可靠（文件存在但返回空），导致已有脚本被忽略。现有 runtime CLI 有 `list <script-id>` 列出单脚本的 saves，但缺少列出所有脚本的命令。

## Goals / Non-Goals

**Goals:**
- 新增 `soulkiller runtime scripts` 子命令，可靠地列出所有已生成脚本
- 输出结构化 JSON，LLM 可直接解析判断是否有已有脚本
- 更新 SKILL.md 模板，Phase -1 改用 CLI 命令替代 Glob

**Non-Goals:**
- 不改变脚本文件的存储格式或位置
- 不改变 Phase -1 的流程逻辑（仅替换发现机制）
- 不增加脚本的 CRUD 操作（删除等仍由 LLM 直接操作文件）

## Decisions

### Decision 1: 只读取头部字段，不加载完整脚本

`scripts.ts` 读取每个 `script-*.json` 并解析 JSON，但只提取顶层元数据字段（id、title、generated_at、user_direction），不加载 scenes/endings 等大体积内容。

**理由**: 脚本文件可达 100KB+，全量加载多个脚本浪费内存且输出过大。Phase -1 Step -1.2 才需要读取详细字段，此处只需索引。

**备选**: 读取文件前 N 字节做字符串截取 → 不可靠，JSON 字段顺序不固定。

### Decision 2: 输出格式

```json
{
  "scripts": [
    {
      "id": "c2d7c9d5",
      "title": "三国群英传",
      "generated_at": "2026-04-13T10:36:00Z",
      "file": "script-c2d7c9d5.json"
    }
  ],
  "count": 1
}
```

空结果时 `scripts: [], count: 0`。LLM 判断 `count === 0` 即为首次游玩。

### Decision 3: SKILL.md 模板变更策略

Phase -1 Step -1.1 改为：
```
Run `soulkiller runtime scripts` and parse the JSON output.
- If count is 0 → proceed to Phase 0
- If count > 0 → proceed to Step -1.2
```

Step -1.2 仍使用 Read 工具读取单个脚本文件获取详细字段（不变）。

## Risks / Trade-offs

- **[风险] 脚本文件 JSON 解析失败（损坏文件）** → 捕获异常，在 scripts 列表中标记 `error` 字段，不中断其他脚本的列出
- **[风险] 旧版 skill 归档没有此命令** → 不影响，旧 SKILL.md 仍用 Glob；新命令只在新导出的 skill 中被引用
