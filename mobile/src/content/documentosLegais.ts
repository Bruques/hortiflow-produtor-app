// Spec 26 — conteúdo renderizado nas telas de Termos de Uso e Política de Privacidade.
// Fonte de verdade do TEXTO é docs/legal/ (revisado por advogado antes de publicar) — este
// arquivo é a versão portada pro app; ao atualizar um, atualizar o outro junto.
export interface SecaoDocumentoLegal {
  titulo: string;
  paragrafos: string[];
}

export interface DocumentoLegal {
  titulo: string;
  versao: string;
  atualizadoEm: string;
  intro: string;
  secoes: SecaoDocumentoLegal[];
}

const CONTATO = 'WhatsApp (35) 99730-2015 ou contato.hortiflow@gmail.com';

export const TERMOS_DE_USO: DocumentoLegal = {
  titulo: 'Termos de Uso',
  versao: '1.0',
  atualizadoEm: '15/09/2026',
  intro:
    'Bem-vindo ao HortiFlow Produtor. Ao criar uma conta ou utilizar a plataforma, você concorda com os termos descritos abaixo. Leia com atenção.',
  secoes: [
    {
      titulo: '1. Sobre o HortiFlow Produtor',
      paragrafos: [
        'O HortiFlow Produtor é uma plataforma de gestão para parcerias de meação na produção agrícola, com foco no registro de despesas e vendas da safra, no acompanhamento de um extrato de divisão de lucro entre os sócios da parceria, no controle de despesas pessoais de cada sócio e na organização dos acertos financeiros entre os sócios.',
        'A plataforma tem finalidade administrativa e de organização das informações da parceria e da produção do usuário. Não constitui intermediação financeira, instituição de pagamento, consultoria jurídica, contábil ou agronômica. O cálculo de divisão de lucro exibido na plataforma é uma ferramenta de apoio à gestão e não substitui a conferência dos sócios nem qualquer acordo formal de parceria rural firmado entre eles.',
      ],
    },
    {
      titulo: '2. Cadastro e conta',
      paragrafos: [
        'O acesso é feito por telefone e senha. Ao criar sua conta, você se compromete a fornecer informações verdadeiras, completas e atualizadas; manter a confidencialidade de suas credenciais de acesso; ser responsável por toda atividade realizada com sua conta; e comunicar imediatamente qualquer uso indevido dela.',
        'Você deve ter capacidade civil para utilizar a plataforma e ser o legítimo responsável pelas informações inseridas.',
      ],
    },
    {
      titulo: '3. Sociedades e dados de outros sócios',
      paragrafos: [
        'Ao criar uma Sociedade (parceria de meação) na plataforma e nela inserir sócios, despesas, vendas ou qualquer outra informação referente a outra pessoa — inclusive um sócio que nunca acessou o aplicativo e não possui conta própria — você declara ter autorização dessa pessoa para fazê-lo e é responsável pela veracidade dessas informações perante os demais sócios da parceria.',
        'Dentro de uma mesma Sociedade, despesas, vendas e o extrato de divisão são visíveis a todos os sócios daquela parceria, como parte central da proposta de transparência da plataforma — isso não se aplica entre sociedades diferentes, que permanecem isoladas entre si.',
        'As despesas pessoais registradas por cada sócio são privadas: visíveis apenas a quem as lançou, não compartilhadas com os demais sócios e não utilizadas em nenhum cálculo de divisão da sociedade.',
      ],
    },
    {
      titulo: '4. Uso adequado da plataforma',
      paragrafos: [
        'Você concorda em não praticar, direta ou indiretamente: tentativa de acesso não autorizado à plataforma, seus sistemas ou dados de outros usuários; exploração de vulnerabilidades ou falhas de segurança; manipulação maliciosa da plataforma, de seus registros ou dos cálculos exibidos; engenharia reversa do software, código ou fluxos da plataforma; uso de automações, bots ou scripts para uso abusivo ou não autorizado; ou qualquer conduta que prejudique, sobrecarregue ou interrompa o funcionamento da plataforma.',
        'O descumprimento pode resultar em suspensão ou encerramento da conta, sem prejuízo das medidas legais cabíveis.',
      ],
    },
    {
      titulo: '5. Informações inseridas pelo usuário',
      paragrafos: [
        'Você é o único responsável pela veracidade, legitimidade e atualização das informações inseridas na plataforma — despesas, vendas, percentuais de divisão, dados de sócios e demais lançamentos. O HortiFlow Produtor realiza cálculos com base nessas informações; erros ou omissões no que foi inserido se refletem no extrato e no cálculo de divisão exibidos.',
      ],
    },
    {
      titulo: '6. Disponibilidade do serviço',
      paragrafos: [
        'A plataforma pode estar sujeita a manutenções, atualizações, falhas técnicas ou indisponibilidades temporárias, inclusive por fatores fora do nosso controle. Não garantimos disponibilidade ininterrupta, dentro dos limites legais.',
        'O aplicativo mobile foi desenhado para funcionar parcialmente sem conexão de internet (dados já carregados continuam disponíveis, e lançamentos feitos offline são sincronizados quando a conexão voltar) — isso não elimina a possibilidade de indisponibilidade do serviço como um todo.',
      ],
    },
    {
      titulo: '7. Planos, pagamentos e cancelamento',
      paragrafos: [
        'A utilização da plataforma pode envolver planos pagos, conforme efetivamente disponibilizados no aplicativo. As condições comerciais vigentes (valores, ciclo mensal ou anual, formas de pagamento e eventuais períodos de teste) são as apresentadas no momento da contratação dentro do próprio aplicativo. Em caso de divergência, prevalece o que estiver expressamente registrado na plataforma.',
        'Pagamentos são processados por prestadores de pagamento terceirizados (gateways de pagamento) — não armazenamos dados completos de cartão de crédito.',
        'Você pode cancelar a utilização a qualquer tempo. Eventuais cobranças já realizadas obedecerão à legislação aplicável e às condições contratadas.',
      ],
    },
    {
      titulo: '8. Propriedade intelectual',
      paragrafos: [
        'A marca HortiFlow Produtor, o software, o código, a identidade visual, os textos, o layout e os demais elementos da plataforma são protegidos por direitos de propriedade intelectual. É vedado copiar, reproduzir, distribuir, modificar ou explorar comercialmente a plataforma ou seus elementos sem autorização.',
      ],
    },
    {
      titulo: '9. Encerramento da conta',
      paragrafos: [
        'Você pode excluir sua conta a qualquer momento, diretamente pelo aplicativo (Configurações → Conta). Se você for o titular de uma ou mais sociedades, a exclusão da sua conta apaga definitivamente essas sociedades e todos os dados nelas contidos — despesas, vendas, acertos e despesas pessoais de outros sócios lançadas nelas —, conforme aviso exibido antes da confirmação.',
        'Podemos suspender ou encerrar contas em caso de descumprimento destes Termos, uso indevido ou exigência legal, respeitando a legislação aplicável e os direitos do usuário.',
      ],
    },
    {
      titulo: '10. Alteração dos Termos',
      paragrafos: [
        'Estes Termos podem ser atualizados periodicamente. A versão vigente e a data de atualização estão indicadas no início deste documento. Quando a atualização exigir novo aceite, ele será solicitado no aplicativo, e o histórico de aceites é preservado.',
      ],
    },
    {
      titulo: '11. Legislação aplicável',
      paragrafos: [
        'Estes Termos são regidos pela legislação brasileira, em especial pelas normas de proteção e defesa do consumidor aplicáveis. Nenhuma cláusula destes Termos tem por finalidade excluir responsabilidades que, por lei, não possam ser excluídas.',
      ],
    },
    {
      titulo: '12. Contato',
      paragrafos: [`Para dúvidas relacionadas a estes Termos: ${CONTATO}.`],
    },
  ],
};

