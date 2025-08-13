import base64
import io
import logging
import os
from PIL import Image
import numpy as np
from typing import Union, Tuple, Optional

logger = logging.getLogger(__name__)

def resize_image(image: Image.Image, max_size: Tuple[int, int] = (1024, 1024)) -> Image.Image:
    """
    调整图像大小，确保不超过最大尺寸
    
    Args:
        image: PIL图像对象
        max_size: 最大尺寸(宽, 高)
        
    Returns:
        调整大小后的PIL图像对象
    """
    width, height = image.size
    max_width, max_height = max_size
    
    if width <= max_width and height <= max_height:
        return image
    
    # 计算缩放比例
    scale = min(max_width / width, max_height / height)
    new_width = int(width * scale)
    new_height = int(height * scale)
    
    # 调整大小
    return image.resize((new_width, new_height), Image.LANCZOS)


def convert_to_rgb(image: Image.Image) -> Image.Image:
    """
    将图像转换为RGB模式
    
    Args:
        image: PIL图像对象
        
    Returns:
        RGB模式的PIL图像对象
    """
    if image.mode in ("RGBA", "LA"):
        background = Image.new("RGB", image.size, (255, 255, 255))
        background.paste(image, mask=image.split()[3])  # 3 is the alpha channel
        return background
    elif image.mode != "RGB":
        return image.convert("RGB")
    return image


def image_to_base64(image: Union[str, Image.Image]) -> str:
    """
    将图像转换为Base64编码
    
    Args:
        image: 图像文件路径或PIL图像对象
        
    Returns:
        Base64编码的图像字符串
    """
    if isinstance(image, str):
        with open(image, "rb") as img_file:
            return base64.b64encode(img_file.read()).decode('utf-8')
    else:
        buffered = io.BytesIO()
        image.save(buffered, format="JPEG")
        return base64.b64encode(buffered.getvalue()).decode('utf-8')


def preprocess_image(image_path: str, max_size: Tuple[int, int] = (1024, 1024)) -> Optional[str]:
    """
    预处理图像（调整大小，转换为RGB，转换为Base64）
    
    Args:
        image_path: 图像文件路径
        max_size: 最大尺寸(宽, 高)
        
    Returns:
        Base64编码的图像字符串，如果处理失败则返回None
    """
    try:
        image = Image.open(image_path)
        image = convert_to_rgb(image)
        image = resize_image(image, max_size)
        return image_to_base64(image)
    except Exception as e:
        logger.error(f"预处理图像时出错: {str(e)}")
        return None
