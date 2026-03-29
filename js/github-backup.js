// GitHub 自动备份功能
class GitHubBackup {
    constructor() {
        this.repoOwner = 'your-github-username'; // 需要用户配置
        this.repoName = 'portfolio-backups';     // 需要用户配置
        this.githubToken = null;                 // 需要用户配置
        this.backupInterval = 24 * 60 * 60 * 1000; // 24小时
        this.backupTimer = null;
        this.isBackingUp = false;
    }

    // 配置 GitHub 信息
    configure(owner, repo, token) {
        this.repoOwner = owner;
        this.repoName = repo;
        this.githubToken = token;
        console.log('GitHub 备份已配置:', { owner, repo });
        return this;
    }

    // 检查配置是否完整
    isConfigured() {
        return this.repoOwner && this.repoName && this.githubToken;
    }

    // 生成备份数据
    async generateBackupData() {
        try {
            const data = await IndexedDB.exportData();
            
            // 添加备份元数据
            const backup = {
                ...data,
                backup_metadata: {
                    version: '1.0.0',
                    backup_time: new Date().toISOString(),
                    backup_type: 'daily',
                    data_schema: 'portfolio_v5',
                    record_count: {
                        positions: data.positions.length,
                        transactions: data.transactions.length,
                        snapshots: data.snapshots.length
                    }
                }
            };
            
            return JSON.stringify(backup, null, 2);
        } catch (error) {
            console.error('生成备份数据失败:', error);
            throw error;
        }
    }

    // 上传到 GitHub
    async uploadToGitHub(backupData) {
        if (!this.isConfigured()) {
            throw new Error('GitHub 配置不完整');
        }

        const now = new Date();
        const dateStr = now.toISOString().split('T')[0];
        const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '-');
        const filename = `portfolio_backup_${dateStr}_${timeStr}.json`;
        const filePath = `backups/${dateStr}/${filename}`;
        
        // 检查文件是否已存在
        const existingFile = await this.checkFileExists(filePath);
        if (existingFile) {
            console.log('文件已存在，跳过上传:', filePath);
            return existingFile.html_url;
        }

        // 创建文件
        const content = btoa(unescape(encodeURIComponent(backupData)));
        
