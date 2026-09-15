-- Spec 25 — desconto do ciclo anual reduzido de ~17% (10x o mensal) para 10% sobre 12x o
-- mensal, a pedido do desenvolvedor. Atualiza por `nome` (mesmo padrão da migration
-- spec25_onboarding_e_checkout) pra não depender do id gerado aleatoriamente na seed.
UPDATE "planos" SET "valor_anual" = 538.92 WHERE "nome" = 'Essencial';
UPDATE "planos" SET "valor_anual" = 970.92 WHERE "nome" = 'Profissional';
UPDATE "planos" SET "valor_anual" = 1402.92 WHERE "nome" = 'Gestão';
