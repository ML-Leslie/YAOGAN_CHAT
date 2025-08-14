FROM python:3.10-slim

WORKDIR /app



RUN apt update && \
    apt install -y --no-install-recommends gdal-bin libgdal-dev build-essential

COPY . .

RUN pip install --no-cache-dir -r requirements.txt && \
    mkdir -p uploads

# 暴露端口
EXPOSE 8000

# 设置环境变量
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# 启动命令
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
