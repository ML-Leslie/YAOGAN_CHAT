import React, { useState, useEffect } from 'react';
import Markdown from './Markdown';
import { getImageUrl } from '../../config/api';
import './ChatMessage.css';

const ChatMessage = ({ message, onViewInCanvas }) => {
  const { sender, text, error, image, thinking, isObjectMark, objectCoordinates } = message;
  const [showThinking, setShowThinking] = useState(false);
  
  const isUser = sender === 'user';
  const isSystem = sender === 'system';
  
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
  
  // 当组件加载且是物体标记消息时，自动更新画布（解决首次标记问题）
  useEffect(() => {
    if (isObjectMark && objectCoordinates && window.updateCanvasDisplay) {
      console.log('物体标记消息加载，自动更新画布状态');
      window.updateCanvasDisplay();
    }
  }, [isObjectMark, objectCoordinates]);

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
            <img src={getImageUrl(image)} alt="上传的图像" className="message-image" />
          </div>
        )}
        
        {/* 消息内容 - 使用Markdown渲染所有消息 */}
        <div className="message-content">
          {isObjectMark ? "已在画布完成标记" : <Markdown content={text} />}
        </div>
        
        {/* 如果是物体标记模式且有坐标，显示在画布查看按钮 */}
        {isObjectMark && onViewInCanvas && (
          <div className="canvas-view-section">
            <button 
              className="canvas-view-button toggle-canvas-button" 
              onClick={() => {
                // 首先通知画布更新（加载最新数据）
                if (window.updateCanvasDisplay) {
                  window.updateCanvasDisplay();
                }
                // 然后切换画布视图状态
                onViewInCanvas();
              }}
            >
              在画布中查看
            </button>
          </div>
        )}
        
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
