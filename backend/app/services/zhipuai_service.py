import logging
from zai import ZhipuAiClient
from app.core.config import ZHIPUAI_API_KEY

logger = logging.getLogger(__name__)

class ZhipuAiService:
    def __init__(self, api_key=None):
        """
        初始化智谱AI服务客户端
        
        Args:
            api_key: API密钥，如果为None则使用配置文件中的密钥
        """
        self.api_key = api_key or ZHIPUAI_API_KEY
        self.client = ZhipuAiClient(api_key=self.api_key)
        
    async def analyze_image(self, image_base64=None, image_url=None, prompt=None, task_type=None, model="glm-4.5v"):
        """
        调用智谱AI GLM-4.5v API分析图像
        
        Args:
            image_base64: Base64编码的图像（与image_url二选一）
            image_url: 图像URL（与image_base64二选一）
            prompt: 分析提示或问题
            task_type: 任务类型，用于构建系统提示
            model: 使用的模型，默认为"glm-4.5v"
            
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
        
        # 准备消息内容
        content = []
        
        # 添加图像
        if image_url:
            content.append({
                "type": "image_url",
                "image_url": {
                    "url": image_url
                }
            })
        elif image_base64:
            content.append({
                "type": "image_url",
                "image_url": {
                    "url": f"data:image/jpeg;base64,{image_base64}"
                }
            })
        
        # 添加文本提示
        content.append({
            "type": "text",
            "text": prompt
        })
        
        # 构建完整消息
        messages = [
            {
                "role": "system",
                "content": system_prompt
            },
            {
                "role": "user",
                "content": content
            }
        ]
        
        try:
            logger.info(f"发送请求到智谱AI {model} API")
            
            # 调用API
            response = self.client.chat.completions.create(
                model=model,
                messages=messages,
                thinking={"type": "enabled"}
            )
            
            logger.info("成功接收到API响应")
            return response.choices[0].message
            
        except Exception as e:
            logger.error(f"调用智谱AI API时出错: {str(e)}")
            return {"error": f"API调用错误: {str(e)}"}

# 创建全局服务实例，方便直接导入使用
zhipuai_service = ZhipuAiService()

# 为了保持向后兼容性，提供与旧版相同的函数接口
async def analyze_image(image_base64, prompt, task_type):
    """
    调用智谱AI GLM-4.5v API分析图像（兼容旧版接口）
    """
    result = await zhipuai_service.analyze_image(image_base64=image_base64, prompt=prompt, task_type=task_type)
    
    # 将新SDK的返回结果格式化为旧版格式
    if hasattr(result, "content"):
        return result.content
    else:
        return result
