#!/bin/bash

echo "==================================="
echo "启动遥感图像分析后端服务"
echo "==================================="

# 检查是否已安装所需的Python包
pip install -r requirements.txt
if [ $? -ne 0 ]; then
    echo "安装依赖包失败，请检查错误信息"
    exit 1
fi

# 创建上传文件夹（如果不存在）
mkdir -p uploads

# 启动Redis服务
echo "启动Redis服务..."
redis-server --daemonize yes
sleep 2

# 启动FastAPI服务器
echo "正在启动FastAPI服务器..."
uvicorn main:app --reload --host 0.0.0.0 --port 8000 &
FASTAPI_PID=$!

# 等待FastAPI启动
sleep 3

# 启动Celery Worker
echo "正在启动Celery Worker..."
celery -A app.worker.celery_app worker --loglevel=info &
CELERY_PID=$!

echo "==================================="
echo "服务已启动："
echo "- FastAPI: http://localhost:8000"
echo "- API文档: http://localhost:8000/docs"
echo "==================================="

# 等待用户按Ctrl+C
trap "kill $FASTAPI_PID $CELERY_PID; exit" SIGINT
wait
