## MODIFIED Requirements

### Requirement: viewer-server 从磁盘 serve 静态文件

viewer-server SHALL 从 `~/.soulkiller/viewer/` 目录读取静态文件（index.html + assets/），不再从内嵌字符串常量 serve。

#### Scenario: 正常启动

- **WHEN** `~/.soulkiller/viewer/index.html` 存在
- **THEN** SHALL serve 该目录下的静态文件 + API 端点

#### Scenario: viewer 目录缺失

- **WHEN** `~/.soulkiller/viewer/` 目录不存在
- **THEN** SHALL 报错提示用户重新安装或运行 `soulkiller --update`

### Requirement: viewer 作为 detached 进程运行

`soulkiller runtime viewer` SHALL spawn viewer-server 作为 detached 子进程，父进程输出 VIEWER_URL 后正常退出。

#### Scenario: 启动后父进程退出

- **WHEN** viewer-server 成功绑定端口
- **THEN** 父进程 SHALL 输出 `VIEWER_URL` 和 `VIEWER_PID` 后退出，viewer-server 后台继续运行
