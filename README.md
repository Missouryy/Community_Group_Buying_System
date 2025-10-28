## Community Group Buying System

一个基于 Django 的社区团购系统，前端为静态页面，后端提供 REST API、WebSocket、Celery 定时任务等能力。

本指南覆盖 Windows 从零开始安装 MySQL 与 Python 环境，以及 macOS/Linux 的快速启动方法。

---

## 目录
- 概览与目录结构
- 环境准备
  - Windows 安装步骤（推荐）
  - macOS/Linux 快速开始
- 运行与常用命令
- 环境变量说明
- 常见问题排查（FAQ）

---

## 概览与目录结构

项目结构（节选）：

```
backend/              # Django 后端
  core/               # 项目配置（settings 等）
  api/                # 业务应用（models, views, serializers, migrations）
  manage.py
frontend/             # 前端静态资源（html / css / js）
```
```
start_backend.sh      # 后端启动脚本（macOS/Linux）
start_frontend.sh     # 前端启动脚本（macOS/Linux）
stop_all.sh           # 停止服务脚本（macOS/Linux）
```

后端主要依赖见 `backend/requirements.txt`，数据库默认使用 MySQL（通过 `PyMySQL`）。

---

## 环境准备

### Windows 安装步骤（从零开始）

1) 安装 MySQL 8（含 Workbench）
- 下载并安装 MySQL Community Server。
- 安装时选择：端口 `3306`，认证方式默认；设置并记住 root 密码。
- 安装完成后使用 Workbench 或 MySQL Shell 连接 `127.0.0.1:3306`。

创建数据库与专用账号（推荐）：

```sql
CREATE DATABASE community_group_buying DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'cgb'@'%' IDENTIFIED BY 'Strong!Passw0rd';
GRANT ALL PRIVILEGES ON community_group_buying.* TO 'cgb'@'%';
FLUSH PRIVILEGES;
```

2) 安装 Python 3.11
- 勾选 “Add Python to PATH”。

3) 创建虚拟环境并安装依赖（PowerShell 在项目根目录执行）

```powershell
cd C:\Users\<YOUR_USER>\Desktop\Community_Group_Buying_System
py -3.11 -m venv .venv
.\.venv\Scripts\Activate
python -m pip install -U pip
python -m pip install -r backend\requirements.txt
```

说明：项目已使用 `PyMySQL`，无需编译 `mysqlclient`，更适合 Windows。

4) 配置后端环境变量

在 `backend\.env` 新建：

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

# 可选：如使用 Celery/Redis，再开启
CELERY_BROKER_URL=redis://127.0.0.1:6379/0
CELERY_RESULT_BACKEND=redis://127.0.0.1:6379/1
```

`backend/core/settings.py` 会优先读取 `backend/.env` 中的以上键值。

5) 初始化数据库表并启动后端

```powershell
python backend\manage.py migrate
# 可选：创建管理员
python backend\manage.py createsuperuser
```

```
# 启动开发服务
python backend\manage.py runserver
```

访问后端：`http://127.0.0.1:8000/`

6) 启动前端（静态资源）

```powershell
python -m http.server 8080 -d frontend
```

访问前端登录页：`http://127.0.0.1:8080/login.html`

> 提示：Windows 用户无需使用仓库中的 `*.sh` 脚本，直接用上述 PowerShell 命令即可。

---

### macOS/Linux 快速开始

1) 一键初始化（可选）

```bash
./dev_setup.sh
```

脚本将：
- 创建虚拟环境 `.venv` 并安装 `backend/requirements.txt`
- 生成 `backend/.env`（如不存在）
- 执行迁移

2) 启动后端

```bash
./start_backend.sh
# 或仅启动 Django：
cd backend && ../.venv/bin/python manage.py runserver
```

3) 启动前端

```bash
./start_frontend.sh
# 或：
python3 -m http.server 8080 -d frontend
```

4) 停止所有服务

```bash
./stop_all.sh
```

> 注意：`start_backend.sh` 会尝试启动 Celery worker 与 beat，需要本机 Redis 服务（见“可选：Celery 与 Redis”）。

---

## 运行与常用命令

- 应用迁移：

```bash
python backend/manage.py migrate
```

- 创建管理员：

```bash
python backend/manage.py createsuperuser
```

- 运行测试：

```bash
python backend/manage.py test
```

- 开发后端服务：

```bash
python backend/manage.py runserver 0.0.0.0:8000
```

- 前端静态服务器：

```bash
python -m http.server 8080 -d frontend
```

---

## 环境变量说明（backend/.env）

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

# 可选：Celery/Redis
CELERY_BROKER_URL=redis://127.0.0.1:6379/0
CELERY_RESULT_BACKEND=redis://127.0.0.1:6379/1
```

在 `backend/core/settings.py` 中，若 `DB_ENGINE` 为 `mysql`/`mariadb`，则启用 MySQL。

---

## 可选：Celery 与 Redis

- 需要本机 Redis（默认 `redis://127.0.0.1:6379`）。
- 安装并启动 Redis 后，即可使用 `start_backend.sh` 同时启动 Celery worker 与 beat；Windows 建议先不启用 Celery（使用 `manage.py runserver` 即可）。

---

## 常见问题排查（FAQ）

- 连接数据库失败 “Access denied”：
  - 检查 `backend/.env` 内 `DB_USER/DB_PASSWORD` 与 MySQL 实际一致；
  - 若使用 root，确认 root 密码正确；
  - 用户是否对库 `community_group_buying` 拥有权限（见上文 GRANT）。

- “Can't connect to MySQL server”：
  - 确认 MySQL 服务运行中（Windows 服务里启动 “MySQL80”）；
  - 确认端口 `3306` 未被防火墙阻止；
  - 连接地址使用 `127.0.0.1` 而非 `localhost`（某些环境的 socket 行为不同）。

- 迁移或字符集问题：
  - 确保数据库使用 `utf8mb4 / utf8mb4_unicode_ci`；
  - 删除失败的空表后重试 `python manage.py migrate`。

- Celery 启动失败：
  - 未安装或未启动 Redis；
  - 可暂不启用 Celery，直接使用 `python backend/manage.py runserver` 进行开发。

---

## 链接
- Django 文档：`https://docs.djangoproject.com/`
- MySQL 下载：`https://dev.mysql.com/downloads/`


