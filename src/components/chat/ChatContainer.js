import React, { useState, useRef, useEffect } from 'react';
import ChatMessage from './ChatMessage';
import ChatInput from './ChatInput';
import FunctionButtons from './FunctionButtons';
import { uploadAndAnalyzeImage, pollTaskResult, getChatMessages, processTextMessage } from '../../services/api';
import './ChatContainer.css';

// API基础URL - 用于构建图片完整URL
const API_BASE_URL = 'http://localhost:8000';

const ChatContainer = ({ activeChat, onFunctionSelect }) => {
  const [messages, setMessages] = useState([]);
  const [isTyping, setIsTyping] = useState(false);
  const [currentImage, setCurrentImage] = useState(null);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    // 加载当前活跃聊天的消息历史
    const loadChatMessages = async () => {
      if (activeChat) {
        setIsTyping(true);
        try {
          const chatMessages = await getChatMessages(activeChat.id);
          if (chatMessages && chatMessages.length > 0) {
            // 格式化消息，并添加一个唯一标识符来防止重复
            const formattedMessages = chatMessages.map(msg => ({
              id: msg.id,
              text: msg.text,
              sender: msg.sender,
              timestamp: new Date(msg.timestamp),
              // 如果有image_path属性，构建完整的图片URL
              image: msg.image_path ? `${API_BASE_URL}${msg.image_path}` : null,
              thinking: msg.thinking,
              error: msg.error,
              // 添加服务器消息标识，避免本地重复
              serverMessage: true
            }));
            
            // 替换所有消息而不是追加
            setMessages(formattedMessages);
            
            // 检查是否存在系统图片消息，如果有，找到最后上传的图片
            const lastImageMessage = [...formattedMessages]
              .reverse()
              .find(msg => msg.sender === 'system' && msg.image);
              
            if (lastImageMessage) {
              // 如果找到图片消息，设置currentImage为特殊标记，表示正在使用已上传的图片
              setCurrentImage({ 
                isExisting: true, 
                url: lastImageMessage.image 
              });
            } else {
              // 没有找到图片，清除当前图片
              setCurrentImage(null);
            }
          } else {
            // 如果没有消息，添加一个欢迎消息
            setMessages([{
              id: 'welcome',
              text: '你好，欢迎使用YAOGAN聊天系统！请开始对话或上传遥感图像进行分析。',
              sender: 'ai',
              timestamp: new Date()
            }]);
          }
        } catch (error) {
          console.error('加载聊天消息失败:', error);
          setMessages([{
            id: 'error',
            text: `加载消息失败: ${error.message}`,
            sender: 'system',
            error: true,
            timestamp: new Date()
          }]);
        } finally {
          setIsTyping(false);
        }
      } else {
        setMessages([]);
      }
    };
    
    loadChatMessages();
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
    
    // 保存当前上传的图像文件（没有isExisting标记，表示这是新上传的图片）
    setCurrentImage(file);
    
    // 添加图像上传消息
    const blobUrl = URL.createObjectURL(file);
    console.log('创建的本地Blob URL:', blobUrl);
    
    const imageMessage = {
      id: Date.now(),
      text: '已上传图像，请输入您想问的问题。',
      sender: 'system',
      image: blobUrl,
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
    
    // 处理中消息ID (用于后续删除)
    let processingMessageId = null;
    
    try {
      if (currentImage) {
        // 添加处理中消息
        const processingMessage = {
          id: Date.now() + 1,
          text: '正在分析图像，请稍候...',
          sender: 'system',
          timestamp: new Date()
        };
        
        processingMessageId = processingMessage.id;
        setMessages(prev => [...prev, processingMessage]);
        
        let response;
        
        // 判断是新上传的图片还是已有的图片
        if (currentImage.isExisting) {
          // 如果是已有图片，则调用文本处理API
          console.log('使用已上传的图片进行分析...');
          
          // 调用文本处理API
          const result = await processTextMessage(text, activeChat.id);
          
          if (result.status === "success") {
            // 添加AI回复
            const aiMessage = {
              id: Date.now() + 2,
              text: result.result,
              sender: 'ai',
              timestamp: new Date(),
              thinking: result.thinking
            };
            
            // 移除处理中消息并添加AI回复
            setMessages(prev => prev.filter(msg => msg.id !== processingMessageId).concat([aiMessage]));
          } else {
            throw new Error(result.message || "处理失败");
          }
        } else {
          // 如果是新上传图片，发送图像分析请求
          console.log('开始上传图像...');
          response = await uploadAndAnalyzeImage(currentImage, text, 'description', activeChat?.id);
          console.log('图像上传成功，获取任务ID:', response.task_id);
          
          // 轮询任务结果
          console.log('开始轮询任务结果...');
          const result = await pollTaskResult(
            response.task_id, 
            3000, 
            30, 
            (attempts, maxAttempts) => {
              console.log(`轮询进度: ${attempts}/${maxAttempts}`);
              // 可以更新处理中消息，显示进度
              if (processingMessageId) {
                setMessages(prev => prev.map(msg => 
                  msg.id === processingMessageId 
                    ? {...msg, text: `正在分析图像，请稍候... (${attempts}/${maxAttempts})`}
                    : msg
                ));
              }
            }
          );
          
          console.log('轮询完成，获取结果:', result);
          
          // 添加AI回复
          const aiMessage = {
            id: Date.now() + 2,
            text: result.result || '分析完成，但未返回结果',
            sender: 'ai',
            timestamp: new Date(),
            thinking: result.thinking // 如果有思考过程，也显示出来
          };
          
          // 移除处理中消息并添加AI回复
          setMessages(prev => prev.filter(msg => msg.id !== processingMessageId).concat([aiMessage]));
          
          // 不清除当前图像，而是将其标记为已存在的图像
          if (response && response.chat_id) {
            const chatMessages = await getChatMessages(response.chat_id);
            const imageMessage = chatMessages.find(msg => msg.image_path && msg.sender === 'system');
            
            if (imageMessage) {
              // 确保图片路径格式正确
              let imagePath = imageMessage.image_path;
              if (imagePath && !imagePath.startsWith('/')) {
                imagePath = '/' + imagePath;
              }
              
              setCurrentImage({ 
                isExisting: true, 
                url: `${API_BASE_URL}${imagePath}`
              });
              console.log('图片URL设置为:', `${API_BASE_URL}${imagePath}`);
            }
          }
        }
      } else {
        // 没有当前图像对象，但可能会话中已经有图片，尝试用文本API处理
        if (activeChat) {
          try {
            // 添加处理中消息
            const processingMessage = {
              id: Date.now() + 1,
              text: '正在处理您的问题，请稍候...',
              sender: 'system',
              timestamp: new Date()
            };
            
            processingMessageId = processingMessage.id;
            setMessages(prev => [...prev, processingMessage]);
            
            // 调用文本处理API
            const result = await processTextMessage(text, activeChat.id);
            
            if (result.status === "success") {
              // 添加AI回复
              const aiMessage = {
                id: Date.now() + 2,
                text: result.result,
                sender: 'ai',
                timestamp: new Date(),
                thinking: result.thinking
              };
              
              // 移除处理中消息并添加AI回复
              setMessages(prev => prev.filter(msg => msg.id !== processingMessageId).concat([aiMessage]));
            } else {
              throw new Error(result.message || "处理失败");
            }
          } catch (error) {
            // 如果处理失败，提示用户上传图像
            if (processingMessageId) {
              setMessages(prev => prev.filter(msg => msg.id !== processingMessageId));
            }
            
            const aiMessage = {
              id: Date.now() + 1,
              text: `请先上传遥感图像以便我进行分析。`,
              sender: 'ai',
              timestamp: new Date()
            };
            setMessages(prev => [...prev, aiMessage]);
          }
        } else {
          // 没有活动聊天，提示用户
          const aiMessage = {
            id: Date.now() + 1,
            text: `请先上传遥感图像以便我进行分析。`,
            sender: 'ai',
            timestamp: new Date()
          };
          setMessages(prev => [...prev, aiMessage]);
        }
      }
    } catch (error) {
      console.error('发送消息出错:', error);
      
      // 移除处理中消息
      if (processingMessageId) {
        setMessages(prev => prev.filter(msg => msg.id !== processingMessageId));
      }
      
      // 添加错误消息
      setMessages(prev => [...prev, {
        id: Date.now() + 1,
        text: `抱歉，处理您的消息时出现了错误: ${error.message || JSON.stringify(error)}`,
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
