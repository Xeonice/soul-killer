## Why

搜索 "强尼银手" 返回的是赛博朋克 2077 的游戏评测和新闻，而不是角色本身的设定、台词和性格。蒸馏出来的 identity 变成了"游戏行业观察者/文化评论者"——完全是错误的人格。

根因是 Agent 的 system prompt 让 LLM 自由决定搜索查询，但 LLM 产生的查询过于泛泛（"强尼银手 是谁"），没有定向到角色 wiki、台词、性格分析等高质量来源。

## What Changes

- 重写 Agent 的 system prompt：识别出分类后，给出明确的搜索策略指引（虚构角色用 `character wiki quotes dialogue`，公众人物用 `interview speech opinions`）
- 搜索查询强制包含定向关键词：`site:fandom.com`、`character`、`quotes`、`personality analysis`
- 优先用英文名搜索（wiki 类内容英文远比中文丰富），同时补充中文搜索
- Agent 首次搜索后如果识别到英文名，后续搜索切换到英文名

## Capabilities

### Modified Capabilities

- `soul-capture-agent`: 搜索策略按分类定向优化，查询关键词更精确

## Impact

- **修改文件**: `src/agent/soul-capture-agent.ts`（system prompt + 搜索策略）
- **无新增文件**
