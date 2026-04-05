## ADDED Requirements

### Requirement: SearXNG 容器生命周期管理
系统 SHALL 在启动时自动管理 SearXNG Docker 容器。如果 Docker 可用，系统 SHALL 确保 SearXNG 容器处于运行状态。如果 Docker 不可用，系统 SHALL 静默跳过并降级。

#### Scenario: Docker 可用且容器已运行
- **WHEN** Docker daemon 可用且 soulkiller-searxng 容器状态为 Up
- **THEN** 系统直接使用该容器，不做额外操作

#### Scenario: Docker 可用但容器已停止
- **WHEN** Docker 可用且 soulkiller-searxng 容器存在但状态不是 Up
- **THEN** 系统执行 `docker start soulkiller-searxng`
- **AND** 等待健康检查通过

#### Scenario: Docker 可用但容器不存在（首次启动）
- **WHEN** Docker 可用但没有名为 soulkiller-searxng 的容器
- **THEN** 系统执行 `docker run` 创建并启动容器，挂载 settings.yml
- **AND** 如果镜像不存在则自动 pull
- **AND** 等待健康检查通过（最多 15 秒）

#### Scenario: Docker 不可用
- **WHEN** `docker info` 失败或超时
- **THEN** SearXNG 标记为不可用
- **AND** 系统使用 Tavily/DuckDuckGo 降级搜索

### Requirement: SearXNG 搜索执行器
系统 SHALL 提供 SearXNG 搜索函数，通过 HTTP JSON API 调用本地 SearXNG 实例，返回标准化的搜索结果。

#### Scenario: 正常搜索
- **WHEN** 调用 searxngSearch("Artoria Pendragon")
- **THEN** 向 `http://localhost:8080/search?q=Artoria+Pendragon&format=json` 发送请求
- **AND** 返回 SearchResult 数组（title, url, content）

#### Scenario: SearXNG 不可达
- **WHEN** SearXNG 容器未运行或网络错误
- **THEN** 抛出错误，由上层降级链处理

### Requirement: SearXNG 配置
项目 SHALL 包含 SearXNG 的 settings.yml 配置文件，位于 `engine/searxng/settings.yml`。配置 SHALL 开启 JSON 格式输出，并启用 Google、Bing、Reddit、Wikipedia 搜索引擎。

#### Scenario: 配置文件挂载
- **WHEN** Docker 容器创建时
- **THEN** settings.yml 通过 volume 挂载到容器的 `/etc/searxng/settings.yml`
