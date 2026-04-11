// 主程序逻辑 - 新版（使用 IndexedDB）
class PortfolioApp {
    constructor() {
        this.refreshInterval = 300000; // 300秒（5分钟）
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
        
        // 初始化折叠功能
        Renderer.initCollapse();
        
        console.log('Portfolio v5 前端初始化完成');
    }

    // 初始化数据库
    async initDatabase() {
        try {
            this.db = IndexedDB;
            await this.db.init();
            
            console.log('数据库初始化完成');
        } catch (error) {
            console.error('数据库初始化失败:', error);
            throw error;
        }
    }

    // 与后端数据同步
    async syncWithBackend() {
        try {
            // 1. 获取后端数据版本
            const backendData = await Portfolio.getPositions();
            const backendVersion = backendData.data_version;
            
            // 2. 获取本地缓存版本
            const localVersion = localStorage.getItem('portfolio_data_version') || '0';
            
            console.log(`版本对比: 后端=${backendVersion}, 本地=${localVersion}`);
            
            // 3. 如果后端版本更新，同步数据
            if (backendData.success && this.compareVersions(backendVersion, localVersion) > 0) {
                console.log('检测到后端数据更新，开始同步...');
                
                // 同步持仓数据
                if (backendData.positions && backendData.positions.length > 0) {
                    await this.db.clearPositions();
                    for (const position of backendData.positions) {
                        await this.db.addPosition(position);
                    }
                    console.log(`同步持仓数据: ${backendData.positions.length} 条记录`);
                }
                
                // 同步目标配置
                if (backendData.goals && Object.keys(backendData.goals).length > 0) {
                    // 这里可以添加目标配置的同步逻辑
                    console.log('同步目标配置:', backendData.goals);
                }
                
                // 更新本地版本号
                localStorage.setItem('portfolio_data_version', backendVersion);
                console.log('数据同步完成，更新本地版本号:', backendVersion);
                
            } else if (!backendData.success) {
                console.log('后端不可用，使用本地缓存数据');
            } else {
                console.log('本地数据已是最新，无需同步');
            }
            
        } catch (error) {
            console.warn('数据同步失败，使用本地缓存:', error);
        }
    }

