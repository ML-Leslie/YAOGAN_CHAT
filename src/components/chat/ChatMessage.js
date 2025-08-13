import React from 'react';
import './ChatMessage.css';

const ChatMessage = ({ message }) => {
  const { sender, text, timestamp, error, image } = message;
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

  return (
    <div className={`message-wrapper ${
      isUser ? 'user-message' : isSystem ? 'system-message' : 'ai-message'
    }`}>
      <div className="avatar">
        {getAvatar()}
      </div>
      
      <div className={`message-bubble ${error ? 'error-message' : ''}`}>
        {image && (
          <div className="message-image-container">
            <img src={image} alt="上传的图像" className="message-image" />
          </div>
        )}
        <div className="message-content">{text}</div>
        <div className="message-timestamp">{formattedTime}</div>
      </div>
    </div>
  );
};

export default ChatMessage;
