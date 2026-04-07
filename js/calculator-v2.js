// 前端计算逻辑
class PortfolioCalculator {
    constructor() {
        // 模拟持仓数据（实际应从本地数据库获取）
        this.positions = [
            // 美股权益
            { symbol: 'PDD', name: '拼多多', market: '美股', type: 'equity', shares: 200, costPrice: 109.77, currency: 'USD' },
            { symbol: 'MU', name: '美光科技', market: '美股', type: 'equity', shares: 30, costPrice: 379.17, currency: 'USD' },
            { symbol: 'PLTR', name: 'Palantir', market: '美股', type: 'equity', shares: 1, costPrice: 72.78, currency: 'USD' },
            { symbol: 'RKLB', name: 'Rocket Lab', market: '美股', type: 'equity', shares: 1, costPrice: 23.40, currency: 'USD' },
            { symbol: 'DXYZ', name: 'Destiny Tech100', market: '美股', type: 'equity', shares: 1, costPrice: 69.20, currency: 'USD' },
            
            // 港股权益
            { symbol: '00981.HK', name: '中芯国际', market: '港股', type: 'equity', shares: 2500, costPrice: 64.13, currency: 'HKD' },
            { symbol: '09992.HK', name: '泡泡玛特', market: '港股', type: 'equity', shares: 600, costPrice: 214.80, currency: 'HKD' },
            { symbol: '03690.HK', name: '美团-W', market: '港股', type: 'equity', shares: 900, costPrice: 109.08, currency: 'HKD' },
            
            // ETF
            { symbol: 'VOO', name: '标普500ETF', market: '美股', type: 'etf', shares: 16.51, costPrice: 602.74, currency: 'USD' },
            { symbol: 'QQQ', name: '纳指100ETF', market: '美股', type: 'etf', shares: 16.94, costPrice: 585.75, currency: 'USD' },
            { symbol: '02800.HK', name: '盈富基金', market: '港股', type: 'etf', shares: 1000, costPrice: 23.89, currency: 'HKD' }
        ];

        // 现金等价物（货币基金+现金）
        this.cashEquivalents = [
            { symbol: '博时美元货币基金', name: '博时美元货币市场基金', market: '美股', type: 'cash_equivalent', shares: 51476, nav: 1.0, currency: 'USD' },
            { symbol: '易方达港元货币基金', name: '易方达（香港）港元货币市场基金', market: '港股', type: 'cash_equivalent', shares: 2273, nav: 1.0, currency: 'HKD' },
            { symbol: '美元现金', name: '美元现金', market: '美股', type: 'cash_equivalent', shares: 3471.46, nav: 1.0, currency: 'USD' }
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
            
            // 如果股票数据获取失败，标记为数据缺失，不显示价格
            if (!stockData) {
                console.warn(`股票 ${position.symbol} 数据获取失败`);
                const currency = position.currency;

                return {
                    ...position,
                    currentPrice: null, // 不显示价格
                    currency,
                    marketValueCNY: null,
                    costValueCNY: null,
                    pnlAmountCNY: null,
                    pnlPercent: null,
                    todayChange: null,
                    exchangeRate: null,
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
        
        // 计算股票和ETF的市值（用于占比显示）
        const equityValue = stockCalculations
            .filter(s => s.type === 'equity')
            .reduce((sum, s) => sum + s.marketValueCNY, 0);
        const etfValue = stockCalculations
            .filter(s => s.type === 'etf')
            .reduce((sum, s) => sum + s.marketValueCNY, 0);
        
        // 现金等价物（货币基金）已包含现金部分，不再单独计算现金余额
        const totalAssetsCNY = totalStockValueCNY + totalCashEquivalentValueCNY;
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

        // 计算风险（占比超过15%，排除现金等价物）
        const risks = [];
        stockCalculations.forEach(stock => {
            // 排除现金等价物
            if (stock.type === 'cash_equivalent') return;
            
            const weight = (stock.marketValueCNY / totalAssetsCNY) * 100;
            if (weight > 15) {
                risks.push({
                    type: 'concentration',
                    symbol: stock.symbol,
                    name: stock.name,
                    weight: weight.toFixed(1),
                    threshold: 15
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
            totalAssetsCNY,
            totalStockValueCNY,
            totalCashEquivalentValueCNY,
            totalPnlCNY,
            totalPnlPercent,
            positionRatio,
            goalProgress,
            equityValue,
            etfValue,
            equityStocks,
            etfStocks,
            cashEquivalentStocks,
            opportunities,
            risks,
            equityCount: equityStocks.length,
            etfCount: etfStocks.length,
            cashEquivalentCount: cashEquivalentStocks.length
        };
    }
}

// 导出
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PortfolioCalculator;
}
