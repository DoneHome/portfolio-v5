// 期权表格渲染器
// 版本：2.1.0 — 双层结构 + 希腊字母详情面板

class OptionsRenderer {
    constructor() {
        this.refreshInterval = 300000;
        this.refreshTimer = null;
        this.lastUpdate = null;
        this.isRefreshing = false;
        this.optionsData = [];
        // 记录哪些行已展开（按 option_symbol 索引）
        this.expandedRows = new Set();
    }

    async init() {
        if (!this.checkHtmlElements()) return;
        this.bindEvents();
        await this.refreshOptionsData();
        this.startAutoRefresh();
    }

    checkHtmlElements() {
        const ids = [
            'options-section', 'options-table', 'options-table-body',
            'options-count', 'options-last-updated',
            'options-total-value', 'options-total-pnl'
        ];
        for (const id of ids) {
            if (!document.getElementById(id)) {
                console.error(`缺少HTML元素: #${id}`);
                return false;
            }
        }
        return true;
    }

    bindEvents() {
        document.getElementById('options-table-body')?.addEventListener('click', (e) => {
            const row = e.target.closest('tr.option-row');
            if (!row) return;
            // 点击整行展开/收起详情
            this.toggleDetail(row);
        });
    }

    toggleDetail(row) {
        const idx = parseInt(row.dataset.index);
        const opt = this.optionsData[idx];
        if (!opt) return;

        const key = opt.option_symbol || idx;
        const next = row.nextElementSibling;

        if (next && next.classList.contains('option-detail-row')) {
            next.remove();
            row.classList.remove('option-expanded');
            this.expandedRows.delete(key);
        } else {
            row.insertAdjacentHTML('afterend', this.createDetailRow(opt));
            row.classList.add('option-expanded');
            this.expandedRows.add(key);
        }
    }

    async refreshOptionsData(force = false) {
        if (this.isRefreshing && !force) return;
        this.isRefreshing = true;

        try {
            const res = await fetch('http://localhost:8005/api/portfolio/options/position-details');
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const result = await res.json();

            if (!result.success || !result.data || result.data.length === 0) {
                this.renderEmptyState();
                this.isRefreshing = false;
                return;
            }

            // 补充期权当前权利金报价
            const optionSymbols = result.data
                .map(p => p.option_symbol).filter(Boolean);
            const quoteMap = {};
            if (optionSymbols.length > 0) {
                try {
                    const qRes = await fetch(`http://localhost:8005/api/portfolio/options/batch-quotes?symbols=${encodeURIComponent(optionSymbols.join(','))}`);
                    const qData = await qRes.json();
                    if (qData.success && qData.quotes) Object.assign(quoteMap, qData.quotes);
                } catch (e) {
                    console.warn('期权报价查询失败:', e);
                }
            }

            // 构建展示数据
            const newData = result.data.map((item) => {
                const calc = item.calculated || {};
                const quote = quoteMap[item.option_symbol] || {};
                const cp = item.current_premium || quote.price || null;

                // 已过期期权：当前权利金视为 0
                const isExpired = calc.days_to_expiry !== null && calc.days_to_expiry !== undefined && calc.days_to_expiry < 0;
                const effectivePremium = isExpired ? 0 : cp;

                return {
                    symbol: item.symbol,
                    option_symbol: item.option_symbol,
                    direction_text: calc.direction_text || '-',
                    contract_count: calc.contract_count || `${Math.abs(item.quantity)}张`,
                    strike_price: item.strike_price,
                    cost_price: item.cost_price,
                    total_cost_premium: calc.total_cost_premium,
                    current_total_premium: isExpired ? 0 :
                        (effectivePremium !== null ? Math.round(effectivePremium * (item.contract_multiplier || 100) * Math.abs(item.quantity) * 100) / 100 : null),
                    current_premium: effectivePremium,
                    current_stock_price: item.current_stock_price,
                    price_diff_pct: calc.price_diff_pct,
                    moneyness: calc.moneyness || '-',
                    days_to_expiry: calc.days_to_expiry,
                    break_even: calc.break_even,
                    floating_pnl: calc.floating_pnl,
                    market_value: isExpired ? 0 : (calc.market_value ?? null),
                    risk_color: calc.risk_color || 'gray',
                    risk_level: calc.risk_level || '-',
                    quantity: item.quantity,
                    option_type: item.option_type,
                    transaction_type: item.transaction_type,
                    contract_multiplier: item.contract_multiplier || 100,
                    expiration_date: item.expiration_date,
                    greeks: item.greeks || {},
                    implied_volatility: item.implied_volatility,
                    is_expired: isExpired
                };
            });

            // 记录展开状态
            const expandedKeys = new Set();
            this.optionsData.forEach((old, i) => {
                const key = old.option_symbol || i;
                if (this.expandedRows.has(key)) expandedKeys.add(key);
            });

            this.optionsData = newData;
            this.renderTable(newData);

            // 恢复展开状态
            newData.forEach((opt, i) => {
                const key = opt.option_symbol || i;
                if (expandedKeys.has(key)) {
                    const rows = document.getElementById('options-table-body')?.querySelectorAll('tr.option-row');
                    if (rows && rows[i]) this.toggleDetail(rows[i]);
                }
            });

            this.updateSummary(newData);
            this.updateLastUpdated();
        } catch (error) {
            console.error('刷新期权数据失败:', error);
            this.showError('刷新失败: ' + error.message);
        } finally {
            this.isRefreshing = false;
        }
    }

