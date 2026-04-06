// 页面渲染逻辑
class PortfolioRenderer {
    constructor() {
        this.isCostPerspective = true; // 默认成本视角
    }

    // 切换视角
    togglePerspective() {
        this.isCostPerspective = !this.isCostPerspective;
        const thumb = document.getElementById('toggle-thumb');
        if (this.isCostPerspective) {
            thumb.style.transform = 'translateX(0)';
        } else {
            thumb.style.transform = 'translateX(16px)';
        }
        
        // 更新切换按钮颜色
        const toggleBtn = document.getElementById('perspective-toggle');
        if (toggleBtn) {
            if (this.isCostPerspective) {
                toggleBtn.classList.remove('bg-green-500');
                toggleBtn.classList.add('bg-blue-500');
            } else {
                toggleBtn.classList.remove('bg-blue-500');
                toggleBtn.classList.add('bg-green-500');
            }
        }
        
        return this.isCostPerspective;
    }

    // 格式化货币
    formatCurrency(amount, currency = 'CNY') {
        if (amount === null || amount === undefined) return '¥--';
        
        const formatter = new Intl.NumberFormat('zh-CN', {
            style: 'currency',
            currency: currency === 'USD' ? 'USD' : 'CNY',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        });
        
        return formatter.format(amount);
    }

    // 格式化百分比
    formatPercent(value, decimals = 1) {
        if (value === null || value === undefined) return '--%';
        
        const sign = value >= 0 ? '+' : '';
        return `${sign}${value.toFixed(decimals)}%`;
    }

