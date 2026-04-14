## 1. 文档清扫

- [x] 1.1 创建 `specs/agent-session-log/spec.md`：MODIFIED `META header in log file`（provider 示例改 exa）+ MODIFIED `Tool internal detail logging`（删 SearXNG 场景）
- [x] 1.2 创建 `specs/agent-tool-loop/spec.md`：MODIFIED `搜索工具集`（描述 + 场景去 SearXNG）
- [x] 1.3 创建 `specs/domain-directory-layout/spec.md`：MODIFIED `基础设施目录`（搜索后端清单去 searxng）

## 2. 归档时操作（`/opsx:archive` 阶段）

- [ ] 2.1 sync 阶段把三个 MODIFIED requirement 替换写回 `openspec/specs/`
- [ ] 2.2 archive 后再次 `grep -ri "searxng" openspec/specs/` 应无匹配（`engine/` 不算 spec）
