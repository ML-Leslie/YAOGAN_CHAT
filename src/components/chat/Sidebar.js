import React, { useState, useEffect, useRef } from 'react';
import './Sidebar.css';


const Sidebar = ({ chats, activeChat, onChatSelect, onNewChat, onDeleteChat, user, setUser, setIsAuthenticated, setChats, setActiveChat, forceCollapsed }) => {
  // 默认状态为折叠
  const [collapsed, setCollapsed] = useState(false);
  // 默认未固定
  const [isPinned, setIsPinned] = useState(true);
  const [isHovered, setIsHovered] = useState(false);
  const sidebarRef = useRef(null);
  // 切换侧边栏固定状态
  const togglePin = (e) => {
    e.stopPropagation(); // 防止事件冒泡
    setIsPinned(!isPinned);
    if (!isPinned) {
      setCollapsed(false); // 如果固定，展开侧边栏
    }
  };

  // 鼠标进入和离开侧边栏事件处理
  const handleMouseEnter = () => {
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
  };
  // 处理退出
//   const handleLogout = () => {
//     localStorage.removeItem('access_token');
//     localStorage.removeItem('user_info');
//     setUser(null);
//     setIsAuthenticated(false);
//     setChats([]);
//     setActiveChat(null);
//   };
  // 根据鼠标悬停状态和固定状态决定侧边栏是否折叠
  useEffect(() => {
    if (forceCollapsed) {
      // 如果强制折叠，则忽略其他状态直接折叠
      setCollapsed(true);
    } else if (!isPinned) {
      setCollapsed(!isHovered);
    } else {
      setCollapsed(false);
    }
  }, [isHovered, isPinned, forceCollapsed]);

  return (
    <div 
      ref={sidebarRef}
      className={`sidebar ${collapsed ? 'collapsed' : ''} ${isPinned ? 'pinned' : ''}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div className="app-title">
        <div className="app-name-bar">
          <svg 
            width="24" 
            height="24" 
            viewBox="0 0 24 24" 
            fill="none" 
            xmlns="http://www.w3.org/2000/svg"
            className="app-logo"
          >
            <path 
              d="M12 2L2 7L12 12L22 7L12 2Z" 
              stroke="black" 
              strokeWidth="2" 
              strokeLinecap="round" 
              strokeLinejoin="round"
              fill="rgba(255,255,255,0.2)"
            />
            <path 
              d="M2 17L12 22L22 17" 
              stroke="black" 
              strokeWidth="2" 
              strokeLinecap="round" 
              strokeLinejoin="round"
            />
            <path 
              d="M2 12L12 17L22 12" 
              stroke="black" 
              strokeWidth="2" 
              strokeLinecap="round" 
              strokeLinejoin="round"
            />
          </svg>
          <div className="app-name">YAOGAN</div>
        </div>
        <button 
          className={`pin-sidebar ${isPinned ? 'active' : ''}`} 
          onClick={togglePin}
          title={isPinned ? "取消固定" : "固定侧边栏"}
        >
          <div className="pin-icon"></div>
        </button>
      </div>

      <button className="new-chat-button" onClick={onNewChat}>
        <span className="button-icon"></span>
        <span className="button-text">新建会话</span>
      </button>

      <div className="chat-history">
        <h3 className="history-title">历史会话</h3>
        <ul className="chat-list">
          {chats.map(chat => (
            <li 
              key={chat.id} 
              className={`chat-item ${activeChat?.id === chat.id ? 'active' : ''}`}
            >
              <div 
                className="chat-item-content" 
                onClick={() => onChatSelect(chat.id)}
              >
                <div className="chat-item-left">
                  <div className="chat-item-title gradient-text">{chat.title || '新对话'}</div>
                </div>
                <div className="chat-item-right">
                  <div className="chat-item-date">{formatDate(chat.lastUpdated)}</div>
                  <button 
                    className="delete-chat-button" 
                    title="删除此会话"
                    onClick={(e) => {
                      e.stopPropagation(); // 阻止点击事件冒泡
                      if (window.confirm('确定要删除这个会话吗？此操作不可撤销。')) {
                        onDeleteChat && onDeleteChat(chat.id);
                      }
                    }}
                  >
                    <span className="delete-icon">×</span>
                  </button>
                </div>
              </div>
            </li>
          ))}
          
          {chats.length === 0 && (
            <li className="no-chats-message">暂无历史会话</li>
          )}
        </ul>
      </div>
      
      <div className="user-profile">
        <div className="user-profile-inner">
          <div className="user-avatar">
            {user?.displayName?.charAt(0) || user?.username?.charAt(0) || '?'}
          </div>
          <div className="user-info">
            <div className="user-name">{user?.displayName || user?.username || '未登录'}</div>
          </div>
        </div>
      </div>
    </div>
  );
};

// 格式化日期为"今天"、"昨天"或具体日期
const formatDate = (timestamp) => {
  if (!timestamp) return '';
  
  const date = new Date(timestamp);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  
  const isToday = date.toDateString() === today.toDateString();
  const isYesterday = date.toDateString() === yesterday.toDateString();
  
  if (isToday) {
    return '今天';
  } else if (isYesterday) {
    return '昨天';
  } else {
    return new Intl.DateTimeFormat('zh-CN', {
      month: 'short',
      day: 'numeric'
    }).format(date);
  }
};

export default Sidebar;