        const response = await fetch(`https://api.github.com/repos/${this.repoOwner}/${this.repoName}/contents/${filePath}`, {
            method: 'PUT',
            headers: {
                'Authorization': `token ${this.githubToken}`,
                'Content-Type': 'application/json',
                'Accept': 'application/vnd.github.v3+json'
            },
            body: JSON.stringify({
                message: `Portfolio 备份 ${dateStr} ${timeStr}`,
                content: content,
                branch: 'main'
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(`GitHub API 错误: ${error.message}`);
        }

        const result = await response.json();
        console.log('备份上传成功:', result.content.html_url);
        return result.content.html_url;
    }

    // 检查文件是否存在
    async checkFileExists(filePath) {
        try {
            const response = await fetch(`https://api.github.com/repos/${this.repoOwner}/${this.repoName}/contents/${filePath}`, {
                headers: {
                    'Authorization': `token ${this.githubToken}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            });
            
            if (response.status === 200) {
                return await response.json();
            }
            return null;
        } catch (error) {
            console.warn('检查文件存在失败:', error);
            return null;
        }
    }

    // 执行备份
    async executeBackup() {
        if (this.isBackingUp) {
            console.log('备份正在进行中，跳过');
            return;
        }

        if (!this.isConfigured()) {
            console.warn('GitHub 配置不完整，跳过备份');
            return;
        }

        this.isBackingUp = true;
        console.log('开始执行 GitHub 备份...');

        try {
            // 1. 生成备份数据
            const backupData = await this.generateBackupData();
            
            // 2. 上传到 GitHub
            const backupUrl = await this.uploadToGitHub(backupData);
            
            // 3. 创建本地快照
            await this.createLocalSnapshot();
            
            // 4. 发送通知
            this.sendBackupNotification(backupUrl, true);
            
            console.log('GitHub 备份完成:', backupUrl);
            return backupUrl;
            
        } catch (error) {
            console.error('GitHub 备份失败:', error);
            this.sendBackupNotification(null, false, error.message);
            throw error;
        } finally {
            this.isBackingUp = false;
        }
    }

    // 创建本地快照
    async createLocalSnapshot() {
        try {
            // 获取当前持仓和现金数据
            const positions = await IndexedDB.getPositions();
            const cash = await IndexedDB.getCash();
            
            // 计算总资产（这里需要实际计算逻辑）
            // 简化版：只记录快照元数据
            const snapshotData = {
                snapshot_type: 'daily_backup',
                total_assets: 0, // 需要实际计算
                stock_value: 0,
                etf_value: 0,
                cash_equivalent_value: cash.usd_balance + cash.hkd_balance,
                cash_value: cash.reserve_amount + cash.investment_amount + cash.emergency_amount,
                total_pnl: 0,
                total_pnl_percent: 0,
                position_ratio: 0,
                goal_progress: 0,
                initial_assets: 4442000,
                three_year_goal: 5000000,
                market_context: {
                    backup_time: new Date().toISOString(),
                    backup_type: 'github_daily'
                },
                holdings: positions.map(p => ({
                    symbol: p.symbol,
                    name: p.name,
                    type: p.type,
                    shares: p.shares,
                    cost_price: p.cost_price,
                    current_price: 0, // 需要实际获取
                    market_value_cny: 0, // 需要实际计算
                    pnl_percent: 0,
                    currency: p.currency
                }))
            };
            
            await IndexedDB.createSnapshot(snapshotData);
            console.log('本地快照创建完成');
            
        } catch (error) {
            console.error('创建本地快照失败:', error);
        }
    }

    // 发送备份通知
    sendBackupNotification(backupUrl, success, errorMessage = null) {
        const now = new Date();
        const notification = {
            type: 'backup',
            timestamp: now.toISOString(),
            success,
            backup_url: backupUrl,
            error_message: errorMessage
        };
        
        // 保存到本地存储
        const notifications = JSON.parse(localStorage.getItem('backup_notifications') || '[]');
        notifications.unshift(notification);
        if (notifications.length > 50) {
            notifications.pop();
        }
        localStorage.setItem('backup_notifications', JSON.stringify(notifications));
        
        // 显示用户通知
        if (success) {
            this.showToast('备份成功', 'success');
        } else {
            this.showToast(`备份失败: ${errorMessage}`, 'error');
        }
    }

    // 显示 Toast 通知
    showToast(message, type = 'info') {
        // 创建 Toast 元素
        const toast = document.createElement('div');
        toast.className = `fixed bottom-4 right-4 px-4 py-3 rounded-lg shadow-lg z-50 ${
            type === 'success' ? 'bg-green-100 text-green-700 border border-green-200' :
            type === 'error' ? 'bg-red-100 text-red-700 border border-red-200' :
            'bg-blue-100 text-blue-700 border border-blue-200'
        }`;
        toast.innerHTML = `
            <div class="flex items-center gap-2">
                ${type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️'}
                <span>${message}</span>
            </div>
        `;
        
        document.body.appendChild(toast);
        
        // 3秒后自动移除
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 3000);
    }

    // 启动定时备份
    startAutoBackup() {
        if (this.backupTimer) {
            clearInterval(this.backupTimer);
        }
        
        // 计算到下一个 24:00 的时间
        const now = new Date();
        const nextBackup = new Date();
        nextBackup.setHours(24, 0, 0, 0); // 24:00
        
        let timeToNextBackup = nextBackup - now;
        if (timeToNextBackup < 0) {
            timeToNextBackup += 24 * 60 * 60 * 1000; // 如果已经过了24:00，加一天
        }
        
        console.log(`下次备份时间: ${new Date(now.getTime() + timeToNextBackup).toLocaleString()}`);
        
        // 设置定时器
        setTimeout(() => {
            this.executeBackup();
            this.backupTimer = setInterval(() => {
                this.executeBackup();
            }, this.backupInterval);
        }, timeToNextBackup);
        
        console.log('自动备份已启动');
    }

    // 停止定时备份
    stopAutoBackup() {
        if (this.backupTimer) {
            clearInterval(this.backupTimer);
            this.backupTimer = null;
            console.log('自动备份已停止');
        }
    }

    // 手动触发备份
    async manualBackup() {
        try {
            const backupUrl = await this.executeBackup();
            return { success: true, url: backupUrl };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // 获取备份历史
    async getBackupHistory(limit = 20) {
        try {
            const response = await fetch(`https://api.github.com/repos/${this.repoOwner}/${this.repoName}/contents/backups`, {
                headers: {
                    'Authorization': `token ${this.githubToken}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            });
            
            if (!response.ok) {
                throw new Error('获取备份历史失败');
            }
            
            const contents = await response.json();
            
            // 获取所有备份文件
            const backups = [];
            for (const item of contents) {
                if (item.type === 'dir') {
                    // 获取日期目录下的文件
                    const dateResponse = await fetch(item.url, {
                        headers: {
                            'Authorization': `token ${this.githubToken}`,
                            'Accept': 'application/vnd.github.v3+json'
                        }
                    });
                    
                    if (dateResponse.ok) {
                        const dateContents = await dateResponse.json();
                        for (const file of dateContents) {
                            if (file.type === 'file' && file.name.endsWith('.json')) {
                                backups.push({
                                    name: file.name,
                                    path: file.path,
                                    url: file.html_url,
                                    size: file.size,
                                    date: item.name,
                                    last_modified: file.git_url ? new Date(file.git_url.split('?')[1]) : null
                                });
                            }
                        }
                    }
                }
            }
            
            // 按日期倒序排序
            backups.sort((a, b) => {
                const dateA = new Date(a.date);
                const dateB = new Date(b.date);
                return dateB - dateA;
            });
            
            return backups.slice(0, limit);
            
        } catch (error) {
            console.error('获取备份历史失败:', error);
            return [];
        }
    }

    // 恢复备份
    async restoreBackup(filePath) {
        try {
            const response = await fetch(`https://api.github.com/repos/${this.repoOwner}/${this.repoName}/contents/${filePath}`, {
                headers: {
                    'Authorization': `token ${this.githubToken}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            });
            
            if (!response.ok) {
                throw new Error('获取备份文件失败');
            }
            
            const file = await response.json();
            const content = atob(file.content);
            const data = JSON.parse(content);
            
            // 导入数据
            await IndexedDB.importData(data);
            
            console.log('备份恢复成功');
            this.showToast('备份恢复成功', 'success');
            
            return { success: true };
            
        } catch (error) {
            console.error('恢复备份失败:', error);
            this.showToast(`恢复备份失败: ${error.message}`, 'error');
            return { success: false, error: error.message };
        }
    }
}

// 全局备份实例
const GitHubBackupService = new GitHubBackup();

// 导出为模块
if (typeof module !== 'undefined' && module.exports) {
    module.exports = GitHubBackupService;
}