## Context

当前搜索流程：DuckDuckGo 返回 5 个结果，每个只有 1-2 句 snippet。喂给蒸馏的数据太薄。需要对搜索结果中的 URL 做二次抓取，提取完整页面内容。

Claude Code 内置的 WebFetch 工具也用了 Turndown（HTML→Markdown），我们在此基础上加 readability 做正文提取，过滤导航栏/广告/侧边栏。

## Goals / Non-Goals

**Goals:**
- 搜索结果从 snippet 升级为完整页面 Markdown 内容
- 对 Fandom Wiki、Wikipedia、personality-database 等页面提取干净的正文
- 蒸馏 prompt 注入目标人物名字，避免"分析文章风格"的错误
- 纯开源方案，零外部 API 依赖

**Non-Goals:**
- JavaScript 渲染（SPA 页面）——wiki 类页面都是静态 HTML
- 图片提取
- 缓存页面内容

## Decisions

### D1: 技术栈 — readability + jsdom + turndown

```
fetch(url) → HTML string
    ↓
jsdom 解析为 DOM
    ↓
@mozilla/readability 提取正文（去掉导航/侧边栏/广告/footer）
    ↓
turndown 把 HTML 正文转为 Markdown
    ↓
干净的 Markdown 文本（几百到几千字）
```

这是 Firefox 阅读模式的同一套引擎。对 wiki 类结构化页面效果极好。

### D2: 搜索流程改造

```
之前：
  DuckDuckGo search → [{ title, url, snippet }] → snippet 作为内容

之后：
  DuckDuckGo search → [{ title, url, snippet }]
      ↓
  取 top 3 URL → page-extractor 抓取完整内容
      ↓
  [{ title, url, fullContent }] → fullContent 作为内容
```

只抓 top 3（不是全部 5 个），控制耗时。每个页面限制 3000 字避免 token 爆炸。

Tavily 搜索不需要改——它本身返回的 content 已经是页面摘要。但如果结果太短（<200 字），也触发二次抓取。

### D3: 蒸馏 prompt 注入 {name}

三个 prompt 都加上明确的上下文：

```
之前：
  "根据以下文本片段，提取这个人的核心身份特征"

之后：
  "以下是关于【{name}】的描述、台词记录和分析文章。
   请从中提取【{name}】本人的核心身份特征。
   注意：要分析的是【{name}】这个人物/角色，
   不是文章本身的特征。"
```

### D4: 错误处理

页面抓取可能失败（超时、403、非 HTML 内容）：
- 超时 5 秒，超时后跳过该 URL
- 非 HTML content-type 跳过
- readability 提取失败时 fallback 到原始 snippet
- 不影响整体流程——单个页面失败不阻断

## Risks / Trade-offs

### R1: 抓取耗时
- **风险**: 3 个页面 × 每个 1-3s = 总共 3-9s 额外耗时
- **缓解**: 并行抓取（Promise.all）；5s 超时；Protocol Panel 显示抓取进度

### R2: 内容过长
- **风险**: 有些 wiki 页面内容超长，喂给 LLM token 太多
- **缓解**: 限制每页 3000 字，总计不超过 10000 字

### R3: jsdom 包体积
- **风险**: jsdom 是比较大的依赖（~30MB）
- **缓解**: 这是开发 CLI 工具，不是浏览器 bundle，包体积不敏感
