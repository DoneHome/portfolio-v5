// 后端 API 数据库操作
class PortfolioAPI {
    constructor(baseURL = 'http://localhost:8005') {
        this.baseURL = baseURL;
    }

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
            console.error('API请求失败:', error);
            throw error;
        }
    }

    // 获取完整持仓数据（包含版本号）
    async getPortfolioData() {
        try {
            const result = await this._request('/api/portfolio/positions');
            return {
                success: true,
                data_version: result.data_version || '0',
                positions: result.positions || [],
                goals: result.goals || {},
                investment_plans: result.investment_plans || []
            };
        } catch (error) {
            console.warn('获取后端持仓数据失败，使用本地缓存:', error);
            return {
                success: false,
                data_version: '0',
                positions: [],
                goals: {},
                investment_plans: []
            };
        }
    }

    // 获取持仓列表（兼容旧接口）
    async getPositions() {
        const result = await this.getPortfolioData();
        return result.positions;

    // 获取现金等价物
    async getCashEquivalents() {
        const positions = await this.getPositions();
        return positions.filter(p => p.type === 'cash_equivalent');
    }

    // 获取现金数据
    async getCash() {
        const result = await this._request('/api/portfolio/cash');
        return result.data || { total: 0, usd: 0, hkd: 0, allocation: { reserve: 0, investment: 0, emergency: 0 } };
    }

    // 获取年初资产
    async getInitialAssets() {
        // 从快照获取最新记录
        const snapshots = await this.getSnapshots('daily', 1);
        if (snapshots.length > 0 && snapshots[0].initial_assets) {
            return snapshots[0].initial_assets;
        }
        return null;
    }

    // 获取三年目标
    async getThreeYearGoal() {
        return 5000000; // 默认值
    }

    // 获取交易记录
    async getTransactions(limit = 100) {
        const result = await this._request(`/api/portfolio/transactions?limit=${limit}`);
        return result.data || [];
    }

    // 添加交易记录
    async addTransaction(transaction) {
        return await this._request('/api/portfolio/transactions', {
            method: 'POST',
            body: JSON.stringify(transaction)
        });
    }

    // 获取快照列表
    async getSnapshots(type = null, limit = 100) {
        let url = `/api/portfolio/snapshots?limit=${limit}`;
        if (type) url += `&type=${type}`;
        const result = await this._request(url);
        return result.data || [];
    }

    // 创建快照
    async createSnapshot(data) {
        return await this._request('/api/portfolio/snapshots', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }

    // 导出数据
    async exportData() {
        const positions = await this.getPositions();
        const transactions = await this.getTransactions();
        const cash = await this.getCash();
        return {
            positions,
            transactions,
            cash,
            exportTime: new Date().toISOString()
        };
    }

    // 导入数据（待实现）
    async importData(jsonData) {
        // TODO: 实现批量导入
        console.log('导入数据:', jsonData);
        return true;
    }
}

// 全局 API 实例
const DB = new PortfolioAPI();