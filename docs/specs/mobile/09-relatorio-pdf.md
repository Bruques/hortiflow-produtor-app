# Mobile 09 — Relatório em PDF

## Objetivo

Levar pro app mobile a geração do relatório em PDF de despesas, vendas e divisão do período (`docs/specs/15-relatorio-pdf.md` do web) — o financiador leva o celular pra roça o dia inteiro, então precisa poder gerar e compartilhar o relatório com a contadora direto de lá, sem depender de abrir o web num computador. Reaproveita 100% do endpoint já existente no backend (`GET /safras/:id/relatorio`); nenhuma mudança de backend.

## Escopo

**Entra:**
- Tela "Gerar relatório" (dentro da safra ativa) com o mesmo seletor de período das outras telas mobile (spec `05`) — dia/semana/mês/safra inteira/personalizado
- Baixar o PDF do endpoint e abrir a folha de compartilhamento nativa do sistema (`expo-sharing`), pra o financiador mandar por WhatsApp/e-mail pra contadora ou salvar onde quiser — não existe "visualizador de PDF" dentro do app
- Acesso restrito a sócio com papel `FINANCIADOR` ou `MISTO`, mesma regra do web e mesma checagem que já existe em `ConfiguracoesUnidadesVendaScreen`/card de Unidades de Venda no Menu (spec `08`)
- Botão de acesso na tela de Resumo e card no Menu, espelhando os dois pontos de entrada do web

**Fica de fora (não implementar nesta task):**
- Qualquer geração de PDF **offline**: exige conexão, ver "Regras de negócio"
- Visualizador de PDF dentro do próprio app (preview antes de compartilhar) — abre direto na folha de compartilhamento do sistema, que já deixa o usuário escolher "Visualizar" como uma das opções em ambas plataformas
- Cache do relatório já gerado — cada geração é uma chamada nova ao servidor, sem persistir o PDF localmente além do necessário pra abrir a folha de compartilhamento
- Qualquer mudança no conteúdo do PDF em si (layout, blocos) — isso é decisão do backend/service compartilhado (`backend/src/services/relatorio.service.ts`), essa spec só consome o arquivo pronto

## Regras de negócio

### Exige conexão — não é uma leitura com cache como o painel (spec `05`)
Diferente do painel de simulação (que mostra o último resultado salvo quando offline), gerar relatório é uma ação pontual que sempre busca um PDF novo do servidor — não faz sentido "gerar relatório com dado desatualizado" quando o próprio objetivo é levar um documento correto pra contadora. Sem conexão, a tela mostra mensagem clara pedindo internet e desabilita o botão de gerar, sem tentar nenhuma chamada.

### Quem pode gerar
Mesma regra do web: só sócio `FINANCIADOR` ou `MISTO`. O botão/card fica escondido pra `MEEIRO` (mesmo padrão do card "Unidades de Venda" no Menu, spec `08`); o backend também recusa com `403` se a tela for alcançada por algum caminho não previsto.

### Download e compartilhamento — dependência nova
O app mobile ainda não baixa nem compartilha nenhum arquivo binário (a única leitura de arquivo hoje é `expo-image-picker`, pra anexar foto de comprovante, e isso nunca sai do dispositivo). Baixar o PDF da API e abrir a folha de compartilhamento nativa exige duas libs novas do ecossistema Expo:
- **`expo-file-system`**: salva o PDF recebido num arquivo temporário no dispositivo — pré-requisito pra `expo-sharing`, que compartilha por caminho de arquivo, não por dado em memória
- **`expo-sharing`**: abre a folha de compartilhamento nativa (iOS: share sheet; Android: intent chooser) apontando pro arquivo salvo

Ambas são módulos oficiais do Expo (mesma família de `expo-image-picker`/`expo-secure-store` já usados no projeto), sem custo de configuração nativa adicional em managed workflow.

### Nome do arquivo
Mesmo padrão do web: `relatorio-<nome-da-safra-em-kebab-case>.pdf`.

