import React, { useState, useEffect, useCallback } from 'react';
import './App.css';
import Sidebar from './components/chat/Sidebar';
import ChatContainer from './components/chat/ChatContainer';
import CanvasDisplay from './components/chat/CanvasDisplay';
import { login, getUserChats, createNewChat } from './services/api';
import './components/chat/ChatLayout.css';

function App() {
  // 设置画布尺寸
  const [canvasSize] = useState({
    width: 800,
    height: 600
  });
  
  // 应用状态
  const [chats, setChats] = useState([]);
  const [activeChat, setActiveChat] = useState(null);
  const [showRightSidebar, setShowRightSidebar] = useState(false);
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // 检查用户登录状态
  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('access_token');
      const userInfo = localStorage.getItem('user_info');
      
      if (token && userInfo) {
        try {
          // 可以使用JWT解码检查令牌是否有效，或直接调用API验证
          const userData = JSON.parse(userInfo);
          setUser(userData);
          setIsAuthenticated(true);
        } catch (error) {
          console.error('身份验证检查失败:', error);
          // 清除无效的存储
          localStorage.removeItem('access_token');
          localStorage.removeItem('user_info');
          setIsAuthenticated(false);
        }
      } else {
        setIsAuthenticated(false);
      }
      setIsLoading(false);
    };

    checkAuth();
  }, []);

  // 处理登录
  const handleLogin = async (username, password) => {
    try {
      await login(username, password);
      const userInfo = JSON.parse(localStorage.getItem('user_info'));
      setUser(userInfo);
      setIsAuthenticated(true);
      await loadUserChats();
    } catch (error) {
      console.error('登录失败:', error);
      throw error;
    }
  };



  // 加载用户的聊天历史
  const loadUserChats = async () => {
    try {
      const userChats = await getUserChats();
      if (userChats && userChats.length > 0) {
        // 格式化聊天数据
        const formattedChats = userChats.map(chat => ({
          id: chat.id,
          title: chat.title,
          lastUpdated: new Date(chat.last_updated),
          lastMessage: chat.last_message
        }));
        setChats(formattedChats);
        setActiveChat(formattedChats[0]);
      } else {
        // 如果没有聊天历史，创建一个新的
        handleCreateNewChat();
      }
    } catch (error) {
      console.error('加载聊天历史失败:', error);
    }
  };

  // 创建新会话
  const handleCreateNewChat = useCallback(async () => {
    try {
      const newChat = await createNewChat('新对话');
      const formattedChat = {
        id: newChat.id,
        title: newChat.title,
        lastUpdated: new Date(newChat.last_updated)
      };
      
      setChats(prev => [formattedChat, ...prev]);
      setActiveChat(formattedChat);
    } catch (error) {
      console.error('创建新聊天失败:', error);
    }
  }, []);
  
  // 删除聊天会话
  const handleDeleteChat = useCallback(async (chatId) => {
    try {
      // 导入删除聊天功能
      const { deleteChat } = require('./services/api');
      await deleteChat(chatId);
      
      // 更新本地状态
      setChats(prev => prev.filter(chat => chat.id !== chatId));
      
      // 如果删除的是当前活跃的聊天，则选择列表中的第一个聊天或创建一个新的
      if (activeChat?.id === chatId) {
        // 过滤掉被删除的聊天后选择第一个
        const remainingChats = chats.filter(chat => chat.id !== chatId);
        if (remainingChats.length > 0) {
          setActiveChat(remainingChats[0]);
        } else {
          // 如果没有剩余的聊天，创建一个新的
          handleCreateNewChat();
        }
      }
    } catch (error) {
      console.error('删除聊天失败:', error);
      alert('删除聊天失败: ' + error.message);
    }
  }, [activeChat, chats, handleCreateNewChat]);

  // 当认证状态改变时加载聊天
  useEffect(() => {
    if (isAuthenticated) {
      loadUserChats();
    }
  }, [isAuthenticated]);

  // 选择会话
  const handleChatSelect = (chatId) => {
    const selected = chats.find(chat => chat.id === chatId);
    if (selected) {
      setActiveChat(selected);
    }
  };

  // 处理功能选择
  const handleFunctionSelect = (functionId) => {
    if (functionId === 'canvas') {
      setShowRightSidebar(true);
    } else if (functionId === 'new-chat') {
      handleCreateNewChat();
    } else {
      // 处理其他功能
      console.log(`选择了功能: ${functionId}`);
    }
  };
  
  // 如果仍在加载，显示加载中状态
  if (isLoading) {
    return <div className="loading">加载中...</div>;
  }
  
  // 如果未登录，显示登录界面
  if (!isAuthenticated) {
    return (
      <div className="login-container">
        <h1>遥感图像分析系统</h1>
        <button 
          onClick={() => handleLogin('demo', 'password')}
          className="login-button"
        >
          使用演示账户登录
        </button>
        <p>用户名: demo, 密码: password</p>
      </div>
    );
  };

  return (
    <div className="App">
      <div className="chat-layout">
        <div className="sidebar-container">
          <Sidebar 
            chats={chats}
            activeChat={activeChat}
            onChatSelect={handleChatSelect}
            onNewChat={handleCreateNewChat}
            onDeleteChat={handleDeleteChat}
            user={user}
            setUser={setUser}
            setIsAuthenticated={setIsAuthenticated}
            setChats={setChats}
            setActiveChat={setActiveChat}
          />
        </div>
        
        <div className="main-content">
          <div className="chat-area">
            <ChatContainer 
              activeChat={activeChat}
              onFunctionSelect={handleFunctionSelect}
            />
          </div>
          
          <div className={`right-sidebar ${showRightSidebar ? 'expanded' : ''}`}>
            <CanvasDisplay 
              width={canvasSize.width * 0.8} 
              height={canvasSize.height * 0.8}
              onClose={() => setShowRightSidebar(false)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
