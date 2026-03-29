#!/usr/bin/env python3
"""
Portfolio Database Manager
管理持仓数据的 SQLite 数据库
"""

import sqlite3
import json
from datetime import datetime
from pathlib import Path

DB_PATH = Path(__file__).parent / "portfolio.db"
INIT_SQL_PATH = Path(__file__).parent / "init.sql"


class PortfolioDB:
    def __init__(self):
        self.db_path = DB_PATH
        self.init_db()
    
    def get_connection(self):
        """获取数据库连接"""
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn
    
    def init_db(self):
        """初始化数据库"""
        if not self.db_path.exists():
            print(f"创建数据库: {self.db_path}")
        
        conn = self.get_connection()
        cursor = conn.cursor()
        
        # 执行初始化 SQL
        if INIT_SQL_PATH.exists():
            with open(INIT_SQL_PATH, 'r', encoding='utf-8') as f:
                sql = f.read()
                cursor.executescript(sql)
            conn.commit()
            print("数据库初始化完成")
        
        conn.close()
    
    # ========== 持仓管理 ==========
    
    def get_positions(self):
        """获取所有持仓"""
        conn = self.get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM positions ORDER BY updated_at DESC")
        rows = cursor.fetchall()
        conn.close()
        return [dict(row) for row in rows]
    
    def add_position(self, symbol, name, market, type_, shares, cost_price, currency, sector=None):
        """添加持仓"""
        conn = self.get_connection()
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO positions (symbol, name, market, type, shares, cost_price, currency, sector)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (symbol, name, market, type_, shares, cost_price, currency, sector))
        conn.commit()
        conn.close()
        return True
    
    def update_position(self, symbol, shares, cost_price):
        """更新持仓（加仓/减仓）"""
        conn = self.get_connection()
        cursor = conn.cursor()
        cursor.execute("""
            UPDATE positions 
            SET shares = ?, cost_price = ?, updated_at = CURRENT_TIMESTAMP
            WHERE symbol = ?
        """, (shares, cost_price, symbol))
        conn.commit()
        conn.close()
        return True
    
    def delete_position(self, symbol):
        """删除持仓"""
        conn = self.get_connection()
        cursor = conn.cursor()
        cursor.execute("DELETE FROM positions WHERE symbol = ?", (symbol,))
        conn.commit()
        conn.close()
        return True
    
    # ========== 交易记录 ==========
    
    def add_transaction(self, transaction_data):
        """添加交易记录"""
        conn = self.get_connection()
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO transactions 
            (symbol, name, direction, quantity, price, currency, trade_date, 
             strategy, emotion, take_profit, stop_loss, reason, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            transaction_data.get('symbol'),
            transaction_data.get('name'),
            transaction_data.get('direction'),
            transaction_data.get('quantity'),
            transaction_data.get('price'),
            transaction_data.get('currency'),
            transaction_data.get('trade_date'),
            transaction_data.get('strategy'),
            transaction_data.get('emotion'),
            transaction_data.get('take_profit'),
            transaction_data.get('stop_loss'),
            transaction_data.get('reason'),
            transaction_data.get('notes')
        ))
        conn.commit()
        conn.close()
        return True
    
    def get_transactions(self, limit=100):
        """获取交易记录"""
        conn = self.get_connection()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT * FROM transactions 
            ORDER BY trade_date DESC, created_at DESC
            LIMIT ?
        """, (limit,))
        rows = cursor.fetchall()
        conn.close()
        return [dict(row) for row in rows]
    
    # ========== 快照管理 ==========
    
    def create_snapshot(self, snapshot_data):
        """创建持仓快照"""
        conn = self.get_connection()
        cursor = conn.cursor()
        
        now = datetime.now()
        
        # 插入快照主表
        cursor.execute("""
            INSERT INTO snapshots 
            (snapshot_type, date, time, total_assets, stock_value, etf_value, 
             cash_equivalent_value, cash_value, total_pnl, total_pnl_percent,
             position_ratio, goal_progress, initial_assets, three_year_goal, market_context)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            snapshot_data.get('snapshot_type', 'daily'),
            now.strftime('%Y/%m/%d'),
            now.strftime('%H:%M:%S'),
            snapshot_data.get('total_assets', 0),
            snapshot_data.get('stock_value', 0),
            snapshot_data.get('etf_value', 0),
            snapshot_data.get('cash_equivalent_value', 0),
            snapshot_data.get('cash_value', 0),
            snapshot_data.get('total_pnl', 0),
            snapshot_data.get('total_pnl_percent', 0),
            snapshot_data.get('position_ratio', 0),
            snapshot_data.get('goal_progress', 0),
            snapshot_data.get('initial_assets'),
            snapshot_data.get('three_year_goal', 5000000),
            json.dumps(snapshot_data.get('market_context', {}))
        ))
        
        snapshot_id = cursor.lastrowid
        
        # 插入持仓明细
        holdings = snapshot_data.get('holdings', [])
        for holding in holdings:
            cursor.execute("""
                INSERT INTO snapshot_holdings 
                (snapshot_id, symbol, name, type, shares, cost_price, current_price,
                 market_value_cny, pnl_percent, currency)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                snapshot_id,
                holding.get('symbol'),
                holding.get('name'),
                holding.get('type'),
                holding.get('shares'),
                holding.get('cost_price'),
                holding.get('current_price'),
                holding.get('market_value_cny'),
                holding.get('pnl_percent'),
                holding.get('currency')
            ))
        
        conn.commit()
        conn.close()
        return snapshot_id
    
    def get_snapshots(self, snapshot_type=None, limit=100):
        """获取快照列表"""
        conn = self.get_connection()
        cursor = conn.cursor()
        
        if snapshot_type:
            cursor.execute("""
                SELECT * FROM snapshots 
                WHERE snapshot_type = ?
                ORDER BY timestamp DESC
                LIMIT ?
            """, (snapshot_type, limit))
        else:
            cursor.execute("""
                SELECT * FROM snapshots 
                ORDER BY timestamp DESC
                LIMIT ?
            """, (limit,))
        
        rows = cursor.fetchall()
        conn.close()
        return [dict(row) for row in rows]
    
    def get_snapshot_by_id(self, snapshot_id):
        """获取单个快照详情"""
        conn = self.get_connection()
        cursor = conn.cursor()
        
        cursor.execute("SELECT * FROM snapshots WHERE id = ?", (snapshot_id,))
        snapshot = cursor.fetchone()
        
        if snapshot:
            cursor.execute("""
                SELECT * FROM snapshot_holdings WHERE snapshot_id = ?
            """, (snapshot_id,))
            holdings = cursor.fetchall()
            conn.close()
            
            result = dict(snapshot)
            result['holdings'] = [dict(h) for h in holdings]
            return result
        
        conn.close()
        return None
    
    def delete_snapshot(self, snapshot_id):
        """删除快照"""
        conn = self.get_connection()
        cursor = conn.cursor()
        cursor.execute("DELETE FROM snapshots WHERE id = ?", (snapshot_id,))
        conn.commit()
        conn.close()
        return True
    
    # ========== 现金管理 ==========
    
    def get_cash(self):
        """获取现金数据"""
        conn = self.get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM cash_management WHERE id = 1")
        row = cursor.fetchone()
        conn.close()
        return dict(row) if row else None
    
    def update_cash(self, usd=None, hkd=None, reserve=None, investment=None, emergency=None):
        """更新现金数据"""
        conn = self.get_connection()
        cursor = conn.cursor()
        
        updates = []
        params = []
        if usd is not None:
            updates.append("usd_balance = ?")
            params.append(usd)
        if hkd is not None:
            updates.append("hkd_balance = ?")
            params.append(hkd)
        if reserve is not None:
            updates.append("reserve_amount = ?")
            params.append(reserve)
        if investment is not None:
            updates.append("investment_amount = ?")
            params.append(investment)
        if emergency is not None:
            updates.append("emergency_amount = ?")
            params.append(emergency)
        
        if updates:
            sql = f"UPDATE cash_management SET {', '.join(updates)}, updated_at = CURRENT_TIMESTAMP WHERE id = 1"
            cursor.execute(sql, params)
            conn.commit()
        
        conn.close()
        return True


# 全局数据库实例
db = PortfolioDB()

if __name__ == '__main__':
    # 测试数据库连接
    print("测试数据库连接...")
    positions = db.get_positions()
    print(f"持仓数量: {len(positions)}")
    for p in positions[:3]:
        print(f"  - {p['symbol']}: {p['name']} ({p['shares']}股)")
    print("数据库连接正常！")