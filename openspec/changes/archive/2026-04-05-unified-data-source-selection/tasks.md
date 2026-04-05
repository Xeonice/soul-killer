## 1. DataSourceOption 扩展

- [x] 1.1 `DataSourceOption` 类型新增 `'web-search'`
- [x] 1.2 三语 i18n 新增联网搜索选项文案（`create.source.web_search`）

## 2. 状态机重构

- [x] 2.1 `proceedAfterConflictCheck` 统一走 `data-sources`，移除 public/personal 分叉
- [x] 2.2 data-sources UI 根据 soulType 动态构建选项列表（public 含 web-search 默认勾选，personal 不含）

## 3. 数据源执行编排

- [x] 3.1 `handleSourcesSubmit` 改造：记录所有选中的数据源列表，如果包含 `web-search` 则先进入 capturing，否则处理本地数据源
- [x] 3.2 search-confirm 的 `confirm` 选项改造：确认后检查是否还有待处理的本地数据源，有则继续 source-path，无则直接 distill
- [x] 3.3 本地数据源 ingest 完成后，检查是否还有下一个本地数据源，有则继续，无则进入 distill
- [x] 3.4 空选择（什么都不选）直接进入 distilling

## 4. search-confirm 菜单简化

- [x] 4.1 移除 `supplement` 选项，菜单改为三项：confirm / detail / retry
- [x] 4.2 调整 searchConfirmCursor 范围（max 从 3 改为 2）
- [x] 4.3 移除 `handleSearchConfirmChoice` 中的 `supplement` 分支

## 5. 清理

- [x] 5.1 移除 retryFlow 中 soulType 判断的 personal → data-sources 分支（统一走 data-sources）
- [x] 5.2 确保 UNKNOWN_ENTITY 路径走 proceedToLocalSources（跳过 web-search 继续本地数据源）
