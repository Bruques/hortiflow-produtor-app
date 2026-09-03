import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AlertTriangle, ArrowLeft, Check, Info, Minus, Plus, Sprout, User, Users, X } from 'lucide-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { abrirSafraRequest, listarSafrasRequest, type SocioSafraInput } from '../services/safras';
import { listarSociosCatalogoRequest } from '../services/sociedades';
import { statusAssinaturaRequest } from '../services/assinatura';
import { meRequest } from '../services/auth';
import { mensagemErro } from '../lib/erroApi';
import { useSafraAtiva } from '../context/SafraContext';
import { TelaComTeclado } from '../components/TelaComTeclado';
import { cores, espacamento, raio } from '../theme';
import type { Safra } from '../types/safra';
import type { PapelSocio, SocioCatalogo } from '../types/sociedade';
import type { RootStackParamList } from '../navigation/RootNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'NovaSafra'>;

function nomeSugerido(): string {
  const ano = new Date().getFullYear();
  return `Safra ${ano}/${ano + 1}`;
}

const TOLERANCIA_SOMA_PERCENTUAL = 0.01;

const ROTULO_PAPEL: Record<PapelSocio, string> = {
  FINANCIADOR: 'Financiador',
  MEEIRO: 'Meeiro',
  MISTO: 'Misto',
};

// Task 23 (docs/specs/23-socios-por-safra.md) — sócio/percentual em edição nesta tela,
// antes de virar o payload de `SocioSafraInput`. `key` é só de controle de lista, id do
// catálogo quando reaproveitado ou um id gerado quando é sócio novo.
interface EdicaoSocioSafra {
  key: string;
  socio_sociedade_id?: string;
  nome: string;
  papel: PapelSocio;
  percentual_lucro: number;
}

