
## 后端api文件在：

- [./backend/app/services/zhipuai_service.py](./backend/app/services/zhipuai_service.py)

---

## 环境要求
- Linux 最好，因为后端用到的redis服务在linux上安装最容易
- 前端就是 node.js（之前软件工程应该都安装了）

## 如何启动？
> - 已有docker文件，注意，如果使用docker，要注意./backend/.env 文件中 redis 服务是否需要修改

### 1. 后端
- 打开一个终端
- 进入 `backend` 目录
- 有快捷安装命令 `start.sh`，其实就是：
    - 安装python包
    - 启动Redis服务
    - 数据库是否已初始化
    - 启动FastAPI服务器
    - 启动Celery Worker
> - 我个人建议一步步来才知道哪里有问题

### 2. 前端
- 新建另外一个终端
- 进入 `src` 文件夹
- 执行：
    ```
    npm install
    npm start
    ```

### 3. 查看
- 浏览器打开：`127.0.0.1:3000`


--- 
## 附录
### redis 安装


---

## 1️⃣ Linux（Ubuntu/Debian/CentOS 等）

Redis 原生是 Linux 软件，所以在 Linux 下安装最方便。

**① 直接用包管理器安装（推荐）**

```bash
# Ubuntu/Debian
sudo apt update
sudo apt install redis-server

# CentOS / RHEL
sudo yum install redis
```

**② 启动 Redis 服务**

```bash
sudo systemctl enable redis   # 开机自启
sudo systemctl start redis    # 启动服务
```

**③ 测试是否运行正常**

```bash
redis-cli ping
# 返回 PONG 表示正常
```

---

## 2️⃣ macOS

**① 使用 Homebrew 安装**

```bash
brew install redis
```

**② 启动 Redis**

```bash
brew services start redis  # 后台启动
# 或前台运行
redis-server
```

**③ 测试**

```bash
redis-cli ping
```

---

## 3️⃣ Windows

Redis 官方从 5.x 版本以后**不再提供 Windows 版**，但可以用以下方式：

**方法 A：使用微软维护的旧版（适合学习）**

1. 下载 [Redis for Windows（msopentech版）](https://github.com/microsoftarchive/redis/releases)
2. 解压后进入目录
3. 运行：

   ```powershell
   redis-server.exe redis.windows.conf
   ```
4. 打开另一个终端：

   ```powershell
   redis-cli.exe ping
   ```

**方法 B：用 WSL（推荐）**

1. 安装 WSL（Windows Subsystem for Linux）
2. 在 WSL 里执行 Linux 安装步骤（见上面 Linux 部分）

**方法 C：Docker 运行（跨平台统一）**

```bash
docker run -d --name redis -p 6379:6379 redis
```

---

## 4️⃣ 常用操作

* **配置文件位置**：`/etc/redis/redis.conf`（Linux）或安装目录下的 `.conf`
* **修改绑定地址**（允许远程访问）：

  ```conf
  bind 0.0.0.0
  ```
* **密码设置**：

  ```conf
  requirepass your_password
  ```
* **查看 Redis 版本**：

  ```bash
  redis-server --version
  ```

