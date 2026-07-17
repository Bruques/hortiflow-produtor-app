#!/usr/bin/env bash
# Derruba backend + frontend do HortiFlow Produtor subidos por ./scripts/dev.sh.
# Uso: ./scripts/stop.sh

set -uo pipefail

BACKEND_PORT=3001
FRONTEND_PORT=5173

porta_ocupada() {
  lsof -nP -iTCP:"$1" -sTCP:LISTEN >/dev/null 2>&1
}

if pkill -f "ts-node-dev.*app.ts"; then
  echo "Backend derrubado."
else
  echo "Backend não estava rodando."
fi

if pkill -f "vite"; then
  echo "Frontend derrubado."
else
  echo "Frontend não estava rodando."
fi

sleep 1

if porta_ocupada "$BACKEND_PORT"; then
  echo "Aviso: porta $BACKEND_PORT ainda ocupada — pode ser outro processo."
fi
if porta_ocupada "$FRONTEND_PORT"; then
  echo "Aviso: porta $FRONTEND_PORT ainda ocupada — pode ser outro processo."
fi
