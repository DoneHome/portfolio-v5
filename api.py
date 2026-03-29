#!/usr/bin/env python3
"""
Portfolio API Server
提供持仓数据的 REST API 接口
"""

from flask import Flask, jsonify, request
from flask_cors import CORS
from pathlib import Path
import sys

# 添加 data 目录到路径
sys.path.append(str(Path(__file__).parent / "data"))
from db import db

app = Flask(__name__)
CORS(app, origins=["http://localhost:8080"])  # 允许前端访问


# ========== 持仓接口 ==========

@app.route('/api/portfolio/positions', methods=['GET'])
def get_positions():
    """获取所有持仓"""
    positions = db.get_positions()
    return jsonify({
        "success": True,
        "data": positions,
        "count": len(positions)
    })


@app.route('/api/portfolio/positions', methods=['POST'])
def add_position():
    """添加持仓"""
    data = request.json
    result = db.add_position(
        symbol=data.get('symbol'),
        name=data.get('name'),
        market=data.get('market'),
        type_=data.get('type'),
        shares=data.get('shares'),
        cost_price=data.get('cost_price'),
        currency=data.get('currency'),
        sector=data.get('sector')
    )
    return jsonify({"success": result})


# ========== 交易记录接口 ==========

@app.route('/api/portfolio/transactions', methods=['GET'])
def get_transactions():
    """获取交易记录"""
    limit = request.args.get('limit', 100, type=int)
    transactions = db.get_transactions(limit)
    return jsonify({
        "success": True,
        "data": transactions,
        "count": len(transactions)
    })


@app.route('/api/portfolio/transactions', methods=['POST'])
def add_transaction():
    """添加交易记录"""
    data = request.json
    result = db.add_transaction(data)
    return jsonify({"success": result})


# ========== 快照接口 ==========

@app.route('/api/portfolio/snapshots', methods=['GET'])
def get_snapshots():
    """获取快照列表"""
    snapshot_type = request.args.get('type')  # daily/weekly/monthly/yearly
    limit = request.args.get('limit', 100, type=int)
    snapshots = db.get_snapshots(snapshot_type, limit)
    return jsonify({
        "success": True,
        "data": snapshots,
        "count": len(snapshots)
    })


@app.route('/api/portfolio/snapshots', methods=['POST'])
def create_snapshot():
    """创建快照"""
    data = request.json
    snapshot_id = db.create_snapshot(data)
    return jsonify({
        "success": True,
        "id": snapshot_id
    })


@app.route('/api/portfolio/snapshots/<int:snapshot_id>', methods=['GET'])
def get_snapshot_detail(snapshot_id):
    """获取快照详情"""
    snapshot = db.get_snapshot_by_id(snapshot_id)
    if snapshot:
        return jsonify({
            "success": True,
            "data": snapshot
        })
    return jsonify({
        "success": False,
        "error": "快照不存在"
    }), 404


# ========== 现金接口 ==========

@app.route('/api/portfolio/cash', methods=['GET'])
def get_cash():
    """获取现金数据"""
    cash = db.get_cash()
    return jsonify({
        "success": True,
        "data": cash
    })


@app.route('/api/portfolio/cash', methods=['PUT'])
def update_cash():
    """更新现金数据"""
    data = request.json
    result = db.update_cash(
        usd=data.get('usd'),
        hkd=data.get('hkd'),
        reserve=data.get('reserve'),
        investment=data.get('investment'),
        emergency=data.get('emergency')
    )
    return jsonify({"success": result})


# ========== 健康检查 ==========

@app.route('/api/health', methods=['GET'])
def health_check():
    """健康检查"""
    return jsonify({
        "status": "healthy",
        "service": "Portfolio API",
        "timestamp": datetime.now().isoformat()
    })


if __name__ == '__main__':
    from datetime import datetime
    print(f"启动 Portfolio API 服务...")
    print(f"数据库: {Path(__file__).parent / 'data' / 'portfolio.db'}")
    app.run(host='0.0.0.0', port=8006, debug=True)