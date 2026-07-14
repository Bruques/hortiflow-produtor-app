# Task 7 — Polimento mobile

## Objetivo

Ajustar a experiência das telas já existentes (todas as funcionalidades do MVP já estão implementadas) para uso real por produtor rural no celular: navegação mais direta entre as seções da safra, captura de foto de comprovante direto pela câmera, áreas de toque maiores e feedback de carregamento mais claro em conexão instável. Não é uma task de features novas — é polimento do que já existe, levantado a partir de uma revisão do código atual do frontend e de uma navegação real do app (com dados de teste) simulando o uso no celular.

Essa revisão prática mostrou um segundo eixo de problema, além dos técnicos: várias telas falam a língua do sistema, não a língua de quem nunca usou um app — categorias aparecem em código interno (`ADUBO`, `MAO_DE_OBRA`, `FINANCIADOR`), datas usam formato americano, cards clicáveis não parecem clicáveis, e nenhuma tela confirma que uma ação deu certo. Para o público do produto — produtor que vem de papel/caneta ou de planilha simples, não de outros aplicativos — isso é tão importante quanto os ajustes técnicos de toque/câmera/navegação, e por isso entra nesta mesma task em vez de virar uma task 8 separada.

## Escopo

**Entra:**

1. **Navegação estruturada (bottom nav)** — menu inferior fixo com atalhos para as seções da safra ativa (Despesas, Vendas, Simulação, Acertos, Pessoal), substituindo a navegação atual por link solto + "Voltar" a cada troca de seção
2. **Foto de comprovante via câmera** — no formulário de despesa da sociedade, campo de anexo que abre a câmera do celular direto (`capture="environment"`), com preview da foto antes de salvar; usa o campo `foto_comprovante` que já existe no schema desde a task 3
3. **Áreas de toque maiores** — botões de ação secundária (editar, excluir, ativar/desativar, confirmar sugestão de despesa recorrente) sobem do tamanho pequeno atual para o tamanho padrão, especialmente quando aparecem lado a lado
4. **Feedback de carregamento inicial** — todas as listas (despesas, vendas, acertos, safras) mostram um estado de "carregando" explícito antes de decidir entre lista preenchida ou "nenhum ... ainda", evitando que a tela pareça vazia por engano numa conexão de campo mais lenta
5. **Header fixo (sticky)** — título da tela permanece visível ao rolar listas longas
6. **Espaçamento de área segura (safe-area)** — bottom nav e botões finais de tela respeitam `env(safe-area-inset-bottom)`, para não colar na borda inferior em aparelhos com barra de gestos/notch
7. **Legibilidade de valores financeiros** — números que representam resultado (percentual aplicado, valor a receber, despesas bancadas) sobem de fonte pequena para tamanho legível ao sol/de relance
8. **Rótulos em português natural para todo enum exibido ao usuário** — tipo de despesa (`ADUBO` → "Adubo", `MAO_DE_OBRA` → "Mão de obra" etc.), papel do sócio (`FINANCIADOR` → "Financiador", `MEEIRO` → "Meeiro", `MISTO` → "Misto"), tipo de acerto (`PARCIAL` → "Parcial", `FINAL` → "Final (encerra a safra)") — só na exibição, sem mudar nomes de enum no banco/API
9. **Indicação visual de que um card é clicável** — cards que navegam para outra tela (sociedade na Home, safra em Safras) ganham um indicador de toque (ex. seta/chevron), diferenciando visualmente de cards que só exibem informação
10. **Campo de data em formato explícito dd/mm/aaaa** — substitui o `<input type="date">` nativo (que mostra `mm/dd/yyyy` independente do idioma do app, testado e confirmado) por um campo com máscara/formato brasileiro claro em todas as telas que lançam data (Despesas, Despesas Pessoais, Vendas, Acertos)
11. **Confirmação antes de excluir** — qualquer ação destrutiva (excluir despesa pessoal, por ora a única exclusão do MVP) pede confirmação antes de executar
12. **Frase curta de apoio no topo de cada tela** — uma linha explicando o conceito da tela em linguagem simples, no mesmo estilo já usado em Despesas Pessoais ("Visível só para você — não entra na divisão da sociedade"), estendido para Sócios (o que é percentual de lucro), Regras Recorrentes (o que é uma regra) e Acertos (o que é um acerto)
13. **Mensagem de sucesso após salvar** — toda ação de criar/editar (despesa, despesa pessoal, venda, regra, acerto, percentuais) mostra uma confirmação visível breve (ex. "Despesa lançada!") após o formulário salvar, além de limpar/atualizar a lista
14. **Corrigir dependência frágil de query param em Despesas** — hoje o formulário de "Lançar despesa" em `DespesasPage` só aparece se a URL tiver `?sociedadeId=...`; ao introduzir o bottom nav (item 1), a sociedade/safra ativa passa a vir de um estado de navegação confiável (contexto/rota), não de um parâmetro solto — resolvendo o formulário sumir silenciosamente

