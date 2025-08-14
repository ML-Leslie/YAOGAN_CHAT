from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os

from app.core.config import API_PREFIX, CORS_ORIGINS, UPLOAD_FOLDER
from app.api.api_v1.api import api_router

# 创建FastAPI应用
app = FastAPI(
    title="遥感图像分析API",
    description="一个基于GLM-4.5v的遥感图像分析服务",
    version="0.1.0",
    # 设置为False可以同时支持带斜杠和不带斜杠的路径
    redirect_slashes=False
)

# 添加CORS中间件
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 允许所有源，在生产环境中应该限制为特定域名
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 包括API路由
app.include_router(api_router, prefix=API_PREFIX)

# 创建上传文件夹
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# 挂载静态文件服务，用于访问上传的图像
app.mount(f"{API_PREFIX}/uploads", StaticFiles(directory=UPLOAD_FOLDER), name="uploads")

@app.get("/")
async def root():
    return {"message": "欢迎使用遥感图像分析API"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
