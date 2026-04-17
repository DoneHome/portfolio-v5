/**
 * 持仓管理 API 封装
 * 与 TradingDataHub 的 portfolio API 交互
 */

class PortfolioAPI {
    constructor(baseURL = 'http://localhost:8005') {
        this.baseURL = baseURL;
        this.localVersion = '0';
        this.syncInterval = 30000; // 30秒同步一次
        this.syncTimer = null;
    }

    // ==================== 基础请求方法 ====================

    async _request(endpoint, options = {}) {
        const url = `${this.baseURL}${endpoint}`;
        
        try {
            const response = await fetch(url, {
                ...options,
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            return await response.json();
            
        } catch (error) {
            console.error(`API请求失败: ${endpoint}`, error);
            throw error;
        }
    }

    // ==================== 数据同步机制 ====================

    async syncData() {
        try {
            // 获取服务器数据
            const serverData = await this._request('/api/portfolio/positions');
            const serverVersion = serverData.data_version;
            
            // 对比版本号
            if (serverVersion !== this.localVersion) {
                // 更新本地数据
                await this._updateLocalData(serverData);
                this.localVersion = serverVersion;
                
                // 触发数据更新事件
                this._dispatchDataUpdate(serverData);
                
                return {
                    synced: true,
                    version: serverVersion,
                    message: '数据已同步'
                };
            } else {
                return {
                    synced: false,
                    version: serverVersion,
                    message: '数据已是最新'
                };
            }
            
        } catch (error) {
            console.error('数据同步失败:', error);
            return {
                synced: false,
                error: error.message,
                message: '同步失败，使用本地缓存'
            };
        }
    }

    async _updateLocalData(serverData) {
        try {
            // 更新 IndexedDB
            const db = await this._getDatabase();
            
            // 清空旧数据
            await db.clear('positions');
            await db.clear('goals');
            
            // 保存持仓
            for (const position of serverData.positions || []) {
                // 为 IndexedDB 准备数据：提取 option_symbol 到顶层
                const dbPosition = { ...position };
                
                // 对于期权，将 option_details.option_symbol 提取到顶层的 option_symbol 字段
                if (dbPosition.type === 'option' && dbPosition.option_details && dbPosition.option_details.option_symbol) {
                    dbPosition.option_symbol = dbPosition.option_details.option_symbol;
                } else {
                    // 非期权或期权代码为空，option_symbol 使用空字符串
                    // IndexedDB 的复合键不接受 null，但接受空字符串
                    dbPosition.option_symbol = '';
                }
                
                // 调试：检查键值
                // console.log('保存持仓:', {
                //     symbol: dbPosition.symbol,
                //     option_symbol: dbPosition.option_symbol,
                //     type: dbPosition.type,
                //     hasOptionDetails: !!dbPosition.option_details
                // });
                
                await db.put('positions', dbPosition);
            }
            
            // 保存目标配置
            if (serverData.goals) {
                // 为 goals 数据添加 id 字段，因为 goals 表的 keyPath 是 'id'
                const goalsWithId = {
                    id: 'current_goals',  // 固定 ID，只保存一份目标配置
                    ...serverData.goals
                };
                await db.put('goals', goalsWithId);
            }
            
            // 保存元数据
            await db.put('metadata', {
                key: 'data_version',
                value: serverData.data_version,
                updated_at: new Date().toISOString()
            });
            
            console.log('本地数据已更新');
            
        } catch (error) {
            console.error('_updateLocalData() 执行失败:', error);
            throw error;
        }
    }

    _dispatchDataUpdate(data) {
        // 触发自定义事件，让其他组件知道数据已更新
        const event = new CustomEvent('portfolio-data-updated', {
            detail: data
        });
        window.dispatchEvent(event);
    }

    // ==================== 交易记录 API ====================

    async addTransaction(transactionData) {
        try {
            console.log('提交交易记录:', transactionData);
            
            const result = await this._request('/api/portfolio/transactions', {
                method: 'POST',
                body: JSON.stringify(transactionData)
            });
            
            if (result.success) {
                // 交易成功，触发数据同步
                await this.syncData();
                
                return {
                    success: true,
                    transactionId: result.id,
                    message: '交易记录已保存'
                };
            } else {
                throw new Error(result.message || '交易记录保存失败');
            }
            
        } catch (error) {
            console.error('提交交易记录失败:', error);
            return {
                success: false,
                error: error.message,
                message: '交易记录保存失败'
            };
        }
    }

    async getTransactions(options = {}) {
        const { symbol, limit = 50, offset = 0 } = options;
        let endpoint = `/api/portfolio/transactions?limit=${limit}&offset=${offset}`;
        
        if (symbol) {
            endpoint += `&symbol=${encodeURIComponent(symbol)}`;
        }
        
        return await this._request(endpoint);
    }

    // ==================== 持仓管理 API ====================

    async getPositions() {
        return await this._request('/api/portfolio/positions');
    }

    async deletePosition(symbol) {
        try {
            const result = await this._request(`/api/portfolio/positions/${encodeURIComponent(symbol)}`, {
                method: 'DELETE'
            });
            
            if (result.success) {
                await this.syncData();
                return result;
            } else {
                throw new Error(result.message || '删除持仓失败');
            }
            
        } catch (error) {
            console.error('删除持仓失败:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // ==================== 目标配置 API ====================

    async getGoals() {
        return await this._request('/api/portfolio/goals');
    }

    async updateGoals(goalsData) {
        try {
            const result = await this._request('/api/portfolio/goals', {
                method: 'PUT',
                body: JSON.stringify(goalsData)
            });
            
            if (result.success) {
                await this.syncData();
                return result;
            } else {
                throw new Error(result.message || '更新目标配置失败');
            }
            
        } catch (error) {
            console.error('更新目标配置失败:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // ==================== 快照管理 API ====================

    async getSnapshots(options = {}) {
        const { snapshot_type = 'daily', limit = 30, offset = 0 } = options;
        const endpoint = `/api/portfolio/snapshots?snapshot_type=${snapshot_type}&limit=${limit}&offset=${offset}`;
        
        return await this._request(endpoint);
    }

    async getSnapshotDetail(snapshotId) {
        return await this._request(`/api/portfolio/snapshots/${snapshotId}`);
    }

    async getLatestSnapshot() {
        return await this._request('/api/portfolio/snapshots/latest');
    }

    async compareSnapshots(id1, id2) {
        return await this._request(`/api/portfolio/snapshots/compare?id1=${id1}&id2=${id2}`);
    }

    async getSnapshotStats(days = 30) {
        return await this._request(`/api/portfolio/snapshots/stats?days=${days}`);
    }

    // ==================== 定时同步 ====================

    startAutoSync() {
        if (this.syncTimer) {
            clearInterval(this.syncTimer);
        }
        
        this.syncTimer = setInterval(() => {
            this.syncData().catch(console.error);
        }, this.syncInterval);
        
        console.log(`自动同步已启动，间隔: ${this.syncInterval / 1000}秒`);
    }

    stopAutoSync() {
        if (this.syncTimer) {
            clearInterval(this.syncTimer);
            this.syncTimer = null;
            console.log('自动同步已停止');
        }
    }

    // ==================== 本地存储辅助方法 ====================

    async _getDatabase() {
        // 复用现有的 IndexedDB 封装
        if (typeof IndexedDB !== 'undefined' && IndexedDB.init) {
            // IndexedDB 已经是实例，直接使用
            return IndexedDB;
        }
        
        // 如果 IndexedDB 不存在，返回模拟对象（降级处理）
        console.warn('IndexedDB 不可用，使用模拟存储');
        return {
            clear: async (storeName) => {
                console.log(`模拟清空 ${storeName}`);
            },
            put: async (storeName, data) => {
                console.log(`模拟保存到 ${storeName}:`, data);
            }
        };
    }

    // ==================== 初始化 ====================

    async initialize() {
        try {
            // 检查 API 连接
            await this._request('/api/health');
            console.log('✅ Portfolio API 连接正常');
            
            // 初始同步
            const syncResult = await this.syncData();
            console.log('初始同步结果:', syncResult.message);
            
            // 启动自动同步
            this.startAutoSync();
            
            return {
                success: true,
                message: 'Portfolio API 初始化完成'
            };
            
        } catch (error) {
            console.error('Portfolio API 初始化失败:', error);
            return {
                success: false,
                error: error.message,
                message: 'API 连接失败，使用离线模式'
            };
        }
    }
}

// 全局实例
const Portfolio = new PortfolioAPI();

// 页面加载时自动初始化
document.addEventListener('DOMContentLoaded', () => {
    Portfolio.initialize().then(result => {
        if (result.success) {
            console.log('🎯 Portfolio 系统就绪');
        } else {
            console.warn('⚠️ Portfolio 系统初始化失败，部分功能可能受限');
        }
    });
});

// 导出
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { PortfolioAPI, Portfolio };
}