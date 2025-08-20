/**
 * 后端API服务
 * 包含与后端通信的所有API调用函数
 */

import { API_CONFIG } from '../config/api';

// 从本地存储获取访问令牌
const getToken = () => localStorage.getItem('access_token');

// 清除认证信息
const clearAuthData = () => {
  localStorage.removeItem('access_token');
  localStorage.removeItem('user_info');
};

// 通用的fetch包装器，处理认证错误
const authenticatedFetch = async (url, options = {}) => {
  const token = getToken();
  
  // 添加认证头
  const headers = {
    ...options.headers,
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  const response = await fetch(url, {
    ...options,
    headers
  });
  
  // 如果是401错误，清除认证信息并抛出特殊错误
  if (response.status === 401) {
    clearAuthData();
    // 触发全局认证失败事件
    window.dispatchEvent(new CustomEvent('authenticationFailed'));
    throw new Error('AUTHENTICATION_FAILED');
  }
  
  return response;
};

/**
 * 用户登录
 * @param {string} username - 用户名
 * @param {string} password - 密码
 * @returns {Promise<Object>} - 包含访问令牌和用户信息的响应对象
 */
export const login = async (username, password) => {
  try {
    const formData = new FormData();
    formData.append('username', username);
    formData.append('password', password);

    const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.API_PREFIX}/users/token`, {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || '登录失败');
    }

    const data = await response.json();
    
    // 保存令牌和用户信息到本地存储
    localStorage.setItem('access_token', data.access_token);
    localStorage.setItem('user_info', JSON.stringify({
      id: data.user_id,
      username: data.username,
      displayName: data.display_name
    }));
    
    return data;
  } catch (error) {
    console.error('登录时出错:', error);
    throw error;
  }
};

/**
 * 用户注册
 * @param {string} username - 用户名
 * @param {string} password - 密码
 * @param {string} displayName - 显示名称
 * @returns {Promise<Object>} - 包含用户信息的响应对象
 */
export const register = async (username, password, displayName) => {
  try {
    const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.API_PREFIX}/users/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        username,
        password,
        display_name: displayName
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || '注册失败');
    }

    return await response.json();
  } catch (error) {
    console.error('注册时出错:', error);
    throw error;
  }
};

/**
 * 获取当前用户信息
 * @returns {Promise<Object>} - 用户信息
 */
export const getCurrentUser = async () => {
  try {
    const token = getToken();
    if (!token) {
      throw new Error('未登录');
    }

    const response = await authenticatedFetch(`${API_CONFIG.BASE_URL}${API_CONFIG.API_PREFIX}/users/me`);

    if (!response.ok) {
      throw new Error('获取用户信息失败');
    }

    return await response.json();
  } catch (error) {
    console.error('获取用户信息时出错:', error);
    throw error;
  }
};

/**
 * 获取用户的聊天历史
 * @returns {Promise<Array>} - 聊天历史列表
 */
export const getUserChats = async () => {
  try {
    const token = getToken();
    if (!token) {
      throw new Error('未登录');
    }

    const response = await authenticatedFetch(`${API_CONFIG.BASE_URL}${API_CONFIG.API_PREFIX}/users/chats`);

    if (!response.ok) {
      throw new Error('获取聊天历史失败');
    }

    return await response.json();
  } catch (error) {
    console.error('获取聊天历史时出错:', error);
    throw error;
  }
};

/**
 * 创建新的聊天会话
 * @param {string} title - 聊天标题
 * @returns {Promise<Object>} - 新创建的聊天会话
 */
export const createNewChat = async (title = '新对话') => {
  try {
    const token = getToken();
    if (!token) {
      throw new Error('未登录');
    }

    const response = await authenticatedFetch(`${API_CONFIG.BASE_URL}${API_CONFIG.API_PREFIX}/users/chats?title=${encodeURIComponent(title)}`, {
      method: 'POST'
    });

    if (!response.ok) {
      throw new Error('创建聊天失败');
    }

    return await response.json();
  } catch (error) {
    console.error('创建聊天时出错:', error);
    throw error;
  }
};

/**
 * 获取聊天消息
 * @param {string} chatId - 聊天ID
 * @returns {Promise<Array>} - 消息列表
 */
export const getChatMessages = async (chatId) => {
  try {
    const token = getToken();
    if (!token) {
      throw new Error('未登录');
    }

    const response = await authenticatedFetch(`${API_CONFIG.BASE_URL}${API_CONFIG.API_PREFIX}/users/chats/${chatId}/messages`);

    if (!response.ok) {
      throw new Error('获取聊天消息失败');
    }

    return await response.json();
  } catch (error) {
    console.error('获取聊天消息时出错:', error);
    throw error;
  }
};

/**
 * 删除聊天会话
 * @param {string} chatId - 聊天ID
 * @returns {Promise<Object>} - 删除结果
 */
export const deleteChat = async (chatId) => {
  try {
    const token = getToken();
    if (!token) {
      throw new Error('未登录');
    }

    const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.API_PREFIX}/users/chats/${chatId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || '删除聊天失败');
    }

    return await response.json();
  } catch (error) {
    console.error('删除聊天时出错:', error);
    throw error;
  }
};

/**
 * 上传并分析遥感图像
 * @param {File} imageFile - 要分析的图像文件
 * @param {string} prompt - 分析提示或问题
 * @param {string} taskType - 任务类型（description, detection, segmentation）
 * @param {string} chatId - 聊天会话ID（可选）
 * @returns {Promise<Object>} - 包含任务ID的响应对象
 */
export const uploadAndAnalyzeImage = async (imageFile, prompt, taskType = 'description', chatId = null) => {
  try {
    const token = getToken();
    if (!token) {
      throw new Error('未登录');
    }

    const formData = new FormData();
    formData.append('file', imageFile);
    formData.append('prompt', prompt);
    formData.append('task_type', taskType);
    if (chatId) {
      formData.append('chat_id', chatId);
    }

    const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.API_PREFIX}/analyze/image/`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || '上传图像失败');
    }

    return await response.json();
  } catch (error) {
    console.error('上传并分析图像时出错:', error);
    throw error;
  }
};

