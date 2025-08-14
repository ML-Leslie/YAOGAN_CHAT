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
    
    # 添加处理中消息
    processing_message = MessageService.create_message(
        db=db,
        chat_id=chat_id,
        text="正在处理您的问题，请稍候...",
        sender="system"
    )
    
    try:
        # 调用智谱AI分析
        # 这里我们传递图像URL而不是base64，因为我们已经有了之前上传的图像
        result = await zhipuai_service.analyze_image(
            image_url=f"http://localhost:8000{image_path.replace('/api', '')}",
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
        
        # 添加错误消息
        MessageService.create_message(
            db=db,
            chat_id=chat_id,
            text=f"处理消息时出错: {str(e)}",
            sender="ai",
            error=True
        )
        
        db.commit()
        
        return {
            "status": "error",
            "message": str(e)
        }
