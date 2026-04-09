const express = require('express');
const path = require('path');
const fs = require('fs');
const config = require('./config');
const app = express();
const PORT = config.getConfig().port;

// 令牌桶限流器 - 支持小数和更平滑的限流
class TokenBucketRateLimiter {
    constructor(ratePerSecond, capacity = null) {
        this.rate = ratePerSecond;           // 每秒添加的令牌数（支持小数）
        this.capacity = capacity || ratePerSecond;  // 桶的容量
        this.tokens = this.capacity;         // 当前令牌数
        this.lastRefill = Date.now();
    }

    canMakeRequest() {
        const now = Date.now();
        const timePassed = (now - this.lastRefill) / 1000; // 秒

        // 添加新令牌
        this.tokens = Math.min(
            this.capacity,
            this.tokens + timePassed * this.rate
        );
        this.lastRefill = now;

        // 检查是否有可用令牌
        if (this.tokens >= 1) {
            this.tokens -= 1;
            return true;
        }

        return false;
    }

    // 获取下一次可请求的等待时间（毫秒）
    getWaitTime() {
        if (this.tokens >= 1) return 0;

        const tokensNeeded = 1 - this.tokens;
        const waitSeconds = tokensNeeded / this.rate;
        return Math.ceil(waitSeconds * 1000);
    }
}

// 创建限流器实例
const refreshLimiter = new TokenBucketRateLimiter(
    config.getConfig().maxRefreshRequestsPerSecond
);

// 安全检查函数 - 验证文件路径是否安全
function validateFilePath(requestedPath, baseDirectory, options = {}) {
    const {
        allowSymlinks = false,
        allowOutside = false,
        followSymlinks = false
    } = options;

    const result = {
        valid: false,
        realPath: null,
        error: null,
        warning: null,
        isSymlink: false,
        isOutside: false
    };

    try {
        // 构建完整路径
        const fullPath = path.join(baseDirectory, requestedPath);

        // 检查路径是否存在
        if (!fs.existsSync(fullPath)) {
            result.error = '文件或目录不存在';
            return result;
        }

        // 获取文件状态
        const stats = fs.lstatSync(fullPath);
        result.isSymlink = stats.isSymbolicLink();

        // 处理符号链接
        let resolvedPath;
        if (result.isSymlink) {
            if (!allowSymlinks) {
                result.error = '符号链接不被允许';
                return result;
            }

            if (followSymlinks) {
                // 解析符号链接到真实路径
                resolvedPath = fs.realpathSync(fullPath);
            } else {
                // 不跟踪符号链接，使用原路径
                resolvedPath = fullPath;
            }
        } else {
            resolvedPath = fs.realpathSync(fullPath);
        }

        // 规范化基础目录路径
        const normalizedBase = fs.realpathSync(baseDirectory);

        // 检查路径是否在允许的目录内
        if (!allowOutside && !resolvedPath.startsWith(normalizedBase + path.sep) && resolvedPath !== normalizedBase) {
            result.isOutside = true;
            result.error = '路径穿越检测：文件不在允许的目录内';
            result.realPath = resolvedPath;
            return result;
        }

        // 路径安全
        result.valid = true;
        result.realPath = resolvedPath;

        // 添加警告信息
        if (result.isSymlink) {
            result.warning = '访问了符号链接';
        }
        if (result.isOutside && allowOutside) {
            result.warning = '警告：文件位于允许目录之外';
        }

        return result;

    } catch (error) {
        result.error = `路径验证失败: ${error.message}`;
        return result;
    }
}

// 获取安全配置
function getSecurityOptions() {
    const cfg = config.getConfig();
    return {
        allowSymlinks: cfg.security?.allowSymlinks ?? false,
        allowOutside: cfg.security?.allowOutside ?? false,
        followSymlinks: cfg.security?.followSymlinks ?? false
    };
}

// 限速中间件
const speedLimitMiddleware = (req, res, next) => {
    const speedLimit = config.getSpeedLimit();
    if (!speedLimit) {
        return next();
    }

    // 保存原始的send方法
    const originalSend = res.send;
    let lastChunkTime = Date.now();
    let bytesSent = 0;

    // 创建限速的write方法
    const throttle = (chunk) => {
        const now = Date.now();
        const timeDiff = now - lastChunkTime;
        const expectedBytes = (speedLimit * timeDiff) / 1000;

        if (bytesSent + chunk.length > expectedBytes && timeDiff < 1000) {
            // 需要延迟
            const delay = ((bytesSent + chunk.length - expectedBytes) / speedLimit) * 1000;
            return new Promise(resolve => {
                setTimeout(() => {
                    bytesSent += chunk.length;
                    lastChunkTime = Date.now();
                    resolve(true);
                }, Math.min(delay, 1000));
            });
        } else {
            bytesSent += chunk.length;
            lastChunkTime = now;
            return Promise.resolve(true);
        }
    };

    // 重写res.send
    res.send = function(chunk) {
        if (chunk && typeof chunk === 'object') {
            return originalSend.call(this, chunk);
        }
        return originalSend.call(this, chunk);
    };

    next();
};

