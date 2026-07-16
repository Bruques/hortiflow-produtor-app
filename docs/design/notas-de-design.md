# Notas de design — HortiFlow Produtor

Referência viva das decisões de UI tomadas nos wireframes (`docs/design/wireframes.html`, abrir no navegador — 12 telas em cartões de celular lado a lado). Este arquivo é o que deve ser lido no início de cada sessão de implementação de tela; o HTML só precisa ser reaberto se surgir dúvida visual específica.

## Como usar isso numa sessão nova

Ao pedir a implementação de uma tela, referencie a spec da task correspondente em `docs/specs/0X-*.md` (regras de negócio) **e** este arquivo (decisões visuais). Ex.:

> "Vamos implementar a tela de Login. Regras de negócio: `docs/specs/01-setup.md`. Visual: `docs/design/notas-de-design.md`, seção Login."

Não é preciso colar o HTML nem re-explicar o histórico — é só isso.

## Paleta

- Verde principal (marca, botões primários, ícones de entrada/receita): `#17482d` / `#1e6b3e`
- Verde claro de apoio (fundos tintados, sucesso): `#e3f3e2` / `#2f8f4f`
- Vermelho semântico (saída/despesa): `#d64545` / fundo `#fbe4e4`
- Azul semântico (receita/vendas nos cards do resumo): `#2f6fd6` / fundo `#e2edfb`
- Âmbar (sugestão/atenção, ex: despesa recorrente): `#c98a1f` / fundo `#faedd0`
- Neutros com viés verde (não cinza puro): texto `#202821`, texto secundário `#5c6b5e`, bordas `#dde1d8` / `#eceee8`
- Fundo de página `#faf9f4`

## Tipografia

- Títulos e wordmark: pilha `ui-rounded` (`-apple-system`/`SF Pro Rounded`/`Segoe UI Rounded`), peso 800 — dá o tom "amigável" apropriado pro público rural
- Corpo/labels: `-apple-system` padrão do sistema
- Números monetários e contadores: `font-variant-numeric: tabular-nums` sempre

## Componentes recorrentes (nomes usados no wireframe, pra manter consistência ao nomear componentes React)

- **Topbar**: hambúrguer + logo central + sino de notificação. Aparece em toda tela com bottom nav.
- **Bottom nav v1**: 5 abas (Resumo, Despesas, Vendas, Simulação, Acertos).
- **Bottom nav v2** (decisão mais recente, substitui a v1): 4 abas (Resumo, Despesas, Vendas, Acertos) + botão **"+"** central flutuante, verde, maior que os ícones, sobrepondo a barra. Toque abre uma **folha de opções** (bottom sheet) com "Nova venda" / "Nova despesa". *Ainda não decidido se a v1 ou v2 é a final — ver seção "Pendências".*
- **Period toggle**: segmented control "Hoje / Semana / Mês / Safra", reaproveitado em Início, Despesas e Vendas. Mapeia direto pro parâmetro de período do `calcularDivisao` do backend.
- **Hero card**: cartão verde escuro em gradiente, usado pra destacar "quanto você recebe" — sempre o número mais importante da tela.
- **Cards de resumo** (grid 2×2): ícone colorido + label + valor + legenda. Cores seguem a paleta semântica acima.
- **Chips de seleção** (tipo de despesa, sócio, data): preferidos a `<select>`, alvo de toque grande, um único ativo por grupo.
- **Upload de comprovante**: botão grande tracejado "Tirar foto", vira estado preenchido ao anexar. Reaproveitado em Nova Despesa e em Registrar Acerto (comprovante de pagamento — **campo novo, ver Pendências**).
- **FAB + bottom sheet**: ver Bottom nav v2 acima.

## Decisões específicas por tela

- **Login**: telefone com máscara automática, campo de senha com toggle mostrar/ocultar.
- **Início**: resumo da safra inteira por padrão (v1) ou com period toggle (v2) — ver Pendências. Cards trocaram "Investimentos" (não existe no schema) por **"Caixas vendidas"**, ligado a `Venda.quantidade_caixas`.
- **Despesas/Vendas (listas)**: agrupadas por dia, com total do período no topo. Despesas mostra card de sugestão de regra recorrente `por_periodo` (confirmação de 1 clique, não gera despesa sozinha). Vendas mostra selo "gerou despesa automática de R$X" quando a regra `por_venda` está ativa.
- **Nova despesa**: sócio (chip) → tipo (grade de ícones) → valor (campo grande estilo "calculadora") → data → comprovante.
- **Nova venda**: data → quantidade de caixas (stepper +/-) → preço por caixa → total calculado ao vivo → comprador (texto livre) → aviso de despesa automática calculado ao vivo.
- **Acertos (histórico)**: CTA "Registrar novo acerto" em destaque + lista de acertos passados (tipo Parcial/Final).
- **Extrato do acerto**: card verde com Lucro líquido do período + card por sócio (despesas bancadas, percentual aplicado — snapshot, valor recebido). Nota de rodapé explicando que é um "retrato congelado".
- **Registrar acerto**: tipo (Parcial/Final, Final mostra aviso de que encerra a safra) → período (De/Até) → prévia do cálculo (mesmo layout do extrato, mas "a receber" em vez de "recebido") → **comprovante de pagamento opcional** (campo novo) → nota de congelamento → confirmar.
- **Configurações**: percentual de sócios com barra de proporção visual + stepper por sócio + selo de validação (soma = 100%), código de convite de 6 dígitos, regras de despesa recorrente com toggle ativo/inativo.
- **Splash**: usa a imagem real de `frontend/src/assets/Logo hortiflow.png` em tela cheia. É a única tela que usa o arquivo raster — nas demais o ícone é um SVG desenhado à mão (a imagem original tem textura de grão que fica "manchada" em tamanho pequeno; só vale usar o arquivo real se um dia existir uma versão vetorial/transparente exportada da fonte original).
- **Nova safra**: nome sugerido a partir da data (editável), período (início + término previsto, esse último pode ficar em aberto), aviso se já existir safra em andamento (o modelo não trava "uma safra ativa por vez" sozinho — quem evita confusão é a tela).
- **Cadastrar meeiro**: gera só o código de convite (papel + apelido opcional pra identificação local) — **não define percentual de lucro aqui**, isso é exclusivo da tela Configurações, pra não duplicar a regra "soma 100%" em dois lugares. Mostra lista de convites pendentes com opção de cancelar.

## Decisões confirmadas (2026-07-15)

- **Bottom nav**: a **v2** é a definitiva — 4 abas (Resumo, Despesas, Vendas, Acertos) + FAB central verde que abre a folha de opções (Nova venda / Nova despesa). A v1 (5 abas com Simulação) fica só de referência histórica no wireframe, não implementar.
- **Início**: usa o **period toggle** (Hoje/Semana/Mês/Safra) — é a v2 da Home, não a v1 fixa na safra inteira.

## Pendências antes de implementar (decidir ou perguntar ao dev)

1. **Campo de comprovante de pagamento no Acerto**: não existe hoje no schema Prisma (`Acerto`/`AcertoSocio` em `docs/specs/06-acerto.md`). Precisa de migration (`comprovante_pagamento_url` ou similar) antes de implementar essa parte da tela.