    // 比较版本号（简单字符串比较）
    compareVersions(version1, version2) {
        // 将版本号转换为数字进行比较
        const v1 = parseInt(version1) || 0;
        const v2 = parseInt(version2) || 0;
        return v1 - v2;
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

        // 排序选择
        const sortSelect = document.getElementById('sort-select');
        if (sortSelect) {
            sortSelect.addEventListener('change', (e) => {
                this.sortTable(e.target.value);
            });
        }

        // 市场筛选按钮
        const filterAll = document.getElementById('filter-all');
        const filterUs = document.getElementById('filter-us');
        const filterHk = document.getElementById('filter-hk');

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
        
        if (closeModal) {
            closeModal.addEventListener('click', () => this.closeTradeModal());
        }
        if (cancelModal) {
            cancelModal.addEventListener('click', () => this.closeTradeModal());
        }
        
        // 资产类型标签切换
        this.bindAssetTypeTabs();
        
        // 使用事件委托绑定表单提交（避免DOM操作导致事件丢失）
        this.setupFormEventDelegation();

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

    // 设置表单事件委托（修复表单提交失效问题）
    setupFormEventDelegation() {
        console.log('设置表单事件委托');
        
        // 使用事件委托处理表单提交
        document.addEventListener('submit', (e) => {
            if (e.target && e.target.id === 'trade-form') {
                console.log('事件委托捕获到表单提交');
                e.preventDefault();
                this.handleTradeSubmit(e);
            }
        });
        
        // 使用事件委托处理按钮点击（备用方案）
        document.addEventListener('click', (e) => {
            if (e.target && e.target.type === 'submit' && e.target.closest('#trade-form')) {
                console.log('事件委托捕获到提交按钮点击');
                // 阻止默认行为，由表单提交事件处理
            }
        });
    }

    // 加载数据（带版本同步）
    async loadData(forceRefresh = false) {
        if (this.isRefreshing && !forceRefresh) return;
        
        this.isRefreshing = true;
        Renderer.showLoading(true);
        
        try {
            // 1. 检查后端数据版本并同步
            await this.syncWithBackend();
            
            // 2. 从 IndexedDB 获取持仓数据（同步后的最新数据）
            const positions = await this.db.getPositions();
            const symbols = positions.map(p => p.symbol);
            
            // 3. 批量查询股票价格和汇率
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

            // 4. 获取汇率数据
            const forexRates = batchData.forex_rates || {};
            
            // 5. 获取现金数据
            const cash = await this.db.getCash();
            
            // 6. 计算所有指标
            const calculator = new PortfolioCalculator();
            calculator.positions = positions.filter(p => p.type !== 'cash_equivalent'); // 股票和ETF（排除现金等价物）
            calculator.cashEquivalents = positions.filter(p => p.type === 'cash_equivalent'); // 现金等价物
            console.log('DEBUG: Cash equivalents from DB:', calculator.cashEquivalents);
            calculator.cash = {
                total: cash.reserve_amount + cash.investment_amount + cash.emergency_amount,
                usd_balance: cash.usd_balance || 0,
                hkd_balance: cash.hkd_balance || 0,
                allocation: {
                    reserve: cash.reserve_amount,
                    investment: cash.investment_amount,
                    emergency: cash.emergency_amount
                }
            };
            calculator.initialAssets = 1082990; // 2026年年初资产
            calculator.threeYearGoal = 5000000; // 从数据库获取或使用默认值
            
            const calculatedData = calculator.calculateAll(batchData.stocks, forexRates);
            console.log('DEBUG: Calculated cashEquivalents:', calculatedData.cashEquivalentStocks);
            
            // 合并现金数据（从数据库获取的现金 + 现金等价物计算值）
            const cashFromDB = {
                total: cash.reserve_amount + cash.investment_amount + cash.emergency_amount,
                usd_balance: cash.usd_balance || 0,
                hkd_balance: cash.hkd_balance || 0,
                allocation: {
                    reserve: cash.reserve_amount,
                    investment: cash.investment_amount,
                    emergency: cash.emergency_amount
                }
            };
            
            // 总资产 = 股票市值 + ETF市值 + 现金等价物市值 + 数据库现金
            const totalCash = cashFromDB.total + calculatedData.totalCashEquivalentValueCNY;
            
            this.lastData = {
                ...calculatedData,
                cash: {
                    total: totalCash,
                    usd_balance: cashFromDB.usd_balance,
                    hkd_balance: cashFromDB.hkd_balance,
                    allocation: cashFromDB.allocation
                }
            };

            // 6. 渲染页面
            this.renderData(this.lastData);

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
        Renderer.renderCashEquivalentTable(this.lastData.cashEquivalentStocks || []);
    }

    // 更新筛选按钮样式
    updateFilterButtons(activeFilter) {
        const filterAll = document.getElementById('filter-all');
        const filterUs = document.getElementById('filter-us');
        const filterHk = document.getElementById('filter-hk');

        // 重置所有按钮样式（浅灰色文字，无背景）
        [filterAll, filterUs, filterHk].forEach(btn => {
            if (btn) {
                btn.className = 'px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded-full transition-colors';
            }
        });

        // 设置激活按钮样式（深灰色背景，深色文字）
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

    // 绑定资产类型标签切换
    bindAssetTypeTabs() {
        const tabs = document.querySelectorAll('.asset-tab');
        const assetTypeSelect = document.getElementById('asset-type-select');
        const equityEtfFields = document.getElementById('equity-etf-fields');
        const optionFields = document.getElementById('option-fields');
        const cashFields = document.getElementById('cash-fields');
        
        console.log('绑定标签页，找到标签:', tabs.length);
        console.log('assetTypeSelect:', assetTypeSelect);
        console.log('optionFields:', optionFields);
        console.log('cashFields:', cashFields);
        
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const type = tab.dataset.type;
                console.log('切换到标签页:', type);
                
                // 更新隐藏字段
                if (assetTypeSelect) {
                    assetTypeSelect.value = type;
                    console.log('设置 asset-type-select 值为:', type);
                }
                
                // 更新标签样式
                tabs.forEach(t => {
                    t.className = 'asset-tab flex-1 py-2 px-4 text-sm font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-50 rounded-t-lg border-b-2 border-transparent';
                });
                tab.className = 'asset-tab flex-1 py-2 px-4 text-sm font-medium text-gray-900 bg-gray-100 rounded-t-lg border-b-2 border-gray-900';
                
                // 显示/隐藏对应字段
                if (equityEtfFields) {
                    const shouldHide = type !== 'equity' && type !== 'etf';
                    equityEtfFields.classList.toggle('hidden', shouldHide);
                    console.log('equityEtfFields 隐藏状态:', shouldHide);
                }
                if (optionFields) {
                    const shouldHide = type !== 'option';
                    optionFields.classList.toggle('hidden', shouldHide);
                    console.log('optionFields 隐藏状态:', shouldHide);
                }
                if (cashFields) {
                    const shouldHide = type !== 'cash_equivalent';
                    cashFields.classList.toggle('hidden', shouldHide);
                    console.log('cashFields 隐藏状态:', shouldHide);
                }
                
                // 设置默认日期
                const today = new Date().toISOString().split('T')[0];
                const dateInputs = document.querySelectorAll('input[type="date"]');
                dateInputs.forEach(input => {
                    if (!input.value) input.value = today;
                });
            });
        });
    }

    // 打开交易模态框
    openTradeModal(symbol = '') {
        const modal = document.getElementById('trade-modal');
        
        if (modal) {
            modal.classList.remove('hidden');
            
            // 重置为股票标签
            const equityTab = document.querySelector('.asset-tab[data-type="equity"]');
            if (equityTab) {
                equityTab.click();
            }
            
            // 设置默认值
            const today = new Date().toISOString().split('T')[0];
            document.getElementById('trade-date-input').value = today;
            document.getElementById('option-trade-date-input').value = today;
            document.getElementById('cash-date-input').value = today;
            
            // 清空输入
            document.getElementById('symbol-input').value = symbol || '';
            document.getElementById('name-input').value = '';
            document.getElementById('quantity-input').value = '';
            document.getElementById('price-input').value = '';
            document.getElementById('direction-select').value = 'buy';
            
            // 清空期权字段
            document.getElementById('option-symbol-input').value = '';
            document.getElementById('option-type-select').value = 'call';
            document.getElementById('option-direction-select').value = 'buy';
            document.getElementById('strike-price-input').value = '';
            document.getElementById('expiry-date-input').value = '';
            document.getElementById('option-quantity-input').value = '';
            document.getElementById('premium-input').value = '';
            document.getElementById('option-strategy-input').value = '';
            document.getElementById('contract-multiplier-input').value = '100';
            document.getElementById('intrinsic-value-input').value = '';
            document.getElementById('time-value-input').value = '';
            document.getElementById('implied-volatility-input').value = '';
            
            // 清空现金等价物字段
            document.getElementById('cash-name-input').value = '';
            document.getElementById('cash-type-select').value = 'money_market';
            document.getElementById('cash-amount-input').value = '';
            document.getElementById('cash-currency-select').value = 'USD';
            document.getElementById('cash-direction-select').value = 'buy';
            document.getElementById('cash-yield-input').value = '';
            
            // 清空共用字段
            document.getElementById('notes-input').value = '';
            document.getElementById('currency-select').value = symbol && symbol.includes('.HK') ? 'HKD' : 'USD';
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

    // 处理交易提交（同步到后端）
    async handleTradeSubmit(e) {
        e.preventDefault();
        console.log('handleTradeSubmit 被调用');
        
        const assetType = document.getElementById('asset-type-select').value;
        console.log('当前资产类型:', assetType);
        
        let transaction;
        
        try {
            // 根据资产类型构建不同的交易数据
            switch (assetType) {
                case 'equity':
                case 'etf':
                    console.log('调用 buildEquityTransaction');
                    transaction = await this.buildEquityTransaction(assetType);
                    break;
                case 'option':
                    console.log('调用 buildOptionTransaction');
                    transaction = await this.buildOptionTransaction();
                    break;
                case 'cash_equivalent':
                    console.log('调用 buildCashTransaction');
                    transaction = await this.buildCashTransaction();
                    break;
                default:
                    console.error('未知的资产类型:', assetType);
                    throw new Error('未知的资产类型');
            }
            
            if (!transaction) {
                return; // 验证失败，已显示错误提示
            }
            
            // 调用后端 API
            console.log('提交交易到后端:', transaction);
            const backendResult = await Portfolio.addTransaction(transaction);
            
            if (backendResult && backendResult.success) {
                console.log('后端保存成功:', backendResult);
                
                // 4. 触发数据同步以获取最新持仓数据（Portfolio.addTransaction 内部已调用 syncData）
                // 这里只需要重新加载数据即可
                alert('交易记录已保存到服务器');
                this.closeTradeModal();
                
                // 5. 重新加载数据（会自动同步最新持仓）
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

    // 构建股票/ETF交易数据
    async buildEquityTransaction(assetType) {
        const symbol = document.getElementById('symbol-input').value.trim();
        const name = document.getElementById('name-input').value.trim();
        const direction = document.getElementById('direction-select').value;
        const quantity = parseFloat(document.getElementById('quantity-input').value);
        const price = parseFloat(document.getElementById('price-input').value);
        const tradeDate = document.getElementById('trade-date-input').value;
        const currency = document.getElementById('currency-select').value;
        const strategy = document.getElementById('strategy-select')?.value || '';
        const emotion = document.getElementById('emotion-select')?.value || '';
        const takeProfit = document.getElementById('take-profit-input')?.value ? parseFloat(document.getElementById('take-profit-input').value) : null;
        const stopLoss = document.getElementById('stop-loss-input')?.value ? parseFloat(document.getElementById('stop-loss-input').value) : null;
        const reason = document.getElementById('reason-input')?.value || '';
        const notes = document.getElementById('notes-input').value.trim();
        
        // 验证必填字段
        const missingFields = [];
        if (!symbol) missingFields.push('股票代码');
        if (!quantity) missingFields.push('数量');
        if (!price) missingFields.push('价格');
        if (!tradeDate) missingFields.push('交易日期');
        
        if (missingFields.length > 0) {
            alert(`请填写完整信息：${missingFields.join('、')}`);
            return null;
        }
        
        // 验证数值范围
        const invalidFields = [];
        if (quantity <= 0) invalidFields.push('数量必须大于0');
        if (price <= 0) invalidFields.push('价格必须大于0');
        
        if (invalidFields.length > 0) {
            alert(invalidFields.join('\n'));
            return null;
        }
        
        // 获取股票信息
        let stockName = symbol;
        let market = symbol.includes('.HK') ? 'HK' : 'US';
        
        try {
            const quote = await API.getStockQuote(symbol);
            stockName = quote.name || symbol;
        } catch (error) {
            console.warn('获取股票信息失败，使用默认值:', error);
        }
        
        return {
            symbol,
            name: name || stockName,  // 优先使用用户输入的名称
            market,
            type: assetType,
            direction,
            shares: quantity,
            price,
            currency,
            trade_date: tradeDate,
            strategy,
            emotion,
            take_profit: takeProfit,
            stop_loss: stopLoss,
            reason,
            notes,
            source: 'manual'
        };
    }
    
    // 构建期权交易数据
    async buildOptionTransaction() {
        const symbol = document.getElementById('option-symbol-input').value.trim();
        const optionType = document.getElementById('option-type-select').value;
        const direction = document.getElementById('option-direction-select').value;
        const tradeDate = document.getElementById('option-trade-date-input').value;
        const strikePrice = parseFloat(document.getElementById('strike-price-input').value);
        const expiryDate = document.getElementById('expiry-date-input').value;
        const quantity = parseFloat(document.getElementById('option-quantity-input').value);
        const premium = parseFloat(document.getElementById('premium-input').value);
        const strategy = (document.getElementById('option-strategy-input')?.value || '').trim();
        const notes = document.getElementById('notes-input').value.trim();
        
        // 希腊字母（可选）
        const delta = document.getElementById('delta-input')?.value ? parseFloat(document.getElementById('delta-input').value) : null;
        const gamma = document.getElementById('gamma-input')?.value ? parseFloat(document.getElementById('gamma-input').value) : null;
        const theta = document.getElementById('theta-input')?.value ? parseFloat(document.getElementById('theta-input').value) : null;
        const vega = document.getElementById('vega-input')?.value ? parseFloat(document.getElementById('vega-input').value) : null;
        
        // 新增期权字段
        const contractMultiplier = document.getElementById('contract-multiplier-input')?.value ? parseInt(document.getElementById('contract-multiplier-input').value) : 100;
        const intrinsicValue = document.getElementById('intrinsic-value-input')?.value ? parseFloat(document.getElementById('intrinsic-value-input').value) : null;
        const timeValue = document.getElementById('time-value-input')?.value ? parseFloat(document.getElementById('time-value-input').value) : null;
        const impliedVolatility = document.getElementById('implied-volatility-input')?.value ? parseFloat(document.getElementById('implied-volatility-input').value) : null;
        
        // 验证必填字段
        const missingFields = [];
        if (!symbol) missingFields.push('标的代码');
        if (!quantity) missingFields.push('合约数量');
        if (!premium) missingFields.push('权利金');
        if (!tradeDate) missingFields.push('交易日期');
        if (!strikePrice) missingFields.push('行权价');
        if (!expiryDate) missingFields.push('到期日');
        
        if (missingFields.length > 0) {
            alert(`请填写完整信息：${missingFields.join('、')}`);
            return null;
        }
        
        // 验证数值范围
        const invalidFields = [];
        if (quantity <= 0) invalidFields.push('合约数量必须大于0');
        if (premium <= 0) invalidFields.push('权利金必须大于0');
        if (strikePrice <= 0) invalidFields.push('行权价必须大于0');
        
        if (invalidFields.length > 0) {
            alert(invalidFields.join('\n'));
            return null;
        }
        
        // 构建期权代码（如：AAPL250417C150）
        const expiryStr = expiryDate.replace(/-/g, '').substring(2); // 250417
        const optionSymbol = `${symbol}${expiryStr}${optionType.toUpperCase().charAt(0)}${Math.round(strikePrice)}`;
        
        return {
            symbol: optionSymbol,
            underlying: symbol,
            name: `${symbol} ${expiryDate} ${optionType === 'call' ? 'Call' : 'Put'} @ ${strikePrice}`,
            market: symbol.includes('.HK') ? 'HK' : 'US',
            type: 'option',
            option_type: optionType,
            direction: direction.includes('buy') ? 'buy' : 'sell',
            is_opening: direction.includes('buy') ? direction === 'buy' : direction === 'sell',
            shares: quantity,
            price: premium,
            strike_price: strikePrice,
            expiry_date: expiryDate,
            currency: 'USD',
            trade_date: tradeDate,
            strategy,
            greeks: { delta, gamma, theta, vega },
            notes,
            source: 'manual',
            option_details: {
                contract_multiplier: contractMultiplier,
                intrinsic_value: intrinsicValue,
                time_value: timeValue,
                implied_volatility: impliedVolatility,
                strike_price: strikePrice,
                expiry_date: expiryDate,
                option_type: optionType,
                greeks: { delta, gamma, theta, vega }
            }
        };
    }
    
    // 构建现金等价物交易数据
    async buildCashTransaction() {
        const name = document.getElementById('cash-name-input').value.trim();
        const cashType = document.getElementById('cash-type-select').value;
        const amount = parseFloat(document.getElementById('cash-amount-input').value);
        const currency = document.getElementById('cash-currency-select').value;
        const tradeDate = document.getElementById('cash-date-input').value;
        const direction = document.getElementById('cash-direction-select').value;
        const yield_rate = document.getElementById('cash-yield-input')?.value ? parseFloat(document.getElementById('cash-yield-input').value) : null;
        const notes = document.getElementById('notes-input').value.trim();
        
        // 验证必填字段
        const missingFields = [];
        if (!name) missingFields.push('资产名称');
        if (!amount) missingFields.push('金额');
        if (!tradeDate) missingFields.push('交易日期');
        
        if (missingFields.length > 0) {
            alert(`请填写完整信息：${missingFields.join('、')}`);
            return null;
        }
        
        // 验证数值范围
        if (amount <= 0) {
            alert('金额必须大于0');
            return null;
        }
        
        // 生成唯一代码
        const typeMap = { money_market: 'MMF', deposit: 'DEP', bond: 'BOND', tbill: 'TB', other: 'CASH' };
        const typeCode = typeMap[cashType] || 'CASH';
        const symbol = `${typeCode}_${name.substring(0, 10).replace(/\s+/g, '_').toUpperCase()}`;
        
        return {
            symbol,
            name,
            market: currency === 'CNY' ? 'CN' : (currency === 'HKD' ? 'HK' : 'US'),
            type: 'cash_equivalent',
            cash_subtype: cashType,
            direction,
            shares: amount,
            price: 1.0,
            currency,
            trade_date: tradeDate,
            yield_rate,
            notes,
            source: 'manual',
            cash_details: {
                cash_subtype: cashType,
                yield_rate: yield_rate
            }
        };
    }
}

// 菜单自适应逻辑
function initAdaptiveMenus() {
    // 点击菜单按钮时调整位置
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('menu-trigger')) {
            const menuTrigger = e.target;
            const menuDropdown = menuTrigger.nextElementSibling;
            
            if (menuDropdown && menuDropdown.classList.contains('menu-dropdown')) {
                // 显示菜单
                menuDropdown.classList.toggle('hidden');
                
                // 计算位置
                const triggerRect = menuTrigger.getBoundingClientRect();
                const dropdownRect = menuDropdown.getBoundingClientRect();
                const viewportWidth = window.innerWidth;
                
                // 如果右侧空间不足，向左展开
                if (triggerRect.right + dropdownRect.width > viewportWidth - 10) {
                    menuDropdown.style.right = 'auto';
                    menuDropdown.style.left = '0';
                } else {
                    menuDropdown.style.right = '0';
                    menuDropdown.style.left = 'auto';
                }
                
                // 点击其他地方关闭菜单
                const closeMenu = (event) => {
                    if (!menuDropdown.contains(event.target) && !menuTrigger.contains(event.target)) {
                        menuDropdown.classList.add('hidden');
                        document.removeEventListener('click', closeMenu);
                    }
                };
                
                setTimeout(() => {
                    document.addEventListener('click', closeMenu);
                }, 0);
            }
        }
    });
    
    // 鼠标悬停时也调整位置
    document.addEventListener('mouseover', (e) => {
        if (e.target.classList.contains('menu-trigger')) {
            const menuTrigger = e.target;
            const menuDropdown = menuTrigger.nextElementSibling;
            
            if (menuDropdown && menuDropdown.classList.contains('menu-dropdown')) {
                // 计算位置
                const triggerRect = menuTrigger.getBoundingClientRect();
                const dropdownRect = menuDropdown.getBoundingClientRect();
                const viewportWidth = window.innerWidth;
                
                // 如果右侧空间不足，向左展开
                if (triggerRect.right + dropdownRect.width > viewportWidth - 10) {
                    menuDropdown.style.right = 'auto';
                    menuDropdown.style.left = '0';
                } else {
                    menuDropdown.style.right = '0';
                    menuDropdown.style.left = 'auto';
                }
            }
        }
    });
}

// 全局错误处理器
window.addEventListener('error', function(event) {
    console.error('全局错误:', event.error);
    console.error('错误位置:', event.filename, ':', event.lineno, ':', event.colno);
    
    // 显示错误给用户
    if (typeof alert === 'function') {
        alert('发生JavaScript错误: ' + event.error.message);
    }
});

// 启动应用
document.addEventListener('DOMContentLoaded', () => {
    try {
        window.app = new PortfolioApp();
        initAdaptiveMenus();
        console.log('PortfolioApp 初始化成功');
    } catch (error) {
        console.error('PortfolioApp 初始化失败:', error);
        alert('应用初始化失败: ' + error.message);
    }
});