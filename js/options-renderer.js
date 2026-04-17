// 期权表格渲染器
// 版本：1.0.0
// 创建时间：2026-04-17
// 遵循技术方案：期权持仓展示模块优化方案.md

class OptionsRenderer {
    constructor() {
        // 与主页面保持一致：5分钟刷新间隔
        this.refreshInterval = 300000; // 300秒 = 5分钟
        this.refreshTimer = null;
        this.lastUpdate = null;
        this.apiBaseUrl = '/api/portfolio/options';
        this.isRefreshing = false;
        this.optionsData = [];
    }
    
    /**
     * 初始化期权表格
     */
    async init() {
        console.log('期权渲染器初始化...');
        
        // 检查HTML元素是否存在
        if (!this.checkHtmlElements()) {
            console.error('期权表格HTML元素缺失，请检查index.html');
            return;
        }
        
        // 绑定刷新按钮事件
        this.bindEvents();
        
        // 初始加载数据
        await this.refreshOptionsData();
        
        // 启动定时刷新
        this.startAutoRefresh();
        
        console.log('期权渲染器初始化完成');
    }
    
    /**
     * 检查必要的HTML元素
     */
    checkHtmlElements() {
        const requiredElements = [
            'options-section',
            'options-table',
            'options-table-body',
            'options-total-value',
            'options-total-pnl',
            'options-count',
            'refresh-options',
            'options-last-updated'
        ];
        
        for (const id of requiredElements) {
            if (!document.getElementById(id)) {
                console.error(`缺少HTML元素: #${id}`);
                return false;
            }
        }
        
        return true;
    }
    
    /**
     * 绑定事件
     */
    bindEvents() {
        // 不再需要独立的刷新按钮，与主页面共用刷新
        // 期权数据会在主页面刷新时自动刷新
    }
    
    /**
     * 刷新期权数据
     * @param {boolean} force - 是否强制刷新
     */
    async refreshOptionsData(force = false) {
        if (this.isRefreshing && !force) return;
        
        this.isRefreshing = true;
        
        try {
            // 1. 从IndexedDB获取期权持仓
            const positions = await this.getOptionPositionsFromDB();
            
            if (positions.length === 0) {
                this.renderEmptyState();
                this.isRefreshing = false;
                return;
            }
            
            // 2. 提取期权代码
            const optionSymbols = positions.map(p => {
                if (p.option_details && p.option_details.option_symbol) {
                    return p.option_details.option_symbol;
                }
                return null;
            }).filter(symbol => symbol);
            
            if (optionSymbols.length === 0) {
                this.renderEmptyState();
                this.isRefreshing = false;
                return;
            }
            
            // 3. 批量查询期权权利金
            const quotes = await this.fetchOptionQuotes(optionSymbols);
            
            // 4. 获取标的股票价格
            const underlyingSymbols = [...new Set(positions.map(p => p.symbol))];
            const stockPrices = await this.fetchStockPrices(underlyingSymbols);
            
            // 5. 处理数据并渲染
            const optionsData = this.processOptionsData(positions, quotes, stockPrices);
            this.optionsData = optionsData;
            this.renderOptionsTable(optionsData);
            this.updateSummary(optionsData);
            this.updateLastUpdated();
            
            console.log('期权数据刷新完成，处理了', optionsData.length, '个期权');
            
        } catch (error) {
            console.error('刷新期权数据失败:', error);
            this.showError('刷新失败: ' + error.message);
            
            // 出错时显示模拟数据（开发阶段）
            const mockResult = await this.getMockOptionsData();
            if (mockResult.success) {
                this.optionsData = mockResult.data;
                this.renderOptionsTable(this.optionsData);
                this.updateSummary(this.optionsData);
                this.updateLastUpdated();
            }
        } finally {
            this.isRefreshing = false;
        }
    }
    
    /**
     * 从IndexedDB获取期权持仓
     */
    async getOptionPositionsFromDB() {
        try {
            // 假设IndexedDB实例可用
            if (typeof IndexedDB !== 'undefined') {
                const positions = await IndexedDB.getPositions();
                return positions.filter(p => p.type === 'option');
            }
            
            // 如果IndexedDB不可用，返回空数组
            console.warn('IndexedDB不可用，无法获取期权持仓');
            return [];
            
        } catch (error) {
            console.error('获取期权持仓失败:', error);
            return [];
        }
    }
    
    /**
     * 批量查询期权权利金
     * @param {Array} optionSymbols - 期权代码数组
     */
    async fetchOptionQuotes(optionSymbols) {
        try {
            const symbolsParam = optionSymbols.join(',');
            const response = await fetch(`/api/portfolio/options/batch-quotes?symbols=${encodeURIComponent(symbolsParam)}`);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const result = await response.json();
            
            if (!result.success) {
                throw new Error(result.error || '期权报价查询失败');
            }
            
            return result.data;
            
        } catch (error) {
            console.error('获取期权报价失败:', error);
            // 返回空对象，让后续处理决定
            return {};
        }
    }
    
