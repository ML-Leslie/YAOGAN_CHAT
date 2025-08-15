from fastapi.middleware.cors import CORSMiddleware

def setup_cors(app):
    """
    设置跨域资源共享，确保前端可以正确访问图像和API资源
    """
    origins = [
        "http://localhost",
        "http://localhost:3000",
        "http://localhost:8000",
        "*",  # 在开发环境中允许所有来源，生产环境应该限制
    ]

    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["Content-Disposition"],  # 允许前端读取内容处理头
    )
