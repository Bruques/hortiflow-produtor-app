# Mobile Task 12 — Importação de despesas e vendas por foto, PDF ou planilha (via IA)

## Objetivo

Portar pro app mobile a funcionalidade de importação por IA já existente no web (`docs/specs/24-importacao-de-lancamentos-por-ia.md`): o sócio envia foto(s) de caderno, PDF ou planilha, a IA (Gemini) sugere despesas e vendas estruturadas, e ele revisa e confirma cada uma antes de salvar. O contrato de API já existe (`POST /safras/:id/importacao/extrair`, implementado na task 24) — esta spec cobre só a tela mobile e as adaptações de UX específicas de celular/offline.

## Escopo

**Entra:**
- Tela "Importar lançamentos" no stack raiz (mesmo padrão de `NovaDespesaScreen`), acessada pelo Menu
- Captura de foto pela câmera (repetível — "tirar mais uma") e seleção de fotos já existentes na galeria (múltipla)
- Seleção de PDF ou planilha (`.pdf`, `.xlsx`, `.xls`, `.csv`) via seletor de arquivos do sistema — dependência nova, `expo-document-picker`
- Chamada ao mesmo endpoint `POST /safras/:id/importacao/extrair` já existente
- Tela de revisão com os mesmos campos do web: tipo (despesa/venda), data, categoria, quem bancou, rateio (padrão/exclusivo/personalizado), valor ou quantidade/preço/unidade/comprador, selo de confiança, opção de anexar a foto como comprovante, descartar linha, e botão fixo "Adicionar" pra completar lançamento que a IA deixou de fora (mesmo ajuste do adendo 2026-09-09 da spec 24)
- Aviso de que a IA pode deixar lançamento de fora (mesmo texto/lugar do web)
- Confirmação reaproveitando as funções já existentes `criarDespesa`/`criarVenda` da fila de sincronização offline (`despesasQueue.ts`/`vendasQueue.ts`) — nenhuma lógica de fila nova

**Fica de fora (não implementar nesta task):**
- Qualquer mudança no backend ou no contrato de `POST /safras/:id/importacao/extrair` — é o mesmo endpoint da task 24, sem alteração
- Rodar a extração por IA offline — é estruturalmente impossível (a chamada precisa de internet pra falar com o Gemini); ver "Comportamento offline" abaixo
- Rascunho persistido localmente (SQLite) entre sessões — mesma decisão da spec 24 (web): o resultado da extração vive só em memória da tela enquanto o app está aberto nela. Sair da tela de revisão (voltar, fechar o app) descarta o progresso, igual ao web
- Suporte a HEIC — mesma limitação da task 24 (API da Claude não aceita; aqui nem se aplica, já que a foto da câmera do Expo já sai em JPEG)

## Regras de negócio

### Captura de arquivos

- **Câmera**: reaproveita o mesmo padrão de `NovaDespesaScreen` (`ImagePicker.launchCameraAsync({ mediaTypes: ['images'], base64: true, quality: 0.5 })`), mas repetível — cada toque em "Tirar foto" adiciona mais uma à lista, sem substituir as anteriores
- **Galeria**: `ImagePicker.launchImageLibraryAsync({ base64: true, allowsMultipleSelection: true })` — permite escolher várias fotos já tiradas de uma vez
- **PDF/planilha**: `expo-document-picker` (nova dependência — abre o seletor de arquivos nativo do sistema, incluindo Google Drive/arquivos baixados; devolve uma URI local que precisa ser lida como base64 via `expo-file-system`, já que o document-picker não devolve base64 direto como o image-picker devolve)
- Mesma regra de mistura da spec 24: não dá pra combinar planilha com foto/PDF no mesmo envio — escolher um tipo desabilita/limpa o outro

### Comportamento offline

- Igual ao resto do app mobile (ver `docs/specs/mobile/00-setup-e-infra.md`): antes de chamar a extração, o app checa conexão. Sem internet, mostra aviso claro ("Sem conexão — a leitura por IA precisa de internet") e não deixa tentar, em vez de travar ou dar erro genérico
- Depois que a extração retornar (o que exige estar online), a **confirmação** dos lançamentos revisados não precisa mais de internet: como `criarDespesa`/`criarVenda` já gravam otimisticamente no cache local e enfileiram pra sincronizar depois, o sócio pode revisar offline (se a conexão cair depois da extração) e confirmar — os lançamentos entram na fila normal e sincronizam quando a conexão voltar, sem tela de retry parcial (diferente do web, que precisa desse retry porque chama a rede direto)

### Revisão

- Mesmos campos e regras de validação da spec 24 (web), adaptados pros componentes visuais já usados nas telas mobile de despesa/venda (chips de sócio, seletor de tipo, `DateSelectorChip` equivalente do mobile, etc. — ver `NovaDespesaScreen.tsx`/`NovaVendaScreen.tsx` como referência de componente)
- Botão "Adicionar" fixo no topo da lista de revisão (mesmo raciocínio do adendo 2026-09-09: em foto com muitos lançamentos, o scroll fica longo)
- Aviso fixo sobre a IA poder deixar lançamento de fora, mesmo texto do web

## Contrato de API

Nenhum — reaproveita `POST /safras/:id/importacao/extrair` já implementado na task 24, sem mudança de shape.

## Critérios de aceite

1. Sem conexão, ao tentar abrir a tela de importação ou tocar em "Analisar com IA", o app mostra aviso claro de que precisa de internet, sem travar
2. Com conexão, tirar 2 fotos seguidas da câmera e enviar pra extração retorna os lançamentos sugeridos das duas fotos juntas
3. Escolher fotos da galeria (múltiplas) funciona como alternativa à câmera
4. Escolher um PDF ou planilha do seletor de arquivos do sistema funciona e não pode ser combinado com foto no mesmo envio
5. Tela de revisão mostra os mesmos campos e mesma validação do web (rateio, quem bancou, categoria, confiança, etc.)
6. Botão "Adicionar" cria uma linha em branco editável no topo da lista
7. Confirmar os lançamentos revisados **funciona mesmo se a conexão cair depois da extração** — cada despesa/venda entra na fila de sincronização offline existente e aparece no cache local imediatamente, sincronizando de verdade quando a conexão voltar
8. Nenhuma mudança de comportamento no backend nem no app web
