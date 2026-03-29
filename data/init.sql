-- 持仓总览数据库初始化脚本
-- 数据库文件: data/portfolio.db

-- 持仓表
CREATE TABLE IF NOT EXISTS positions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    symbol TEXT NOT NULL,
    name TEXT NOT NULL,
    market TEXT NOT NULL,  -- 美股/港股
    type TEXT NOT NULL,    -- equity/etf/cash_equivalent
    shares REAL NOT NULL,
    cost_price REAL NOT NULL,
    currency TEXT NOT NULL, -- USD/HKD
    sector TEXT,           -- 行业分类
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 交易记录表
CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    symbol TEXT NOT NULL,
    name TEXT,
    direction TEXT NOT NULL,  -- buy/sell
    quantity REAL NOT NULL,
    price REAL NOT NULL,
    currency TEXT NOT NULL,
    trade_date DATE NOT NULL,
    strategy TEXT,            -- 策略标签
    emotion TEXT,             -- 情绪标签
    take_profit REAL,         -- 止盈价
    stop_loss REAL,           -- 止损价
    reason TEXT,              -- 交易理由
    notes TEXT,               -- 备注
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 持仓快照表
CREATE TABLE IF NOT EXISTS snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    snapshot_type TEXT NOT NULL,  -- daily/weekly/monthly/yearly
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    date TEXT NOT NULL,
    time TEXT NOT NULL,
    
    -- 资产概览
    total_assets REAL NOT NULL,
    stock_value REAL DEFAULT 0,
    etf_value REAL DEFAULT 0,
    cash_equivalent_value REAL DEFAULT 0,
    cash_value REAL DEFAULT 0,
    
    -- 盈亏数据
    total_pnl REAL DEFAULT 0,
    total_pnl_percent REAL DEFAULT 0,
    position_ratio REAL DEFAULT 0,
    goal_progress REAL DEFAULT 0,
    
    -- 年初资产和目标
    initial_assets REAL,
    three_year_goal REAL DEFAULT 5000000,
    
    -- 市场环境（JSON格式，可扩展）
    market_context TEXT
);

-- 快照持仓明细表
CREATE TABLE IF NOT EXISTS snapshot_holdings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    snapshot_id INTEGER NOT NULL,
    symbol TEXT NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL,       -- equity/etf/cash_equivalent
    shares REAL NOT NULL,
    cost_price REAL NOT NULL,
    current_price REAL NOT NULL,
    market_value_cny REAL NOT NULL,
    pnl_percent REAL DEFAULT 0,
    currency TEXT NOT NULL,
    FOREIGN KEY (snapshot_id) REFERENCES snapshots(id) ON DELETE CASCADE
);

-- 现金管理表
CREATE TABLE IF NOT EXISTS cash_management (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    usd_balance REAL DEFAULT 0,
    hkd_balance REAL DEFAULT 0,
    reserve_amount REAL DEFAULT 0,      -- 预留加仓
    investment_amount REAL DEFAULT 0,   -- 定投资金
    emergency_amount REAL DEFAULT 0,    -- 应急储备
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_positions_symbol ON positions(symbol);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(trade_date);
CREATE INDEX IF NOT EXISTS idx_snapshots_date ON snapshots(date);
CREATE INDEX IF NOT EXISTS idx_snapshots_type ON snapshots(snapshot_type);
CREATE INDEX IF NOT EXISTS idx_snapshot_holdings_snapshot_id ON snapshot_holdings(snapshot_id);

-- 插入初始现金数据
INSERT OR REPLACE INTO cash_management (id, usd_balance, hkd_balance)
VALUES (1, 55882, 2273);

-- 插入初始持仓数据
INSERT OR REPLACE INTO positions (symbol, name, market, type, shares, cost_price, currency, sector) VALUES
-- 美股权益
('MU', '美光科技', '美股', 'equity', 30, 456.16, 'USD', 'tech'),
('RKLB', 'Rocket Lab', '美股', 'equity', 1, 23.40, 'USD', 'tech'),
('DXYZ', 'Destiny Tech100', '美股', 'equity', 1, 69.20, 'USD', 'finance'),
('PDD', '拼多多', '美股', 'equity', 200, 109.77, 'USD', 'tech'),
('PLTR', 'Palantir', '美股', 'equity', 1, 72.78, 'USD', 'tech'),
-- 美股ETF
('VOO', '标普500ETF', '美股', 'etf', 15.44, 603.93, 'USD', NULL),
('QQQ', '纳指100ETF', '美股', 'etf', 15.85, 595.29, 'USD', NULL),
-- 港股权益
('09992.HK', '泡泡玛特', '港股', 'equity', 600, 249.02, 'HKD', 'consumer'),
('03690.HK', '美团-W', '港股', 'equity', 900, 121.97, 'HKD', 'tech'),
('00981.HK', '中芯国际', '港股', 'equity', 2500, 30.53, 'HKD', 'tech'),
-- 港股ETF
('02800.HK', '盈富基金', '港股', 'etf', 1000, 29.13, 'HKD', NULL),
-- 现金等价物
('博时美元货币基金', '博时美元货币市场基金', '美股', 'cash_equivalent', 55882, 1, 'USD', NULL),
('易方达港元货币基金', '易方达（香港）港元货币市场基金', '港股', 'cash_equivalent', 2273, 1, 'HKD', NULL);