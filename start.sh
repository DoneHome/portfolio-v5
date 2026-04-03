#!/bin/bash
# portfolio-v5 启动脚本
# 启动前端服务，固定端口 3000

cd "$(dirname "$0")"

echo "🚀 启动 portfolio-v5 前端服务..."
echo "📍 访问地址: http://localhost:3000"
echo "🛑 按 Ctrl+C 停止服务"
echo ""

python3 -m http.server 3000
