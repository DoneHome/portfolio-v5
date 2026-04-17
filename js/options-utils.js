// 期权数据提取和计算工具
// 版本：1.0.0
// 创建时间：2026-04-17
// 遵循技术方案：期权持仓展示模块优化方案.md

class OptionsUtils {
    /**
     * 从 position 对象提取期权信息
     * @param {Object} position - 持仓对象
     * @returns {Object|null} 期权数据对象，非期权返回null
     */
    static extractOptionData(position) {
        if (position.type !== 'option' || !position.option_details) {
            return null;
        }
        
        const details = position.option_details;
        return {
            // 基础信息
            symbol: position.symbol,
            option_symbol: details.option_symbol,
            quantity: position.quantity,  // 带符号：正数为买入，负数为卖出
            
            // 权利金（重要：cost_price 总是正数）
            // - 卖出：收入权利金，cost_price 为正
            // - 买入：支出权利金，cost_price 为正
            // 方向由 transaction_type 字段决定
            cost_price: position.cost_price,
            
            // 期权详情
            strike_price: details.strike_price,
            expiration_date: details.expiry_date || details.expiration_date,
            option_type: details.option_type,           // 'call' 或 'put'
            transaction_type: details.transaction_type, // 'buy' 或 'sell'
            
            // 合约乘数（数据库中已有）
            contract_multiplier: details.contract_multiplier || 100,
            
            // 其他分析字段
            intrinsic_value: details.intrinsic_value,
            time_value: details.time_value,
            implied_volatility: details.implied_volatility
        };
    }
    
    /**
     * 获取合约乘数（数据库中已有 contract_multiplier 字段）
     * @param {Object} optionData - 期权数据对象
     * @returns {number} 合约乘数
     */
    static getContractMultiplier(optionData) {
        // 直接使用数据库中的 contract_multiplier 字段
        // 该字段位于 option_details 对象中
        return optionData.contract_multiplier || 100;
    }
    
    /**
     * 计算安全边际（价差百分比）
     * @param {Object} optionData - 期权数据对象
     * @param {number} currentPrice - 当前股价
     * @returns {number} 安全边际百分比
     */
    static calculateSafetyMargin(optionData, currentPrice) {
        const strikePrice = optionData.strike_price;
        const optionType = optionData.option_type; // 'call' 或 'put'
        
        // 计算价差百分比
        let priceDiffPercent;
        if (optionType === 'put') {
            // 看跌期权：安全边际 = (当前股价 - 行权价) / 当前股价
            priceDiffPercent = ((currentPrice - strikePrice) / currentPrice) * 100;
        } else {
            // 看涨期权：安全边际 = (行权价 - 当前股价) / 当前股价
            priceDiffPercent = ((strikePrice - currentPrice) / currentPrice) * 100;
        }
        
        return priceDiffPercent;
    }
    
    /**
     * 根据安全边际获取虚实状态和颜色
     * @param {Object} optionData - 期权数据对象
     * @param {number} currentPrice - 当前股价
     * @returns {Object} 状态信息对象
     */
    static getMoneynessAndColor(optionData, currentPrice) {
        const safetyMargin = this.calculateSafetyMargin(optionData, currentPrice);
        
        // 判断实值/虚值（仅用于文字显示）
        let moneynessText;
        if (optionData.option_type === 'call') {
            moneynessText = currentPrice > optionData.strike_price ? '实值' : '虚值';
        } else {
            moneynessText = currentPrice < optionData.strike_price ? '实值' : '虚值';
        }
        
        // 根据安全边际确定颜色（核心逻辑）
        let color;
        let status;
        
        if (moneynessText === '实值') {
            // 实值：一律红色（危险）
            color = 'red';
            status = '危险';
        } else {
            // 虚值：根据安全边际分级
            if (safetyMargin > 10) {
                color = 'green';
                status = '安全';
            } else if (safetyMargin > 5) {
                color = 'blue';
                status = '关注';
            } else if (safetyMargin > 0) {
                color = 'yellow';
                status = '警示';
            } else {
                // 价差为0或负值（平值或实值）
                color = 'red';
                status = '危险';
            }
        }
        
        return {
            安全边际: safetyMargin.toFixed(2) + '%',
            虚实状态: moneynessText,
            状态颜色: color,
            风险等级: status,
            价差百分比: safetyMargin.toFixed(2)
        };
    }
    
