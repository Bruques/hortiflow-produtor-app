# Task 2 — Sociedade e sócios

## Objetivo

Permitir que um usuário autenticado crie uma Sociedade (a parceria), defina os sócios que participam dela com seus percentuais de lucro, e permitir que outros usuários entrem numa Sociedade existente através de um código simples de 6 dígitos. É a base de tenant do sistema — nenhuma Safra, Despesa, Venda ou Acerto (tasks seguintes) existe fora do contexto de uma Sociedade.

## Escopo

**Entra:**
- Criar Sociedade (usuário autenticado vira o primeiro sócio automaticamente)
- Gerar e expor um código de convite de 6 dígitos por Sociedade
- Entrar em uma Sociedade existente informando o código (usuário autenticado vira sócio)
- Definir/editar o percentual de lucro e papel (financiador/meeiro/misto) de cada sócio da Sociedade, com validação de que a soma dos percentuais é 100%
- Listar as Sociedades do usuário autenticado (ele pode participar de várias)
- Listar os sócios de uma Sociedade (com nome, telefone, percentual, papel)
- Middleware/checagem simples de que o usuário só acessa dados de Sociedades das quais é sócio

**Fica de fora (não implementar nesta task):**
- Safra, Despesa, Venda, Acerto (tasks 3 a 6)
- Remover sócio de uma Sociedade (não pedido no roadmap; fica em aberto para decisão futura se necessário)
- Edição do nome da Sociedade depois de criada (não crítico agora)
- Qualquer tela de painel/simulação (task 5)
- Permissões granulares por papel — o CLAUDE.md já define que financiador e meeiro têm a mesma visão de dados no MVP

## Regras de negócio

### Criar Sociedade
- `POST /sociedades` com `{ nome }`, autenticado
- Cria a Sociedade e automaticamente cria o `SocioSociedade` do criador com `percentual_lucro = 100` e `papel = MISTO` (será ajustado quando os demais sócios entrarem — ver abaixo)
- Gera um código de convite de 6 dígitos, único entre sociedades ativas (evita colisão)

### Código de convite
- Formato: 6 dígitos numéricos (ex: "482913")
- Persistido na Sociedade (campo novo `codigo_convite`, não existe no schema atual — decisão registrada abaixo)
- Não expira nesta task (simplicidade do MVP); reemissão de código não é escopo

### Entrar via código
- `POST /sociedades/entrar` com `{ codigo_convite }`, autenticado
- Se código válido e usuário ainda não é sócio dessa Sociedade: cria `SocioSociedade` para o usuário com `percentual_lucro = 0` e `papel = MEEIRO` como default — o percentual real é ajustado depois via edição de percentuais (ver abaixo), já que a soma tem que ser fechada por quem está organizando a divisão
- Se código inválido: 404
- Se usuário já é sócio dessa Sociedade: 409

### Definir percentuais de lucro
- `PUT /sociedades/:id/socios/percentuais` com `{ socios: [{ usuario_id, percentual_lucro, papel }] }`, autenticado, só quem já é sócio da Sociedade
- Precisa cobrir **todos** os sócios atuais da Sociedade (não parcial) — evita ficar com soma indefinida por sócio esquecido
- Valida que a soma dos `percentual_lucro` enviados é exatamente 100 (com tolerância de arredondamento de até 0.01 pra evitar erro de ponto flutuante em decimais tipo 33.33/33.33/33.34)
- Se soma diferente de 100: 422 com mensagem explicando a soma recebida
- Atualiza `percentual_lucro` e `papel` de cada `SocioSociedade` informado

### Listagem
- `GET /sociedades` — lista as Sociedades do usuário autenticado (id, nome, código de convite — só visível pra quem já é sócio)
- `GET /sociedades/:id/socios` — lista os sócios da Sociedade (nome, telefone, percentual_lucro, papel), só acessível a quem é sócio dela

### Autorização
- Toda rota que referencia `:id` de Sociedade verifica que `req.usuario` tem um `SocioSociedade` correspondente; caso contrário, 403

## Contrato de API