**Fica de fora (não implementar nesta task):**

- Upload de foto para storage externo (S3 etc.) — a foto continua guardada como string no campo `foto_comprovante` (agora uma imagem em base64 em vez de vazio/URL manual); migrar para storage de verdade é decisão de infraestrutura separada, fora do escopo de polimento de UX
- Retry automático / fila de reenvio em caso de erro de rede — mantém o tratamento de erro atual (mensagem + o usuário tenta de novo manualmente)
- PWA/instalável, ícone de tela inicial, modo offline — é Fase 2 (app nativo), conforme CLAUDE.md
- Skeleton animado sofisticado — o estado de carregamento é um texto simples ("Carregando..."), não uma animação de placeholder
- Redesenho visual (cores, tema, ícones novos) além do necessário para os itens acima
- Foto de comprovante em Despesa Pessoal — o MVP nunca previu esse campo pra despesa pessoal (só pra despesa da sociedade); não é adicionado aqui
- Onboarding/tutorial guiado (tour de primeira vez, tooltips interativos) — a frase de apoio por tela (item 12) resolve o essencial sem esse investimento maior
- Suporte a múltiplos idiomas — só português, como já é hoje
- Correção/glossário editável pelo usuário (customizar os próprios rótulos) — os rótulos em português (item 8) são fixos, definidos no código

## Regras de negócio / comportamento esperado

### Bottom nav
- Só aparece quando existe uma safra ativa no contexto de navegação (ou seja, dentro das telas de Despesas, Vendas, Simulação, Acertos, Pessoal). Não aparece em Login, lista de Sociedades, Criar/Entrar em Sociedade, ou lista de Safras.
- 5 itens fixos: Despesas, Vendas, Simulação, Acertos, Pessoal. O item da tela atual fica destacado.
- Trocar de item navega direto para a rota da respectiva seção da mesma safra ativa, sem passar por telas intermediárias.
- Sai da estrutura de bottom nav ao voltar explicitamente para a lista de Safras/Sociedades (ação separada, não fica dentro do menu inferior).

### Foto de comprovante
- Campo opcional no formulário de nova despesa da sociedade (mantém a regra existente da task 3: campo já é opcional).
- Input de arquivo com `accept="image/*"` e `capture="environment"`, abrindo a câmera traseira por padrão em celular (em desktop cai para seletor de arquivo normal, sem erro).
- Ao escolher/tirar a foto, mostra preview miniatura antes de confirmar o envio; usuário pode remover e tirar outra antes de salvar.
- Envio: a imagem é convertida para base64 e enviada como string no campo `foto_comprovante` já existente — nenhuma mudança de contrato de API/schema.
- Sem limite de compressão nesta task (se o tamanho do payload virar problema real de performance depois, é ajuste futuro, não motivo pra travar esta task agora).

### Áreas de toque
- Botões de ação em listas (editar, excluir, ativar/desativar, confirmar sugestão) usam o tamanho padrão do componente `Button` (não mais `size="sm"`).
- Quando dois botões aparecem lado a lado (ex. editar/excluir de despesa pessoal), cada um ocupa metade da largura disponível (`flex-1` ou equivalente), não largura mínima do texto.

### Loading inicial
- Toda tela que busca uma lista via `useEffect` mostra um texto de carregamento enquanto a requisição não resolveu, e só decide entre "lista preenchida" ou "nenhum ... ainda" depois que a resposta chegar.

