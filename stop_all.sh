#!/bin/bash

echo "🛑 正在停止所有服务..."
echo ""

# 1. 停止Django后端 (端口 8000)
echo "📋 停止Django后端..."
BACKEND_PIDS=$(lsof -ti tcp:8000 2>/dev/null)
if [ -n "$BACKEND_PIDS" ]; then
    echo "   端口 8000: $BACKEND_PIDS"
    kill -9 $BACKEND_PIDS 2>/dev/null
    echo "   ✅ 已终止"
else
    echo "   ℹ️  未发现运行中的后端进程"
fi

# 也尝试按进程名终止
pkill -9 -f "manage.py runserver" 2>/dev/null && echo "   ✅ 按进程名终止成功" || true

echo ""

# 2. 停止前端服务器 (端口 8080)
echo "🌐 停止前端服务器..."
for PORT in 8080; do
    PIDS=$(lsof -ti tcp:$PORT 2>/dev/null)
    if [ -n "$PIDS" ]; then
        echo "   端口 $PORT: $PIDS"
        kill -9 $PIDS 2>/dev/null
        echo "   ✅ 已终止"
    fi
done

# 按进程名终止
pkill -9 -f "http.server" 2>/dev/null && echo "   ✅ 按进程名终止成功" || true

echo ""

# 3. 停止Celery
echo "⚙️  停止Celery进程..."
pkill -9 -f "celery.*worker" 2>/dev/null && echo "   ✅ Worker已终止" || echo "   ℹ️  未发现Celery worker"
pkill -9 -f "celery.*beat" 2>/dev/null && echo "   ✅ Beat已终止" || echo "   ℹ️  未发现Celery beat"

echo ""
echo "✅ 所有服务已停止！"
echo ""
echo "💡 提示: 使用以下命令重新启动："
echo "   后端: ./start_backend.sh"
echo "   前端: ./start_frontend.sh"
