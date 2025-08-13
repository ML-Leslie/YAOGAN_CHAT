from fastapi import APIRouter
from app.api.api_v1.endpoints import analyze, tasks, health

api_router = APIRouter()
api_router.include_router(analyze.router, prefix="/analyze", tags=["analyze"])
api_router.include_router(tasks.router, prefix="/tasks", tags=["tasks"])
api_router.include_router(health.router, prefix="/health", tags=["health"])