    /**
     * 修正后的浮动盈亏计算（考虑合约乘数和交易方向）
     * @param {Object} optionData - 期权数据对象
     * @param {number} currentPremium - 当前权利金
     * @returns {Object} 盈亏信息对象
     */
    static calculateFloatingPnl(optionData, currentPremium) {
        const costPrice = optionData.cost_price;
        const quantity = Math.abs(optionData.quantity);
        const transactionType = optionData.transaction_type; // 'buy' 或 'sell'
        
        // 获取合约乘数
        const multiplier = this.getContractMultiplier(optionData);
        
        // 计算每股盈亏（考虑交易方向）
        let pnlPerShare;
        if (transactionType === 'sell') {
            // 卖方：权利金下降为盈利，上升为亏损
            pnlPerShare = (costPrice - currentPremium) * multiplier;
        } else {
            // 买方：权利金上升为盈利，下降为亏损
            pnlPerShare = (currentPremium - costPrice) * multiplier;
        }
        
        // 总盈亏
        const totalPnl = pnlPerShare * quantity;
        
        return {
            每股盈亏: pnlPerShare.toFixed(2),
            总盈亏: totalPnl.toFixed(2),
            合约乘数: multiplier,
            交易方向: transactionType === 'sell' ? '卖方' : '买方',
            盈亏状态: totalPnl > 0 ? '盈利' : totalPnl < 0 ? '亏损' : '持平'
        };
    }
    
    /**
     * 修正后的市值计算
     * @param {Object} optionData - 期权数据对象
     * @param {number} currentPremium - 当前权利金
     * @returns {number} 市值
     */
    static calculateMarketValue(optionData, currentPremium) {
        const quantity = Math.abs(optionData.quantity);
        const multiplier = this.getContractMultiplier(optionData);
        
        // 市值 = 当前权利金 × 合约乘数 × 合约数
        const marketValue = currentPremium * multiplier * quantity;
        
        return marketValue;
    }
    
    /**
     * 完整的期权盈亏分析
     * @param {Object} optionData - 期权数据对象
     * @param {number} currentPrice - 当前股价
     * @param {number} currentPremium - 当前权利金
     * @returns {Object} 盈亏分析对象
     */
    static calculateProfitLossAnalysis(optionData, currentPrice, currentPremium) {
        const strikePrice = optionData.strike_price;
        const costPrice = optionData.cost_price;
        const optionType = optionData.option_type;
        const transactionType = optionData.transaction_type;
        const quantity = Math.abs(optionData.quantity);
        
        // 1. 盈亏平衡点
        // 重要：cost_price 总是正数，方向由 transaction_type 决定
        // - 卖出：收入权利金，cost_price 为正
        // - 买入：支出权利金，cost_price 为正
        let breakEven;
        if (optionType === 'put') {
            // 看跌期权盈亏平衡点
            if (transactionType === 'sell') {
                // 卖出看跌：行权价 - 权利金（收入降低盈亏平衡点）
                breakEven = strikePrice - costPrice;
            } else {
                // 买入看跌：行权价 - 权利金（支出提高盈亏平衡点）
                breakEven = strikePrice - costPrice;
            }
        } else {
            // 看涨期权盈亏平衡点
            if (transactionType === 'sell') {
                // 卖出看涨：行权价 + 权利金（收入提高盈亏平衡点）
                breakEven = strikePrice + costPrice;
            } else {
                // 买入看涨：行权价 + 权利金（支出降低盈亏平衡点）
                breakEven = strikePrice + costPrice;
            }
        }
        
        // 2. 最大盈利
        let maxProfit;
        if (transactionType === 'sell') {
            // 卖方最大盈利 = 收到的权利金
            maxProfit = costPrice * this.getContractMultiplier(optionData) * quantity;
        } else {
            // 买方最大盈利理论上无限（看涨）或行权价-权利金（看跌）
            if (optionType === 'call') {
                maxProfit = '无限';
            } else {
                maxProfit = (strikePrice - costPrice) * this.getContractMultiplier(optionData) * quantity;
            }
        }
        
        // 3. 最大亏损
        let maxLoss;
        if (transactionType === 'sell') {
            // 卖方最大亏损理论上无限（看涨）或行权价-权利金（看跌）
            if (optionType === 'call') {
                maxLoss = '无限';
            } else {
                maxLoss = (strikePrice - costPrice) * this.getContractMultiplier(optionData) * quantity;
            }
        } else {
            // 买方最大亏损 = 支付的权利金
            maxLoss = costPrice * this.getContractMultiplier(optionData) * quantity;
        }
        
        // 4. 当前盈亏状态
        let currentStatus;
        if (optionType === 'put') {
            if (transactionType === 'sell') {
                // 卖出看跌：股价高于盈亏平衡点为盈利
                currentStatus = currentPrice > breakEven ? '盈利' : '亏损';
            } else {
                // 买入看跌：股价低于盈亏平衡点为盈利
                currentStatus = currentPrice < breakEven ? '盈利' : '亏损';
            }
        } else {
            if (transactionType === 'sell') {
                // 卖出看涨：股价低于盈亏平衡点为盈利
                currentStatus = currentPrice < breakEven ? '盈利' : '亏损';
            } else {
                // 买入看涨：股价高于盈亏平衡点为盈利
                currentStatus = currentPrice > breakEven ? '盈利' : '亏损';
            }
        }
        
        // 5. 安全边际（针对卖方策略）
        let safetyMargin = null;
        if (transactionType === 'sell') {
            if (optionType === 'put') {
                // 卖出看跌的安全边际 = (当前股价 - 盈亏平衡点) / 当前股价
                safetyMargin = ((currentPrice - breakEven) / currentPrice * 100).toFixed(2);
            } else {
                // 卖出看涨的安全边际 = (盈亏平衡点 - 当前股价) / 当前股价
                safetyMargin = ((breakEven - currentPrice) / currentPrice * 100).toFixed(2);
            }
        }
        
        return {
            盈亏平衡点: breakEven.toFixed(2),
            最大盈利: typeof maxProfit === 'string' ? maxProfit : maxProfit.toFixed(2),
            最大亏损: typeof maxLoss === 'string' ? maxLoss : maxLoss.toFixed(2),
            当前盈亏状态: currentStatus,
            安全边际: safetyMargin ? safetyMargin + '%' : null
        };
    }
    
