const fs = require('fs');
const path = require('path');

// 默认配置
const defaultConfig = {
    // 文件目录配置
    filesDirectory: './files',  // 相对路径或绝对路径
    isAbsolutePath: false,      // 是否为绝对路径

    // 性能限制
    maxFilesToList: 20,         // 最大文件数量（-1表示无限制）
    maxRefreshRequestsPerSecond: 1,  // 每秒最多刷新请求次数

    // 下载限速配置
    enableSpeedLimit: false,     // 是否启用限速
    downloadSpeedLimit: 1024 * 1024,  // 限速大小 (bytes/秒)，默认1MB/s

    // 服务器配置
    port: 3000,                  // 服务端口
    enableDirectoryBrowse: true, // 是否启用目录浏览

    // 安全配置
    allowedFileExtensions: [],   // 允许的文件扩展名，空数组表示允许所有
    blockedFileExtensions: ['.exe', '.sh', '.bat'],  // 禁止下载的文件扩展名

    // 日志配置
    enableLogging: true,         // 是否启用日志
    logLevel: 'info'             // 日志级别: debug, info, warn, error
};

class ConfigManager {
    constructor(configPath = './config.json') {
        this.configPath = path.resolve(configPath);
        this.config = null;
        this.loadConfig();
    }

    // 加载配置文件
    loadConfig() {
        try {
            if (fs.existsSync(this.configPath)) {
                const configData = fs.readFileSync(this.configPath, 'utf8');
                const userConfig = JSON.parse(configData);
                this.config = { ...defaultConfig, ...userConfig };
                console.log('✅ 配置文件加载成功:', this.configPath);
                this.validateConfig();
            } else {
                console.log('⚠️  配置文件不存在，使用默认配置');
                this.config = { ...defaultConfig };
                this.saveConfig();
            }
        } catch (error) {
            console.error('❌ 配置文件读取失败:', error.message);
            console.log('使用默认配置并生成新配置文件');
            this.config = { ...defaultConfig };
            this.saveConfig();
        }

        // 解析文件目录路径
        this.resolveFilesDirectory();
        return this.config;
    }

    // 验证配置
    validateConfig() {
        if (this.config.maxFilesToList !== -1 && this.config.maxFilesToList < 1) {
            console.warn('⚠️ maxFilesToList 无效，使用默认值 20');
            this.config.maxFilesToList = 20;
        }

        if (this.config.maxRefreshRequestsPerSecond < 1) {
            console.warn('⚠️ maxRefreshRequestsPerSecond 无效，使用默认值 1');
            this.config.maxRefreshRequestsPerSecond = 1;
        }

        if (this.config.downloadSpeedLimit < 1024 && this.config.enableSpeedLimit) {
            console.warn('⚠️ downloadSpeedLimit 过小，设置为最小值 1KB/s');
            this.config.downloadSpeedLimit = 1024;
        }

        if (this.config.port < 1 || this.config.port > 65535) {
            console.warn('⚠️ 端口号无效，使用默认值 3000');
            this.config.port = 3000;
        }
    }

    // 解析文件目录为绝对路径
    resolveFilesDirectory() {
        let dirPath = this.config.filesDirectory;

        if (!this.config.isAbsolutePath) {
            // 相对路径，基于项目根目录
            dirPath = path.resolve(process.cwd(), dirPath);
        }

        this.config.resolvedFilesDirectory = dirPath;

        // 确保目录存在
        if (!fs.existsSync(dirPath)) {
            console.log(`📁 创建文件目录: ${dirPath}`);
            fs.mkdirSync(dirPath, { recursive: true });
        }

        console.log(`📂 文件目录: ${dirPath}`);
    }

    // 保存配置文件
    saveConfig() {
        try {
            const configToSave = { ...this.config };
            delete configToSave.resolvedFilesDirectory; // 不保存解析后的路径

            const configData = JSON.stringify(configToSave, null, 2);
            fs.writeFileSync(this.configPath, configData, 'utf8');
            console.log('💾 配置文件已保存:', this.configPath);
        } catch (error) {
            console.error('❌ 配置文件保存失败:', error.message);
        }
    }

    // 获取配置
    getConfig() {
        return this.config;
    }

    // 检查文件扩展名是否允许下载
    isFileAllowed(filename) {
        const ext = path.extname(filename).toLowerCase();

        // 检查黑名单
        if (this.config.blockedFileExtensions.includes(ext)) {
            return false;
        }

        // 检查白名单（如果设置了白名单）
        if (this.config.allowedFileExtensions.length > 0) {
            return this.config.allowedFileExtensions.includes(ext);
        }

        return true;
    }

    // 获取文件大小限制（用于显示）
    getMaxFilesToList() {
        return this.config.maxFilesToList;
    }

    // 获取限速设置
    getSpeedLimit() {
        if (!this.config.enableSpeedLimit) {
            return null;
        }
        return this.config.downloadSpeedLimit;
    }

    // 日志输出
    log(level, message, ...args) {
        const levels = { debug: 0, info: 1, warn: 2, error: 3 };
        const currentLevel = levels[this.config.logLevel];
        const messageLevel = levels[level];

        if (messageLevel >= currentLevel && this.config.enableLogging) {
            const timestamp = new Date().toISOString();
            console[level === 'error' ? 'error' : 'log'](
                `[${timestamp}] [${level.toUpperCase()}] ${message}`,
                ...args
            );
        }
    }
}

module.exports = new ConfigManager();