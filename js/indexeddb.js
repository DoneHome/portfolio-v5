// IndexedDB 数据库管理
class PortfolioIndexedDB {
    constructor() {
        this.dbName = 'portfolio_v5_db';
        this.dbVersion = 1;
        this.db = null;
        this.init();
    }

    // 初始化数据库
    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);

            request.onerror = (event) => {
                console.error('IndexedDB 打开失败:', event.target.error);
                reject(event.target.error);
            };

            request.onsuccess = (event) => {
                this.db = event.target.result;
                console.log('IndexedDB 连接成功');
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                console.log('IndexedDB 升级中...');

                // 删除旧的对象存储（如果存在）
                if (db.objectStoreNames.contains('positions')) {
                    db.deleteObjectStore('positions');
                }
                if (db.objectStoreNames.contains('transactions')) {
                    db.deleteObjectStore('transactions');
                }
                if (db.objectStoreNames.contains('snapshots')) {
                    db.deleteObjectStore('snapshots');
                }
                if (db.objectStoreNames.contains('snapshot_holdings')) {
                    db.deleteObjectStore('snapshot_holdings');
                }
                if (db.objectStoreNames.contains('cash_management')) {
                    db.deleteObjectStore('cash_management');
                }

                // 创建 positions 表（持仓汇总）
                const positionsStore = db.createObjectStore('positions', { keyPath: ['symbol', 'type'] });
                positionsStore.createIndex('symbol', 'symbol', { unique: false });
                positionsStore.createIndex('type', 'type', { unique: false });
                positionsStore.createIndex('market', 'market', { unique: false });
                positionsStore.createIndex('updated_at', 'updated_at', { unique: false });

                // 创建 transactions 表（交易流水）
                const transactionsStore = db.createObjectStore('transactions', { keyPath: 'id', autoIncrement: true });
                transactionsStore.createIndex('symbol', 'symbol', { unique: false });
                transactionsStore.createIndex('trade_date', 'trade_date', { unique: false });
                transactionsStore.createIndex('direction', 'direction', { unique: false });
                transactionsStore.createIndex('created_at', 'created_at', { unique: false });

                // 创建 snapshots 表（快照）
                const snapshotsStore = db.createObjectStore('snapshots', { keyPath: 'id', autoIncrement: true });
                snapshotsStore.createIndex('date', 'date', { unique: false });
                snapshotsStore.createIndex('snapshot_type', 'snapshot_type', { unique: false });
                snapshotsStore.createIndex('timestamp', 'timestamp', { unique: false });

                // 创建 snapshot_holdings 表（快照持仓明细）
                const snapshotHoldingsStore = db.createObjectStore('snapshot_holdings', { keyPath: 'id', autoIncrement: true });
                snapshotHoldingsStore.createIndex('snapshot_id', 'snapshot_id', { unique: false });
                snapshotHoldingsStore.createIndex('symbol', 'symbol', { unique: false });

                // 创建 cash_management 表（现金管理）
                const cashStore = db.createObjectStore('cash_management', { keyPath: 'id' });

                console.log('IndexedDB 表结构创建完成');
            };
        });
    }

    // ========== 通用操作方法 ==========

    async _executeTransaction(storeName, mode, operation) {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject(new Error('数据库未初始化'));
                return;
            }

            const transaction = this.db.transaction([storeName], mode);
            const store = transaction.objectStore(storeName);

            transaction.onerror = (event) => {
                reject(event.target.error);
            };

            transaction.oncomplete = () => {
                resolve();
            };

            operation(store, transaction);
        });
    }

    async _getAll(storeName, indexName = null, query = null) {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject(new Error('数据库未初始化'));
                return;
            }

            const transaction = this.db.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            const target = indexName ? store.index(indexName) : store;

            const request = query ? target.getAll(query) : target.getAll();

            request.onsuccess = (event) => {
                resolve(event.target.result);
            };

            request.onerror = (event) => {
                reject(event.target.error);
            };
        });
    }

    async _getByKey(storeName, key) {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject(new Error('数据库未初始化'));
                return;
            }

            const transaction = this.db.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.get(key);

            request.onsuccess = (event) => {
                resolve(event.target.result);
            };

            request.onerror = (event) => {
                reject(event.target.error);
            };
        });
    }

    async _add(storeName, data) {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject(new Error('数据库未初始化'));
                return;
            }

            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.add(data);

            request.onsuccess = (event) => {
                resolve(event.target.result);
            };

            request.onerror = (event) => {
                reject(event.target.error);
            };
        });
    }

    async _put(storeName, data) {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject(new Error('数据库未初始化'));
                return;
            }

            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.put(data);

            request.onsuccess = (event) => {
                resolve(event.target.result);
            };

            request.onerror = (event) => {
                reject(event.target.error);
            };
        });
    }

    async _delete(storeName, key) {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject(new Error('数据库未初始化'));
                return;
            }

            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.delete(key);

            request.onsuccess = (event) => {
                resolve();
            };

            request.onerror = (event) => {
                reject(event.target.error);
            };
        });
    }

    // ========== 持仓管理 ==========

    async getPositions() {
        return await this._getAll('positions');
    }

    async getPosition(symbol, type = 'equity') {
        return await this._getByKey('positions', [symbol, type]);
    }

    async addOrUpdatePosition(position) {
        // 确保有更新时间戳
        if (!position.updated_at) {
            position.updated_at = new Date().toISOString();
        }
        if (!position.created_at) {
            position.created_at = new Date().toISOString();
        }

        return await this._put('positions', position);
    }

    async deletePosition(symbol, type = 'equity') {
        return await this._delete('positions', [symbol, type]);
    }

    // ========== 交易记录 ==========

    async addTransaction(transaction) {
        // 确保有创建时间
        if (!transaction.created_at) {
            transaction.created_at = new Date().toISOString();
        }
        if (!transaction.trade_date) {
            transaction.trade_date = new Date().toISOString().split('T')[0];
        }

        const id = await this._add('transactions', transaction);
        
        // 自动更新持仓
        await this._updatePositionFromTransaction(transaction);
        
        return id;
    }

    async getTransactions(limit = 100) {
        const transactions = await this._getAll('transactions', 'created_at');
        // 按时间倒序排序
        return transactions
            .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
            .slice(0, limit);
    }

    async getTransactionsBySymbol(symbol) {
        const transactions = await this._getAll('transactions', 'symbol', IDBKeyRange.only(symbol));
        return transactions.sort((a, b) => new Date(b.trade_date) - new Date(a.trade_date));
    }

    // ========== 自动计算持仓 ==========

    async _updatePositionFromTransaction(transaction) {
        const { symbol, direction, quantity, price, currency } = transaction;
        
        // 确定持仓类型（默认为 equity）
        const type = transaction.type || 'equity';
        
        // 获取现有持仓
        let position = await this.getPosition(symbol, type);
        
        if (direction === 'buy') {
            if (position) {
                // 买入：更新加权成本
                const totalShares = position.shares + quantity;
                const totalCost = position.shares * position.cost_price + quantity * price;
                const avgCost = totalCost / totalShares;
                
                position.shares = totalShares;
                position.cost_price = avgCost;
                position.updated_at = new Date().toISOString();
            } else {
                // 新持仓
                position = {
                    symbol,
                    name: transaction.name || symbol,
                    market: symbol.includes('.HK') ? '港股' : '美股',
                    type,
                    shares: quantity,
                    cost_price: price,
                    currency,
                    sector: transaction.sector,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                };
            }
        } else if (direction === 'sell') {
            if (position) {
                // 卖出：减少持仓
                position.shares = Math.max(0, position.shares - quantity);
                position.updated_at = new Date().toISOString();
                
                // 如果持仓为0，删除该记录
                if (position.shares === 0) {
                    await this.deletePosition(symbol, type);
                    return;
                }
            } else {
                // 没有持仓却要卖出，记录错误但不阻止
                console.warn(`尝试卖出不存在的持仓: ${symbol} (${type})`);
                return;
            }
        }
        
        // 保存更新后的持仓
        await this.addOrUpdatePosition(position);
    }

    // 重新计算所有持仓（从交易记录重建）
    async recalculatePositions() {
        console.log('重新计算所有持仓...');
        
        // 清空现有持仓
        const positions = await this.getPositions();
        for (const position of positions) {
            await this.deletePosition(position.symbol, position.type);
        }
        
        // 获取所有交易记录
        const transactions = await this._getAll('transactions');
        
        // 按时间顺序处理交易
        const sortedTransactions = transactions.sort((a, b) => 
            new Date(a.trade_date) - new Date(b.trade_date)
        );
        
        // 重新计算持仓
        for (const transaction of sortedTransactions) {
            await this._updatePositionFromTransaction(transaction);
        }
        
        console.log('持仓重新计算完成');
        return await this.getPositions();
    }

    // ========== 现金管理 ==========

    async getCash() {
        const cash = await this._getByKey('cash_management', 1);
        if (!cash) {
            // 初始化现金数据
            const defaultCash = {
                id: 1,
                usd_balance: 55882,
                hkd_balance: 2273,
                reserve_amount: 300000,
                investment_amount: 200000,
                emergency_amount: 130000,
                updated_at: new Date().toISOString()
            };
            await this._put('cash_management', defaultCash);
            return defaultCash;
        }
        return cash;
    }

    async updateCash(updates) {
        const cash = await this.getCash();
        Object.assign(cash, updates, { updated_at: new Date().toISOString() });
        return await this._put('cash_management', cash);
    }

    // ========== 快照管理 ==========

    async createSnapshot(snapshotData) {
        const now = new Date();
        const snapshot = {
            snapshot_type: snapshotData.snapshot_type || 'daily',
            timestamp: now.toISOString(),
            date: now.toISOString().split('T')[0],
            time: now.toTimeString().split(' ')[0],
            total_assets: snapshotData.total_assets || 0,
            stock_value: snapshotData.stock_value || 0,
            etf_value: snapshotData.etf_value || 0,
            cash_equivalent_value: snapshotData.cash_equivalent_value || 0,
            cash_value: snapshotData.cash_value || 0,
            total_pnl: snapshotData.total_pnl || 0,
            total_pnl_percent: snapshotData.total_pnl_percent || 0,
            position_ratio: snapshotData.position_ratio || 0,
            goal_progress: snapshotData.goal_progress || 0,
            initial_assets: snapshotData.initial_assets || 4442000,
            three_year_goal: snapshotData.three_year_goal || 5000000,
            market_context: JSON.stringify(snapshotData.market_context || {})
        };

        const snapshotId = await this._add('snapshots', snapshot);

        // 保存持仓明细
        const holdings = snapshotData.holdings || [];
        for (const holding of holdings) {
            await this._add('snapshot_holdings', {
                snapshot_id: snapshotId,
                symbol: holding.symbol,
                name: holding.name,
                type: holding.type,
                shares: holding.shares,
                cost_price: holding.cost_price,
                current_price: holding.current_price,
                market_value_cny: holding.market_value_cny,
                pnl_percent: holding.pnl_percent,
                currency: holding.currency
            });
        }

        return snapshotId;
    }

    async getSnapshots(limit = 100, snapshotType = null) {
        let snapshots = await this._getAll('snapshots', 'timestamp');
        
        if (snapshotType) {
            snapshots = snapshots.filter(s => s.snapshot_type === snapshotType);
        }
        
        return snapshots
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
            .slice(0, limit);
    }

    async getSnapshotWithHoldings(snapshotId) {
        const snapshot = await this._getByKey('snapshots', snapshotId);
        if (!snapshot) return null;

        const holdings = await this._getAll('snapshot_holdings', 'snapshot_id', IDBKeyRange.only(snapshotId));
        
        return {
            ...snapshot,
            holdings,
            market_context: JSON.parse(snapshot.market_context || '{}')
        };
    }

    // ========== 数据导出/导入 ==========

    async exportData() {
        const data = {
            positions: await this.getPositions(),
            transactions: await this._getAll('transactions'),
            snapshots: await this._getAll('snapshots'),
            snapshot_holdings: await this._getAll('snapshot_holdings'),
            cash_management: await this.getCash(),
            export_time: new Date().toISOString(),
            version: '1.0.0'
        };

        return data;
    }

    async importData(jsonData) {
        console.log('导入数据...');
        
        // 清空现有数据
        await this.clearAllData();
        
        // 导入数据
        if (jsonData.positions) {
            for (const position of jsonData.positions) {
                await this.addOrUpdatePosition(position);
            }
        }
        
        if (jsonData.transactions) {
            for (const transaction of jsonData.transactions) {
                await this._add('transactions', transaction);
            }
        }
        
        if (jsonData.snapshots) {
            for (const snapshot of jsonData.snapshots) {
                await this._add('snapshots', snapshot);
            }
        }
        
        if (jsonData.snapshot_holdings) {
            for (const holding of jsonData.snapshot_holdings) {
                await this._add('snapshot_holdings', holding);
            }
        }
        
        if (jsonData.cash_management) {
            await this._put('cash_management', jsonData.cash_management);
        }
        
        console.log('数据导入完成');
        return true;
    }

    async clearAllData() {
        console.log('清空所有数据...');
        
        await this._executeTransaction('positions', 'readwrite', (store) => {
            store.clear();
        });
        
        await this._executeTransaction('transactions', 'readwrite', (store) => {
            store.clear();
        });
        
        await this._executeTransaction('snapshots', 'readwrite', (store) => {
            store.clear();
        });
        
        await this._executeTransaction('snapshot_holdings', 'readwrite', (store) => {
            store.clear();
        });
        
        console.log('数据清空完成');
    }

    // ========== 初始化示例数据 ==========

    async initSampleData() {
        console.log('初始化示例数据...');
        
        // 检查是否已有数据
        const positions = await this.getPositions();
        if (positions.length > 0) {
            console.log('已有数据，跳过初始化');
            return;
        }
        
        // 初始化现金数据
        await this.getCash(); // 这会创建默认现金数据
        
        // 初始化持仓数据（从 SQLite 数据库迁移）
        const samplePositions = [
            // 美股权益
            { symbol: 'MU', name: '美光科技', market: '美股', type: 'equity', shares: 30, cost_price: 456.16, currency: 'USD', sector: 'tech', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
            { symbol: 'RKLB', name: 'Rocket Lab', market: '美股', type: 'equity', shares: 1, cost_price: 23.40, currency: 'USD', sector: 'tech', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
            { symbol: 'DXYZ', name: 'Destiny Tech100', market: '美股', type: 'equity', shares: 1, cost_price: 69.20, currency: 'USD', sector: 'finance', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
            { symbol: 'PDD', name: '拼多多', market: '美股', type: 'equity', shares: 200, cost_price: 109.77, currency: 'USD', sector: 'tech', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
            { symbol: 'PLTR', name: 'Palantir', market: '美股', type: 'equity', shares: 1, cost_price: 72.78, currency: 'USD', sector: 'tech', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
            
            // 美股ETF
            { symbol: 'VOO', name: '标普500ETF', market: '美股', type: 'etf', shares: 15.44, cost_price: 603.93, currency: 'USD', sector: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
            { symbol: 'QQQ', name: '纳指100ETF', market: '美股', type: 'etf', shares: 15.85, cost_price: 595.29, currency: 'USD', sector: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
            
            // 港股权益
            { symbol: '09992.HK', name: '泡泡玛特', market: '港股', type: 'equity', shares: 600, cost_price: 249.02, currency: 'HKD', sector: 'consumer', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
            { symbol: '03690.HK', name: '美团-W', market: '港股', type: 'equity', shares: 900, cost_price: 121.97, currency: 'HKD', sector: 'tech', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
            { symbol: '00981.HK', name: '中芯国际', market: '港股', type: 'equity', shares: 2500, cost_price: 30.53, currency: 'HKD', sector: 'tech', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
            
            // 港股ETF
            { symbol: '02800.HK', name: '盈富基金', market: '港股', type: 'etf', shares: 1000, cost_price: 29.13, currency: 'HKD', sector: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
            
            // 现金等价物
            { symbol: '博时美元货币基金', name: '博时美元货币市场基金', market: '美股', type: 'cash_equivalent', shares: 55882, cost_price: 1, currency: 'USD', sector: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
            { symbol: '易方达港元货币基金', name: '易方达（香港）港元货币市场基金', market: '港股', type: 'cash_equivalent', shares: 2273, cost_price: 1, currency: 'HKD', sector: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
        ];
        
        for (const position of samplePositions) {
            await this.addOrUpdatePosition(position);
        }
        
        console.log('示例数据初始化完成');
    }
}

// 全局数据库实例
const IndexedDB = new PortfolioIndexedDB();

// 导出为模块
if (typeof module !== 'undefined' && module.exports) {
    module.exports = IndexedDB;
}