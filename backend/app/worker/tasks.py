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
from app.utils.image_utils import preprocess_image

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
        
        # 检查任务是否已被取消
        if redis_client.exists(f"task_cancel:{task_id}"):
            logger.info(f"任务 {task_id} 已被用户取消，终止处理")
            # 删除取消标记
            redis_client.delete(f"task_cancel:{task_id}")
            return {
                "task_id": task_id,
                "chat_id": chat_id,
                "status": "canceled",
                "result": "用户已取消任务",
                "completed_at": time.time()
            }
        
        # 创建事件循环调用异步方法
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        result = loop.run_until_complete(
            zhipuai_service.analyze_image(
                image_base64=image_base64, 
                prompt=prompt, 
                task_type=task_type, 
                context_messages=context_messages if context_messages else None,
                task_id=task_id,  # 传递task_id用于检查取消
                redis_client=redis_client  # 传递Redis客户端
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
        
        # 提取对象坐标（如果是detection任务）
        object_coordinates = None
        is_object_mark = task_type == "detection"
        
        if is_object_mark:
            try:
                # 尝试从结果中提取坐标信息
                import re
                
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
                
                # 如果还是没找到，但是知道这是标记物体任务，使用内容作为坐标
                if not object_coordinates and is_object_mark:
                    logger.warning(f"无法从内容中提取坐标信息: {content}")
                    # 使用整个内容作为坐标
                    object_coordinates = content
            except Exception as e:
                logger.error(f"提取坐标信息时出错: {e}")
        
        formatted_result = {
            "task_id": task_id,
            "chat_id": chat_id,
            "status": "completed",
            "result": content,
            "completed_at": time.time(),
            "is_object_mark": is_object_mark,
            "object_coordinates": object_coordinates
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
                
                # 添加AI回复消息，包含标记和坐标信息
                MessageService.create_message(
                    db=db,
                    chat_id=chat_id,
                    text=content,
                    sender="ai",
                    thinking=formatted_result.get("thinking"),
                    is_object_mark=formatted_result.get("is_object_mark", False),
                    object_coordinates=formatted_result.get("object_coordinates")
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
        
        # 删除处理中标记和取消标记（如果有）
        redis_client.delete(f"task_processing:{task_id}")
        redis_client.delete(f"task_cancel:{task_id}")
        
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
        
        # 删除处理中标记和取消标记（如果有）
        redis_client.delete(f"task_processing:{task_id}")
        redis_client.delete(f"task_cancel:{task_id}")
        
        logger.error(f"处理任务 {task_id} 时出错: {str(e)}")
        return error_result


@celery_app.task(name="process_text_task")
def process_text_task(task_id, prompt, chat_id, task_type="description"):
    """
    处理文本消息的Celery任务（基于已有图像上下文）
    
    Args:
        task_id: 任务ID
        prompt: 用户提问
        chat_id: 聊天会话ID
        task_type: 任务类型 (例如: "description", "mark_object")
        
    Returns:
        任务结果字典
    """
    logger.info(f"开始处理文本任务 {task_id}, 任务类型: {task_type}, 聊天ID: {chat_id}")
    
    # 导入Redis客户端
    from redis import Redis
    from app.core.config import REDIS_HOST, REDIS_PORT, REDIS_DB
    
    redis_client = Redis(host=REDIS_HOST, port=REDIS_PORT, db=REDIS_DB)
    
    # 标记任务开始处理
    redis_client.setex(f"task_processing:{task_id}", 3600, "1")
    
    try:
        db = get_db()
        
        # 验证聊天会话
        chat = db.query(Chat).filter(Chat.id == chat_id).first()
        if not chat:
            raise Exception("聊天会话不存在")
        
        # 构建上下文，获取最近20条消息
        messages = db.query(Message).filter(Message.chat_id == chat_id).order_by(Message.timestamp.desc()).limit(20).all()
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
            raise Exception("聊天中没有上传的图像")
        
        # 验证图像文件是否存在
        image_filename = os.path.basename(image_path.replace("/api/uploads/", ""))
        local_image_path = os.path.join(UPLOAD_FOLDER, image_filename)
        
        if not os.path.isfile(local_image_path):
            raise Exception("历史图像文件已不可访问，请重新上传图像")
        
        # 检查任务是否已被取消
        if redis_client.exists(f"task_cancel:{task_id}"):
            logger.info(f"文本任务 {task_id} 已被用户取消，终止处理")
            # 删除取消标记
            redis_client.delete(f"task_cancel:{task_id}")
            return {
                "task_id": task_id,
                "chat_id": chat_id,
                "status": "canceled",
                "result": "用户已取消任务",
                "completed_at": time.time()
            }
        
        # 读取图像并转换为base64
        with open(local_image_path, "rb") as image_file:
            image_base64 = base64.b64encode(image_file.read()).decode('utf-8')
        
        # 根据task_type设置API任务类型
        api_task_type = task_type
        if task_type == "mark_object":
            api_task_type = "detection"
        
        # 创建事件循环调用异步方法
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        result = loop.run_until_complete(
            zhipuai_service.analyze_image(
                image_base64=image_base64, 
                prompt=prompt, 
                task_type=api_task_type, 
                context_messages=context_messages if context_messages else None,
                task_id=task_id,  # 传递task_id用于检查取消
                redis_client=redis_client  # 传递Redis客户端
            )
        )
        loop.close()
        
        # 处理和格式化结果
        if hasattr(result, "content"):
            content = result.content
        else:
            content = str(result)
            
        thinking = getattr(result, "thinking", None)
        
        # 提取对象坐标（如果是标记物体任务）
        object_coordinates = None
        if task_type == "mark_object":
            try:
                import re
                # 注意：不重新导入json，使用全局的json模块
                
                # 尝试从结果中提取坐标信息
                try:
                    full_json = json.loads(content)
                    if isinstance(full_json, dict) and ('bbox' in full_json or 
                            ('x' in full_json and 'y' in full_json and 'width' in full_json and 'height' in full_json)):
                        object_coordinates = content
                    elif isinstance(full_json, list) and len(full_json) > 0:
                        if isinstance(full_json[0], dict) and ('bbox' in full_json[0] or 
                                ('x' in full_json[0] and 'y' in full_json[0] and 'width' in full_json[0] and 'height' in full_json[0])):
                            object_coordinates = content
                        elif len(full_json) >= 4 and all(isinstance(item, (int, float)) for item in full_json[:4]):
                            object_coordinates = content
                except:
                    # 提取JSON格式的坐标信息
                    bbox_json_pattern = r'\{"label":[^}]+,"bbox":\[[^\]]+\]\}'
                    bbox_matches = re.findall(bbox_json_pattern, content)
                    
                    if bbox_matches:
                        object_coordinates = bbox_matches[0]
                    else:
                        json_pattern = r'\{(?:[^{}]|(?:\{[^{}]*\}))*\}'
                        json_matches = re.findall(json_pattern, content)
                        
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
                                            object_coordinates = match
                                            break
                                        elif len(arr) > 0 and isinstance(arr[0], dict):
                                            if ('bbox' in arr[0] or 
                                                ('x' in arr[0] and 'y' in arr[0] and 'width' in arr[0] and 'height' in arr[0])):
                                                object_coordinates = match
                                                break
                                except:
                                    pass
            except Exception as e:
                logger.warning(f"提取坐标信息时出错: {e}")
        
        # 保存到数据库
        try:
            # 添加AI回复
            MessageService.create_message(
                db=db,
                chat_id=chat_id,
                text=content,
                sender="ai",
                thinking=thinking,
                object_coordinates=object_coordinates,
                is_object_mark=(task_type == "mark_object")
            )
            
            db.commit()
        except Exception as db_error:
            logger.error(f"保存消息到数据库时出错: {str(db_error)}")
            db.rollback()
        finally:
            db.close()
        
        # 将成功结果存入Redis
        success_result = {
            "task_id": task_id,
            "chat_id": chat_id,
            "status": "completed",
            "result": content,
            "thinking": thinking,
            "object_coordinates": object_coordinates,
            "is_object_mark": (task_type == "mark_object"),
            "completed_at": time.time()
        }
        
        redis_client.setex(
            f"task_result:{task_id}", 
            86400,  # 结果保留24小时
            json.dumps(success_result)
        )
        
        # 删除处理中标记和取消标记（如果有）
        redis_client.delete(f"task_processing:{task_id}")
        redis_client.delete(f"task_cancel:{task_id}")
        
        logger.info(f"文本任务 {task_id} 处理完成")
        return success_result
        
    except Exception as e:
        # 错误处理
        error_result = {
            "task_id": task_id,
            "chat_id": chat_id,
            "status": "failed",
            "error": str(e),
            "completed_at": time.time()
        }
        
        # 保存错误消息到数据库
        if chat_id:
            try:
                db = get_db()
                
                # 针对特定错误类型给出更友好的提示
                if "图片输入格式/解析错误" in str(e):
                    user_friendly_message = "历史图像可能已过期或格式不兼容，请重新上传图像"
                elif "聊天中没有上传的图像" in str(e):
                    user_friendly_message = "请先上传遥感图像以便我进行分析"
                elif "历史图像文件已不可访问" in str(e):
                    user_friendly_message = "历史图像文件已不可访问，请重新上传图像"
                else:
                    user_friendly_message = f"处理出错: {str(e)}"
                
                MessageService.create_message(
                    db=db,
                    chat_id=chat_id,
                    text=user_friendly_message,
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
        
        # 删除处理中标记和取消标记（如果有）
        redis_client.delete(f"task_processing:{task_id}")
        redis_client.delete(f"task_cancel:{task_id}")
        
        logger.error(f"处理文本任务 {task_id} 时出错: {str(e)}")
        return error_result
