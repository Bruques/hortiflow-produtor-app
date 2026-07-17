---
name: stop
description: Derruba o backend e o frontend do HortiFlow Produtor subidos pela skill /run. Use quando o desenvolvedor pedir pra parar o app rodando localmente.
---

# Parar o HortiFlow Produtor rodando localmente

Contraparte da skill `run`: derruba os processos de backend (porta 3001) e frontend (porta 5173) subidos por `./scripts/dev.sh`.

## Comando

```bash
./scripts/stop.sh
```

O script:
1. Mata o processo do backend (`ts-node-dev`) e do frontend (`vite`) via `pkill`.
2. Avisa se alguma das portas 3001/5173 continuar ocupada depois disso (sinal de que é outro processo, não o do dev.sh).

Não precisa de `run_in_background` — o script termina sozinho, não fica de pé.