    /**
     * 获取标的股票价格
     * @param {Array} symbols - 股票代码数组
     */
    async fetchStockPrices(symbols) {
        try {
            // 使用现有的股票API
            if (typeof API !== 'undefined') {
                const result = await API.getBatchQuotes(symbols, false);
                return result.stocks || {};
            }
            
            // 备用方案：直接调用API
            const symbolsParam = symbols.join(',');
            const response = await fetch(`/api/stock/quotes`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    symbols: symbolsParam,
                    include_forex: false
                })
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const result = await response.json();
            return result.stocks || {};
            
        } catch (error) {
            console.error('获取股票价格失败:', error);
            return {};
        }
    }
    
    /**
     * 处理期权数据
     * @param {Array} positions - 期权持仓
     * @param {Object} quotes - 期权报价
     * @param {Object} stockPrices - 股票价格
     */
    processOptionsData(positions, quotes, stockPrices) {
        return positions.map(position => {
            const optionSymbol = position.option_details?.option_symbol;
            const quote = quotes[optionSymbol] || {};
            const stockPrice = stockPrices[position.symbol]?.price || 0;
            
            // 使用OptionsUtils计算展示字段
            const optionData = OptionsUtils.extractOptionData(position);
            const displayFields = OptionsUtils.calculateDisplayFields(
                optionData,
                stockPrice,
                quote.premium || 0
            );
            
            return {
                ...position,
                ...displayFields,
                quote_data: quote
            };
        });
    }
    
    /**
     * 获取模拟期权数据（开发阶段使用）
     */
    async getMockOptionsData() {
        // 模拟API延迟
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // 模拟数据
        const mockData = [
            {
                标的: 'MU',
                期权代码: 'MU260424P358',
                方向: '卖出看跌',
                合约数: '1张',
                行权价: '358.00',
                开仓权利金: '250.00',
                当前权利金: '2.10',
                当前股价: '385.50',
                价差百分比: '7.13%',
                虚实状态: '虚值',
                距到期天数: 7,
                盈亏平衡点: '355.90',
                浮动盈亏: '40.00',
                市值: '210.00',
                状态颜色: 'blue',
                风险等级: '关注'
            },
            {
                标的: 'TSLA',
                期权代码: 'TSLA260501C250',
                方向: '买入看涨',
                合约数: '2张',
                行权价: '250.00',
                开仓权利金: '500.00',
                当前权利金: '5.80',
                当前股价: '245.30',
                价差百分比: '-1.92%',
                虚实状态: '虚值',
                距到期天数: 14,
                盈亏平衡点: '255.80',
                浮动盈亏: '-40.00',
                市值: '1160.00',
                状态颜色: 'yellow',
                风险等级: '警示'
            },
            {
                标的: 'AAPL',
                期权代码: 'AAPL260418C180',
                方向: '卖出看涨',
                合约数: '1张',
                行权价: '180.00',
                开仓权利金: '150.00',
                当前权利金: '1.20',
                当前股价: '175.50',
                价差百分比: '2.56%',
                虚实状态: '虚值',
                距到期天数: 1,
                盈亏平衡点: '181.50',
                浮动盈亏: '30.00',
                市值: '120.00',
                状态颜色: 'green',
                风险等级: '安全'
            }
        ];
        
        return {
            success: true,
            data: mockData
        };
    }
    
    /**
     * 渲染期权表格
     * @param {Array} optionsData - 期权数据数组
     */
    renderOptionsTable(optionsData) {
        const tbody = document.getElementById('options-table-body');
        if (!tbody) return;
        
        tbody.innerHTML = '';
        
        if (!optionsData || optionsData.length === 0) {
            tbody.innerHTML = '<tr><td colspan="14" class="text-center">暂无期权持仓</td></tr>';
            return;
        }
        
        // 按风险等级排序：危险 > 警示 > 关注 > 安全
        const riskOrder = { '危险': 0, '警示': 1, '关注': 2, '安全': 3 };
        const sortedData = [...optionsData].sort((a, b) => {
            return riskOrder[a.风险等级] - riskOrder[b.风险等级];
        });
        
        sortedData.forEach(option => {
            const row = this.createOptionRow(option);
            tbody.appendChild(row);
        });
    }
    
    /**
     * 创建期权行
     * @param {Object} option - 期权数据对象
     * @returns {HTMLElement} 表格行元素
     */
    createOptionRow(option) {
        const row = document.createElement('tr');
        
        // 基础信息
        row.appendChild(this.createCell(option.标的));
        row.appendChild(this.createCell(option.期权代码));
        row.appendChild(this.createCell(option.方向));
        row.appendChild(this.createCell(option.合约数));
        row.appendChild(this.createCell(option.行权价));
        
        // 权利金信息
        row.appendChild(this.createCell(option.开仓权利金));
        row.appendChild(this.createCell(option.当前权利金));
        row.appendChild(this.createCell(option.当前股价));
        
        // 价差和状态（带颜色）
        const priceDiffCell = this.createCell(option.价差百分比);
        priceDiffCell.classList.add(`status-${option.状态颜色}`);
        row.appendChild(priceDiffCell);
        
        // 虚实状态（带颜色）
        const statusCell = this.createCell(option.虚实状态);
        statusCell.classList.add(`status-${option.状态颜色}`);
        row.appendChild(statusCell);
        
        // 时间信息
        const daysCell = this.createCell(option.距到期天数);
        if (option.距到期天数 <= 3) {
            daysCell.classList.add('text-red-600', 'font-semibold');
        } else if (option.距到期天数 <= 7) {
            daysCell.classList.add('text-yellow-600', 'font-semibold');
        }
        row.appendChild(daysCell);
        
        // 盈亏平衡点
        row.appendChild(this.createCell(option.盈亏平衡点));
        
        // 浮动盈亏（带颜色）
        const pnlValue = parseFloat(option.浮动盈亏);
        const pnlCell = this.createCell(option.浮动盈亏);
        if (pnlValue > 0) {
            pnlCell.classList.add('pnl-positive');
        } else if (pnlValue < 0) {
            pnlCell.classList.add('pnl-negative');
        } else {
            pnlCell.classList.add('pnl-zero');
        }
        row.appendChild(pnlCell);
        
        // 市值
        row.appendChild(this.createCell(option.市值));
        
        return row;
    }
    
    /**
     * 创建表格单元格
     * @param {string} text - 单元格文本
     * @returns {HTMLElement} 单元格元素
     */
    createCell(text) {
        const td = document.createElement('td');
        td.textContent = text;
        td.className = 'px-4 py-3 text-sm';
        return td;
    }
    
    /**
     * 更新汇总信息
     * @param {Array} optionsData - 期权数据数组
     */
    updateSummary(optionsData) {
        if (!optionsData || optionsData.length === 0) {
            document.getElementById('options-total-value').textContent = '0';
            document.getElementById('options-total-pnl').textContent = '0';
            document.getElementById('options-count').textContent = '0';
            return;
        }
        
        const totalValue = optionsData.reduce((sum, option) => sum + parseFloat(option.市值), 0);
        const totalPnl = optionsData.reduce((sum, option) => sum + parseFloat(option.浮动盈亏), 0);
        
        document.getElementById('options-total-value').textContent = totalValue.toFixed(2);
        document.getElementById('options-count').textContent = optionsData.length;
        
        const pnlElement = document.getElementById('options-total-pnl');
        pnlElement.textContent = totalPnl.toFixed(2);
        pnlElement.className = totalPnl > 0 ? 'pnl-positive' : 
                              totalPnl < 0 ? 'pnl-negative' : 'pnl-zero';
        
        // 更新风险统计
        this.updateRiskStats(optionsData);
    }
    
    /**
     * 更新风险统计
     * @param {Array} optionsData - 期权数据数组
     */
    updateRiskStats(optionsData) {
        const riskStats = {
            危险: 0,
            警示: 0,
            关注: 0,
            安全: 0
        };
        
        optionsData.forEach(option => {
            if (riskStats.hasOwnProperty(option.风险等级)) {
                riskStats[option.风险等级]++;
            }
        });
        
        // 可以在这里添加风险统计显示
        console.log('期权风险统计:', riskStats);
    }
    
    /**
     * 更新最后更新时间
     */
    updateLastUpdated() {
        this.lastUpdate = new Date();
        const element = document.getElementById('options-last-updated');
        if (element) {
            element.textContent = this.lastUpdate.toLocaleTimeString();
        }
    }
    
    /**
     * 显示加载状态
     * @param {boolean} show - 是否显示加载
     */
    showLoading(show) {
        // 不再需要独立的加载状态，与主页面共用
        // 主页面顶部的加载指示器会统一显示
    }
    
    /**
     * 显示错误信息
     * @param {string} message - 错误消息
     */
    showError(message) {
        const tbody = document.getElementById('options-table-body');
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="14" class="text-center text-red-600 py-4">${message}</td></tr>`;
        }
        
        // 更新汇总信息为0
        document.getElementById('options-total-value').textContent = '0';
        document.getElementById('options-total-pnl').textContent = '0';
        document.getElementById('options-count').textContent = '0';
    }
    
    /**
     * 手动刷新触发（由主页面调用）
     */
    triggerManualRefresh() {
        this.refreshOptionsData(true);
    }
    
    /**
     * 启动自动刷新
     */
    startAutoRefresh() {
        if (this.refreshTimer) {
            clearInterval(this.refreshTimer);
        }
        
        this.refreshTimer = setInterval(() => {
            this.refreshOptionsData();
        }, this.refreshInterval);
        
        console.log(`期权自动刷新已启动，间隔: ${this.refreshInterval / 1000}秒`);
    }
    
    /**
     * 停止自动刷新
     */
    stopAutoRefresh() {
        if (this.refreshTimer) {
            clearInterval(this.refreshTimer);
            this.refreshTimer = null;
            console.log('期权自动刷新已停止');
        }
    }
    
    /**
     * 销毁实例
     */
    destroy() {
        this.stopAutoRefresh();
        console.log('期权渲染器已销毁');
    }
}

// 全局实例
const OptionsTable = new OptionsRenderer();

// 页面加载完成后初始化
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        OptionsTable.init();
    });
} else {
    // DOM已经加载完成
    OptionsTable.init();
}