// 静态文件服务
app.use(express.static('public'));

// 请求日志中间件
app.use((req, res, next) => {
    config.log('info', `${req.method} ${req.url} - ${req.ip}`);
    next();
});

// API: 获取配置信息（不包含敏感信息）
app.get('/api/config', (req, res) => {
    const cfg = config.getConfig();
    res.json({
        success: true,
        config: {
            maxFilesToList: cfg.maxFilesToList,
            enableSpeedLimit: cfg.enableSpeedLimit,
            downloadSpeedLimit: cfg.downloadSpeedLimit,
            enableDirectoryBrowse: cfg.enableDirectoryBrowse,
            security: {
                allowSymlinks: cfg.security?.allowSymlinks ?? false,
                allowOutside: cfg.security?.allowOutside ?? false
            }
        }
    });
});

// API: 获取文件图标配置
app.get('/api/icons', (req, res) => {
    res.json({
        success: true,
        icons: config.getConfig().fileIcons || {},
        defaultIcon: config.getConfig().defaultFileIcon || '📄'
    });
});

// API: 获取文件列表（支持嵌套目录和数量限制）
app.get('/api/files', (req, res) => {
    // 限流检查
    if (!refreshLimiter.canMakeRequest()) {
        const waitTime = refreshLimiter.getWaitTime();
        config.log('warn', `刷新请求过于频繁，需要等待 ${waitTime}ms`);

        res.setHeader('Retry-After', Math.ceil(waitTime / 1000));
        return res.status(429).json({
            success: false,
            error: `请求过于频繁，请在 ${Math.ceil(waitTime / 1000)} 秒后重试`,
            retryAfter: waitTime
        });
    }

    const maxFiles = config.getMaxFilesToList();
    let totalFilesCount = 0;
    let isTruncated = false;
    const securityOptions = getSecurityOptions();

    const getFileTree = (dirPath, relativePath = '') => {
        // 检查是否达到文件数量限制
        if (maxFiles !== -1 && totalFilesCount >= maxFiles) {
            isTruncated = true;
            return [];
        }

        try {
            const items = fs.readdirSync(dirPath);
            const result = [];

            for (const item of items) {
                if (maxFiles !== -1 && totalFilesCount >= maxFiles) {
                    isTruncated = true;
                    break;
                }

                const fullPath = path.join(dirPath, item);
                const relativeItemPath = relativePath ? path.join(relativePath, item) : item;

                // 获取文件状态
                let stats;
                try {
                    stats = fs.lstatSync(fullPath);
                } catch (error) {
                    config.log('warn', `无法读取文件状态: ${fullPath}`, error.message);
                    continue;
                }

                // 检查符号链接
                const isSymlink = stats.isSymbolicLink();
                if (isSymlink && !securityOptions.allowSymlinks) {
                    config.log('debug', `跳过符号链接: ${item}`);
                    continue;
                }

                // 如果是符号链接且允许，但不需要跟踪，使用 lstat
                // 如果需要跟踪符号链接，获取实际指向的文件状态
                let actualStats = stats;
                let actualPath = fullPath;

                if (isSymlink && securityOptions.followSymlinks) {
                    try {
                        actualPath = fs.realpathSync(fullPath);
                        actualStats = fs.statSync(actualPath);
                    } catch (error) {
                        config.log('warn', `无法解析符号链接: ${fullPath}`, error.message);
                        continue;
                    }
                }

                if (actualStats.isDirectory()) {
                    const children = getFileTree(actualPath, relativeItemPath);
                    result.push({
                        name: item,
                        type: 'directory',
                        path: relativeItemPath,
                        children: children,
                        itemCount: children.length,
                        isSymlink: isSymlink
                    });
                    totalFilesCount += children.length;
                } else {
                    // 检查文件是否允许下载
                    if (config.isFileAllowed(item)) {
                        result.push({
                            name: item,
                            type: 'file',
                            path: relativeItemPath,
                            size: actualStats.size,
                            modified: actualStats.mtime,
                            icon: config.getFileIcon(item),
                            isSymlink: isSymlink
                        });
                        totalFilesCount++;
                    } else {
                        config.log('debug', `跳过不允许的文件: ${item}`);
                    }
                }
            }

            return result;
        } catch (error) {
            config.log('error', `读取目录失败: ${dirPath}`, error);
            return [];
        }
    };

    try {
        const filesDir = config.getConfig().resolvedFilesDirectory;
        const fileTree = getFileTree(filesDir);

        const response = {
            success: true,
            files: fileTree,
            stats: {
                totalCount: totalFilesCount,
                isTruncated: isTruncated,
                maxAllowed: maxFiles === -1 ? 'unlimited' : maxFiles
            }
        };

        if (isTruncated) {
            response.warning = `结果已截断，仅显示前 ${maxFiles} 个文件`;
            config.log('warn', `文件列表截断: 显示 ${totalFilesCount}/${maxFiles} 个文件`);
        }

        res.json(response);
    } catch (error) {
        config.log('error', '获取文件列表失败:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// API: 下载文件（支持限速和安全检查）
app.get('/api/download/*', speedLimitMiddleware, (req, res) => {
    const filePath = req.params[0];
    const baseDir = config.getConfig().resolvedFilesDirectory;
    const securityOptions = getSecurityOptions();

    // 安全检查
    const validation = validateFilePath(filePath, baseDir, {
        allowSymlinks: securityOptions.allowSymlinks,
        allowOutside: securityOptions.allowOutside,
        followSymlinks: securityOptions.followSymlinks
    });

    if (!validation.valid) {
        config.log('warn', `安全验证失败: ${filePath} from ${req.ip} - ${validation.error}`);

        // 如果是路径穿越尝试，记录更详细的警告
        if (validation.isOutside) {
            config.log('error', `⚠️ 检测到路径穿越尝试! 请求路径: ${filePath}, 真实路径: ${validation.realPath}, IP: ${req.ip}`);
        }

        return res.status(403).json({
            error: '访问被拒绝',
            reason: validation.error
        });
    }

    // 如果有警告，记录日志
    if (validation.warning) {
        config.log('warn', `⚠️ ${validation.warning}: ${filePath} from ${req.ip}`);
    }

    const realPath = validation.realPath;

    // 检查是否为目录
    try {
        const stats = fs.statSync(realPath);
        if (stats.isDirectory()) {
            return res.status(400).json({ error: '不能下载目录' });
        }
    } catch (error) {
        config.log('error', `无法获取文件状态: ${realPath}`, error);
        return res.status(500).json({ error: '文件状态获取失败' });
    }

    // 检查文件扩展名是否允许
    const fileName = path.basename(realPath);
    if (!config.isFileAllowed(fileName)) {
        config.log('warn', `尝试下载不允许的文件类型: ${fileName} from ${req.ip}`);
        return res.status(403).json({ error: '文件类型不允许下载' });
    }

    const stat = fs.statSync(realPath);

    // 记录下载日志
    const sizeMB = (stat.size / 1024 / 1024).toFixed(2);
    const symlinkInfo = validation.isSymlink ? ' [符号链接]' : '';
    config.log('info', `下载文件: ${fileName} (${sizeMB} MB)${symlinkInfo} - ${req.ip}`);

    // 设置响应头
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`);
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Length', stat.size);

    // 如果启用了限速，使用限速流
    const speedLimit = config.getSpeedLimit();
    if (speedLimit) {
        const stream = fs.createReadStream(realPath);
        let bytesSent = 0;
        let lastTime = Date.now();

        stream.on('data', (chunk) => {
            const now = Date.now();
            const timeDiff = now - lastTime;
            const expectedBytes = (speedLimit * timeDiff) / 1000;

            if (bytesSent + chunk.length > expectedBytes && timeDiff < 1000) {
                // 需要延迟
                const delay = ((bytesSent + chunk.length - expectedBytes) / speedLimit) * 1000;
                stream.pause();
                setTimeout(() => {
                    bytesSent += chunk.length;
                    lastTime = Date.now();
                    stream.resume();
                }, Math.min(delay, 1000));
            } else {
                bytesSent += chunk.length;
                lastTime = now;
            }
        });

        stream.pipe(res);

        stream.on('error', (err) => {
            config.log('error', `文件流错误: ${fileName}`, err);
            if (!res.headersSent) {
                res.status(500).json({ error: '下载失败' });
            }
        });
    } else {
        // 不限速，直接下载
        res.download(realPath, fileName, (err) => {
            if (err && !res.headersSent) {
                config.log('error', `下载失败: ${fileName}`, err);
                res.status(500).json({ error: '下载失败' });
            }
        });
    }
});

// 健康检查接口
app.get('/api/health', (req, res) => {
    const cfg = config.getConfig();
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        config: {
            filesDirectory: cfg.resolvedFilesDirectory,
            maxFilesToList: cfg.maxFilesToList,
            enableSpeedLimit: cfg.enableSpeedLimit,
            speedLimit: cfg.downloadSpeedLimit,
            refreshLimit: cfg.maxRefreshRequestsPerSecond
        },
        security: {
            allowSymlinks: cfg.security?.allowSymlinks ?? false,
            allowOutside: cfg.security?.allowOutside ?? false,
            followSymlinks: cfg.security?.followSymlinks ?? false
        }
    });
});

// 前端路由支持 - 所有非 API 和非静态资源的请求都返回 index.html
app.get('*', (req, res) => {
    // 排除 API 请求
    if (req.path.startsWith('/api/')) {
        return res.status(404).json({ error: 'API 端点不存在' });
    }

    // 排除静态资源请求（已经由 express.static 处理，这里作为后备）
    const ext = path.extname(req.path);
    if (ext && ext !== '.html') {
        return res.status(404).send('Not Found');
    }

    // 返回 index.html，让前端处理路由
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 获取本机 IP 地址的函数
const getLocalIPs = () => {
    const { networkInterfaces } = require('os');
    const nets = networkInterfaces();
    const ips = { ipv4: [], ipv6: [] };

    for (const name of Object.keys(nets)) {
        for (const net of nets[name]) {
            if (!net.internal) {
                if (net.family === 'IPv4') {
                    ips.ipv4.push(net.address);
                } else if (net.family === 'IPv6') {
                    ips.ipv6.push(net.address);
                }
            }
        }
    }
    return ips;
};

// 启动服务器 - 同时支持 IPv4 和 IPv6
const HOST = '::'; // 监听所有 IPv4 和 IPv6 地址
app.listen(PORT, HOST, () => {
    console.log('\n=================================');
    console.log('🚀 文件下载服务已启动');
    console.log('=================================');
    console.log(`📍 本地访问:`);
    console.log(`   - IPv4: http://localhost:${PORT}`);
    console.log(`   - IPv6: http://[::1]:${PORT}`);

    const ips = getLocalIPs();
    if (ips.ipv4.length > 0) {
        console.log(`📍 局域网 IPv4 访问:`);
        ips.ipv4.forEach(ip => {
            console.log(`   - http://${ip}:${PORT}`);
        });
    }

    if (ips.ipv6.length > 0) {
        console.log(`📍 局域网 IPv6 访问:`);
        ips.ipv6.forEach(ip => {
            console.log(`   - http://[${ip}]:${PORT}`);
        });
    }

    console.log(`📂 文件目录: ${config.getConfig().resolvedFilesDirectory}`);
    console.log(`⚙️  配置文件: ${config.configPath}`);
    console.log('=================================\n');

    // 显示配置信息
    const cfg = config.getConfig();
    console.log('配置信息:');
    console.log(`  - 最大文件数: ${cfg.maxFilesToList === -1 ? '无限制' : cfg.maxFilesToList}`);
    console.log(`  - 刷新限流: ${cfg.maxRefreshRequestsPerSecond} 次/秒`);
    console.log(`  - 下载限速: ${cfg.enableSpeedLimit ? (cfg.downloadSpeedLimit / 1024).toFixed(0) + ' KB/s' : '不限速'}`);
    console.log(`  - 日志级别: ${cfg.logLevel}`);

    // 显示安全配置
    const security = cfg.security || {};
    console.log('安全配置:');
    console.log(`  - 允许符号链接: ${security.allowSymlinks ? '✅ 是' : '❌ 否'}`);
    console.log(`  - 允许目录外访问: ${security.allowOutside ? '⚠️ 是 (危险)' : '❌ 否'}`);
    console.log(`  - 跟踪符号链接: ${security.followSymlinks ? '✅ 是' : '❌ 否'}`);

    // 如果启用了危险配置，显示警告
    if (security.allowOutside) {
        console.log('\n⚠️⚠️⚠️ 警告 ⚠️⚠️⚠️');
        console.log('已启用 "allowOutside" 配置，允许访问文件目录以外的文件！');
        console.log('这是危险配置，可能导致系统文件被泄露！');
        console.log('⚠️⚠️⚠️ 警告 ⚠️⚠️⚠️\n');
    }

    if (security.allowSymlinks) {
        console.log('\n⚠️ 注意: 已启用符号链接支持');
        if (security.followSymlinks) {
            console.log('   - 将跟踪符号链接到实际文件位置');
        } else {
            console.log('   - 将符号链接视为普通文件');
        }
        console.log('');
    }

    console.log('=================================\n');
});