### Identidade visual do PDF já vem pronta do backend
O conteúdo do PDF (logo + wordmark no topo, cores da marca, linhas zebradas — ver adendo 2026-08-04 de `docs/specs/15-relatorio-pdf.md`) é gerado inteiramente pelo `relatorio.service.ts` do backend. O app mobile não precisa (e não deve) montar nem estilizar nada do PDF em si — só consome o arquivo binário pronto e o repassa pra folha de compartilhamento.

## Contrato de API

Nenhuma mudança — reaproveita integralmente:

```
GET /safras/:id/relatorio
  query: periodo=dia|semana|mes|safra  OU  data_inicio=YYYY-MM-DD&data_fim=YYYY-MM-DD
  → 200, corpo binário application/pdf
  → 400 sem período válido | 403 se MEEIRO ou não-sócio | 404 se a safra não existe
```

## Critérios de aceite

1. Dado um sócio `FINANCIADOR` numa safra com despesas e vendas lançadas, selecionar um período e tocar em "Baixar/Compartilhar" busca o PDF e abre a folha de compartilhamento nativa do sistema
2. Um sócio `MEEIRO` não vê o botão de gerar relatório nem na tela de Resumo nem no card do Menu
3. Sem conexão, a tela mostra aviso pedindo internet e o botão de gerar fica desabilitado — nenhuma chamada é feita
4. Trocar o período antes de gerar reflete no PDF baixado (mesmo intervalo aplicado no web pro mesmo filtro)
5. Se o backend retornar erro (ex: 403 por alguma inconsistência de papel), a tela mostra mensagem de erro em vez de travar ou abrir a folha de compartilhamento com arquivo inválido

## Decisões registradas durante a implementação

- **API do Expo SDK 57 mudou desde o texto original da spec**: `expo-file-system` nesta versão usa as classes `File`/`Directory` (`new File(Paths.cache, nome)`, `.create()`, `.write()`), não a API legada baseada em `downloadAsync(url, uri)` de versões anteriores. Confirmado consultando a documentação versionada antes de codar (`mobile/AGENTS.md` já avisa que a API do Expo muda entre versões).
- **Download feito com `expo/fetch` (fetch WHATWG do próprio Expo) em vez de `File.createDownloadTask()`**: a API de download por task não deixa claro, na documentação, o que acontece quando o servidor responde com erro HTTP (403/400) em vez de 200 — existe o risco real de gravar o corpo JSON do erro num arquivo `.pdf` como se fosse sucesso, e só o usuário descobriria ao tentar abrir um PDF corrompido. Com `expo/fetch`, a resposta expõe `response.ok`/`response.status` explicitamente, então o erro é tratado igual ao resto do app (mensagem do campo `error` do backend) antes de qualquer arquivo ser gravado. Único lugar do app que não passa pelo `apiClient`/axios — nota deixada em `mobile/src/services/relatorio.ts`.
- **`mobile/src/services/relatorio.ts`, `mobile/src/screens/RelatorioScreen.tsx`**: seguem o mesmo padrão de "exige conexão" já usado em `NovoAcertoScreen.tsx` (spec `05`) — `useConectividade()` bloqueia a tela inteira antes de qualquer tentativa de chamada, com o mesmo aviso visual (`WifiOff`, texto explicando o porquê).
- **Pontos de entrada**: botão em `ResumoScreen.tsx` (acima do seletor de período, mesma posição do web) e card em `MenuScreen.tsx` (ao lado de "Unidades de Venda", reaproveitando a mesma flag `souFinanciador` já calculada ali) — ambos condicionados a `FINANCIADOR`/`MISTO`.
- **Validado sem simulador/dispositivo físico**, mesma limitação já registrada nas specs `00`, `04` e `05`: `npm run lint` (type-check), `npm test` (14 suítes/54 testes) e `npx expo export --platform ios` (bundling completo com as duas libs novas, sem erro) confirmam que o código compila; os critérios que dependem de interação real (tocar em "Baixar/Compartilhar" e ver a folha de compartilhamento nativa abrir com o PDF correto, alternar conexão e ver o aviso aparecer/sumir) ainda precisam ser conferidos rodando o app de verdade.
