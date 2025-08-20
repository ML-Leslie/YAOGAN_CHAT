/**
 * 任务轮询Hook
 * 提供统一的任务轮询功能
 */

import { useState, useCallback } from 'react';
import { pollTaskResult } from '../services/api';

export const useTaskPolling = () => {
  const [isPolling, setIsPolling] = useState(false);
  const [currentTaskId, setCurrentTaskId] = useState(null);

  /**
   * 轮询任务结果，带进度回调
   * @param {string} taskId - 任务ID
   * @param {number} interval - 轮询间隔（毫秒）
   * @param {number} maxAttempts - 最大尝试次数
   * @param {Function} onProgress - 进度回调函数
   * @returns {Promise<Object>} - 任务最终结果
   */
  const pollTaskWithProgress = useCallback(async (
    taskId,
    interval = 3000,
    maxAttempts = 120,
    onProgress = null
  ) => {
    // 直接使用 api.js 中的 pollTaskResult 函数，它已经包含了进度回调逻辑
    return await pollTaskResult(taskId, interval, maxAttempts, onProgress);
  }, []);

  /**
   * 开始轮询任务
   * @param {string} taskId - 任务ID
   * @param {Function} onProgress - 进度回调函数
   * @returns {Promise<Object>} - 任务结果
   */
  const startPolling = useCallback(async (taskId, onProgress = null) => {
    setCurrentTaskId(taskId);
    setIsPolling(true);
    
    try {
      const result = await pollTaskWithProgress(taskId, 3000, 120, onProgress);
      return result;
    } finally {
      setIsPolling(false);
      setCurrentTaskId(null);
    }
  }, [pollTaskWithProgress]);

  /**
   * 取消当前轮询
   */
  const cancelPolling = useCallback(() => {
    setIsPolling(false);
    setCurrentTaskId(null);
  }, []);

  return {
    isPolling,
    currentTaskId,
    startPolling,
    cancelPolling,
    pollTaskWithProgress
  };
};

export default useTaskPolling;