    renderTable(data) {
        const tbody = document.getElementById('options-table-body');
        if (!tbody) return;
        tbody.innerHTML = '';

        // 按到期日升序：已到期排最前，天数越少越靠前
        const sorted = [...data].sort((a, b) => {
            const da = a.days_to_expiry !== null && a.days_to_expiry !== undefined ? a.days_to_expiry : -999;
            const db = b.days_to_expiry !== null && b.days_to_expiry !== undefined ? b.days_to_expiry : -999;
            return db - da;
        });

        sorted.forEach((opt, i) => {
            tbody.appendChild(this.createRow(opt, i));
        });
    }

    createRow(opt, index) {
        const tr = document.createElement('tr');
        tr.className = 'option-row border-b border-gray-50 hover:bg-gray-50/50 transition-colors cursor-pointer';
        tr.dataset.index = index;

        // 1. 标的/期权代码
        tr.innerHTML += `<td class="px-4 py-3 text-sm">
            <div class="font-medium text-gray-900">${opt.symbol}</div>
            <div class="text-xs text-gray-400 truncate max-w-[120px]">${opt.option_symbol || ''}</div>
        </td>`;

        // 2. 方向
        tr.innerHTML += `<td class="px-4 py-3 text-sm text-gray-600">${opt.direction_text}</td>`;

        // 3. 价差% + 安全状态
        const pct = opt.price_diff_pct;
        const level = opt.risk_level || '-';
        const levelEmoji = this.riskEmoji(opt.risk_color);
        const isExpired = opt.is_expired;
        tr.innerHTML += `<td class="px-4 py-3 text-sm">
            ${isExpired ? '<div class="text-gray-400">-</div>' : `
            <div class="tabular-nums text-gray-600">${pct !== null && pct !== undefined ? pct.toFixed(1) + '%' : '-'}</div>
            <div class="text-xs mt-0.5">${levelEmoji} ${level}</div>
            `}
        </td>`;

        // 4. 虚实状态
        const bgColor = this.riskBgColor(opt.risk_color);
        tr.innerHTML += `<td class="px-4 py-3 text-sm"><span class="inline-block px-2 py-0.5 rounded-full text-xs font-medium ${bgColor}">${opt.moneyness}</span></td>`;

        // 5. 浮动盈亏
        const pnl = opt.floating_pnl;
        const pnlCls = pnl > 0 ? 'text-emerald-600' : pnl < 0 ? 'text-red-500' : 'text-gray-400';
        tr.innerHTML += `<td class="px-4 py-3 text-sm tabular-nums ${pnlCls} font-medium">${pnl !== null ? (pnl > 0 ? '+' : '') + pnl.toFixed(0) : '-'}</td>`;

        // 6. 距到期天数
        const days = opt.days_to_expiry;
        let daysCls = 'text-gray-700';
        let daysText = '-';
        if (days !== null && days !== undefined) {
            if (days < 0) { daysCls = 'text-gray-400'; daysText = '已到期'; }
            else if (days <= 3) { daysCls = 'text-red-600 font-bold'; daysText = days + '天'; }
            else if (days <= 7) { daysCls = 'text-amber-600 font-semibold'; daysText = days + '天'; }
            else if (days <= 30) { daysCls = 'text-amber-500'; daysText = days + '天'; }
            else { daysText = days + '天'; }
        }
        tr.innerHTML += `<td class="px-4 py-3 text-sm tabular-nums ${daysCls}">${daysText}</td>`;

        // 7. 当前权利金
        const cp = opt.current_premium;
        tr.innerHTML += `<td class="px-4 py-3 text-sm tabular-nums text-gray-700">${cp !== null ? '$' + (cp === 0 ? '0' : cp.toFixed(2)) : '-'}</td>`;

        return tr;
    }

