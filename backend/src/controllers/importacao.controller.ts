import { Request, Response } from 'express';
import { z } from 'zod';
import * as safrasService from '../services/safras.service';
import * as importacaoService from '../services/importacao.service';
import { classificarArquivo, tamanhoEmBytes, LIMITE_BYTES_POR_TIPO } from '../services/importacao.service';

const arquivoSchema = z.object({
  nome: z.string().min(1),
  // Data URI completa (data:<mime>;base64,....), mesmo formato que foto_comprovante já usa.
  base64: z.string().min(1),
});

const extrairSchema = z.object({
  arquivos: z.array(arquivoSchema).min(1).max(10),
});

export async function extrair(req: Request, res: Response): Promise<void> {
  const { id } = req.params; // safra id

  const { safra, autorizado } = await safrasService.ehSocioDaSafra(req.usuarioId, id);
  if (!safra) {
    res.status(404).json({ error: 'Safra não encontrada' });
    return;
  }
  if (!autorizado) {
    res.status(403).json({ error: 'Você não é sócio dessa sociedade' });
    return;
  }

  const parsed = extrairSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(422).json({ error: 'Envie de 1 a 10 arquivos' });
    return;
  }

  const arquivos = parsed.data.arquivos.map((arquivo) => ({
    ...arquivo,
    tipo: classificarArquivo(arquivo.nome),
    dataUrl: arquivo.base64,
  }));

  if (arquivos.some((a) => a.tipo === 'DESCONHECIDO')) {
    res.status(422).json({ error: 'Tipo de arquivo não suportado (use foto, PDF ou planilha xlsx/xls/csv)' });
    return;
  }

  const tipos = new Set(arquivos.map((a) => a.tipo));
  const temPlanilha = tipos.has('PLANILHA');
  if (temPlanilha && (tipos.has('IMAGEM') || tipos.has('PDF'))) {
    res.status(422).json({ error: 'Não é possível misturar planilha com foto/PDF no mesmo envio' });
    return;
  }
  if (temPlanilha && arquivos.length > 1) {
    res.status(422).json({ error: 'Envie apenas uma planilha por vez' });
    return;
  }

  for (const arquivo of arquivos) {
    const limite = LIMITE_BYTES_POR_TIPO[arquivo.tipo as keyof typeof LIMITE_BYTES_POR_TIPO];
    if (tamanhoEmBytes(arquivo) > limite) {
      res.status(422).json({ error: `Arquivo "${arquivo.nome}" excede o tamanho máximo permitido` });
      return;
    }
  }

  try {
    const resultado = await importacaoService.extrairLancamentos(arquivos);
    res.json(resultado);
  } catch (erro) {
    console.error({ erro: 'Falha ao extrair lançamentos via IA', detalhe: erro });
    res.status(502).json({ error: 'Não foi possível processar os arquivos agora. Tente novamente em instantes.' });
  }
}
