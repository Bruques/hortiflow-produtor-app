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

### Escala tipográfica (design system, `docs/specs/14-design-system-tipografia.md`)

Tamanho de texto é um **token nomeado por papel semântico**, não um valor solto (`text-[17px]` no web, `fontSize: 17` no mobile) — web em `frontend/tailwind.config.ts` (bloco `theme.extend.fontSize`), mobile em `mobile/src/theme.ts` (`export const fonte`). **Toda tela nova ou redesenhada a partir de agora usa um token da lista abaixo; se nenhum papel existente encaixar, é um token novo, não um valor solto.**

| Token | Papel | Web | Mobile |
|---|---|---|---|
| `miniEtiqueta` | Selo secundário muito pequeno (ex: tag de papel do sócio) | 10px | 10 |
| `miniLegenda` | Legenda ínfima abaixo de um valor (ex: "A receber") | 10.5px | 10.5 |
| `etiqueta` | Selo de status e percentuais em destaque pequeno | 11.5px | 11 |
| `auxiliar` | Texto auxiliar pequeno dentro de cards (labels, notas) | 12px | 12 |
| `legenda` | Texto secundário padrão (rótulos, datas, links auxiliares) | 12.5px | 12.5 |
| `textoPequeno` | Avatares/iniciais e mensagens de status curtas | 13px | 13 |
| `corpo` | Texto padrão de conteúdo (nomes, títulos de item, mensagens) | 14px | 13.5 |
| `valorSecundario` | Valor monetário de destaque médio (itens de lista) | 14.5px | 14 |
| `destaqueMedio` | Texto em destaque médio (ex: percentual dentro do anel) | 15px | 15 |
| `tituloSecao` | Título de seção dentro de uma tela | 16px | 15 |
| `valorDestaque` | Valor monetário em destaque (cards de resumo) | 17px | 17 |
| `tituloTela` | Título principal da tela | 21px | 20 |
| `hero` | Valor monetário principal, maior destaque da tela | 26px | 26 |

Onde web e mobile já mostravam o mesmo papel visualmente com valores diferentes antes desta task (`etiqueta`, `corpo`, `valorSecundario`, `tituloSecao`, `tituloTela`), o valor de cada lado foi **preservado como estava** — a spec não muda tamanho por padrão, só nomeia e centraliza; alinhar esses valores entre plataformas é uma decisão visual separada, a tomar depois.

**Migração incremental**: só `ResumoPage.tsx` (web) e `ResumoScreen.tsx` (mobile) foram migradas como prova de conceito. As demais telas ainda têm valores soltos e migram aos poucos, sempre que forem tocadas por outro motivo — mesmo critério já usado no checklist de redesign visual (`docs/design/checklist-telas.md`).

## Componentes recorrentes (nomes usados no wireframe, pra manter consistência ao nomear componentes React)

- **Topbar**: hambúrguer + logo central + sino de notificação. Aparece em toda tela com bottom nav.
- **Bottom nav v1**: 5 abas (Resumo, Despesas, Vendas, Simulação, Acertos).
- **Bottom nav v2** (decisão mais recente, substitui a v1): 4 abas (Resumo, Despesas, Vendas, Acertos) + botão **"+"** central flutuante, verde, maior que os ícones, sobrepondo a barra. Toque abre uma **folha de opções** (bottom sheet) com "Nova venda" / "Nova despesa". *Ainda não decidido se a v1 ou v2 é a final — ver seção "Pendências".*
- **Period toggle**: segmented control, componente `PeriodToggle`. Na Home (card de resumo consolidado) continua com as 4 opções (Hoje/Semana/Mês/Safra). Nas telas de listagem (Resumo, Vendas, Despesas, Despesas pessoais) tem só 3 (`incluirSafra={false}`): Hoje/Semana/Mês, ao lado de um **botão de ícone de calendário** (`PeriodoAvancadoButton`) que abre uma folha com "Safra inteira" e o período personalizado (De/Até) — os dois casos que não cabem como botão extra do segmented control. Decisão do dev, 2026-08-04, revertendo uma tentativa anterior de trocar tudo por um dropdown rotulado (mantida só pro status, ver item abaixo).
- **Filtro de status em dropdown** (decisão 2026-08-04, componente `FiltroStatusPagamentoDropdown`, chrome compartilhado em `components/ui/dropdown-sheet.tsx`): só em Vendas, abaixo da linha de período. Gatilho é um **chip compacto colorido** (não uma pílula de largura cheia) com a legenda **"Status da venda"** acima — a cor muda com o valor selecionado (neutro/verde/âmbar), dá pra "ler" o filtro sem abrir. A folha que abre mostra cada opção como um cartão com contorno (ícone circular, selecionada com borda e selo de check) — substitui a antiga 3ª linha de abas, que tinha a mesma "cara" visual do toggle de período e confundia os dois filtros.
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
- **Despesas pessoais (lista)**: mesmo layout de Despesas/Vendas (agrupada por dia, total do período no topo, period toggle), mas **sem** o chip de sócio/avatar em cada item — é sempre o usuário autenticado, então repetir "Você" em toda linha seria ruído. No lugar do sócio, o `li-sub` mostra a `descricao` do lançamento quando existir (mesmo campo que a Despesa da sociedade ganhou depois, ver `docs/specs/03-safra-despesas-e-despesa-pessoal.md`). Sem card de sugestão de regra recorrente (regras recorrentes só existem pro nível da sociedade). Banner fixo no topo (`info-banner`) reforçando "Só você vê essas despesas" — mesma frase da tela atual (`PageHeader` da versão pré-redesign), só que no componente visual novo.
- **Nova despesa pessoal**: mesma estrutura da Nova despesa (grade de tipo → valor estilo calculadora → data), mas **sem** chip de "Quem bancou?" (sempre o usuário autenticado) e **sem** upload de comprovante (`DespesaPessoal` não tem campo de comprovante no schema — diferente da despesa da sociedade). Ganha um campo de **Descrição (opcional)**, que a despesa da sociedade também ganhou depois; aqui já existia desde o schema original. Banner de reforço no rodapé do formulário, mesma frase da lista.

