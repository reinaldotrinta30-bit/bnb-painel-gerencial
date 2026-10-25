'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { CardKanban, RegistroContratacao } from '@/types/painel';
import {
  parseMoeda,
  formatarMoedaBD,
  mascaraDocumento,
  mascaraMoedaInput,
} from '@/lib/utils';

interface AbaParecerTecnicoCardProps {
  card: CardKanban;
  operacoesCliente: RegistroContratacao[];
}

interface ImovelBeneficiadoForm {
  id: string;
  nome: string;
  matricula: string;
  cidadeUf: string;
  areaHa: string;
}

interface IntervenienteForm {
  id: string;
  nome: string;
  cpf: string;
  posse: string;
}

interface ImovelGarantiaForm {
  id: string;
  tipo: 'LCGA' | 'LCGH';
  nome: string;
  matricula: string;
  cidadeUf: string;
  posseTitular: string;
  valorAvaliado: string;
  intervenientes: IntervenienteForm[];
}

interface RestricaoLeveForm {
  id: string;
  descricao: string;
  valor: string;
}

const STORAGE_KEY_ASSINATURAS_PARECER = 'bnb_v2_assinaturas_parecer';

const OPCOES_ATIVIDADE_ECONOMICA = [
  'Criação de Bovinos para corte (extensiva)',
  'Criação de Bovinos para corte (semi-intensiva)',
  'Criação de Bovinos para leite (extensiva)',
  'Criação de Bovinos para leite (semi-intensiva)',
  'Bovinocultura de corte',
  'Bovinocultura de leite',
];

const TEXTO_RESERVA_LEGAL_ATE_4MF =
  'Suficiência da reserva legal: o imóvel abaixo de 4 módulos com CAR com indicação de área rural consolidada, atendendo aos subitens 1.1, 1.2 e 1.3 da Tabela 2 do normativo 3102-03-27 - Impedimentos Sociais, Ambientais e Climáticos (Conformidade Socioambiental) e Críticas SICOR.';

const TEXTO_RESERVA_LEGAL_ACIMA_4MF =
  'Suficiência da reserva legal: imóvel com área superior a 4 módulos fiscais com Reserva Legal e área rural consolidada devidamente demonstradas no CAR, em conformidade com o normativo 3102-03-27 - Impedimentos Sociais, Ambientais e Climáticos (Conformidade Socioambiental) e Críticas SICOR.';

const ui = {
  sectionCard: {
    background: '#ffffff',
    border: '1px solid #e2e8f0',
    borderRadius: '10px',
    padding: '16px 18px',
    boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '14px',
  },
  sectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottom: '1px solid #f1f5f9',
    paddingBottom: '8px',
    flexWrap: 'wrap' as const,
    gap: '8px',
  },
  sectionTitle: {
    fontSize: '12.5px',
    fontWeight: 800,
    color: '#8B1530',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.3px',
    margin: 0,
  },
  label: {
    fontSize: '11px',
    fontWeight: 700,
    color: '#475569',
    marginBottom: '5px',
    display: 'block',
  },
  input: {
    width: '100%',
    height: '36px',
    padding: '6px 10px',
    fontSize: '12.5px',
    lineHeight: '1.25',
    color: '#0f172a',
    backgroundColor: '#ffffff',
    border: '1px solid #cbd5e1',
    borderRadius: '6px',
    boxSizing: 'border-box' as const,
  },
  select: {
    width: '100%',
    height: '36px',
    padding: '4px 10px',
    fontSize: '12.5px',
    lineHeight: '1.25',
    color: '#0f172a',
    backgroundColor: '#ffffff',
    border: '1px solid #cbd5e1',
    borderRadius: '6px',
    boxSizing: 'border-box' as const,
    cursor: 'pointer',
  },
};

function formatarProgramaOficialParecer(progBruto: string): string {
  const p = (progBruto || '').trim();
  if (p.includes('368')) {
    return 'FNE/PRONAF GRUPO "A" - FNE (368)';
  }
  if (p.includes('699')) {
    return 'FNE/PRONAF A - RES.5.183/24 (699)';
  }
  return p || '[Informar Programa]';
}