### Rótulos em português
- Um único mapa de tradução por enum (tipo de despesa, papel do sócio, tipo de acerto), usado em todo lugar que hoje exibe o valor cru — formulários (`<option>`), listas e telas de detalhe/extrato.
- O valor enviado pra API continua sendo o enum original (`ADUBO`, `FINANCIADOR` etc.) — só a exibição muda.

### Indicação de card clicável
- Cards que são links de navegação (sociedade em Home, safra em Safras) recebem um indicador visual (ex. seta/chevron) alinhado à direita, para diferenciar de cards que só exibem dado (ex. resumo de receita/despesa em Simulação, que não navega pra lugar nenhum).

### Campo de data
- Um único componente de data reutilizado nas quatro telas que lançam data, exibindo/aceitando sempre no formato dia/mês/ano, independente da configuração do aparelho.
- Continua enviando pra API no mesmo formato de string de data já usado hoje (sem mudança de contrato).

### Confirmação antes de excluir
- Ao tocar em "Excluir" (despesa pessoal), aparece uma confirmação (ex. modal simples ou `window.confirm`) antes de disparar a chamada de exclusão; cancelar não faz nada.

### Frase de apoio por tela
- Uma linha de texto curta (uma frase, sem jargão) abaixo do título nas telas de Sócios, Regras Recorrentes e Acertos, explicando o conceito central daquela tela em português simples.

### Mensagem de sucesso
- Após qualquer criação/edição bem-sucedida (despesa, despesa pessoal, venda, regra recorrente, acerto, percentuais de sócio), uma mensagem breve de confirmação aparece na tela (ex. texto temporário acima ou abaixo do formulário), além da lista/estado já atualizar como acontece hoje.

## Critérios de aceite

1. Dentro de uma safra ativa, é possível navegar entre Despesas, Vendas, Simulação, Acertos e Pessoal usando o menu inferior, sem precisar voltar para a tela de Safra a cada troca
2. O bottom nav não aparece nas telas de Login, lista de Sociedades, Criar/Entrar em Sociedade e lista de Safras
3. No formulário de nova despesa da sociedade, é possível anexar uma foto que abre a câmera do celular (testável no navegador mobile/emulador), ver o preview antes de salvar, e a despesa salva é listada com a foto associada
4. Despesa da sociedade sem foto continua funcionando normalmente (campo continua opcional)
5. Botões de editar/excluir/ativar-desativar/confirmar sugestão não usam mais `size="sm"`; quando lado a lado, dividem a largura igualmente
6. Ao abrir uma tela de lista (Despesas, Vendas, Acertos, Safras) com a rede lenta, aparece um texto de carregamento antes de decidir entre lista ou "nenhum ... ainda" — nunca mostra "nenhum ... ainda" prematuramente
7. Título de cada tela de lista permanece visível ao rolar a lista para baixo
8. Bottom nav e botão final de cada tela não ficam colados na borda inferior em um iPhone com barra de gestos (respeitam safe-area)
9. Valores de percentual aplicado, valor a receber e despesas bancadas em `AcertoDetalhePage` e `SimulacaoPage` estão em tamanho de fonte legível (não `text-xs`)
10. Nenhuma tela mostra tipo de despesa, papel de sócio ou tipo de acerto em texto cru de enum (`ADUBO`, `FINANCIADOR`, `PARCIAL`) — sempre em português legível, tanto em formulários quanto em listas
11. O card de sociedade na Home e o card de safra em Safras têm um indicador visual de que são clicáveis
12. Os campos de data de Despesas, Despesas Pessoais, Vendas e Acertos mostram e aceitam formato dia/mês/ano, sem depender da configuração regional do aparelho
13. Excluir uma despesa pessoal pede confirmação antes de remover; cancelar mantém a despesa
14. As telas de Sócios, Regras Recorrentes e Acertos têm uma frase curta explicando o conceito da tela, visível sem precisar interagir
15. Depois de lançar uma despesa, despesa pessoal, venda, regra recorrente, acerto, ou salvar percentuais de sócio, aparece uma mensagem de confirmação de que a ação deu certo
16. Abrir `DespesasPage` sem vir de um link específico (ex. digitando a URL da safra diretamente) ainda mostra o formulário de lançar despesa, não só a lista
