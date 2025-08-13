import React, { useState, useEffect, useCallback } from 'react';
import './App.css';
import Sidebar from './components/chat/Sidebar';
import ChatContainer from './components/chat/ChatContainer';
import CanvasDisplay from './components/chat/CanvasDisplay';
import AppHeader from './components/chat/AppHeader';
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

  // 创建新会话
  const createNewChat = useCallback(() => {
    const newChat = {
      id: Date.now().toString(),
      title: '新对话',
      messages: [],
      lastUpdated: new Date()
    };
    
    setChats(prev => [newChat, ...prev]);
    setActiveChat(newChat);
  }, []);

  // 初始化一个默认会话
  useEffect(() => {
    if (chats.length === 0) {
      createNewChat();
    }
  }, [chats.length, createNewChat]);

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
    } else {
      // 处理其他功能
      console.log(`选择了功能: ${functionId}`);
    }
  };

  return (
    <div className="App">
      <div className="chat-layout">
        <div className="sidebar-container">
          <AppHeader />
          <Sidebar 
            chats={chats}
            activeChat={activeChat}
            onChatSelect={handleChatSelect}
            onNewChat={createNewChat}
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
