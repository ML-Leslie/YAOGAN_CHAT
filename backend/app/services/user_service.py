from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session
from datetime import datetime
import uuid

from app.db.models import User, Chat, Message
from app.core.security import get_password_hash, verify_password

class UserService:
    @staticmethod
    def get_user_by_username(db: Session, username: str) -> Optional[User]:
        """根据用户名获取用户"""
        return db.query(User).filter(User.username == username).first()
    
    @staticmethod
    def get_user_by_id(db: Session, user_id: str) -> Optional[User]:
        """根据ID获取用户"""
        return db.query(User).filter(User.id == user_id).first()
    
    @staticmethod
    def create_user(db: Session, username: str, password: str, display_name: Optional[str] = None) -> User:
        """创建新用户"""
        hashed_password = get_password_hash(password)
        user = User(
            id=str(uuid.uuid4()),
            username=username,
            hashed_password=hashed_password,
            display_name=display_name or username,
            created_at=datetime.utcnow()
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        return user
    
    @staticmethod
    def authenticate_user(db: Session, username: str, password: str) -> Optional[User]:
        """认证用户"""
        user = UserService.get_user_by_username(db, username)
        if not user:
            return None
        if not verify_password(password, user.hashed_password):
            return None
        return user
    
    @staticmethod
    def update_last_login(db: Session, user_id: str) -> None:
        """更新最后登录时间"""
        user = UserService.get_user_by_id(db, user_id)
        if user:
            user.last_login = datetime.utcnow()
            db.commit()
            
class ChatService:
    @staticmethod
    def create_chat(db: Session, user_id: str, title: str = "新对话") -> Chat:
        """创建新的聊天会话"""
        chat = Chat(
            id=str(uuid.uuid4()),
            user_id=user_id,
            title=title,
            created_at=datetime.utcnow(),
            last_updated=datetime.utcnow()
        )
        db.add(chat)
        db.commit()
        db.refresh(chat)
        return chat
    
    @staticmethod
    def get_user_chats(db: Session, user_id: str) -> List[Chat]:
        """获取用户的所有聊天会话"""
        return db.query(Chat).filter(Chat.user_id == user_id).order_by(Chat.last_updated.desc()).all()
    
    @staticmethod
    def get_chat_by_id(db: Session, chat_id: str) -> Optional[Chat]:
        """根据ID获取聊天会话"""
        return db.query(Chat).filter(Chat.id == chat_id).first()
    
    @staticmethod
    def update_chat_title(db: Session, chat_id: str, title: str) -> Optional[Chat]:
        """更新聊天会话标题"""
        chat = ChatService.get_chat_by_id(db, chat_id)
        if chat:
            chat.title = title
            chat.last_updated = datetime.utcnow()
            db.commit()
            db.refresh(chat)
        return chat
    
    @staticmethod
    def delete_chat(db: Session, chat_id: str) -> bool:
        """删除聊天会话"""
        chat = ChatService.get_chat_by_id(db, chat_id)
        if chat:
            db.delete(chat)
            db.commit()
            return True
        return False

class MessageService:
    @staticmethod
    def create_message(
        db: Session, 
        chat_id: str, 
        text: str, 
        sender: str, 
        image_path: Optional[str] = None,
        thinking: Optional[str] = None,
        error: bool = False,
        object_coordinates: Optional[str] = None,
        is_object_mark: bool = False
    ) -> Message:
        """创建新消息"""
        message = Message(
            id=str(uuid.uuid4()),
            chat_id=chat_id,
            text=text,
            sender=sender,
            image_path=image_path,
            thinking=thinking,
            error=error,
            object_coordinates=object_coordinates,
            is_object_mark=is_object_mark,
            timestamp=datetime.utcnow()
        )
        db.add(message)
        
        # 更新聊天会话的最后更新时间
        chat = db.query(Chat).filter(Chat.id == chat_id).first()
        if chat:
            chat.last_updated = datetime.utcnow()
        
        db.commit()
        db.refresh(message)
        return message
    
    @staticmethod
    def get_chat_messages(db: Session, chat_id: str) -> List[Message]:
        """获取聊天会话的所有消息"""
        return db.query(Message).filter(Message.chat_id == chat_id).order_by(Message.timestamp).all()
    
    @staticmethod
    def get_message_by_id(db: Session, message_id: str) -> Optional[Message]:
        """根据ID获取消息"""
        return db.query(Message).filter(Message.id == message_id).first()
    
    @staticmethod
    def get_last_messages(db: Session, chat_id: str, limit: int = 10) -> List[Message]:
        """获取聊天会话的最近消息"""
        return db.query(Message).filter(Message.chat_id == chat_id).order_by(Message.timestamp.desc()).limit(limit).all()
