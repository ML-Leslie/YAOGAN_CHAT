import base64
import time
import json
import os
import logging
from PIL import Image
import httpx

from app.worker.celery_app import celery_app
from app.core.config import ZHIPUAI_API_KEY, UPLOAD_FOLDER
from app.services.zhipuai_service import analyze_image

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
    
    try:
        # 图像预处理
        with open(image_path, "rb") as image_file:
            # 将图像转换为Base64
            image_base64 = base64.b64encode(image_file.read()).decode('utf-8')
        
        # 调用智谱AI GLM-4.5v API进行分析
        result = analyze_image(image_base64, prompt, task_type)
        
        # 处理和格式化结果
        formatted_result = {
            "task_id": task_id,
            "status": "completed",
            "result": result,
            "completed_at": time.time(),
        }
        
        logger.info(f"任务 {task_id} 完成")
        return formatted_result
        
    except Exception as e:
        logger.error(f"处理任务 {task_id} 时出错: {str(e)}")
        return {
            "task_id": task_id,
            "status": "failed",
            "error": str(e),
            "completed_at": time.time(),
        }
