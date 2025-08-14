from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from datetime import timedelta
from typing import Any, List

from app.db.database import get_db
from app.services.user_service import UserService, ChatService, MessageService
from app.core.security import create_access_token, verify_password, get_password_hash
from app.core.config import ACCESS_TOKEN_EXPIRE_MINUTES
from app.models.user import UserCreate, User, Chat as ChatModel, Message as MessageModel
from jose import JWTError, jwt
from app.core.config import SECRET_KEY, ALGORITHM

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

router = APIRouter()

async def get_current_user(db: Session = Depends(get_db), token: str = Depends(oauth2_scheme)) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="无效的身份验证凭据",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
        
    user = UserService.get_user_by_username(db, username)
    if user is None:
        raise credentials_exception
    return user

@router.post("/register", response_model=User)
async def register_user(user_create: UserCreate, db: Session = Depends(get_db)):
    """注册新用户"""
    # 检查用户名是否已存在
    db_user = UserService.get_user_by_username(db, user_create.username)
    if db_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="用户名已被使用"
        )
    
    # 创建新用户
    user = UserService.create_user(
        db=db,
        username=user_create.username,
        password=user_create.password,
        display_name=user_create.display_name
    )
    
    # 创建默认聊天
    ChatService.create_chat(db=db, user_id=user.id, title="新对话")
    
    return user

@router.post("/token")
async def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    """获取访问令牌"""
    user = UserService.authenticate_user(db, form_data.username, form_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="用户名或密码不正确",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # 更新最后登录时间
    UserService.update_last_login(db, user.id)
    
    # 创建访问令牌
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.username}, expires_delta=access_token_expires
    )
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user_id": user.id,
        "username": user.username,
        "display_name": user.display_name
    }

@router.get("/me", response_model=User)
async def read_users_me(current_user: User = Depends(get_current_user)):
    """获取当前用户信息"""
    return current_user

@router.get("/chats", response_model=List[dict])
async def get_user_chats(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """获取用户的所有聊天会话"""
    chats = ChatService.get_user_chats(db, current_user.id)
    
    # 格式化聊天会话
    result = []
    for chat in chats:
        # 获取每个聊天的最后一条消息
        messages = MessageService.get_last_messages(db, chat.id, 1)
        last_message = None
        if messages:
            msg = messages[0]
            last_message = {
                "id": msg.id,
                "text": msg.text,
                "sender": msg.sender,
                "timestamp": msg.timestamp.isoformat()
            }
        
        chat_data = {
            "id": chat.id,
            "title": chat.title,
            "created_at": chat.created_at.isoformat(),
            "last_updated": chat.last_updated.isoformat(),
            "last_message": last_message
        }
        result.append(chat_data)
    
    return result

@router.post("/chats", response_model=dict)
async def create_new_chat(
    title: str = "新对话", 
    current_user: User = Depends(get_current_user), 
    db: Session = Depends(get_db)
):
    """创建新的聊天会话"""
    chat = ChatService.create_chat(db, current_user.id, title)
    
    # 添加欢迎消息
    welcome_message = MessageService.create_message(
        db=db,
        chat_id=chat.id,
        text="你好，欢迎使用YAOGAN聊天系统！请开始对话或上传遥感图像进行分析。",
        sender="ai"
    )
    
    return {
        "id": chat.id,
        "title": chat.title,
        "created_at": chat.created_at.isoformat(),
        "last_updated": chat.last_updated.isoformat()
    }

@router.get("/chats/{chat_id}/messages", response_model=List[dict])
async def get_chat_messages(
    chat_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """获取聊天会话的所有消息"""
    # 验证聊天会话归属权
    chat = ChatService.get_chat_by_id(db, chat_id)
    if not chat or chat.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="聊天会话不存在"
        )
    
    messages = MessageService.get_chat_messages(db, chat_id)
    
    # 格式化消息
    result = []
    for msg in messages:
        message_data = {
            "id": msg.id,
            "text": msg.text,
            "sender": msg.sender,
            "timestamp": msg.timestamp.isoformat(),
            "image_path": msg.image_path,  # 使用image_path一致的字段名
            "thinking": msg.thinking,
            "error": msg.error
        }
        result.append(message_data)
    
    return result

@router.put("/chats/{chat_id}", response_model=dict)
async def update_chat(
    chat_id: str,
    title: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """更新聊天会话标题"""
    # 验证聊天会话归属权
    chat = ChatService.get_chat_by_id(db, chat_id)
    if not chat or chat.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="聊天会话不存在"
        )
    
    updated_chat = ChatService.update_chat_title(db, chat_id, title)
    
    return {
        "id": updated_chat.id,
        "title": updated_chat.title,
        "created_at": updated_chat.created_at.isoformat(),
        "last_updated": updated_chat.last_updated.isoformat()
    }

@router.delete("/chats/{chat_id}", response_model=dict)
async def delete_chat(
    chat_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """删除聊天会话"""
    # 验证聊天会话归属权
    chat = ChatService.get_chat_by_id(db, chat_id)
    if not chat or chat.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="聊天会话不存在"
        )
    
    success = ChatService.delete_chat(db, chat_id)
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="删除聊天会话失败"
        )
    
    return {"message": "聊天会话已删除"}
