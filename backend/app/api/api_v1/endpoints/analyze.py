from fastapi import APIRouter, File, UploadFile, Form, HTTPException, BackgroundTasks, Query, Body, Depends
from fastapi.responses import JSONResponse
import uuid
import os
import time
from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session

from app.core.config import UPLOAD_FOLDER
from app.worker.tasks import process_image_task
from app.models.analyze import AnalyzeRequest, AnalyzeResponse
from app.services.zhipuai_service import zhipuai_service
from app.db.database import get_db
from app.services.user_service import MessageService, ChatService
from app.api.api_v1.endpoints.users import get_current_user
from app.db.models import User

router = APIRouter()

@router.post("/image", response_model=AnalyzeResponse)
@router.post("/image/", response_model=AnalyzeResponse)
async def analyze_image(
    file: UploadFile = File(...),
    prompt: str = Form(...),
    task_type: str = Form("description"),
    model: str = Form("glm-4.5v"),
    chat_id: Optional[str] = Form(None),
    background_tasks: BackgroundTasks = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    上传并分析遥感图像
    
    - **file**: 要分析的遥感图像文件
    - **prompt**: 分析提示或问题
    - **task_type**: 分析任务类型 (可选: description, detection, segmentation)
    - **model**: 使用的模型 (默认: glm-4.5v)
    """
    # 检查chat_id是否有效
    if chat_id:
        chat = ChatService.get_chat_by_id(db, chat_id)
        if not chat or chat.user_id != current_user.id:
            raise HTTPException(
                status_code=404,
                detail="聊天会话不存在或不属于当前用户"
            )
    else:
        # 如果没有提供chat_id，创建一个新的聊天
        chat = ChatService.create_chat(db, current_user.id, f"关于{prompt[:20]}的分析")
        chat_id = chat.id
    
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
    
    # 将用户消息保存到数据库
    MessageService.create_message(
        db=db,
        chat_id=chat_id,
        text=prompt,
        sender="user"
    )
    
    # 记录系统消息（图片上传）
    MessageService.create_message(
        db=db,
        chat_id=chat_id,
        text="已上传图像",
        sender="system",
        image_path=f"/api/uploads/{image_filename}"  # 图片的访问URL
    )
    
    # 记录处理中消息
    MessageService.create_message(
        db=db,
        chat_id=chat_id,
        text="正在分析图像，请稍候...",
        sender="system"
    )
    
    # 启动异步任务，传递chat_id参数
    process_image_task.delay(task_id, image_path, prompt, task_type, chat_id)
    
    return {
        "task_id": task_id,
        "chat_id": chat_id,
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