    // 更新顶部仪表盘
    updateDashboard(data) {
        // 总资产
        const totalAssetsCard = document.getElementById('total-assets-card');
        if (totalAssetsCard) {
            // 修改标题
            const titleEl = totalAssetsCard.querySelector('p.text-xs.text-gray-500');
            if (titleEl) {
                titleEl.textContent = '总资产';
            }
        }
        
        const totalAssetsEl = document.querySelector('#total-assets-card .text-xl');
        const cashNoteEl = document.querySelector('#total-assets-card .text-xs.text-gray-400');
        if (totalAssetsEl) {
            totalAssetsEl.textContent = this.formatCurrency(data.totalAssetsCNY);
            totalAssetsEl.classList.remove('loading');
        }
        if (cashNoteEl) {
            // 显示含现金金额
            const cashValue = data.cash?.total || 0;
            cashNoteEl.textContent = `含现金 ${this.formatCurrency(cashValue)}`;
        }

        // 总盈亏
        const totalPnlEl = document.querySelector('#total-pnl-card .text-xl');
        const totalPnlPercentEl = document.querySelector('#total-pnl-card .text-xs');
        const totalPnlTooltip = document.querySelector('#total-pnl-card .tooltip');
        if (totalPnlEl) {
            totalPnlEl.textContent = this.formatCurrency(data.totalPnlCNY);
            totalPnlEl.classList.remove('loading');
            totalPnlEl.className = `text-xl font-medium ${data.totalPnlCNY >= 0 ? 'positive' : 'negative'}`;
        }
        if (totalPnlPercentEl) {
            totalPnlPercentEl.textContent = this.formatPercent(data.totalPnlPercent);
            totalPnlPercentEl.classList.remove('loading');
            totalPnlPercentEl.className = `text-xs ${data.totalPnlPercent >= 0 ? 'positive' : 'negative'} mt-1`;
        }
        if (totalPnlTooltip) {
            if (data.initialAssets && data.initialAssets > 0) {
                totalPnlTooltip.textContent = `年初资产：${this.formatCurrency(data.initialAssets)}`;
            } else {
                totalPnlTooltip.textContent = '年初资产：待设置';
            }
        }

        // 仓位
        const positionEl = document.querySelector('#position-card .text-xl');
        const positionProgress = document.querySelector('#position-card .bg-gradient-to-r');
        const positionTooltip = document.querySelector('#position-card .tooltip');
        const positionCard = document.getElementById('position-card');
        
        if (positionEl) {
            positionEl.textContent = `${data.positionRatio.toFixed(1)}%`;
            positionEl.classList.remove('loading');
            positionEl.className = `text-xl font-medium ${
                data.positionRatio > 90 ? 'warning' : 
                data.positionRatio > 80 ? 'neutral' : 'positive'
            }`;
        }
        if (positionProgress) {
            positionProgress.style.width = `${Math.min(data.positionRatio, 100)}%`;
        }
        
        // 显示仓位分布
        if (positionCard) {
            const distributionEl = positionCard.querySelector('.text-xs.text-gray-400');
            if (distributionEl) {
                const stockValue = data.equityValue || 0;
                const etfValue = data.etfValue || 0;
                const cashValue = data.cash?.total || 0;
                const total = data.totalAssetsCNY || 1;
                
                const stockPercent = total > 0 ? (stockValue / total * 100) : 0;
                const etfPercent = total > 0 ? (etfValue / total * 100) : 0;
                const cashPercent = total > 0 ? (cashValue / total * 100) : 0;
                
                distributionEl.textContent = `股票${stockPercent.toFixed(0)}% ETF${etfPercent.toFixed(0)}% 现金${cashPercent.toFixed(0)}%`;
            }
        }
        if (positionTooltip) {
            // 正确的计算：仓位 = 股票市值 / (股票市值 + 现金)
            const stockValue = data.totalAssetsCNY - data.cash.total;
            const totalForPosition = stockValue + data.cash.total;
            const calculatedRatio = totalForPosition > 0 ? (stockValue / totalForPosition) * 100 : 0;
            
            positionTooltip.innerHTML = `仓位 = 股票市值 / (股票市值 + 现金)<br>= ${this.formatCurrency(stockValue)} / ${this.formatCurrency(totalForPosition)}<br>= ${calculatedRatio.toFixed(1)}%`;
        }

        // 目标进度
        const goalCard = document.getElementById('goal-card');
        if (goalCard) {
            const titleEl = goalCard.querySelector('p.text-xs.text-gray-500');
            if (titleEl) {
                titleEl.textContent = '目标进度';
            }
        }
        const goalEl = document.querySelector('#goal-card .text-xl');
        const goalProgress = document.getElementById('goal-progress');
        const goalTooltip = document.querySelector('#goal-card .tooltip');
        if (goalEl) {
            goalEl.textContent = `${data.goalProgress.toFixed(1)}%`;
            goalEl.classList.remove('loading');
        }
        if (goalProgress) {
            goalProgress.style.width = `${data.goalProgress}%`;
        }
        if (goalTooltip) {
            const estimatedDate = this._estimateGoalDate(data.goalProgress);
            goalTooltip.innerHTML = `若保持年化收益 ${data.totalPnlPercent.toFixed(1)}%<br>预计于 ${estimatedDate} 达成`;
        }

        // 保证金使用率（无期权持仓时为0%）
        const marginValueEl = document.querySelector('#margin-usage-card .text-sm.font-medium');
        const marginProgress = document.getElementById('margin-progress');
        if (marginValueEl) {
            marginValueEl.textContent = '0%';
            marginValueEl.classList.remove('loading');
            marginValueEl.className = 'text-sm font-medium positive';
        }
        if (marginProgress) {
            marginProgress.style.width = '0%';
        }

        // 更新计数
        document.getElementById('equity-count').textContent = `(${data.equityCount}只)`;
        document.getElementById('etf-count').textContent = `(${data.etfCount}只)`;
        const cashEquivalentCount = document.getElementById('cash-equivalent-count');
        if (cashEquivalentCount) {
            cashEquivalentCount.textContent = `(${data.cashEquivalentCount || 0}只)`;
        }

        // 现金管理
        document.getElementById('cash-total').textContent = this.formatCurrency(data.cash.total);
        const cashItems = document.querySelectorAll('#cash-management .text-sm.font-medium');
        if (cashItems.length >= 3) {
            cashItems[0].textContent = this.formatCurrency(data.cash.allocation.reserve);
            cashItems[1].textContent = this.formatCurrency(data.cash.allocation.investment);
            cashItems[2].textContent = this.formatCurrency(data.cash.allocation.emergency);
        }

        // 更新时间
        const now = new Date();
        document.getElementById('last-updated').innerHTML = `
            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
            数据截至 ${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')} ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}
        `;
    }