    /**
     * 完整的期权状态分析
     * @param {Object} optionData - 期权数据对象
     * @param {number} currentPrice - 当前股价
     * @param {number} currentPremium - 当前权利金
     * @returns {Object} 完整的状态分析对象
     */
    static analyzeOptionStatus(optionData, currentPrice, currentPremium) {
        const safetyMargin = this.calculateSafetyMargin(optionData, currentPrice);
        const moneynessInfo = this.getMoneynessAndColor(optionData, currentPrice);
        const pnlAnalysis = this.calculateProfitLossAnalysis(optionData, currentPrice, currentPremium);
        const floatingPnl = this.calculateFloatingPnl(optionData, currentPremium);
        const marketValue = this.calculateMarketValue(optionData, currentPremium);
        
        return {
            // 安全边际分析
            ...moneynessInfo,
            
            // 盈亏分析
            ...pnlAnalysis,
            
            // 浮动盈亏
            浮动盈亏: floatingPnl.总盈亏,
            盈亏方向: floatingPnl.交易方向,
            
            // 市值
            市值: marketValue.toFixed(2),
            
            // 综合风险评估
            综合风险: safetyMargin > 10 ? '低风险' : 
                     safetyMargin > 5 ? '中风险' : 
                     safetyMargin > 0 ? '高风险' : '极高风险',
            
            // 决策建议（针对卖出看跌期权）
            决策建议: optionData.transaction_type === 'sell' && optionData.option_type === 'put' ? 
                safetyMargin > 10 ? '持有' :
                safetyMargin > 5 ? '密切关注' :
                safetyMargin > 0 ? '考虑平仓' : '立即平仓'
                : '根据策略调整'
        };
    }
    
    /**
     * 计算展示字段（用于表格渲染）
     * @param {Object} optionData - 期权数据对象
     * @param {number} currentPrice - 当前股价
     * @param {number} currentPremium - 当前权利金
     * @returns {Object} 展示字段对象
     */
    static calculateDisplayFields(optionData, currentPrice, currentPremium) {
        const status = this.analyzeOptionStatus(optionData, currentPrice, currentPremium);
        const quantity = Math.abs(optionData.quantity);
        const multiplier = this.getContractMultiplier(optionData);
        
        // 方向显示
        const directionMap = {
            'buy_call': '买入看涨',
            'sell_call': '卖出看涨', 
            'buy_put': '买入看跌',
            'sell_put': '卖出看跌'
        };
        const directionKey = `${optionData.transaction_type}_${optionData.option_type}`;
        const direction = directionMap[directionKey] || '未知';
        
        return {
            // 基础信息
            标的: optionData.symbol,
            期权代码: optionData.option_symbol,
            方向: direction,
            合约数: `${quantity}张`,
            行权价: optionData.strike_price.toFixed(2),
            
            // 权利金信息
            开仓权利金: (optionData.cost_price * quantity * multiplier).toFixed(2),
            当前权利金: currentPremium.toFixed(2),
            当前股价: currentPrice.toFixed(2),
            
            // 分析指标
            价差百分比: status.价差百分比 + '%',
            虚实状态: status.虚实状态,
            距到期天数: this.calculateDaysToExpiry(optionData.expiration_date),
            盈亏平衡点: status.盈亏平衡点,
            
            // 盈亏信息
            浮动盈亏: status.浮动盈亏,
            市值: status.市值,
            
            // 样式标识
            状态颜色: status.状态颜色,
            风险等级: status.风险等级
        };
    }
    
    /**
     * 计算距到期天数
     * @param {string} expirationDate - 到期日字符串 (YYYY-MM-DD)
     * @returns {number} 距到期天数
     */
    static calculateDaysToExpiry(expirationDate) {
        if (!expirationDate) return 0;
        
        try {
            const expiry = new Date(expirationDate);
            const today = new Date();
            
            // 重置时间为0点，避免时间差影响
            expiry.setHours(0, 0, 0, 0);
            today.setHours(0, 0, 0, 0);
            
            const diffTime = expiry - today;
            const diffDays = Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));
            
            return diffDays;
        } catch (error) {
            console.error('计算到期天数失败:', error);
            return 0;
        }
    }
}

// 全局导出
if (typeof module !== 'undefined' && module.exports) {
    module.exports = OptionsUtils;
} else {
    window.OptionsUtils = OptionsUtils;
}