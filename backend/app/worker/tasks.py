import base64
import time
import json
import os
import logging
from PIL import Image
import asyncio

from app.worker.celery_app import celery_app
from app.core.config import ZHIPUAI_API_KEY, UPLOAD_FOLDER
from app.services.zhipuai_service import zhipuai_service

logger = logging.getLogger(__name__)

@celery_app.task(name="process_image_task")
def process_image_task(task_id, image_path, prompt, task_type):
    """
    处理图像分析任务的Celery任务
    
    Args:
        task_id: 任务ID
        image_path: 图像路径
        prompt: 分析提示
        task_type: 任务类型 (例如: "description", "detection", "segmentation")
        
    Returns:
        任务结果字典
    """
    logger.info(f"开始处理任务 {task_id}, 任务类型: {task_type}")
    
    # 导入Redis客户端
    from redis import Redis
    from app.core.config import REDIS_HOST, REDIS_PORT, REDIS_DB
    import json
    
    # 创建Redis客户端
    redis_client = Redis(host=REDIS_HOST, port=REDIS_PORT, db=REDIS_DB)
    
    # 标记任务正在处理
    redis_client.setex(f"task_processing:{task_id}", 3600, "1")
    
    try:
        # 图像预处理
        with open(image_path, "rb") as image_file:
            # 将图像转换为Base64
            image_base64 = base64.b64encode(image_file.read()).decode('utf-8')
        
        # 创建事件循环调用异步方法
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        result = loop.run_until_complete(
            zhipuai_service.analyze_image(image_base64=image_base64, prompt=prompt, task_type=task_type)
        )
        loop.close()
        
        # 处理和格式化结果
        if hasattr(result, "content"):
            content = result.content
        elif isinstance(result, dict) and "error" in result:
            content = result
        else:
            content = str(result)
            
        formatted_result = {
            "task_id": task_id,
            "status": "completed",
            "result": content,
            "completed_at": time.time(),
        }
        
        # 如果有thinking内容，也返回
        if hasattr(result, "thinking"):
            formatted_result["thinking"] = result.thinking
        
        # 将结果存入Redis
        redis_client.setex(
            f"task_result:{task_id}", 
            86400,  # 结果保留24小时
            json.dumps(formatted_result)
        )
        
        # 删除处理中标记
        redis_client.delete(f"task_processing:{task_id}")
        
        logger.info(f"任务 {task_id} 完成并保存到Redis")
        return formatted_result
        
    except Exception as e:
        error_result = {
            "task_id": task_id,
            "status": "failed",
            "error": str(e),
            "completed_at": time.time(),
        }
        
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
