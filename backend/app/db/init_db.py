from app.db.database import Base, engine

# 导入所有数据库模型以确保它们在创建表之前已定义
from app.db.models import User, Chat, Message

def init_db():
    """初始化数据库，创建所有表"""
    Base.metadata.create_all(bind=engine)
