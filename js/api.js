// TradingDataHub API 封装
class TradingDataHubAPI {
    constructor(baseURL = 'http://localhost:8005') {
        this.baseURL = baseURL;
        this.retryCount = 3;
        this.retryDelay = 1000; // 1秒
    }

    async _request(endpoint, options = {}) {
        const url = `${this.baseURL}${endpoint}`;
        let lastError;
        
        for (let i = 0; i < this.retryCount; i++) {
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
                lastError = error;
                console.warn(`API请求失败 (${i + 1}/${this.retryCount}):`, error.message);
                
                if (i < this.retryCount - 1) {
                    await new Promise(resolve => setTimeout(resolve, this.retryDelay));
                }
            }
        }
        
        throw new Error(`接口请求失败，请重试: ${lastError.message}`);
    }

    // 批量获取股票实时价格（包含汇率）
    async getBatchQuotes(symbols, includeForex = true) {
        return await this._request('/api/stock/quotes', {
            method: 'POST',
            body: JSON.stringify({
                symbols,
                include_forex: includeForex
            })
        });
    }

    // 获取单个股票实时价格
    async getStockQuote(symbol) {
        return await this._request(`/api/stock/quote/${symbol}`);
    }

    // 获取汇率数据
    async getForexRates(pairs = ['USDCNY', 'HKDUSD']) {
        return await this._request('/api/forex/rates', {
            method: 'POST',
            body: JSON.stringify({ pairs })
        });
    }

    // 获取常用汇率
    async getCommonForexRates() {
        return await this._request('/api/forex/rates/common');
    }

    // 健康检查
    async healthCheck() {
        return await this._request('/api/health');
    }
}

// 全局API实例
const API = new TradingDataHubAPI();