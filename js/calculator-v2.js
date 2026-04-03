// 前端计算逻辑
class PortfolioCalculator {
    constructor() {
        // 模拟持仓数据（实际应从本地数据库获取）
        this.positions = [
            // 权益类
            { symbol: '09992.HK', name: '泡泡玛特', market: '港股', type: 'equity', shares: 200, costPrice: 214.8, currency: 'HKD' },
            { symbol: 'MU', name: '美光科技', market: '美股', type: 'equity', shares: 100, costPrice: 379.17, currency: 'USD' },
            { symbol: '00981.HK', name: '中芯国际', market: '港股', type: 'equity', shares: 500, costPrice: 64.13, currency: 'HKD' },
            { symbol: '03690.HK', name: '美团', market: '港股', type: 'equity', shares: 100, costPrice: 109.08, currency: 'HKD' },
            
            // ETF
            { symbol: 'VOO', name: '标普500ETF', market: '美股', type: 'etf', shares: 15, costPrice: 485.3, currency: 'USD' }
        ];

        // 现金等价物（货币基金）
        this.cashEquivalents = [
            { symbol: '博时美元货币市场基金', name: '博时美元货币市场基金', market: '美股', type: 'cash_equivalent', shares: 55882, nav: 1.0, currency: 'USD' },
            { symbol: '易方达港元货币市场基金', name: '易方达（香港）港元货币市场基金', market: '港股', type: 'cash_equivalent', shares: 2273, nav: 1.0, currency: 'HKD' }
        ];

        // 现金数据（从外部传入，不在此处硬编码）
        this.cash = null;

        // 年初资产（从外部传入，不在此处硬编码）
        this.initialAssets = null;

        // 三年目标（从外部传入，不在此处硬编码）
        this.threeYearGoal = null;
    }

