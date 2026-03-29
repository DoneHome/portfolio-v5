#!/usr/bin/env python3
"""
Portfolio API Server (轻量级版本)
使用 http.server + SQLite，无需 Flask
"""

import json
import sqlite3
import sys
from http.server import HTTPServer, BaseHTTPRequestHandler
from pathlib import Path
from urllib.parse import parse_qs, urlparse

# 添加 data 目录到路径
sys.path.append(str(Path(__file__).parent / "data"))
from db import db


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
        
        # 健康检查
        elif path == '/api/health':
            from datetime import datetime
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


def run_server(port=8006):
    """启动服务器"""
    server = HTTPServer(('0.0.0.0', port), PortfolioHandler)
    print(f"Portfolio API 服务启动: http://localhost:{port}")
    print(f"数据库: {Path(__file__).parent / 'data' / 'portfolio.db'}")
    server.serve_forever()


if __name__ == '__main__':
    run_server()