    createDetailRow(opt) {
        const costTotal = opt.total_cost_premium;
        const curTotal = opt.current_total_premium;
        const mv = opt.market_value;
        const be = opt.break_even;
        const cpPrice = opt.current_stock_price;
        const strike = opt.strike_price;
        const cCount = opt.contract_count;
        const expire = opt.expiration_date || '-';
        const greeks = opt.greeks || {};
        const iv = opt.implied_volatility;

        // 希腊字母行（紧凑展示）
        const theta = greeks.theta;
        const delta = greeks.delta;
        const gamma = greeks.gamma;
        const vega = greeks.vega;

        const greekItems = [
            { label: 'Θ Theta', val: theta !== undefined ? theta.toFixed(3) : '-', cls: 'text-gray-700' },
            { label: 'Δ Delta', val: delta !== undefined ? delta.toFixed(3) : '-', cls: 'text-gray-700' },
            { label: 'IV', val: iv !== undefined && iv !== null ? (iv * 100).toFixed(1) + '%' : '-', cls: 'text-gray-500' },
            { label: 'ν Vega', val: vega !== undefined ? vega.toFixed(3) : '-', cls: 'text-gray-500' },
            { label: 'Γ Gamma', val: gamma !== undefined ? gamma.toFixed(3) : '-', cls: 'text-gray-500' },
        ];

        const greekHtml = greekItems.map(g =>
            `<div class="flex items-center gap-1.5">
                <span class="text-gray-400 text-[10px]">${g.label}</span>
                <span class="font-mono text-xs font-semibold ${g.cls}">${g.val}</span>
            </div>`
        ).join('');

        return `<tr class="option-detail-row bg-gray-50/70">
            <td colspan="7" class="px-5 py-3">
                <!-- 顶部：希腊字母一行 -->
                <div class="flex flex-wrap gap-x-5 gap-y-1 mb-3">
                    ${greekHtml}
                </div>
                <!-- 底部：详细信息 -->
                <div class="grid grid-cols-4 gap-x-6 gap-y-2 text-xs">
                    <div class="flex justify-between"><span class="text-gray-400">合约数</span><span class="text-gray-700 font-medium">${cCount}</span></div>
                    <div class="flex justify-between"><span class="text-gray-400">行权价</span><span class="text-gray-700 font-medium">$${strike || '-'}</span></div>
                    <div class="flex justify-between"><span class="text-gray-400">开仓权利金</span><span class="text-gray-700 font-medium">$${costTotal !== null ? costTotal.toFixed(0) : '-'}</span></div>
                    <div class="flex justify-between"><span class="text-gray-400">当前权利金</span><span class="text-gray-700 font-medium">$${curTotal !== null ? curTotal.toFixed(0) : '-'}</span></div>
                    <div class="flex justify-between"><span class="text-gray-400">当前股价</span><span class="text-gray-700 font-medium">$${cpPrice || '-'}</span></div>
                    <div class="flex justify-between"><span class="text-gray-400">盈亏平衡点</span><span class="text-gray-700 font-medium">$${be !== null ? be.toFixed(2) : '-'}</span></div>
                    <div class="flex justify-between"><span class="text-gray-400">市值</span><span class="text-gray-700 font-medium">$${mv !== null ? mv.toFixed(0) : '-'}</span></div>
                    <div class="flex justify-between"><span class="text-gray-400">到期日</span><span class="text-gray-700 font-medium">${expire}</span></div>
                </div>
            </td>
        </tr>`;
    }

    updateSummary(data) {
        const count = data.length;
        document.getElementById('options-count').textContent = count + '只';

        const totalPnl = data.reduce((s, o) => s + (o.floating_pnl || 0), 0);
        const totalValue = data.reduce((s, o) => s + (o.market_value || 0), 0);

        document.getElementById('options-total-value').textContent = totalValue.toFixed(0);
        const pnlEl = document.getElementById('options-total-pnl');
        pnlEl.textContent = (totalPnl > 0 ? '+' : '') + totalPnl.toFixed(0);
        pnlEl.className = totalPnl > 0 ? 'value font-medium text-emerald-600'
            : totalPnl < 0 ? 'value font-medium text-red-500'
            : 'value font-medium text-gray-400';
    }

    updateLastUpdated() {
        this.lastUpdate = new Date();
        const el = document.getElementById('options-last-updated');
        if (el) el.textContent = this.lastUpdate.toLocaleTimeString();
    }

    renderEmptyState() {
        const tbody = document.getElementById('options-table-body');
        if (tbody) tbody.innerHTML = '<tr><td colspan="7" class="px-4 py-8 text-center text-gray-400">暂无期权持仓</td></tr>';
        document.getElementById('options-count').textContent = '0只';
        document.getElementById('options-total-value').textContent = '0';
        document.getElementById('options-total-pnl').textContent = '0';
    }

    showError(msg) {
        const tbody = document.getElementById('options-table-body');
        if (tbody) tbody.innerHTML = `<tr><td colspan="7" class="px-4 py-8 text-center text-red-500">${msg}</td></tr>`;
    }

    triggerManualRefresh() { this.refreshOptionsData(true); }

    startAutoRefresh() {
        if (this.refreshTimer) clearInterval(this.refreshTimer);
        this.refreshTimer = setInterval(() => this.refreshOptionsData(), this.refreshInterval);
    }

    stopAutoRefresh() {
        if (this.refreshTimer) { clearInterval(this.refreshTimer); this.refreshTimer = null; }
    }

    riskEmoji(color) {
        return { green: '🟢', blue: '🔵', yellow: '🟡', red: '🔴' }[color] || '⚪';
    }

    riskTextColor(color) {
        return { green: 'text-emerald-600', blue: 'text-blue-500', yellow: 'text-amber-500', red: 'text-red-500' }[color] || 'text-gray-600';
    }

    riskBgColor(color) {
        return {
            green: 'bg-emerald-50 text-emerald-600',
            blue: 'bg-blue-50 text-blue-600',
            yellow: 'bg-amber-50 text-amber-600',
            red: 'bg-red-50 text-red-600'
        }[color] || 'bg-gray-50 text-gray-500';
    }
}
