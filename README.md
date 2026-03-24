# 文件下载服务配置说明

## 配置文件 (config.json)

### 基础配置
- `filesDirectory`: 文件目录路径（默认: "./files"）
- `isAbsolutePath`: 是否为绝对路径（默认: false）
- `port`: 服务端口（默认: 3000）

### 性能限制
- `maxFilesToList`: 最大文件数量，-1表示无限制（默认: 20）
- `maxRefreshRequestsPerSecond`: 每秒最大刷新请求次数（默认: 1）

### 下载限速
- `enableSpeedLimit`: 是否启用限速（默认: false）
- `downloadSpeedLimit`: 限速大小（字节/秒），默认1MB/s

### 安全配置
- `allowedFileExtensions`: 允许下载的文件扩展名（空数组表示全部允许）
- `blockedFileExtensions`: 禁止下载的文件扩展名

### 日志配置
- `enableLogging`: 是否启用日志（默认: true）
- `logLevel`: 日志级别 - debug/info/warn/error（默认: info）

## 使用说明

1. 启动服务：`npm start`
2. 访问：`http://localhost:3000`
3. 健康检查：`http://localhost:3000/api/health`

配置文件会自动生成，修改后需要重启服务。