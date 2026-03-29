// 主程序逻辑 - 新版（使用 IndexedDB）
class PortfolioApp {
    constructor() {
        this.refreshInterval = 30000; // 30秒
        this.refreshTimer = null;
        this.isRefreshing = false;
        this.lastData = null;
        this.db = null;
        this.backupService = null;
        this.currentMarketFilter = 'all';
        
        this.init();
    }

    // 初始化应用
    async init() {
        console.log('Portfolio v5 前端初始化...');
        
        // 初始化 IndexedDB
        await this.initDatabase();
        
        // 绑定事件
        this.bindEvents();
        
        // 初始加载数据
        await this.loadData();
        
        // 启动自动刷新
        this.startAutoRefresh();
        
        // 初始化 GitHub 备份（需要用户配置）
        this.initBackupService();
        
        console.log('Portfolio v5 前端初始化完成');
    }

    // 初始化数据库
    async initDatabase() {
        try {
            this.db = IndexedDB;
            await this.db.init();
            
            // 初始化示例数据（如果数据库为空）
            const positions = await this.db.getPositions();
            if (positions.length === 0) {
                console.log('数据库为空，初始化示例数据...');
                await this.db.initSampleData();
            }
            
            console.log('数据库初始化完成');
        } catch (error) {
            console.error('数据库初始化失败:', error);
            throw error;
        }
    }

    // 初始化备份服务
    initBackupService() {
        this.backupService = GitHubBackupService;
        
        // 检查是否有保存的配置
        const savedConfig = localStorage.getItem('github_backup_config');
        if (savedConfig) {
            const config = JSON.parse(savedConfig);
            this.backupService.configure(config.owner, config.repo, config.token);
            
            // 启动自动备份
            this.backupService.startAutoBackup();
        }
    }