    // 计算所有指标
    calculateAll(stockPrices, forexRates) {
        if (!stockPrices || !forexRates) {
            throw new Error('缺少股票价格或汇率数据');
        }

        // 计算交叉汇率：HKDCNY = HKDUSD × USDCNY
        const USDCNY = forexRates.USDCNY?.rate || 7.25;
        const HKDUSD = forexRates.HKDUSD?.rate || 0.128;
        const HKDCNY = HKDUSD * USDCNY;

        // 计算每只股票的数据（增加容错处理）
        const stockCalculations = this.positions.map(position => {
            const stockData = stockPrices[position.symbol];
            
            // 统一字段名（DB返回的是下划线命名）
            const costPrice = position.cost_price || position.costPrice || 0;
            const shares = position.shares || 0;
            
            // 如果股票数据获取失败，使用成本价作为当前价（容错处理）
            if (!stockData) {
                console.warn(`股票 ${position.symbol} 数据获取失败，使用成本价计算`);
                const currentPrice = costPrice; // 使用成本价作为当前价
                const currency = position.currency;

                // 汇率转换
                let exchangeRate = 1;
                if (currency === 'USD') {
                    exchangeRate = USDCNY;
                } else if (currency === 'HKD') {
                    exchangeRate = HKDCNY;
                }

                // 计算人民币市值
                const marketValueCNY = shares * currentPrice * exchangeRate;
                const costValueCNY = shares * costPrice * exchangeRate;
                const pnlAmountCNY = 0; // 盈亏为0
                const pnlPercent = 0; // 盈亏百分比为0

                return {
                    ...position,
                    currentPrice,
                    currency,
                    marketValueCNY,
                    costValueCNY,
                    pnlAmountCNY,
                    pnlPercent,
                    todayChange: 0,
                    exchangeRate,
                    dataMissing: true // 标记数据缺失
                };
            }

            // 正常情况：有实时价格数据
            const currentPrice = stockData.price;
            const currency = stockData.currency || position.currency;

            // 汇率转换
            let exchangeRate = 1;
            if (currency === 'USD') {
                exchangeRate = USDCNY;
            } else if (currency === 'HKD') {
                exchangeRate = HKDCNY;
            }

            // 计算人民币市值
            const marketValueCNY = shares * currentPrice * exchangeRate;

            // 计算盈亏
            const costValueCNY = shares * costPrice * exchangeRate;
            const pnlAmountCNY = marketValueCNY - costValueCNY;
            const pnlPercent = costPrice > 0 ? (currentPrice - costPrice) / costPrice * 100 : 0;

            // 今日涨跌幅
            const todayChange = stockData.change_percent || 0;

            return {
                ...position,
                currentPrice,
                currency,
                marketValueCNY,
                costValueCNY,
                pnlAmountCNY,
                pnlPercent,
                todayChange,
                exchangeRate,
                dataMissing: false
            };
        });

        // 处理现金等价物（货币基金）
        const cashEquivalentCalculations = (this.cashEquivalents || []).map(ce => {
            const currency = ce.currency;
            let exchangeRate = 1;
            if (currency === 'USD') {
                exchangeRate = USDCNY;
            } else if (currency === 'HKD') {
                exchangeRate = HKDCNY;
            }
            
            const nav = ce.nav || 1; // 货币基金净值默认为1
            const marketValue = ce.shares * nav; // 原始货币市值
            const marketValueCNY = marketValue * exchangeRate;
            
            return {
                ...ce,
                currentPrice: nav,
                marketValue, // 原始货币市值（用于展示）
                marketValueCNY, // 人民币市值（用于计算）
                costValueCNY: marketValueCNY, // 货币基金成本等于市值
                pnlAmountCNY: 0, // 货币基金盈亏为0
                pnlPercent: 0,
                todayChange: 0,
                exchangeRate
            };
        });

        // 汇总计算
        const totalStockValueCNY = stockCalculations.reduce((sum, stock) => sum + stock.marketValueCNY, 0);
        const totalCashEquivalentValueCNY = cashEquivalentCalculations.reduce((sum, ce) => sum + ce.marketValueCNY, 0);
        
        // 计算现金的人民币价值（cash 对象使用 usd_balance 和 hkd_balance）
        const cashUSDCNY = (this.cash?.usd_balance || 0) * USDCNY;
        const cashHKDCNY = (this.cash?.hkd_balance || 0) * HKDCNY;
        const totalCashCNY = cashUSDCNY + cashHKDCNY;
        
        const totalAssetsCNY = totalStockValueCNY + totalCashEquivalentValueCNY + totalCashCNY;
        const totalPnlCNY = totalAssetsCNY - (this.initialAssets || totalAssetsCNY);
        const totalPnlPercent = this.initialAssets ? (totalPnlCNY / this.initialAssets) * 100 : 0;
        const positionRatio = totalAssetsCNY > 0 ? (totalStockValueCNY / totalAssetsCNY) * 100 : 0;
        const goalProgress = (totalAssetsCNY / (this.threeYearGoal || 5000000)) * 100;

        // 计算持仓总资产（用于占比计算的分母）
        const totalHoldingsValueCNY = totalStockValueCNY + totalCashEquivalentValueCNY;
        
        // 按类型分组并按占比排序，添加权重字段（分母为持仓总资产）
        const equityStocks = stockCalculations
            .filter(s => s.type === 'equity')
            .map(s => ({
                ...s,
                weight: totalHoldingsValueCNY > 0 ? (s.marketValueCNY / totalHoldingsValueCNY) * 100 : 0
            }))
            .sort((a, b) => b.marketValueCNY - a.marketValueCNY);
        const etfStocks = stockCalculations
            .filter(s => s.type === 'etf')
            .map(s => ({
                ...s,
                weight: totalHoldingsValueCNY > 0 ? (s.marketValueCNY / totalHoldingsValueCNY) * 100 : 0
            }))
            .sort((a, b) => b.marketValueCNY - a.marketValueCNY);
        const cashEquivalentStocks = cashEquivalentCalculations
            .map(s => ({
                ...s,
                weight: totalHoldingsValueCNY > 0 ? (s.marketValueCNY / totalHoldingsValueCNY) * 100 : 0
            }))
            .sort((a, b) => b.marketValueCNY - a.marketValueCNY);

        // 计算机会（亏损超过5%）
        const opportunities = equityStocks
            .filter(stock => stock.pnlPercent < -5)
            .map(stock => ({
                symbol: stock.symbol,
                name: stock.name,
                pnlPercent: stock.pnlPercent,
                daysSinceLastBuy: Math.floor(Math.random() * 30) + 1 // 模拟数据
            }));

        // 计算风险（占比超过10%）
        const risks = [];
        stockCalculations.forEach(stock => {
            const weight = (stock.marketValueCNY / totalAssetsCNY) * 100;
            if (weight > 10) {
                risks.push({
                    type: 'concentration',
                    symbol: stock.symbol,
                    name: stock.name,
                    weight: weight.toFixed(1),
                    threshold: 10
                });
            }
        });

        // 行业风险（科技股占比）
        const techStocks = stockCalculations.filter(s => 
            ['AAPL', 'MSFT', 'NVDA', 'MU', 'TSLA'].includes(s.symbol)
        );
        const techWeight = techStocks.reduce((sum, s) => sum + (s.marketValueCNY / totalAssetsCNY * 100), 0);
        if (techWeight > 50) {
            risks.push({
                type: 'sector',
                sector: '科技',
                weight: techWeight.toFixed(1),
                threshold: 50
            });
        }

        return {
            // 核心指标
            totalAssetsCNY,
            totalPnlCNY,
            totalPnlPercent,
            positionRatio,
            goalProgress,
            initialAssets: this.initialAssets,
            threeYearGoal: this.threeYearGoal,
            
            // 现金数据（添加 total 字段用于显示）
            cash: {
                ...this.cash,
                total: totalCashCNY,
                usd: this.cash?.usd_balance || 0,
                hkd: this.cash?.hkd_balance || 0
            },
            
            // 现金等价物
            cashEquivalents: cashEquivalentStocks,
            totalCashEquivalentValueCNY,
            
            // 股票数据
            stocks: stockCalculations,
            equityStocks,
            etfStocks,
            
            // 机会与风险
            opportunities,
            risks,
            
            // 汇率
            forexRates: {
                USDCNY,
                HKDUSD,
                HKDCNY
            },
            
            // 统计
            equityCount: equityStocks.length,
            etfCount: etfStocks.length,
            cashEquivalentCount: cashEquivalentStocks.length,
            totalStockCount: stockCalculations.length
        };
    }