    // 渲染权益类表格
    renderEquityTable(stocks) {
        const tbody = document.getElementById('equity-table-body');
        if (!tbody) return;

        tbody.innerHTML = '';
        
        stocks.forEach(stock => {
            const weight = stock.weight || 0;
            const isHighWeight = weight > 15;
            
            const row = document.createElement('tr');
            row.className = 'hover:bg-gray-50/50';
            row.innerHTML = `
                <td class="px-4 py-3">
                    <div>
                        <p class="font-medium text-gray-900">${stock.name}</p>
                        <p class="text-xs text-gray-400">${stock.symbol}</p>
                    </div>
                </td>
                <td class="px-4 py-3">
                    <span class="text-xs text-gray-500">${stock.market}</span>
                </td>
                <td class="px-4 py-3 text-right">
                    <span class="font-medium text-gray-900">${stock.shares}</span>
                    <span class="text-xs text-gray-400">股</span>
                </td>
                <td class="px-4 py-3 text-right">
                    <span class="text-gray-600">${stock.currency === 'USD' ? '$' : 'HK'}${(stock.costPrice || stock.cost_price || 0).toFixed(2)}</span>
                </td>
                <td class="px-4 py-3 text-right">
                    <span class="text-gray-900 font-medium">${stock.currency === 'USD' ? '$' : 'HK'}${stock.currentPrice?.toFixed(2) || '--'}</span>
                </td>
                <td class="px-4 py-3 text-right">
                    <span class="font-medium ${isHighWeight ? 'warning' : 'text-gray-900'}">${weight.toFixed(1)}%</span>
                    ${isHighWeight ? '<span class="text-xs warning ml-1">⚠️</span>' : ''}
                </td>
                <td class="px-4 py-3 text-right">
                    <span class="${stock.pnlPercent >= 0 ? 'positive' : 'negative'} font-medium">
                        ${this.formatPercent(stock.pnlPercent)}
                    </span>
                </td>
                <td class="px-4 py-3 text-center">
                    <div class="flex items-center justify-center gap-2">
                        <button class="w-6 h-6 rounded-full bg-green-100 text-green-600 flex items-center justify-center text-xs hover:bg-green-200 transition-colors quick-add-btn" data-symbol="${stock.symbol}" title="快速加仓">+</button>
                        <div class="menu-container relative">
                            <button class="text-gray-400 hover:text-gray-600 text-lg px-1">⋯</button>
                            <div class="menu-dropdown">
                                <a href="#" class="block px-3 py-2 text-xs text-gray-700 hover:bg-gray-50">股票详情</a>
                                <a href="#" class="block px-3 py-2 text-xs text-gray-700 hover:bg-gray-50">交易历史</a>
                                <a href="#" class="block px-3 py-2 text-xs text-gray-700 hover:bg-gray-50">止盈止损</a>
                                <a href="#" class="block px-3 py-2 text-xs text-gray-700 hover:bg-gray-50">市场分析</a>
                            </div>
                        </div>
                    </div>
                </td>
            `;
            tbody.appendChild(row);
        });

        // 添加快速加仓事件
        this._attachQuickAddEvents();
    }

    // 渲染ETF表格
    renderETFTable(stocks) {
        const tbody = document.getElementById('etf-table-body');
        if (!tbody) return;

        tbody.innerHTML = '';
        
        stocks.forEach(stock => {
            const weight = stock.weight || 0;
            
            const row = document.createElement('tr');
            row.className = 'hover:bg-gray-50/50';
            row.innerHTML = `
                <td class="px-4 py-3">
                    <div>
                        <p class="font-medium text-gray-900">${stock.name}</p>
                        <p class="text-xs text-gray-400">${stock.symbol}</p>
                    </div>
                </td>
                <td class="px-4 py-3">
                    <span class="text-xs text-gray-500">${stock.market}</span>
                </td>
                <td class="px-4 py-3 text-right">
                    <span class="font-medium text-gray-900">${stock.shares}</span>
                    <span class="text-xs text-gray-400">股</span>
                </td>
                <td class="px-4 py-3 text-right">
                    <span class="text-gray-600">${stock.currency === 'USD' ? '$' : 'HK'}${(stock.costPrice || stock.cost_price || 0).toFixed(2)}</span>
                </td>
                <td class="px-4 py-3 text-right">
                    <span class="text-gray-900 font-medium">${stock.currency === 'USD' ? '$' : 'HK'}${stock.currentPrice?.toFixed(2) || '--'}</span>
                </td>
                <td class="px-4 py-3 text-right">
                    <span class="font-medium text-gray-900">${weight.toFixed(1)}%</span>
                </td>
                <td class="px-4 py-3 text-right">
                    <span class="${stock.pnlPercent >= 0 ? 'positive' : 'negative'} font-medium">
                        ${this.formatPercent(stock.pnlPercent)}
                    </span>
                </td>
                <td class="px-4 py-3 text-center">
                    <div class="flex items-center justify-center gap-2">
                        <button class="w-6 h-6 rounded-full bg-green-100 text-green-600 flex items-center justify-center text-xs hover:bg-green-200 transition-colors quick-add-btn" data-symbol="${stock.symbol}" title="快速加仓">+</button>
                        <div class="menu-container relative">
                            <button class="text-gray-400 hover:text-gray-600 text-lg px-1">⋯</button>
                            <div class="menu-dropdown">
                                <a href="#" class="block px-3 py-2 text-xs text-gray-700 hover:bg-gray-50">基金详情</a>
                                <a href="#" class="block px-3 py-2 text-xs text-gray-700 hover:bg-gray-50">交易历史</a>
                                <a href="#" class="block px-3 py-2 text-xs text-gray-700 hover:bg-gray-50">定投设置</a>
                                <a href="#" class="block px-3 py-2 text-xs text-gray-700 hover:bg-gray-50">市场分析</a>
                            </div>
                        </div>
                    </div>
                </td>
            `;
            tbody.appendChild(row);
        });

        // 添加快速加仓事件
        this._attachQuickAddEvents();
    }