export const POLITICA_DE_PRIVACIDADE: DocumentoLegal = {
  titulo: 'Política de Privacidade',
  versao: '1.0',
  atualizadoEm: '15/09/2026',
  intro:
    'Esta Política descreve como o HortiFlow Produtor trata os dados pessoais necessários ao funcionamento da plataforma, em conformidade com a Lei Geral de Proteção de Dados — LGPD (Lei nº 13.709/2018).',
  secoes: [
    {
      titulo: '1. Dados tratados',
      paragrafos: [
        'Tratamos somente os dados necessários ao funcionamento da plataforma e à prestação do serviço: dados de cadastro e conta (nome e telefone, usados para autenticação — a senha é armazenada de forma criptografada, nunca em texto puro); informações inseridas pelo produtor (dados de sociedades, sócios, safras, despesas, vendas, percentuais de divisão de lucro e acertos financeiros); despesas pessoais (dados financeiros privados de cada sócio, não relacionados à sociedade); dados técnicos necessários ao funcionamento (operar a plataforma, manter a sessão autenticada e garantir a segurança); trilha de auditoria (registro de quem realizou cada lançamento e quando, para rastreabilidade entre sócios da mesma parceria); e informações relacionadas a pagamentos, quando você contrata um plano pago.',
        'Não armazenamos dados completos de cartão de crédito — esse processamento é feito diretamente pelo prestador de pagamento. Não coletamos nem tratamos dados além dos necessários às finalidades aqui descritas.',
      ],
    },
    {
      titulo: '2. Finalidade',
      paragrafos: [
        'Os dados são tratados para: funcionamento e prestação do serviço, incluindo o cálculo do extrato de divisão de lucro entre sócios; autenticação e controle de acesso; organização das informações da parceria; geração da trilha de auditoria; suporte ao usuário; segurança da plataforma e prevenção de fraude/abuso; processamento de pagamentos, quando aplicável; e cumprimento de obrigações legais.',
      ],
    },
    {
      titulo: '3. Compartilhamento entre sócios da mesma parceria',
      paragrafos: [
        'Diferente de um app de uso individual, o HortiFlow Produtor é feito para ser usado em conjunto pelos sócios de uma mesma parceria: despesas, vendas e o extrato de divisão de lucro lançados em uma Sociedade são visíveis a todos os sócios daquela sociedade, incluindo aqueles inseridos sem que essa pessoa tenha efetivamente acessado o aplicativo — essa transparência entre os sócios é o propósito central do produto e faz parte do serviço contratado.',
        'Essa visibilidade não se estende entre sociedades diferentes: os dados de uma sociedade não são acessíveis a sócios de outra sociedade. Despesas pessoais nunca são compartilhadas com outros sócios, mesmo dentro da mesma sociedade.',
      ],
    },
    {
      titulo: '4. Compartilhamento com terceiros',
      paragrafos: [
        'Os dados podem ser compartilhados, na medida do estritamente necessário, com: prestadores de infraestrutura tecnológica que dão suporte ao funcionamento da plataforma (hospedagem do banco de dados, do backend e do frontend); prestadores de pagamento, nas operações em que houver cobrança de plano; e autoridades públicas, quando houver obrigação legal.',
      ],
    },
    {
      titulo: '5. Segurança',
      paragrafos: [
        'Adotamos medidas de segurança compatíveis com a natureza dos dados tratados, incluindo controle de acesso por autenticação, isolamento entre sociedades e senha armazenada de forma criptografada. Nenhuma medida de segurança garante proteção absoluta.',
      ],
    },
    {
      titulo: '6. Armazenamento e retenção',
      paragrafos: [
        'Os dados são mantidos pelo período necessário à prestação do serviço, ao cumprimento de obrigações legais, à segurança da plataforma e ao exercício regular de direitos.',
        'Ao excluir sua conta pelo aplicativo, os dados são tratados conforme descrito no fluxo de exclusão de conta: dados de sociedades das quais você é titular são apagados definitivamente; dados que ainda sejam necessários à integridade do extrato de outros sócios podem ser anonimizados em vez de apagados, preservando o histórico deles.',
      ],
    },
    {
      titulo: '7. Direitos do titular',
      paragrafos: [
        'Nos termos da LGPD, você pode exercer, conforme aplicável: acesso aos dados tratados; correção e atualização de dados; informações sobre o tratamento; eliminação de dados, nos casos previstos em lei; portabilidade, quando aplicável; e revogação do consentimento, quando o tratamento se basear em consentimento.',
      ],
    },
    {
      titulo: '8. Solicitações de privacidade',
      paragrafos: [`Solicitações relacionadas à privacidade devem ser encaminhadas para ${CONTATO}.`],
    },
    {
      titulo: '9. Cookies e tecnologias semelhantes',
      paragrafos: [
        'A plataforma utiliza somente as tecnologias necessárias ao seu funcionamento, à manutenção da sessão de acesso e à segurança. Não utilizamos cookies de publicidade de terceiros nem tecnologias de rastreamento que não sejam necessárias ao serviço.',
      ],
    },
    {
      titulo: '10. Atualizações',
      paragrafos: [
        'Esta Política pode ser atualizada periodicamente. A versão vigente e a data de atualização estão indicadas no início deste documento. Quando a atualização exigir novo aceite, ele será solicitado no aplicativo, e o histórico de aceites é preservado.',
      ],
    },
    {
      titulo: '11. Contato',
      paragrafos: [`Para solicitações de privacidade: ${CONTATO}.`],
    },
  ],
};
