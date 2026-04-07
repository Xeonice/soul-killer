## 1. System Prompt 搜索约束

- [x] 1.1 在 `SOUL_SYSTEM_PROMPT`（`src/agent/soul-capture-strategy.ts`）中增加搜索规则段落：每个 query ≤ 4 关键词、单一子话题、禁止并列多实体
- [x] 1.2 在 `WORLD_SYSTEM_PROMPT`（`src/agent/world-capture-strategy.ts`）中增加相同的搜索规则段落

## 2. 搜索模板细化

- [x] 2.1 重写 `DIGITAL_CONSTRUCT_TEMPLATES`（`src/agent/soul-dimensions.ts`），每维度 3-5 条聚焦 query，每条 ≤ 3 关键词
- [x] 2.2 重写 `PUBLIC_ENTITY_TEMPLATES`（`src/agent/soul-dimensions.ts`），同上
- [x] 2.3 重写 `HISTORICAL_RECORD_TEMPLATES`（`src/agent/soul-dimensions.ts`），同上
- [x] 2.4 重写 `FICTIONAL_UNIVERSE_TEMPLATES`（`src/agent/world-dimensions.ts`），每维度 3-5 条聚焦 query
- [x] 2.5 重写 `REAL_SETTING_TEMPLATES`（`src/agent/world-dimensions.ts`），同上

## 3. Search Tool URL 去重

- [x] 3.1 在 `createAgentTools`（`src/agent/tools/search-factory.ts`）中创建 `seenUrls: Set<string>`，在 `runSearch` 返回前过滤已见 URL
- [x] 3.2 全部结果重复时，在返回的结果中附加去重提示消息
- [x] 3.3 确保 pre-search 的结果也被记录到 seenUrls 中（在 `capture-agent.ts` 中传递或共享状态）

## 4. Exa 搜索参数优化

- [x] 4.1 修改 `executeExaSearch`（`src/agent/tools/exa-search.ts`），检测 query 是否包含 CJK 字符，包含则使用 `type: 'keyword'`，否则保持 `type: 'auto'`

## 5. 单元测试

- [x] 5.1 更新 `tests/unit/dimensions.test.ts` 中 `generateSearchPlan` 的模板断言：验证每维度 query 数量增加到 3-5 条，验证每条模板 query 的关键词数量 ≤ 3（不含 name/localName）
- [x] 5.2 新增 `generateSearchPlan` 关键词粒度测试：遍历所有分类×维度的模板 query，断言不存在超过 3 个有效关键词的 query
- [x] 5.3 更新 `tests/unit/world-dimensions.test.ts` 中 `generateWorldSearchPlan` 的模板断言：同 5.1 的验证逻辑
- [x] 5.4 新增 `tests/unit/search-dedup.test.ts`：测试 URL 去重逻辑
  - 正常去重：第二次搜索过滤掉第一次已返回的 URL
  - 部分重复：混合新旧 URL，只保留新的
  - 全部重复：返回空结果集并附加去重提示消息
  - 独立实例：不同 `createAgentTools` 调用的 seenUrls 互相独立
- [x] 5.5 新增 `tests/unit/exa-search.test.ts`：测试 CJK 语言检测与搜索模式切换
  - 中文 query（如 "三国 历史"）→ `type: 'keyword'`
  - 日文 query（如 "間桐桜 セリフ"）→ `type: 'keyword'`
  - 纯英文 query（如 "Artoria Pendragon wiki"）→ `type: 'auto'`
  - 混合 query（如 "阿尔托莉雅 Fate"）→ `type: 'keyword'`（含 CJK 即切换）

## 6. E2E 测试

- [x] 6.1 E2E 回归保护：现有 Scenario 2 (create wizard) 已验证 prompt 变更不破坏 create 流程。完整 capture agent 搜索流程需要 mock search API + LLM tool call 循环，复杂度高，改为通过单元测试 5.1-5.5 覆盖搜索质量回归保护
- [x] 6.2 搜索 query 长度守卫：通过单元测试 5.2/5.3 的 "no template query has more than 3 effective keywords" 测试覆盖，作为关键词堆砌的永久回归保护
