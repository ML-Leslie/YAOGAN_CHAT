import React, { useState, useRef, useEffect } from 'react';
import ChatMessage from './ChatMessage';
import ChatInput from './ChatInput';
import FunctionButtons from './FunctionButtons';
import { uploadAndAnalyzeImage, pollTaskResult } from '../../services/api';
import './ChatContainer.css';

const ChatContainer = ({ activeChat, onFunctionSelect }) => {
  const [messages, setMessages] = useState([]);
  const [isTyping, setIsTyping] = useState(false);
  const [currentImage, setCurrentImage] = useState(null);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    // 加载当前活跃聊天的消息历史
    if (activeChat) {
      // 如果没有消息，添加一个欢迎消息
      if (!activeChat.messages || activeChat.messages.length === 0) {
        setMessages([{
          id: 'welcome',
          text: '你好，欢迎使用YAOGAN聊天系统！请开始对话或上传遥感图像进行分析。',
          sender: 'ai',
          timestamp: new Date()
        }]);
      } else {
        setMessages(activeChat.messages);
      }
    } else {
      setMessages([]);
    }
  }, [activeChat]);

  // 自动滚动到最新消息
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };
  
  const handleImageUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    
    // 保存当前上传的图像文件
    setCurrentImage(file);
    
    // 添加图像上传消息
    const imageMessage = {
      id: Date.now(),
      text: '已上传图像，请输入您想问的问题。',
      sender: 'system',
      image: URL.createObjectURL(file),
      timestamp: new Date()
    };
    
    setMessages(prev => [...prev, imageMessage]);
  };
  
  // 创建文件上传按钮点击处理函数
  const handleUploadButtonClick = () => {
    fileInputRef.current.click();
  };

  const handleSendMessage = async (text) => {
    if (!text.trim()) return;
    
    // 添加用户消息
    const userMessage = {
      id: Date.now(),
      text,
      sender: 'user',
      timestamp: new Date()
    };
    
    setMessages(prev => [...prev, userMessage]);
    setIsTyping(true);
    
    try {
      if (currentImage) {
        // 如果有当前图像，发送图像分析请求
        const response = await uploadAndAnalyzeImage(currentImage, text);
        
        // 添加处理中消息
        const processingMessage = {
          id: Date.now() + 1,
          text: '正在分析图像，请稍候...',
          sender: 'system',
          timestamp: new Date()
        };
        
        setMessages(prev => [...prev, processingMessage]);
        
        // 轮询任务结果
        const result = await pollTaskResult(
          response.task_id, 
          3000, 
          30, 
          (attempts, maxAttempts) => {
            console.log(`轮询进度: ${attempts}/${maxAttempts}`);
          }
        );
        
        // 添加AI回复
        const aiMessage = {
          id: Date.now() + 2,
          text: result.result || '分析完成，但未返回结果',
          sender: 'ai',
          timestamp: new Date()
        };
        
        // 移除处理中消息并添加AI回复
        setMessages(prev => prev.filter(msg => msg.id !== processingMessage.id).concat([aiMessage]));
        
        // 清除当前图像
        setCurrentImage(null);
      } else {
        // 没有图像，直接调用API进行文本对话
        // 模拟AI响应，实际项目中应替换为真实API调用
        setTimeout(() => {
          const aiMessage = {
            id: Date.now() + 1,
            text: `这是对"${text}"的回复。请上传遥感图像以获取详细分析。`,
            sender: 'ai',
            timestamp: new Date()
          };
          setMessages(prev => [...prev, aiMessage]);
          setIsTyping(false);
        }, 1000);
      }
    } catch (error) {
      console.error('发送消息出错:', error);
      setMessages(prev => [...prev, {
        id: Date.now() + 1,
        text: `抱歉，处理您的消息时出现了错误: ${error.message}`,
        sender: 'ai',
        error: true,
        timestamp: new Date()
      }]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="chat-container">
      <div className="messages-container">
        {messages.map(message => (
          <ChatMessage key={message.id} message={message} />
        ))}
        {isTyping && (
          <div className="typing-indicator">
            <span></span>
            <span></span>
            <span></span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      
      <div className="input-container">
        <div className="function-controls">
          <FunctionButtons onFunctionSelect={onFunctionSelect} />
          <button 
            className="upload-image-button" 
            onClick={handleUploadButtonClick}
            title="上传遥感图像"
          >
            📁 上传图像
          </button>
          <input 
            type="file" 
            ref={fileInputRef}
            style={{ display: 'none' }} 
            accept="image/*"
            onChange={handleImageUpload}
          />
        </div>
        <ChatInput 
          onSendMessage={handleSendMessage} 
          placeholder={currentImage ? "请输入关于图像的问题..." : "输入消息..."}
        />
      </div>
    </div>
  );
};

export default ChatContainer;
