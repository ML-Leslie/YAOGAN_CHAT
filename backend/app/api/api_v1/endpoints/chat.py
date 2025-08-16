from fastapi import APIRouter, Body, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Dict, Any, Optional
import asyncio
import uuid
import time
import json

from app.db.database import get_db
from app.services.user_service import MessageService, ChatService
from app.api.api_v1.endpoints.users import get_current_user
from app.db.models import User, Message
from app.services.zhipuai_service import zhipuai_service
from app.worker.tasks import process_text_task

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
      "chat_id": "聊天会话ID",
      "task_type": "description" // 可选，可以是"mark_object"表示标记物体
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
    task_type = data.get("task_type", "description")
    
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
        
        # 根据task_type设置不同的任务类型
        api_task_type = task_type
        if task_type == "mark_object":
            api_task_type = "detection"
        
        try:
            # 读取图像文件并转换为base64
            with open(local_image_path, "rb") as image_file:
                image_base64 = base64.b64encode(image_file.read()).decode('utf-8')
            
            # 使用base64调用API
            result = await zhipuai_service.analyze_image(
                image_base64=image_base64,
                prompt=prompt,
                task_type=api_task_type,
                context_messages=context_messages
            )
        except Exception as img_error:
            # 如果base64方式失败，回退到URL方式尝试
            image_url = f"http://localhost:8000{image_path.replace('/api', '')}"
            result = await zhipuai_service.analyze_image(
                image_url=image_url,
                prompt=prompt,
                task_type=api_task_type,
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
        
        # 提取对象坐标（如果是标记物体任务）
        object_coordinates = None
        if task_type == "mark_object":
            try:
                # 尝试从结果中提取坐标信息
                import re
                import json
                
                # 首先尝试提取整个回复作为JSON
                try:
                    full_json = json.loads(content)
                    # 检查是否是有效的坐标格式
                    if isinstance(full_json, dict) and ('bbox' in full_json or 
                            ('x' in full_json and 'y' in full_json and 'width' in full_json and 'height' in full_json)):
                        object_coordinates = content
                    elif isinstance(full_json, list) and len(full_json) > 0:
                        # 如果是列表，检查第一个元素是否有效
                        if isinstance(full_json[0], dict) and ('bbox' in full_json[0] or 
                                ('x' in full_json[0] and 'y' in full_json[0] and 'width' in full_json[0] and 'height' in full_json[0])):
                            object_coordinates = content
                        # 检查是否是坐标数组 [x1,y1,x2,y2]
                        elif len(full_json) >= 4 and all(isinstance(item, (int, float)) for item in full_json[:4]):
                            object_coordinates = content
                except:
                    # 不是有效JSON，尝试提取JSON部分
                    
                    # 提取JSON格式的坐标信息，优先查找包含bbox或坐标的JSON
                    bbox_json_pattern = r'\{"label":[^}]+,"bbox":\[[^\]]+\]\}'
                    bbox_matches = re.findall(bbox_json_pattern, content)
                    
                    if bbox_matches:
                        # 找到了bbox格式的JSON
                        object_coordinates = bbox_matches[0]
                    else:
                        # 尝试查找一般的JSON对象
                        json_pattern = r'\{(?:[^{}]|(?:\{[^{}]*\}))*\}'
                        json_matches = re.findall(json_pattern, content)
                        
                        # 也尝试寻找方括号格式的数组
                        array_pattern = r'\[(?:[^\[\]]|\[[^\[\]]*\])*\]'
                        array_matches = re.findall(array_pattern, content)
                        
                        if json_matches:
                            for match in json_matches:
                                try:
                                    obj = json.loads(match)
                                    if isinstance(obj, dict) and ('bbox' in obj or 
                                        ('x' in obj and 'y' in obj and 'width' in obj and 'height' in obj) or
                                        'label' in obj):
                                        object_coordinates = match
                                        break
                                except:
                                    pass
                                    
                        if not object_coordinates and array_matches:
                            for match in array_matches:
                                try:
                                    arr = json.loads(match)
                                    if isinstance(arr, list):
                                        if len(arr) >= 4 and all(isinstance(item, (int, float)) for item in arr[:4]):
                                            # 可能是坐标数组 [x1,y1,x2,y2]
                                            object_coordinates = match
                                            break
                                        elif len(arr) > 0 and isinstance(arr[0], dict):
                                            # 检查是否是对象列表
                                            if ('bbox' in arr[0] or 
                                                ('x' in arr[0] and 'y' in arr[0] and 'width' in arr[0] and 'height' in arr[0])):
                                                object_coordinates = match
                                                break
                                except:
                                    pass
                
                # 如果还是没找到，但是知道这是标记物体任务，创建一个默认坐标
                if not object_coordinates:
                    print(f"无法从内容中提取坐标信息: {content}")
                    # 不创建默认坐标，让前端处理
            except Exception as e:
                print(f"提取坐标信息时出错: {e}")
        
        # 添加AI回复
        MessageService.create_message(
            db=db,
            chat_id=chat_id,
            text=content,
            sender="ai",
            thinking=result.thinking if hasattr(result, "thinking") else None,
            object_coordinates=object_coordinates,
            is_object_mark=(task_type == "mark_object")
        )
        
        db.commit()
        
        return {
            "status": "success",
            "result": content,
            "thinking": result.thinking if hasattr(result, "thinking") else None,
            "object_coordinates": object_coordinates,
            "is_object_mark": (task_type == "mark_object")
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


@router.post("/text-async")
async def process_text_message_async(
    data: Dict[str, Any] = Body(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    异步处理文本消息，支持取消功能
    
    请求体:
    ```
    {
      "prompt": "问题文本",
      "chat_id": "聊天会话ID",
      "task_type": "description" // 可选，可以是"mark_object"表示标记物体
    }
    ```
    
    返回:
    ```
    {
      "task_id": "任务ID",
      "status": "submitted",
      "message": "任务已提交"
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
    task_type = data.get("task_type", "description")
    
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
    
    # 生成任务ID
    task_id = str(uuid.uuid4())
    
    # 使用Redis存储任务信息
    from redis import Redis
    from app.core.config import REDIS_HOST, REDIS_PORT, REDIS_DB
    
    redis_client = Redis(host=REDIS_HOST, port=REDIS_PORT, db=REDIS_DB)
    
    # 存储任务基本信息
    task_info = {
        "task_id": task_id,
        "chat_id": chat_id,
        "prompt": prompt,
        "task_type": task_type,
        "user_id": current_user.id,
        "status": "submitted",
        "submitted_at": time.time()
    }
    
    redis_client.setex(
        f"task_result:{task_id}",
        86400,  # 24小时过期
        json.dumps(task_info)
    )
    
    # 提交异步任务
    try:
        process_text_task.delay(task_id, prompt, chat_id, task_type)
        
        return {
            "task_id": task_id,
            "status": "submitted", 
            "message": "文本处理任务已提交"
        }
        
    except Exception as e:
        # 如果提交任务失败，删除Redis中的任务信息
        redis_client.delete(f"task_result:{task_id}")
        raise HTTPException(
            status_code=500,
            detail=f"提交任务失败: {str(e)}"
        )
