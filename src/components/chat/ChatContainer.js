import React, { useState, useRef, useEffect } from 'react';
import ChatMessage from './ChatMessage';
import ChatInput from './ChatInput';
import { uploadAndAnalyzeImage, pollTaskResult, getChatMessages, processTextMessage, processTextMessageAsync, cancelTask, updateChatTitle } from '../../services/api';
import './ChatContainer.css';
import './FunctionButtons.css';

// API基础URL - 用于构建图片完整URL
const API_BASE_URL = 'http://localhost:8000';

const ChatContainer = ({ activeChat, onFunctionSelect }) => {
  const [messages, setMessages] = useState([]);
  const [isTyping, setIsTyping] = useState(false);
  const [currentImage, setCurrentImage] = useState(null);
  const [markObjectMode, setMarkObjectMode] = useState(false); // 标记物体模式
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const [imageUploaded, setImageUploaded] = useState(false); // 记录图像是否已上传
  const [currentTaskId, setCurrentTaskId] = useState(null); // 当前正在处理的任务ID
  const [isGenerating, setIsGenerating] = useState(false); // 是否正在生成回复

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
              // 添加物体坐标和标记状态
              objectCoordinates: msg.object_coordinates,
              isObjectMark: msg.is_object_mark,
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
              // 标记图像已上传
              setImageUploaded(true);
            } else {
              // 没有找到图片，清除当前图片
              setCurrentImage(null);
              setImageUploaded(false);
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
          // 如果是认证失败，不显示错误消息，让全局处理程序处理
          if (error.message !== 'AUTHENTICATION_FAILED') {
            setMessages([{
              id: 'error',
              text: `加载消息失败: ${error.message}`,
              sender: 'system',
              error: true,
              timestamp: new Date()
            }]);
          }
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
    
    // 标记图像已上传
    setImageUploaded(true);
    
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
      text: markObjectMode ? `标记物体：${text}` : text,
      sender: 'user',
      timestamp: new Date()
    };
    
    // 如果是在标记物体模式，发送后恢复到普通模式
    if (markObjectMode) {
      setMarkObjectMode(false);
    }
    
    // 检查是否是第一条消息，如果是则更新标题
    const isFirstUserMessage = !messages.some(msg => msg.sender === 'user');
    if (isFirstUserMessage && activeChat) {
      try {
        // 使用用户的第一条消息作为标题
        await updateChatTitle(activeChat.id, text);
        
        // 更新全局聊天列表中的标题
        if (window.updateChatTitle) {
          window.updateChatTitle(activeChat.id, text);
        }
      } catch (error) {
        console.error('更新聊天标题失败:', error);
      }
    }
    
    setMessages(prev => [...prev, userMessage]);
    setIsTyping(true);
    setIsGenerating(true);
    
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
          // 如果是已有图片，则调用异步文本处理API
          console.log('使用已上传的图片进行分析...');
          
          // 调用异步文本处理API，传递标记物体模式参数
          const taskType = markObjectMode ? 'mark_object' : 'description';
          console.log(`使用任务类型: ${taskType}`);
          response = await processTextMessageAsync(text, activeChat.id, taskType);
          console.log('文本处理任务提交成功，获取任务ID:', response.task_id);
          
          // 保存当前任务ID，用于取消操作
          setCurrentTaskId(response.task_id);
          
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
          
          // 清除当前任务ID
          setCurrentTaskId(null);
          
          console.log('轮询完成，获取结果:', result);
          
          // 添加AI回复
          const aiMessage = {
            id: Date.now() + 2,
            text: result.result || '分析完成，但未返回结果',
            sender: 'ai',
            timestamp: new Date(),
            thinking: result.thinking,
            objectCoordinates: result.object_coordinates,
            isObjectMark: result.is_object_mark
          };
          
          // 移除处理中消息并添加AI回复
          setMessages(prev => prev.filter(msg => msg.id !== processingMessageId).concat([aiMessage]));
          
          // 如果是标记物体的回复，立即触发画布更新
          if (result.is_object_mark || result.object_coordinates) {
            console.log('标记物体消息已添加，触发画布更新');
            if (window.updateCanvasDisplay) {
              window.updateCanvasDisplay();
            }
          }
        } else {
          // 如果是新上传图片，发送图像分析请求
          console.log('开始上传图像...');
          const taskType = markObjectMode ? 'detection' : 'description';
          console.log(`使用任务类型: ${taskType}`);
          response = await uploadAndAnalyzeImage(currentImage, text, taskType, activeChat?.id);
          console.log('图像上传成功，获取任务ID:', response.task_id);
          
          // 保存当前任务ID，用于取消操作
          setCurrentTaskId(response.task_id);
          
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
          
          // 清除当前任务ID
          setCurrentTaskId(null);
          
          console.log('轮询完成，获取结果:', result);
          
          // 添加AI回复
          const aiMessage = {
            id: Date.now() + 2,
            text: result.result || '分析完成，但未返回结果',
            sender: 'ai',
            timestamp: new Date(),
            thinking: result.thinking, // 如果有思考过程，也显示出来
            objectCoordinates: result.object_coordinates || (markObjectMode ? result.result : null),
            isObjectMark: result.is_object_mark || markObjectMode // 优先使用服务器返回的标记，否则使用本地模式
          };
          
          // 移除处理中消息并添加AI回复
          setMessages(prev => prev.filter(msg => msg.id !== processingMessageId).concat([aiMessage]));
          
          // 如果是标记物体模式，延迟触发画布更新，确保数据被正确处理
          if (markObjectMode && window.updateCanvasDisplay) {
            console.log('检测到标记物体模式，延迟触发画布更新');
            setTimeout(() => {
              window.updateCanvasDisplay();
            }, 1000);
          }
          
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
            
            // 调用异步文本处理API
            const taskType = markObjectMode ? 'mark_object' : 'description';
            const response = await processTextMessageAsync(text, activeChat.id, taskType);
            console.log('文本处理任务提交成功，获取任务ID:', response.task_id);
            
            // 保存当前任务ID，用于取消操作
            setCurrentTaskId(response.task_id);
            
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
                      ? {...msg, text: `正在处理您的问题，请稍候... (${attempts}/${maxAttempts})`}
                      : msg
                  ));
                }
              }
            );
            
            // 清除当前任务ID
            setCurrentTaskId(null);
            
            console.log('轮询完成，获取结果:', result);
            
            // 添加AI回复
            const aiMessage = {
              id: Date.now() + 2,
              text: result.result || '处理完成，但未返回结果',
              sender: 'ai',
              timestamp: new Date(),
              thinking: result.thinking,
              objectCoordinates: result.object_coordinates,
              isObjectMark: result.is_object_mark
            };
            
            // 移除处理中消息并添加AI回复
            setMessages(prev => prev.filter(msg => msg.id !== processingMessageId).concat([aiMessage]));
            
            // 如果是标记物体的回复，立即触发画布更新
            if (result.is_object_mark || result.object_coordinates) {
              console.log('标记物体消息已添加，触发画布更新');
              if (window.updateCanvasDisplay) {
                window.updateCanvasDisplay();
              }
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
      
      // 检查是否是用户取消导致的错误
      const errorMessage = error.message || JSON.stringify(error);
      const isCanceled = errorMessage.includes('用户已取消') || errorMessage.includes('取消任务');
      
      // 添加错误消息，除非是被用户取消的
      if (!isCanceled) {
        setMessages(prev => [...prev, {
          id: Date.now() + 1,
          text: `抱歉，处理您的消息时出现了错误: ${errorMessage}`,
          sender: 'ai',
          error: true,
          timestamp: new Date()
        }]);
      }
    } finally {
      setIsTyping(false);
      setIsGenerating(false);
      setCurrentTaskId(null);
    }
  };

  // 取消生成回复
  const handleCancelGeneration = async () => {
    if (currentTaskId) {
      try {
        console.log(`正在取消任务: ${currentTaskId}`);
        await cancelTask(currentTaskId);
        console.log(`任务已取消: ${currentTaskId}`);
      } catch (error) {
        console.error('取消生成时出错:', error);
      }
    }
  };

  return (
    <div className="chat-container">
      <div className="messages-container">
        {messages.map(message => (
          <ChatMessage 
            key={message.id} 
            message={message} 
            onViewInCanvas={message.isObjectMark ? () => onFunctionSelect('canvas') : undefined} 
          />
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
          {/* 功能按钮组 */}
          <div className="function-buttons">
            <button
              className="function-button toggle-canvas-button"
              onClick={() => {
                // 通知画布更新（如果全局函数已定义）
                if (window.updateCanvasDisplay) {
                  window.updateCanvasDisplay();
                }
                // 切换画布视图
                onFunctionSelect('canvas');
              }}
            >
              画布展示
            </button>
            <button 
              className="function-button" 
              onClick={handleUploadButtonClick}
              title="上传遥感图像"
              disabled={imageUploaded} // 已上传图片后禁用按钮
            >
              上传图像
            </button>
            {/* 当markObjectMode为false时显示在按钮栏中 */}
            {!markObjectMode && (
              <button
                className={`function-button ${markObjectMode ? 'active' : ''}`}
                onClick={() => setMarkObjectMode(true)}
                title="标记物体"
                disabled={!currentImage}
              >
                标记物体
              </button>
            )}
            <input 
              type="file" 
              ref={fileInputRef}
              style={{ display: 'none' }} 
              accept="image/*"
              onChange={handleImageUpload}
            />
          </div>
        </div>
        <ChatInput 
          onSendMessage={handleSendMessage} 
          placeholder={
            markObjectMode 
              ? "请输入需要标记的物体名称..." 
              : currentImage 
                ? "请输入关于图像的问题..." 
                : "输入消息..."
          }
          markObjectMode={markObjectMode}
          onCancelMarkObject={() => setMarkObjectMode(false)}
          isGenerating={isGenerating}
          onCancelGeneration={handleCancelGeneration}
        />
      </div>
    </div>
  );
};

export default ChatContainer;