// Formata em negrito (<strong>) todos os títulos de seções e rótulos fixos solicitados nos Itens 2, 2.1 e 3
function formatarParecerHtmlComNegrito(textoPuro: string): string {
  const escapado = (textoPuro || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  return escapado
    // Rótulos fixos do cabeçalho PRONAF A (Item 2.1)
    .replace(/^(PROGRAMA:)/gm, '<strong>$1</strong>')
    .replace(
      /^(Cliente:|CPF:|Valor Financiado:|Finalidade:|Prazo Total:|Carência:|Objetivo:|Garantia:)/gm,
      '<strong>$1</strong>'
    )
    .replace(/^(Atividade Econômica –)/gm, '<strong>$1</strong>')
    // Tópicos numerados dos 3 modelos (Itens 2, 2.1 e 3)
    .replace(
      /^(\d+\.\s*(?:PROPOSTA DE CRÉDITO:|INFORMAÇÕES DO PLEITO:|GARANTIAS?:|HISTÓRICO DO CLIENTE:?|HISTÓRICO:|IMÓVEIS OBJETOS DO PLEITO:|IM[ÓO]VEL:|PROPOSTA:?|PARECER CONCLUSIVO:|PARECER:?))$/gm,
      '<strong>$1</strong>'
    );
}

function numeroParaExtenso(valorBruto: string | number): string {
  const n = parseInt(String(valorBruto).replace(/\D/g, ''), 10);
  if (isNaN(n) || n <= 0) return 'zero';

  const mapaExato: Record<number, string> = {
    1: 'um',
    2: 'dois',
    3: 'três',
    6: 'seis',
    12: 'doze',
    18: 'dezoito',
    24: 'vinte e quatro',
    36: 'trinta e seis',
    48: 'quarenta e oito',
    60: 'sessenta',
    72: 'setenta e dois',
    84: 'oitenta e quatro',
    96: 'noventa e seis',
    108: 'cento e oito',
    120: 'cento e vinte',
    144: 'cento e quarenta e quatro',
    180: 'cento e oitenta',
    240: 'duzentos e quarenta',
  };
  if (mapaExato[n]) return mapaExato[n];

  const unidades = ['', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove'];
  const dezADezenove = [
    'dez',
    'onze',
    'doze',
    'treze',
    'quatorze',
    'quinze',
    'dezesseis',
    'dezessete',
    'dezoito',
    'dezenove',
  ];
  const dezenas = [
    '',
    '',
    'vinte',
    'trinta',
    'quarenta',
    'cinquenta',
    'sessenta',
    'setenta',
    'oitenta',
    'noventa',
  ];
  const centenas = [
    '',
    'cento',
    'duzentos',
    'trezentos',
    'quatrocentos',
    'quinhentos',
    'seiscentos',
    'setecentos',
    'oitocentos',
    'novecentos',
  ];

  if (n === 100) return 'cem';
  if (n < 10) return unidades[n];
  if (n < 20) return dezADezenove[n - 10];
  if (n < 100) {
    const d = Math.floor(n / 10);
    const u = n % 10;
    return u === 0 ? dezenas[d] : `${dezenas[d]} e ${unidades[u]}`;
  }
  if (n < 1000) {
    const c = Math.floor(n / 100);
    const resto = n % 100;
    return resto === 0 ? centenas[c] : `${centenas[c]} e ${numeroParaExtenso(resto)}`;
  }
  return String(n);
}

export default function AbaParecerTecnicoCard({
  card,
  operacoesCliente,
}: AbaParecerTecnicoCardProps) {
  // 1. Seleção da Operação Base do Parecer
  const [opSelecionadaId, setOpSelecionadaId] = useState<string>(() => {
    const deriv = operacoesCliente.find(
      (o) => !['LCGH', 'LCGA'].includes((o.tipo || '').toUpperCase().trim())
    );
    return deriv?.id || operacoesCliente[0]?.id || 'card_default';
  });

  const opAtiva = useMemo(() => {
    return (
      operacoesCliente.find((o) => String(o.id) === String(opSelecionadaId)) ||
      operacoesCliente[0]
    );
  }, [operacoesCliente, opSelecionadaId]);

  // Identifica o Modelo de Parecer ("PRONAF_A" | "INV_CUSTEIO" | "LIMITE_LCG")
  const [modeloAtivo, setModeloAtivo] = useState<'PRONAF_A' | 'INV_CUSTEIO' | 'LIMITE_LCG'>(
    'PRONAF_A'
  );

  // Dados Gerais Comuns
  const [nomeCliente, setNomeCliente] = useState('');
  const [cpfCliente, setCpfCliente] = useState('');
  const [porteCliente, setPorteCliente] = useState('PRONAF V');
  const [tipoOperacao, setTipoOperacao] = useState('Investimento');
  const [valorOperacao, setValorOperacao] = useState('');
  const [programaCredito, setProgramaCredito] = useState('FNE/PRONAF A - RES.5.183/24 (699)');
  const [prazoMeses, setPrazoMeses] = useState('120');
  const [carenciaMeses, setCarenciaMeses] = useState('36');
  const [objetivoPleito, setObjetivoPleito] = useState('Ampliação');
  const [notaRisco, setNotaRisco] = useState('AA');

  // Histórico e Atividade
  const [anoInicioRel, setAnoInicioRel] = useState(() => String(new Date().getFullYear()));
  const [statusAdimplencia, setStatusAdimplencia] = useState('está adimplente');
  const [statusAtrasos, setStatusAtrasos] = useState('sem atrasos');
  const [setorAtividade, setSetorAtividade] = useState<'Pecuária' | 'Agricultura'>('Pecuária');
  const [descAtividadeCabecalho, setDescAtividadeCabecalho] = useState(
    'Criação de Bovinos para corte (semi-intensiva)'
  );
  const [verboAtividadeTexto, setVerboAtividadeTexto] = useState('Bovinocultura de corte');
  const [itensFinanciadosTexto, setItensFinanciadosTexto] = useState(
    'FORMAÇÃO 1 HA DE PASTAGEM CAPIM BRACHIARIA, AQ. DE REPRODUTOR BOVINO MESTIÇO ZEBUINO APTIDÃO CORTE, AQ. DE MATRIZES BOVINAS APTIDÃO CORTE'
  );

  // Regra dos 4 Módulos Fiscais (Automático para PRONAF/PRONAF A | Perguntado para MINI)
  const [abaixoQuatroModulos, setAbaixoQuatroModulos] = useState<'SIM' | 'NAO' | 'PERGUNTAR'>(
    'SIM'
  );

  // Campos Ambientais e Lista de Múltiplas Restrições Leves
  const [idDcaa, setIdDcaa] = useState('');
  const [idSema, setIdSema] = useState('');
  const [possuiRestricaoLeve22, setPossuiRestricaoLeve22] = useState<'NAO' | 'SIM'>('NAO');
  const [listaRestricoes22, setListaRestricoes22] = useState<RestricaoLeveForm[]>([
    { id: 'rest_1', descricao: 'PEFIN comercial (CAEMA)', valor: '127,82' },
  ]);

  // Campos Específicos de LCGH / LCGA
  const [idEnderecoFora, setIdEnderecoFora] = useState('');
  const [idRendaExtra, setIdRendaExtra] = useState('');

  // Campos Específicos de Investimento / Custeio (PRONAF V e MINI)
  const [valorAssessoria, setValorAssessoria] = useState('0,00');
  const [assessoriaPropria, setAssessoriaPropria] = useState<'NÃO' | 'SIM'>('NÃO');
  const [modoCalculoAssessoriaFinanciada, setModoCalculoAssessoriaFinanciada] = useState<
    'SOMAR_AO_VALOR' | 'DEDUZIR_DO_TOTAL'
  >('SOMAR_AO_VALOR');
  const [metodologiaJuros, setMetodologiaJuros] = useState<'pré-fixada' | 'pós-fixada'>(
    'pré-fixada'
  );
  const [temFundoLiquidez, setTemFundoLiquidez] = useState<'NÃO' | 'SIM'>('NÃO');
  const [valorFundoLiquidez, setValorFundoLiquidez] = useState('0,00');
  const [contaReservaFundo, setContaReservaFundo] = useState('');
  const [contaDesembolso, setContaDesembolso] = useState('');
  const [saldoDevedorEmSer, setSaldoDevedorEmSer] = useState('0,00');
  const [garantiaComprometida, setGarantiaComprometida] = useState('0,00');

  // Relacionamento Negocial Opcional (Desmarcado por padrão; oculto para LCGH/LCGA)
  const [incluirRelacionamentoNegocial, setIncluirRelacionamentoNegocial] = useState(false);
  const [valSeguroPrestamista, setValSeguroPrestamista] = useState('0,00');
  const [valAplicacaoAutomatica, setValAplicacaoAutomatica] = useState('0,00');

  // Garantia Fidejussória (Aval / Fiança)
  const [temFidejussoria, setTemFidejussoria] = useState<'NÃO' | 'SIM'>('NÃO');
  const [tipoFidejussoria, setTipoFidejussoria] = useState<'Aval' | 'Fiança'>('Aval');
  const [nomeAvalista, setNomeAvalista] = useState('');
  const [cpfAvalista, setCpfAvalista] = useState('');
  const [rendaAnualAvalista, setRendaAnualAvalista] = useState('0,00');

  // Imóveis Beneficiados (PRONAF A / PRONAF V / MINI)
  const [imoveisBeneficiados, setImoveisBeneficiados] = useState<ImovelBeneficiadoForm[]>([
    {
      id: 'ben_1',
      nome: 'PA LAGO DA CARNAUBA',
      matricula: '',
      cidadeUf: 'PIO XII - MA',
      areaHa: '25',
    },
  ]);

  // Imóveis em Garantia Real (LCGH / LCGA e Inv/Custeio)
  const [temGarantiaRealInv, setTemGarantiaRealInv] = useState<'NÃO' | 'SIM'>('NÃO');
  const [imoveisGarantia, setImoveisGarantia] = useState<ImovelGarantiaForm[]>([
    {
      id: 'gar_1',
      tipo: 'LCGH',
      nome: '',
      matricula: '',
      cidadeUf: 'SANTA INÊS - MA',
      posseTitular: '100',
      valorAvaliado: '0,00',
      intervenientes: [],
    },
  ]);

  // Assinaturas com Persistência Local
  const [gerenteRelacionamento, setGerenteRelacionamento] = useState(
    'Kerllys Ruan Ferreira da Silva - F180227'
  );
  const [gerenteRelEE, setGerenteRelEE] = useState(false);
  const [gerenteAgencia, setGerenteAgencia] = useState('Josenildo Nunes da Costa - F120286');
  const [gerenteAgEE, setGerenteAgEE] = useState(false);

  // Texto Final do Parecer (Editável com suporte a Negrito visual)
  const [textoParecerFinal, setTextoParecerFinal] = useState('');
  const [editouTextoManualmente, setEditouTextoManualmente] = useState(false);
  const editorParecerRef = useRef<HTMLDivElement>(null);

  // Regras de Teto do Relacionamento Negocial por Porte (5% PRONAF / PRONAF A | 10% MINI e demais)
  const percMaximoRelacionamento = useMemo(() => {
    return porteCliente.toUpperCase().includes('PRONAF') ? 0.05 : 0.1;
  }, [porteCliente]);

  const tetoMaximoRelacionamentoReais = useMemo(() => {
    return parseMoeda(valorOperacao) * percMaximoRelacionamento;
  }, [valorOperacao, percMaximoRelacionamento]);

  const recalcularRelacionamentoNegocialPadrao = (
    valorBaseStr: string,
    porteBaseStr: string
  ) => {
    const vNum = parseMoeda(valorBaseStr);
    const percMax = porteBaseStr.toUpperCase().includes('PRONAF') ? 0.05 : 0.1;
    const tetoMax = vNum * percMax;
    const seguroPadrao = Math.min(tetoMax, vNum * 0.0384);
    const aplicacaoPadrao = Math.max(0, tetoMax - seguroPadrao);
    setValSeguroPrestamista(formatarMoedaBD(seguroPadrao));
    setValAplicacaoAutomatica(formatarMoedaBD(aplicacaoPadrao));
  };

  const handleAlterarSeguroPrestamista = (inputBruto: string) => {
    setEditouTextoManualmente(false);
    const formatado = mascaraMoedaInput(inputBruto);
    const novoSegNum = parseMoeda(formatado);
    const tetoMax = tetoMaximoRelacionamentoReais;

    if (tetoMax > 0 && novoSegNum > tetoMax) {
      setValSeguroPrestamista(formatarMoedaBD(tetoMax));
      setValAplicacaoAutomatica('0,00');
      return;
    }

    setValSeguroPrestamista(formatado);
    const aplicAtualNum = parseMoeda(valAplicacaoAutomatica);
    if (tetoMax > 0 && novoSegNum + aplicAtualNum > tetoMax) {
      setValAplicacaoAutomatica(formatarMoedaBD(Math.max(0, tetoMax - novoSegNum)));
    }
  };

  const handleAlterarAplicacaoAutomatica = (inputBruto: string) => {
    setEditouTextoManualmente(false);
    const formatado = mascaraMoedaInput(inputBruto);
    const novaAplicNum = parseMoeda(formatado);
    const segAtualNum = parseMoeda(valSeguroPrestamista);
    const tetoMax = tetoMaximoRelacionamentoReais;

    if (tetoMax > 0 && segAtualNum + novaAplicNum > tetoMax) {
      const maxAplicPermitida = Math.max(0, tetoMax - segAtualNum);
      setValAplicacaoAutomatica(formatarMoedaBD(maxAplicPermitida));
      return;
    }

    setValAplicacaoAutomatica(formatado);
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const salvo = window.localStorage.getItem(STORAGE_KEY_ASSINATURAS_PARECER);
      if (salvo) {
        const parsed = JSON.parse(salvo);
        if (parsed.gerenteRelacionamento) setGerenteRelacionamento(parsed.gerenteRelacionamento);
        if (parsed.gerenteAgencia) setGerenteAgencia(parsed.gerenteAgencia);
      }
    } catch {
      // Ignora erro
    }
  }, []);

  const salvarAssinaturasNoCache = (rel: string, ag: string) => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(
        STORAGE_KEY_ASSINATURAS_PARECER,
        JSON.stringify({ gerenteRelacionamento: rel, gerenteAgencia: ag })
      );
    } catch {
      // Ignora erro
    }
  };

  useEffect(() => {
    const cli = (opAtiva?.cliente || card.clienteVinculado || '').toUpperCase().trim();
    const cpf = opAtiva?.cpf || card.cpfVinculado || '';
    const prt = (opAtiva?.porte || card.porteVinculado || 'PRONAF V').toUpperCase().trim();
    const tOp = opAtiva?.tipo || card.tipoOpVinculado || 'Investimento';
    const valOp = opAtiva?.valor || card.valorVinculado || '0,00';
    const progOp = opAtiva?.programa || '';

    setNomeCliente(cli);
    setCpfCliente(cpf);
    setPorteCliente(prt);
    setTipoOperacao(tOp);
    setValorOperacao(valOp);

    setIncluirRelacionamentoNegocial(false);
    recalcularRelacionamentoNegocialPadrao(valOp, prt);

    const tUp = tOp.toUpperCase().trim();
    if (tUp === 'LCGH' || tUp === 'LCGA') {
      setModeloAtivo('LIMITE_LCG');
      setPrazoMeses('120');
      setProgramaCredito(tUp === 'LCGH' ? '(975) HIPOTECA' : '(653) ALI. FID.');
    } else if (prt === 'PRONAF A') {
      setModeloAtivo('PRONAF_A');
      setPrazoMeses('120');
      setCarenciaMeses('36');
      setProgramaCredito(
        formatarProgramaOficialParecer(progOp || 'FNE/PRONAF A - RES.5.183/24 (699)')
      );
    } else {
      setModeloAtivo('INV_CUSTEIO');
      setPrazoMeses(tUp.includes('CUSTEIO') ? '24' : '96');
      setCarenciaMeses(tUp.includes('CUSTEIO') ? '0' : '24');
      setProgramaCredito(
        formatarProgramaOficialParecer(
          progOp ||
            (prt.includes('PRONAF')
              ? 'FNE /PRONAF - COMUM (FNE) (433)'
              : 'FNE /RURAL (226)')
        )
      );
    }

    if (prt.includes('PRONAF')) {
      setAbaixoQuatroModulos('SIM');
    } else {
      setAbaixoQuatroModulos('PERGUNTAR');
    }

    if (prt === 'MINI') {
      setTemFundoLiquidez('SIM');
      const vNum = parseMoeda(valOp);
      setValorFundoLiquidez(formatarMoedaBD(vNum * 0.05));
    } else {
      setTemFundoLiquidez('NÃO');
      setValorFundoLiquidez('0,00');
    }

    const regComAval =
      operacoesCliente.find((o) => o.avalistaNome || o.avalistaCpf) || opAtiva;
    if (regComAval?.avalistaNome || regComAval?.avalistaCpf) {
      setTemFidejussoria('SIM');
      setNomeAvalista(regComAval.avalistaNome || '');
      setCpfAvalista(regComAval.avalistaCpf || '');
    }

    const opLim = operacoesCliente.find((o) =>
      ['LCGH', 'LCGA'].includes((o.tipo || '').toUpperCase().trim())
    );
    if (opLim && prt !== 'PRONAF A') {
      setTemGarantiaRealInv('SIM');
      setImoveisGarantia((prev) => [
        {
          ...prev[0],
          tipo: (opLim.tipo.toUpperCase().trim() as 'LCGH' | 'LCGA') || 'LCGH',
          valorAvaliado: opLim.valor || prev[0].valorAvaliado,
        },
      ]);
    }

    const textoCardCompleto = `${card.textoPuro || ''} ${card.espacoAnaliseVinculado || ''}`;
    const mDcaa = textoCardCompleto.match(/DCAA[^0-9]*(\d{5,15})/i);
    if (mDcaa && mDcaa[1]) setIdDcaa(mDcaa[1]);

    const mSema = textoCardCompleto.match(/SEMA[^0-9]*(\d{5,15})/i);
    if (mSema && mSema[1]) setIdSema(mSema[1]);

    const mEnd = textoCardCompleto.match(/ENDERE[ÇC]O[^0-9]*(\d{5,15})/i);
    if (mEnd && mEnd[1]) setIdEnderecoFora(mEnd[1]);

    const mRenda = textoCardCompleto.match(/RENDA[^0-9]*(\d{5,15})/i);
    if (mRenda && mRenda[1]) setIdRendaExtra(mRenda[1]);

    setEditouTextoManualmente(false);
  }, [opAtiva, card, operacoesCliente]);

  useEffect(() => {
    if (temFundoLiquidez === 'SIM') {
      const vNum = parseMoeda(valorOperacao);
      setValorFundoLiquidez(formatarMoedaBD(vNum * 0.05));
    } else {
      setValorFundoLiquidez('0,00');
    }
  }, [temFundoLiquidez, valorOperacao]);

  const montarTextoRestricoesLeves = (): string => {
    const validas = listaRestricoes22.filter((r) => r.descricao.trim() !== '');
    if (validas.length === 0) {
      return 'Cliente possui pendência cadastral de baixa relevância, em andamento para resolução, não sendo impeditiva à concessão do crédito conforme norma nº 1038-05-02 (nota 34).';
    }

    const partes = validas.map((r) => {
      const desc = r.descricao.trim();
      const valNum = parseMoeda(r.valor);
      if (r.valor.trim() !== '' && valNum > 0) {
        return `${desc}, no valor de R$ ${r.valor.trim()}`;
      }
      return desc;
    });

    if (partes.length === 1) {
      return `Cliente possui pendência ${partes[0]}, em andamento para resolução, não sendo impeditiva à concessão do crédito conforme norma nº 1038-05-02 (nota 34).`;
    }

    const copia = [...partes];
    const ultima = copia.pop();
    return `Cliente possui pendências (${copia.join('; ')} e ${ultima}), em andamento para resolução, não sendo impeditivas à concessão do crédito conforme norma nº 1038-05-02 (nota 34).`;
  };

  // =========================================================================
  // MOTOR DE GERAÇÃO DOS 3 MODELOS DE PARECERES OFICIAIS
  // =========================================================================
  const construirTextoParecer = (): string => {
    const nome = (nomeCliente || '[NOME DO CLIENTE]').toUpperCase().trim();
    const cpf = cpfCliente || '[CPF]';
    const primeiroNome = nome.split(' ')[0] || '';
    const tratamento = primeiroNome.toLowerCase().endsWith('a') ? 'A Sr.ª' : 'O Sr.';
    const programaFormatado = formatarProgramaOficialParecer(programaCredito);

    const anoIni = parseInt(anoInicioRel, 10) || new Date().getFullYear();
    const anoAtual = new Date().getFullYear();
    const difAnos = anoAtual - anoIni;

    let txtRelacionamentoSimples = '';
    let txtRelacionamentoGeral = '';
    if (anoIni >= anoAtual) {
      txtRelacionamentoSimples = 'e está iniciando seu relacionamento com o banco';
      txtRelacionamentoGeral = ' e está iniciando seu relacionamento com o banco';
    } else {
      const tempoTxt =
        difAnos >= 25
          ? `há mais de 25 anos (desde ${anoIni})`
          : `há ${difAnos} anos (desde ${anoIni})`;
      const pronafianoTxt =
        porteCliente === 'PRONAF V'
          ? ', pronafiano comum, e tem relacionamento com o banco '
          : ' e tem relacionamento com o banco ';
      txtRelacionamentoSimples = `e tem relacionamento com o banco ${tempoTxt}`;
      txtRelacionamentoGeral = `${pronafianoTxt}${tempoTxt}`;
    }

    const verboExplora = (verboAtividadeTexto || 'bovinocultura de corte').toLowerCase().trim();
    const descAtiv = (descAtividadeCabecalho || verboExplora).trim();

    const listaItens = itensFinanciadosTexto
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    let itensConcatenados = '[Itens a financiar]';
    if (listaItens.length === 1) {
      itensConcatenados = listaItens[0];
    } else if (listaItens.length > 1) {
      const copia = [...listaItens];
      const ultimo = copia.pop();
      itensConcatenados = `${copia.join(', ')} e ${ultimo}`;
    }

    const isAte4Modulos =
      porteCliente.includes('PRONAF') || abaixoQuatroModulos !== 'NAO';
    const textoReservaLegalAplicavel = isAte4Modulos
      ? TEXTO_RESERVA_LEGAL_ATE_4MF
      : TEXTO_RESERVA_LEGAL_ACIMA_4MF;

    const sufixoRelEE = gerenteRelEE ? ' e.e.' : '';
    const sufixoAgEE = gerenteAgEE ? ' e.e.' : '';

    // -----------------------------------------------------------------------
    // MODELO 1: PRONAF A (NUMERAÇÃO 1 A 6 + ESPAÇAMENTOS DE 1 LINHA — ITEM 2.1)
    // -----------------------------------------------------------------------
    if (modeloAtivo === 'PRONAF_A') {
      const imoPrincipal = imoveisBeneficiados[0] || {
        nome: '[NOME DO ASSENTAMENTO/PA]',
        cidadeUf: '[MUNICÍPIO - UF]',
      };
      const nomePA = (imoPrincipal.nome || '[PA]').toUpperCase().trim();
      const cidadePA = (imoPrincipal.cidadeUf || '[MUNICÍPIO - UF]').toUpperCase().trim();
      const garantiaTxt =
        temFidejussoria === 'SIM' && nomeAvalista
          ? `${tipoFidejussoria} (${nomeAvalista})`
          : 'não possui Avalistas/Fiadores';

      const blocoItem22 =
        possuiRestricaoLeve22 === 'SIM' ? `\n2.2) ${montarTextoRestricoesLeves()}` : '';

      const blocoRelacionamentoPronafA = incluirRelacionamentoNegocial
        ? `\n9) Relacionamento negocial: seguro prestamista no valor de R$ ${
            valSeguroPrestamista || '0,00'
          } a ser contratado e aplicação automática de R$ ${valAplicacaoAutomatica || '0,00'}.`
        : '';

      return (
        `PROGRAMA: ${programaFormatado}\n\n` +
        `Cliente: ${nome}\n` +
        `CPF: ${cpf}\n` +
        `Valor Financiado: R$ ${valorOperacao || '0,00'}\n` +
        `Finalidade: ${tipoOperacao}\n` +
        `Prazo Total: ${prazoMeses} meses\n` +
        `Carência: ${carenciaMeses} meses\n` +
        `Objetivo: ${objetivoPleito}\n` +
        `Garantia: ${garantiaTxt}\n` +
        `Atividade Econômica – ${setorAtividade}: ${descAtiv}\n\n` +
        `1. INFORMAÇÕES DO PLEITO:\n` +
        `O presente pleito objetiva o financiamento com recursos do FNE/PRONAF A, para aquisição de itens destinados à atividade de ${verboExplora}, nos imóveis rurais do beneficiário, constante(s) no projeto, localizado(s) no ${nomePA}, na zona de ${cidadePA}.\n` +
        `No que se refere à relação entre o proponente e funcionário do Banco, informa-se que não há vínculo de parentesco com funcionário que atue na análise, deliberação ou decisão da presente operação de crédito.\n\n` +
        `2. GARANTIA:\n` +
        `O financiamento não possui garantias, conforme item 7.1 do normativo 1101-08-02.\n\n` +
        `3. HISTÓRICO:\n` +
        `O assentado faz parte da Associação dos Produtores Rurais do(a) ${nomePA}, situado no Extensão de município de ${cidadePA}, a gleba já dispõe de uma infraestrutura básica capaz de manter as famílias como energia, água, escolas e, etc. ${txtRelacionamentoSimples}. Atualmente ${statusAdimplencia}, ${statusAtrasos} e explora a atividade de ${verboExplora}. Cliente informa que adota as orientações técnicas necessárias à sua atividade produtiva.\n\n` +
        `4. PROPOSTA\n` +
        `Projeto Individual para a estruturação inicial no âmbito do PRONAF A, destinado ao desenvolvimento da ${verboExplora}, tais como: ${itensConcatenados}. Com a implantação do projeto o associado irá aumentar a sua capacidade produtiva e consequentemente, irá melhorar as condições de vida da família.\n\n` +
        `5. IMOVEL:\n` +
        `O imóvel pertence ao INCRA, a gleba está situada em uma região que dispõe de condições favoráveis ao desenvolvimento da agropecuária, como: solos de boa fertilidade, topografia ondulada, pluviosidade entre 1.400 e 1.700mm/ano. Cada associado já possui o seu lote delimitado o que facilita a realização do negócio individual. Os lotes já dispõem de pastagens artificiais precisando ser ampliada.\n\n` +
        `6. PARECER CONCLUSIVO:\n` +
        `Considerando-se os seguintes fatores:\n\n` +
        `1) Justificativa do analisador: ${TEXTO_RESERVA_LEGAL_ATE_4MF}\n\n` +
        `1.1) A atividade encontra-se dispensada de licenciamento ambiental por ser desenvolvida em imóvel rural de até quatro módulos fiscais e estar enquadrada no art. 1º do Decreto Estadual nº 31.109/2015, observados os requisitos ambientais aplicáveis, inclusive a apresentação da DCAA, a ausência de intervenção em APP e de supressão de vegetação nativa. Nessas condições, quando não incidente em APA ou RPPN, o Parecer SEMA nº 120/2023 considera dispensável a autorização específica da Unidade de Conservação para fins de concessão do crédito rural.\n` +
        `- DCAA conforme o ID: ${idDcaa || '[Informar ID]'}\n` +
        `- Parecer do SEMA, conforme o ID: ${idSema || '[Informar ID]'}\n\n` +
        `2) Inexistência de restrições cadastrais impeditivas nas fontes consultadas;${blocoItem22}\n` +
        `3) O proponente pertence ao público-alvo do programa, conforme CAF apresentada;\n` +
        `4) Viabilidade da proposta, conforme estudo apresentado pelo técnico responsável pela sua elaboração.\n` +
        `5) Oportunidade e adequação do crédito às necessidades do empreendimento do proponente;\n` +
        `6) Enquadramento normativo do pleito, conforme MB-OC-1101-08-02 (PRONAF - A);\n` +
        `7) Nota de risco: ${notaRisco || 'AA'}\n` +
        `8) Cliente não possui parentesco com funcionário do Banco do Nordeste do Brasil S/A.${blocoRelacionamentoPronafA}\n\n` +
        `Manifesta-se esta Unidade FAVORÁVEL à contratação do crédito, nas bases e condições estabelecidas.\n\n` +
        `Ao COMAG, para apreciação.\n` +
        `_________________________\n` +
        `${gerenteRelacionamento}\n` +
        `Gerente de Relacionamento${sufixoRelEE}\n\n` +
        `_________________________\n` +
        `${gerenteAgencia}\n` +
        `Gerente de Agência${sufixoAgEE}`
      );
    }

    // -----------------------------------------------------------------------
    // MODELO 2: LIMITE DE CRÉDITO GARANTIDO (LCGH / LCGA)
    // -----------------------------------------------------------------------
    if (modeloAtivo === 'LIMITE_LCG') {
      const siglaLim = tipoOperacao.toUpperCase().includes('LCGA') ? 'LCGA' : 'LCGH';
      const descTipo =
        siglaLim === 'LCGH'
          ? 'Limite de Crédito Garantido por Hipoteca de bens Imóveis'
          : 'Limite de Crédito Garantido por Alienação Fiduciária de bens Imóveis';
      const verboGarantia = siglaLim === 'LCGH' ? 'Hipoteca' : 'Alienação';
      const nomeIntervFuncional =
        siglaLim === 'LCGH' ? 'Interveniente Hipotecante' : 'Interveniente Garantidor';
      const prazoExt = numeroParaExtenso(prazoMeses);

      let todos100PorCento = true;
      const txtGrauPosseVariavel: string[] = [];
      const txtIntervenientesGlobais: string[] = [];
      const setProprietarios = new Map<string, string>();
      if (cpf) setProprietarios.set(cpf, `${nome}, CPF: ${cpf}`);

      const imoveisValidos = imoveisGarantia.filter((im) => im.nome.trim() !== '');
      imoveisValidos.forEach((im) => {
        const posseNum = parseFloat(im.posseTitular.replace('%', '').replace(',', '.')) || 100;
        if (posseNum < 100) todos100PorCento = false;
        let linhaPosse = `Grau de Posse (${im.nome.toUpperCase()}): ${posseNum}% (Titular)`;

        im.intervenientes.forEach((intv) => {
          if (intv.nome.trim() && intv.posse.trim()) {
            const iNome = intv.nome.toUpperCase().trim();
            const iCpf = intv.cpf.trim();
            const iPosse = intv.posse.replace('%', '').trim();
            setProprietarios.set(iCpf || iNome, `${iNome}, CPF: ${iCpf}`);
            linhaPosse += `, ${iPosse}% (${iNome})`;
            txtIntervenientesGlobais.push(
              `${nomeIntervFuncional}${
                imoveisValidos.length > 1 ? ` (${im.nome.toUpperCase()})` : ''
              }: ${iNome}, CPF: ${iCpf}, Grau de Posse: ${iPosse}%`
            );
          }
        });
        txtGrauPosseVariavel.push(linhaPosse);
      });

      const arrProps = Array.from(setProprietarios.values());
      const txtProprietarios =
        arrProps.length <= 1
          ? `3.1 - Proprietário: ${arrProps[0] || `${nome}, CPF: ${cpf}`}`
          : `3.1 - Proprietários: ${arrProps.join(', ').replace(/, ([^,]*)$/, ' e $1')}`;
      const txtPosseFinal = todos100PorCento
        ? '3.2 - Grau de Posse: 100%'
        : `3.2 - ${txtGrauPosseVariavel.join(' / ')}`;
      const txtIntervenienteFinal =
        txtIntervenientesGlobais.length > 0
          ? txtIntervenientesGlobais.join('\n') + '\n\n'
          : '';

      let textoImoveisAgrupados = '[Informar Nome, Matrícula e Município do Imóvel em Garantia]';
      if (imoveisValidos.length > 0) {
        const porCidade: Record<string, string[]> = {};
        imoveisValidos.forEach((im) => {
          const cid = im.cidadeUf.toUpperCase().trim() || 'MUNICÍPIO - MA';
          if (!porCidade[cid]) porCidade[cid] = [];
          porCidade[cid].push(`${im.nome.toUpperCase().trim()}, Matrícula n° ${im.matricula.trim()}`);
        });

        const blocosCidade: string[] = [];
        const cidades = Object.keys(porCidade);
        textoImoveisAgrupados = `${verboGarantia} ${
          imoveisValidos.length > 1 ? 'dos Imóveis' : 'do Imóvel'
        } `;

        cidades.forEach((cid, idxCid) => {
          const ims = [...porCidade[cid]];
          let txtCid = '';
          if (ims.length === 1) {
            txtCid = `${ims[0]}, situada no município de ${cid}`;
          } else if (ims.length === 2) {
            txtCid = `${ims[0]} e ${ims[1]}, ambas situadas no município de ${cid}`;
          } else {
            const ultimo = ims.pop();
            txtCid = `${ims.join(', ')} e ${ultimo}, todas situadas no município de ${cid}`;
          }

          if (cidades.length > 1 && idxCid === cidades.length - 1) {
            blocosCidade.push(
              ` e ${txtCid
                .replace('ambas situadas', 'estas últimas situadas')
                .replace('todas situadas', 'estas últimas situadas')}`
            );
          } else if (cidades.length > 1 && idxCid > 0) {
            blocosCidade.push(`, ${txtCid}`);
          } else {
            blocosCidade.push(txtCid);
          }
        });
        textoImoveisAgrupados += blocosCidade.join('') + '.';
      }

      return (
        `1. HISTÓRICO DO CLIENTE\n\n` +
        `${tratamento} ${nome} é produtor rural (${setorAtividade.toLowerCase()}) ${txtRelacionamentoSimples}. Atualmente ${statusAdimplencia}, ${statusAtrasos} e explora a atividade de ${verboExplora}. Cliente informa que adota as orientações técnicas necessárias à sua atividade produtiva.\n\n` +
        `Atividade Econômica – ${setorAtividade}: ${descAtiv}\n\n` +
        `2. PROPOSTA\n\n` +
        `${descTipo} (${siglaLim})\n\n` +
        `Valor de R$ ${valorOperacao || '0,00'}\n\n` +
        `Prazo de ${prazoMeses} (${prazoExt}) meses.\n\n` +
        `3. GARANTIAS\n\n` +
        `${textoImoveisAgrupados}\n\n` +
        `${txtProprietarios}\n\n` +
        `${txtPosseFinal}\n\n` +
        `${txtIntervenienteFinal}` +
        `3.3 - O limite será utilizado em operações de crédito rural do cliente ${nome}.\n\n` +
        `Beneficiário: ${nome}, CPF: ${cpf}\n\n` +
        `6. PARECER\n\n` +
        `Esta gerência manifesta-se FAVORÁVEL a concessão do crédito de ${siglaLim}.\n\n` +
        `1) Inexistência de restrições internas graves para o titular.\n` +
        `2) Cliente não tem parentesco com funcionário do Banco do Nordeste.\n` +
        `3) Nota de contágio “${notaRisco || 'AA'}”.\n` +
        `4) Cliente possui endereço cadastrado fora da propriedade em que se solicita a garantia – ID: ${
          idEnderecoFora || '[Informar ID]'
        }\n` +
        `5) Cliente com renda extra rural comprovada – ID: ${idRendaExtra || '[Informar ID]'}\n` +
        `6) Dispensa de visita gerencial conforme norma 3102-04-05 (Nota 2)\n` +
        `7) ${textoReservaLegalAplicavel}\n` +
        `8) Pré-contratual: Certidão de inteiro teor atualizada.\n\n` +
        `Submeta-se à apreciação do COMAG, para decisão final.\n\n` +
        `__________________________\n` +
        `${gerenteRelacionamento}\n` +
        `Gerente de Relacionamento${sufixoRelEE}\n\n` +
        `_______________________________\n` +
        `${gerenteAgencia}\n` +
        `Gerente de Agência${sufixoAgEE}`
      );
    }

    // -----------------------------------------------------------------------
    // MODELO 3: INVESTIMENTO / CUSTEIO (PRONAF V, MINI E DEMAIS PORTES)
    // -----------------------------------------------------------------------
    const valorProjNum = parseMoeda(valorOperacao);
    const valAssNum = parseMoeda(valorAssessoria);

    let valItensNum = valorProjNum;
    let valTotalFinanciadoNum = valorProjNum;
    if (assessoriaPropria === 'NÃO' && valAssNum > 0) {
      if (modoCalculoAssessoriaFinanciada === 'SOMAR_AO_VALOR') {
        valItensNum = valorProjNum;
        valTotalFinanciadoNum = valorProjNum + valAssNum;
      } else {
        valItensNum = Math.max(0, valorProjNum - valAssNum);
        valTotalFinanciadoNum = valorProjNum;
      }
    }

    const hoje = new Date().toLocaleDateString('pt-BR');

    const benValidos = imoveisBeneficiados.filter((b) => b.nome.trim() !== '');
    let textoBenAgrupado = '[Nenhum imóvel beneficiado informado]';
    if (benValidos.length > 0) {
      const pCid: Record<string, string[]> = {};
      benValidos.forEach((im) => {
        const ch = im.cidadeUf.toUpperCase().trim() || 'MUNICÍPIO - MA';
        if (!pCid[ch]) pCid[ch] = [];
        pCid[ch].push(
          `${im.nome.toUpperCase().trim()}${
            im.matricula.trim() ? `, Matrícula n° ${im.matricula.trim()}` : ''
          }`
        );
      });
      const outTxt: string[] = [];
      for (const ch in pCid) {
        const ims = [...pCid[ch]];
        if (ims.length === 1) {
          outTxt.push(`${ims[0]}, situada no município de ${ch}`);
        } else {
          const u = ims.pop();
          outTxt.push(`${ims.join(', ')} e ${u}, todas situadas no município de ${ch}`);
        }
      }
      textoBenAgrupado = outTxt.join('; ');
    }

    const linhasGar: string[] = [];
    let valAvalTotal = 0;
    const garValidos =
      temGarantiaRealInv === 'SIM'
        ? imoveisGarantia.filter((g) => g.nome.trim() !== '')
        : [];
    const garTipoDom: string = garValidos[0]?.tipo || 'LCGA';

    garValidos.forEach((g) => {
      valAvalTotal += parseMoeda(g.valorAvaliado);
      const posseTit = parseFloat(g.posseTitular.replace('%', '').replace(',', '.')) || 100;
      let txtP = 'pertencente (s) ao proponente.';
      if (posseTit < 100) {
        const intervLocal = g.intervenientes
          .filter((i) => i.nome.trim() !== '')
          .map(
            (i) =>
              `ao interveniente ${
                g.tipo === 'LCGH' ? 'hipotecante' : 'garantidor'
              } ${i.nome.toUpperCase().trim()} - CPF: ${i.cpf.trim()}`
          );
        txtP =
          intervLocal.length > 0
            ? `pertencente(s) ao proponente e ${intervLocal.join(' e ')}.`
            : 'pertencente(s) ao proponente e ao interveniente.';
      }
      linhasGar.push(
        `${
          g.tipo === 'LCGH'
            ? 'Limite de Crédito por Garantia de Hipoteca (LCGH)'
            : 'Alienação Fiduciária de bens imóveis (LCGA)'
        } do (s) imóvel (is): ${g.nome.toUpperCase().trim()}, Matrícula n° ${
          g.matricula.trim()
        }, situada no município de ${g.cidadeUf.toUpperCase().trim()}, ${txtP}`
      );
    });

    const valSomaDev = parseMoeda(saldoDevedorEmSer);
    const valComprometida = parseMoeda(garantiaComprometida);
    const fatorP = garTipoDom === 'LCGH' ? 125 : 110;
    const fatorD = garTipoDom === 'LCGH' ? 1.25 : 1.1;
    const garExigida = valTotalFinanciadoNum * fatorD;
    const mrgLivre = valAvalTotal - valComprometida;
    const relGar = valTotalFinanciadoNum > 0 ? (mrgLivre / valTotalFinanciadoNum) * 100 : 0;

    let idx = 1;
    let textoFinal = '';

    textoFinal += `${idx}. PROPOSTA DE CRÉDITO:\n\n`;
    textoFinal += `${tratamento} ${nome} é produtor(a) rural (${setorAtividade.toLowerCase()})\n\n`;
    textoFinal += `${idx}.1) Atividade econômica a ser financiada: ${descAtiv};\n`;
    textoFinal += `${idx}.2) Finalidade: ${tipoOperacao} ${setorAtividade};\n`;
    textoFinal += `${idx}.3) Programa: ${programaFormatado}\n\n`;
    idx++;

    textoFinal += `${idx}. HISTÓRICO:\n\n`;
    textoFinal += `${tratamento} ${nome} é produtor rural (${setorAtividade.toLowerCase()})${txtRelacionamentoGeral}. Atualmente ${statusAdimplencia}, ${statusAtrasos} e explora a atividade de ${verboExplora}. Cliente informa que adota as orientações técnicas necessárias à sua atividade produtiva.\n\n`;
    idx++;

    textoFinal += `${idx}. GARANTIAS:\n\n`;
    let sGar = 1;
    if (garValidos.length > 0) {
      linhasGar.forEach((g, i) => {
        textoFinal += `${idx}.${sGar}) ${g}\n\n`;
        if (i === 0) {
          textoFinal += `${idx}.${sGar}.1 Cálculo da Margem Livre da Garantia - Posição em ${hoje}.\n`;
          textoFinal += `${idx}.${sGar}.2 Saldo devedor da(s) operação(ões) em ser: R$ ${formatarMoedaBD(
            valSomaDev
          )} em ${hoje}.\n`;
          textoFinal += `${idx}.${sGar}.3 Valor (%) p/ garantia da operação (${fatorP}%): ${fatorD.toLocaleString(
            'pt-BR',
            { minimumFractionDigits: 2 }
          )} x R$ ${formatarMoedaBD(valTotalFinanciadoNum)} = R$ ${formatarMoedaBD(garExigida)}\n`;
          textoFinal += `${idx}.${sGar}.4 Valor total da garantia: R$ ${formatarMoedaBD(
            valAvalTotal
          )}\n`;
          textoFinal += `${idx}.${sGar}.5 Margem Livre: R$ ${formatarMoedaBD(
            valAvalTotal
          )} - R$ ${formatarMoedaBD(valComprometida)} = R$ ${formatarMoedaBD(mrgLivre)}.\n`;
          textoFinal += `${idx}.${sGar}.6 Relação de garantia nesta proposta: (%) R$ ${formatarMoedaBD(
            mrgLivre
          )} / R$ ${formatarMoedaBD(valTotalFinanciadoNum)} x 100 = ${relGar.toLocaleString(
            'pt-BR',
            {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            }
          )}\n\n`;
          textoFinal += `Esta gerência se manifesta favorável a utilização de ${relGar.toLocaleString(
            'pt-BR',
            { minimumFractionDigits: 2, maximumFractionDigits: 2 }
          )}% do percentual da garantia.\n\n`;
        }
        sGar++;
      });
    }

    if (temFidejussoria === 'SIM') {
      textoFinal += `${idx}.${sGar++}) ${tipoFidejussoria}\n`;
      textoFinal += `${idx}.${sGar++}) Dados do ${
        tipoFidejussoria === 'Aval' ? 'Avalista' : 'Fiador'
      }:\n${nomeAvalista.toUpperCase() || '[NOME DO AVALISTA]'}, CPF: ${
        cpfAvalista || '[CPF]'
      }, Renda bruta anual: R$ ${rendaAnualAvalista || '0,00'};\n\n`;
    }

    if (temFundoLiquidez === 'SIM' && parseMoeda(valorFundoLiquidez) > 0) {
      textoFinal += `${idx}.${sGar++}) Fundo de liquidez:\n\n`;
      textoFinal += `- Cessão Fiduciária de Conta-Reserva a ser constituída previamente, saldo 5% do valor mantido, totalizando R$ ${valorFundoLiquidez}.\n`;
      textoFinal += `- Na hipótese de insuficiência, o cliente deverá providenciar o depósito num prazo máximo de 180 dias.\n`;
      textoFinal += `- Número da conta-reserva: ${contaReservaFundo || '[Informar Conta]'}\n\n`;
    }
    idx++;

    textoFinal += `${idx++}. IMÓVEIS OBJETOS DO PLEITO:\n\n`;
    textoFinal += `Serão objetos do pleito ${
      benValidos.length > 1 ? 'os imóveis rurais denominados:' : 'o imóvel rural denominado:'
    } ${textoBenAgrupado}, pertencente(s) ao proponente.\n\n`;

    const txtCusteioPecuario =
      tipoOperacao.toUpperCase().includes('CUSTEIO') && setorAtividade === 'Pecuária'
        ? ' para recria e engorda'
        : '';

    textoFinal += `${idx}. PROPOSTA:\n\n`;
    if (assessoriaPropria === 'NÃO') {
      textoFinal += `A presente proposta abrange: ${itensConcatenados}${txtCusteioPecuario}, somando um valor de R$ ${formatarMoedaBD(
        valItensNum
      )}. A assessoria técnica no valor de R$ ${
        valorAssessoria || '0,00'
      } será financiada juntamente aos itens do plano, com sua descrição e valor devidamente determinados no projeto. Dessa forma, as inversões com o custo de assessoria a serem financiados totalizam o valor de R$ ${formatarMoedaBD(
        valTotalFinanciadoNum
      )}\n\n`;
      textoFinal += `${idx}.0) Valor a ser financiado: R$ ${formatarMoedaBD(
        valTotalFinanciadoNum
      )}\n`;
    } else {
      textoFinal += `A presente proposta abrange: ${itensConcatenados}${txtCusteioPecuario}, totalizando R$ ${formatarMoedaBD(
        valorProjNum
      )}. A assessoria técnica no valor de R$ ${
        valorAssessoria || '0,00'
      } será oriunda de recursos próprios advindos da atividade pecuária que o cliente desenvolve em suas propriedades rurais, além das atividades extra rurais que o mesmo desenvolve.\n\n`;
      textoFinal += `${idx}.0) Valor a ser Financiado: R$ ${formatarMoedaBD(valorProjNum)}\n`;
    }
    textoFinal += `${idx}.1) Prazo: ${prazoMeses} (${numeroParaExtenso(prazoMeses)}) meses.\n`;
    textoFinal += `${idx}.2) Carência: ${carenciaMeses} (${numeroParaExtenso(
      carenciaMeses
    )}) meses.\n\n`;
    idx++;

    textoFinal += `${idx++}. Cliente não tem parentesco com funcionário do Banco do Nordeste.\n\n`;
    textoFinal += `${idx++}. Cliente faz a opção por juros ${metodologiaJuros}.\n\n`;

    if (contaDesembolso.trim()) {
      textoFinal += `${idx++}. Conta vinculada a operação: ${contaDesembolso.trim()}\n\n`;
    }

    if (possuiRestricaoLeve22 === 'SIM') {
      textoFinal += `${idx++}. Restrições impeditivas ao crédito: ${montarTextoRestricoesLeves()}\n\n`;
    } else {
      textoFinal += `${idx++}. Restrições impeditivas ao crédito: não possui.\n\n`;
    }

    textoFinal += `${idx++}. Atrasos no SCR: não possui.\n\n`;
    textoFinal += `${idx++}. Nota de risco: ${notaRisco || 'AA'}.\n\n`;
    textoFinal += `${idx++}. Justificativa do analisador: ${textoReservaLegalAplicavel}\n\n`;

    if (incluirRelacionamentoNegocial) {
      textoFinal += `${idx++}. Relacionamento negocial: seguro prestamista no valor de R$ ${
        valSeguroPrestamista || '0,00'
      } a ser contratado e aplicação automática de R$ ${valAplicacaoAutomatica || '0,00'}.\n\n`;
    }

    textoFinal += `${idx++}. PARECER CONCLUSIVO:\n\nManifestamo-nos favoráveis ao deferimento da proposta e submetemos a esta alçada para apreciação e decisão.\n\n`;
    textoFinal += `${idx++}. Submete-se a proposta ao comitê/COMAG.\n\n`;
    textoFinal += `_________________________\n${gerenteRelacionamento}\nGerente de Relacionamento${sufixoRelEE}\n\n`;
    textoFinal += `_________________________\n${gerenteAgencia}\nGerente de Agência${sufixoAgEE}`;

    return textoFinal;
  };

  useEffect(() => {
    if (!editouTextoManualmente) {
      const novoTexto = construirTextoParecer();
      setTextoParecerFinal(novoTexto);
      if (editorParecerRef.current) {
        editorParecerRef.current.innerHTML = formatarParecerHtmlComNegrito(novoTexto);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    modeloAtivo,
    nomeCliente,
    cpfCliente,
    porteCliente,
    tipoOperacao,
    valorOperacao,
    programaCredito,
    prazoMeses,
    carenciaMeses,
    objetivoPleito,
    notaRisco,
    anoInicioRel,
    statusAdimplencia,
    statusAtrasos,
    setorAtividade,
    descAtividadeCabecalho,
    verboAtividadeTexto,
    itensFinanciadosTexto,
    abaixoQuatroModulos,
    idDcaa,
    idSema,
    possuiRestricaoLeve22,
    listaRestricoes22,
    idEnderecoFora,
    idRendaExtra,
    valorAssessoria,
    assessoriaPropria,
    modoCalculoAssessoriaFinanciada,
    metodologiaJuros,
    temFundoLiquidez,
    valorFundoLiquidez,
    contaReservaFundo,
    contaDesembolso,
    saldoDevedorEmSer,
    garantiaComprometida,
    incluirRelacionamentoNegocial,
    valSeguroPrestamista,
    valAplicacaoAutomatica,
    temFidejussoria,
    tipoFidejussoria,
    nomeAvalista,
    cpfAvalista,
    rendaAnualAvalista,
    imoveisBeneficiados,
    temGarantiaRealInv,
    imoveisGarantia,
    gerenteRelacionamento,
    gerenteRelEE,
    gerenteAgencia,
    gerenteAgEE,
    editouTextoManualmente,
  ]);

  const verificar4ModulosAntesDeExportar = (): boolean => {
    if (!porteCliente.includes('PRONAF') && abaixoQuatroModulos === 'PERGUNTAR') {
      const confirmar = window.confirm(
        '📐 CONFIRMAÇÃO PARA PORTE MINI / NÃO-PRONAF:\n\n' +
          'O imóvel objeto deste parecer possui área ABAIXO de 4 módulos fiscais?\n\n' +
          '• Clique em "OK" para SIM (Abaixo de 4 módulos fiscais)\n' +
          '• Clique em "Cancelar" para NÃO (Acima de 4 módulos fiscais)'
      );
      const novoStatus = confirmar ? 'SIM' : 'NAO';
      setAbaixoQuatroModulos(novoStatus);
      return true;
    }
    return true;
  };

  // Copia o Parecer preservando os negritos em editores ricos (Word/GED) e texto limpo no S400/Bloco de Notas
  const copiarParecerComNegrito = async () => {
    verificar4ModulosAntesDeExportar();
    const txtFinal = editouTextoManualmente ? textoParecerFinal : construirTextoParecer();
    const htmlComNegrito = `<div style="font-family:'Segoe UI',Arial,sans-serif;font-size:11pt;line-height:1.5;white-space:pre-wrap;">${formatarParecerHtmlComNegrito(
      txtFinal
    )}</div>`;

    try {
      if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
        const item = new ClipboardItem({
          'text/plain': new Blob([txtFinal], { type: 'text/plain' }),
          'text/html': new Blob([htmlComNegrito], { type: 'text/html' }),
        });
        await navigator.clipboard.write([item]);
      } else {
        await navigator.clipboard.writeText(txtFinal);
      }
      alert('📋 Parecer Gerencial copiado para a área de transferência!');
    } catch {
      await navigator.clipboard.writeText(txtFinal);
      alert('📋 Parecer Gerencial copiado para a área de transferência!');
    }
  };

  // Exportação direta em arquivo .TXT
  const exportarParecerTXT = () => {
    verificar4ModulosAntesDeExportar();
    const txtFinal = editouTextoManualmente ? textoParecerFinal : construirTextoParecer();
    const blob = new Blob([txtFinal], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const nomeLimpo = (nomeCliente || 'CLIENTE')
      .replace(/[^\w\sÀ-ÿ]/g, '')
      .trim()
      .replace(/\s+/g, '_');
    const a = document.createElement('a');
    a.href = url;
    a.download = `PARECER_GERENCIAL_${nomeLimpo}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Exportação PDF com todos os tópicos em negrito, sem data/hora e sem about:blank
  const exportarParecerPDF = () => {
    verificar4ModulosAntesDeExportar();
    const txtFinal = editouTextoManualmente ? textoParecerFinal : construirTextoParecer();
    const htmlFormatado = formatarParecerHtmlComNegrito(txtFinal);
    const tituloTopo = `PARECER GERENCIAL - ${(nomeCliente || 'CLIENTE').replace(/"/g, '')}`;

    const jan = window.open('', '_blank');
    if (!jan) return;

    jan.document.write(`
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8" />
        <title>${tituloTopo}</title>
        <style>
          @page {
            size: A4 portrait;
            margin: 18mm 15mm 18mm 15mm;
            @top-left { content: ""; }
            @top-center {
              content: "${tituloTopo}";
              font-family: 'Segoe UI', Arial, sans-serif;
              font-size: 8pt;
              color: #64748b;
            }
            @top-right { content: ""; }
            @bottom-left { content: ""; }
            @bottom-center { content: ""; }
            @bottom-right {
              content: counter(page) "/" counter(pages);
              font-family: 'Segoe UI', Arial, sans-serif;
              font-size: 8pt;
              color: #64748b;
            }
          }
          body {
            font-family: 'Segoe UI', Arial, sans-serif;
            margin: 0;
            padding: 0;
            line-height: 1.6;
            color: #0f172a;
          }
          pre {
            white-space: pre-wrap;
            word-wrap: break-word;
            font-family: 'Segoe UI', Arial, sans-serif;
            font-size: 12px;
            margin: 0;
          }
          strong {
            font-weight: 700;
            color: #000000;
          }
        </style>
      </head>
      <body>
        <pre>${htmlFormatado}</pre>
        <script>
          try { history.replaceState(null, '', '/parecer-gerencial'); } catch (e) {}
          setTimeout(() => { window.print(); }, 250);
        </script>
      </body>
      </html>
    `);
    jan.document.close();
  };

  const somaRelacionamentoAtual =
    parseMoeda(valSeguroPrestamista) + parseMoeda(valAplicacaoAutomatica);
  const percRelacionamentoAtual =
    parseMoeda(valorOperacao) > 0
      ? (somaRelacionamentoAtual / parseMoeda(valorOperacao)) * 100
      : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', paddingBottom: '24px' }}>
      {/* DATALIST DE ATIVIDADES ECONÔMICAS SELECIONÁVEIS / EDITÁVEIS */}
      <datalist id="dl_atividades_parecer">
        {OPCOES_ATIVIDADE_ECONOMICA.map((ativ) => (
          <option key={ativ} value={ativ} />
        ))}
      </datalist>

      {/* PAINEL DE COMANDO DO PARECER GERENCIAL (DESIGN EXECUTIVO REFINADO) */}
      <div
        style={{
          background: '#ffffff',
          border: '1px solid #cbd5e1',
          borderTop: '4px solid #8B1530',
          borderRadius: '10px',
          overflow: 'hidden',
          boxShadow: '0 2px 8px rgba(15, 23, 42, 0.05)',
        }}
      >
        <div
          style={{
            padding: '12px 18px',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px',
            background: '#ffffff',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: '#fdf2f4',
                border: '1px solid #f5c2c7',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '15px',
              }}
            >
              📄
            </div>
            <div>
              <div
                style={{
                  fontSize: '13.5px',
                  fontWeight: 800,
                  color: '#8B1530',
                  letterSpacing: '0.3px',
                  textTransform: 'uppercase',
                  lineHeight: 1.2,
                }}
              >
                Gerador de Parecer Gerencial
              </div>
              <div style={{ fontSize: '11px', color: '#64748b' }}>
                Preencha os campos abaixo para gerar o parecer gerencial completo
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => {
                setEditouTextoManualmente(false);
                const novoTxt = construirTextoParecer();
                setTextoParecerFinal(novoTxt);
                if (editorParecerRef.current) {
                  editorParecerRef.current.innerHTML = formatarParecerHtmlComNegrito(novoTxt);
                }
              }}
              style={{
                width: 'auto',
                height: '34px',
                padding: '0 12px',
                fontSize: '11.5px',
                background: '#f8fafc',
                color: '#334155',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
              }}
              title="Regerar minuta com base nos campos atuais"
            >
              🔄 Restaurar Padrão
            </button>

            <button
              type="button"
              onClick={copiarParecerComNegrito}
              style={{
                width: 'auto',
                height: '34px',
                padding: '0 14px',
                fontSize: '11.5px',
                background: '#ffffff',
                color: '#8B1530',
                border: '1px solid #8B1530',
                borderRadius: '6px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
              }}
            >
              📋 Copiar Texto
            </button>

            <button
              type="button"
              onClick={exportarParecerTXT}
              style={{
                width: 'auto',
                height: '34px',
                padding: '0 14px',
                fontSize: '11.5px',
                background: '#eff6ff',
                color: '#1d4ed8',
                border: '1px solid #bfdbfe',
                borderRadius: '6px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
              }}
              title="Baixar arquivo de texto (.TXT)"
            >
              📥 Extrair .TXT
            </button>

            <button
              type="button"
              onClick={exportarParecerPDF}
              style={{
                width: 'auto',
                height: '34px',
                padding: '0 16px',
                fontSize: '11.5px',
                background: '#8B1530',
                color: '#ffffff',
                border: '1px solid #6a0f23',
                borderRadius: '6px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 1px 3px rgba(139, 21, 48, 0.25)',
              }}
              title="Gerar PDF limpo para impressão ou salvamento"
            >
              🖨️ Extrair PDF
            </button>
          </div>
        </div>

        <div
          style={{
            padding: '12px 18px',
            background: '#f8fafc',
            display: 'grid',
            gridTemplateColumns:
              operacoesCliente.length > 0 ? 'repeat(auto-fit, minmax(260px, 1fr))' : '1fr',
            gap: '14px',
            alignItems: 'end',
          }}
        >
          {operacoesCliente.length > 0 && (
            <div>
              <label style={ui.label}>🚜 Operação Vinculada do Cliente</label>
              <select
                value={opSelecionadaId}
                onChange={(e) => setOpSelecionadaId(e.target.value)}
                style={{
                  ...ui.select,
                  fontWeight: 700,
                  background: '#ffffff',
                  borderColor: '#cbd5e1',
                  color: '#0f172a',
                }}
              >
                {operacoesCliente.map((op, i) => (
                  <option key={op.id} value={op.id}>
                    OP{i + 1}: {op.tipo} — R$ {op.valor} ({op.porte})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label style={ui.label}>📑 Estrutura / Modelo Oficial de Parecer</label>
            <select
              value={modeloAtivo}
              onChange={(e) => {
                setEditouTextoManualmente(false);
                setModeloAtivo(
                  e.target.value as 'PRONAF_A' | 'INV_CUSTEIO' | 'LIMITE_LCG'
                );
              }}
              style={{
                ...ui.select,
                fontWeight: 700,
                background: '#ffffff',
                borderColor: '#cbd5e1',
                color: '#8B1530',
              }}
            >
              <option value="PRONAF_A">1. Modelo PRONAF A</option>
              <option value="INV_CUSTEIO">
                2. Modelo - Derivada
              </option>
              <option value="LIMITE_LCG">3. Modelo Limite / Garantia</option>
            </select>
          </div>
        </div>
      </div>

      {/* BANNER PARA PORTE MINI / NÃO-PRONAF: PERGUNTA DOS 4 MÓDULOS FISCAIS */}
      {!porteCliente.includes('PRONAF') && (
        <div
          style={{
            background: abaixoQuatroModulos === 'PERGUNTAR' ? '#fffbeb' : '#f0fdf4',
            border: `1.5px solid ${
              abaixoQuatroModulos === 'PERGUNTAR' ? '#f59e0b' : '#86efac'
            }`,
            borderRadius: '10px',
            padding: '12px 16px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '10px',
          }}
        >
          <div style={{ fontSize: '12.5px', fontWeight: 700, color: '#1e293b' }}>
            📐 Porte {porteCliente}: O imóvel possui área ABAIXO de 4 Módulos Fiscais (Normativo 3102-03-27)?
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              onClick={() => {
                setEditouTextoManualmente(false);
                setAbaixoQuatroModulos('SIM');
              }}
              style={{
                width: 'auto',
                height: '32px',
                padding: '0 14px',
                fontSize: '11.5px',
                fontWeight: 700,
                borderRadius: '6px',
                border: '1px solid #15803d',
                background: abaixoQuatroModulos === 'SIM' ? '#15803d' : '#ffffff',
                color: abaixoQuatroModulos === 'SIM' ? '#ffffff' : '#15803d',
                cursor: 'pointer',
              }}
            >
              ✅ SIM (Abaixo de 4 MF)
            </button>
            <button
              type="button"
              onClick={() => {
                setEditouTextoManualmente(false);
                setAbaixoQuatroModulos('NAO');
              }}
              style={{
                width: 'auto',
                height: '32px',
                padding: '0 14px',
                fontSize: '11.5px',
                fontWeight: 700,
                borderRadius: '6px',
                border: '1px solid #b45309',
                background: abaixoQuatroModulos === 'NAO' ? '#b45309' : '#ffffff',
                color: abaixoQuatroModulos === 'NAO' ? '#ffffff' : '#b45309',
                cursor: 'pointer',
              }}
            >
              📏 NÃO (Acima de 4 MF)
            </button>
          </div>
        </div>
      )}

      {/* SEÇÃO 1: DADOS DA PROPOSTA, ATIVIDADE ECONÔMICA E ENQUADRAMENTO */}
      <div style={ui.sectionCard}>
        <div style={ui.sectionHeader}>
          <h4 style={ui.sectionTitle}>
            ⚙️ 1. Dados da Proposta, Atividade Econômica e Enquadramento
          </h4>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns:
              modeloAtivo === 'LIMITE_LCG'
                ? '2fr 1.2fr 1fr 0.8fr 1fr'
                : '2.2fr 1.2fr 0.85fr 0.85fr 1.2fr 0.7fr 0.9fr',
            gap: '12px',
            alignItems: 'end',
          }}
        >
          <div>
            <label style={ui.label}>Programa de Crédito</label>
            <input
              type="search"
              list="dl_programas_kanban"
              value={programaCredito}
              onChange={(e) => {
                setEditouTextoManualmente(false);
                setProgramaCredito(e.target.value);
              }}
              style={ui.input}
            />
          </div>

          <div>
            <label style={ui.label}>Valor Base (R$)</label>
            <input
              type="text"
              value={valorOperacao}
              onChange={(e) => {
                setEditouTextoManualmente(false);
                const novoVal = mascaraMoedaInput(e.target.value);
                setValorOperacao(novoVal);
                recalcularRelacionamentoNegocialPadrao(novoVal, porteCliente);
              }}
              style={{ ...ui.input, fontWeight: 700, color: '#8B1530' }}
            />
          </div>

          <div>
            <label style={ui.label}>Prazo (Meses)</label>
            <input
              type="text"
              value={prazoMeses}
              onChange={(e) => {
                setEditouTextoManualmente(false);
                setPrazoMeses(e.target.value);
              }}
              style={ui.input}
            />
          </div>

          {modeloAtivo !== 'LIMITE_LCG' && (
            <>
              <div>
                <label style={ui.label}>Carência (Meses)</label>
                <input
                  type="text"
                  value={carenciaMeses}
                  onChange={(e) => {
                    setEditouTextoManualmente(false);
                    setCarenciaMeses(e.target.value);
                  }}
                  style={ui.input}
                />
              </div>

              <div>
                <label style={ui.label}>Objetivo</label>
                <select
                  value={objetivoPleito}
                  onChange={(e) => {
                    setEditouTextoManualmente(false);
                    setObjetivoPleito(e.target.value);
                  }}
                  style={ui.select}
                >
                  <option value="Ampliação">Ampliação</option>
                  <option value="Implantação">Implantação</option>
                  <option value="Expansão">Expansão</option>
                  <option value="Manutenção">Manutenção</option>
                  <option value="Modernização">Modernização</option>
                </select>
              </div>
            </>
          )}

          <div>
            <label style={{ ...ui.label, color: '#8B1530' }}>Risco</label>
            <input
              type="text"
              value={notaRisco}
              onChange={(e) => {
                setEditouTextoManualmente(false);
                setNotaRisco(e.target.value.toUpperCase());
              }}
              placeholder="AA"
              style={{ ...ui.input, fontWeight: 700, textAlign: 'center' }}
            />
          </div>

          <div>
            <label style={ui.label}>Início Relac.</label>
            <input
              type="number"
              value={anoInicioRel}
              onChange={(e) => {
                setEditouTextoManualmente(false);
                setAnoInicioRel(e.target.value);
              }}
              style={ui.input}
            />
          </div>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 2.2fr 1.8fr',
            gap: '12px',
            alignItems: 'end',
          }}
        >
          <div>
            <label style={ui.label}>Setor Produtivo</label>
            <select
              value={setorAtividade}
              onChange={(e) => {
                setEditouTextoManualmente(false);
                setSetorAtividade(e.target.value as 'Pecuária' | 'Agricultura');
              }}
              style={ui.select}
            >
              <option value="Pecuária">Pecuária</option>
              <option value="Agricultura">Agricultura</option>
            </select>
          </div>

          <div>
            <label style={ui.label}>
              Atividade Econômica
            </label>
            <input
              type="search"
              list="dl_atividades_parecer"
              value={descAtividadeCabecalho}
              onChange={(e) => {
                setEditouTextoManualmente(false);
                const val = e.target.value;
                setDescAtividadeCabecalho(val);
                if (val.toLowerCase().includes('leite')) {
                  setVerboAtividadeTexto('Bovinocultura de leite');
                } else if (val.toLowerCase().includes('corte')) {
                  setVerboAtividadeTexto('Bovinocultura de corte');
                }
              }}
              placeholder="Selecione na lista ou digite livremente..."
              style={ui.input}
            />
          </div>

          <div>
            <label style={ui.label}>
              Atividade Econômica (2)
            </label>
            <input
              type="search"
              list="dl_atividades_parecer"
              value={verboAtividadeTexto}
              onChange={(e) => {
                setEditouTextoManualmente(false);
                setVerboAtividadeTexto(e.target.value);
              }}
              placeholder="Ex: Bovinocultura de corte"
              style={ui.input}
            />
          </div>
        </div>

        {modeloAtivo !== 'LIMITE_LCG' && (
          <div>
            <label style={ui.label}>
              Itens a Financiar / Custear (separe cada item por vírgula; o sistema formata o &quot;e&quot; final automaticamente)
            </label>
            <textarea
              rows={2}
              value={itensFinanciadosTexto}
              onChange={(e) => {
                setEditouTextoManualmente(false);
                setItensFinanciadosTexto(e.target.value);
              }}
              placeholder="Ex: FORMAÇÃO 1 HA DE PASTAGEM CAPIM BRACHIARIA, AQ. DE REPRODUTOR BOVINO..., AQ. DE MATRIZES BOVINAS..."
              style={{
                ...ui.input,
                height: 'auto',
                minHeight: '54px',
                padding: '8px 10px',
                resize: 'vertical',
              }}
            />
          </div>
        )}
      </div>

      {/* SEÇÃO 2: IMÓVEL(IS) / ASSENTAMENTO BENEFICIADO */}
      {modeloAtivo !== 'LIMITE_LCG' && (
        <div style={ui.sectionCard}>
          <div style={ui.sectionHeader}>
            <h4 style={{ ...ui.sectionTitle, color: '#15803d' }}>
              📍 2. Imóvel(is) / Assentamento (PA) Beneficiado pelo Pleito
            </h4>
            <button
              type="button"
              onClick={() => {
                setEditouTextoManualmente(false);
                setImoveisBeneficiados([
                  ...imoveisBeneficiados,
                  {
                    id: `ben_${Date.now()}`,
                    nome: '',
                    matricula: '',
                    cidadeUf: 'PIO XII - MA',
                    areaHa: '',
                  },
                ]);
              }}
              style={{
                width: 'auto',
                height: '30px',
                padding: '0 12px',
                fontSize: '11.5px',
                background: '#dcfce7',
                color: '#15803d',
                border: '1px solid #86efac',
                borderRadius: '6px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              + Adicionar Imóvel Beneficiado
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {imoveisBeneficiados.map((im, idx) => (
              <div
                key={im.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns:
                    modeloAtivo === 'PRONAF_A'
                      ? '2.2fr 1.5fr auto'
                      : '2fr 1fr 1.3fr 0.8fr auto',
                  gap: '10px',
                  alignItems: 'end',
                  background: '#f8fafc',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  border: '1px solid #e2e8f0',
                }}
              >
                <div>
                  <label style={ui.label}>Nome do Assentamento (PA) / Fazenda</label>
                  <input
                    type="text"
                    value={im.nome}
                    onChange={(e) => {
                      setEditouTextoManualmente(false);
                      const novos = [...imoveisBeneficiados];
                      novos[idx] = { ...novos[idx], nome: e.target.value };
                      setImoveisBeneficiados(novos);
                    }}
                    placeholder="Ex: PA LAGO DA CARNAUBA"
                    style={ui.input}
                  />
                </div>

                {modeloAtivo !== 'PRONAF_A' && (
                  <div>
                    <label style={ui.label}>Matrícula / INCRA</label>
                    <input
                      type="text"
                      value={im.matricula}
                      onChange={(e) => {
                        setEditouTextoManualmente(false);
                        const novos = [...imoveisBeneficiados];
                        novos[idx] = { ...novos[idx], matricula: e.target.value };
                        setImoveisBeneficiados(novos);
                      }}
                      placeholder="Nº da Matrícula"
                      style={ui.input}
                    />
                  </div>
                )}

                <div>
                  <label style={ui.label}>Município - UF</label>
                  <input
                    type="text"
                    value={im.cidadeUf}
                    onChange={(e) => {
                      setEditouTextoManualmente(false);
                      const novos = [...imoveisBeneficiados];
                      novos[idx] = { ...novos[idx], cidadeUf: e.target.value };
                      setImoveisBeneficiados(novos);
                    }}
                    placeholder="Ex: PIO XII - MA"
                    style={ui.input}
                  />
                </div>

                {modeloAtivo !== 'PRONAF_A' && (
                  <div>
                    <label style={ui.label}>Área (ha)</label>
                    <input
                      type="text"
                      value={im.areaHa}
                      onChange={(e) => {
                        setEditouTextoManualmente(false);
                        const novos = [...imoveisBeneficiados];
                        novos[idx] = { ...novos[idx], areaHa: e.target.value };
                        setImoveisBeneficiados(novos);
                      }}
                      placeholder="Ex: 25"
                      style={ui.input}
                    />
                  </div>
                )}

                {imoveisBeneficiados.length > 1 && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditouTextoManualmente(false);
                      setImoveisBeneficiados(imoveisBeneficiados.filter((_, i) => i !== idx));
                    }}
                    style={{
                      width: 'auto',
                      height: '36px',
                      padding: '0 10px',
                      fontSize: '12px',
                      background: '#fee2e2',
                      color: '#b91c1c',
                      border: '1px solid #fecaca',
                      borderRadius: '6px',
                      cursor: 'pointer',
                    }}
                    title="Remover Imóvel"
                  >
                    🗑️
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SEÇÃO 3: GARANTIAS REAIS, MARGEM LIVRE E CONDIÇÕES DA PROPOSTA */}
      {(modeloAtivo === 'LIMITE_LCG' || modeloAtivo === 'INV_CUSTEIO') && (
        <div style={ui.sectionCard}>
          <div style={ui.sectionHeader}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <h4 style={ui.sectionTitle}>
                🛡️{' '}
                {modeloAtivo === 'LIMITE_LCG'
                  ? '2. Imóvel(is) em Garantia Real e Grau de Posse'
                  : '3. Garantias, Margem Livre e Condições da Proposta'}
              </h4>

              {modeloAtivo === 'INV_CUSTEIO' && (
                <select
                  value={temGarantiaRealInv}
                  onChange={(e) => {
                    setEditouTextoManualmente(false);
                    setTemGarantiaRealInv(e.target.value as 'NÃO' | 'SIM');
                  }}
                  style={{
                    ...ui.select,
                    width: 'auto',
                    minWidth: '260px',
                    height: '32px',
                    fontWeight: 700,
                    background: temGarantiaRealInv === 'SIM' ? '#fef2f2' : '#f8fafc',
                    borderColor: temGarantiaRealInv === 'SIM' ? '#f87171' : '#cbd5e1',
                  }}
                >
                  <option value="NÃO">Sem Garantia Real (Apenas Aval / Fiança)</option>
                  <option value="SIM">Possui Garantia Real (LCGH / LCGA)</option>
                </select>
              )}
            </div>

            {(modeloAtivo === 'LIMITE_LCG' || temGarantiaRealInv === 'SIM') && (
              <button
                type="button"
                onClick={() => {
                  setEditouTextoManualmente(false);
                  setImoveisGarantia([
                    ...imoveisGarantia,
                    {
                      id: `gar_${Date.now()}`,
                      tipo: 'LCGH',
                      nome: '',
                      matricula: '',
                      cidadeUf: 'SANTA INÊS - MA',
                      posseTitular: '100',
                      valorAvaliado: '0,00',
                      intervenientes: [],
                    },
                  ]);
                }}
                style={{
                  width: 'auto',
                  height: '30px',
                  padding: '0 12px',
                  fontSize: '11.5px',
                  background: '#fef2f2',
                  color: '#8B1530',
                  border: '1px solid #fecaca',
                  borderRadius: '6px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                + Adicionar Imóvel Garantidor
              </button>
            )}
          </div>

          {(modeloAtivo === 'LIMITE_LCG' || temGarantiaRealInv === 'SIM') &&
            imoveisGarantia.map((g, idxG) => {
              const posseTitNum = parseFloat(g.posseTitular.replace(',', '.')) || 100;
              return (
                <div
                  key={g.id}
                  style={{
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    padding: '12px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                  }}
                >
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns:
                        modeloAtivo === 'INV_CUSTEIO'
                          ? '0.85fr 1.8fr 1fr 1.2fr 0.75fr 1.1fr auto'
                          : '2fr 1fr 1.3fr 0.85fr auto',
                      gap: '10px',
                      alignItems: 'end',
                    }}
                  >
                    {modeloAtivo === 'INV_CUSTEIO' && (
                      <div>
                        <label style={ui.label}>Modalidade</label>
                        <select
                          value={g.tipo}
                          onChange={(e) => {
                            setEditouTextoManualmente(false);
                            const novos = [...imoveisGarantia];
                            novos[idxG] = {
                              ...novos[idxG],
                              tipo: e.target.value as 'LCGA' | 'LCGH',
                            };
                            setImoveisGarantia(novos);
                          }}
                          style={{ ...ui.select, fontWeight: 700 }}
                        >
                          <option value="LCGH">LCGH</option>
                          <option value="LCGA">LCGA</option>
                        </select>
                      </div>
                    )}

                    <div>
                      <label style={ui.label}>Nome do Imóvel / Fazenda</label>
                      <input
                        type="text"
                        value={g.nome}
                        onChange={(e) => {
                          setEditouTextoManualmente(false);
                          const novos = [...imoveisGarantia];
                          novos[idxG] = { ...novos[idxG], nome: e.target.value };
                          setImoveisGarantia(novos);
                        }}
                        placeholder="Ex: FAZENDA SÃO JOSÉ"
                        style={ui.input}
                      />
                    </div>

                    <div>
                      <label style={ui.label}>Matrícula nº</label>
                      <input
                        type="text"
                        value={g.matricula}
                        onChange={(e) => {
                          setEditouTextoManualmente(false);
                          const novos = [...imoveisGarantia];
                          novos[idxG] = { ...novos[idxG], matricula: e.target.value };
                          setImoveisGarantia(novos);
                        }}
                        placeholder="Ex: 4512"
                        style={ui.input}
                      />
                    </div>

                    <div>
                      <label style={ui.label}>Município - UF</label>
                      <input
                        type="text"
                        value={g.cidadeUf}
                        onChange={(e) => {
                          setEditouTextoManualmente(false);
                          const novos = [...imoveisGarantia];
                          novos[idxG] = { ...novos[idxG], cidadeUf: e.target.value };
                          setImoveisGarantia(novos);
                        }}
                        placeholder="SANTA INÊS - MA"
                        style={ui.input}
                      />
                    </div>

                    <div>
                      <label style={ui.label}>Posse Titular (%)</label>
                      <input
                        type="text"
                        value={g.posseTitular}
                        onChange={(e) => {
                          setEditouTextoManualmente(false);
                          const valPosse = e.target.value;
                          const numP = parseFloat(valPosse.replace(',', '.')) || 0;
                          const novos = [...imoveisGarantia];
                          const intvsAtuais =
                            numP < 100 && novos[idxG].intervenientes.length === 0
                              ? [
                                  {
                                    id: `int_${Date.now()}`,
                                    nome: '',
                                    cpf: '',
                                    posse: String(Math.max(0, 100 - numP)),
                                  },
                                ]
                              : numP >= 100
                              ? []
                              : novos[idxG].intervenientes;
                          novos[idxG] = {
                            ...novos[idxG],
                            posseTitular: valPosse,
                            intervenientes: intvsAtuais,
                          };
                          setImoveisGarantia(novos);
                        }}
                        placeholder="100"
                        style={ui.input}
                      />
                    </div>

                    {modeloAtivo === 'INV_CUSTEIO' && (
                      <div>
                        <label style={ui.label}>Valor Avaliado (R$)</label>
                        <input
                          type="text"
                          value={g.valorAvaliado}
                          onChange={(e) => {
                            setEditouTextoManualmente(false);
                            const novos = [...imoveisGarantia];
                            novos[idxG] = {
                              ...novos[idxG],
                              valorAvaliado: mascaraMoedaInput(e.target.value),
                            };
                            setImoveisGarantia(novos);
                          }}
                          placeholder="0,00"
                          style={{ ...ui.input, fontWeight: 700 }}
                        />
                      </div>
                    )}

                    {imoveisGarantia.length > 1 && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditouTextoManualmente(false);
                          setImoveisGarantia(imoveisGarantia.filter((_, i) => i !== idxG));
                        }}
                        style={{
                          width: 'auto',
                          height: '36px',
                          padding: '0 10px',
                          fontSize: '12px',
                          background: '#fee2e2',
                          color: '#b91c1c',
                          border: '1px solid #fecaca',
                          borderRadius: '6px',
                          cursor: 'pointer',
                        }}
                      >
                        🗑️
                      </button>
                    )}
                  </div>

                  {posseTitNum < 100 && (
                    <div
                      style={{
                        paddingLeft: '12px',
                        borderLeft: '3px solid #f59e0b',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '11px', fontWeight: 700, color: '#b45309' }}>
                          ⚠️ Posse do Titular ({posseTitNum}%) menor que 100% — Informe o(s) Interveniente(s):
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setEditouTextoManualmente(false);
                            const novos = [...imoveisGarantia];
                            novos[idxG].intervenientes.push({
                              id: `int_${Date.now()}`,
                              nome: '',
                              cpf: '',
                              posse: '',
                            });
                            setImoveisGarantia(novos);
                          }}
                          style={{
                            width: 'auto',
                            height: '28px',
                            padding: '0 10px',
                            fontSize: '11px',
                            background: '#fffbeb',
                            color: '#b45309',
                            border: '1px solid #f59e0b',
                            borderRadius: '6px',
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                        >
                          + Interveniente
                        </button>
                      </div>

                      {g.intervenientes.map((intv, idxI) => (
                        <div
                          key={intv.id}
                          style={{
                            display: 'grid',
                            gridTemplateColumns: '2fr 1.1fr 0.8fr auto',
                            gap: '8px',
                            alignItems: 'center',
                          }}
                        >
                          <input
                            type="text"
                            value={intv.nome}
                            onChange={(e) => {
                              setEditouTextoManualmente(false);
                              const novos = [...imoveisGarantia];
                              novos[idxG].intervenientes[idxI].nome = e.target.value;
                              setImoveisGarantia(novos);
                            }}
                            placeholder="Nome Completo do Interveniente"
                            style={ui.input}
                          />
                          <input
                            type="text"
                            value={intv.cpf}
                            onChange={(e) => {
                              setEditouTextoManualmente(false);
                              const novos = [...imoveisGarantia];
                              novos[idxG].intervenientes[idxI].cpf = mascaraDocumento(
                                e.target.value
                              );
                              setImoveisGarantia(novos);
                            }}
                            placeholder="CPF do Interveniente"
                            style={ui.input}
                          />
                          <input
                            type="text"
                            value={intv.posse}
                            onChange={(e) => {
                              setEditouTextoManualmente(false);
                              const novos = [...imoveisGarantia];
                              novos[idxG].intervenientes[idxI].posse = e.target.value;
                              setImoveisGarantia(novos);
                            }}
                            placeholder="% Posse"
                            style={ui.input}
                          />
                          <button
                            type="button"
                            onClick={() => {
                              setEditouTextoManualmente(false);
                              const novos = [...imoveisGarantia];
                              novos[idxG].intervenientes = novos[idxG].intervenientes.filter(
                                (_, i) => i !== idxI
                              );
                              setImoveisGarantia(novos);
                            }}
                            style={{
                              width: 'auto',
                              height: '36px',
                              padding: '0 10px',
                              fontSize: '12px',
                              background: '#fee2e2',
                              color: '#b91c1c',
                              border: 'none',
                              borderRadius: '6px',
                            }}
                          >
                            ✖
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

          {modeloAtivo === 'INV_CUSTEIO' && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(185px, 1fr))',
                gap: '12px',
                paddingTop: '4px',
              }}
            >
              {temGarantiaRealInv === 'SIM' && (
                <>
                  <div>
                    <label style={ui.label}>Saldo Devedor em Ser (R$)</label>
                    <input
                      type="text"
                      value={saldoDevedorEmSer}
                      onChange={(e) => {
                        setEditouTextoManualmente(false);
                        setSaldoDevedorEmSer(mascaraMoedaInput(e.target.value));
                      }}
                      style={ui.input}
                    />
                  </div>
                  <div>
                    <label style={ui.label}>Garantia Comprometida (R$)</label>
                    <input
                      type="text"
                      value={garantiaComprometida}
                      onChange={(e) => {
                        setEditouTextoManualmente(false);
                        setGarantiaComprometida(mascaraMoedaInput(e.target.value));
                      }}
                      style={ui.input}
                    />
                  </div>
                </>
              )}

              <div>
                <label style={ui.label}>Garantia Fidejussória?</label>
                <select
                  value={temFidejussoria}
                  onChange={(e) => {
                    setEditouTextoManualmente(false);
                    setTemFidejussoria(e.target.value as 'NÃO' | 'SIM');
                  }}
                  style={ui.select}
                >
                  <option value="NÃO">NÃO</option>
                  <option value="SIM">SIM (Aval / Fiança)</option>
                </select>
              </div>

              {temFidejussoria === 'SIM' && (
                <>
                  <div>
                    <label style={ui.label}>Nome do Avalista</label>
                    <input
                      type="text"
                      value={nomeAvalista}
                      onChange={(e) => {
                        setEditouTextoManualmente(false);
                        setNomeAvalista(e.target.value);
                      }}
                      style={ui.input}
                    />
                  </div>
                  <div>
                    <label style={ui.label}>CPF do Avalista</label>
                    <input
                      type="text"
                      value={cpfAvalista}
                      onChange={(e) => {
                        setEditouTextoManualmente(false);
                        setCpfAvalista(mascaraDocumento(e.target.value));
                      }}
                      style={ui.input}
                    />
                  </div>
                  <div>
                    <label style={ui.label}>Renda Anual Aval (R$)</label>
                    <input
                      type="text"
                      value={rendaAnualAvalista}
                      onChange={(e) => {
                        setEditouTextoManualmente(false);
                        setRendaAnualAvalista(mascaraMoedaInput(e.target.value));
                      }}
                      style={ui.input}
                    />
                  </div>
                </>
              )}

              <div>
                <label style={ui.label}>Valor Assessoria Técnica (R$)</label>
                <input
                  type="text"
                  value={valorAssessoria}
                  onChange={(e) => {
                    setEditouTextoManualmente(false);
                    setValorAssessoria(mascaraMoedaInput(e.target.value));
                  }}
                  style={ui.input}
                />
              </div>

              <div>
                <label style={ui.label}>Assessoria Rec. Próprio?</label>
                <select
                  value={assessoriaPropria}
                  onChange={(e) => {
                    setEditouTextoManualmente(false);
                    setAssessoriaPropria(e.target.value as 'NÃO' | 'SIM');
                  }}
                  style={ui.select}
                >
                  <option value="NÃO">NÃO (Financiada no Projeto)</option>
                  <option value="SIM">SIM (Recursos Próprios)</option>
                </select>
              </div>

              {assessoriaPropria === 'NÃO' && parseMoeda(valorAssessoria) > 0 && (
                <div>
                  <label style={{ ...ui.label, color: '#8B1530' }}>
                    Composição do Valor Base (Item 5.0)
                  </label>
                  <select
                    value={modoCalculoAssessoriaFinanciada}
                    onChange={(e) => {
                      setEditouTextoManualmente(false);
                      setModoCalculoAssessoriaFinanciada(
                        e.target.value as 'SOMAR_AO_VALOR' | 'DEDUZIR_DO_TOTAL'
                      );
                    }}
                    style={{ ...ui.select, fontWeight: 700 }}
                  >
                    <option value="SOMAR_AO_VALOR">
                      Somar (Itens: R$ {valorOperacao} + Ass.: R$ {valorAssessoria})
                    </option>
                    <option value="DEDUZIR_DO_TOTAL">
                      Já inclusa no Total (Total Financiado: R$ {valorOperacao})
                    </option>
                  </select>
                </div>
              )}

              <div>
                <label style={ui.label}>Metodologia de Juros</label>
                <select
                  value={metodologiaJuros}
                  onChange={(e) => {
                    setEditouTextoManualmente(false);
                    setMetodologiaJuros(e.target.value as 'pré-fixada' | 'pós-fixada');
                  }}
                  style={ui.select}
                >
                  <option value="pré-fixada">Pré-fixada</option>
                  <option value="pós-fixada">Pós-fixada</option>
                </select>
              </div>

              <div>
                <label style={ui.label}>Conta Desembolso</label>
                <input
                  type="text"
                  value={contaDesembolso}
                  onChange={(e) => {
                    setEditouTextoManualmente(false);
                    setContaDesembolso(e.target.value);
                  }}
                  placeholder="Ex: 25841-2"
                  style={ui.input}
                />
              </div>

              <div>
                <label style={ui.label}>Fundo Liquidez (5%)?</label>
                <select
                  value={temFundoLiquidez}
                  onChange={(e) => {
                    setEditouTextoManualmente(false);
                    setTemFundoLiquidez(e.target.value as 'NÃO' | 'SIM');
                  }}
                  style={ui.select}
                >
                  <option value="NÃO">NÃO</option>
                  <option value="SIM">SIM (R$ {valorFundoLiquidez})</option>
                </select>
              </div>

              {temFundoLiquidez === 'SIM' && (
                <div>
                  <label style={ui.label}>Nº Conta-Reserva</label>
                  <input
                    type="text"
                    value={contaReservaFundo}
                    onChange={(e) => {
                      setEditouTextoManualmente(false);
                      setContaReservaFundo(e.target.value);
                    }}
                    placeholder="Conta Fundo"
                    style={ui.input}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* SEÇÃO 4: CONFORMIDADE (IDs), MÚLTIPLAS PENDÊNCIAS (+), RELAC. NEGOCIAL E ASSINATURAS */}
      <div style={ui.sectionCard}>
        <div style={ui.sectionHeader}>
          <h4 style={ui.sectionTitle}>
            📋 {modeloAtivo === 'PRONAF_A' ? '3.' : '4.'} Conformidade Ambiental, Restrições e Assinaturas
          </h4>
        </div>

        {/* TÓPICO OPCIONAL DE RELACIONAMENTO NEGOCIAL (Oculto em LCGH/LCGA) */}
        {modeloAtivo !== 'LIMITE_LCG' && (
          <div
            style={{
              background: incluirRelacionamentoNegocial ? '#eff6ff' : '#f8fafc',
              border: `1.5px dashed ${
                incluirRelacionamentoNegocial ? '#3b82f6' : '#cbd5e1'
              }`,
              borderRadius: '8px',
              padding: '12px 14px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '10px',
              }}
            >
              <label
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '12px',
                  fontWeight: 700,
                  color: incluirRelacionamentoNegocial ? '#1d4ed8' : '#334155',
                  cursor: 'pointer',
                  margin: 0,
                }}
              >
                <input
                  type="checkbox"
                  checked={incluirRelacionamentoNegocial}
                  onChange={(e) => {
                    setEditouTextoManualmente(false);
                    const marcar = e.target.checked;
                    setIncluirRelacionamentoNegocial(marcar);
                    if (marcar) {
                      recalcularRelacionamentoNegocialPadrao(valorOperacao, porteCliente);
                    }
                  }}
                  style={{
                    width: '15px',
                    height: '15px',
                    margin: 0,
                    cursor: 'pointer',
                    accentColor: '#1d4ed8',
                  }}
                />
                🤝 Incluir tópico de Relacionamento Negocial neste Parecer? (Opcional)
              </label>

              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  background: '#ffffff',
                  color: '#475569',
                  border: '1px solid #cbd5e1',
                  padding: '3px 10px',
                  borderRadius: '12px',
                }}
              >
                Teto p/ {porteCliente} ({(percMaximoRelacionamento * 100).toFixed(0)}%):{' '}
                <strong style={{ color: '#8B1530' }}>
                  R$ {formatarMoedaBD(tetoMaximoRelacionamentoReais)}
                </strong>
              </span>
            </div>

            {incluirRelacionamentoNegocial && (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1.2fr 1.2fr 1.6fr auto',
                  gap: '12px',
                  alignItems: 'end',
                  paddingTop: '6px',
                  borderTop: '1px solid #dbeafe',
                }}
              >
                <div>
                  <label style={{ ...ui.label, color: '#1e40af' }}>
                    Seguro Prestamista (R$ — Padrão 3,84%)
                  </label>
                  <input
                    type="text"
                    value={valSeguroPrestamista}
                    onChange={(e) => handleAlterarSeguroPrestamista(e.target.value)}
                    style={{ ...ui.input, fontWeight: 700 }}
                  />
                </div>

                <div>
                  <label style={{ ...ui.label, color: '#1e40af' }}>
                    Aplicação Automática (R$)
                  </label>
                  <input
                    type="text"
                    value={valAplicacaoAutomatica}
                    onChange={(e) => handleAlterarAplicacaoAutomatica(e.target.value)}
                    style={{ ...ui.input, fontWeight: 700 }}
                  />
                </div>

                <div
                  style={{
                    background: '#ffffff',
                    border: '1px solid #bfdbfe',
                    borderRadius: '6px',
                    padding: '6px 12px',
                    height: '36px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                  }}
                >
                  <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 700 }}>
                    TOTAL DO RELACIONAMENTO (MÁX. {(percMaximoRelacionamento * 100).toFixed(0)}%)
                  </div>
                  <div style={{ fontSize: '12px', fontWeight: 800, color: '#15803d' }}>
                    R$ {formatarMoedaBD(somaRelacionamentoAtual)} ({percRelacionamentoAtual.toFixed(2)}% da proposta)
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setEditouTextoManualmente(false);
                    recalcularRelacionamentoNegocialPadrao(valorOperacao, porteCliente);
                  }}
                  style={{
                    width: 'auto',
                    height: '36px',
                    padding: '0 12px',
                    fontSize: '11px',
                    fontWeight: 700,
                    background: '#ffffff',
                    color: '#1d4ed8',
                    border: '1px solid #93c5fd',
                    borderRadius: '6px',
                    cursor: 'pointer',
                  }}
                >
                  ⚡ Recalcular Padrão
                </button>
              </div>
            )}
          </div>
        )}

        {/* BLOCO DE MÚLTIPLAS PENDÊNCIAS / RESTRIÇÕES LEVES COM BOTÃO "+" E VALOR OPCIONAL */}
        {modeloAtivo !== 'LIMITE_LCG' && (
          <div
            style={{
              background: possuiRestricaoLeve22 === 'SIM' ? '#fffbeb' : '#f8fafc',
              border: `1px solid ${possuiRestricaoLeve22 === 'SIM' ? '#fde68a' : '#e2e8f0'}`,
              borderRadius: '8px',
              padding: '12px 14px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '10px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <strong style={{ fontSize: '12px', color: '#334155' }}>
                  ⚠️ Pendência / Restrição Não Impeditiva (Norma 1038-05-02):
                </strong>
                <select
                  value={possuiRestricaoLeve22}
                  onChange={(e) => {
                    setEditouTextoManualmente(false);
                    setPossuiRestricaoLeve22(e.target.value as 'NAO' | 'SIM');
                  }}
                  style={{
                    ...ui.select,
                    width: 'auto',
                    minWidth: '220px',
                    height: '32px',
                    fontWeight: 700,
                  }}
                >
                  <option value="NAO">NÃO (Sem restrições cadastrais)</option>
                  <option value="SIM">SIM (Descrever pendência(s) no parecer)</option>
                </select>
              </div>

              {possuiRestricaoLeve22 === 'SIM' && (
                <button
                  type="button"
                  onClick={() => {
                    setEditouTextoManualmente(false);
                    setListaRestricoes22([
                      ...listaRestricoes22,
                      { id: `rest_${Date.now()}`, descricao: '', valor: '' },
                    ]);
                  }}
                  style={{
                    width: 'auto',
                    height: '30px',
                    padding: '0 12px',
                    fontSize: '11.5px',
                    background: '#fef3c7',
                    color: '#b45309',
                    border: '1px solid #f59e0b',
                    borderRadius: '6px',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  + Adicionar Outra Pendência
                </button>
              )}
            </div>

            {possuiRestricaoLeve22 === 'SIM' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {listaRestricoes22.map((rest, idxR) => (
                  <div
                    key={rest.id}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '2.2fr 1fr auto',
                      gap: '10px',
                      alignItems: 'end',
                    }}
                  >
                    <div>
                      <label style={{ ...ui.label, color: '#92400e' }}>
                        Descrição da Pendência #{idxR + 1}
                      </label>
                      <input
                        type="text"
                        value={rest.descricao}
                        onChange={(e) => {
                          setEditouTextoManualmente(false);
                          const novas = [...listaRestricoes22];
                          novas[idxR] = { ...novas[idxR], descricao: e.target.value };
                          setListaRestricoes22(novas);
                        }}
                        placeholder="Ex: PEFIN comercial (CAEMA) ou apontamento cadastral..."
                        style={ui.input}
                      />
                    </div>

                    <div>
                      <label style={{ ...ui.label, color: '#92400e' }}>
                        Valor (R$ — Opcional; deixe vazio se não houver)
                      </label>
                      <input
                        type="text"
                        value={rest.valor}
                        onChange={(e) => {
                          setEditouTextoManualmente(false);
                          const valBruto = e.target.value.trim();
                          const novas = [...listaRestricoes22];
                          novas[idxR] = {
                            ...novas[idxR],
                            valor: valBruto === '' ? '' : mascaraMoedaInput(valBruto),
                          };
                          setListaRestricoes22(novas);
                        }}
                        placeholder="Opcional (Ex: 127,82)"
                        style={ui.input}
                      />
                    </div>

                    {listaRestricoes22.length > 1 && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditouTextoManualmente(false);
                          setListaRestricoes22(listaRestricoes22.filter((_, i) => i !== idxR));
                        }}
                        style={{
                          width: 'auto',
                          height: '36px',
                          padding: '0 10px',
                          fontSize: '12px',
                          background: '#fee2e2',
                          color: '#b91c1c',
                          border: '1px solid #fecaca',
                          borderRadius: '6px',
                          cursor: 'pointer',
                        }}
                        title="Remover pendência"
                      >
                        🗑️
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* LINHA DE IDs AMBIENTAIS / GED (Quando PRONAF A ou Limite LCG) */}
        {(modeloAtivo === 'PRONAF_A' || modeloAtivo === 'LIMITE_LCG') && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '12px',
              alignItems: 'end',
            }}
          >
            {modeloAtivo === 'PRONAF_A' && (
              <>
                <div>
                  <label style={{ ...ui.label, color: '#8B1530' }}>ID da DCAA</label>
                  <input
                    type="text"
                    value={idDcaa}
                    onChange={(e) => {
                      setEditouTextoManualmente(false);
                      setIdDcaa(e.target.value);
                    }}
                    placeholder="Ex: 751883872"
                    style={ui.input}
                  />
                </div>
                <div>
                  <label style={{ ...ui.label, color: '#8B1530' }}>ID do Parecer SEMA</label>
                  <input
                    type="text"
                    value={idSema}
                    onChange={(e) => {
                      setEditouTextoManualmente(false);
                      setIdSema(e.target.value);
                    }}
                    placeholder="Ex: 752090578"
                    style={ui.input}
                  />
                </div>
              </>
            )}

            {modeloAtivo === 'LIMITE_LCG' && (
              <>
                <div>
                  <label style={{ ...ui.label, color: '#8B1530' }}>ID Endereço Fora</label>
                  <input
                    type="text"
                    value={idEnderecoFora}
                    onChange={(e) => {
                      setEditouTextoManualmente(false);
                      setIdEnderecoFora(e.target.value);
                    }}
                    placeholder="ID GED Endereço"
                    style={ui.input}
                  />
                </div>
                <div>
                  <label style={{ ...ui.label, color: '#8B1530' }}>ID Renda Extra Rural</label>
                  <input
                    type="text"
                    value={idRendaExtra}
                    onChange={(e) => {
                      setEditouTextoManualmente(false);
                      setIdRendaExtra(e.target.value);
                    }}
                    placeholder="ID GED Renda"
                    style={ui.input}
                  />
                </div>
              </>
            )}
          </div>
        )}

        {/* ITEM 1: LINHA EXCLUSIVA DOS GERENTES (SEMPRE LADO A LADO NA MESMA LINHA EM TODOS OS MODELOS) */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '12px',
            alignItems: 'end',
          }}
        >
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label style={ui.label}>Gerente de Relacionamento</label>
              <label
                style={{
                  fontSize: '10.5px',
                  fontWeight: 700,
                  color: '#475569',
                  cursor: 'pointer',
                  marginBottom: '4px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <input
                  type="checkbox"
                  checked={gerenteRelEE}
                  onChange={(e) => {
                    setEditouTextoManualmente(false);
                    setGerenteRelEE(e.target.checked);
                  }}
                  style={{ width: '13px', height: '13px', margin: 0 }}
                />
                e.e.
              </label>
            </div>
            <input
              type="text"
              value={gerenteRelacionamento}
              onChange={(e) => {
                setEditouTextoManualmente(false);
                setGerenteRelacionamento(e.target.value);
                salvarAssinaturasNoCache(e.target.value, gerenteAgencia);
              }}
              style={ui.input}
            />
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label style={ui.label}>Gerente de Agência</label>
              <label
                style={{
                  fontSize: '10.5px',
                  fontWeight: 700,
                  color: '#475569',
                  cursor: 'pointer',
                  marginBottom: '4px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <input
                  type="checkbox"
                  checked={gerenteAgEE}
                  onChange={(e) => {
                    setEditouTextoManualmente(false);
                    setGerenteAgEE(e.target.checked);
                  }}
                  style={{ width: '13px', height: '13px', margin: 0 }}
                />
                e.e.
              </label>
            </div>
            <input
              type="text"
              value={gerenteAgencia}
              onChange={(e) => {
                setEditouTextoManualmente(false);
                setGerenteAgencia(e.target.value);
                salvarAssinaturasNoCache(gerenteRelacionamento, e.target.value);
              }}
              style={ui.input}
            />
          </div>
        </div>
      </div>

      {/* CAIXA DO PARECER GERENCIAL GERADO (100% EDITÁVEL COM NEGRITO VISUAL NOS TÓPICOS) */}
      <div style={ui.sectionCard}>
        <div style={ui.sectionHeader}>
          <h4 style={{ ...ui.sectionTitle, color: '#1e293b' }}>
            📝 Minuta Final do Parecer Gerencial (Editável)
          </h4>
          {editouTextoManualmente && (
            <span style={{ fontSize: '11px', color: '#b45309', fontWeight: 700 }}>
              ✍️ Editado manualmente — Clique em &ldquo;🔄 Restaurar Padrão&rdquo; no topo se desejar regerar
            </span>
          )}
        </div>
        <div
          ref={editorParecerRef}
          contentEditable
          suppressContentEditableWarning
          onInput={(e) => {
            setEditouTextoManualmente(true);
            setTextoParecerFinal(e.currentTarget.innerText);
          }}
          onBlur={(e) => {
            const textoAtual = e.currentTarget.innerText;
            setTextoParecerFinal(textoAtual);
            e.currentTarget.innerHTML = formatarParecerHtmlComNegrito(textoAtual);
          }}
          style={{
            width: '100%',
            minHeight: '420px',
            maxHeight: '620px',
            overflowY: 'auto',
            padding: '16px',
            fontSize: '13px',
            lineHeight: 1.6,
            fontFamily: "'Consolas', 'Courier New', monospace",
            border: '1px solid #cbd5e1',
            borderRadius: '8px',
            background: '#fcfcfd',
            color: '#0f172a',
            boxSizing: 'border-box',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            outline: 'none',
          }}
        />
      </div>
    </div>
  );
}