    // 获取所有股票代码
    getAllSymbols() {
        return this.positions.map(p => p.symbol);
    }

    // 添加新交易
    addTrade(symbol, direction, quantity, price) {
        // 查找现有持仓
        const existingPosition = this.positions.find(p => p.symbol === symbol);
        
        if (existingPosition) {
            if (direction === 'buy') {
                // 买入：更新平均成本
                const totalShares = existingPosition.shares + quantity;
                const totalCost = existingPosition.shares * existingPosition.costPrice + quantity * price;
                existingPosition.costPrice = totalCost / totalShares;
                existingPosition.shares = totalShares;
            } else {
                // 卖出：减少持仓
                existingPosition.shares = Math.max(0, existingPosition.shares - quantity);
            }
        } else if (direction === 'buy') {
            // 新持仓
            this.positions.push({
                symbol,
                name: symbol, // 实际应从API获取名称
                market: symbol.includes('.HK') ? '港股' : '美股',
                type: 'equity',
                shares: quantity,
                costPrice: price,
                currency: symbol.includes('.HK') ? 'HKD' : 'USD'
            });
        }
        
        // 实际应保存到本地数据库
        console.log('交易已记录:', { symbol, direction, quantity, price });
    }
}

// 全局计算器实例
const Calculator = new PortfolioCalculator();