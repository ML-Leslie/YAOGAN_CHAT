import httpx
import json
import logging
from app.core.config import ZHIPUAI_API_KEY

logger = logging.getLogger(__name__)

# 智谱AI GLM-4.5v API地址
API_URL = "https://open.bigmodel.cn/api/paas/v4/multi-modal/chat/completions"

async def analyze_image(image_base64, prompt, task_type):
    """
    调用智谱AI GLM-4.5v API分析图像
    
    Args:
        image_base64: Base64编码的图像
        prompt: 分析提示
        task_type: 任务类型
        
    Returns:
        API响应结果
    """
    # 根据任务类型构建不同的提示
    if task_type == "description":
        system_prompt = "你是一个专业的遥感图像分析AI助手。请详细描述这张遥感图像中的内容，包括地形、建筑、植被等特征。"
    elif task_type == "detection":
        system_prompt = "你是一个专业的遥感图像分析AI助手。请识别并定位这张遥感图像中的所有重要目标，返回目标名称和它们的边界框坐标（[x1, y1, x2, y2]格式）。"
    elif task_type == "segmentation":
        system_prompt = "你是一个专业的遥感图像分析AI助手。请对这张遥感图像进行语义分割，识别不同类型的地表覆盖物（如建筑、道路、植被、水体等）。"
    else:
        system_prompt = "你是一个专业的遥感图像分析AI助手。请分析这张遥感图像并回答问题。"
    
    # 准备API请求
    headers = {
        "Authorization": f"Bearer {ZHIPUAI_API_KEY}",
        "Content-Type": "application/json"
    }
    
    payload = {
        "model": "glm-4v",
        "messages": [
            {
                "role": "system",
                "content": system_prompt
            },
            {
                "role": "user",
                "content": [
                    {
                        "type": "text",
                        "text": prompt
                    },
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:image/jpeg;base64,{image_base64}"
                        }
                    }
                ]
            }
        ]
    }
    
    try:
        logger.info("发送请求到智谱AI GLM-4.5v API")
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(API_URL, json=payload, headers=headers)
            response.raise_for_status()
            
        result = response.json()
        logger.info("成功接收到API响应")
        
        # 解析并返回结果
        if "choices" in result and len(result["choices"]) > 0:
            content = result["choices"][0]["message"]["content"]
            return content
        else:
            logger.error(f"API响应格式不正确: {result}")
            return {"error": "API响应格式不正确"}
            
    except httpx.HTTPStatusError as e:
        logger.error(f"HTTP错误: {e.response.status_code} - {e.response.text}")
        return {"error": f"HTTP错误: {e.response.status_code}", "details": e.response.text}
    except httpx.RequestError as e:
        logger.error(f"请求错误: {str(e)}")
        return {"error": f"请求错误: {str(e)}"}
    except Exception as e:
        logger.error(f"调用API时出现未预期的错误: {str(e)}")
        return {"error": f"未预期的错误: {str(e)}"}