## Decisões confirmadas (2026-07-15, 4ª aba atualizada em 2026-07-17)

- **Bottom nav**: a **v2** é a definitiva — 4 abas (Resumo, Vendas, Despesas, **Menu**) + FAB central verde que abre a folha de opções (Nova venda / Nova despesa). A v1 (5 abas com Simulação) fica só de referência histórica no wireframe, não implementar. **Correção (2026-07-17)**: a 4ª aba não é mais "Acertos" — Configurações foi fundida no Menu (`frontend/src/pages/MenuPage.tsx`), que virou a 4ª aba; Acertos e Despesas pessoais ficam acessíveis de dentro do Menu, não como aba própria. Ver `frontend/src/components/BottomNavV2.tsx` como fonte de verdade se este texto ficar desatualizado de novo.
- **Início**: usa o **period toggle** (Hoje/Semana/Mês/Safra) — é a v2 da Home, não a v1 fixa na safra inteira.

## Pendências antes de implementar (decidir ou perguntar ao dev)

1. **Campo de comprovante de pagamento no Acerto**: não existe hoje no schema Prisma (`Acerto`/`AcertoSocio` em `docs/specs/06-acerto.md`). Precisa de migration (`comprovante_pagamento_url` ou similar) antes de implementar essa parte da tela.

---

## Mobile (React Native/Expo)

Mesma paleta, mesma marca, mesmas decisões de UI listadas acima — o app mobile (`mobile/`, specs em `docs/specs/mobile/`) segue este documento como fonte de verdade visual, igual ao frontend web. **Antes de estilizar qualquer tela mobile, leia este arquivo e reaproveite `mobile/src/theme.ts`** (cores) e `mobile/src/components/BrandMark.tsx` (ícone + wordmark) — não redefina cor ou o ícone da marca numa tela nova.

### O que foi portado 1:1

- **Paleta** (`mobile/src/theme.ts`, export `cores`): mesmos valores hex de `frontend/tailwind.config.ts` (bloco `hf`). Qualquer mudança de cor precisa ser replicada nos dois arquivos — não há compartilhamento de código entre web e mobile (ver `CLAUDE.md`).
- **Ícone da marca** (`mobile/src/components/BrandMark.tsx`): mesmo path SVG de `frontend/src/components/BrandMark.tsx`, renderizado com `react-native-svg` (`Svg`/`Path`) em vez de `<svg>`/`<path>` do DOM.
- **Ícones de interface**: `lucide-react-native` no lugar de `lucide-react` — mesmo conjunto de ícones e mesma API (`<Phone />`, `<Lock />` etc.), só o pacote muda.

### O que precisou de adaptação (React Native não tem CSS)

- **Tipografia**: a pilha `ui-rounded`/`SF Pro Rounded` do web não tem equivalente nativo direto sem carregar uma fonte customizada via `expo-font`. Títulos usam a fonte de sistema em peso máximo (`fontWeight: '800'`), sem o efeito "rounded". **Decisão (2026-08-03)**: manter a fonte de sistema — o dev avaliou a diferença como aceitável, sem justificar a dependência extra de empacotar Quicksand/Nunito via `expo-font`. Revisitar só se a diferença voltar a incomodar visualmente.
- **Espaçamento**: escala em `mobile/src/theme.ts` (`espacamento`, múltiplos de 4) equivalente à escala padrão do Tailwind — usar essas constantes em vez de números soltos em `StyleSheet.create`.
- **Sombra de card**: Tailwind resolve isso com `shadow-*` de graça; no React Native, sombra é `shadowColor`/`shadowOffset`/`shadowOpacity`/`shadowRadius` (iOS) + `elevation` (Android, comportamento visual diferente).
- **Gradiente do hero card "Você recebe"** (`ResumoScreen.tsx`): o web usa `bg-gradient-to-br from-hf-green-800 to-hf-green-900`; implementado no mobile (2026-08-03) como cor sólida `cores.green[900]`, sem a lib `expo-linear-gradient`, pra não adicionar uma dependência só por esse detalhe. Se algum dia o gradiente for considerado necessário, é a única mudança pendente nesse componente.

### Ainda não implementado (fica para quando a tela correspondente for construída)

Bottom nav v2 (FAB + bottom sheet), period toggle, chips de seleção, upload de comprovante com câmera nativa, cards de resumo — nenhum desses tem componente React Native ainda; as decisões de UI já estão documentadas acima e valem igualmente pro mobile, só falta implementar quando a spec de cada tela for trabalhada.
