from fastapi import APIRouter, Body, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Dict, Any, Optional
import asyncio

from app.db.database import get_db
from app.services.user_service import MessageService, ChatService
from app.api.api_v1.endpoints.users import get_current_user
from app.db.models import User
from app.services.zhipuai_service import zhipuai_service

router = APIRouter()

@router.post("/text", response_model=Dict[str, Any])
async def process_text_message(
    data: Dict[str, Any] = Body(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    处理文本消息，使用已有图像上下文
    
    请求体:
    ```
    {
        "prompt": "分析这张图像中的...",
        "chat_id": "聊天ID",
    }
    ```
    """
    prompt = data.get("prompt")
    chat_id = data.get("chat_id")
    
    if not prompt:
        raise HTTPException(status_code=400, detail="缺少必要参数: prompt")
    if not chat_id:
        raise HTTPException(status_code=400, detail="缺少必要参数: chat_id")
    
    # 检查chat_id是否有效
    chat = ChatService.get_chat_by_id(db, chat_id)
    if not chat or chat.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="聊天会话不存在或不属于当前用户")
    
    # 将用户消息保存到数据库
    MessageService.create_message(
        db=db,
        chat_id=chat_id,
        text=prompt,
        sender="user"
    )
    
    # 获取对话历史作为上下文
    messages = MessageService.get_chat_messages(db, chat_id)
    
    # 查找最近的图片消息
    image_messages = [msg for msg in messages if msg.image_path and msg.sender == "system"]
    last_image_message = image_messages[-1] if image_messages else None
    
    if not last_image_message:
        # 如果没有找到图片消息，返回错误
        error_message = MessageService.create_message(
            db=db,
            chat_id=chat_id,
            text="请先上传遥感图像以进行分析",
            sender="ai",
            error=True
        )
        return {
            "status": "error",
            "message": "请先上传遥感图像以进行分析"
        }
    
    # 处理中消息
    processing_message = MessageService.create_message(
        db=db,
        chat_id=chat_id,
        text="正在分析，请稍候...",
        sender="system"
    )
    
    # 构建上下文消息
    context_messages = []
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
    
    try:
        # 从图像路径获取图像
        image_path = last_image_message.image_path
        if image_path.startswith('/api/uploads/'):
            image_path = image_path.replace('/api/uploads/', '')
        
        import os
        from app.core.config import UPLOAD_FOLDER
        import base64
        
        full_image_path = os.path.join(UPLOAD_FOLDER, image_path)
        
        # 读取图像并转换为Base64
        with open(full_image_path, "rb") as image_file:
            image_base64 = base64.b64encode(image_file.read()).decode('utf-8')
        
        # 调用智谱AI分析图像
        loop = asyncio.get_event_loop()
        result = await zhipuai_service.analyze_image(
            image_base64=image_base64,
            prompt=prompt,
            task_type="description",
            context_messages=context_messages
        )
        
        if hasattr(result, "content"):
            content = result.content
            thinking = getattr(result, "thinking", None)
        else:
            content = str(result)
            thinking = None
            
        # 删除处理中消息
        db.delete(processing_message)
        db.commit()
        
        # 添加AI回复
        ai_message = MessageService.create_message(
            db=db,
            chat_id=chat_id,
            text=content,
            sender="ai",
            thinking=thinking
        )
        
        return {
            "status": "success",
            "message": "文本处理成功",
            "result": content,
            "thinking": thinking
        }
        
    except Exception as e:
        # 删除处理中消息
        db.delete(processing_message)
        db.commit()
        
        # 添加错误消息
        error_message = MessageService.create_message(
            db=db,
            chat_id=chat_id,
            text=f"处理出错: {str(e)}",
            sender="ai",
            error=True
        )
        
        raise HTTPException(status_code=500, detail=f"处理文本消息时出错: {str(e)}")
