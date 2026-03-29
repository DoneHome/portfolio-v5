// 持仓快照管理
class SnapshotManager {
    constructor() {
        this.storageKey = 'portfolio_snapshots';
    }

    // 获取所有快照
    getSnapshots() {
        const data = localStorage.getItem(this.storageKey);
        return data ? JSON.parse(data) : [];
    }

    // 保存快照
    saveSnapshot(snapshot) {
        const snapshots = this.getSnapshots();
        snapshots.push(snapshot);
        localStorage.setItem(this.storageKey, JSON.stringify(snapshots));
        return true;
    }

    // 创建快照
    createSnapshot(portfolioData) {
        const now = new Date();
        const snapshot = {
            id: now.getTime(),
            timestamp: now.toISOString(),
            date: now.toLocaleDateString('zh-CN'),
            time: now.toLocaleTimeString('zh-CN'),
            
            // 资产概览
            totalAssets: portfolioData.totalAssetsCNY || 0,
            stockValue: portfolioData.equityStocks?.reduce((sum, s) => sum + (s.marketValueCNY || 0), 0) || 0,
            etfValue: portfolioData.etfStocks?.reduce((sum, s) => sum + (s.marketValueCNY || 0), 0) || 0,
            cashEquivalentValue: portfolioData.totalCashEquivalentValueCNY || 0,
            cashValue: portfolioData.cash?.total || 0,
            
            // 盈亏数据
            totalPnl: portfolioData.totalPnlCNY || 0,
            totalPnlPercent: portfolioData.totalPnlPercent || 0,
            positionRatio: portfolioData.positionRatio || 0,
            goalProgress: portfolioData.goalProgress || 0,
            
            // 持仓明细
            holdings: [
                ...(portfolioData.equityStocks || []).map(s => ({
                    symbol: s.symbol,
                    name: s.name,
                    type: 'equity',
                    shares: s.shares,
                    costPrice: s.costPrice,
                    currentPrice: s.currentPrice,
                    marketValueCNY: s.marketValueCNY,
                    pnlPercent: s.pnlPercent,
                    currency: s.currency
                })),
                ...(portfolioData.etfStocks || []).map(s => ({
                    symbol: s.symbol,
                    name: s.name,
                    type: 'etf',
                    shares: s.shares,
                    costPrice: s.costPrice,
                    currentPrice: s.currentPrice,
                    marketValueCNY: s.marketValueCNY,
                    pnlPercent: s.pnlPercent,
                    currency: s.currency
                })),
                ...(portfolioData.cashEquivalents || []).map(s => ({
                    symbol: s.symbol,
                    name: s.name,
                    type: 'cash_equivalent',
                    shares: s.shares,
                    costPrice: s.costPrice,
                    currentPrice: s.currentPrice,
                    marketValueCNY: s.marketValueCNY,
                    pnlPercent: 0,
                    currency: s.currency
                }))
            ],
            
            // 市场环境（可扩展）
            marketContext: {
                note: '市场环境数据待接入'
            }
        };
        
        return this.saveSnapshot(snapshot);
    }

    // 获取最新快照
    getLatestSnapshot() {
        const snapshots = this.getSnapshots();
        return snapshots.length > 0 ? snapshots[snapshots.length - 1] : null;
    }

    // 获取特定时间范围的快照
    getSnapshotsByRange(startDate, endDate) {
        const snapshots = this.getSnapshots();
        return snapshots.filter(s => {
            const snapshotDate = new Date(s.timestamp);
            return snapshotDate >= startDate && snapshotDate <= endDate;
        });
    }

    // 获取周报快照（最近7天，每天一个）
    getWeeklySnapshots() {
        const end = new Date();
        const start = new Date();
        start.setDate(start.getDate() - 7);
        return this.getSnapshotsByRange(start, end);
    }

    // 获取月报快照（最近30天）
    getMonthlySnapshots() {
        const end = new Date();
        const start = new Date();
        start.setDate(start.getDate() - 30);
        return this.getSnapshotsByRange(start, end);
    }

    // 获取年报快照（最近365天）
    getYearlySnapshots() {
        const end = new Date();
        const start = new Date();
        start.setDate(start.getDate() - 365);
        return this.getSnapshotsByRange(start, end);
    }

    // 对比两个快照
    compareSnapshots(snapshot1, snapshot2) {
        return {
            timeDiff: snapshot2.timestamp - snapshot1.timestamp,
            assetsDiff: snapshot2.totalAssets - snapshot1.totalAssets,
            assetsDiffPercent: ((snapshot2.totalAssets - snapshot1.totalAssets) / snapshot1.totalAssets * 100).toFixed(2),
            pnlDiff: snapshot2.totalPnl - snapshot1.totalPnl,
            positionRatioDiff: (snapshot2.positionRatio - snapshot1.positionRatio).toFixed(1),
            goalProgressDiff: (snapshot2.goalProgress - snapshot1.goalProgress).toFixed(1)
        };
    }

    // 删除快照
    deleteSnapshot(id) {
        const snapshots = this.getSnapshots();
        const filtered = snapshots.filter(s => s.id !== id);
        localStorage.setItem(this.storageKey, JSON.stringify(filtered));
        return true;
    }

    // 清空所有快照
    clearAllSnapshots() {
        localStorage.removeItem(this.storageKey);
        return true;
    }
}

// 全局快照管理器
const SnapshotMgr = new SnapshotManager();