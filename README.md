# 📁 tpldown - 文件下载服务

一个基于 Node.js + Express 的轻量级文件下载服务，支持目录浏览、文件下载、限速、安全过滤等功能。

## ✨ 功能特性

- 📂 **目录浏览** - 支持多级嵌套目录的浏览和导航
- 🔗 **URL 同步** - 目录路径自动同步到 URL，支持浏览器前进/后退
- 🍞 **面包屑导航** - 清晰显示当前位置，快速跳转
- 🎨 **文件图标** - 根据文件类型自动显示对应的 emoji 图标
- 🚀 **下载限速** - 可配置的下载速度限制，避免带宽占用过高
- 🛡️ **安全过滤** - 支持文件扩展名白名单/黑名单
- 📊 **请求限流** - 防止 API 被频繁调用
- 📝 **日志记录** - 完整的请求和错误日志
- 🌐 **多地址支持** - 同时支持 IPv4 和 IPv6 访问
- 📱 **响应式设计** - 适配移动端和桌面端

## 📦 安装

### 环境要求
- Node.js >= 14.0.0
- npm 或 yarn

### 安装步骤

1. 克隆项目
```bash
git clone https://github.com/frycod128/tpldown.git
cd tpldown
```

2. 安装依赖
```bash
npm install
```

3. 启动服务
```bash
# 生产模式
npm start

# 开发模式（支持热重载）
npm run dev
```

## ⚙️ 配置说明

配置文件 `config.json` 会在首次启动时自动生成，支持以下配置项：

### 基础配置

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `filesDirectory` | string | `"./files"` | 文件存放目录路径 |
| `isAbsolutePath` | boolean | `false` | 是否为绝对路径 |
| `port` | number | `3000` | 服务监听端口 |
| `enableDirectoryBrowse` | boolean | `true` | 是否启用目录浏览 |

### 性能限制

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `maxFilesToList` | number | `20` | 最大显示文件数量，`-1` 表示无限制 |
| `maxRefreshRequestsPerSecond` | number | `1` | 每秒最大刷新请求次数（支持小数） |

### 下载限速

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `enableSpeedLimit` | boolean | `false` | 是否启用下载限速 |
| `downloadSpeedLimit` | number | `1048576` | 限速大小（字节/秒），默认 1MB/s |

### 安全配置

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `allowedFileExtensions` | array | `[]` | 允许下载的文件扩展名，空数组表示允许所有 |
| `blockedFileExtensions` | array | `[".exe", ".sh", ".bat"]` | 禁止下载的文件扩展名 |

**注意**：如果同时设置了白名单和黑名单，白名单优先级更高。

### 日志配置

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `enableLogging` | boolean | `true` | 是否启用日志 |
| `logLevel` | string | `"info"` | 日志级别：`debug`、`info`、`warn`、`error` |

### 文件图标配置

```json
{
  "fileIcons": {
    ".jpg": "🖼️",
    ".mp4": "🎬",
    ".mp3": "🎵",
    ".pdf": "📄",
    ".zip": "🗜️"
    // ... 更多扩展名映射
  },
  "defaultFileIcon": "📄"
}
```

## 🚀 使用方法

### 启动服务

```bash
npm start
```

启动后会显示类似以下信息：
```
=================================
🚀 文件下载服务已启动
=================================
📍 本地访问:
   - IPv4: http://localhost:3003
   - IPv6: http://[::1]:3003
📍 局域网 IPv4 访问:
   - http://192.168.1.100:3003
📂 文件目录: /path/to/your/files
⚙️  配置文件: /path/to/config.json
=================================
```

### 访问服务

- **Web 界面**：浏览器打开 `http://localhost:3003`
- **直接访问目录**：`http://localhost:3003/#文件夹名/子文件夹`
- **健康检查**：`GET /api/health`
- **获取文件列表**：`GET /api/files`
- **下载文件**：`GET /api/download/{文件路径}`

### 目录导航

- 点击文件夹进入子目录
- 点击面包屑导航快速跳转
- 使用浏览器前进/后退按钮
- 点击"根目录"按钮返回顶层
- 点击"返回上级"回到父目录

### 文件下载

- 点击文件或下载按钮即可下载
- 支持断点续传（通过浏览器自带功能）
- 下载速度受 `downloadSpeedLimit` 配置限制

## 📁 目录结构

```
tpldown/
├── config.js           # 配置管理模块
├── config.json         # 配置文件（自动生成）
├── server.js           # 主服务入口
├── package.json        # 项目依赖配置
├── package-lock.json   # 依赖锁定文件
├── README.md           # 项目说明文档
├── .gitignore          # Git 忽略文件
├── public/             # 静态资源目录
│   └── index.html      # Web 前端界面
└── files/              # 默认文件存放目录
```

## 🔌 API 接口

### 健康检查

```
GET /api/health
```

响应示例：
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "config": {
    "filesDirectory": "/path/to/files",
    "maxFilesToList": 20,
    "enableSpeedLimit": false,
    "speedLimit": 1048576,
    "refreshLimit": 1
  }
}
```

### 获取图标配置

```
GET /api/icons
```

响应示例：
```json
{
  "success": true,
  "icons": {
    ".jpg": "🖼️",
    ".mp4": "🎬"
  },
  "defaultIcon": "📄"
}
```

### 获取文件列表

```
GET /api/files
```

响应示例：
```json
{
  "success": true,
  "files": [
    {
      "name": "documents",
      "type": "directory",
      "path": "documents",
      "children": [...],
      "itemCount": 5
    },
    {
      "name": "readme.txt",
      "type": "file",
      "path": "readme.txt",
      "size": 1024,
      "modified": "2024-01-01T00:00:00.000Z",
      "icon": "📃"
    }
  ],
  "stats": {
    "totalCount": 10,
    "isTruncated": false,
    "maxAllowed": 20
  }
}
```

### 下载文件

```
GET /api/download/{filePath}
```

- 成功：返回文件流，自动触发下载
- 失败：返回 JSON 格式错误信息

## 🛠️ 开发

### 开发模式

```bash
npm run dev
```

使用 nodemon 实现代码修改后自动重启服务。

### 添加新的文件图标

编辑 `config.json` 中的 `fileIcons` 字段，添加新的扩展名映射：

```json
{
  "fileIcons": {
    ".custom": "🎯",
    ".new": "✨"
  }
}
```

## ❓ 常见问题

### 1. 如何更改文件存放目录？

修改 `config.json` 中的 `filesDirectory` 字段：
- 相对路径：`"filesDirectory": "./my-files"`
- 绝对路径：`"filesDirectory": "D:/MyFiles"`，同时设置 `"isAbsolutePath": true`

### 2. 如何限制某些文件类型不被下载？

在 `blockedFileExtensions` 中添加要禁止的扩展名：
```json
{
  "blockedFileExtensions": [".exe", ".sh", ".bat", ".dll"]
}
```

### 3. 如何只允许特定文件类型？

在 `allowedFileExtensions` 中设置白名单：
```json
{
  "allowedFileExtensions": [".jpg", ".png", ".pdf", ".zip"]
}
```

### 4. 端口被占用怎么办？

修改 `config.json` 中的 `port` 字段为其他可用端口。

### 5. 如何查看详细日志？

将 `logLevel` 设置为 `"debug"`，可以看到更详细的请求信息。

### 6. 如何限制下载速度？

```json
{
  "enableSpeedLimit": true,
  "downloadSpeedLimit": 524288  // 512 KB/s
}
```

## 欢迎提交 Issue 和 Pull Request！
