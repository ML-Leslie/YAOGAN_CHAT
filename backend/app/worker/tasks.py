import base64
import time
import json
import os
import logging
from PIL import Image
import asyncio
from sqlalchemy.orm import Session
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.worker.celery_app import celery_app
from app.core.config import ZHIPUAI_API_KEY, UPLOAD_FOLDER, DATABASE_URL
from app.services.zhipuai_service import zhipuai_service
from app.services.user_service import MessageService, ChatService
from app.db.models import Message, Chat

logger = logging.getLogger(__name__)

# 创建数据库引擎和会话工厂
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_db():
    db = SessionLocal()
    try:
        return db
    finally:
        db.close()

@celery_app.task(name="process_image_task")
def process_image_task(task_id, image_path, prompt, task_type, chat_id=None):
    """
    处理图像分析任务的Celery任务
    
    Args:
        task_id: 任务ID
        image_path: 图像路径
        prompt: 分析提示
        task_type: 任务类型 (例如: "description", "detection", "segmentation")
        chat_id: 聊天会话ID
        
    Returns:
        任务结果字典
    """
    logger.info(f"开始处理任务 {task_id}, 任务类型: {task_type}, 聊天ID: {chat_id}")
    
    # 导入Redis客户端
    from redis import Redis
    from app.core.config import REDIS_HOST, REDIS_PORT, REDIS_DB
    
    # 创建Redis客户端
    redis_client = Redis(host=REDIS_HOST, port=REDIS_PORT, db=REDIS_DB)
    
    # 标记任务正在处理
    redis_client.setex(f"task_processing:{task_id}", 3600, "1")
    
    try:
        # 图像预处理
        with open(image_path, "rb") as image_file:
            # 将图像转换为Base64
            image_base64 = base64.b64encode(image_file.read()).decode('utf-8')
        
        # 如果有chat_id，从数据库中获取对话历史
        context_messages = []
        if chat_id:
            db = get_db()
            # 获取前10条消息作为上下文
            messages = db.query(Message).filter(Message.chat_id == chat_id).order_by(Message.timestamp.desc()).limit(10).all()
            
            # 将消息按时间顺序排序
            messages = sorted(messages, key=lambda x: x.timestamp)
            
            # 构建上下文
            for msg in messages:
                if msg.sender == "user":
                    context_messages.append({
                        "role": "user", 
                        "content": msg.text
                    })
                elif msg.sender == "ai":
                    context_messages.append({
                        "role": "assistant", 
                        "content": msg.text
                    })
            
            db.close()
        
        # 创建事件循环调用异步方法
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        result = loop.run_until_complete(
            zhipuai_service.analyze_image(
                image_base64=image_base64, 
                prompt=prompt, 
                task_type=task_type, 
                context_messages=context_messages if context_messages else None
            )
        )
        loop.close()
        
        # 处理和格式化结果
        if hasattr(result, "content"):
            # 结果已经在zhipuai_service中清理过特殊标记
            content = result.content
        elif isinstance(result, dict) and "error" in result:
            content = result
        else:
            content = str(result)
            
        formatted_result = {
            "task_id": task_id,
            "chat_id": chat_id,
            "status": "completed",
            "result": content,
            "completed_at": time.time(),
        }
        
        # 如果有thinking内容，也返回
        if hasattr(result, "thinking"):
            formatted_result["thinking"] = result.thinking
        
        # 如果有chat_id，将结果保存到数据库
        if chat_id:
            db = get_db()
            try:
                # 删除"正在分析"的系统消息
                processing_msgs = db.query(Message).filter(
                    Message.chat_id == chat_id,
                    Message.sender == "system",
                    Message.text.like("正在分析%")
                ).all()
                for msg in processing_msgs:
                    db.delete(msg)
                
                # 添加AI回复消息
                MessageService.create_message(
                    db=db,
                    chat_id=chat_id,
                    text=content,
                    sender="ai",
                    thinking=formatted_result.get("thinking")
                )
                
                db.commit()
            except Exception as e:
                logger.error(f"保存消息到数据库时出错: {str(e)}")
                db.rollback()
            finally:
                db.close()
        
        # 将结果存入Redis
        redis_client.setex(
            f"task_result:{task_id}", 
            86400,  # 结果保留24小时
            json.dumps(formatted_result)
        )
        
        # 删除处理中标记
        redis_client.delete(f"task_processing:{task_id}")
        
        logger.info(f"任务 {task_id} 完成并保存到Redis和数据库")
        return formatted_result
        
    except Exception as e:
        error_result = {
            "task_id": task_id,
            "chat_id": chat_id,
            "status": "failed",
            "error": str(e),
            "completed_at": time.time(),
        }
        
        # 如果有chat_id，将错误信息保存到数据库
        if chat_id:
            db = get_db()
            try:
                # 删除"正在分析"的系统消息
                processing_msgs = db.query(Message).filter(
                    Message.chat_id == chat_id,
                    Message.sender == "system",
                    Message.text.like("正在分析%")
                ).all()
                for msg in processing_msgs:
                    db.delete(msg)
                
                # 添加错误消息
                MessageService.create_message(
                    db=db,
                    chat_id=chat_id,
                    text=f"分析出错: {str(e)}",
                    sender="ai",
                    error=True
                )
                
                db.commit()
            except Exception as db_error:
                logger.error(f"保存错误消息到数据库时出错: {str(db_error)}")
                db.rollback()
            finally:
                db.close()
        
        # 将错误结果存入Redis
        redis_client.setex(
            f"task_result:{task_id}", 
            86400,  # 结果保留24小时
            json.dumps(error_result)
        )
        
        # 删除处理中标记
        redis_client.delete(f"task_processing:{task_id}")
        
        logger.error(f"处理任务 {task_id} 时出错: {str(e)}")
        return error_result
