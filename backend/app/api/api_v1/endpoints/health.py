from fastapi import APIRouter

router = APIRouter()

@router.get("/")
async def health_check():
    """
    健康检查端点
    """
    return {"status": "ok", "message": "服务正常运行"}
