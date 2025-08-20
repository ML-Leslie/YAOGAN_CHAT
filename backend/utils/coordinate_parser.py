"""
坐标解析工具模块
用于从AI响应中提取物体坐标信息
"""

import json
import re
import logging
from typing import Optional, Union, List, Dict, Any

logger = logging.getLogger(__name__)


class CoordinateParser:
    """坐标解析器"""
    
    @staticmethod
    def parse_coordinates(coordinates_data: Union[str, Dict, List]) -> Optional[str]:
        """
        解析坐标数据，返回标准化的JSON字符串
        
        Args:
            coordinates_data: 坐标数据，可以是字符串、字典或列表
            
        Returns:
            标准化的JSON坐标字符串，如果解析失败则返回None
        """
        if not coordinates_data:
            return None
            
        try:
            parsed_data = CoordinateParser._parse_data_structure(coordinates_data)
            if parsed_data:
                return json.dumps(parsed_data, ensure_ascii=False)
            return None
        except Exception as e:
            logger.error(f"解析坐标数据时出错: {e}")
            return None
    
    @staticmethod
    def _parse_data_structure(data: Union[str, Dict, List]) -> Optional[Union[Dict, List]]:
        """
        解析数据结构
        
        Args:
            data: 要解析的数据
            
        Returns:
            解析后的数据结构
        """
        if isinstance(data, str):
            return CoordinateParser._parse_string(data)
        elif isinstance(data, (dict, list)):
            return data
        else:
            logger.warning(f"不支持的数据类型: {type(data)}")
            return None
    
    @staticmethod
    def _parse_string(data_str: str) -> Optional[Union[Dict, List]]:
        """
        解析字符串格式的坐标数据
        
        Args:
            data_str: 字符串格式的坐标数据
            
        Returns:
            解析后的数据结构
        """
        try:
            # 尝试直接解析JSON
            return json.loads(data_str)
        except json.JSONDecodeError:
            # 如果直接解析失败，尝试提取JSON部分
            return CoordinateParser._extract_json_from_string(data_str)
    
    @staticmethod
    def _extract_json_from_string(text: str) -> Optional[Union[Dict, List]]:
        """
        从文本中提取JSON数据
        
        Args:
            text: 包含JSON的文本
            
        Returns:
            提取的JSON数据
        """
        # 尝试提取bbox格式的JSON
        bbox_pattern = r'\{"label":[^}]+,"bbox":\[[^\]]+\]\}'
        bbox_matches = re.findall(bbox_pattern, text)
        
        if bbox_matches:
            try:
                return json.loads(bbox_matches[0])
            except json.JSONDecodeError:
                pass
        
        # 尝试提取一般的JSON对象
        json_pattern = r'\{(?:[^{}]|(?:\{[^{}]*\}))*\}'
        json_matches = re.findall(json_pattern, text)
        
        # 尝试提取数组格式
        array_pattern = r'\[(?:[^\[\]]|\[[^\[\]]*\])*\]'
        array_matches = re.findall(array_pattern, text)
        
        # 优先处理JSON对象
        for match in json_matches:
            try:
                obj = json.loads(match)
                if CoordinateParser._is_valid_coordinate_object(obj):
                    return obj
            except json.JSONDecodeError:
                continue
        
        # 然后处理数组
        for match in array_matches:
            try:
                arr = json.loads(match)
                if CoordinateParser._is_valid_coordinate_array(arr):
                    return arr
            except json.JSONDecodeError:
                continue
        
        return None
    
    @staticmethod
    def _is_valid_coordinate_object(obj: Dict) -> bool:
        """
        检查是否为有效的坐标对象
        
        Args:
            obj: 要检查的对象
            
        Returns:
            是否为有效的坐标对象
        """
        if not isinstance(obj, dict):
            return False
            
        # 检查是否有bbox属性
        if 'bbox' in obj and isinstance(obj['bbox'], list) and len(obj['bbox']) >= 4:
            return True
        
        # 检查是否有x, y, width, height属性
        coordinate_keys = ['x', 'y']
        size_keys = ['width', 'height']
        
        has_coordinates = any(key in obj for key in coordinate_keys)
        has_size = any(key in obj for key in size_keys)
        
        if has_coordinates and has_size:
            return True
        
        # 检查是否有label属性（可能是坐标对象）
        if 'label' in obj:
            return True
        
        return False
    
    @staticmethod
    def _is_valid_coordinate_array(arr: List) -> bool:
        """
        检查是否为有效的坐标数组
        
        Args:
            arr: 要检查的数组
            
        Returns:
            是否为有效的坐标数组
        """
        if not isinstance(arr, list) or len(arr) < 4:
            return False
        
        # 检查是否为坐标数组 [x1, y1, x2, y2]
        if all(isinstance(item, (int, float)) for item in arr[:4]):
            return True
        
        # 检查是否为对象数组
        if all(isinstance(item, dict) for item in arr):
            return any(CoordinateParser._is_valid_coordinate_object(item) for item in arr)
        
        return False
    
    @staticmethod
    def extract_object_coordinates(content: str, task_type: str = "detection") -> Optional[str]:
        """
        从AI响应内容中提取物体坐标
        
        Args:
            content: AI响应内容
            task_type: 任务类型
            
        Returns:
            标准化的坐标JSON字符串
        """
        if task_type not in ["detection", "mark_object"]:
            return None
            
        try:
            # 首先尝试直接解析整个内容
            parsed_data = CoordinateParser.parse_coordinates(content)
            if parsed_data:
                return parsed_data
            
            # 如果直接解析失败，尝试其他方法
            logger.warning("无法直接解析坐标数据，尝试其他方法")
            return None
            
        except Exception as e:
            logger.error(f"提取物体坐标时出错: {e}")
            return None


# 便捷函数
def parse_coordinates(coordinates_data: Union[str, Dict, List]) -> Optional[str]:
    """便捷函数：解析坐标数据"""
    return CoordinateParser.parse_coordinates(coordinates_data)


def extract_object_coordinates(content: str, task_type: str = "detection") -> Optional[str]:
    """便捷函数：提取物体坐标"""
    return CoordinateParser.extract_object_coordinates(content, task_type)