```
POST /sociedades
  auth obrigatório
  body: { nome: string }
  → 201 { sociedade: { id, nome, codigo_convite }, socio: { percentual_lucro, papel } }

POST /sociedades/entrar
  auth obrigatório
  body: { codigo_convite: string }
  → 200 { sociedade: { id, nome } }
  → 404 se código não corresponde a nenhuma sociedade
  → 409 se usuário já é sócio dessa sociedade

PUT /sociedades/:id/socios/percentuais
  auth obrigatório, requer ser sócio da sociedade :id
  body: { socios: [{ usuario_id: string, percentual_lucro: number, papel: "FINANCIADOR" | "MEEIRO" | "MISTO" }] }
  → 200 { socios: [...] } (lista atualizada)
  → 422 se a lista não cobre todos os sócios atuais, ou se a soma dos percentuais != 100 (±0.01)
  → 403 se usuário autenticado não é sócio da sociedade

GET /sociedades
  auth obrigatório
  → 200 { sociedades: [{ id, nome, codigo_convite, percentual_lucro, papel }] } (dados do vínculo do usuário autenticado em cada uma)

GET /sociedades/:id/socios
  auth obrigatório, requer ser sócio da sociedade :id
  → 200 { socios: [{ usuario_id, nome, telefone, percentual_lucro, papel }] }
  → 403 se usuário autenticado não é sócio da sociedade
```

## Decisão de schema a registrar

O schema atual (task 1) não tem campo de código de convite na Sociedade. Esta task adiciona:

```prisma
model Sociedade {
  ...
  codigo_convite String @unique
  ...
}
```

Vai gerar uma nova migração Prisma. Nenhuma outra entidade do schema muda nesta task.

## Critérios de aceite

1. Dado um usuário autenticado, `POST /sociedades` com nome cria a Sociedade, retorna código de convite de 6 dígitos, e o criador aparece como sócio com 100%
2. Dado um código de convite válido, um segundo usuário autenticado consegue `POST /sociedades/entrar` e passa a aparecer em `GET /sociedades/:id/socios`
3. Dado um código de convite inexistente, `POST /sociedades/entrar` retorna 404
4. Dado um usuário que já é sócio, tentar entrar de novo na mesma sociedade retorna 409
5. Dado uma Sociedade com 2 sócios, `PUT /sociedades/:id/socios/percentuais` com soma 100% (ex: 60/40) atualiza ambos com sucesso
6. Dado o mesmo cenário, mas com soma diferente de 100% (ex: 60/30), retorna 422 e não altera nada no banco
7. Dado o mesmo cenário, mas a lista enviada não cobre todos os sócios (ex: sociedade tem 3 sócios, só 2 enviados), retorna 422
8. Dado um usuário que não é sócio de uma Sociedade, `GET /sociedades/:id/socios` e `PUT .../percentuais` retornam 403
9. `GET /sociedades` retorna só as sociedades das quais o usuário autenticado participa, com o percentual/papel dele em cada uma
10. Frontend: tela para criar Sociedade (nome), tela mostrando o código de convite gerado, tela para entrar via código, e tela de lista de sócios com edição de percentuais (mobile-first, poucos campos por tela)

## Decisões registradas durante a implementação

- **Migração Prisma criada manualmente**: `prisma migrate dev` exige terminal interativo, que não está disponível neste ambiente. A migração foi gerada com `prisma migrate diff` (que produziu o SQL de `ALTER TABLE` + índice único) e aplicada com `prisma migrate deploy`, mesmo resultado de uma migração normal, só sem o prompt interativo.
- **Select de papel do sócio é um `<select>` nativo estilizado**, não um componente shadcn/ui dedicado — evita adicionar uma dependência nova (`@radix-ui/react-select`) para um único campo de 3 opções fixas.
- **`HomePage` virou a tela "Minhas sociedades"**: antes só mostrava saudação e botão de sair; agora lista as sociedades do usuário e dá acesso a criar/entrar, já que é o hub natural pós-login. Continua sendo a rota `/`.
- **Ao entrar via código, o usuário recebe 0% e papel MEEIRO por padrão** (conforme a regra de negócio da spec) — a tela de sócios já deixa claro que a soma precisa fechar em 100%, então o ajuste é o próximo passo natural depois do convite.
