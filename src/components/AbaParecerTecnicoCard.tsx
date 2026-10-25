'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { CardKanban, RegistroContratacao } from '@/types/painel';
import { parseMoeda, formatarMoedaBD, mascaraDocumento, mascaraMoedaInput } from '@/lib/utils';

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

const STORAGE_KEY_ASSINATURAS_PARECER = 'bnb_v2_assinaturas_parecer';

const TEXTO_RESERVA_LEGAL_ATE_4MF =
  'Suficiência da reserva legal: o imóvel abaixo de 4 módulos com CAR com indicação de área rural consolidada, atendendo aos subitens 1.1, 1.2 e 1.3 da Tabela 2 do normativo 3102-03-27 - Impedimentos Sociais, Ambientais e Climáticos (Conformidade Socioambiental) e Críticas SICOR.';

const TEXTO_RESERVA_LEGAL_ACIMA_4MF =
  'Suficiência da reserva legal: imóvel com área superior a 4 módulos fiscais com Reserva Legal e área rural consolidada devidamente demonstradas no CAR, em conformidade com o normativo 3102-03-27 - Impedimentos Sociais, Ambientais e Climáticos (Conformidade Socioambiental) e Críticas SICOR.';

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
  const [modeloAtivo, setModeloAtivo] = useState<'PRONAF_A' | 'INV_CUSTEIO' | 'LIMITE_LCG'>('PRONAF_A');

  // Dados Gerais Comuns
  const [nomeCliente, setNomeCliente] = useState('');
  const [cpfCliente, setCpfCliente] = useState('');
  const [porteCliente, setPorteCliente] = useState('PRONAF V');
  const [tipoOperacao, setTipoOperacao] = useState('Investimento');
  const [valorOperacao, setValorOperacao] = useState('');
  const [programaCredito, setProgramaCredito] = useState('FNE /PRONAF A - FNE (699)');
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
    'Criação de bovinos para corte Semi-intensiva'
  );
  const [verboAtividadeTexto, setVerboAtividadeTexto] = useState('bovinocultura de corte');
  const [itensFinanciadosTexto, setItensFinanciadosTexto] = useState(
    'FORMAÇÃO 1 HA DE PASTAGEM CAPIM BRACHIARIA, AQ. DE REPRODUTOR BOVINO MESTIÇO ZEBUINO APTIDÃO CORTE, AQ. DE MATRIZES BOVINAS APTIDÃO CORTE'
  );

  // Regra dos 4 Módulos Fiscais (Automático para PRONAF/PRONAF A | Perguntado para MINI)
  const [abaixoQuatroModulos, setAbaixoQuatroModulos] = useState<'SIM' | 'NAO' | 'PERGUNTAR'>('SIM');

  // Campos Ambientais e Restrição 2.2 (PRONAF A e Geral)
  const [idDcaa, setIdDcaa] = useState('');
  const [idSema, setIdSema] = useState('');
  const [possuiRestricaoLeve22, setPossuiRestricaoLeve22] = useState<'NAO' | 'SIM'>('NAO');
  const [descRestricao22, setDescRestricao22] = useState('PEFIN comercial (CAEMA)');
  const [valorRestricao22, setValorRestricao22] = useState('127,82');

  // Campos Específicos de LCGH / LCGA
  const [idEnderecoFora, setIdEnderecoFora] = useState('');
  const [idRendaExtra, setIdRendaExtra] = useState('');

  // Campos Específicos de Investimento / Custeio (PRONAF V e MINI)
  const [valorAssessoria, setValorAssessoria] = useState('0,00');
  const [assessoriaPropria, setAssessoriaPropria] = useState<'NÃO' | 'SIM'>('NÃO');
  const [metodologiaJuros, setMetodologiaJuros] = useState<'pré-fixada' | 'pós-fixada'>('pré-fixada');
  const [temFundoLiquidez, setTemFundoLiquidez] = useState<'NÃO' | 'SIM'>('NÃO');
  const [valorFundoLiquidez, setValorFundoLiquidez] = useState('0,00');
  const [contaReservaFundo, setContaReservaFundo] = useState('');
  const [contaDesembolso, setContaDesembolso] = useState('');
  const [saldoDevedorEmSer, setSaldoDevedorEmSer] = useState('0,00');
  const [garantiaComprometida, setGarantiaComprometida] = useState('0,00');

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
  const [gerenteAgencia, setGerenteAgencia] = useState(
    'Josenildo Nunes da Costa - F120286'
  );
  const [gerenteAgEE, setGerenteAgEE] = useState(false);

  // Texto Final do Parecer (Editável)
  const [textoParecerFinal, setTextoParecerFinal] = useState('');
  const [editouTextoManualmente, setEditouTextoManualmente] = useState(false);

  // Carrega assinaturas salvas no navegador
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

  // Sincroniza dados do Card e da Operação selecionada ao abrir ou trocar de operação
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

    const tUp = tOp.toUpperCase().trim();
    if (tUp === 'LCGH' || tUp === 'LCGA') {
      setModeloAtivo('LIMITE_LCG');
      setPrazoMeses('120');
      setProgramaCredito(tUp === 'LCGH' ? '(975) HIPOTECA' : '(653) ALI. FID.');
    } else if (prt === 'PRONAF A') {
      setModeloAtivo('PRONAF_A');
      setPrazoMeses('120');
      setCarenciaMeses('36');
      setProgramaCredito(progOp || 'FNE /PRONAF A - FNE (699)');
    } else {
      setModeloAtivo('INV_CUSTEIO');
      setPrazoMeses(tUp.includes('CUSTEIO') ? '24' : '96');
      setCarenciaMeses(tUp.includes('CUSTEIO') ? '0' : '24');
      setProgramaCredito(
        progOp ||
          (prt.includes('PRONAF')
            ? 'FNE /PRONAF - COMUM (FNE) (433)'
            : 'FNE /RURAL (226)')
      );
    }

    // Regra dos 4 Módulos Fiscais: Automático para PRONAF e PRONAF A; Perguntar para MINI
    if (prt.includes('PRONAF')) {
      setAbaixoQuatroModulos('SIM');
    } else {
      setAbaixoQuatroModulos('PERGUNTAR');
    }

    // Fundo de Liquidez: Obrigatório 5% para MINI
    if (prt === 'MINI') {
      setTemFundoLiquidez('SIM');
      const vNum = parseMoeda(valOp);
      setValorFundoLiquidez(formatarMoedaBD(vNum * 0.05));
    } else {
      setTemFundoLiquidez('NÃO');
      setValorFundoLiquidez('0,00');
    }

    // Preenche Avalista se houver no Card / Operação
    const regComAval =
      operacoesCliente.find((o) => o.avalistaNome || o.avalistaCpf) || opAtiva;
    if (regComAval?.avalistaNome || regComAval?.avalistaCpf) {
      setTemFidejussoria('SIM');
      setNomeAvalista(regComAval.avalistaNome || '');
      setCpfAvalista(regComAval.avalistaCpf || '');
    }

    // Se o cliente tiver uma operação LCGH/LCGA na base, já puxa o valor dela para a Garantia Real de Inv/Custeio
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

    // Escaneia o texto do Card em busca de IDs anotados (DCAA, SEMA, Renda Extrarrural, Endereço Extrarrural)
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

  // Atualiza cálculo de 5% do Fundo de Liquidez quando muda o valor ou a chave
  useEffect(() => {
    if (temFundoLiquidez === 'SIM') {
      const vNum = parseMoeda(valorOperacao);
      setValorFundoLiquidez(formatarMoedaBD(vNum * 0.05));
    } else {
      setValorFundoLiquidez('0,00');
    }
  }, [temFundoLiquidez, valorOperacao]);

  // =========================================================================
  // MOTOR DE GERAÇÃO DOS 3 MODELOS DE PARECERES OFICIAIS
  // =========================================================================
  const construirTextoParecer = (): string => {
    const nome = (nomeCliente || '[NOME DO CLIENTE]').toUpperCase().trim();
    const cpf = cpfCliente || '[CPF]';
    const primeiroNome = nome.split(' ')[0] || '';
    const tratamento = primeiroNome.toLowerCase().endsWith('a') ? 'A Sr.ª' : 'O Sr.';

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

    const verboExplora = (verboAtividadeTexto || 'bovinocultura de corte').trim();
    const descAtiv = (descAtividadeCabecalho || verboExplora).trim();

    // Formata lista de itens financiados separados por vírgula e "e" no último
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

    // Regra de Suficiência da Reserva Legal (Até 4 MF vs Acima de 4 MF)
    const isAte4Modulos =
      porteCliente.includes('PRONAF') || abaixoQuatroModulos !== 'NAO';
    const textoReservaLegalAplicavel = isAte4Modulos
      ? TEXTO_RESERVA_LEGAL_ATE_4MF
      : TEXTO_RESERVA_LEGAL_ACIMA_4MF;

    const sufixoRelEE = gerenteRelEE ? ' e.e.' : '';
    const sufixoAgEE = gerenteAgEE ? ' e.e.' : '';

    // -----------------------------------------------------------------------
    // MODELO 1: PRONAF A (NOVO MODELO OFICIAL ATUALIZADO)
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
        possuiRestricaoLeve22 === 'SIM'
          ? `\n2.2) Cliente possui pendência ${descRestricao22 || '[especificar pendência]'}, no valor de R$ ${
              valorRestricao22 || '0,00'
            }, em andamento para resolução, não sendo impeditiva à concessão do crédito conforme norma nº 1038-05-02 (nota 34).`
          : '';

      return (
        `PROGRAMA: ${programaCredito}\n\n` +
        `Cliente: ${nome}\n` +
        `CPF: ${cpf}\n` +
        `Valor Financiado: R$ ${valorOperacao || '0,00'}\n` +
        `Finalidade: ${tipoOperacao}\n` +
        `Prazo Total: ${prazoMeses} meses\n` +
        `Carência: ${carenciaMeses} meses\n` +
        `Objetivo: ${objetivoPleito}\n` +
        `Garantia: ${garantiaTxt}\n` +
        `Atividade Econômica – ${setorAtividade}: ${descAtiv}\n\n` +
        `INFORMAÇÕES DO PLEITO:\n` +
        `O presente pleito objetiva o financiamento com recursos do FNE/PRONAF A, para aquisição de itens destinados à atividade de ${verboExplora}, nos imóveis rurais do beneficiário, constante(s) no projeto, localizado(s) no ${nomePA}, na zona de ${cidadePA}.\n` +
        `No que se refere à relação entre o proponente e funcionário do Banco, informa-se que não há vínculo de parentesco com funcionário que atue na análise, deliberação ou decisão da presente operação de crédito.\n\n` +
        `GARANTIA:\n` +
        `O financiamento não possui garantias, conforme item 7.1 do normativo 1101-08-02.\n\n` +
        `HISTÓRICO:\n` +
        `O assentado faz parte da Associação dos Produtores Rurais do(a) ${nomePA}, situado no Extensão de município de ${cidadePA}, a gleba já dispõe de uma infraestrutura básica capaz de manter as famílias como energia, água, escolas e, etc. ${txtRelacionamentoSimples}. Atualmente ${statusAdimplencia}, ${statusAtrasos} e explora a atividade de ${verboExplora}. Cliente informa que adota as orientações técnicas necessárias à sua atividade produtiva.\n\n` +
        `2. PROPOSTA\n` +
        `Projeto Individual para a estruturação inicial no âmbito do PRONAF A, destinado ao desenvolvimento da ${verboExplora}, tais como: ${itensConcatenados}. Com a implantação do projeto o associado irá aumentar a sua capacidade produtiva e consequentemente, irá melhorar as condições de vida da família.\n\n` +
        `3. IMOVEL:\n` +
        `O imóvel pertence ao INCRA, a gleba está situada em uma região que dispõe de condições favoráveis ao desenvolvimento da agropecuária, como: solos de boa fertilidade, topografia ondulada, pluviosidade entre 1.400 e 1.700mm/ano. Cada associado já possui o seu lote delimitado o que facilita a realização do negócio individual. Os lotes já dispõem de pastagens artificiais precisando ser ampliada.\n\n` +
        `6. PARECER CONCLUSIVO:\n` +
        `Considerando-se os seguintes fatores:\n` +
        `1) Justificativa do analisador: ${TEXTO_RESERVA_LEGAL_ATE_4MF}\n` +
        `1.1) A atividade encontra-se dispensada de licenciamento ambiental por ser desenvolvida em imóvel rural de até quatro módulos fiscais e estar enquadrada no art. 1º do Decreto Estadual nº 31.109/2015, observados os requisitos ambientais aplicáveis, inclusive a apresentação da DCAA, a ausência de intervenção em APP e de supressão de vegetação nativa. Nessas condições, quando não incidente em APA ou RPPN, o Parecer SEMA nº 120/2023 considera dispensável a autorização específica da Unidade de Conservação para fins de concessão do crédito rural.\n` +
        `- DCAA conforme o ID: ${idDcaa || '[Informar ID]'}\n` +
        `- Parecer do SEMA, conforme o ID: ${idSema || '[Informar ID]'}\n\n` +
        `2) Inexistência de restrições cadastrais impeditivas nas fontes consultadas;${blocoItem22}\n` +
        `3) O proponente pertence ao público-alvo do programa, conforme CAF apresentada;\n` +
        `4) Viabilidade da proposta, conforme estudo apresentado pelo técnico responsável pela sua elaboração.\n` +
        `5) Oportunidade e adequação do crédito às necessidades do empreendimento do proponente;\n` +
        `6) Enquadramento normativo do pleito, conforme MB-OC-1101-08-02 (PRONAF - A);\n` +
        `7) Nota de risco: ${notaRisco || 'AA'}\n` +
        `8) Cliente não possui parentesco com funcionário do Banco do Nordeste do Brasil S/A.\n` +
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
    const hoje = new Date().toLocaleDateString('pt-BR');

    // Imóveis Beneficiados
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

    // Garantias Reais + Cálculo da Margem Livre
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
    const garExigida = valorProjNum * fatorD;
    const mrgLivre = valAvalTotal - valComprometida;
    const relGar = valorProjNum > 0 ? (mrgLivre / valorProjNum) * 100 : 0;

    let idx = 1;
    let textoFinal = '';

    textoFinal += `${idx}. PROPOSTA DE CRÉDITO:\n\n`;
    textoFinal += `${tratamento} ${nome} é produtor(a) rural (${setorAtividade.toLowerCase()})\n\n`;
    textoFinal += `${idx}.1) Atividade econômica a ser financiada: ${descAtiv};\n`;
    textoFinal += `${idx}.2) Finalidade: ${tipoOperacao} ${setorAtividade};\n`;
    textoFinal += `${idx}.3) Programa: ${programaCredito}\n\n`;
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
          )} x R$ ${formatarMoedaBD(valorProjNum)} = R$ ${formatarMoedaBD(garExigida)}\n`;
          textoFinal += `${idx}.${sGar}.4 Valor total da garantia: R$ ${formatarMoedaBD(
            valAvalTotal
          )}\n`;
          textoFinal += `${idx}.${sGar}.5 Margem Livre: R$ ${formatarMoedaBD(
            valAvalTotal
          )} - R$ ${formatarMoedaBD(valComprometida)} = R$ ${formatarMoedaBD(mrgLivre)}.\n`;
          textoFinal += `${idx}.${sGar}.6 Relação de garantia nesta proposta: (%) R$ ${formatarMoedaBD(
            mrgLivre
          )} / R$ ${formatarMoedaBD(valorProjNum)} x 100 = ${relGar.toLocaleString('pt-BR', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}\n\n`;
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
    const txtAss =
      assessoriaPropria === 'SIM'
        ? 'será oriunda de recursos próprios advindos da atividade pecuária que o cliente desenvolve em suas propriedades rurais, além das atividades extra rurais que o mesmo desenvolve.'
        : 'será financiada juntamente aos itens do plano, com sua descrição e valor devidamente determinados no projeto.';

    textoFinal += `${idx}. PROPOSTA:\n\n`;
    textoFinal += `A presente proposta abrange: ${itensConcatenados}${txtCusteioPecuario}, totalizando R$ ${
      valorOperacao || '0,00'
    }. A assessoria técnica no valor de R$ ${valorAssessoria || '0,00'} ${txtAss}\n\n`;
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
      textoFinal += `${idx++}. Restrições impeditivas ao crédito: Cliente possui pendência ${descRestricao22}, no valor de R$ ${valorRestricao22}, em andamento para resolução, não sendo impeditiva à concessão do crédito conforme norma nº 1038-05-02 (nota 34).\n\n`;
    } else {
      textoFinal += `${idx++}. Restrições impeditivas ao crédito: não possui.\n\n`;
    }

    const percRelacionamento = porteCliente.includes('PRONAF') ? 0.05 : 0.1;
    const valSeguroX = valorProjNum * 0.0384;
    const valAplicacaoY = valorProjNum * percRelacionamento - valSeguroX;

    textoFinal += `${idx++}. Atrasos no SCR: não possui.\n\n`;
    textoFinal += `${idx++}. Nota de risco: ${notaRisco || 'AA'}.\n\n`;
    textoFinal += `${idx++}. ${textoReservaLegalAplicavel}\n\n`;
    textoFinal += `${idx++}. Relacionamento negocial: seguro prestamista no valor de R$ ${formatarMoedaBD(
      valSeguroX
    )} a ser contratado e aplicação automática de R$ ${formatarMoedaBD(valAplicacaoY)}.\n\n`;
    textoFinal += `${idx++}. PARECER CONCLUSIVO:\n\nManifestamo-nos favoráveis ao deferimento da proposta e submetemos a esta alçada para apreciação e decisão.\n\n`;
    textoFinal += `${idx++}. Submete-se a proposta ao comitê/COMAG.\n\n`;
    textoFinal += `_________________________\n${gerenteRelacionamento}\nGerente de Relacionamento${sufixoRelEE}\n\n`;
    textoFinal += `_________________________\n${gerenteAgencia}\nGerente de Agência${sufixoAgEE}`;

    return textoFinal;
  };

  // Atualiza automaticamente o texto do parecer sempre que um campo do formulário muda (a menos que o usuário esteja editando na mão e não queira sobrescrever)
  useEffect(() => {
    if (!editouTextoManualmente) {
      setTextoParecerFinal(construirTextoParecer());
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
    descRestricao22,
    valorRestricao22,
    idEnderecoFora,
    idRendaExtra,
    valorAssessoria,
    assessoriaPropria,
    metodologiaJuros,
    temFundoLiquidez,
    valorFundoLiquidez,
    contaReservaFundo,
    contaDesembolso,
    saldoDevedorEmSer,
    garantiaComprometida,
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {/* BARRA SUPERIOR: ESCOLHA DA OPERAÇÃO DO CLIENTE E MODELO DE PARECER */}
      <div
        style={{
          background: '#ffffff',
          border: '1.5px solid #cbd5e1',
          borderRadius: '8px',
          padding: '12px 16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '10px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {operacoesCliente.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <strong style={{ fontSize: '11.5px', color: '#8B1530' }}>
                🚜 Operação do Cliente:
              </strong>
              <select
                value={opSelecionadaId}
                onChange={(e) => setOpSelecionadaId(e.target.value)}
                style={{
                  width: 'auto',
                  height: '30px',
                  fontSize: '12px',
                  fontWeight: 'bold',
                  padding: '0 8px',
                  background: '#fff8e1',
                  border: '1px solid #f59e0b',
                  borderRadius: '6px',
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

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <strong style={{ fontSize: '11.5px', color: '#334155' }}>📄 Modelo:</strong>
            <select
              value={modeloAtivo}
              onChange={(e) => {
                setEditouTextoManualmente(false);
                setModeloAtivo(
                  e.target.value as 'PRONAF_A' | 'INV_CUSTEIO' | 'LIMITE_LCG'
                );
              }}
              style={{
                width: 'auto',
                height: '30px',
                fontSize: '12px',
                fontWeight: 'bold',
                padding: '0 8px',
                borderRadius: '6px',
              }}
            >
              <option value="PRONAF_A">1. Parecer PRONAF A (Modelo Novo c/ DCAA e SEMA)</option>
              <option value="INV_CUSTEIO">
                2. Parecer Investimento / Custeio (PRONAF V / MINI / Geral)
              </option>
              <option value="LIMITE_LCG">
                3. Parecer de Limite / Garantia (LCGH / LCGA)
              </option>
            </select>
          </div>
        </div>

        {/* Botões de Ação Rápida */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => {
              setEditouTextoManualmente(false);
              setTextoParecerFinal(construirTextoParecer());
            }}
            style={{
              width: 'auto',
              padding: '6px 12px',
              fontSize: '11.5px',
              background: '#f1f5f9',
              color: '#334155',
              border: '1px solid #cbd5e1',
              borderRadius: '6px',
              fontWeight: 'bold',
              cursor: 'pointer',
            }}
          >
            🔄 Atualizar Texto pelos Campos
          </button>

          <button
            type="button"
            onClick={() => {
              verificar4ModulosAntesDeExportar();
              const txtFinal = editouTextoManualmente
                ? textoParecerFinal
                : construirTextoParecer();
              navigator.clipboard.writeText(txtFinal);
              alert('📋 Parecer Técnico copiado com sucesso para a área de transferência!');
            }}
            style={{
              width: 'auto',
              padding: '6px 14px',
              fontSize: '11.5px',
              background: '#8B1530',
              color: '#ffffff',
              border: 'none',
              borderRadius: '6px',
              fontWeight: 'bold',
              cursor: 'pointer',
            }}
          >
            📋 Copiar Parecer
          </button>

          <button
            type="button"
            onClick={() => {
              verificar4ModulosAntesDeExportar();
              const txtFinal = editouTextoManualmente
                ? textoParecerFinal
                : construirTextoParecer();
              const jan = window.open('', '_blank');
              if (!jan) return;
              jan.document.write(
                `<html><head><title>Parecer Técnico - ${nomeCliente}</title><style>body{font-family:'Segoe UI',Arial,sans-serif;padding:32px;line-height:1.6;color:#111;}pre{white-space:pre-wrap;font-family:'Segoe UI',Arial,sans-serif;font-size:12.5px;}</style></head><body><pre>${txtFinal}</pre><script>window.print();</script></body></html>`
              );
              jan.document.close();
            }}
            style={{
              width: 'auto',
              padding: '6px 14px',
              fontSize: '11.5px',
              background: '#15803d',
              color: '#ffffff',
              border: 'none',
              borderRadius: '6px',
              fontWeight: 'bold',
              cursor: 'pointer',
            }}
          >
            🖨️ Imprimir / PDF
          </button>
        </div>
      </div>

      {/* PERGUNTA DESTACADA QUANDO O PORTE É MINI (OU NÃO-PRONAF): ABAIXO DE 4 MÓDULOS FISCAIS? */}
      {!porteCliente.includes('PRONAF') && (
        <div
          style={{
            background: abaixoQuatroModulos === 'PERGUNTAR' ? '#fff3cd' : '#f0fdf4',
            border: `1.5px solid ${
              abaixoQuatroModulos === 'PERGUNTAR' ? '#f59e0b' : '#86efac'
            }`,
            borderRadius: '8px',
            padding: '10px 14px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '10px',
          }}
        >
          <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#1e293b' }}>
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
                padding: '4px 12px',
                fontSize: '11.5px',
                fontWeight: 'bold',
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
                padding: '4px 12px',
                fontSize: '11.5px',
                fontWeight: 'bold',
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

      {/* PAINEL DE CAMPOS DE PREENCHIMENTO RÁPIDO (OS MARCADOS COM #) */}
      <div
        style={{
          background: '#ffffff',
          border: '1px solid #cbd5e1',
          borderRadius: '8px',
          padding: '14px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}
      >
        <strong style={{ fontSize: '12.5px', color: '#8B1530', borderBottom: '1px dashed #cbd5e1', paddingBottom: '6px' }}>
          ⚙️ 1. DADOS DA PROPOSTA, ATIVIDADE E ENQUADRAMENTO (#)
        </strong>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px' }}>
          <div>
            <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#475569' }}>Programa (#)</label>
            <input
              type="text"
              list="dl_programas_kanban"
              value={programaCredito}
              onChange={(e) => {
                setEditouTextoManualmente(false);
                setProgramaCredito(e.target.value);
              }}
              style={{ height: '30px', fontSize: '11.5px' }}
            />
          </div>

          <div>
            <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#475569' }}>Valor (R$)</label>
            <input
              type="text"
              value={valorOperacao}
              onChange={(e) => {
                setEditouTextoManualmente(false);
                setValorOperacao(mascaraMoedaInput(e.target.value));
              }}
              style={{ height: '30px', fontSize: '11.5px', fontWeight: 'bold' }}
            />
          </div>

          <div>
            <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#475569' }}>Prazo Total (Meses #)</label>
            <input
              type="text"
              value={prazoMeses}
              onChange={(e) => {
                setEditouTextoManualmente(false);
                setPrazoMeses(e.target.value);
              }}
              style={{ height: '30px', fontSize: '11.5px' }}
            />
          </div>

          {modeloAtivo !== 'LIMITE_LCG' && (
            <>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#475569' }}>Carência (Meses #)</label>
                <input
                  type="text"
                  value={carenciaMeses}
                  onChange={(e) => {
                    setEditouTextoManualmente(false);
                    setCarenciaMeses(e.target.value);
                  }}
                  style={{ height: '30px', fontSize: '11.5px' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#475569' }}>Objetivo (#)</label>
                <select
                  value={objetivoPleito}
                  onChange={(e) => {
                    setEditouTextoManualmente(false);
                    setObjetivoPleito(e.target.value);
                  }}
                  style={{ height: '30px', fontSize: '11.5px' }}
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
            <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#8B1530' }}>Nota de Risco (#)</label>
            <input
              type="text"
              value={notaRisco}
              onChange={(e) => {
                setEditouTextoManualmente(false);
                setNotaRisco(e.target.value.toUpperCase());
              }}
              placeholder="AA"
              style={{ height: '30px', fontSize: '11.5px', fontWeight: 'bold' }}
            />
          </div>

          <div>
            <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#475569' }}>Início Relac. (Ano)</label>
            <input
              type="number"
              value={anoInicioRel}
              onChange={(e) => {
                setEditouTextoManualmente(false);
                setAnoInicioRel(e.target.value);
              }}
              style={{ height: '30px', fontSize: '11.5px' }}
            />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 1.5fr', gap: '10px' }}>
          <div>
            <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#475569' }}>Setor (#)</label>
            <select
              value={setorAtividade}
              onChange={(e) => {
                setEditouTextoManualmente(false);
                setSetorAtividade(e.target.value as 'Pecuária' | 'Agricultura');
              }}
              style={{ height: '30px', fontSize: '11.5px' }}
            >
              <option value="Pecuária">Pecuária</option>
              <option value="Agricultura">Agricultura</option>
            </select>
          </div>

          <div>
            <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#475569' }}>
              Atividade Econômica no Cabeçalho (#)
            </label>
            <input
              type="text"
              value={descAtividadeCabecalho}
              onChange={(e) => {
                setEditouTextoManualmente(false);
                setDescAtividadeCabecalho(e.target.value);
              }}
              placeholder="Ex: Criação de bovinos para corte Semi-intensiva"
              style={{ height: '30px', fontSize: '11.5px' }}
            />
          </div>

          <div>
            <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#475569' }}>
              Atividade no Texto (#)
            </label>
            <input
              type="text"
              value={verboAtividadeTexto}
              onChange={(e) => {
                setEditouTextoManualmente(false);
                setVerboAtividadeTexto(e.target.value);
              }}
              placeholder="Ex: bovinocultura de corte"
              style={{ height: '30px', fontSize: '11.5px' }}
            />
          </div>
        </div>

        {modeloAtivo !== 'LIMITE_LCG' && (
          <div>
            <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#475569' }}>
              Itens a Financiar / Custear (# — separe os itens por vírgula; o sistema coloca o &quot;e&quot; final automaticamente)
            </label>
            <input
              type="text"
              value={itensFinanciadosTexto}
              onChange={(e) => {
                setEditouTextoManualmente(false);
                setItensFinanciadosTexto(e.target.value);
              }}
              placeholder="Ex: FORMAÇÃO 1 HA DE PASTAGEM CAPIM BRACHIARIA, AQ. DE REPRODUTOR BOVINO..., AQ. DE MATRIZES BOVINAS..."
              style={{ height: '30px', fontSize: '11.5px' }}
            />
          </div>
        )}

        {/* BLOCO DE IMÓVEIS BENEFICIADOS (PARA PRONAF A E INV/CUSTEIO) */}
        {modeloAtivo !== 'LIMITE_LCG' && (
          <div style={{ borderTop: '1px dashed #cbd5e1', paddingTop: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <strong style={{ fontSize: '12px', color: '#15803d' }}>
                📍 2. IMÓVEL(IS) / ASSENTAMENTO (PA) BENEFICIADO PELO PLEITO (#)
              </strong>
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
                style={{ width: 'auto', padding: '3px 10px', fontSize: '11px', background: '#dcfce7', color: '#15803d', border: '1px solid #86efac', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}
              >
                + Adicionar Imóvel
              </button>
            </div>

            {imoveisBeneficiados.map((im, idx) => (
              <div
                key={im.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns:
                    modeloAtivo === 'PRONAF_A' ? '2fr 1.5fr auto' : '2fr 1fr 1.2fr 0.8fr auto',
                  gap: '8px',
                  marginBottom: '6px',
                  alignItems: 'center',
                }}
              >
                <input
                  type="text"
                  value={im.nome}
                  onChange={(e) => {
                    setEditouTextoManualmente(false);
                    const novos = [...imoveisBeneficiados];
                    novos[idx] = { ...novos[idx], nome: e.target.value };
                    setImoveisBeneficiados(novos);
                  }}
                  placeholder="Nome do PA / Fazenda (Ex: PA LAGO DA CARNAUBA)"
                  style={{ height: '28px', fontSize: '11.5px' }}
                />
                {modeloAtivo !== 'PRONAF_A' && (
                  <input
                    type="text"
                    value={im.matricula}
                    onChange={(e) => {
                      setEditouTextoManualmente(false);
                      const novos = [...imoveisBeneficiados];
                      novos[idx] = { ...novos[idx], matricula: e.target.value };
                      setImoveisBeneficiados(novos);
                    }}
                    placeholder="Matrícula nº"
                    style={{ height: '28px', fontSize: '11.5px' }}
                  />
                )}
                <input
                  type="text"
                  value={im.cidadeUf}
                  onChange={(e) => {
                    setEditouTextoManualmente(false);
                    const novos = [...imoveisBeneficiados];
                    novos[idx] = { ...novos[idx], cidadeUf: e.target.value };
                    setImoveisBeneficiados(novos);
                  }}
                  placeholder="Município - UF (Ex: PIO XII - MA)"
                  style={{ height: '28px', fontSize: '11.5px' }}
                />
                {modeloAtivo !== 'PRONAF_A' && (
                  <input
                    type="text"
                    value={im.areaHa}
                    onChange={(e) => {
                      setEditouTextoManualmente(false);
                      const novos = [...imoveisBeneficiados];
                      novos[idx] = { ...novos[idx], areaHa: e.target.value };
                      setImoveisBeneficiados(novos);
                    }}
                    placeholder="Área (ha)"
                    style={{ height: '28px', fontSize: '11.5px' }}
                  />
                )}
                {imoveisBeneficiados.length > 1 && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditouTextoManualmente(false);
                      setImoveisBeneficiados(imoveisBeneficiados.filter((_, i) => i !== idx));
                    }}
                    style={{ width: 'auto', padding: '4px 8px', fontSize: '11px', background: '#fee2e2', color: '#b91c1c', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                  >
                    ✖
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* BLOCO DE GARANTIAS REAIS E INTERVENIENTES (PARA LCGH/LCGA OU INV/CUSTEIO COM GARANTIA REAL) */}
        {(modeloAtivo === 'LIMITE_LCG' || modeloAtivo === 'INV_CUSTEIO') && (
          <div style={{ borderTop: '1px dashed #cbd5e1', paddingTop: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <strong style={{ fontSize: '12px', color: '#8B1530' }}>
                  🛡️ {modeloAtivo === 'LIMITE_LCG' ? '2. IMÓVEL(IS) EM GARANTIA E POSSE (#)' : '3. GARANTIAS E MARGEM LIVRE (#)'}
                </strong>
                {modeloAtivo === 'INV_CUSTEIO' && (
                  <select
                    value={temGarantiaRealInv}
                    onChange={(e) => {
                      setEditouTextoManualmente(false);
                      setTemGarantiaRealInv(e.target.value as 'NÃO' | 'SIM');
                    }}
                    style={{ width: 'auto', height: '26px', fontSize: '11px', fontWeight: 'bold' }}
                  >
                    <option value="NÃO">Sem Garantia Real (Apenas Aval/Fiança)</option>
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
                  style={{ width: 'auto', padding: '3px 10px', fontSize: '11px', background: '#fef2f2', color: '#8B1530', border: '1px solid #fecaca', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}
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
                      borderRadius: '6px',
                      padding: '8px 10px',
                      marginBottom: '8px',
                    }}
                  >
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns:
                          modeloAtivo === 'INV_CUSTEIO'
                            ? '0.7fr 1.8fr 0.9fr 1.2fr 0.7fr 1fr auto'
                            : '1.8fr 1fr 1.3fr 0.8fr auto',
                        gap: '8px',
                        alignItems: 'center',
                      }}
                    >
                      {modeloAtivo === 'INV_CUSTEIO' && (
                        <select
                          value={g.tipo}
                          onChange={(e) => {
                            setEditouTextoManualmente(false);
                            const novos = [...imoveisGarantia];
                            novos[idxG] = { ...novos[idxG], tipo: e.target.value as 'LCGA' | 'LCGH' };
                            setImoveisGarantia(novos);
                          }}
                          style={{ height: '28px', fontSize: '11px' }}
                        >
                          <option value="LCGH">LCGH</option>
                          <option value="LCGA">LCGA</option>
                        </select>
                      )}
                      <input
                        type="text"
                        value={g.nome}
                        onChange={(e) => {
                          setEditouTextoManualmente(false);
                          const novos = [...imoveisGarantia];
                          novos[idxG] = { ...novos[idxG], nome: e.target.value };
                          setImoveisGarantia(novos);
                        }}
                        placeholder="Nome do Imóvel / Fazenda"
                        style={{ height: '28px', fontSize: '11.5px' }}
                      />
                      <input
                        type="text"
                        value={g.matricula}
                        onChange={(e) => {
                          setEditouTextoManualmente(false);
                          const novos = [...imoveisGarantia];
                          novos[idxG] = { ...novos[idxG], matricula: e.target.value };
                          setImoveisGarantia(novos);
                        }}
                        placeholder="Matrícula nº"
                        style={{ height: '28px', fontSize: '11.5px' }}
                      />
                      <input
                        type="text"
                        value={g.cidadeUf}
                        onChange={(e) => {
                          setEditouTextoManualmente(false);
                          const novos = [...imoveisGarantia];
                          novos[idxG] = { ...novos[idxG], cidadeUf: e.target.value };
                          setImoveisGarantia(novos);
                        }}
                        placeholder="Cidade - UF"
                        style={{ height: '28px', fontSize: '11.5px' }}
                      />
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
                        placeholder="Posse (%)"
                        title="Percentual de Posse do Titular (Se < 100%, abre campo de Interveniente)"
                        style={{ height: '28px', fontSize: '11.5px' }}
                      />
                      {modeloAtivo === 'INV_CUSTEIO' && (
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
                          placeholder="V. Avaliado (R$)"
                          style={{ height: '28px', fontSize: '11.5px' }}
                        />
                      )}
                      {imoveisGarantia.length > 1 && (
                        <button
                          type="button"
                          onClick={() => {
                            setEditouTextoManualmente(false);
                            setImoveisGarantia(imoveisGarantia.filter((_, i) => i !== idxG));
                          }}
                          style={{ width: 'auto', padding: '4px 8px', fontSize: '11px', background: '#fee2e2', color: '#b91c1c', border: 'none', borderRadius: '4px' }}
                        >
                          ✖
                        </button>
                      )}
                    </div>

                    {/* Intervenientes quando Posse < 100% */}
                    {posseTitNum < 100 && (
                      <div style={{ marginTop: '8px', paddingLeft: '10px', borderLeft: '3px solid #f59e0b' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                          <span style={{ fontSize: '10.5px', fontWeight: 'bold', color: '#b45309' }}>
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
                            style={{ width: 'auto', padding: '2px 8px', fontSize: '10px', background: '#fffbeb', border: '1px solid #f59e0b', borderRadius: '4px' }}
                          >
                            + Interveniente
                          </button>
                        </div>
                        {g.intervenientes.map((intv, idxI) => (
                          <div key={intv.id} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 0.8fr auto', gap: '6px', marginBottom: '4px' }}>
                            <input
                              type="text"
                              value={intv.nome}
                              onChange={(e) => {
                                setEditouTextoManualmente(false);
                                const novos = [...imoveisGarantia];
                                novos[idxG].intervenientes[idxI].nome = e.target.value;
                                setImoveisGarantia(novos);
                              }}
                              placeholder="Nome do Interveniente"
                              style={{ height: '26px', fontSize: '11px' }}
                            />
                            <input
                              type="text"
                              value={intv.cpf}
                              onChange={(e) => {
                                setEditouTextoManualmente(false);
                                const novos = [...imoveisGarantia];
                                novos[idxG].intervenientes[idxI].cpf = mascaraDocumento(e.target.value);
                                setImoveisGarantia(novos);
                              }}
                              placeholder="CPF Interveniente"
                              style={{ height: '26px', fontSize: '11px' }}
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
                              style={{ height: '26px', fontSize: '11px' }}
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
                              style={{ width: 'auto', padding: '2px 6px', fontSize: '10px', background: '#fee2e2', color: '#b91c1c', border: 'none', borderRadius: '4px' }}
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

            {/* Campos de Margem Livre, Avalista, Assessoria e Contas (Exclusivos do Modelo Inv/Custeio) */}
            {modeloAtivo === 'INV_CUSTEIO' && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(145px, 1fr))', gap: '8px', marginTop: '8px' }}>
                {temGarantiaRealInv === 'SIM' && (
                  <>
                    <div>
                      <label style={{ fontSize: '10.5px', fontWeight: 'bold', color: '#475569' }}>Saldo Devedor em Ser (R$)</label>
                      <input
                        type="text"
                        value={saldoDevedorEmSer}
                        onChange={(e) => {
                          setEditouTextoManualmente(false);
                          setSaldoDevedorEmSer(mascaraMoedaInput(e.target.value));
                        }}
                        style={{ height: '28px', fontSize: '11.5px' }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '10.5px', fontWeight: 'bold', color: '#475569' }}>Garantia Comprometida (R$)</label>
                      <input
                        type="text"
                        value={garantiaComprometida}
                        onChange={(e) => {
                          setEditouTextoManualmente(false);
                          setGarantiaComprometida(mascaraMoedaInput(e.target.value));
                        }}
                        style={{ height: '28px', fontSize: '11.5px' }}
                      />
                    </div>
                  </>
                )}

                <div>
                  <label style={{ fontSize: '10.5px', fontWeight: 'bold', color: '#475569' }}>Garantia Fidejussória?</label>
                  <select
                    value={temFidejussoria}
                    onChange={(e) => {
                      setEditouTextoManualmente(false);
                      setTemFidejussoria(e.target.value as 'NÃO' | 'SIM');
                    }}
                    style={{ height: '28px', fontSize: '11.5px' }}
                  >
                    <option value="NÃO">NÃO</option>
                    <option value="SIM">SIM (Aval / Fiança)</option>
                  </select>
                </div>

                {temFidejussoria === 'SIM' && (
                  <>
                    <div>
                      <label style={{ fontSize: '10.5px', fontWeight: 'bold', color: '#475569' }}>Nome do Avalista</label>
                      <input
                        type="text"
                        value={nomeAvalista}
                        onChange={(e) => {
                          setEditouTextoManualmente(false);
                          setNomeAvalista(e.target.value);
                        }}
                        style={{ height: '28px', fontSize: '11.5px' }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '10.5px', fontWeight: 'bold', color: '#475569' }}>CPF do Avalista</label>
                      <input
                        type="text"
                        value={cpfAvalista}
                        onChange={(e) => {
                          setEditouTextoManualmente(false);
                          setCpfAvalista(mascaraDocumento(e.target.value));
                        }}
                        style={{ height: '28px', fontSize: '11.5px' }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '10.5px', fontWeight: 'bold', color: '#475569' }}>Renda Anual Aval (R$)</label>
                      <input
                        type="text"
                        value={rendaAnualAvalista}
                        onChange={(e) => {
                          setEditouTextoManualmente(false);
                          setRendaAnualAvalista(mascaraMoedaInput(e.target.value));
                        }}
                        style={{ height: '28px', fontSize: '11.5px' }}
                      />
                    </div>
                  </>
                )}

                <div>
                  <label style={{ fontSize: '10.5px', fontWeight: 'bold', color: '#475569' }}>Valor Assessoria (R$)</label>
                  <input
                    type="text"
                    value={valorAssessoria}
                    onChange={(e) => {
                      setEditouTextoManualmente(false);
                      setValorAssessoria(mascaraMoedaInput(e.target.value));
                    }}
                    style={{ height: '28px', fontSize: '11.5px' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '10.5px', fontWeight: 'bold', color: '#475569' }}>Assessoria Rec. Próprio?</label>
                  <select
                    value={assessoriaPropria}
                    onChange={(e) => {
                      setEditouTextoManualmente(false);
                      setAssessoriaPropria(e.target.value as 'NÃO' | 'SIM');
                    }}
                    style={{ height: '28px', fontSize: '11.5px' }}
                  >
                    <option value="NÃO">NÃO (Financiada)</option>
                    <option value="SIM">SIM (Recursos Próprios)</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '10.5px', fontWeight: 'bold', color: '#475569' }}>Conta Desembolso</label>
                  <input
                    type="text"
                    value={contaDesembolso}
                    onChange={(e) => {
                      setEditouTextoManualmente(false);
                      setContaDesembolso(e.target.value);
                    }}
                    placeholder="Ex: 25841-2"
                    style={{ height: '28px', fontSize: '11.5px' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '10.5px', fontWeight: 'bold', color: '#475569' }}>Fundo Liquidez (5%)?</label>
                  <select
                    value={temFundoLiquidez}
                    onChange={(e) => {
                      setEditouTextoManualmente(false);
                      setTemFundoLiquidez(e.target.value as 'NÃO' | 'SIM');
                    }}
                    style={{ height: '28px', fontSize: '11.5px' }}
                  >
                    <option value="NÃO">NÃO</option>
                    <option value="SIM">SIM (R$ {valorFundoLiquidez})</option>
                  </select>
                </div>

                {temFundoLiquidez === 'SIM' && (
                  <div>
                    <label style={{ fontSize: '10.5px', fontWeight: 'bold', color: '#475569' }}>Nº Conta-Reserva</label>
                    <input
                      type="text"
                      value={contaReservaFundo}
                      onChange={(e) => {
                        setEditouTextoManualmente(false);
                        setContaReservaFundo(e.target.value);
                      }}
                      placeholder="Conta Fundo"
                      style={{ height: '28px', fontSize: '11.5px' }}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* BLOCO DE IDs AMBIENTAIS / GED / PENDÊNCIA 2.2 E ASSINATURAS */}
        <div style={{ borderTop: '1px dashed #cbd5e1', paddingTop: '10px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '10px' }}>
          {modeloAtivo === 'PRONAF_A' && (
            <>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#8B1530' }}>ID da DCAA (#)</label>
                <input
                  type="text"
                  value={idDcaa}
                  onChange={(e) => {
                    setEditouTextoManualmente(false);
                    setIdDcaa(e.target.value);
                  }}
                  placeholder="Ex: 751883872"
                  style={{ height: '28px', fontSize: '11.5px' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#8B1530' }}>ID do Parecer SEMA (#)</label>
                <input
                  type="text"
                  value={idSema}
                  onChange={(e) => {
                    setEditouTextoManualmente(false);
                    setIdSema(e.target.value);
                  }}
                  placeholder="Ex: 752090578"
                  style={{ height: '28px', fontSize: '11.5px' }}
                />
              </div>
            </>
          )}

          {modeloAtivo === 'LIMITE_LCG' && (
            <>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#8B1530' }}>ID Endereço Fora (#)</label>
                <input
                  type="text"
                  value={idEnderecoFora}
                  onChange={(e) => {
                    setEditouTextoManualmente(false);
                    setIdEnderecoFora(e.target.value);
                  }}
                  placeholder="ID GED Endereço"
                  style={{ height: '28px', fontSize: '11.5px' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#8B1530' }}>ID Renda Extra Rural (#)</label>
                <input
                  type="text"
                  value={idRendaExtra}
                  onChange={(e) => {
                    setEditouTextoManualmente(false);
                    setIdRendaExtra(e.target.value);
                  }}
                  placeholder="ID GED Renda"
                  style={{ height: '28px', fontSize: '11.5px' }}
                />
              </div>
            </>
          )}

          {modeloAtivo !== 'LIMITE_LCG' && (
            <>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#475569' }}>
                  Pendência Leve (Norma 1038-05-02)?
                </label>
                <select
                  value={possuiRestricaoLeve22}
                  onChange={(e) => {
                    setEditouTextoManualmente(false);
                    setPossuiRestricaoLeve22(e.target.value as 'NAO' | 'SIM');
                  }}
                  style={{ height: '28px', fontSize: '11.5px' }}
                >
                  <option value="NAO">NÃO (Sem restrições)</option>
                  <option value="SIM">SIM (Incluir Item 2.2)</option>
                </select>
              </div>

              {possuiRestricaoLeve22 === 'SIM' && (
                <>
                  <div>
                    <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#b45309' }}>Descrição Pendência (#)</label>
                    <input
                      type="text"
                      value={descRestricao22}
                      onChange={(e) => {
                        setEditouTextoManualmente(false);
                        setDescRestricao22(e.target.value);
                      }}
                      placeholder="Ex: PEFIN comercial (CAEMA)"
                      style={{ height: '28px', fontSize: '11.5px' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#b45309' }}>Valor Pendência (R$ #)</label>
                    <input
                      type="text"
                      value={valorRestricao22}
                      onChange={(e) => {
                        setEditouTextoManualmente(false);
                        setValorRestricao22(mascaraMoedaInput(e.target.value));
                      }}
                      placeholder="127,82"
                      style={{ height: '28px', fontSize: '11.5px' }}
                    />
                  </div>
                </>
              )}
            </>
          )}

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#475569' }}>Gerente Relacionamento (#)</label>
              <label style={{ fontSize: '10px', cursor: 'pointer', margin: 0 }}>
                <input
                  type="checkbox"
                  checked={gerenteRelEE}
                  onChange={(e) => {
                    setEditouTextoManualmente(false);
                    setGerenteRelEE(e.target.checked);
                  }}
                  style={{ width: 'auto', margin: '0 3px 0 0' }}
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
              style={{ height: '28px', fontSize: '11.5px' }}
            />
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#475569' }}>Gerente de Agência (#)</label>
              <label style={{ fontSize: '10px', cursor: 'pointer', margin: 0 }}>
                <input
                  type="checkbox"
                  checked={gerenteAgEE}
                  onChange={(e) => {
                    setEditouTextoManualmente(false);
                    setGerenteAgEE(e.target.checked);
                  }}
                  style={{ width: 'auto', margin: '0 3px 0 0' }}
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
              style={{ height: '28px', fontSize: '11.5px' }}
            />
          </div>
        </div>
      </div>

      {/* CAIXA DO PARECER GERADO (100% EDITÁVEL) */}
      <div
        style={{
          background: '#ffffff',
          border: '1px solid #cbd5e1',
          borderRadius: '8px',
          padding: '12px 16px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
          <strong style={{ fontSize: '12px', color: '#1e293b' }}>
            📝 TEXTO DO PARECER GERADO (Você também pode digitar ou ajustar qualquer palavra diretamente abaixo):
          </strong>
          {editouTextoManualmente && (
            <span style={{ fontSize: '10.5px', color: '#b45309', fontWeight: 'bold' }}>
              ✍️ Texto editado manualmente (Clique em &ldquo;🔄 Atualizar Texto pelos Campos&rdquo; acima se quiser regerar)
            </span>
          )}
        </div>
        <textarea
          value={textoParecerFinal}
          onChange={(e) => {
            setEditouTextoManualmente(true);
            setTextoParecerFinal(e.target.value);
          }}
          rows={20}
          style={{
            width: '100%',
            padding: '14px',
            fontSize: '12.5px',
            lineHeight: 1.55,
            fontFamily: 'monospace',
            border: '1px solid #cbd5e1',
            borderRadius: '6px',
            background: '#fcfcfd',
            color: '#0f172a',
          }}
        />
      </div>
    </div>
  );
}