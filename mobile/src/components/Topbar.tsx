import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { BrandIcon } from './BrandMark';
import { statusAssinaturaRequest } from '../services/assinatura';
import { cores, fontes } from '../theme';

// Equivalente a frontend/src/components/Topbar.tsx: aparece em toda tela com bottom nav
// (docs/specs/mobile/08-navegacao-resumo-e-menu.md). Sem hambúrguer nem sino — Menu é uma aba
// própria da casca, e notificações não existem no produto ainda. `BrandLockup` de BrandMark.tsx
// é vertical (feito pra tela de splash/login), por isso a composição horizontal fica aqui, e
// não como mais uma variante genérica dentro de BrandMark.tsx.
//
// Spec 25 — banner de trial embutido aqui (não só na InicioScreen) porque a Topbar é o único
// elemento renderizado em TODAS as abas da casca (Resumo/Vendas/Despesas/Menu) — é a "home"
// de verdade que o produtor vê no dia a dia depois de entrar numa safra, diferente da tela de
// seleção de safras, que ele só vê uma vez. Bug relatado pelo dev (2026-09-15): o banner só
// aparecia na lista de safras, nunca dentro da safra em si.
export function Topbar() {
  const [diasTrialRestantes, setDiasTrialRestantes] = useState<number | null>(null);

  useEffect(() => {
    statusAssinaturaRequest()
      .then((dados) => {
        if (dados.status === 'TRIAL' && !dados.vencida) {
          const dias = Math.ceil((new Date(dados.dataFimAcesso).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
          setDiasTrialRestantes(Math.max(dias, 0));
        }
      })
      .catch(() => {});
  }, []);

  return (
    <View>
      <View style={styles.container}>
        <BrandIcon tamanho={30} />
        <View>
          <Text style={styles.nome}>HortiFlow</Text>
          <Text style={styles.sufixo}>PRODUTOR</Text>
        </View>
      </View>
      {diasTrialRestantes !== null && (
        <View style={styles.bannerTrial}>
          <Text style={styles.bannerTrialTexto}>
            {diasTrialRestantes === 0
              ? 'Seu teste grátis termina hoje'
              : `Teste grátis · ${diasTrialRestantes} ${diasTrialRestantes === 1 ? 'dia restante' : 'dias restantes'}`}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingBottom: 4,
    paddingTop: 8,
  },
  bannerTrial: {
    backgroundColor: cores.green[100],
    paddingVertical: 6,
    alignItems: 'center',
  },
  bannerTrialTexto: {
    fontSize: 12,
    fontWeight: '700',
    color: cores.green[800],
  },
  nome: {
    fontFamily: fontes.titulo,
    fontSize: 15,
    fontWeight: '800',
    color: cores.green[700],
    lineHeight: 17,
  },
  sufixo: {
    fontSize: 7.5,
    fontWeight: '700',
    letterSpacing: 1.6,
    color: cores.green[600],
  },
});
