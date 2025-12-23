## Community Group Buying System

一个基于 Django 的社区团购系统，前端为静态页面，后端提供 REST API、WebSocket、Celery 定时任务等能力。

---

## 目录

- 1. Windows 用户指南
- 2. macOS/Linux 用户指南
- 3. 环境变量说明
- 4. 常见问题排查（FAQ）

---

## 1. Windows 用户指南

### 1-1. 基础服务准备

**A. 安装 MySQL 8.0+**
下载并安装 MySQL Community Server，创建数据库与用户：

```sql
CREATE DATABASE community_group_buying DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'cgb'@'%' IDENTIFIED BY 'Strong!Passw0rd';
GRANT ALL PRIVILEGES ON community_group_buying.* TO 'cgb'@'%';
FLUSH PRIVILEGES;
```

**B. 安装 Redis**
本系统依赖 Celery，必须安装 Redis：

- 下载 [Memurai](https://www.memurai.com/) 或 [WSL 版 Redis](https://github.com/microsoft/archive-redis)。
- 确保服务运行在 `127.0.0.1:6379`。

### 1-2. 配置项目

**A. 配置后端 (`backend/.env`)**
在 `backend` 目录下新建 `.env` 文件：

```ini
DB_ENGINE=mysql
DB_NAME=community_group_buying
DB_USER=cgb
DB_PASSWORD=Strong!Passw0rd
DB_HOST=127.0.0.1
DB_PORT=3306

DEBUG=true
ALLOWED_HOSTS=127.0.0.1,localhost
SECRET_KEY=please-change-me

# Celery & Redis
CELERY_BROKER_URL=redis://127.0.0.1:6379/0
CELERY_RESULT_BACKEND=redis://127.0.0.1:6379/1
```

**B. 构建 Python 环境**

```powershell
py -3.11 -m venv .venv
.\.venv\Scripts\Activate
python -m pip install -U pip
python -m pip install -r backend\requirements.txt
```

### 1-3. 初始化数据库

```powershell
# 1. Django 迁移
python backend\manage.py migrate

# 2. 导入核心逻辑 (关键)
Get-Content backend\db\sql\triggers.sql   | mysql -u cgb -p community_group_buying
Get-Content backend\db\sql\procedures.sql | mysql -u cgb -p community_group_buying

# 3. 注入测试数据 (可选)
mysql -u cgb -p community_group_buying -e "CALL generate_realistic_data(50, 20, 5);"
```

### 1-4. 启动服务 (需 4 个终端)

- **终端 1: Django API**
  ```powershell
  python backend\manage.py runserver
  ```
- **终端 2: Celery Worker**
  ```powershell
  .\.venv\Scripts\Activate
  cd backend
  celery -A core worker -l info -P solo
  ```
- **终端 3: Celery Beat**
  ```powershell
  .\.venv\Scripts\Activate
  cd backend
  celery -A core beat -l info
  ```
- **终端 4: 前端页面**
  ```powershell
  python -m http.server 8080 -d frontend
  ```

---

## 2. macOS/Linux 用户指南

### 2-1. 基础服务准备

**A. 安装 MySQL 8.0+**

```sql
CREATE DATABASE community_group_buying DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'cgb'@'%' IDENTIFIED BY 'Strong!Passw0rd';
GRANT ALL PRIVILEGES ON community_group_buying.* TO 'cgb'@'%';
FLUSH PRIVILEGES;
```

**B. 安装 Redis (必选)**

- **macOS**: `brew install redis && brew services start redis`
- **Linux**: `sudo apt install redis-server && sudo systemctl start redis`

### 2-2. 配置项目

**A. 配置后端 (`backend/.env`)**
在 `backend` 目录下新建 `.env` 文件：

```ini
DB_ENGINE=mysql
DB_NAME=community_group_buying
DB_USER=cgb
DB_PASSWORD=Strong!Passw0rd
DB_HOST=127.0.0.1
DB_PORT=3306

DEBUG=true
ALLOWED_HOSTS=127.0.0.1,localhost
SECRET_KEY=please-change-me

# Celery & Redis
CELERY_BROKER_URL=redis://127.0.0.1:6379/0
CELERY_RESULT_BACKEND=redis://127.0.0.1:6379/1
```

**B. 构建 Python 环境**

```bash
python3.11 -m venv .venv
source .venv/bin/activate
pip install -U pip
pip install -r backend/requirements.txt
```

### 2-3. 初始化数据库

```bash
# 1. Django 迁移
python backend\manage.py migrate

# 2. 导入核心逻辑 (关键)
mysql -u cgb -p community_group_buying < backend/db/sql/triggers.sql
mysql -u cgb -p community_group_buying < backend/db/sql/procedures.sql

# 3. 注入测试数据 (可选)
mysql -u cgb -p community_group_buying -e "CALL generate_realistic_data(50, 20, 5);"
```

### 2-4. 启动服务

```bash
# 启动后端 (自动启动 Django + Celery Worker + Beat)
./start_backend.sh

# 启动前端
./start_frontend.sh
```

---

## 3. 环境变量说明 (`backend/.env`)

```ini
DB_ENGINE=mysql
DB_NAME=community_group_buying
DB_USER=root
DB_PASSWORD=your-password
DB_HOST=127.0.0.1
DB_PORT=3306

DEBUG=true
ALLOWED_HOSTS=127.0.0.1,localhost
SECRET_KEY=please-change-me

# Celery 必填项
CELERY_BROKER_URL=redis://127.0.0.1:6379/0
CELERY_RESULT_BACKEND=redis://127.0.0.1:6379/1
```

---

## 4. 常见问题排查 (FAQ)

- **Celery 报错 "Connection refused"**

  - **必须启动 Redis 服务**。请检查 `127.0.0.1:6379` 是否可连。
  - Windows 用户请确认 Redis 已作为服务安装或手动运行 `redis-server`。

- **连接数据库失败 “Access denied”**

  - 检查 `.env` 内 `DB_USER/DB_PASSWORD` 与 MySQL 实际一致。
  - 确认用户对库 `community_group_buying` 拥有权限。

- **团购状态不更新/佣金未计算**

  - 检查 **Celery Beat** 是否运行（负责定时触发）。
  - 检查 **MySQL Triggers** 是否导入（`triggers.sql`）。

- **Celery 启动失败**
  - Windows 尝试添加 `-P solo` 参数启动 Worker。
  - 检查 Redis 是否运行。
