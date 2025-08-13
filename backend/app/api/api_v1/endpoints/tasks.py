from fastapi import APIRouter, HTTPException, Depends
from redis import Redis
import json
from typing import Dict, Any, Optional

from app.core.config import REDIS_HOST, REDIS_PORT, REDIS_DB

router = APIRouter()

def get_redis_client():
    """获取Redis客户端连接"""
    redis = Redis(host=REDIS_HOST, port=REDIS_PORT, db=REDIS_DB)
    try:
        yield redis
    finally:
        redis.close()

@router.get("/{task_id}")
async def get_task_status(task_id: str, redis: Redis = Depends(get_redis_client)) -> Dict[str, Any]:
    """
    获取任务状态和结果
    
    - **task_id**: 任务ID，由提交分析请求时返回
    """
    # 从Redis获取任务结果
    task_key = f"task_result:{task_id}"
    task_result = redis.get(task_key)
    
    if not task_result:
        # 检查任务是否正在进行中
        if redis.exists(f"task_processing:{task_id}"):
            return {
                "task_id": task_id,
                "status": "processing",
                "message": "分析正在进行中"
            }
        else:
            raise HTTPException(status_code=404, detail=f"未找到任务 ID: {task_id}")
    
    try:
        result = json.loads(task_result)
        return result
    except json.JSONDecodeError:
        raise HTTPException(status_code=500, detail="解析任务结果时出错")
