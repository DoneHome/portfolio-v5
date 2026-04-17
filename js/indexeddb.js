// IndexedDB 数据库管理
class PortfolioIndexedDB {
    constructor() {
        this.dbName = 'portfolio_v5_db';
        this.dbVersion = 3;  // 增加版本号，强制触发升级（修改主键结构）
        this.db = null;
        // 注意：init() 是异步方法，需要在外部显式调用
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
                if (db.objectStoreNames.contains('goals')) {
                    db.deleteObjectStore('goals');
                }
                if (db.objectStoreNames.contains('metadata')) {
                    db.deleteObjectStore('metadata');
                }

                // 创建 positions 表（持仓汇总）
                // 主键改为 [symbol, option_symbol] 以支持同一标的多个期权合约
                // 对于非期权，option_symbol 为 null
                const positionsStore = db.createObjectStore('positions', { keyPath: ['symbol', 'option_symbol'] });
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

                // 创建 goals 表（目标配置）
                const goalsStore = db.createObjectStore('goals', { keyPath: 'id' });
                goalsStore.createIndex('updated_at', 'updated_at', { unique: false });

                // 创建 metadata 表（元数据）
                const metadataStore = db.createObjectStore('metadata', { keyPath: 'key' });
                metadataStore.createIndex('updated_at', 'updated_at', { unique: false });

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

            try {
                const transaction = this.db.transaction([storeName], 'readwrite');
                const store = transaction.objectStore(storeName);
                
                // 调试：检查要保存的数据
                // if (storeName === 'positions') {
                //     console.log('IndexedDB 保存数据 - 详细信息:', {
                //         symbol: data.symbol,
                //         option_symbol: data.option_symbol,
                //         type: data.type,
                //         keyPath: store.keyPath,
                //         // 检查键值是否有效
                //         symbolValid: typeof data.symbol === 'string' && data.symbol.trim() !== '',
                //         optionSymbolValid: data.option_symbol === '' || (typeof data.option_symbol === 'string' && data.option_symbol.trim() !== ''),
                //         // 完整的键值
                //         fullKey: [data.symbol, data.option_symbol],
                //         // 数据类型检查
                //         symbolType: typeof data.symbol,
                //         optionSymbolType: typeof data.option_symbol,
                //         // 原始数据（前几个字段）
                //         dataPreview: {
                //             symbol: data.symbol,
                //             name: data.name,
                //             market: data.market,
                //             type: data.type,
                //             shares: data.shares,
                //             cost_price: data.cost_price,
                //             currency: data.currency,
                //             option_symbol: data.option_symbol,
                //             option_details: data.option_details,
                //             created_at: data.created_at,
                //             updated_at: data.updated_at
                //         }
                //     });
                // }
                
                const request = store.put(data);

                request.onsuccess = (event) => {
                    resolve(event.target.result);
                };

                request.onerror = (event) => {
                    console.error(`数据保存失败: storeName=${storeName}, data=`, data, 'error=', event.target.error);
                    reject(event.target.error);
                };
                
                transaction.onerror = (event) => {
                    console.error(`事务错误:`, event.target.error);
                };
                
            } catch (error) {
                console.error(`_put() 执行异常: storeName=${storeName}, data=`, data, 'error=', error);
                reject(error);
            }
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

    async getPosition(symbol, optionSymbol = '') {
        return await this._getByKey('positions', [symbol, optionSymbol]);
    }

    async addOrUpdatePosition(position) {
        // console.log('addOrUpdatePosition 开始处理:', { symbol: position.symbol, type: position.type });
        
        // 验证必要字段
        if (!position.symbol || typeof position.symbol !== 'string' || position.symbol.trim() === '') {
            throw new Error(`无效的 symbol: ${position.symbol}`);
        }
        
        if (!position.type || typeof position.type !== 'string' || position.type.trim() === '') {
            throw new Error(`无效的 type: ${position.type}`);
        }
        
        // 确保有更新时间戳
        if (!position.updated_at) {
            position.updated_at = new Date().toISOString();
        }
        if (!position.created_at) {
            position.created_at = new Date().toISOString();
        }
        
        // 确保有 option_symbol 字段
        // 对于期权：使用期权代码
        // 对于非期权：使用空字符串 ''（IndexedDB 不接受 null 作为复合键的一部分）
        if (position.type === 'option' && position.option_details && position.option_details.option_symbol) {
            position.option_symbol = position.option_details.option_symbol;
            // 验证期权代码
            if (typeof position.option_symbol !== 'string' || position.option_symbol.trim() === '') {
                throw new Error(`无效的 option_symbol: ${position.option_symbol}`);
            }
        } else {
            // 非期权或没有 option_details，option_symbol 使用空字符串
            // IndexedDB 的复合键不接受 null，但接受空字符串
            position.option_symbol = '';
        }
        
        //console.log('addOrUpdatePosition 处理完成:', { 
        //    symbol: position.symbol, 
        //    type: position.type, 
        //    option_symbol: position.option_symbol,
        //    hasOptionDetails: !!position.option_details
        //});

        return await this._put('positions', position);
    }

    // addPosition 作为 addOrUpdatePosition 的别名，保持向后兼容
    async addPosition(position) {
        return await this.addOrUpdatePosition(position);
    }

    async deletePosition(symbol, optionSymbol = '') {
        return await this._delete('positions', [symbol, optionSymbol]);
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
        
        // 如果传入的 transaction 有 id，删除它让 IndexedDB 自动生成
        if (transaction.id !== undefined) {
            delete transaction.id;
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
        
        // 对于期权，需要 option_symbol 作为主键的一部分
        let optionSymbol = '';
        if (type === 'option' && transaction.option_details) {
            optionSymbol = transaction.option_details.option_symbol;
        }
        
        // 获取现有持仓
        let position = await this.getPosition(symbol, optionSymbol);
        
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
                    option_symbol: optionSymbol,  // 对于期权，这是主键的一部分
                    name: transaction.name || symbol,
                    market: symbol.includes('.HK') ? '港股' : '美股',
                    type,
                    shares: quantity,
                    cost_price: price,
                    currency,
                    sector: transaction.sector,
                    option_details: transaction.option_details,
                    cash_details: transaction.cash_details,
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
                    await this.deletePosition(symbol, optionSymbol);
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
            await this.deletePosition(position.symbol, position.option_symbol || '');
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
            // 返回空现金数据，等待用户录入
            return {
                id: 1,
                usd_balance: 0,
                hkd_balance: 0,
                reserve_amount: 0,
                investment_amount: 0,
                emergency_amount: 0,
                updated_at: new Date().toISOString()
            };
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

    // ========== 数据管理方法 ==========

    // 清空指定表的数据
    async clear(storeName) {
        // 检查数据库是否已初始化
        if (!this.db) {
            await this.init();
        }
        
        return new Promise((resolve, reject) => {
            try {
                const transaction = this.db.transaction([storeName], 'readwrite');
                const store = transaction.objectStore(storeName);
                
                const request = store.clear();
                
                request.onsuccess = () => {
                    resolve();
                };
                
                request.onerror = (event) => {
                    console.error(`清空表 ${storeName} 数据失败:`, event.target.error);
                    reject(event.target.error);
                };
                
                transaction.onerror = (event) => {
                    console.error(`事务错误:`, event.target.error);
                };
                
            } catch (error) {
                console.error(`clear() 执行异常:`, error);
                reject(error);
            }
        });
    }

    // 清空所有持仓数据
    async clearPositions() {
        return await this.clear('positions');
    }

    // 保存数据到指定表
    async put(storeName, data) {
        // 检查数据库是否已初始化
        if (!this.db) {
            await this.init();
        }
        
        // 对于 positions 表，使用 addOrUpdatePosition 以确保数据完整性
        if (storeName === 'positions') {
            return await this.addOrUpdatePosition(data);
        }
        
        // 其他表使用原始的 _put 方法
        return await this._put(storeName, data);
    }

    // ========== 初始化示例数据 ==========

    async initSampleData() {
        console.log('初始化真实持仓数据...');
        
        // 初始化真实持仓数据
        const realPositions = [
            // 美股权益
            { symbol: 'PDD', name: '拼多多', market: '美股', type: 'equity', shares: 200, cost_price: 109.77, currency: 'USD', sector: 'tech', option_symbol: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
            { symbol: 'MU', name: '美光科技', market: '美股', type: 'equity', shares: 30, cost_price: 379.17, currency: 'USD', sector: 'tech', option_symbol: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
            { symbol: 'PLTR', name: 'Palantir', market: '美股', type: 'equity', shares: 1, cost_price: 72.78, currency: 'USD', sector: 'tech', option_symbol: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
            { symbol: 'RKLB', name: 'Rocket Lab', market: '美股', type: 'equity', shares: 1, cost_price: 23.40, currency: 'USD', sector: 'tech', option_symbol: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
            { symbol: 'DXYZ', name: 'Destiny Tech100', market: '美股', type: 'equity', shares: 1, cost_price: 69.20, currency: 'USD', sector: 'finance', option_symbol: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
            
            // 港股权益
            { symbol: '00981.HK', name: '中芯国际', market: '港股', type: 'equity', shares: 2500, cost_price: 64.13, currency: 'HKD', sector: 'tech', option_symbol: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
            { symbol: '09992.HK', name: '泡泡玛特', market: '港股', type: 'equity', shares: 600, cost_price: 214.80, currency: 'HKD', sector: 'consumer', option_symbol: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
            { symbol: '03690.HK', name: '美团-W', market: '港股', type: 'equity', shares: 900, cost_price: 109.08, currency: 'HKD', sector: 'tech', option_symbol: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
            
            // ETF
            { symbol: 'VOO', name: '标普500ETF', market: '美股', type: 'etf', shares: 16.51, cost_price: 602.74, currency: 'USD', sector: null, option_symbol: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
            { symbol: 'QQQ', name: '纳指100ETF', market: '美股', type: 'etf', shares: 16.94, cost_price: 585.75, currency: 'USD', sector: null, option_symbol: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
            { symbol: '02800.HK', name: '盈富基金', market: '港股', type: 'etf', shares: 1000, cost_price: 23.89, currency: 'HKD', sector: null, option_symbol: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
            
            // 现金等价物
            { symbol: '博时美元货币基金', name: '博时美元货币市场基金', market: '美股', type: 'cash_equivalent', shares: 51476, cost_price: 1, currency: 'USD', sector: null, option_symbol: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
            { symbol: '易方达港元货币基金', name: '易方达（香港）港元货币市场基金', market: '港股', type: 'cash_equivalent', shares: 2273, cost_price: 1, currency: 'HKD', sector: null, option_symbol: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
            { symbol: '美元现金', name: '美元现金', market: '美股', type: 'cash_equivalent', shares: 3471.46, cost_price: 1, currency: 'USD', sector: null, option_symbol: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
        ];
        
        for (const position of realPositions) {
            await this.addOrUpdatePosition(position);
        }
        
        console.log('真实持仓数据初始化完成');
    }
}

// 全局数据库实例
const IndexedDB = new PortfolioIndexedDB();

// 导出为模块
if (typeof module !== 'undefined' && module.exports) {
    module.exports = IndexedDB;
}