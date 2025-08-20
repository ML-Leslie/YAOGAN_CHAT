import React, { useState, useEffect } from 'react';
import ImageCanvas from '../ImageCanvas';
import { getChatMessages } from '../../services/api';
import { getImageUrl } from '../../config/api';
import './CanvasDisplay.css';

// 创建一个自定义事件用于通知画布更新
const canvasUpdateEvent = new CustomEvent('canvasUpdate');

// 暴露一个全局函数，用于在点击"在画布中查看"时触发更新
window.updateCanvasDisplay = function() {
  document.dispatchEvent(canvasUpdateEvent);
};

const CanvasDisplay = ({ width, height, onClose, activeChat }) => {
  // 直接使用ImageCanvas，不再需要模式切换
  const [objectCoordinates, setObjectCoordinates] = useState(null);
  const [imageUrl, setImageUrl] = useState(null);
  const [updateTrigger, setUpdateTrigger] = useState(0); // 用于触发重新加载
  

  // 监听自定义事件，当点击"在画布中查看"按钮时触发
  useEffect(() => {
    const handleCanvasUpdate = () => {
      // 增加更新触发器计数，这将触发重新加载
      setUpdateTrigger(prev => prev + 1);
    };
    
    // 添加事件监听器
    document.addEventListener('canvasUpdate', handleCanvasUpdate);
    
    // 清理函数
    return () => {
      document.removeEventListener('canvasUpdate', handleCanvasUpdate);
    };
  }, []);

  // 加载标记对象数据
  useEffect(() => {
    const loadObjectData = async () => {
      if (activeChat) {
        try {
          console.log('加载聊天ID的消息:', activeChat.id);
          const messages = await getChatMessages(activeChat.id);
          console.log('获取到的消息:', messages);
          
          // 找到最新的系统图片消息
          const lastImageMessage = [...messages]
            .reverse()
            .find(msg => (msg.sender === 'system' && msg.image_path) || 
                          (msg.sender === 'system' && msg.text && msg.text.includes('已上传图像')));
          
          // 找到所有物体标记消息（不只是最新的）
          // 同时，考虑消息文本可能包含JSON结构的情况
          const allObjectMarkMessages = messages
            .filter(msg => {
              // 检查是否有明确标记
              const hasExplicitMark = (msg.is_object_mark === true || msg.object_coordinates) && msg.sender === 'ai';
              
              // 如果没有明确标记，检查文本是否包含坐标格式
              if (!hasExplicitMark && msg.sender === 'ai' && msg.text) {
                // 检查文本是否包含可能的坐标JSON
                const containsBbox = msg.text.includes('"bbox"') || msg.text.includes("'bbox'");
                const containsLabel = msg.text.includes('"label"') || msg.text.includes("'label'");
                const containsJsonBraces = msg.text.includes('{') && msg.text.includes('}');
                
                return containsBbox && containsLabel && containsJsonBraces;
              }
              
              return hasExplicitMark;
            })
            .reverse(); // 确保最新的消息在前面
          
          console.log('最新图像消息:', lastImageMessage);
          console.log('找到的物体标记消息数量:', allObjectMarkMessages.length);
          
          // 设置图片URL
          if (lastImageMessage) {
            if (lastImageMessage.image_path) {
              const imagePath = lastImageMessage.image_path;
              const fullImageUrl = getImageUrl(imagePath);
              console.log('设置图像URL:', fullImageUrl);
              setImageUrl(fullImageUrl);
            } else {
              // 查找后续消息中的图像URL
              const systemMessages = messages.filter(msg => msg.sender === 'system');
              for (const msg of systemMessages) {
                if (msg.image_path) {
                  const imagePath = msg.image_path;
                  const fullImageUrl = getImageUrl(imagePath);
                  console.log('从其他系统消息找到图像URL:', fullImageUrl);
                  setImageUrl(fullImageUrl);
                  break;
                }
              }
            }
          }
          
          // 合并所有标记消息的坐标
          if (allObjectMarkMessages.length > 0) {
            // 创建一个数组来存储所有解析出的坐标数据
            const allCoordinates = [];
            
            // 处理每个标记消息
            for (const markMessage of allObjectMarkMessages) {
              console.log('处理标记消息:', markMessage.id);
              
              // 尝试获取坐标数据
              let messageCoordinates = null;
              
              if (markMessage.object_coordinates) {
                // 直接从对象中获取坐标
                messageCoordinates = markMessage.object_coordinates;
                console.log('从对象属性获取坐标');
              } else if (markMessage.is_object_mark) {
                // 尝试从文本内容提取JSON
                const text = markMessage.text || '';
                
                try {
                  // 查找JSON格式的内容
                  const jsonRegex = /(\{.*\}|\[.*\])/s;
                  const match = text.match(jsonRegex);
                  if (match) {
                    messageCoordinates = match[0];
                    console.log('从文本提取坐标');
                  }
                } catch (e) {
                  console.error('从文本提取坐标时出错:', e);
                }
              }
              
              // 如果成功获取到了坐标数据，添加到合并列表
              if (messageCoordinates) {
                try {
                  // 解析坐标数据
                  let parsedCoordinates;
                  
                  if (typeof messageCoordinates === 'string') {
                    try {
                      // 尝试直接解析
                      parsedCoordinates = JSON.parse(messageCoordinates);
                    } catch (jsonError) {
                      // 如果解析失败，尝试提取JSON部分
                      console.log('直接解析字符串失败，尝试提取JSON部分');
                      const jsonRegex = /(\{.*\}|\[.*\])/s;
                      const match = messageCoordinates.match(jsonRegex);
                      if (match) {
                        parsedCoordinates = JSON.parse(match[0]);
                        console.log('成功提取并解析JSON部分');
                      } else {
                        console.error('无法提取JSON部分');
                      }
                    }
                  } else {
                    parsedCoordinates = messageCoordinates;
                  }
                  
                  // 将坐标转换为标准格式并添加到列表
                  if (Array.isArray(parsedCoordinates)) {
                    // 如果是单个坐标数组 [x1, y1, x2, y2]
                    if (parsedCoordinates.length >= 4 && typeof parsedCoordinates[0] === 'number') {
                      allCoordinates.push({
                        bbox: parsedCoordinates,
                        label: `对象 ${allCoordinates.length + 1}`
                      });
                    } else {
                      // 多个对象的数组，每个都添加
                      for (const coord of parsedCoordinates) {
                        if (coord) allCoordinates.push(coord);
                      }
                    }
                  } else if (parsedCoordinates && typeof parsedCoordinates === 'object') {
                    // 单个对象
                    allCoordinates.push(parsedCoordinates);
                  }
                  
                  console.log(`已添加坐标数据，当前总数: ${allCoordinates.length}`);
                } catch (parseError) {
                  console.error('解析坐标数据失败:', parseError);
                }
              }
            }
            
            // 设置合并后的坐标
            if (allCoordinates.length > 0) {
              console.log(`设置合并后的 ${allCoordinates.length} 个坐标:`, allCoordinates);
              setObjectCoordinates(allCoordinates);
            } else {
              console.warn('未找到有效的坐标数据');
              setObjectCoordinates(null);
            }
          } else {
            console.log('没有找到物体标记消息');
            setObjectCoordinates(null);
          }
        } catch (error) {
          console.error('加载对象数据失败:', error);
        }
      }
    };
    
    loadObjectData();
  }, [activeChat, updateTrigger]); // 添加updateTrigger到依赖数组中，这样当它变化时会触发重新加载

  return (
    <div className="canvas-display">
      <div className="canvas-content">
        <ImageCanvas 
          width={width} 
          height={height} 
          initialImageUrl={imageUrl}
          objectCoordinates={objectCoordinates}
        />
      </div>
    </div>
  );
};

export default CanvasDisplay;
