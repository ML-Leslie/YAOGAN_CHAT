from fastapi import APIRouter, HTTPException, Depends
from redis import Redis
import json
from typing import Dict, Any
import logging

from app.core.config import REDIS_HOST, REDIS_PORT, REDIS_DB
from app.api.api_v1.endpoints.users import get_current_user
from app.db.models import User

router = APIRouter()
logger = logging.getLogger(__name__)

def get_redis_client():
    """获取Redis客户端连接"""
    redis = Redis(host=REDIS_HOST, port=REDIS_PORT, db=REDIS_DB)
    try:
        yield redis
    finally:
        redis.close()

@router.post("/{task_id}")
@router.post("/{task_id}/")
async def cancel_task(
    task_id: str, 
    redis: Redis = Depends(get_redis_client),
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    取消正在处理中的任务
    
    - **task_id**: 任务ID，由提交分析请求时返回
    """
    # 检查任务是否存在且正在处理中
    if not redis.exists(f"task_processing:{task_id}"):
        # 任务可能已经完成或者不存在
        return {
            "task_id": task_id,
            "status": "not_processing",
            "message": "任务不在处理中或已完成"
        }
    
    try:
        # 设置取消标志
        redis.setex(f"task_cancel:{task_id}", 3600, "1")
        
        logger.info(f"用户 {current_user.username} 已请求取消任务 {task_id}")
        
        import time
        from app.db.database import get_db
        from app.services.user_service import MessageService
        from sqlalchemy.orm import Session
        from fastapi import Depends
        
        # 创建取消任务结果
        canceled_result = {
            "task_id": task_id,
            "status": "canceled",
            "result": "用户已取消任务",
            "canceled_at": time.time()
        }
        
        # 获取任务数据，包括聊天ID
        task_data_raw = redis.get(f"task_result:{task_id}")
        if task_data_raw:
            try:
                task_data = json.loads(task_data_raw)
                chat_id = task_data.get("chat_id")
                
                # 如果有chat_id，添加取消消息
                if chat_id:
                    # 获取数据库会话
                    db = next(get_db())
                    try:
                        # 删除"正在分析"的系统消息
                        processing_msgs = db.query(MessageService.Message).filter(
                            MessageService.Message.chat_id == chat_id,
                            MessageService.Message.sender == "system",
                            MessageService.Message.text.like("正在分析%")
                        ).all()
                        for msg in processing_msgs:
                            db.delete(msg)
                        
                        # 添加取消消息
                        MessageService.create_message(
                            db=db,
                            chat_id=chat_id,
                            text="用户已取消生成",
                            sender="system"
                        )
                        
                        db.commit()
                    except Exception as e:
                        logger.error(f"保存取消消息到数据库时出错: {str(e)}")
                        db.rollback()
                    finally:
                        db.close()
            except Exception as e:
                logger.error(f"处理任务数据时出错: {str(e)}")
        
        # 将取消结果存入Redis
        redis.setex(
            f"task_result:{task_id}", 
            86400,  # 结果保留24小时
            json.dumps(canceled_result)
        )
        
        return {
            "task_id": task_id,
            "status": "canceling",
            "message": "正在取消任务"
        }
    except Exception as e:
        logger.error(f"取消任务时出错: {str(e)}")
        raise HTTPException(status_code=500, detail=f"取消任务时出错: {str(e)}")
