import fs from 'fs';
import path from 'path';
import { ROTAS_ISENTAS, ROTAS_AGREGADAS, ROTAS_PUBLICAS } from './assinaturaGate.manifest';

// Spec 27 — teste "sem banco" (só lê o texto dos arquivos de rota) que garante que toda rota
// autenticada do backend está protegida pelo gate de assinatura, ou classificada
// conscientemente como exceção no manifesto. Existe pra pegar no CI o mesmo tipo de lacuna
// que causou o bug relatado 2026-09-17 (rota nova esquecida do gate), antes de chegar em
// produção — ver assinaturaGate.manifest.ts para o racional completo.

const ROTAS_DIR = path.join(__dirname, '../routes');
const REGEX_ROTA = /router\.(get|post|put|patch|delete)\(\s*'([^']+)'/g;
const REGEX_GATE_POR_ID = /router\.use\(\s*'\/:id'/;
// Cobre tanto `router.use(authMiddleware)` (a maioria dos routers) quanto `authMiddleware`
// usado inline por rota (auth.ts) e `adminAuthMiddleware` (admin.ts, autorização própria).
const REGEX_AUTH = /authMiddleware/i;

// Os arquivos de rota têm comentários explicando o padrão (ex.: "sem authMiddleware, é
// pública de propósito") que, sem isso, seriam lidos como código de verdade pelas regexes
// acima — removendo linhas de comentário antes de analisar evita falso positivo/negativo.
function semComentarios(texto: string): string {
  return texto
    .split('\n')
    .filter((linha) => !linha.trim().startsWith('//'))
    .join('\n');
}

interface RotaEncontrada {
  arquivo: string;
  metodo: string;
  caminho: string;
  posicao: number;
}

function extrairRotas(arquivo: string, texto: string): RotaEncontrada[] {
  const encontradas: RotaEncontrada[] = [];
  const regex = new RegExp(REGEX_ROTA);
  let match: RegExpExecArray | null;
  while ((match = regex.exec(texto)) !== null) {
    encontradas.push({ arquivo, metodo: match[1], caminho: match[2], posicao: match.index });
  }
  return encontradas;
}

function chave(r: { arquivo: string; metodo: string; caminho: string }): string {
  return `${r.arquivo} ${r.metodo.toUpperCase()} ${r.caminho}`;
}

describe('cobertura do gate de assinatura (spec 27)', () => {
  const arquivos = fs.readdirSync(ROTAS_DIR).filter((f) => f.endsWith('.ts'));
  const textosPorArquivo = new Map(
    arquivos.map((arquivo) => [arquivo, semComentarios(fs.readFileSync(path.join(ROTAS_DIR, arquivo), 'utf-8'))])
  );

  const isentasSet = new Set(ROTAS_ISENTAS.map(chave));
  const agregadasSet = new Set(ROTAS_AGREGADAS.map(chave));
  const publicasSet = new Set(ROTAS_PUBLICAS.map(chave));

  it('toda rota autenticada está gated por :id ou classificada no manifesto', () => {
    const semClassificacao: string[] = [];

    for (const arquivo of arquivos) {
      const texto = textosPorArquivo.get(arquivo)!;
      const temAuth = REGEX_AUTH.test(texto);
      const posicaoDoGate = texto.search(REGEX_GATE_POR_ID);

      for (const rota of extrairRotas(arquivo, texto)) {
        const gatedPorId =
          posicaoDoGate !== -1 &&
          rota.posicao > posicaoDoGate &&
          (rota.caminho === '/:id' || rota.caminho.startsWith('/:id/'));
        if (gatedPorId) continue;

        if (!temAuth) {
          if (!publicasSet.has(chave(rota))) {
            semClassificacao.push(`${chave(rota)} — rota pública, adicione em ROTAS_PUBLICAS se for intencional`);
          }
          continue;
        }

        if (isentasSet.has(chave(rota)) || agregadasSet.has(chave(rota))) continue;

        semClassificacao.push(
          `${chave(rota)} — nem gated por :id, nem classificada em ROTAS_ISENTAS/ROTAS_AGREGADAS`
        );
      }
    }

    expect(semClassificacao).toEqual([]);
  });

  it('todo item do manifesto corresponde a uma rota que ainda existe', () => {
    const todasChaves = new Set<string>();
    for (const arquivo of arquivos) {
      for (const rota of extrairRotas(arquivo, textosPorArquivo.get(arquivo)!)) {
        todasChaves.add(chave(rota));
      }
    }

    const orfas = [...isentasSet, ...agregadasSet, ...publicasSet].filter((k) => !todasChaves.has(k));
    expect(orfas).toEqual([]);
  });
});
