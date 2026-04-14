## 1. 验证代码层已彻底清理

- [x] 1.1 `grep -ri "searxng" src/` 应只匹配 `src/infra/engine/detect.ts`（与 SearXNG 无关，是 docker-engine 检测）
- [x] 1.2 `bun run build` 通过
- [x] 1.3 `bun run test` 全绿（前序提交已验证 1010/1010）

## 2. 文档对齐

- [x] 2.1 创建 `openspec/changes/remove-searxng-backend/proposal.md`
- [x] 2.2 创建 `openspec/changes/remove-searxng-backend/specs/searxng-backend/spec.md`（3 条 REMOVED）
- [x] 2.3 创建 `openspec/changes/remove-searxng-backend/specs/search-fallback-chain/spec.md`（MODIFIED 顶层 + 1 条 REMOVED）

## 3. 归档时操作（`/opsx:archive` 阶段）

- [ ] 3.1 归档脚本会自动把 `openspec/specs/searxng-backend/` 整目录删除（因为 3 条 ADDED Requirement 全被 REMOVED）
- [ ] 3.2 归档脚本会把 `openspec/specs/search-fallback-chain/spec.md` 替换为本变更里的 MODIFIED 版本
- [ ] 3.3 归档完成后再次 `grep -ri "searxng" openspec/specs/` 应无匹配
