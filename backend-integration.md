# 后端集成指南

本文档提供如何将前端与后端API集成的说明。

## 概述

遥感图像分析系统由以下部分组成：

1. React前端应用
2. Python FastAPI后端服务
3. Celery Worker处理异步任务
4. Redis作为消息代理和结果存储

## 环境设置

### 运行后端服务

1. 安装Python 3.8+和Redis
2. 进入backend目录并安装依赖:

```bash
cd backend
pip install -r requirements.txt
```

3. 配置环境变量:
   - 创建或编辑`.env`文件，设置`ZHIPUAI_API_KEY`
   - 确保Redis服务正在运行

4. 启动后端服务:

```bash
# Windows
start.bat

# Linux/Mac
chmod +x start.sh
./start.sh
```

### 使用Docker Compose

使用Docker Compose可以一键启动所有服务:

```bash
docker-compose up
```

## API集成

前端已集成API服务，主要通过`src/services/api.js`文件实现。主要功能包括：

1. 上传图像并提交分析请求
2. 轮询获取任务结果
3. 处理和显示分析结果

## 工作流程

1. 用户上传图像 → 前端存储图像并显示预览
2. 用户提问问题 → 前端将图像和问题发送到后端
3. 后端启动异步任务 → 返回任务ID
4. 前端轮询任务状态 → 显示"处理中"消息
5. 任务完成后，前端获取结果 → 显示分析结果

## 异常处理

API集成包含以下异常处理：

- 网络错误处理
- 超时处理
- 后端错误响应处理

## 部署注意事项

部署时需要注意以下几点：

1. 配置CORS允许前端域名
2. 设置适当的超时时间
3. 确保Redis服务可靠运行
4. 为智谱AI API密钥设置适当的环境变量
