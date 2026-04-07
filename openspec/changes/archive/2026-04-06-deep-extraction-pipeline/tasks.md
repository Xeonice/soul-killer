## 1. Agent Extraction Guidelines 重写

- [x] 1.1 重写 SOUL_SYSTEM_PROMPT 的 Extraction Guidelines 段落
- [x] 1.2 重写 WORLD_SYSTEM_PROMPT 的 Extraction Guidelines 段落
- [x] 1.3 在 SOUL_SYSTEM_PROMPT Collection 阶段加入 extractPage 规则
- [x] 1.4 在 WORLD_SYSTEM_PROMPT Collection 阶段加入相同的 extractPage 规则

## 2. World Distill Extract 重构

- [x] 2.1 重构 WorldDistiller.extractEntries(): 从 per-cluster 改为 per-dimension, 按维度分组合并 chunks
- [x] 2.2 重写 extract prompt: 要求 LLM 从维度文本中生成 2-5 个 entry, 每个 5-10 句
- [x] 2.3 将 content 截断限制从 4000 改为 8000 字符
- [x] 2.4 更新 extract 的 JSON 解析逻辑: 从解析单对象改为解析数组, 保留 fallback

## 3. World Distill Review 阶段

- [x] 3.1 新增 WorldDistiller.reviewEntries() 方法
- [x] 3.2 实现合并逻辑: 将重复 entry 对合并为一个
- [x] 3.3 实现删除逻辑: 移除少于 2 句的浅层 entry
- [x] 3.4 在 distill() 的 extractEntries 之后调用 reviewEntries, 发出 phase=review 的 progress 事件
- [x] 3.5 更新 DistillPhase 类型定义, 确保包含 review

## 4. 单元测试

- [x] 4.1 新增 tests/unit/world-distill-extract.test.ts: 测试 per-dimension merge 逻辑
- [x] 4.2 新增 tests/unit/world-distill-review.test.ts: 测试 review 阶段
- [x] 4.3 更新现有 world distill 相关测试中的 extraction 数量断言
