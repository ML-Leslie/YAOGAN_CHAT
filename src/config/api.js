/**
 * API配置文件
 * 统一管理所有API相关的配置
 */

// API基础配置
export const API_CONFIG = {
  BASE_URL: 'http://localhost:8000',
  API_PREFIX: '/api',
  TIMEOUT: 30000, // 30秒超时
};

// 构建完整的API URL
export const getApiUrl = (endpoint) => {
  return `${API_CONFIG.BASE_URL}${API_CONFIG.API_PREFIX}${endpoint}`;
};

// 构建完整的图片URL
export const getImageUrl = (imagePath) => {
  if (!imagePath) return '';
  
  // 如果已经是完整URL或blob URL，直接返回
  if (imagePath.startsWith('http') || imagePath.startsWith('blob:')) {
    return imagePath;
  }
  
  // 确保路径格式正确
  let formattedPath = imagePath;
  if (!formattedPath.startsWith('/')) {
    formattedPath = '/' + formattedPath;
  }
  
  return `${API_CONFIG.BASE_URL}${formattedPath}`;
};

// API端点配置
export const API_ENDPOINTS = {
  // 用户相关
  LOGIN: '/users/token',
  REGISTER: '/users/register',
  GET_CURRENT_USER: '/users/me',
  GET_USER_CHATS: '/users/chats',
  CREATE_CHAT: '/users/chats',
  DELETE_CHAT: '/users/chats',
  UPDATE_CHAT_TITLE: '/users/chats',
  GET_CHAT_MESSAGES: '/users/chats/messages',
  
  // 分析相关
  ANALYZE_IMAGE: '/analyze/image',
  ANALYZE_IMAGE_URL: '/analyze/image/url',
  GET_TASK_RESULT: '/tasks',
  CANCEL_TASK: '/cancel',
  
  // 聊天相关
  PROCESS_TEXT: '/chat/text',
  PROCESS_TEXT_ASYNC: '/chat/text-async',
  
  // 健康检查
  HEALTH: '/health',
};

export default API_CONFIG;