    // 绑定事件
    bindEvents() {
        // 刷新按钮
        const refreshBtn = document.getElementById('refresh-btn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => this.loadData(true));
        }

        // 录入交易按钮
        const addTradeBtn = document.getElementById('add-trade-btn');
        if (addTradeBtn) {
            addTradeBtn.addEventListener('click', () => this.openTradeModal());
        }

        // 视角切换
        const perspectiveToggle = document.getElementById('perspective-toggle');
        if (perspectiveToggle) {
            perspectiveToggle.addEventListener('click', () => {
                const isCost = Renderer.togglePerspective();
                console.log('切换视角:', isCost ? '成本视角' : '现价视角');
                // 重新渲染数据
                if (this.lastData) {
                    this.renderData(this.lastData);
                }
            });
        }

        // 排序选择
        const sortSelect = document.getElementById('sort-select');
        if (sortSelect) {
            sortSelect.addEventListener('change', (e) => {
                this.sortTable(e.target.value);
            });
        }

        // 市场筛选按钮
        const filterAll = document.querySelector('[data-filter="all"]');
        const filterUs = document.querySelector('[data-filter="us"]');
        const filterHk = document.querySelector('[data-filter="hk"]');

        if (filterAll) {
            filterAll.addEventListener('click', () => {
                this.currentMarketFilter = 'all';
                this.updateFilterButtons('all');
                this.filterByMarket('all');
            });
        }
        if (filterUs) {
            filterUs.addEventListener('click', () => {
                this.currentMarketFilter = 'us';
                this.updateFilterButtons('us');
                this.filterByMarket('美股');
            });
        }
        if (filterHk) {
            filterHk.addEventListener('click', () => {
                this.currentMarketFilter = 'hk';
                this.updateFilterButtons('hk');
                this.filterByMarket('港股');
            });
        }

        // 交易模态框
        const tradeModal = document.getElementById('trade-modal');
        const closeModal = document.getElementById('close-modal');
        const cancelModal = document.getElementById('cancel-modal');
        const tradeForm = document.getElementById('trade-form');

        if (closeModal) {
            closeModal.addEventListener('click', () => this.closeTradeModal());
        }
        if (cancelModal) {
            cancelModal.addEventListener('click', () => this.closeTradeModal());
        }
        if (tradeForm) {
            tradeForm.addEventListener('submit', (e) => this.handleTradeSubmit(e));
        }

        // 点击模态框外部关闭
        if (tradeModal) {
            tradeModal.addEventListener('click', (e) => {
                if (e.target === tradeModal) {
                    this.closeTradeModal();
                }
            });
        }

        // 页面可见性变化时控制自动刷新
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.stopAutoRefresh();
            } else {
                this.startAutoRefresh();
                // 页面重新可见时立即刷新数据
                this.loadData(true);
            }
        });
    }

    // 加载数据
    async loadData(forceRefresh = false) {
        if (this.isRefreshing && !forceRefresh) return;
        
        this.isRefreshing = true;
        Renderer.showLoading(true);
        
        try {
            // 1. 从 IndexedDB 获取持仓数据
            const positions = await this.db.getPositions();
            const symbols = positions.map(p => p.symbol);
            
            // 2. 批量查询股票价格和汇率
            if (symbols.length === 0) {
                // 没有持仓时显示空状态
                this.renderEmptyState();
                Renderer.showLoading(false);
                this.isRefreshing = false;
                return;
            }

            const batchData = await API.getBatchQuotes(symbols, true);
            
            if (batchData.errors && Object.keys(batchData.errors).length > 0) {
                console.warn('部分股票查询失败:', batchData.errors);
            }

            // 3. 获取汇率数据
            const forexRates = batchData.forex_rates || {};
            
            // 4. 获取现金数据
            const cash = await this.db.getCash();
            
            // 5. 计算所有指标
            const calculator = new PortfolioCalculator();
            calculator.positions = positions; // 使用数据库中的持仓
            calculator.cashEquivalents = positions.filter(p => p.type === 'cash_equivalent'); // 现金等价物
            calculator.cash = {
                total: cash.reserve_amount + cash.investment_amount + cash.emergency_amount,
                allocation: {
                    reserve: cash.reserve_amount,
                    investment: cash.investment_amount,
                    emergency: cash.emergency_amount
                }
            };
            calculator.initialAssets = 4442000; // 从数据库获取或使用默认值
            calculator.threeYearGoal = 5000000; // 从数据库获取或使用默认值
            
            const calculatedData = calculator.calculateAll(batchData.stocks, forexRates);
            this.lastData = calculatedData;

            // 6. 渲染页面
            this.renderData(calculatedData);

            // 7. 清除错误提示（如果有）
            const errorToast = document.getElementById('error-toast');
            if (errorToast) {
                errorToast.classList.add('hidden');
            }

        } catch (error) {
            console.error('数据加载失败:', error);
            Renderer.showError('接口请求失败，请重试');
            
            // 如果有上次成功的数据，继续显示
            if (this.lastData) {
                console.log('使用上次成功的数据');
                this.renderData(this.lastData);
            }
        } finally {
            this.isRefreshing = false;
            Renderer.showLoading(false);
        }
    }

    // 渲染数据
    renderData(data) {
        // 更新仪表盘
        Renderer.updateDashboard(data);
        
        // 渲染表格（应用当前筛选）
        this.filterByMarket(this.currentMarketFilter === 'all' ? 'all' : 
                           this.currentMarketFilter === 'us' ? '美股' : '港股');
        
        // 渲染机会与风险
        Renderer.renderOpportunities(data.opportunities);
        Renderer.renderRisks(data.risks);
    }

    // 渲染空状态（无持仓时）
    renderEmptyState() {
        // 更新仪表盘为0
        Renderer.updateDashboard({
            totalAssetsCNY: 0,
            totalPnlCNY: 0,
            totalPnlPercent: 0,
            positionRatio: 0,
            goalProgress: 0,
            initialAssets: 0,
            cash: { total: 0, allocation: { reserve: 0, investment: 0, emergency: 0 } }
        });
        
        // 清空表格
        Renderer.renderEquityTable([]);
        Renderer.renderETFTable([]);
        
        // 清空机会与风险
        Renderer.renderOpportunities([]);
        Renderer.renderRisks([]);
        
        // 显示提示
        const lastUpdated = document.getElementById('last-updated');
        if (lastUpdated) {
            lastUpdated.innerHTML = `
                <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
                暂无持仓数据，请点击"录入交易"添加
            `;
        }
    }

    // 排序表格
    sortTable(criteria) {
        if (!this.lastData) return;
        
        let sortedStocks = [...this.lastData.equityStocks];
        
        switch (criteria) {
            case 'weight':
                sortedStocks.sort((a, b) => {
                    const weightA = (a.marketValueCNY / this.lastData.totalAssetsCNY) * 100;
                    const weightB = (b.marketValueCNY / this.lastData.totalAssetsCNY) * 100;
                    return weightB - weightA;
                });
                break;
            case 'pnl':
                sortedStocks.sort((a, b) => b.pnlPercent - a.pnlPercent);
                break;
            case 'pnlAmount':
                sortedStocks.sort((a, b) => b.pnlAmountCNY - a.pnlAmountCNY);
                break;
            case 'today':
                sortedStocks.sort((a, b) => b.todayChange - a.todayChange);
                break;
        }
        
        Renderer.renderEquityTable(sortedStocks);
    }

    // 按市场筛选
    filterByMarket(market) {
        if (!this.lastData) return;

        let filteredStocks = [...this.lastData.equityStocks];

        if (market !== 'all') {
            filteredStocks = filteredStocks.filter(stock => stock.market === market);
        }

        Renderer.renderEquityTable(filteredStocks);
        
        // 渲染 ETF 和现金等价物（不受市场筛选影响）
        Renderer.renderETFTable(this.lastData.etfStocks || []);
        Renderer.renderCashEquivalentTable(this.lastData.cashEquivalents || []);
    }

    // 更新筛选按钮样式
    updateFilterButtons(activeFilter) {
        const filterAll = document.querySelector('[data-filter="all"]');
        const filterUs = document.querySelector('[data-filter="us"]');
        const filterHk = document.querySelector('[data-filter="hk"]');

        // 重置所有按钮样式
        [filterAll, filterUs, filterHk].forEach(btn => {
            if (btn) {
                btn.className = 'px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded-full transition-colors';
            }
        });

        // 设置激活按钮样式
        let activeBtn;
        switch (activeFilter) {
            case 'all': activeBtn = filterAll; break;
            case 'us': activeBtn = filterUs; break;
            case 'hk': activeBtn = filterHk; break;
        }

        if (activeBtn) {
            activeBtn.className = 'px-2.5 py-1 text-xs font-medium text-gray-900 bg-gray-200 rounded-full';
        }
    }

    // 打开交易模态框
    openTradeModal(symbol = '') {
        const modal = document.getElementById('trade-modal');
        const symbolInput = document.getElementById('symbol-input');
        
        if (modal && symbolInput) {
            symbolInput.value = symbol;
            modal.classList.remove('hidden');
            
            // 设置默认值
            const today = new Date().toISOString().split('T')[0];
            document.getElementById('trade-date-input').value = today;
            document.getElementById('quantity-input').value = '';
            document.getElementById('price-input').value = '';
            document.getElementById('direction-select').value = 'buy';
            document.getElementById('currency-select').value = symbol.includes('.HK') ? 'HKD' : 'USD';
            document.getElementById('notes-input').value = '';
            
            // 如果提供了symbol，自动获取当前价格
            if (symbol) {
                this.fetchCurrentPrice(symbol);
            }
        }
    }

    // 关闭交易模态框
    closeTradeModal() {
        const modal = document.getElementById('trade-modal');
        if (modal) {
            modal.classList.add('hidden');
        }
    }

    // 获取当前价格
    async fetchCurrentPrice(symbol) {
        try {
            const quote = await API.getStockQuote(symbol);
            const priceInput = document.getElementById('price-input');
            if (priceInput && quote.price) {
                priceInput.value = quote.price.toFixed(2);
            }
        } catch (error) {
            console.warn('获取当前价格失败:', error);
        }
    }

    // 处理交易提交
    async handleTradeSubmit(e) {
        e.preventDefault();
        
        const symbol = document.getElementById('symbol-input').value.trim();
        const direction = document.getElementById('direction-select').value;
        const quantity = parseInt(document.getElementById('quantity-input').value);
        const price = parseFloat(document.getElementById('price-input').value);
        const tradeDate = document.getElementById('trade-date-input').value;
        const currency = document.getElementById('currency-select').value;
        const notes = document.getElementById('notes-input').value.trim();
        
        if (!symbol || !quantity || !price || !tradeDate) {
            alert('请填写完整信息（股票代码、数量、价格、交易日期）');
            return;
        }
        
        if (quantity <= 0 || price <= 0) {
            alert('数量和价格必须大于0');
            return;
        }
        
        try {
            // 验证股票代码
            await API.getStockQuote(symbol);
            
            // 保存交易记录
            const transaction = {
                symbol,
                name: symbol, // 实际应从API获取名称
                direction,
                quantity,
                price,
                currency,
                trade_date: tradeDate,
                notes,
                created_at: new Date().toISOString()
            };
            
            const transactionId = await this.db.addTransaction(transaction);
            
            if (transactionId) {
                alert('交易记录已保存');
                this.closeTradeModal();
                
                // 重新加载数据
                await this.loadData(true);
            } else {
                alert('保存失败，请重试');
            }
            
        } catch (error) {
            alert('股票代码无效或网络错误');
            console.error('交易提交失败:', error);
        }
    }

    // 启动自动刷新
    startAutoRefresh() {
        if (this.refreshTimer) {
            clearInterval(this.refreshTimer);
        }
        
        this.refreshTimer = setInterval(() => {
            if (!document.hidden && !this.isRefreshing) {
                console.log('自动刷新数据...');
                this.loadData();
            }
        }, this.refreshInterval);
        
        console.log('自动刷新已启动，间隔:', this.refreshInterval / 1000, '秒');
    }

    // 停止自动刷新
    stopAutoRefresh() {
        if (this.refreshTimer) {
            clearInterval(this.refreshTimer);
            this.refreshTimer = null;
            console.log('自动刷新已停止');
        }
    }

    // 导出数据
    async exportData() {
        try {
            const data = await this.db.exportData();
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `portfolio_v5_${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error('导出数据失败:', error);
            alert('导出数据失败: ' + error.message);
        }
    }

    // 导入数据
    async importData(file) {
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const data = JSON.parse(e.target.result);
                const success = await this.db.importData(data);
                if (success) {
                    alert('数据导入成功');
                    await this.loadData(true);
                } else {
                    alert('数据导入失败，请检查文件格式');
                }
            } catch (error) {
                alert('数据导入失败: ' + error.message);
            }
        };
        reader.readAsText(file);
    }
}

// 启动应用
document.addEventListener('DOMContentLoaded', () => {
    window.app = new PortfolioApp();
});