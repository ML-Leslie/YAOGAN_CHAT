/**
 * 后端API服务
 * 包含与后端通信的所有API调用函数
 */

// API基础URL
const API_BASE_URL = 'http://localhost:8000/api';

/**
 * 上传并分析遥感图像
 * @param {File} imageFile - 要分析的图像文件
 * @param {string} prompt - 分析提示或问题
 * @param {string} taskType - 任务类型（description, detection, segmentation）
 * @returns {Promise<Object>} - 包含任务ID的响应对象
 */
export const uploadAndAnalyzeImage = async (imageFile, prompt, taskType = 'description') => {
  try {
    const formData = new FormData();
    formData.append('file', imageFile);
    formData.append('prompt', prompt);
    formData.append('task_type', taskType);

    const response = await fetch(`${API_BASE_URL}/analyze/image`, {
      method: 'POST',
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
    const response = await fetch(`${API_BASE_URL}/tasks/${taskId}`);

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || '获取任务结果失败');
    }

    return await response.json();
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
    const response = await fetch(`${API_BASE_URL}/health`);

    if (!response.ok) {
      throw new Error('健康检查失败');
    }

    return await response.json();
  } catch (error) {
    console.error('健康检查时出错:', error);
    throw error;
  }
};

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
  maxAttempts = 60,
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

    const result = await getTaskResult(taskId);
    
    if (result.status === 'completed' || result.status === 'failed') {
      return result;
    }

    // 如果任务仍在处理中，等待然后再次轮询
    return new Promise((resolve) => {
      setTimeout(() => resolve(poll()), interval);
    });
  };

  return poll();
};
