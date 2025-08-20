"""
Redis客户端管理模块
提供统一的Redis连接管理功能
"""

import redis
import logging
from typing import Optional
from contextlib import contextmanager

from app.core.config import REDIS_HOST, REDIS_PORT, REDIS_DB

logger = logging.getLogger(__name__)


class RedisManager:
    """Redis连接管理器"""
    
    def __init__(self, host: str = REDIS_HOST, port: int = REDIS_PORT, db: int = REDIS_DB):
        self.host = host
        self.port = port
        self.db = db
        self._connection_pool = None
    
    @property
    def connection_pool(self):
        """获取连接池"""
        if self._connection_pool is None:
            self._connection_pool = redis.ConnectionPool(
                host=self.host,
                port=self.port,
                db=self.db,
                decode_responses=True,
                max_connections=20,
                retry_on_timeout=True
            )
        return self._connection_pool
    
    def get_client(self) -> redis.Redis:
        """获取Redis客户端"""
        return redis.Redis(
            connection_pool=self.connection_pool,
            health_check_interval=30
        )
    
    @contextmanager
    def get_connection(self):
        """获取Redis连接的上下文管理器"""
        client = self.get_client()
        try:
            yield client
        finally:
            # 连接会自动返回连接池
            pass
    
    def set_task_processing(self, task_id: str, expire_seconds: int = 3600) -> bool:
        """设置任务处理中标记"""
        try:
            with self.get_connection() as client:
                client.setex(f"task_processing:{task_id}", expire_seconds, "1")
                return True
        except Exception as e:
            logger.error(f"设置任务处理标记失败: {e}")
            return False
    
    def set_task_cancel(self, task_id: str, expire_seconds: int = 3600) -> bool:
        """设置任务取消标记"""
        try:
            with self.get_connection() as client:
                client.setex(f"task_cancel:{task_id}", expire_seconds, "1")
                return True
        except Exception as e:
            logger.error(f"设置任务取消标记失败: {e}")
            return False
    
    def is_task_cancelled(self, task_id: str) -> bool:
        """检查任务是否被取消"""
        try:
            with self.get_connection() as client:
                return client.exists(f"task_cancel:{task_id}") > 0
        except Exception as e:
            logger.error(f"检查任务取消状态失败: {e}")
            return False
    
    def is_task_processing(self, task_id: str) -> bool:
        """检查任务是否正在处理"""
        try:
            with self.get_connection() as client:
                return client.exists(f"task_processing:{task_id}") > 0
        except Exception as e:
            logger.error(f"检查任务处理状态失败: {e}")
            return False
    
    def set_task_result(self, task_id: str, result_data: dict, expire_seconds: int = 86400) -> bool:
        """设置任务结果"""
        try:
            import json
            with self.get_connection() as client:
                client.setex(
                    f"task_result:{task_id}", 
                    expire_seconds, 
                    json.dumps(result_data, ensure_ascii=False)
                )
                return True
        except Exception as e:
            logger.error(f"设置任务结果失败: {e}")
            return False
    
    def get_task_result(self, task_id: str) -> Optional[dict]:
        """获取任务结果"""
        try:
            import json
            with self.get_connection() as client:
                result = client.get(f"task_result:{task_id}")
                if result:
                    return json.loads(result)
                return None
        except Exception as e:
            logger.error(f"获取任务结果失败: {e}")
            return None
    
    def delete_task_keys(self, task_id: str) -> bool:
        """删除任务相关的所有键"""
        try:
            with self.get_connection() as client:
                keys_to_delete = [
                    f"task_processing:{task_id}",
                    f"task_cancel:{task_id}",
                    f"task_result:{task_id}"
                ]
                client.delete(*keys_to_delete)
                return True
        except Exception as e:
            logger.error(f"删除任务键失败: {e}")
            return False
    
    def cleanup_expired_tasks(self) -> int:
        """清理过期的任务键"""
        try:
            with self.get_connection() as client:
                # 获取所有相关键
                processing_keys = client.keys("task_processing:*")
                cancel_keys = client.keys("task_cancel:*")
                result_keys = client.keys("task_result:*")
                
                all_keys = processing_keys + cancel_keys + result_keys
                
                if all_keys:
                    # 检查每个键的TTL，删除已过期的
                    deleted_count = 0
                    for key in all_keys:
                        ttl = client.ttl(key)
                        if ttl == -2:  # 键不存在
                            continue
                        elif ttl == -1:  # 键存在但没有过期时间
                            # 对于没有过期时间的键，设置一个较短的过期时间
                            client.expire(key, 3600)
                            deleted_count += 1
                        # ttl > 0 表示键还有效，不删除
                    
                    return deleted_count
                return 0
        except Exception as e:
            logger.error(f"清理过期任务失败: {e}")
            return 0


# 创建全局Redis管理器实例
redis_manager = RedisManager()


# 便捷函数
def get_redis_client() -> redis.Redis:
    """获取Redis客户端的便捷函数"""
    return redis_manager.get_client()


@contextmanager
def redis_connection():
    """Redis连接上下文管理器的便捷函数"""
    with redis_manager.get_connection() as client:
        yield client


def set_task_status(task_id: str, status: str, data: Optional[dict] = None) -> bool:
    """设置任务状态的便捷函数"""
    try:
        import json
        task_data = {
            "task_id": task_id,
            "status": status,
            "updated_at": json.dumps({"__timestamp__": True}, default=str)
        }
        if data:
            task_data.update(data)
        
        return redis_manager.set_task_result(task_id, task_data)
    except Exception as e:
        logger.error(f"设置任务状态失败: {e}")
        return False