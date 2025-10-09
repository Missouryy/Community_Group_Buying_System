#!/bin/bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT_DIR"

VENV=.venv
PY=${VENV}/bin/python
PIP=${VENV}/bin/pip

# Output
if [ -t 1 ]; then
  RESET="\033[0m"; BOLD="\033[1m"; DIM="\033[2m";
  RED="\033[31m"; GREEN="\033[32m"; YELLOW="\033[33m"; BLUE="\033[34m"; CYAN="\033[36m";
else
  RESET=""; BOLD=""; DIM=""; RED=""; GREEN=""; YELLOW=""; BLUE=""; CYAN="";
fi
info()  { echo -e "${CYAN}🔧 $*${RESET}"; }
ok()    { echo -e "${GREEN}✅ $*${RESET}"; }
warn()  { echo -e "${YELLOW}⚠️  $*${RESET}"; }
err()   { echo -e "${RED}❌ $*${RESET}"; }

echo -e "${BOLD}🚀 开始开发环境初始化${RESET}"

if [ ! -f backend/requirements.txt ]; then
  err "backend/requirements.txt 不存在"
  exit 1
fi

if [ ! -d "$VENV" ]; then
  info "创建 Python 虚拟环境 ${DIM}($VENV)${RESET}"
  python3 -m venv "$VENV"
  ok "虚拟环境已创建"
else
  info "使用已有虚拟环境 ${DIM}($VENV)${RESET}"
fi

info "升级 pip"
"$PIP" install -U pip >/dev/null
ok "pip 已升级"

info "安装后端依赖 📦"
"$PIP" install -r backend/requirements.txt
ok "依赖安装完成"

# Ensure backend/.env exists (backend settings only load backend/.env)
if [ ! -f backend/.env ]; then
  info "生成 backend/.env 配置文件"
  cat > backend/.env <<EOF
DB_ENGINE=mysql
DB_NAME=community_group_buying
DB_USER=root
DB_PASSWORD=12345678
DB_HOST=127.0.0.1
DB_PORT=3306

# Optional:
DEBUG=true
ALLOWED_HOSTS=127.0.0.1,localhost
SECRET_KEY=please-change-me

CELERY_BROKER_URL=redis://127.0.0.1:6379/0
CELERY_RESULT_BACKEND=redis://127.0.0.1:6379/1
EOF
  ok "已创建 backend/.env (请按需修改)"
else
  info "检测到已存在 backend/.env"
fi

info "检查/创建数据库 🗄️"
"$PY" backend/scripts/create_mysql_db.py >/dev/null || true
ok "数据库检查完成"

info "应用数据库迁移 ⛏️"
"$PY" backend/manage.py makemigrations api >/dev/null || true
"$PY" backend/manage.py migrate
ok "数据库迁移完成"

echo -e "${BOLD}✨ 初始化完成${RESET}"
echo -e "${BLUE}▶ 启动后端:${RESET} ./start_backend.sh"
echo -e "${BLUE}▶ 启动前端:${RESET} ./start_frontend.sh"
echo -e "${BLUE}■ 停止服务:${RESET} ./dev_down.sh"


