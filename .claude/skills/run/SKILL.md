---
name: run
description: Sobe o backend (Express, porta 3001) e o frontend (Vite, porta 5173) do HortiFlow Produtor em background e abre o navegador em http://localhost:5173. Use sempre que precisar ver uma mudança ou feature nova rodando de verdade no app.
---

# Rodar o HortiFlow Produtor localmente

Monorepo com `backend/` (Express + ts-node-dev, porta 3001) e `frontend/` (Vite, porta 5173 — já com proxy de `/api` pro backend, então só precisa abrir o frontend).

## Comando

```bash
./scripts/dev.sh
```

O script:
1. Verifica se backend e/ou frontend já estão rodando nas portas 3001/5173 — não derruba nem duplica o que já está de pé.
2. Sobe em background o que estiver faltando, com logs em `.dev-logs/backend.log` e `.dev-logs/frontend.log`.
3. Espera os dois responderem (até 30s).
4. Abre `http://localhost:5173` no navegador padrão do sistema (comando `open` do macOS).

Rode esse comando com `run_in_background: true` no Bash — ele já cuida de deixar os processos filhos rodando em background sozinho, então a chamada retorna rápido.

## Se algo não subir

Olhe os logs antes de tentar de novo:
```bash
tail -50 .dev-logs/backend.log
tail -50 .dev-logs/frontend.log
```

Causa mais comum: porta já ocupada por um processo travado de uma sessão anterior. Pra liberar:
```bash
pkill -f "ts-node-dev.*app.ts"   # backend
pkill -f "vite"                  # frontend
```

## Parar tudo

```bash
pkill -f "ts-node-dev.*app.ts"
pkill -f "vite"
```

## Observação sobre o navegador

O script abre o navegador padrão do macOS (`open`), não o painel "Simple Browser" do VS Code. Se o usuário preferir ver dentro do próprio VS Code, sugerir o comando da paleta "Simple Browser: Show" apontando pra `http://localhost:5173` — não há como acionar isso via shell de forma confiável.
