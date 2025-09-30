#!/bin/bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT_DIR"

BACKEND_DIR=backend
DJANGO_PORT=${DJANGO_PORT:-8000}
# Pretty output (colors + emojis)
if [ -t 1 ]; then
  RESET="\033[0m"; BOLD="\033[1m"; DIM="\033[2m";
  RED="\033[31m"; GREEN="\033[32m"; YELLOW="\033[33m"; BLUE="\033[34m"; CYAN="\033[36m";
else
  RESET=""; BOLD=""; DIM=""; RED=""; GREEN=""; YELLOW=""; BLUE=""; CYAN="";
fi
info()  { echo -e "${CYAN}🧰 $*${RESET}"; }
ok()    { echo -e "${GREEN}✅ $*${RESET}"; }
warn()  { echo -e "${YELLOW}⚠️  $*${RESET}"; }
err()   { echo -e "${RED}❌ $*${RESET}"; }

echo -e "${BOLD}🚀 启动后端服务${RESET}"

VENV=.venv
VENV_DIR="$ROOT_DIR/$VENV"
if [ -x "$VENV_DIR/bin/python" ]; then
  PY="$VENV_DIR/bin/python"
else
  PY="python3"
fi

if [ -x "$VENV_DIR/bin/celery" ]; then
  CELERY="$VENV_DIR/bin/celery"
else
  CELERY="celery"
fi

# 选择可用端口（若被占用则向上找空闲端口，最多尝试 +20）
find_free_port() {
  local base_port=$1
  local max_port=$2
  local port=$base_port
  while lsof -i :${port} -sTCP:LISTEN >/dev/null 2>&1; do
    port=$((port+1))
    if [ ${port} -gt ${max_port} ]; then
      return 1
    fi
  done
  echo -n ${port}
}

ORIG_DJANGO_PORT=${DJANGO_PORT}

DJANGO_PORT=$(find_free_port ${DJANGO_PORT} $((ORIG_DJANGO_PORT+20))) || {
  err "未找到可用的后端端口（从 ${ORIG_DJANGO_PORT} 起最多尝试 +20）"
  exit 1
}
[ "${DJANGO_PORT}" != "${ORIG_DJANGO_PORT}" ] && warn "后端端口被占用，已改用 ${DJANGO_PORT}"

info "启动 Celery 进程…"
(
  cd ${BACKEND_DIR}
  "$CELERY" -A core worker -l info -P solo
) &
celery_worker_pid=$!
(
  cd ${BACKEND_DIR}
  "$CELERY" -A core beat -l info
) &
celery_beat_pid=$!
ok "Celery 已启动 (worker: ${celery_worker_pid}, beat: ${celery_beat_pid})"

cleanup() {
  info "停止 Celery…"
  kill ${celery_worker_pid} ${celery_beat_pid} >/dev/null 2>&1 || true
  wait ${celery_worker_pid} ${celery_beat_pid} 2>/dev/null || true
}
trap cleanup EXIT INT TERM

echo -e "${BOLD}🌐 后端地址:${RESET} http://127.0.0.1:${DJANGO_PORT}"
(
  cd ${BACKEND_DIR}
  exec "$PY" manage.py runserver 0.0.0.0:${DJANGO_PORT}
)