#!/usr/bin/env python3
"""
Portfolio API Server (轻量级版本)
使用 http.server + SQLite，无需 Flask
"""

import json
import sqlite3
import sys
import re
from datetime import datetime
from http.server import HTTPServer, BaseHTTPRequestHandler
from pathlib import Path
from urllib.parse import parse_qs, urlparse

# 添加 data 目录到路径
sys.path.append(str(Path(__file__).parent / "data"))
from db import db
from options_service import options_service


class PortfolioHandler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        """简化日志输出"""
        pass
    
    def _send_json(self, data, status=200):
        """发送 JSON 响应"""
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
        self.wfile.write(json.dumps(data, ensure_ascii=False).encode())
    
    def do_OPTIONS(self):
        """处理 CORS 预检请求"""
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
    
    def do_GET(self):
        """处理 GET 请求"""
        parsed = urlparse(self.path)
        path = parsed.path
        
        # 持仓列表
        if path == '/api/portfolio/positions':
            positions = db.get_positions()
            self._send_json({
                "success": True,
                "data": positions,
                "count": len(positions)
            })
        
        # 交易记录
        elif path == '/api/portfolio/transactions':
            query = parse_qs(parsed.query)
            limit = int(query.get('limit', [100])[0])
            transactions = db.get_transactions(limit)
            self._send_json({
                "success": True,
                "data": transactions,
                "count": len(transactions)
            })
        
        # 快照列表
        elif path == '/api/portfolio/snapshots':
            query = parse_qs(parsed.query)
            snapshot_type = query.get('type', [None])[0]
            limit = int(query.get('limit', [100])[0])
            snapshots = db.get_snapshots(snapshot_type, limit)
            self._send_json({
                "success": True,
                "data": snapshots,
                "count": len(snapshots)
            })
        
        # 现金数据
        elif path == '/api/portfolio/cash':
            cash = db.get_cash()
            self._send_json({
                "success": True,
                "data": cash
            })
        
        # ========== 期权API接口 ==========
        
        # 期权持仓详情
        elif path == '/api/portfolio/options/position-details':
            options = db.get_option_positions()
            self._send_json({
                "success": True,
                "data": options,
                "count": len(options)
            })
        
        # 期权代码解析
        elif path == '/api/portfolio/options/parse-symbol':
            query = parse_qs(parsed.query)
            option_symbol = query.get('symbol', [''])[0]
            
            if not option_symbol:
                self._send_json({
                    "success": False,
                    "error": "缺少期权代码参数"
                }, 400)
                return
            
            # 使用期权服务解析代码
            parsed_info = options_service.parse_option_symbol(option_symbol)
            self._send_json({
                "success": True,
                "data": parsed_info
            })
        
        # 批量查询期权权利金
        elif path == '/api/portfolio/options/batch-quotes':
            query = parse_qs(parsed.query)
            symbols_param = query.get('symbols', [''])[0]
            
            if not symbols_param:
                self._send_json({
                    "success": False,
                    "error": "缺少期权代码参数"
                }, 400)
                return
            
            symbols = [s.strip() for s in symbols_param.split(',') if s.strip()]
            
            # 使用期权服务获取真实数据
            quotes = options_service.get_batch_option_premiums(symbols)
            
            self._send_json({
                "success": True,
                "data": quotes
            })
        
        # 健康检查
        elif path == '/api/health':
            self._send_json({
                "status": "healthy",
                "service": "Portfolio API",
                "timestamp": datetime.now().isoformat()
            })
        
        else:
            self._send_json({"error": "Not found"}, 404)
    

    
    def do_POST(self):
        """处理 POST 请求"""
        parsed = urlparse(self.path)
        path = parsed.path
        
        # 读取请求体
        content_length = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(content_length).decode()
        data = json.loads(body) if body else {}
        
        # 创建快照
        if path == '/api/portfolio/snapshots':
            snapshot_id = db.create_snapshot(data)
            self._send_json({
                "success": True,
                "id": snapshot_id
            })
        
        # 添加交易记录
        elif path == '/api/portfolio/transactions':
            result = db.add_transaction(data)
            self._send_json({"success": result})
        
        else:
            self._send_json({"error": "Not found"}, 404)


def run_server(port=8005):
    """启动服务器"""
    server = HTTPServer(('0.0.0.0', port), PortfolioHandler)
    print(f"Portfolio API 服务启动: http://localhost:{port}")
    print(f"数据库: {Path(__file__).parent / 'data' / 'portfolio.db'}")
    server.serve_forever()


if __name__ == '__main__':
    run_server()