// Mesmo padrão de lib/despesasQueue.ts — `crypto.randomUUID()` não é confiável no runtime
// do Hermes/React Native, isso aqui é só um id de controle de lista no client.
function gerarIdLocal(): string {
  return `local-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

// Equivalente à frontend/src/pages/NovaSafraPage.tsx do web (docs/specs/mobile/03-safra.md).
export function NovaSafraScreen({ navigation }: Props) {
  const { safraAtiva, selecionarSafra } = useSafraAtiva();
  const sociedadeId = safraAtiva?.sociedadeId;

  const [nome, setNome] = useState(nomeSugerido());
  const [observacoes, setObservacoes] = useState('');
  const [safraEmAndamento, setSafraEmAndamento] = useState<Safra | null>(null);
  const [limiteAtingido, setLimiteAtingido] = useState<{ safrasAtivas: number; limite: number } | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  // Task 23 — sócios são definidos aqui, na criação, e não herdam mais o que foi
  // configurado numa safra anterior (era exatamente essa herança que causava divisão
  // errada pra quem tem lavouras/parceiros diferentes na mesma sociedade).
  const [temSocios, setTemSocios] = useState<boolean | null>(null);
  const [catalogo, setCatalogo] = useState<SocioCatalogo[]>([]);
  const [meuUsuarioId, setMeuUsuarioId] = useState<string | null>(null);
  const [socios, setSocios] = useState<EdicaoSocioSafra[]>([]);
  const [novoAberto, setNovoAberto] = useState(false);
  const [modoNovo, setModoNovo] = useState<'existente' | 'novo'>('existente');
  const [socioExistenteId, setSocioExistenteId] = useState('');
  const [nomeNovo, setNomeNovo] = useState('');
  const [papelNovo, setPapelNovo] = useState<PapelSocio>('MEEIRO');

  useEffect(() => {
    if (!sociedadeId) return;
    listarSafrasRequest(sociedadeId)
      .then((res) => {
        setSafraEmAndamento(res.safras.find((s) => s.status === 'EM_ANDAMENTO') ?? null);
      })
      .catch(() => {});

    listarSociosCatalogoRequest(sociedadeId)
      .then((res) => setCatalogo(res.socios))
      .catch(() => {});

    meRequest()
      .then((res) => setMeuUsuarioId(res.usuario.id))
      .catch(() => {});

    // Spec 18 — avisa e já desabilita o botão antes de tentar, em vez de só deixar o erro
    // aparecer depois de tocar em "Criar" (a checagem de verdade continua no backend).
    statusAssinaturaRequest()
      .then((status) => {
        const limite = status.plano?.limiteSafrasAtivas ?? null;
        if (limite !== null && status.safrasAtivas >= limite) {
          setLimiteAtingido({ safrasAtivas: status.safrasAtivas, limite });
        }
      })
      .catch(() => {});
  }, [sociedadeId]);

  // Pré-adiciona quem está criando a safra assim que escolhe "vai ter sócios" — ele nunca
  // abre uma safra sem ser um dos sócios (financiador), então pedir pra se adicionar
  // manualmente pelo catálogo era um passo supérfluo. Só roda uma vez (ref), pra permitir
  // que se remova depois se realmente quiser, sem a tela reinserir sozinha.
  const jaPreencheuSozinho = useRef(false);
  useEffect(() => {
    if (temSocios !== true || jaPreencheuSozinho.current || socios.length > 0) return;
    const meuSocio = catalogo.find((c) => c.usuario_id === meuUsuarioId);
    if (!meuSocio) return;
    jaPreencheuSozinho.current = true;
    setSocios([
      { key: meuSocio.id, socio_sociedade_id: meuSocio.id, nome: meuSocio.nome, papel: meuSocio.papel, percentual_lucro: 100 },
    ]);
  }, [temSocios, catalogo, meuUsuarioId, socios.length]);

  const somaPct = socios.reduce((acc, s) => acc + s.percentual_lucro, 0);
  const pctOk = Math.abs(somaPct - 100) < TOLERANCIA_SOMA_PERCENTUAL;
  const catalogoDisponivel = catalogo.filter((c) => !socios.some((s) => s.socio_sociedade_id === c.id));

  function ajustarPct(key: string, delta: number) {
    setSocios((atual) =>
      atual.map((s) => (s.key === key ? { ...s, percentual_lucro: Math.max(0, Math.min(100, s.percentual_lucro + delta)) } : s))
    );
  }

  function removerSocio(key: string) {
    setSocios((atual) => atual.filter((s) => s.key !== key));
  }

  function adicionarSocio() {
    if (modoNovo === 'existente') {
      const escolhido = catalogoDisponivel.find((c) => c.id === socioExistenteId);
      if (!escolhido) return;
      setSocios((atual) => [
        ...atual,
        { key: escolhido.id, socio_sociedade_id: escolhido.id, nome: escolhido.nome, papel: escolhido.papel, percentual_lucro: 0 },
      ]);
      setSocioExistenteId('');
    } else {
      if (!nomeNovo.trim()) return;
      setSocios((atual) => [...atual, { key: gerarIdLocal(), nome: nomeNovo.trim(), papel: papelNovo, percentual_lucro: 0 }]);
      setNomeNovo('');
      setPapelNovo('MEEIRO');
    }
    setNovoAberto(false);
  }

  async function criar() {
    if (!sociedadeId || !nome.trim() || temSocios === null) return;
    if (temSocios && (socios.length === 0 || !pctOk)) return;

    setErro(null);
    setSalvando(true);
    try {
      const sociosPayload: SocioSafraInput[] | undefined = temSocios
        ? socios.map((s) =>
            s.socio_sociedade_id
              ? { socio_sociedade_id: s.socio_sociedade_id, percentual_lucro: s.percentual_lucro }
              : { nome: s.nome, papel: s.papel, percentual_lucro: s.percentual_lucro }
          )
        : undefined;

      const { safra } = await abrirSafraRequest(sociedadeId, nome.trim(), observacoes.trim() || undefined, sociosPayload);
      selecionarSafra({ safraId: safra.id, sociedadeId, safra });
      navigation.replace('Safra');
    } catch (err) {
      setErro(mensagemErro(err, 'Não foi possível criar a safra'));
      setSalvando(false);
    }
  }

  return (
    <SafeAreaView style={styles.tela} edges={['top', 'bottom']}>
      <TelaComTeclado>
      <View style={styles.cabecalho}>
        <Pressable style={styles.botaoVoltar} onPress={() => navigation.goBack()} hitSlop={8}>
          <ArrowLeft size={18} color={cores.stone[900]} />
        </Pressable>
        <Text style={styles.tituloCabecalho}>Nova safra</Text>
        <View style={styles.botaoVoltar} />
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.conteudo} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
        {erro && <Text style={styles.erro}>{erro}</Text>}

        {limiteAtingido && (
          <View style={styles.avisoLimite}>
            <AlertTriangle size={17} color={cores.red.padrao} />
            <View style={styles.avisoTextos}>
              <Text style={styles.avisoLimiteTitulo}>
                Limite de safras ativas do seu plano atingido ({limiteAtingido.safrasAtivas}/{limiteAtingido.limite})
              </Text>
              <Text style={styles.avisoLimiteTexto}>
                Encerre uma safra em andamento ou fale com a gente sobre um plano com mais espaço.
              </Text>
            </View>
          </View>
        )}

        {safraEmAndamento && (
          <View style={styles.aviso}>
            <AlertTriangle size={17} color={cores.amber.padrao} />
            <View style={styles.avisoTextos}>
              <Text style={styles.avisoTitulo}>Você já tem a {safraEmAndamento.nome} em andamento</Text>
              <Text style={styles.avisoTexto}>
                Criar uma nova safra não fecha a atual sozinha — registre um acerto final nela antes, ou os
                dois períodos vão ficar em andamento ao mesmo tempo.
              </Text>
            </View>
          </View>
        )}

        <View>
          <Text style={styles.label}>Nome da safra</Text>
          <View style={styles.campo}>
            <Sprout size={18} color={cores.green[700]} />
            <TextInput
              style={styles.input}
              placeholder="Ex: Safra 2026/2027"
              placeholderTextColor={cores.stone[400]}
              value={nome}
              onChangeText={setNome}
            />
          </View>
          <Text style={styles.legenda}>Sugerido a partir da data de hoje — pode editar livremente</Text>
        </View>

        <View>
          <Text style={styles.label}>Observações (opcional)</Text>
          <TextInput
            style={styles.textarea}
            placeholder="Ex: Estufa | Córrego do Bom Jesus | 20 mil pés | meeiro: João"
            placeholderTextColor={cores.stone[400]}
            value={observacoes}
            onChangeText={setObservacoes}
            maxLength={500}
            multiline
            numberOfLines={3}
          />
          <Text style={styles.legenda}>Texto livre, só pra ajudar a identificar a safra — não entra em nenhum cálculo</Text>
        </View>

        <View>
          <Text style={styles.label}>Esta safra vai ter sócios ou meeiros?</Text>
          <View style={styles.opcoesTemSocios}>
            <Pressable
              style={[styles.opcaoTemSocios, temSocios === false && styles.opcaoTemSociosSelecionada]}
              onPress={() => setTemSocios(false)}
            >
              <User size={20} color={cores.green[800]} />
              <Text style={styles.opcaoTemSociosTexto}>Vou trabalhar sozinho</Text>
            </Pressable>
            <Pressable
              style={[styles.opcaoTemSocios, temSocios === true && styles.opcaoTemSociosSelecionada]}
              onPress={() => setTemSocios(true)}
            >
              <Users size={20} color={cores.green[800]} />
              <Text style={styles.opcaoTemSociosTexto}>Vai ter sócios/meeiros</Text>
            </Pressable>
          </View>
          <Text style={styles.legenda}>
            Cada safra tem seus próprios sócios e percentuais — não precisa ser igual a outra safra.
          </Text>
        </View>

        {temSocios && (
          <View style={{ gap: espacamento.sm + 4 }}>
            {socios.length > 0 && (
              <>
                <View style={styles.barraSocios}>
                  {socios.map((s) => (
                    <View key={s.key} style={{ width: `${s.percentual_lucro}%`, backgroundColor: cores.green[700] }} />
                  ))}
                </View>

                <View style={[styles.badgeSoma, pctOk ? styles.badgeSomaOk : styles.badgeSomaErro]}>
                  {pctOk ? (
                    <Check size={14} color={cores.green[700]} strokeWidth={3} />
                  ) : (
                    <AlertTriangle size={14} color={cores.red.padrao} />
                  )}
                  <Text style={[styles.badgeSomaTexto, { color: pctOk ? cores.green[700] : cores.red.padrao }]}>
                    Total: {somaPct}%
                  </Text>
                </View>

                <View style={{ gap: espacamento.xs }}>
                  {socios.map((s) => (
                    <View key={s.key} style={styles.linhaSocio}>
                      <View style={styles.linhaSocioInfo}>
                        <Text style={styles.linhaSocioNome} numberOfLines={1}>
                          {s.nome}
                        </Text>
                        <Text style={styles.tagPapel}>{ROTULO_PAPEL[s.papel]}</Text>
                      </View>
                      <View style={styles.stepper}>
                        <Pressable
                          style={styles.stepperBotao}
                          onPress={() => ajustarPct(s.key, -5)}
                          hitSlop={6}
                          accessibilityLabel={`Diminuir percentual de ${s.nome}`}
                        >
                          <Minus size={14} color={cores.green[800]} />
                        </Pressable>
                        <Text style={styles.stepperValor}>{s.percentual_lucro}%</Text>
                        <Pressable
                          style={styles.stepperBotao}
                          onPress={() => ajustarPct(s.key, 5)}
                          hitSlop={6}
                          accessibilityLabel={`Aumentar percentual de ${s.nome}`}
                        >
                          <Plus size={14} color={cores.green[800]} />
                        </Pressable>
                        <Pressable
                          style={styles.stepperBotaoRemover}
                          onPress={() => removerSocio(s.key)}
                          hitSlop={6}
                          accessibilityLabel={`Remover ${s.nome}`}
                        >
                          <X size={14} color={cores.red.padrao} />
                        </Pressable>
                      </View>
                    </View>
                  ))}
                </View>
              </>
            )}

            {!novoAberto && (
              <Pressable style={styles.botaoAdicionar} onPress={() => setNovoAberto(true)}>
                <Plus size={16} color={cores.green[700]} />
                <Text style={styles.textoBotaoAdicionar}>Adicionar sócio</Text>
              </Pressable>
            )}

            {novoAberto && (
              <View style={styles.cartaoNovoSocio}>
                <View style={styles.opcoesPapel}>
                  <Pressable
                    style={[
                      styles.opcaoModo,
                      modoNovo === 'existente' && styles.opcaoModoSelecionada,
                      catalogoDisponivel.length === 0 && styles.botaoDesabilitado,
                    ]}
                    onPress={() => setModoNovo('existente')}
                    disabled={catalogoDisponivel.length === 0}
                  >
                    <Text
                      style={[styles.opcaoModoTexto, modoNovo === 'existente' && styles.opcaoModoTextoSelecionada]}
                    >
                      Sócio já cadastrado
                    </Text>
                  </Pressable>
                  <Pressable
                    style={[styles.opcaoModo, modoNovo === 'novo' && styles.opcaoModoSelecionada]}
                    onPress={() => setModoNovo('novo')}
                  >
                    <Text style={[styles.opcaoModoTexto, modoNovo === 'novo' && styles.opcaoModoTextoSelecionada]}>
                      Sócio novo
                    </Text>
                  </Pressable>
                </View>

                {modoNovo === 'existente' ? (
                  catalogoDisponivel.length === 0 ? (
                    <Text style={styles.legenda}>Nenhum outro sócio cadastrado nessa sociedade ainda — cadastre um novo.</Text>
                  ) : (
                    <View>
                      <Text style={styles.label}>Sócio</Text>
                      <View style={styles.opcoesPapel}>
                        {catalogoDisponivel.map((c) => (
                          <Pressable
                            key={c.id}
                            style={[styles.opcaoPapel, socioExistenteId === c.id && styles.opcaoPapelSelecionada]}
                            onPress={() => setSocioExistenteId(c.id)}
                          >
                            <Text
                              style={[
                                styles.opcaoPapelTexto,
                                socioExistenteId === c.id && styles.opcaoPapelTextoSelecionada,
                              ]}
                              numberOfLines={1}
                            >
                              {c.nome}
                            </Text>
                          </Pressable>
                        ))}
                      </View>
                    </View>
                  )
                ) : (
                  <>
                    <View>
                      <Text style={styles.label}>Nome do sócio</Text>
                      <TextInput
                        style={styles.inputCampo}
                        placeholder="Ex: João"
                        placeholderTextColor={cores.stone[400]}
                        value={nomeNovo}
                        onChangeText={setNomeNovo}
                      />
                    </View>
                    <View>
                      <Text style={styles.label}>Papel</Text>
                      <View style={styles.opcoesPapel}>
                        {(['MEEIRO', 'FINANCIADOR', 'MISTO'] as PapelSocio[]).map((papel) => (
                          <Pressable
                            key={papel}
                            style={[styles.opcaoPapel, papelNovo === papel && styles.opcaoPapelSelecionada]}
                            onPress={() => setPapelNovo(papel)}
                          >
                            <Text style={[styles.opcaoPapelTexto, papelNovo === papel && styles.opcaoPapelTextoSelecionada]}>
                              {ROTULO_PAPEL[papel]}
                            </Text>
                          </Pressable>
                        ))}
                      </View>
                    </View>
                  </>
                )}

                <View style={styles.acoesNovoSocio}>
                  <Pressable style={styles.botaoCancelar} onPress={() => setNovoAberto(false)}>
                    <Text style={styles.textoBotaoCancelar}>Cancelar</Text>
                  </Pressable>
                  <Pressable
                    style={[
                      styles.botaoConfirmar,
                      (modoNovo === 'existente' ? !socioExistenteId : !nomeNovo.trim()) && styles.botaoDesabilitado,
                    ]}
                    onPress={adicionarSocio}
                    disabled={modoNovo === 'existente' ? !socioExistenteId : !nomeNovo.trim()}
                  >
                    <Text style={styles.textoBotaoConfirmar}>Adicionar</Text>
                  </Pressable>
                </View>
              </View>
            )}

            {socios.length > 0 && !pctOk && (
              <Text style={styles.erro}>A soma dos percentuais precisa fechar em 100% pra criar a safra</Text>
            )}
          </View>
        )}

        <View style={styles.info}>
          <Info size={17} color={cores.stone[600]} />
          <Text style={styles.infoTexto}>
            A partir da criação, todo lançamento novo de despesa ou venda passa a pertencer a essa safra.
          </Text>
        </View>
      </ScrollView>

      <View style={styles.rodape}>
        <Pressable
          style={[
            styles.botaoPrimario,
            (!nome.trim() ||
              salvando ||
              !!limiteAtingido ||
              temSocios === null ||
              (temSocios === true && (socios.length === 0 || !pctOk))) &&
              styles.botaoDesabilitado,
          ]}
          onPress={criar}
          disabled={
            !nome.trim() ||
            salvando ||
            !!limiteAtingido ||
            temSocios === null ||
            (temSocios === true && (socios.length === 0 || !pctOk))
          }
        >
          {salvando ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.textoBotaoPrimario}>Criar e iniciar safra</Text>
          )}
        </Pressable>
      </View>
      </TelaComTeclado>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  tela: {
    flex: 1,
    backgroundColor: cores.cream[50],
  },
  cabecalho: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: espacamento.lg,
    paddingTop: espacamento.sm,
    paddingBottom: espacamento.xs,
  },
  botaoVoltar: {
    width: 38,
    height: 38,
    borderRadius: raio.pill,
    borderWidth: 1.5,
    borderColor: cores.cream[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  tituloCabecalho: {
    fontSize: 17,
    fontWeight: '800',
    color: cores.stone[900],
  },
  conteudo: {
    flexGrow: 1,
    paddingHorizontal: espacamento.xl,
    paddingVertical: espacamento.lg,
    gap: espacamento.lg,
  },
  erro: {
    color: cores.red.padrao,
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '500',
  },
  aviso: {
    flexDirection: 'row',
    gap: espacamento.sm,
    backgroundColor: cores.amber.fundo,
    borderRadius: raio.md,
    padding: espacamento.sm + 6,
  },
  avisoTextos: {
    flex: 1,
  },
  avisoTitulo: {
    fontSize: 12.5,
    fontWeight: '700',
    color: cores.stone[900],
  },
  avisoTexto: {
    fontSize: 11.5,
    color: cores.amber.padrao,
    marginTop: 2,
  },
  avisoLimite: {
    flexDirection: 'row',
    gap: espacamento.sm,
    backgroundColor: cores.red.fundo,
    borderRadius: raio.md,
    padding: espacamento.sm + 6,
  },
  avisoLimiteTitulo: {
    fontSize: 12.5,
    fontWeight: '700',
    color: cores.red.padrao,
  },
  avisoLimiteTexto: {
    fontSize: 11.5,
    color: cores.red.padrao,
    marginTop: 2,
  },
  label: {
    fontSize: 12.5,
    fontWeight: '700',
    color: cores.green[700],
    marginBottom: espacamento.sm,
  },
  campo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacamento.sm,
    borderWidth: 1.5,
    borderColor: cores.linha,
    borderRadius: raio.lg,
    paddingHorizontal: espacamento.lg,
    paddingVertical: espacamento.md,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: cores.stone[900],
  },
  // Variante autocontida (borda/padding próprios), pro campo "Nome do sócio" dentro do
  // cartão de adicionar sócio — diferente de `input` acima, que espera o wrapper `campo`.
  inputCampo: {
    height: 44,
    borderWidth: 1,
    borderColor: cores.linha,
    borderRadius: raio.md,
    paddingHorizontal: espacamento.md,
    fontSize: 15,
    color: cores.stone[900],
  },
  textarea: {
    borderWidth: 1.5,
    borderColor: cores.linha,
    borderRadius: raio.lg,
    paddingHorizontal: espacamento.lg,
    paddingVertical: espacamento.md,
    fontSize: 14,
    color: cores.stone[900],
    textAlignVertical: 'top',
  },
  legenda: {
    marginTop: espacamento.xs + 2,
    fontSize: 11.5,
    color: cores.stone[400],
  },
  opcoesTemSocios: {
    flexDirection: 'row',
    gap: espacamento.sm + 2,
  },
  opcaoTemSocios: {
    flex: 1,
    alignItems: 'center',
    gap: espacamento.xs + 2,
    borderWidth: 1.5,
    borderColor: cores.linha,
    borderRadius: raio.lg,
    paddingVertical: espacamento.md + 6,
    paddingHorizontal: espacamento.sm,
  },
  opcaoTemSociosSelecionada: {
    borderColor: cores.green[500],
    backgroundColor: cores.green[100],
  },
  opcaoTemSociosTexto: {
    fontSize: 12.5,
    fontWeight: '700',
    color: cores.stone[900],
    textAlign: 'center',
  },
  barraSocios: {
    flexDirection: 'row',
    height: 12,
    borderRadius: raio.pill,
    overflow: 'hidden',
    backgroundColor: cores.cream[100],
  },
  badgeSoma: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    alignItems: 'center',
    gap: espacamento.xs,
    borderRadius: raio.pill,
    paddingHorizontal: espacamento.md,
    paddingVertical: espacamento.xs + 2,
  },
  badgeSomaOk: {
    backgroundColor: cores.green[100],
  },
  badgeSomaErro: {
    backgroundColor: cores.red.fundo,
  },
  badgeSomaTexto: {
    fontSize: 12.5,
    fontWeight: '700',
  },
  linhaSocio: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: espacamento.sm,
    borderBottomWidth: 1,
    borderBottomColor: cores.cream[100],
    paddingVertical: espacamento.sm,
  },
  linhaSocioInfo: {
    flex: 1,
    minWidth: 0,
  },
  linhaSocioNome: {
    fontSize: 14,
    fontWeight: '700',
    color: cores.stone[900],
  },
  tagPapel: {
    marginTop: 2,
    alignSelf: 'flex-start',
    fontSize: 10,
    fontWeight: '700',
    color: cores.green[700],
    backgroundColor: cores.green[100],
    borderRadius: raio.pill,
    paddingHorizontal: espacamento.xs + 2,
    paddingVertical: 2,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacamento.sm,
  },
  stepperBotao: {
    width: 27,
    height: 27,
    borderRadius: raio.pill,
    borderWidth: 1.5,
    borderColor: cores.linha,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperBotaoRemover: {
    width: 27,
    height: 27,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperValor: {
    minWidth: 36,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '800',
    color: cores.stone[900],
  },
  botaoAdicionar: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: espacamento.sm,
    borderWidth: 1.5,
    borderColor: cores.green[700],
    borderRadius: raio.lg,
    paddingVertical: espacamento.md,
  },
  textoBotaoAdicionar: {
    color: cores.green[700],
    fontWeight: '700',
    fontSize: 13.5,
  },
  cartaoNovoSocio: {
    gap: espacamento.sm + 2,
    borderWidth: 1,
    borderColor: cores.linha,
    borderRadius: raio.lg,
    padding: espacamento.md + 2,
  },
  opcaoModo: {
    flex: 1,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: cores.linha,
    borderRadius: raio.md,
    paddingVertical: espacamento.sm,
  },
  opcaoModoSelecionada: {
    borderColor: cores.green[500],
    backgroundColor: cores.green[100],
  },
  opcaoModoTexto: {
    fontSize: 12,
    fontWeight: '700',
    color: cores.stone[600],
  },
  opcaoModoTextoSelecionada: {
    color: cores.green[800],
  },
  opcoesPapel: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: espacamento.xs,
  },
  opcaoPapel: {
    flexGrow: 1,
    borderWidth: 1.5,
    borderColor: cores.linha,
    borderRadius: raio.md,
    paddingVertical: espacamento.sm,
    paddingHorizontal: espacamento.sm,
    alignItems: 'center',
  },
  opcaoPapelSelecionada: {
    borderColor: cores.green[700],
    backgroundColor: cores.green[100],
  },
  opcaoPapelTexto: {
    fontSize: 12.5,
    fontWeight: '700',
    color: cores.stone[600],
  },
  opcaoPapelTextoSelecionada: {
    color: cores.green[800],
  },
  acoesNovoSocio: {
    flexDirection: 'row',
    gap: espacamento.sm,
  },
  botaoCancelar: {
    flex: 1,
    borderWidth: 1,
    borderColor: cores.linha,
    borderRadius: raio.md,
    paddingVertical: espacamento.sm + 2,
    alignItems: 'center',
  },
  textoBotaoCancelar: {
    fontSize: 13,
    fontWeight: '700',
    color: cores.stone[600],
  },
  botaoConfirmar: {
    flex: 1,
    backgroundColor: cores.green[800],
    borderRadius: raio.md,
    paddingVertical: espacamento.sm + 2,
    alignItems: 'center',
  },
  textoBotaoConfirmar: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  info: {
    flexDirection: 'row',
    gap: espacamento.sm,
    backgroundColor: cores.cream[100],
    borderRadius: raio.md,
    padding: espacamento.sm + 6,
  },
  infoTexto: {
    flex: 1,
    fontSize: 11.5,
    lineHeight: 16,
    color: cores.stone[600],
  },
  rodape: {
    borderTopWidth: 1,
    borderTopColor: cores.cream[100],
    paddingHorizontal: espacamento.xl,
    paddingVertical: espacamento.md,
  },
  botaoPrimario: {
    borderRadius: raio.lg,
    paddingVertical: espacamento.lg - 2,
    alignItems: 'center',
    backgroundColor: cores.green[800],
  },
  botaoDesabilitado: {
    opacity: 0.5,
  },
  textoBotaoPrimario: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
