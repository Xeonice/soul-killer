## Context

Agent 的 system prompt 当前是通用指令（"search for who they are"），LLM 自由决定搜什么。对虚构角色，LLM 倾向于搜新闻而不是 wiki。需要更精确的搜索策略指引。

## Goals / Non-Goals

**Goals:**
- 虚构角色搜到角色设定、台词、性格分析，而非游戏评测
- 公众人物搜到本人观点、演讲，而非关于他的新闻报道
- 首次搜索发现英文名后，后续查询切到英文
- 搜索查询带 site 限定提高精准度

**Non-Goals:**
- 改变蒸馏 prompt（问题在搜索层，不在蒸馏层）
- 增加新的搜索工具

## Decisions

### D1: System prompt 按分类给出搜索策略模板

不是让 LLM 自由发挥，而是在 prompt 里给出每种分类对应的搜索查询模板：

```
DIGITAL_CONSTRUCT (虚构角色):
  必搜:
    "{english_name} character wiki fandom"
    "{english_name} quotes dialogue lines"
    "{english_name} personality analysis MBTI"
    "{chinese_name} 角色 性格 台词 经典语录"
  
PUBLIC_ENTITY (公众人物):
  必搜:
    "{name} interview quotes opinions"
    "{name} speech philosophy"
    "{name} personality communication style"
    "{chinese_name} 观点 采访 理念"

HISTORICAL_RECORD (历史人物):
  必搜:
    "{name} philosophy famous quotes"
    "{name} biography legacy contributions"
    "{chinese_name} 名言 思想 语录"
```

### D2: 两轮搜索策略

```
Round 1: 识别
  search("{name} 是谁 who is")
  wikipedia("{name}")
  → LLM 判断 classification + 提取英文名

Round 2: 定向采集（基于 classification）
  按 D1 的模板执行 4-6 次定向搜索
  优先用英文名
```

关键改变是 **Round 2 不再让 LLM 自由选搜什么**——prompt 里直接指定必搜的查询列表。

### D3: 英文名提取

很多中文名实体有更丰富的英文资料。Agent 在 Round 1 后应从 Wikipedia 结果中提取英文名：

- "强尼银手" → Wikipedia 返回 "Johnny Silverhand"
- "马斯克" → Wikipedia 返回 "Elon Musk"

后续搜索用英文名作为主查询。
