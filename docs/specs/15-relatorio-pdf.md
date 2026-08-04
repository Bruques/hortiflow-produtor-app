# Task 15 — Relatório em PDF (despesas, vendas e divisão do período)

## Objetivo

Gerar um PDF, para um período escolhido pelo financiador, com o extrato de despesas e vendas da Safra ativa — para ele levar/enviar à contadora na hora de fechar o mês. Demanda relatada diretamente pela contadora da região que identificou a necessidade original do produto: hoje o financiador não tem um documento pronto pra entregar, só o app.

## Escopo

**Entra:**
- Botão "Gerar relatório" na Home e em Configurações, visível só para quem tem papel `FINANCIADOR` ou `MISTO` na Safra ativa
- Tela de geração: seletor de período (reaproveita o mesmo componente já usado em Resumo/Acerto — dia/semana/mês/safra inteira/período customizado)
- Endpoint no backend que gera o PDF e devolve o arquivo pronto (download), sem persistir nada novo no banco
- PDF com dois blocos separados (ver "Regras de negócio")
- Web primeiro; mobile fica para uma spec futura reaproveitando o mesmo endpoint (`docs/specs/mobile/`)

**Fica de fora (não implementar nesta task):**
- Acesso de sócio `MEEIRO` ao relatório (só quem banca a produção gera, ver "Quem pode gerar")
- Envio automático por e-mail/WhatsApp — só download manual
- Qualquer relatório de Despesa Pessoal (nunca entra em nada da Sociedade, mesma regra do resto do produto)
- App mobile (React Native) — reaproveita o mesmo endpoint numa spec própria depois
- Customização de layout/marca do PDF (logo, cabeçalho de sociedade) além do essencial pra ficar legível
- Qualquer cálculo novo — reaproveita `calcularDivisao` (task 5) sem alterá-lo

## Regras de negócio

### Quem pode gerar

Só sócio com papel `FINANCIADOR` ou `MISTO` na sociedade dona da Safra — mesma checagem já usada em `podeConfigurarRegra` (`regrasDespesaRecorrente.service.ts`), reaproveitada aqui porque é o mesmo grupo de sócios ("quem banca a produção"). Diferente do resto do MVP (que não distingue papel), essa restrição é intencional: é o financiador quem recebe o dinheiro das vendas e paga as despesas na prática, então é ele quem leva o extrato pra contadora — decisão confirmada com o dev em 2026-08-04. `MEEIRO` não vê o botão e recebe 403 se chamar o endpoint direto.

### Conteúdo do PDF — dois blocos separados

O PDF não mistura "fato contábil" com "acordo entre sócios" — são coisas de natureza diferente:

1. **Extrato de movimentação** (o que interessa à contabilidade formal, porque é dinheiro que entrou/saiu do caixa do financiador):
   - Lista de despesas do período (data, tipo, valor, quem lançou/bancou)
   - Lista de vendas do período (data, unidade, quantidade, valor total, pago/a receber)
   - Totais: receita total, despesas totais
2. **Resumo de divisão entre sócios** (rotulado explicitamente como simulação/acordo interno, não como lançamento contábil):
   - Saída de `calcularDivisao` para o mesmo período: lucro líquido e valor por sócio
   - Serve pro financiador saber quanto descontar/pagar a cada meeiro no acerto daquele período — não é fato fiscal, é o que resolve a dor relatada pela contadora

Separar em blocos evita que uma mudança futura na fórmula de divisão (ainda "a confirmar", ver Perguntas em aberto do CLAUDE.md) comprometa a parte que de fato importa para a contabilidade formal.

### Período

Mesmo componente e mesma resolução de período já usados em Resumo/Acerto (`backend/src/lib/periodo.ts`, `resolverPeriodo`) — sem lógica de data nova.

### Geração do arquivo

Backend gera o PDF sob demanda a cada request (sem persistir nada) e devolve como download (`Content-Type: application/pdf`, `Content-Disposition: attachment`). Usa `pdfkit` (biblioteca leve, gera PDF via desenho programático — texto/tabelas — sem depender de um navegador headless como Puppeteer, o que evitaria consumo extra de memória/CPU no plano do Railway).

## Contrato de API

