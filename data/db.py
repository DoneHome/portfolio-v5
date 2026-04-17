"""
数据库操作模块
提供持仓、交易、快照等数据的CRUD操作
"""

import sqlite3
import json
from pathlib import Path
from datetime import datetime

class PortfolioDB:
    def __init__(self, db_path=None):
        if db_path is None:
            # 默认数据库路径
            self.db_path = Path(__file__).parent / "portfolio.db"
        else:
            self.db_path = Path(db_path)
        
        # 确保数据库文件存在
        self._init_database()
    
    def _init_database(self):
        """初始化数据库表结构"""
        if not self.db_path.exists():
            print(f"创建新数据库: {self.db_path}")
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            # 创建持仓表
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS positions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    symbol TEXT NOT NULL,
                    name TEXT,
                    market TEXT,
                    type TEXT,  -- 'stock', 'etf', 'option', 'cash_equivalent'
                    shares REAL,
                    cost_price REAL,
                    currency TEXT DEFAULT 'CNY',
                    sector TEXT,
                    weight REAL DEFAULT 0,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            ''')
            
            # 创建期权详情表
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS option_details (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    position_id INTEGER,
                    option_symbol TEXT,
                    strike_price REAL,
                    expiry_date TEXT,
                    option_type TEXT,  -- 'call' or 'put'
                    transaction_type TEXT,  -- 'buy' or 'sell'
                    contract_multiplier INTEGER DEFAULT 100,
                    intrinsic_value REAL,
                    time_value REAL,
                    implied_volatility REAL,
                    FOREIGN KEY (position_id) REFERENCES positions(id) ON DELETE CASCADE
                )
            ''')
            
            # 创建交易记录表
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS transactions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    symbol TEXT NOT NULL,
                    name TEXT,
                    market TEXT,
                    type TEXT,
                    direction TEXT,  -- 'buy' or 'sell'
                    shares REAL,
                    price REAL,
                    currency TEXT DEFAULT 'CNY',
                    trade_date TEXT,
                    strategy TEXT,
                    notes TEXT,
                    source TEXT DEFAULT 'manual',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            ''')
            
            # 创建快照表
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS snapshots (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    date TEXT NOT NULL,
                    total_assets REAL,
                    cash REAL,
                    stock_value REAL,
                    etf_value REAL,
                    option_value REAL,
                    cash_equivalent_value REAL,
                    annual_return REAL,
                    position_ratio REAL,
                    goal_progress REAL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            ''')
            
            conn.commit()
            conn.close()
    
    def get_connection(self):
        """获取数据库连接"""
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row  # 返回字典格式
        return conn
    
    # ========== 持仓相关操作 ==========
    
    def get_positions(self):
        """获取所有持仓"""
        conn = self.get_connection()
        cursor = conn.cursor()
        
        # 获取所有持仓
        cursor.execute('''
            SELECT p.*, 
                   od.option_symbol, od.strike_price, od.expiry_date, 
                   od.option_type, od.transaction_type, od.contract_multiplier,
                   od.intrinsic_value, od.time_value, od.implied_volatility
            FROM positions p
            LEFT JOIN option_details od ON p.id = od.position_id
            ORDER BY p.type, p.symbol
        ''')
        
        rows = cursor.fetchall()
        positions = []
        
        for row in rows:
            position = dict(row)
            
            # 如果有期权详情，添加到 option_details 字段
            if position['option_symbol']:
                position['option_details'] = {
                    'option_symbol': position['option_symbol'],
                    'strike_price': position['strike_price'],
                    'expiry_date': position['expiry_date'],
                    'option_type': position['option_type'],
                    'transaction_type': position['transaction_type'],
                    'contract_multiplier': position['contract_multiplier'],
                    'intrinsic_value': position['intrinsic_value'],
                    'time_value': position['time_value'],
                    'implied_volatility': position['implied_volatility']
                }
            
            # 移除单独的期权字段
            for field in ['option_symbol', 'strike_price', 'expiry_date', 
                         'option_type', 'transaction_type', 'contract_multiplier',
                         'intrinsic_value', 'time_value', 'implied_volatility']:
                if field in position:
                    del position[field]
            
            positions.append(position)
        
        conn.close()
        return positions
    
    def get_option_positions(self):
        """获取期权持仓"""
        conn = self.get_connection()
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT p.*, 
                   od.option_symbol, od.strike_price, od.expiry_date, 
                   od.option_type, od.transaction_type, od.contract_multiplier,
                   od.intrinsic_value, od.time_value, od.implied_volatility
            FROM positions p
            JOIN option_details od ON p.id = od.position_id
            WHERE p.type = 'option'
            ORDER BY od.expiry_date, p.symbol
        ''')
        
        rows = cursor.fetchall()
        options = []
        
        for row in rows:
            option = dict(row)
            
            # 整理期权详情
            option['option_details'] = {
                'option_symbol': option['option_symbol'],
                'strike_price': option['strike_price'],
                'expiry_date': option['expiry_date'],
                'option_type': option['option_type'],
                'transaction_type': option['transaction_type'],
                'contract_multiplier': option['contract_multiplier'],
                'intrinsic_value': option['intrinsic_value'],
                'time_value': option['time_value'],
                'implied_volatility': option['implied_volatility']
            }
            
            # 移除单独的期权字段
            for field in ['option_symbol', 'strike_price', 'expiry_date', 
                         'option_type', 'transaction_type', 'contract_multiplier',
                         'intrinsic_value', 'time_value', 'implied_volatility']:
                if field in option:
                    del option[field]
            
            options.append(option)
        
        conn.close()
        return options
    
    # ========== 交易记录相关操作 ==========
    
    def get_transactions(self, limit=100, offset=0):
        """获取交易记录"""
        conn = self.get_connection()
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT * FROM transactions 
            ORDER BY trade_date DESC, created_at DESC 
            LIMIT ? OFFSET ?
        ''', (limit, offset))
        
        rows = cursor.fetchall()
        transactions = [dict(row) for row in rows]
        
        conn.close()
        return transactions
    
    def add_transaction(self, transaction_data):
        """添加交易记录"""
        conn = self.get_connection()
        cursor = conn.cursor()
        
        cursor.execute('''
            INSERT INTO transactions 
            (symbol, name, market, type, direction, shares, price, currency, trade_date, strategy, notes, source)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            transaction_data.get('symbol'),
            transaction_data.get('name'),
            transaction_data.get('market'),
            transaction_data.get('type'),
            transaction_data.get('direction'),
            transaction_data.get('shares'),
            transaction_data.get('price'),
            transaction_data.get('currency', 'CNY'),
            transaction_data.get('trade_date'),
            transaction_data.get('strategy'),
            transaction_data.get('notes'),
            transaction_data.get('source', 'manual')
        ))
        
        conn.commit()
        conn.close()
        return True
    
    # ========== 快照相关操作 ==========
    
    def get_snapshots(self, snapshot_type=None, limit=30):
        """获取快照列表"""
        conn = self.get_connection()
        cursor = conn.cursor()
        
        if snapshot_type:
            # 如果有类型筛选（实际可能不需要）
            cursor.execute('''
                SELECT * FROM snapshots 
                ORDER BY date DESC 
                LIMIT ?
            ''', (limit,))
        else:
            cursor.execute('''
                SELECT * FROM snapshots 
                ORDER BY date DESC 
                LIMIT ?
            ''', (limit,))
        
        rows = cursor.fetchall()
        snapshots = [dict(row) for row in rows]
        
        conn.close()
        return snapshots
    
    def add_snapshot(self, snapshot_data):
        """添加快照"""
        conn = self.get_connection()
        cursor = conn.cursor()
        
        cursor.execute('''
            INSERT INTO snapshots 
            (date, total_assets, cash, stock_value, etf_value, option_value, 
             cash_equivalent_value, annual_return, position_ratio, goal_progress)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            snapshot_data.get('date'),
            snapshot_data.get('total_assets'),
            snapshot_data.get('cash'),
            snapshot_data.get('stock_value'),
            snapshot_data.get('etf_value'),
            snapshot_data.get('option_value'),
            snapshot_data.get('cash_equivalent_value'),
            snapshot_data.get('annual_return'),
            snapshot_data.get('position_ratio'),
            snapshot_data.get('goal_progress')
        ))
        
        conn.commit()
        conn.close()
        return True
    
    # ========== 现金相关操作 ==========
    
    def get_cash(self):
        """获取现金信息"""
        conn = self.get_connection()
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT SUM(shares * cost_price) as total_cash
            FROM positions 
            WHERE type = 'cash_equivalent'
        ''')
        
        row = cursor.fetchone()
        cash = dict(row) if row else {'total_cash': 0}
        
        conn.close()
        return cash
    
    def update_cash(self, cash_data):
        """更新现金信息（占位方法）"""
        # 实际实现中可能需要更新现金等价物的持仓
        return True

# 全局数据库实例
db = PortfolioDB()