    // 渲染现金等价物表格
    renderCashEquivalentTable(stocks) {
        const tbody = document.getElementById('cash-equivalent-table-body');
        if (!tbody) return;

        tbody.innerHTML = '';

        if (stocks.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" class="px-4 py-8 text-center text-gray-400">
                        暂无现金等价物
                    </td>
                </tr>
            `;
            return;
        }

        stocks.forEach(stock => {
            const weight = stock.weight || 0;

            const row = document.createElement('tr');
            row.className = 'hover:bg-gray-50/50';
            // 根据市场显示原始货币金额
            const marketValueDisplay = stock.currency === 'USD' 
                ? `$${(stock.marketValue || 0).toFixed(2)}`
                : stock.currency === 'HKD'
                ? `HK${(stock.marketValue || 0).toFixed(2)}`
                : this.formatCurrency(stock.marketValueCNY);

            row.innerHTML = `
                <td class="px-4 py-3">
                    <div>
                        <p class="font-medium text-gray-900">${stock.name}</p>
                        <p class="text-xs text-gray-400">${stock.symbol}</p>
                    </div>
                </td>
                <td class="px-4 py-3">
                    <span class="text-xs text-gray-500">${stock.market}</span>
                </td>
                <td class="px-4 py-3 text-right">
                    <span class="font-medium text-gray-900">${marketValueDisplay}</span>
                </td>
                <td class="px-4 py-3 text-right">
                    <span class="font-medium text-gray-900">${weight.toFixed(1)}%</span>
                </td>
                <td class="px-4 py-3 text-center">
                    <span class="text-xs text-gray-400">货币基金</span>
                </td>
            `;
            tbody.appendChild(row);
        });
    }

    // 渲染机会列表
    renderOpportunities(opportunities) {
        const container = document.getElementById('opportunities-list');
        if (!container) return;

        if (opportunities.length === 0) {
            container.innerHTML = '<div class="text-center py-4 text-gray-400">暂无加仓机会</div>';
            return;
        }

        container.innerHTML = '';
        opportunities.forEach(opp => {
            const div = document.createElement('div');
            div.className = 'flex items-start justify-between py-2 border-b border-gray-100';
            div.innerHTML = `
                <div class="flex-1">
                    <div class="flex items-center gap-2">
                        <p class="text-sm font-medium text-gray-900">${opp.name}</p>
                        <span class="px-1.5 py-0.5 text-xs bg-blue-100 text-blue-700 rounded">中风险</span>
                    </div>
                    <p class="text-xs text-gray-400 mt-0.5">距上次加仓 ${opp.daysSinceLastBuy}天</p>
                    <div class="has-tooltip relative inline-block mt-1">
                        <button class="text-green-600 hover:text-green-700">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                            </svg>
                        </button>
                        <span class="tooltip">营收增长 +12%<br>净利润 $2.1B<br>PE分位 45%<br>机构评级：买入</span>
                    </div>
                </div>
                <span class="text-sm font-medium negative">${this.formatPercent(opp.pnlPercent)}</span>
            `;
            container.appendChild(div);
        });
    }

    // 渲染风险列表
    renderRisks(risks) {
        const container = document.getElementById('risks-list');
        if (!container) return;

        if (risks.length === 0) {
            container.innerHTML = '<div class="text-center py-4 text-gray-400">暂无风险提示</div>';
            return;
        }

        container.innerHTML = '';
        risks.forEach(risk => {
            const div = document.createElement('div');
            div.className = 'flex items-start gap-2';
            
            if (risk.type === 'concentration') {
                div.innerHTML = `
                    <span class="text-xs warning mt-0.5">●</span>
                    <div>
                        <p class="text-sm text-gray-700">${risk.name}占比 <span class="warning font-medium">${risk.weight}%</span></p>
                        <p class="text-xs text-gray-400">超过${risk.threshold}%阈值，建议关注</p>
                    </div>
                `;
            } else if (risk.type === 'sector') {
                div.innerHTML = `
                    <span class="text-xs text-gray-400 mt-0.5">●</span>
                    <div>
                        <p class="text-sm text-gray-700">${risk.sector}股合计 <span class="warning font-medium">${risk.weight}%</span></p>
                        <p class="text-xs text-gray-400">接近${risk.threshold}%预警线</p>
                    </div>
                `;
            }
            
            container.appendChild(div);
        });
    }

    // 显示错误提示
    showError(message) {
        const toast = document.getElementById('error-toast');
        const messageEl = document.getElementById('error-message');
        
        if (toast && messageEl) {
            messageEl.textContent = message;
            toast.classList.remove('hidden');
            
            // 3秒后自动隐藏
            setTimeout(() => {
                toast.classList.add('hidden');
            }, 3000);
        }
    }

    // 显示加载状态
    showLoading(show) {
        const loadingEl = document.getElementById('loading-indicator');
        if (loadingEl) {
            loadingEl.classList.toggle('hidden', !show);
        }
    }

    // 私有方法
    _getStockColor(symbol) {
        const colors = {
            '09992.HK': 'bg-purple-100 text-purple-600',
            'MU': 'bg-blue-100 text-blue-600',
            'AAPL': 'bg-gray-100 text-gray-600',
            'MSFT': 'bg-green-100 text-green-600',
            'PDD': 'bg-red-100 text-red-600',
            'TSLA': 'bg-pink-100 text-pink-600',
            'NVDA': 'bg-orange-100 text-orange-600',
            'VOO': 'bg-orange-100 text-orange-600',
            'QQQ': 'bg-teal-100 text-teal-600',
            'ARKK': 'bg-yellow-100 text-yellow-600'
        };
        return colors[symbol] || 'bg-gray-100 text-gray-600';
    }

    _estimateGoalDate(progress) {
        const now = new Date();
        const remaining = 100 - progress;
        const monthsNeeded = Math.ceil(remaining / 5); // 假设每月增长5%
        now.setMonth(now.getMonth() + monthsNeeded);
        return `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;
    }

    _attachQuickAddEvents() {
        document.querySelectorAll('.quick-add-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const symbol = e.target.dataset.symbol;
                this._openTradeModal(symbol);
            });
        });
    }

    _openTradeModal(symbol) {
        const modal = document.getElementById('trade-modal');
        const symbolInput = document.getElementById('symbol-input');
        
        if (modal && symbolInput) {
            symbolInput.value = symbol;
            modal.classList.remove('hidden');
            
            // 自动获取当前价格
            this._fetchCurrentPrice(symbol);
        }
    }

    async _fetchCurrentPrice(symbol) {
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

    // 初始化折叠功能
    initCollapse() {
        // ETF 折叠
        const etfToggle = document.querySelector('.etf-toggle');
        const etfContent = document.querySelector('.etf-content');
        const etfArrow = document.querySelector('.etf-arrow');
        
        if (etfToggle && etfContent) {
            etfToggle.addEventListener('click', () => {
                const isHidden = etfContent.style.display === 'none';
                etfContent.style.display = isHidden ? 'block' : 'none';
                if (etfArrow) {
                    etfArrow.style.transform = isHidden ? 'rotate(0deg)' : 'rotate(180deg)';
                }
            });
        }
        
        // 现金等价物折叠
        const cashToggle = document.querySelector('.cash-toggle');
        const cashContent = document.querySelector('.cash-content');
        const cashArrow = document.querySelector('.cash-arrow');
        
        if (cashToggle && cashContent) {
            cashToggle.addEventListener('click', () => {
                const isHidden = cashContent.style.display === 'none';
                cashContent.style.display = isHidden ? 'block' : 'none';
                if (cashArrow) {
                    cashArrow.style.transform = isHidden ? 'rotate(0deg)' : 'rotate(180deg)';
                }
            });
        }
        
        // 衍生品折叠
        const derivativeToggle = document.querySelector('.derivative-toggle');
        const derivativeContent = document.querySelector('.derivative-content');
        const derivativeArrow = document.querySelector('.derivative-arrow');
        
        if (derivativeToggle && derivativeContent) {
            derivativeToggle.addEventListener('click', () => {
                const isHidden = derivativeContent.style.display === 'none';
                derivativeContent.style.display = isHidden ? 'block' : 'none';
                if (derivativeArrow) {
                    derivativeArrow.style.transform = isHidden ? 'rotate(0deg)' : 'rotate(180deg)';
                }
            });
        }
    }
}

// 全局渲染器实例
const Renderer = new PortfolioRenderer();