/**
 * 获取任务状态和结果
 * @param {string} taskId - 任务ID
 * @returns {Promise<Object>} - 任务状态和结果
 */
export const getTaskResult = async (taskId) => {
  try {
    console.log(`获取任务结果，任务ID: ${taskId}`);
    const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.API_PREFIX}/tasks/${taskId}/`);

    if (!response.ok) {
      const errorText = await response.text();
      let errorDetail;
      try {
        const errorData = JSON.parse(errorText);
        errorDetail = errorData.detail;
      } catch (e) {
        errorDetail = errorText;
      }
      throw new Error(errorDetail || `获取任务结果失败，状态码: ${response.status}`);
    }

    const data = await response.json();
    console.log(`获取任务成功，状态: ${data.status}`);
    return data;
  } catch (error) {
    console.error('获取任务结果时出错:', error);
    throw error;
  }
};

/**
 * 健康检查
 * @returns {Promise<Object>} - 健康状态信息
 */
export const checkHealth = async () => {
  try {
    const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.API_PREFIX}/health`);

    if (!response.ok) {
      throw new Error(`健康检查失败，状态码: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('健康检查时出错:', error);
    throw error;
  }
};

/**
 * 处理文本消息（基于已有图像上下文）
 * @param {string} prompt - 用户提问
 * @param {string} chatId - 聊天ID
 * @param {string} taskType - 任务类型（可选，默认为description，可以是mark_object表示标记物体）
 * @returns {Promise<Object>} - 处理结果
 */
export const processTextMessage = async (prompt, chatId, taskType = 'description') => {
  try {
    const token = getToken();
    if (!token) {
      throw new Error('未登录');
    }

    const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.API_PREFIX}/chat/text`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        prompt,
        chat_id: chatId,
        task_type: taskType
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || '处理文本消息失败');
    }

    return await response.json();
  } catch (error) {
    console.error('处理文本消息时出错:', error);
    throw error;
  }
};

/**
 * 异步处理文本消息（基于已有图像上下文）- 支持取消功能
 * @param {string} prompt - 用户提问
 * @param {string} chatId - 聊天ID
 * @param {string} taskType - 任务类型（可选，默认为description，可以是mark_object表示标记物体）
 * @returns {Promise<Object>} - 包含任务ID的响应对象
 */
export const processTextMessageAsync = async (prompt, chatId, taskType = 'description') => {
  try {
    const token = getToken();
    if (!token) {
      throw new Error('未登录');
    }

    const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.API_PREFIX}/chat/text-async`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        prompt,
        chat_id: chatId,
        task_type: taskType
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || '提交文本消息任务失败');
    }

    return await response.json();
  } catch (error) {
    console.error('提交文本消息任务时出错:', error);
    throw error;
  }
};

/**
 * 取消正在处理中的任务
 * @param {string} taskId - 任务ID
 * @returns {Promise<Object>} - 取消结果
 */
export const cancelTask = async (taskId) => {
  try {
    const token = getToken();
    if (!token) {
      throw new Error('未登录');
    }

    const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.API_PREFIX}/cancel/${taskId}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || '取消任务失败');
    }

    return await response.json();
  } catch (error) {
    console.error('取消任务时出错:', error);
    throw error;
  }
};

/**
 * 更新聊天标题
 * @param {string} chatId - 聊天ID
 * @param {string} title - 新的聊天标题
 * @returns {Promise<Object>} - 更新结果
 */
export const updateChatTitle = async (chatId, title) => {
  try {
    const token = getToken();
    if (!token) {
      throw new Error('未登录');
    }

    const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.API_PREFIX}/users/chats/${chatId}/title`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ title })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || '更新聊天标题失败');
    }

    return await response.json();
  } catch (error) {
    console.error('更新聊天标题时出错:', error);
    throw error;
  }
};

/**
 * 延迟函数
 * @param {number} ms - 延迟毫秒数 
 * @returns {Promise<void>}
 */
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * 轮询任务结果，直到任务完成或失败
 * @param {string} taskId - 任务ID
 * @param {number} interval - 轮询间隔（毫秒）
 * @param {number} maxAttempts - 最大尝试次数
 * @param {Function} onProgress - 进度回调函数
 * @returns {Promise<Object>} - 任务最终结果
 */
export const pollTaskResult = async (
  taskId,
  interval = 3000,
  maxAttempts = 120,
  onProgress = null
) => {
  let attempts = 0;

  const poll = async () => {
    if (attempts >= maxAttempts) {
      throw new Error('轮询超时，任务可能仍在处理中');
    }

    attempts++;
    
    if (onProgress) {
      onProgress(attempts, maxAttempts);
    }

    try {
      const result = await getTaskResult(taskId);
      
      if (result.status === 'completed' || result.status === 'failed') {
        // 任务已完成或失败，返回结果
        if (result.status === 'failed' && result.error) {
          throw new Error(`任务执行失败: ${result.error}`);
        }
        return result;
      }
      
      // 添加短暂延迟，避免连续请求
      await delay(interval);
      
      // 继续轮询
      return poll();
    } catch (error) {
      // 如果是404错误(任务不存在)，可能是任务刚开始处理，等待一会再试
      if (error.message && error.message.includes('未找到任务')) {
        console.log(`任务 ${taskId} 尚未准备好，稍后再试...`);
        await delay(interval);
        return poll();
      }
      throw error;
    }
  };

  return poll();
};
