import React, { useState } from 'react';
import Markdown from './Markdown';
import './ChatMessage.css';

const ChatMessage = ({ message }) => {
  const { sender, text, timestamp, error, image, thinking } = message;
  const [showThinking, setShowThinking] = useState(false);
  
  const isUser = sender === 'user';
  const isSystem = sender === 'system';
  
  // 获取头像内容
  const getAvatar = () => {
    if (isUser) return <div className="user-avatar">U</div>;
    if (isSystem) return <div className="system-avatar">S</div>;
    return <div className="ai-avatar">AI</div>;
  };
  
  // 格式化显示图片
  const formatImageUrl = (url) => {
    // 如果URL已经是完整URL，则直接返回
    if (!url) return '';
    
    if (url.startsWith('http') || url.startsWith('blob:')) {
      return url;
    }
    
    // 如果是相对路径，添加API基础URL
    const API_BASE_URL = 'http://localhost:8000';
    
    // 确保路径以/开头
    if (!url.startsWith('/')) {
      url = '/' + url;
    }
    
    console.log('格式化图片URL:', `${API_BASE_URL}${url}`);
    return `${API_BASE_URL}${url}`;
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
            <img src={formatImageUrl(image)} alt="上传的图像" className="message-image" />
          </div>
        )}
        
        {/* 消息内容 - 使用Markdown渲染AI回复 */}
        <div className="message-content">
          {isUser || isSystem ? text : <Markdown content={text} />}
        </div>
        
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
      </div>
    </div>
  );
};

export default ChatMessage;