```
GET /safras/:id/relatorio
  auth obrigatório, requer papel FINANCIADOR ou MISTO na sociedade dona da safra
  query: periodo=dia|semana|mes|safra  OU  data_inicio=YYYY-MM-DD&data_fim=YYYY-MM-DD
  → 200, corpo binário application/pdf (attachment)
  → 400 se nem periodo nem par data_inicio/data_fim válido
  → 403 se sócio MEEIRO ou se não for sócio da sociedade
  → 404 se a safra não existe
```

## Decisão de arquitetura a registrar

**Por que reaproveitar `calcularDivisao` sem alterá-lo:** mesma regra crítica do CLAUDE.md aplicada no Acerto (task 6) — o relatório é só mais um consumidor do cálculo puro, nunca uma cópia da fórmula.

**Por que não persistir nada:** o relatório é uma leitura formatada do estado atual de despesas/vendas, não um documento imutável como o Acerto — gerar de novo mais tarde reflete edições feitas depois, o que é o comportamento esperado (não é uma prestação de contas formal entre sócios, é um apoio pra contabilidade).

**Por que `pdfkit` em vez de Puppeteer:** Puppeteer roda um Chromium inteiro por PDF gerado, pesado pro ambiente do Railway (Hobby/staging) para um relatório que é essencialmente texto e tabelas — `pdfkit` desenha isso diretamente sem navegador.

## Critérios de aceite

1. Dado uma Safra com despesas e vendas lançadas, `GET /safras/:id/relatorio?periodo=mes` (chamado por um sócio `FINANCIADOR`) retorna 200 com um PDF válido contendo as despesas e vendas do mês corrente e os totais batendo com `GET /safras/:id/simulacao?periodo=mes`
2. O mesmo endpoint chamado por um sócio `MEEIRO` retorna 403
3. O mesmo endpoint chamado por um sócio `MISTO` retorna 200 (tratado como financiador)
4. `data_inicio=2026-07-01&data_fim=2026-07-31` gera um PDF só com lançamentos dentro desse intervalo
5. Sem `periodo` nem par `data_inicio`/`data_fim` válido, retorna 400
6. O PDF contém os dois blocos claramente separados: extrato de despesas/vendas e resumo de divisão por sócio
7. Despesa Pessoal nunca aparece no PDF, independente do período
8. Frontend: botão "Gerar relatório" visível na Home e em Configurações só para `FINANCIADOR`/`MISTO`; tela de seleção de período reaproveitando o componente existente; ao confirmar, baixa o PDF

### Adendo 2026-08-04 — identidade visual do PDF

Pedido do dev depois do primeiro teste em staging: o PDF ficava genérico (preto e branco, sem nenhuma referência visual ao app) e as tabelas eram difíceis de ler em linhas longas. Ajustes feitos em `backend/src/services/relatorio.service.ts`, sem mudar contrato de API nem conteúdo/dado nenhum:

- **Cabeçalho com a marca**: ícone (SVG) + wordmark "HortiFlow Produtor" no topo, igual ao que aparece na splash/login
- **Paleta do app aplicada ao PDF**: títulos de seção e cabeçalho de tabela em verde da marca (`hf-green-800`/`hf-green-700`), valor negativo em vermelho (`hf-red`) e positivo em verde — mesma convenção do `ResumoPage.tsx`/`NovoAcertoPage.tsx` no web
- **Linhas zebradas**: no corpo de cada tabela (despesas, vendas, divisão), linhas alternam entre `hf-cream-50` e `hf-cream-100` pra facilitar a leitura em listas longas
- **Ícone duplicado no backend** (`backend/src/assets/brandIcon.ts`, paths copiados de `frontend/src/components/BrandMark.tsx`): o backend não compartilha código com o frontend e o deploy do Railway não inclui a pasta `frontend/`, então o SVG do ícone precisa existir também do lado do backend — se o ícone da marca mudar, atualizar os dois lugares
- **Nova dependência**: `svg-to-pdfkit` (+ `@types/svg-to-pdfkit`), pra desenhar o ícone SVG dentro do PDF gerado pelo `pdfkit` — sem ela, o ícone teria que ser um PNG raster (não existe um exportado sem o "grão" que fica manchado em tamanho pequeno, ver `docs/design/notas-de-design.md`)
