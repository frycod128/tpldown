# 📁 tpldown - 轻量级文件下载服务

一个基于 Node.js + Express 的轻量级文件下载服务，支持目录浏览、文件下载、限速、安全过滤等功能。

[![Node.js Version](https://img.shields.io/badge/node-%3E%3D14.0.0-brightgreen)](https://nodejs.org)
[![License](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

## ✨ 功能特性

### 核心功能
- 📂 **目录浏览** - 支持多级嵌套目录的树形浏览和导航
- 🔗 **URL 同步** - 目录路径自动同步到 URL hash，支持浏览器前进/后退和书签
- 🍞 **面包屑导航** - 清晰显示当前位置层级，一键快速跳转
- 🎨 **文件图标** - 根据 40+ 种文件类型自动显示对应的 emoji 图标
- ⚡ **请求限流** - 令牌桶算法实现 API 限流，防止恶意刷新
- 🚀 **下载限速** - 可配置的下载速度限制，精确控制带宽占用

### 安全特性 🔒
- 🛡️ **路径穿越防护** - 使用 `fs.realpathSync()` 解析真实路径，防止符号链接绕过
- 🔗 **符号链接控制** - 可配置是否允许访问符号链接及其行为
- 🚫 **文件类型过滤** - 支持扩展名白名单/黑名单，阻止危险文件下载
- 📍 **目录边界检查** - 严格限制访问范围，防止读取系统敏感文件
- 🔍 **安全审计日志** - 记录所有安全事件（路径穿越尝试、符号链接访问等）

### 用户体验
- 📱 **响应式设计** - 完美适配桌面端、平板和移动设备
- 🌐 **双栈支持** - 同时监听 IPv4 和 IPv6 地址
- 📊 **实时统计** - 显示当前目录文件/文件夹数量
- 🔄 **热重载开发** - 支持 nodemon 开发模式

## 📦 快速开始

### 环境要求
- Node.js >= 14.0.0
- npm >= 6.0.0 或 yarn

### 安装步骤

```bash
# 1. 克隆项目
git clone https://github.com/yourusername/tpldown.git
cd tpldown

# 2. 安装依赖
npm install

# 3. 启动服务
npm start
```

启动成功后，访问 `http://localhost:3000` 即可使用。

## ⚙️ 配置详解

配置文件 `config.json` 会在首次启动时自动生成。修改配置后需要重启服务生效。

### 基础配置

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `filesDirectory` | string | `"./files"` | 文件存放目录，支持相对/绝对路径 |
| `isAbsolutePath` | boolean | `false` | `filesDirectory` 是否为绝对路径 |
| `port` | number | `3000` | 服务监听端口（1-65535） |
| `enableDirectoryBrowse` | boolean | `true` | 是否允许目录浏览 |

**示例：**
```json
{
  "filesDirectory": "/data/downloads",
  "isAbsolutePath": true,
  "port": 8080
}
```

### 性能配置

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `maxFilesToList` | number | `20` | 单次最大显示文件数，`-1` 为无限制 |
| `maxRefreshRequestsPerSecond` | number | `1` | API 请求限流（次/秒），支持小数如 `0.5` |

**示例：**
```json
{
  "maxFilesToList": -1,
  "maxRefreshRequestsPerSecond": 2.5
}
```

### 下载限速

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `enableSpeedLimit` | boolean | `false` | 是否启用下载限速 |
| `downloadSpeedLimit` | number | `1048576` | 限速值（字节/秒），默认 1 MB/s |

**常用限速值：**
- `524288` = 512 KB/s
- `1048576` = 1 MB/s
- `5242880` = 5 MB/s
- `10485760` = 10 MB/s

### 🔒 安全配置（重要）

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `security.allowSymlinks` | boolean | `false` | 是否允许访问符号链接 |
| `security.allowOutside` | boolean | `false` | ⚠️ 是否允许访问目录外文件（**极度危险**） |
| `security.followSymlinks` | boolean | `false` | 是否跟踪符号链接到实际文件 |
| `allowedFileExtensions` | array | `[]` | 白名单，空数组表示允许所有 |
| `blockedFileExtensions` | array | `[".exe", ".sh", ".bat"]` | 黑名单，禁止下载的文件类型 |

**安全建议：**
```json
{
  "security": {
    "allowSymlinks": false,    // 保持 false，防止符号链接绕过
    "allowOutside": false,     // 绝对不要改为 true
    "followSymlinks": false    // 保持 false
  },
  "blockedFileExtensions": [".exe", ".sh", ".bat", ".dll", ".so", ".dylib"]
}
```

### 日志配置

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `enableLogging` | boolean | `true` | 是否启用日志输出 |
| `logLevel` | string | `"info"` | 日志级别：`debug`、`info`、`warn`、`error` |

**日志级别说明：**
- `debug`：输出所有日志（包括文件跳过、符号链接检测等）
- `info`：输出请求、下载等常规信息
- `warn`：仅输出警告和错误
- `error`：仅输出错误

### 文件图标

支持 40+ 种常见文件类型的 emoji 图标映射，可通过 `fileIcons` 自定义：

```json
{
  "fileIcons": {
    ".custom": "🎯",
    ".data": "📊",
    ".config": "⚙️"
  },
  "defaultFileIcon": "📄"
}
```

## 📖 使用指南

### Web 界面

1. **浏览文件**：点击文件夹进入子目录，点击文件触发下载
2. **导航**：
    - 面包屑：点击任意层级快速跳转
    - 返回上级：回到父目录
    - 根目录：一键返回顶层
3. **URL 书签**：可直接访问 `http://localhost:3000/#path/to/folder`

### API 接口

#### 1. 健康检查
```http
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
    "enableSpeedLimit": false
  },
  "security": {
    "allowSymlinks": false,
    "allowOutside": false
  }
}
```

#### 2. 获取配置
```http
GET /api/config
```

#### 3. 获取图标配置
```http
GET /api/icons
```

#### 4. 获取文件列表
```http
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
      "itemCount": 5,
      "isSymlink": false
    },
    {
      "name": "readme.txt",
      "type": "file",
      "path": "readme.txt",
      "size": 1024,
      "modified": "2024-01-01T00:00:00.000Z",
      "icon": "📃",
      "isSymlink": false
    }
  ],
  "stats": {
    "totalCount": 10,
    "isTruncated": false,
    "maxAllowed": 20
  }
}
```

#### 5. 下载文件
```http
GET /api/download/{filePath}
```
- 成功：返回文件流
- 失败：返回 JSON 格式错误信息

### 命令行使用

```bash
# 使用 curl 下载文件
curl -O http://localhost:3000/api/download/path/to/file.zip

# 带限速的下载（客户端限速）
curl --limit-rate 1M -O http://localhost:3000/api/download/largefile.iso

# 获取文件列表
curl http://localhost:3000/api/files | jq '.'
```

## 🏗️ 项目结构

```
tpldown/
├── config.js           # 配置管理模块（单例）
├── config.json         # 配置文件（自动生成）
├── server.js           # 主服务入口
├── package.json        # 项目依赖配置
├── package-lock.json   # 依赖版本锁定
├── README.md           # 项目文档
├── .gitignore          # Git 忽略配置
├── public/             # 静态资源
│   └── index.html      # Web 前端界面
└── files/              # 默认文件存放目录（可配置）
```

## 🔧 开发指南

### 开发模式

```bash
npm run dev
```
使用 nodemon 监听文件变化自动重启服务。

### 调试

```bash
# 启用调试日志
# 修改 config.json 中 logLevel 为 "debug"

# 使用 Node.js 调试器
node --inspect server.js
```

### 添加自定义文件图标

编辑 `config.js` 中的 `defaultConfig.fileIcons` 或 `config.json`：

```javascript
fileIcons: {
  '.psd': '🎨',
  '.ai': '✒️',
  '.sketch': '🎯'
}
```

## ❓ 常见问题

### Q1: 如何让其他人通过局域网访问？
A: 启动服务后会显示局域网 IP 地址，如 `http://192.168.1.100:3000`，其他人可通过此地址访问。

### Q2: 为什么有些文件显示不出来？
A: 检查以下几点：
- 文件扩展名是否在黑名单中（`blockedFileExtensions`）
- 是否在白名单限制内（`allowedFileExtensions`）
- 是否达到了 `maxFilesToList` 限制
- 查看 `debug` 级别日志了解详细信息

### Q3: 符号链接文件无法访问？
A: 默认禁止访问符号链接以保障安全。如需启用，设置 `security.allowSymlinks: true`。

### Q4: 如何防止路径穿越攻击？
A: 本服务已内置防护：
- 使用 `fs.realpathSync()` 解析真实路径
- 严格检查文件是否在允许目录内
- 默认禁止符号链接

### Q5: 端口被占用怎么办？
A: 修改 `config.json` 中的 `port` 为其他可用端口，如 `3001`、`8080` 等。

### Q6: 下载大文件时内存占用高？
A: 服务使用流式传输，不会将整个文件加载到内存。如果内存占用仍高，检查是否启用了其他中间件。

### Q7: 如何限制只有特定 IP 可以访问？
A: 可在 `server.js` 中添加 IP 白名单中间件：
```javascript
app.use((req, res, next) => {
  const allowedIPs = ['192.168.1.100', '10.0.0.5'];
  const clientIP = req.ip.replace('::ffff:', '');
  if (!allowedIPs.includes(clientIP)) {
    return res.status(403).json({ error: 'IP 未被授权' });
  }
  next();
});
```

## 欢迎提交 Issue 和 Pull Request！

---
