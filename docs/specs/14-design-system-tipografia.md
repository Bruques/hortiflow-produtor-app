# Task 14 — Design system: escala tipográfica centralizada (web + mobile)

## Objetivo

Hoje o tamanho de cada texto (web: `text-[12.5px]`, `text-[17px]` etc. soltos em cada página; mobile: `fontSize: 12.5`, `fontSize: 17` soltos em cada `StyleSheet.create`) é um valor solto, repetido em dezenas de lugares. Aumentar a fonte de um tipo de texto em todo o app hoje significa caçar e editar cada tela manualmente — e não há garantia de que duas telas usando "a mesma ideia" de texto (ex. valor monetário destacado) estão de fato com o mesmo tamanho.

Esta task cria uma **escala tipográfica nomeada** (poucos tokens, com papel semântico — não um valor por pixel) num arquivo central no web e outro no mobile, pra que decisões como "aumentar todos os valores monetários" ou "aumentar o corpo de texto geral" virem uma mudança de 1 linha, propagada pra qualquer tela que já use o token.

Cor **não** entra nesta task: a paleta (`frontend/tailwind.config.ts` bloco `hf` / `mobile/src/theme.ts` export `cores`) já é centralizada desde o início do redesign visual (ver `docs/design/notas-de-design.md`) — não há valores soltos de cor espalhados pelas telas hoje, então não há problema a resolver aí. Se isso mudar no futuro, é uma spec separada.

## Escopo

**Entra:**

1. Levantamento dos tamanhos de fonte realmente em uso hoje no web (`frontend/src/pages/*.tsx`, `frontend/src/components/*.tsx`) e no mobile (`mobile/src/screens/*.tsx`)
2. Um conjunto pequeno de tokens nomeados por **papel semântico** (ex: `legenda`, `corpo`, `valorDestaque`, `tituloSecao`, `tituloTela`, `hero`) — não por valor de pixel — cobrindo os casos reais encontrados no levantamento
3. Web: tokens adicionados em `frontend/tailwind.config.ts` (`theme.extend.fontSize`), utilizáveis como `text-legenda`, `text-corpo` etc.
4. Mobile: tokens equivalentes exportados de `mobile/src/theme.ts` (ex: `export const fonte = { legenda: 12.5, corpo: 14, ... }`), com os mesmos nomes e valores numéricos do web sempre que o mesmo papel semântico existir nas duas plataformas
5. Migração de **uma tela de prova de conceito por plataforma** (Resumo web `ResumoPage.tsx` e Resumo mobile `ResumoScreen.tsx`, por serem as mais usadas) dos valores soltos atuais para os tokens novos
6. Registro do padrão em `docs/design/notas-de-design.md`, como referência obrigatória pra qualquer tela nova ou redesenhada a partir de agora

**Fica de fora (não implementar nesta task):**

- Migrar todas as telas existentes de uma vez — risco de PR gigante e regressão visual espalhada sem revisão possível linha a linha; migração das demais telas acontece **incrementalmente**, sempre que uma tela for tocada por outro motivo (mesmo critério já usado pro redesign visual em `docs/design/checklist-telas.md`)
- Escala de cores/tema (dark mode, tema alternável, tokens de cor novos) — como explicado no Objetivo, a paleta já é centralizada; não há necessidade identificada agora
- Compartilhamento de código entre web e mobile (ex. pacote npm de design tokens compartilhado) — mantém o padrão já documentado em `notas-de-design.md` de duplicar valores manualmente nos dois arquivos, só formaliza os nomes
- Ferramenta de sincronização automática entre os dois arquivos de tokens — a sincronia entre web e mobile continua manual, como já é hoje pra cor

## Regras de negócio / comportamento esperado

### Nomeação dos tokens

- Tokens nomeados pelo **papel do texto na tela**, não pelo tamanho em si (ex: não existe token `text-17px`) — isso é o que permite reclassificar/redimensionar sem precisar tocar em cada tela de novo
- Um token pode ter o mesmo valor numérico que já existe hoje (a spec não muda tamanhos por padrão, só nomeia e centraliza os que já existem) — qualquer aumento de tamanho é uma decisão separada, tomada depois que os tokens existirem
- Onde web e mobile já usam visualmente o mesmo papel (ex. título de seção, valor monetário destacado), o token recebe o mesmo nome nas duas plataformas, com o mesmo valor numérico — consistente com o que `notas-de-design.md` já documenta pra cor

### Migração incremental

- Nenhuma tela fora da prova de conceito (Resumo web/mobile) é obrigada a migrar nesta task
- Toda tela nova ou redesenhada a partir da aprovação desta spec usa os tokens, não valores soltos — registrado como regra em `notas-de-design.md`

## Critérios de aceite

1. `frontend/tailwind.config.ts` tem um bloco de tokens de tamanho de fonte nomeados por papel semântico, documentado com um comentário explicando quando usar cada um
2. `mobile/src/theme.ts` exporta um objeto equivalente (`fonte` ou nome similar), com os mesmos nomes/valores do web onde o papel semântico é o mesmo
3. `ResumoPage.tsx` (web) e `ResumoScreen.tsx` (mobile) usam os tokens novos em vez dos valores soltos atuais, sem nenhuma mudança visual perceptível (mesmos tamanhos de antes — é só a fonte da verdade que muda)
4. Alterar o valor numérico de um token central (ex. `tituloSecao`) e recarregar o app reflete o novo tamanho em toda tela já migrada para aquele token, sem editar a tela
5. `docs/design/notas-de-design.md` documenta a escala de tokens e a regra de "toda tela nova usa token, não valor solto"
