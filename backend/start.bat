@echo off
echo ===================================
echo 启动遥感图像分析后端服务
echo ===================================

rem 检查是否已安装所需的Python包
pip install -r requirements.txt
if %ERRORLEVEL% NEQ 0 (
    echo 安装依赖包失败，请检查错误信息
    exit /b %ERRORLEVEL%
)

rem 创建上传文件夹（如果不存在）
mkdir uploads 2>nul

rem 启动FastAPI服务器
start cmd /k "echo 正在启动FastAPI服务器... && uvicorn main:app --reload --host 0.0.0.0 --port 8000"

rem 等待FastAPI启动
timeout /t 3 > nul

rem 启动Celery Worker
start cmd /k "echo 正在启动Celery Worker... && celery -A app.worker.celery_app worker --loglevel=info"

echo ===================================
echo 服务已启动：
echo - FastAPI: http://localhost:8000
echo - API文档: http://localhost:8000/docs
echo ===================================

rem 打开API文档
start http://localhost:8000/docs
