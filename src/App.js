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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // 检查用户登录状态
  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('access_token');
      const userInfo = localStorage.getItem('user_info');
      
      if (token && userInfo) {
        try {
          // 调用API验证token的有效性
          const { getCurrentUser } = require('./services/api');
          await getCurrentUser();
          
          // 如果API调用成功，说明token有效
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

    // 监听全局认证失败事件
    const handleAuthFailure = () => {
      console.log('检测到认证失败，重定向到登录页面');
      setIsAuthenticated(false);
      setUser(null);
      setChats([]);
      setActiveChat(null);
    };

    window.addEventListener('authenticationFailed', handleAuthFailure);
    
    return () => {
      window.removeEventListener('authenticationFailed', handleAuthFailure);
    };
  }, []);

  // 响应式监听窗口大小变化
  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      // 当窗口宽度小于1024px时自动收起侧边栏，优先保留对话区域
      if (width < 1024) {
        setSidebarCollapsed(true);
      } else {
        setSidebarCollapsed(false);
      }
      
      // 如果窗口太小，还要收起右侧边栏
      if (width < 768 && showRightSidebar) {
        setShowRightSidebar(false);
      }
    };

    // 初始检查
    handleResize();
    
    // 添加事件监听器
    window.addEventListener('resize', handleResize);
    
    // 清理函数
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [showRightSidebar]);

  // 处理登录
  const handleLogin = async (username, password) => {
    setIsLoggingIn(true);
    try {
      await login(username, password);
      const userInfo = JSON.parse(localStorage.getItem('user_info'));
      setUser(userInfo);
      setIsAuthenticated(true);
      await loadUserChats();
    } catch (error) {
      console.error('登录失败:', error);
      alert('登录失败: ' + error.message);
      throw error;
    } finally {
      setIsLoggingIn(false);
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
          title: chat.title || '新对话',
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
      // 如果是认证失败，重置认证状态
      if (error.message === 'AUTHENTICATION_FAILED') {
        setIsAuthenticated(false);
        setUser(null);
        setChats([]);
        setActiveChat(null);
      }
    }
  };

  // 创建新会话
  const handleCreateNewChat = useCallback(async () => {
    try {
      const newChat = await createNewChat('新对话');
      const formattedChat = {
        id: newChat.id,
        title: newChat.title || '新对话',
        lastUpdated: new Date(newChat.last_updated)
      };
      
      setChats(prev => [formattedChat, ...prev]);
      setActiveChat(formattedChat);
    } catch (error) {
      console.error('创建新聊天失败:', error);
      // 如果是认证失败，重置认证状态
      if (error.message === 'AUTHENTICATION_FAILED') {
        setIsAuthenticated(false);
        setUser(null);
        setChats([]);
        setActiveChat(null);
      }
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
  
  // 添加全局函数，允许从ChatContainer中更新聊天标题
  useEffect(() => {
    // 全局函数，用于更新聊天标题
    window.updateChatTitle = (chatId, newTitle) => {
      setChats(prevChats => 
        prevChats.map(chat => 
          chat.id === chatId 
            ? { ...chat, title: newTitle }
            : chat
        )
      );
    };
    
    return () => {
      // 清理函数
      delete window.updateChatTitle;
    };
  }, []);

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
      // 切换画布显示状态
      setShowRightSidebar(prevState => !prevState);
    } else if (functionId === 'new-chat') {
      handleCreateNewChat();
    } else {
      // 处理其他功能
      console.log(`选择了功能: ${functionId}`);
    }
  };
  
  // 如果仍在加载，显示加载中状态
  if (isLoading) {
    return (
      <div className="loading">
        <div className="loading-spinner"></div>
        <div className="loading-text">正在加载...</div>
      </div>
    );
  }
  
  // 如果未登录，显示登录界面
  if (!isAuthenticated) {
    return (
      <div className="login-container">
        <h1>YAOGAN</h1>
        <div className="login-card">
          <h2 className="login-title">遥感图像分析系统</h2>
          <button 
            onClick={() => handleLogin('demo', 'password')}
            className="login-button"
            disabled={isLoggingIn}
          >
            {isLoggingIn ? (
              <>
                <div className="loading-spinner" style={{width: '20px', height: '20px', marginRight: '8px', display: 'inline-block'}}></div>
                登录中...
              </>
            ) : (
              '使用演示账户登录'
            )}
          </button>
          <div className="login-info">
            <strong>演示账户信息：</strong><br/>
            用户名: demo<br/>
            密码: password
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="App">
      <div className="chat-layout">
        <div className={`sidebar-container ${sidebarCollapsed ? 'auto-collapsed' : ''}`}>
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
            forceCollapsed={sidebarCollapsed}
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
              activeChat={activeChat}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
