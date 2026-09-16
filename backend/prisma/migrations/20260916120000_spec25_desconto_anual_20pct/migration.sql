-- Spec 25 — desconto do ciclo anual aumentado de 10% para 20% sobre 12x o mensal, a pedido
-- do desenvolvedor (2026-09-16). Mesmo padrão da migration spec25_desconto_anual_10pct:
-- atualiza por `nome`, não por id (não depende do id gerado aleatoriamente na seed).
-- Essencial:    49.90 × 12 = 598.80 × 0.8 = 479.04
-- Profissional: 89.90 × 12 = 1078.80 × 0.8 = 863.04
-- Gestão:       129.90 × 12 = 1558.80 × 0.8 = 1247.04
UPDATE "planos" SET "valor_anual" = 479.04 WHERE "nome" = 'Essencial';
UPDATE "planos" SET "valor_anual" = 863.04 WHERE "nome" = 'Profissional';
UPDATE "planos" SET "valor_anual" = 1247.04 WHERE "nome" = 'Gestão';
