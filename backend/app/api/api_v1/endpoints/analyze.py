from fastapi import APIRouter, File, UploadFile, Form, HTTPException, BackgroundTasks, Query, Body
from fastapi.responses import JSONResponse
import uuid
import os
import time
from typing import Optional, List, Dict, Any

from app.core.config import UPLOAD_FOLDER
from app.worker.tasks import process_image_task
from app.models.analyze import AnalyzeRequest, AnalyzeResponse
from app.services.zhipuai_service import zhipuai_service

router = APIRouter()

@router.post("/image", response_model=AnalyzeResponse)
@router.post("/image/", response_model=AnalyzeResponse)
async def analyze_image(
    file: UploadFile = File(...),
    prompt: str = Form(...),
    task_type: str = Form("description"),
    model: str = Form("glm-4.5v"),
    background_tasks: BackgroundTasks = None
):
    """
    上传并分析遥感图像
    
    - **file**: 要分析的遥感图像文件
    - **prompt**: 分析提示或问题
    - **task_type**: 分析任务类型 (可选: description, detection, segmentation)
    - **model**: 使用的模型 (默认: glm-4.5v)
    """
    # 生成唯一任务ID
    task_id = str(uuid.uuid4())
    
    # 验证文件类型
    content_type = file.content_type
    if not content_type or not content_type.startswith("image/"):
        raise HTTPException(
            status_code=400,
            detail="仅支持图像文件"
        )
    
    # 保存上传的文件
    file_extension = os.path.splitext(file.filename)[1] if file.filename else ".jpg"
    image_filename = f"{task_id}{file_extension}"
    image_path = os.path.join(UPLOAD_FOLDER, image_filename)
    
    try:
        contents = await file.read()
        with open(image_path, "wb") as f:
            f.write(contents)
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"保存文件时出错: {str(e)}"
        )
    
    # 启动异步任务
    process_image_task.delay(task_id, image_path, prompt, task_type)
    
    return {
        "task_id": task_id,
        "status": "processing",
        "message": "图像已成功上传，分析正在进行中"
    }

@router.post("/image/url", response_model=AnalyzeResponse)
async def analyze_image_url(
    data: Dict[str, Any] = Body(...),
):
    """
    通过图像URL分析遥感图像
    
    请求体:
    ```
    {
      "image_url": "https://example.com/image.jpg",
      "prompt": "分析这张遥感图像",
      "task_type": "description",
      "model": "glm-4.5v"
    }
    ```
    """
    # 验证请求参数
    if "image_url" not in data:
        raise HTTPException(
            status_code=400,
            detail="缺少必要参数: image_url"
        )
    if "prompt" not in data:
        raise HTTPException(
            status_code=400,
            detail="缺少必要参数: prompt"
        )
    
    image_url = data["image_url"]
    prompt = data["prompt"]
    task_type = data.get("task_type", "description")
    model = data.get("model", "glm-4.5v")
    
    # 生成唯一任务ID
    task_id = str(uuid.uuid4())
    
    try:
        # 直接调用服务进行分析
        result = await zhipuai_service.analyze_image(
            image_url=image_url, 
            prompt=prompt, 
            task_type=task_type, 
            model=model
        )
        
        if hasattr(result, "content"):
            content = result.content
        elif isinstance(result, dict) and "error" in result:
            raise HTTPException(
                status_code=500,
                detail=f"分析图像时出错: {result['error']}"
            )
        else:
            content = str(result)
        
        return {
            "task_id": task_id,
            "status": "completed",
            "result": content,
            "completed_at": time.time()
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"分析图像URL时出错: {str(e)}"
        )
