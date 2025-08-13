import React, { useState } from 'react';
import './ChatMessage.css';

const ChatMessage = ({ message }) => {
  const { sender, text, timestamp, error, image, thinking } = message;
  const [showThinking, setShowThinking] = useState(false);
  
  const isUser = sender === 'user';
  const isSystem = sender === 'system';
  
  const formattedTime = new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(timestamp));
  
  // 获取头像内容
  const getAvatar = () => {
    if (isUser) return <div className="user-avatar">U</div>;
    if (isSystem) return <div className="system-avatar">S</div>;
    return <div className="ai-avatar">AI</div>;
  };
  
  // 切换思考过程显示
  const toggleThinking = () => {
    setShowThinking(!showThinking);
  };

  return (
    <div className={`message-wrapper ${
      isUser ? 'user-message' : isSystem ? 'system-message' : 'ai-message'
    }`}>
      <div className="avatar">
        {getAvatar()}
      </div>
      
      <div className={`message-bubble ${error ? 'error-message' : ''}`}>
        {/* 如果有图像，显示图像 */}
        {image && (
          <div className="message-image-container">
            <img src={image} alt="上传的图像" className="message-image" />
          </div>
        )}
        
        {/* 消息内容 */}
        <div className="message-content">{text}</div>
        
        {/* 思考过程（如果有） */}
        {thinking && (
          <div className="thinking-section">
            <button 
              className="thinking-toggle" 
              onClick={toggleThinking}
            >
              {showThinking ? '隐藏思考过程' : '查看思考过程'}
            </button>
            
            {showThinking && (
              <div className="thinking-content">
                <pre>{thinking}</pre>
              </div>
            )}
          </div>
        )}
        
        <div className="message-timestamp">{formattedTime}</div>
      </div>
    </div>
  );
};

export default ChatMessage;
