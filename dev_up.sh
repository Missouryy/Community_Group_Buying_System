#!/bin/bash
set -euo pipefail

# Minimal dev starter: assumes已执行 ./dev_setup.sh 完成依赖与迁移
ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT_DIR"

VENV=.venv
PY=${VENV}/bin/python

if [ ! -d "$VENV" ] || [ ! -x "$PY" ]; then
  echo "[dev_up] 未检测到虚拟环境或依赖，请先运行: ./dev_setup.sh" >&2
  exit 1
fi

BACKEND_DIR=backend
DJANGO_PORT=8000
FRONT_PORT=8080

# 端口检测，若占用则提示并退出（避免前端 BASE 与端口不一致）
if lsof -i :${DJANGO_PORT} -sTCP:LISTEN >/dev/null 2>&1; then
  echo "[dev_up] 端口 ${DJANGO_PORT} 已被占用，请先关闭占用进程后重试 (建议执行 ./dev_down.sh)" >&2
  exit 1
fi
if lsof -i :${FRONT_PORT} -sTCP:LISTEN >/dev/null 2>&1; then
  echo "[dev_up] 端口 ${FRONT_PORT} 已被占用，请先关闭占用进程后重试 (建议执行 ./dev_down.sh)" >&2
  exit 1
fi

echo "[dev_up] starting services..."
(cd ${BACKEND_DIR} && "../$PY" manage.py runserver 0.0.0.0:${DJANGO_PORT}) &
(cd ${BACKEND_DIR} && ../${VENV}/bin/celery -A core worker -l info -P solo) &
(cd ${BACKEND_DIR} && ../${VENV}/bin/celery -A core beat -l info) &

python3 -m http.server ${FRONT_PORT} -d frontend &

echo "[dev_up] running. Backend: http://127.0.0.1:${DJANGO_PORT}  Frontend: http://127.0.0.1:${FRONT_PORT}/login.html"

# 保持前台等待子进程，便于查看日志；按 Ctrl+C 停止（或另开终端执行 ./dev_down.sh）
trap 'echo; echo "[dev_up] stopping..."; pkill -f "backend/manage.py runserver" || true; pkill -f "celery .* --workdir backend .* worker" || pkill -f "celery -A core worker" || true; pkill -f "celery .* --workdir backend .* beat" || pkill -f "celery -A core beat" || true; pkill -f "python3 -m http.server 8080" || true; exit 0' INT TERM
wait
