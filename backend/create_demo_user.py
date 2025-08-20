"""
初始化数据库脚本
用于首次启动时创建数据库表和默认数据
"""
from app.db.database import Base, engine
from app.db.models import User, Chat, Message
from app.core.security import get_password_hash
import uuid
from datetime import datetime

def init_db():
    """初始化数据库"""
    # 创建所有表
    Base.metadata.create_all(bind=engine)
    print("数据库表创建完成")
    
def create_demo_user():
    """创建演示用户"""
    from sqlalchemy.orm import sessionmaker
    
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = SessionLocal()
    
    try:
        # 检查用户是否已存在
        user = db.query(User).filter(User.username == "demo").first()
        if not user:
            # 创建演示用户
            user = User(
                id=str(uuid.uuid4()),
                username="demo",
                display_name="演示用户",
                hashed_password=get_password_hash("password"),
                created_at=datetime.utcnow()
            )
            db.add(user)
            db.commit()
            db.refresh(user)
            print(f"已创建演示用户: demo (ID: {user.id})")
            
            # 创建一个默认聊天
            chat = Chat(
                id=str(uuid.uuid4()),
                user_id=user.id,
                title="欢迎使用遥感图像分析系统",
                created_at=datetime.utcnow(),
                last_updated=datetime.utcnow()
            )
            db.add(chat)
            db.commit()
            db.refresh(chat)
            print(f"已创建默认聊天: {chat.title} (ID: {chat.id})")
            
            # 添加欢迎消息
            welcome_message = Message(
                id=str(uuid.uuid4()),
                chat_id=chat.id,
                text="你好，欢迎使用YAOGAN聊天系统！请开始对话或上传遥感图像进行分析。",
                sender="ai",
                timestamp=datetime.utcnow()
            )
            db.add(welcome_message)
            db.commit()
            print("已添加欢迎消息")
        else:
            print("演示用户已存在，跳过创建")
            
    except Exception as e:
        print(f"创建演示用户时出错: {str(e)}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    print("开始初始化数据库...")
    init_db()
    create_demo_user()
    print("数据库初始化完成")
