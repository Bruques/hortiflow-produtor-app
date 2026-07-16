#!/usr/bin/env bash
# Sobe backend + frontend do HortiFlow Produtor (se ainda não estiverem rodando)
# e abre o navegador em http://localhost:5173. Uso: ./scripts/dev.sh

set -uo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/frontend"
LOG_DIR="$ROOT_DIR/.dev-logs"
mkdir -p "$LOG_DIR"

BACKEND_PORT=3001
FRONTEND_PORT=5173

porta_ocupada() {
  lsof -nP -iTCP:"$1" -sTCP:LISTEN >/dev/null 2>&1
}

if porta_ocupada "$BACKEND_PORT"; then
  echo "Backend já rodando na porta $BACKEND_PORT"
else
  echo "Subindo backend..."
  (cd "$BACKEND_DIR" && nohup npm run dev > "$LOG_DIR/backend.log" 2>&1 &)
fi

if porta_ocupada "$FRONTEND_PORT"; then
  echo "Frontend já rodando na porta $FRONTEND_PORT"
else
  echo "Subindo frontend..."
  (cd "$FRONTEND_DIR" && nohup npm run dev > "$LOG_DIR/frontend.log" 2>&1 &)
fi

echo "Aguardando os dois responderem..."
backend_ok=false
frontend_ok=false
for _ in $(seq 1 30); do
  curl -s -o /dev/null http://localhost:$BACKEND_PORT/health && backend_ok=true
  curl -s -o /dev/null http://localhost:$FRONTEND_PORT && frontend_ok=true
  if $backend_ok && $frontend_ok; then
    break
  fi
  sleep 1
done

if ! $backend_ok; then
  echo "Backend não respondeu a tempo — veja $LOG_DIR/backend.log"
fi
if ! $frontend_ok; then
  echo "Frontend não respondeu a tempo — veja $LOG_DIR/frontend.log"
fi

echo "Backend:  http://localhost:$BACKEND_PORT/health"
echo "Frontend: http://localhost:$FRONTEND_PORT"

if $frontend_ok; then
  open "http://localhost:$FRONTEND_PORT" 2>/dev/null || true
fi
