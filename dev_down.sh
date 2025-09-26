#!/bin/bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT_DIR"

# Gracefully stop by process signatures
pkill -f "backend/manage.py runserver" || true
pkill -f "celery .* worker" || pkill -f "celery -A core worker" || true
pkill -f "celery .* beat" || pkill -f "celery -A core beat" || true
pkill -f "python3 -m http.server .* -d frontend" || pkill -f "python3 -m http.server 8080" || true

echo "[dev_down] all stopped"


