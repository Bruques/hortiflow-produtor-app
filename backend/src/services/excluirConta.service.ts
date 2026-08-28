import { randomUUID } from 'crypto';
import { StatusAssinatura, StatusUsuario } from '@prisma/client';
import prisma from '../lib/prisma';

// Spec 20 — exclusão de conta. Regra validada com o dev: quando quem exclui é titular de
// alguma Sociedade, ela é apagada por completo (é o caso comum — o titular/financiador é
// quem de fato paga e usa o app). A linha `Usuario` só não pode ser excluída fisicamente
// quando sobra alguma referência obrigatória em sociedade de outra pessoa (ele foi sócio
// não-titular em algum lugar) — nesse caso ela é anonimizada em vez de apagada, pra não
// quebrar o extrato de quem continua na sociedade dele.
export async function excluirConta(usuarioId: string): Promise<void> {
  const sociedadesTitular = await prisma.sociedade.findMany({
    where: { criado_por_usuario_id: usuarioId },
    select: { id: true },
  });

  await prisma.$transaction(async (tx) => {
    for (const { id: sociedadeId } of sociedadesTitular) {
      await tx.rateioDespesa.deleteMany({ where: { despesa: { safra: { sociedade_id: sociedadeId } } } });
      await tx.rateioRegra.deleteMany({ where: { regra: { sociedade_id: sociedadeId } } });
      await tx.acertoSocio.deleteMany({ where: { acerto: { safra: { sociedade_id: sociedadeId } } } });
      await tx.despesa.deleteMany({ where: { safra: { sociedade_id: sociedadeId } } });
      await tx.regraDespesaRecorrente.deleteMany({ where: { sociedade_id: sociedadeId } });
      await tx.venda.deleteMany({ where: { safra: { sociedade_id: sociedadeId } } });
      await tx.unidadeVenda.deleteMany({ where: { sociedade_id: sociedadeId } });
      await tx.aporteTrabalho.deleteMany({ where: { safra: { sociedade_id: sociedadeId } } });
      await tx.despesaPessoal.deleteMany({ where: { safra: { sociedade_id: sociedadeId } } });
      await tx.acerto.deleteMany({ where: { safra: { sociedade_id: sociedadeId } } });
      await tx.safra.deleteMany({ where: { sociedade_id: sociedadeId } });
      await tx.socioSociedade.deleteMany({ where: { sociedade_id: sociedadeId } });
      await tx.sociedade.delete({ where: { id: sociedadeId } });
    }

    // Despesas pessoais do próprio usuário em sociedades das quais ele não é titular
    // (ex.: meeiro com despesa pessoal numa sociedade de outra pessoa) — sempre excluídas,
    // são privadas e não afetam mais ninguém.
    await tx.despesaPessoal.deleteMany({ where: { usuario_id: usuarioId } });

    // Assinatura nunca é excluída fisicamente (preserva o histórico de `Pagamento`, que é
    // registro financeiro do dev, não dado pessoal do usuário) — só cancelada.
    await tx.assinatura.updateMany({
      where: { usuario_id: usuarioId },
      data: { status: StatusAssinatura.CANCELADA },
    });

    // Sobrou alguma referência obrigatória em sociedade de outra pessoa (sócio não-titular)?
    // Se sim, não dá pra excluir a linha `Usuario` fisicamente sem quebrar o extrato de quem
    // continua nessa sociedade — anonimiza em vez de apagar.
    const [despesasRestantes, aportesRestantes, regrasRestantes, sociosRestantes] = await Promise.all([
      tx.despesa.count({ where: { socio_id: usuarioId } }),
      tx.aporteTrabalho.count({ where: { socio_id: usuarioId } }),
      tx.regraDespesaRecorrente.count({ where: { OR: [{ socio_id: usuarioId }, { criado_por: usuarioId }] } }),
      tx.socioSociedade.count({ where: { usuario_id: usuarioId } }),
    ]);

    const precisaAnonimizar = despesasRestantes + aportesRestantes + regrasRestantes + sociosRestantes > 0;

    if (precisaAnonimizar) {
      await tx.usuario.update({
        where: { id: usuarioId },
        data: {
          nome: 'Usuário excluído',
          telefone: `excluido_${randomUUID()}`,
          senha_hash: randomUUID(),
          status: StatusUsuario.EXCLUIDO,
        },
      });
    } else {
      await tx.assinatura.updateMany({ where: { usuario_id: usuarioId }, data: { usuario_id: null } });
      await tx.eventoAuditoria.updateMany({ where: { usuario_id: usuarioId }, data: { usuario_id: null } });
      await tx.usuario.delete({ where: { id: usuarioId } });
    }
  });
}
