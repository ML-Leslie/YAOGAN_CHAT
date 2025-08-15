import React, { useState, useRef, useEffect } from 'react';
import './ChatInput.css';

const ChatInput = ({ 
  onSendMessage, 
  placeholder = "向对话助手提问...", 
  markObjectMode = false, 
  onCancelMarkObject = () => {}, 
  isGenerating = false, 
  onCancelGeneration = () => {} 
}) => {
  const [message, setMessage] = useState('');
  const textareaRef = useRef(null);

  // 自动调整文本域高度
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      const newHeight = Math.min(textarea.scrollHeight, 150);
      textarea.style.height = `${newHeight}px`;
    }
  }, [message]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (message.trim()) {
      onSendMessage(message);
      setMessage('');
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      handleSubmit(e);
    }
  };

  return (
    <div className="chat-input-wrapper">
      <form onSubmit={handleSubmit} className="chat-input-form">
        {markObjectMode && (
          <div className="mark-object-tag">
            <span>标记物体</span>
            <button
              type="button"
              className="cancel-mark-button"
              onClick={onCancelMarkObject}
            >
              <span>×</span>
            </button>
          </div>
        )}
        <textarea
          ref={textareaRef}
          className={`chat-input ${markObjectMode ? 'with-mark-tag' : ''} ${isGenerating ? 'disabled' : ''}`}
          value={isGenerating ? '正在生成回复中...' : message}
          onChange={(e) => !isGenerating && setMessage(e.target.value)}
          onKeyDown={(e) => !isGenerating && handleKeyDown(e)}
          placeholder={isGenerating ? '请等待回复生成...' : placeholder}
          rows={1}
          disabled={isGenerating}
        />
        {isGenerating ? (
          <button
            type="button"
            className="send-button cancel-button"
            onClick={onCancelGeneration}
            title="取消生成"
          >
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        ) : (
          <button
            type="submit"
            className="send-button"
            disabled={!message.trim()}
          >
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M22 2L11 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M22 2L15 22L11 13L2 9L22 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        )}
      </form>
    </div>
  );
};

export default ChatInput;
