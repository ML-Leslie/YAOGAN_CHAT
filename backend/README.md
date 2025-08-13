# 遥感图像分析后端

这是一个基于FastAPI和Celery的遥感图像分析后端服务，使用智谱AI GLM-4.5v模型进行多模态分析。

## 功能特点

- 上传并分析遥感图像
- 支持多种分析类型（描述、目标检测、分割）
- 异步处理长时间运行的分析任务
- 使用智谱AI GLM-4.5v多模态大模型进行分析
- RESTful API接口设计

## 系统要求

- Python 3.8+
- Redis服务器
- 智谱AI开放平台API密钥

## 安装

1. 克隆仓库:

```bash
git clone <repository-url>
cd <repository-directory>/backend
```

2. 安装依赖:

```bash
pip install -r requirements.txt
```

3. 配置环境变量:

编辑`.env`文件，设置必要的环境变量：

```
# API配置
API_PREFIX=/api

# 跨域配置
CORS_ORIGINS=["http://localhost:3000"]

# Redis配置
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_DB=0

# 智谱AI GLM-4.5v API配置
ZHIPUAI_API_KEY=your_zhipuai_api_key

# 文件上传配置
UPLOAD_FOLDER=uploads
MAX_CONTENT_LENGTH=16777216  # 16MB
```

## 运行

### Windows

```bash
./start.bat
```

### Linux/Mac

```bash
chmod +x start.sh
./start.sh
```

或者手动启动:

1. 启动FastAPI服务器:

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

2. 在另一个终端启动Celery Worker:

```bash
celery -A app.worker.celery_app worker --loglevel=info
```

## API文档

启动后，访问以下URL查看自动生成的API文档:

- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## API端点

### 上传并分析图像

```
POST /api/analyze/image
```

**表单参数:**
- `file`: 遥感图像文件 (必需)
- `prompt`: 分析提示或问题 (必需)
- `task_type`: 分析任务类型 (可选: description, detection, segmentation，默认: description)

**响应:**
```json
{
  "task_id": "uuid字符串",
  "status": "processing",
  "message": "图像已成功上传，分析正在进行中"
}
```

### 获取任务状态和结果

```
GET /api/tasks/{task_id}
```

**路径参数:**
- `task_id`: 任务ID (必需)

**响应:**
```json
{
  "task_id": "uuid字符串",
  "status": "completed",
  "result": "分析结果内容",
  "completed_at": 1626154800
}
```

### 健康检查

```
GET /api/health
```

**响应:**
```json
{
  "status": "ok",
  "message": "服务正常运行"
}
```

## 项目结构

```
backend/
├── app/
│   ├── api/
│   │   └── api_v1/
│   │       ├── api.py
│   │       └── endpoints/
│   │           ├── analyze.py
│   │           ├── health.py
│   │           └── tasks.py
│   ├── core/
│   │   └── config.py
│   ├── models/
│   │   └── analyze.py
│   ├── services/
│   │   └── zhipuai_service.py
│   ├── utils/
│   │   └── image_utils.py
│   └── worker/
│       ├── celery_app.py
│       └── tasks.py
├── uploads/
├── .env
├── main.py
├── requirements.txt
├── start.bat
└── start.sh
```

## 与前端集成

前端应当实现以下功能：

1. 上传图像并发送分析请求
2. 轮询任务状态直到完成
3. 显示分析结果
4. 根据任务类型渲染不同的结果（如描述文本、标注图像等）

## 许可证

[MIT License](LICENSE)
