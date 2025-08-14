from fastapi import APIRouter, Body, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Dict, Any, Optional
import asyncio

from app.db.database import get_db
from app.services.user_service import MessageService, ChatService
from app.api.api_v1.endpoints.users import get_current_user
from app.db.models import User, Message
from app.services.zhipuai_service import zhipuai_service

router = APIRouter()

@router.post("/text")
async def process_text_message(
    data: Dict[str, Any] = Body(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    处理文本消息，支持上下文对话
    
    请求体:
    ```
    {
      "prompt": "问题文本",
      "chat_id": "聊天会话ID"
    }
    ```
    """
    # 验证请求参数
    if "prompt" not in data:
        raise HTTPException(
            status_code=400,
            detail="缺少必要参数: prompt"
        )
    if "chat_id" not in data:
        raise HTTPException(
            status_code=400,
            detail="缺少必要参数: chat_id"
        )
    
    prompt = data["prompt"]
    chat_id = data["chat_id"]
    
    # 验证chat_id是否有效
    chat = ChatService.get_chat_by_id(db, chat_id)
    if not chat or chat.user_id != current_user.id:
        raise HTTPException(
            status_code=404,
            detail="聊天会话不存在或不属于当前用户"
        )
    
    # 存储用户消息
    MessageService.create_message(
        db=db,
        chat_id=chat_id,
        text=prompt,
        sender="user"
    )
    
    # 构建上下文，获取最近10条消息
    messages = db.query(Message).filter(Message.chat_id == chat_id).order_by(Message.timestamp.desc()).limit(10).all()
    messages = sorted(messages, key=lambda x: x.timestamp)
    
    context_messages = []
    # 查找是否有图片消息
    has_image = False
    image_path = None
    
    for msg in messages:
        if msg.sender == "system" and msg.image_path:
            has_image = True
            image_path = msg.image_path
        
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
    
    if not has_image:
        # 没有图片，返回错误
        MessageService.create_message(
            db=db,
            chat_id=chat_id,
            text="请先上传遥感图像以便我进行分析",
            sender="ai"
        )
        
        return {
            "status": "error",
            "message": "聊天中没有上传的图像"
        }
        
    # 验证图像文件是否存在
    import os
    from app.core.config import UPLOAD_FOLDER
    
    # 从路径中提取文件名
    image_filename = os.path.basename(image_path.replace("/api/uploads/", ""))
    local_image_path = os.path.join(UPLOAD_FOLDER, image_filename)
    
    if not os.path.isfile(local_image_path):
        # 图像文件不存在，返回错误
        error_msg = "历史图像文件已不可访问，请重新上传图像"
        MessageService.create_message(
            db=db,
            chat_id=chat_id,
            text=error_msg,
            sender="ai",
            error=True
        )
        
        return {
            "status": "error",
            "message": error_msg
        }
    
    # 添加处理中消息
    processing_message = MessageService.create_message(
        db=db,
        chat_id=chat_id,
        text="正在处理您的问题，请稍候...",
        sender="system"
    )
    
    try:
        # 尝试使用base64编码图像而不是URL，这样可以更好地控制图像格式
        import base64
        
        try:
            # 读取图像文件并转换为base64
            with open(local_image_path, "rb") as image_file:
                image_base64 = base64.b64encode(image_file.read()).decode('utf-8')
            
            # 使用base64调用API
            result = await zhipuai_service.analyze_image(
                image_base64=image_base64,
                prompt=prompt,
                context_messages=context_messages
            )
        except Exception as img_error:
            # 如果base64方式失败，回退到URL方式尝试
            image_url = f"http://localhost:8000{image_path.replace('/api', '')}"
            result = await zhipuai_service.analyze_image(
                image_url=image_url,
                prompt=prompt,
                context_messages=context_messages
            )
        
        # 处理结果
        if hasattr(result, "content"):
            # 结果应该已经被zhipuai_service中的_clean_special_tags处理过
            content = result.content
        else:
            content = str(result)
            
        # 删除处理中消息
        db.delete(processing_message)
        
        # 再次确认内容已经被清理（以防漏网之鱼）
        if content and hasattr(zhipuai_service, "_clean_special_tags"):
            content = zhipuai_service._clean_special_tags(content)
            
        # 添加AI回复
        MessageService.create_message(
            db=db,
            chat_id=chat_id,
            text=content,
            sender="ai",
            thinking=result.thinking if hasattr(result, "thinking") else None
        )
        
        db.commit()
        
        return {
            "status": "success",
            "result": content,
            "thinking": result.thinking if hasattr(result, "thinking") else None
        }
        
    except Exception as e:
        # 删除处理中消息
        db.delete(processing_message)
        
        error_message = str(e)
        # 针对特定错误类型给出更友好的提示
        if "图片输入格式/解析错误" in error_message:
            user_friendly_message = "历史图像可能已过期或格式不兼容，请重新上传图像"
        else:
            user_friendly_message = f"处理消息时出错: {error_message}"
        
        # 添加错误消息
        MessageService.create_message(
            db=db,
            chat_id=chat_id,
            text=user_friendly_message,
            sender="ai",
            error=True
        )
        
        db.commit()
        
        return {
            "status": "error",
            "message": user_friendly_message,
            "original_error": error_message
        }
