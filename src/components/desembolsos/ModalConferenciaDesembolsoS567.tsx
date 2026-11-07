'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  OperacaoBaseDesembolso,
  RegistroContratacao,
} from '@/types/painel';
import {
  parseMoeda,
  formatarMoedaBD,
  aplicarMascaraMoedaInput,
  aplicarMascaraCPF,
} from '@/lib/utils';
import { obterDadosExtraidosParaParecer } from '@/lib/auditorInteligentePdfPasta';

export const STORAGE_KEY_CONFERENCIAS_S567_POR_OP =
  'bnb_v2_conferencias_desembolso_s567_map';

interface ModalConferenciaDesembolsoS567Props {
  aberto: boolean;
  onFechar: () => void;
  operacoesBase: OperacaoBaseDesembolso[];
  contratacoes: RegistroContratacao[];
  operacaoInicial?: {
    cliente: string;
    cpf?: string;
    op?: string;
    valorContrato?: string;
    porte?: string;
  } | null;
  onRegistrarEventoNoHistorico?: (dadosEvento: {
    cliente: string;
    op: string;
    valor: string;
    parcela: string;
    situacao: string;
    obs: string;
  }) => void;
}

interface ItemFinanciadoConf {
  nome: string;
  qtd: string;
  unidade: string;
}

interface DesembolsoManualParcela {
  tipo: 'integral' | 'parcial';
  valores: number[]; // Valor liberado por item [i] nesta parcela
}

interface EstadoConferenciaFinanceira {
  etapaAtual: 1 | 2 | 3;
  nome: string;
  cpf: string;
  numOp: string;
  valorPropostaGabarito: number;
  qtdItens: number;
  qtdParcelas: number;
  meses: string[];
  itens: ItemFinanciadoConf[];
  orcamento: number[][]; // [itemIdx][parcelaIdx]
  comprovacoes: number[][][]; // [itemIdx][parcelaIdx][nfIdx]
  desembolsoManual: Record<number, DesembolsoManualParcela>;
}

interface CelulaResultadoCalculado {
  orcadoAtual: number;
  pendenteAnterior: number;
  necessidadeAcumulada: number;
  saldoNfsAnterior: number;
  totalNfsDisponivelAqui: number;
  autorizadoNestaParcela: number;
  desembolsadoNestaParcela: number;
  sobraUtilMes: number;
  isManual: boolean;
}

function identificarUnidadeItem(descricao: string): string {
  const desc = (descricao || '').toUpperCase();
  if (
    /MATRIZ|REPRODUTOR|BEZERRO|BEZERRA|GARROTE|NOVILHA|TOURO|VACA|ANIMAL|ANIMAIS|BOVIN|OVIN|CAPRIN/.test(
      desc
    )
  ) {
    return 'UA';
  }
  if (/PASTAGEM|CAPINEIRA|HECTARE|\bHA\b/.test(desc)) {
    return 'HA';
  }
  return 'UND';
}

function fmtBRL(valor: number): string {
  return (Number(valor) || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

function obterChecklistPorTipoSolicitacao(
  tipoDesemb: string,
  exigeReciboAss: boolean
): string[] {
  const docs: string[] = [];
  if (tipoDesemb === 'Des Rural Aquisição Isolada') {
    docs.push(
      'Laudo de Acompanhamento com Orçamento (Atesta que o cliente aplicou os recursos corretamente e os valores batem com o orçamento da proposta).',
      "Declaração de Recebimento dos Animais (Atestar recebimento, conferir: Valor, Descrição, Qtds, referência da NF, Nome/CPF do fornecedor e vínculo com a CCB).",
      "GTA (Guia de Trânsito Animal) — Verificar se pelo menos uma fazenda do contrato consta como 'Estabelecimento'.",
      'NF da aquisição dos animais (Conferir se o valor bate com a consulta na Receita Federal).',
      'Recibo de Pagamento (Se manual, exigir documento de identificação do fornecedor para reconhecimento de assinatura. Se não houver, o desembolso será feito direto ao fornecedor).',
      "Conferência Cruzada (NF x GTA): Verificar Fornecedor, CPF, Itens, Qtds, se consta 'Nota de Saída (1)', destino dos animais, valor e descrição.",
      'Conferência Cruzada (NF x Recibos): Verificar assinaturas, valores, quantidades e fornecedor.',
      'Conferência de Datas: A data da NF, dos Recibos e a emissão da GTA devem ser SEMPRE APÓS a data do contrato.',
      'Verificar compatibilidade de Idades/Fases dos animais nos documentos (NF, GTA, Recibos, Laudo e Declaração).',
      'Documentos de Identificação do Fornecedor presentes.',
      'Validação ITI no Portal do Gov (Se os recibos forem assinados digitalmente).'
    );
  } else if (tipoDesemb === 'Des Rural Animais e Const. Civil') {
    docs.push(
      'Laudo de Acompanhamento com Orçamento (Atesta que o cliente aplicou os recursos corretamente e os valores batem com o orçamento da proposta).',
      'Declaração de Recebimento dos Animais (Conferir Valor, Descrição, Qtds, referência da NF, Nome/CPF do fornecedor e vínculo com a CCB).',
      "GTA (Guia de Trânsito Animal) — Verificar se pelo menos uma fazenda do contrato consta como 'Estabelecimento'.",
      'NF da aquisição dos animais (Conferir na Receita Federal).',
      'Recibo de Pagamento dos Animais (Se manual, exigir doc. de identificação do fornecedor).',
      "Conferência Cruzada (NF x GTA): Verificar Fornecedor, CPF, Itens, Qtds, 'Nota de Saída (1)', destino e descrição.",
      'Conferência de Datas: NF, Recibos e GTA devem ser SEMPRE APÓS a data do contrato.',
      'Verificar compatibilidade de Idades/Fases dos animais nos documentos (NF, GTA, Recibos, Laudo e Declaração).',
      'NF dos demais itens (Obs: Na Construção Civil, caso o fornecedor seja produtor rural sem acesso a NF, aceita-se apenas o Recibo e as demais documentações).',
      "Recibos das NF's para cada item e Documentos de Identificação de cada Fornecedor.",
      'Validação ITI dos recibos no Portal do Gov (Se assinados digitalmente).'
    );
  } else if (tipoDesemb === 'Des Rural Construção Civil') {
    docs.push(
      'Laudo de Acompanhamento com Orçamento (Atesta aplicação dos recursos comparado ao orçamento da proposta).',
      'NF para cada item (Obs: Na Construção Civil, caso o fornecedor seja produtor rural sem acesso a NF, aceita-se apenas o Recibo).',
      'Conferir em cada NF se o valor bate com a consulta na Receita Federal.',
      "Recibos das NF's para cada item (Se não houver, o desembolso será feito diretamente ao fornecedor).",
      'Conferência Cruzada (NF x Recibos): Verificar assinaturas, valores, quantidades e fornecedor.',
      'Conferência de Datas: A data da NF e dos Recibos devem ser SEMPRE APÓS a data do contrato.',
      'Documentos de Identificação de cada Fornecedor para as devidas conferências.',
      'Validação ITI no Portal do Gov (Se os recibos forem assinados digitalmente).'
    );
  } else if (tipoDesemb) {
    docs.push(
      `Documentação padrão para ${tipoDesemb}.`,
      'Laudo de Acompanhamento com Orçamento.',
      'Notas Fiscais e Recibos vinculados emitidos após a data do contrato.'
    );
  }

  if (exigeReciboAss && tipoDesemb) {
    docs.push('Recibo de Pagamento da Assessoria Empresarial e Técnica.');
  }
  return docs;
}

const ESTADO_INICIAL_CONF: EstadoConferenciaFinanceira = {
  etapaAtual: 1,
  nome: '',
  cpf: '',
  numOp: '',
  valorPropostaGabarito: 0,
  qtdItens: 1,
  qtdParcelas: 1,
  meses: ['Parcela 1'],
  itens: [{ nome: 'Item 1', qtd: '1', unidade: 'UND' }],
  orcamento: [[0]],
  comprovacoes: [[[]]],
  desembolsoManual: {},
};

export default function ModalConferenciaDesembolsoS567({
  aberto,
  onFechar,
  operacoesBase,
  contratacoes,
  operacaoInicial,
  onRegistrarEventoNoHistorico,
}: ModalConferenciaDesembolsoS567Props) {
  const [abaSuperior, setAbaSuperior] = useState<'CONFERENCIA_NF' | 'CHECKLIST_S567'>(
    'CONFERENCIA_NF'
  );

  const [dadosConf, setDadosConf] =
    useState<EstadoConferenciaFinanceira>(ESTADO_INICIAL_CONF);
  const [parcelaAtivaIdx, setParcelaAtivaIdx] = useState(0);

  // Submodal de confirmação de desembolso da parcela
  const [modalDesembParcelaIdx, setModalDesembParcelaIdx] = useState<
    number | null
  >(null);
  const [modoParcialAtivo, setModoParcialAtivo] = useState(false);
  const [inputsParciaisStr, setInputsParciaisStr] = useState<string[]>([]);

  // Submodal Relatório Consolidado
  const [modalRelatorioAberto, setModalRelatorioAberto] = useState(false);

  // Submodal S567 Curto (Soma por Parcelas Selecionadas)
  const [modalS567CurtoAberto, setModalS567CurtoAberto] = useState(false);
  const [parcelasMarcadasS567, setParcelasMarcadasS567] = useState<number[]>(
    []
  );
  const [textoS567CurtoGerado, setTextoS567CurtoGerado] = useState('');

  // Estados da Aba 2 (Informações da Operação, CCB, Checklist e Resumo S567 Completo)
  const [dtContrato, setDtContrato] = useState('');
  const [numCcb, setNumCcb] = useState('');
  const [numContrato, setNumContrato] = useState('');
  const [ccDestino, setCcDestino] = useState('');
  const [gedIc, setGedIc] = useState('');
  const [gedAditivo, setGedAditivo] = useState('');
  const [gedOp, setGedOp] = useState('');
  const [idCompFin, setIdCompFin] = useState('');
  const [numParcelaRealDesemb, setNumParcelaRealDesemb] = useState('1');
  const [assessoriaNoContrato, setAssessoriaNoContrato] = useState<'NÃO' | 'SIM'>('NÃO');
  const [tipoSolicitacaoDesemb, setTipoSolicitacaoDesemb] = useState(
    'Des Rural Animais e Const. Civil'
  );
  const [fundoLiquidezStatus, setFundoLiquidezStatus] = useState('SIM');
  const [visitaGerencialStatus, setVisitaGerencialStatus] = useState('SIM');
  const [checksMarcados, setChecksMarcados] = useState<Record<string, boolean>>(
    {}
  );

  // Quando abre o modal com uma operação selecionada na tabela de Desembolsos, carrega automaticamente os dados e tenta puxar os itens do PDF do Projeto!
  useEffect(() => {
    if (!aberto) return;
    if (operacaoInicial && operacaoInicial.cliente) {
      carregarDadosClienteOuOp(
        operacaoInicial.cliente,
        operacaoInicial.cpf || '',
        operacaoInicial.op || '',
        operacaoInicial.valorContrato || ''
      );
    }
  }, [aberto, operacaoInicial]);

  const carregarDadosClienteOuOp = (
    nomeCli: string,
    cpfCli: string,
    opNum: string,
    valorStr: string
  ) => {
    const opEncontrada = operacoesBase.find(
      (o) =>
        o.cliente.toUpperCase().trim() === nomeCli.toUpperCase().trim() &&
        (!opNum || o.op === opNum)
    );
    const contrEncontrada = contratacoes.find(
      (c) => c.cliente.toUpperCase().trim() === nomeCli.toUpperCase().trim()
    );

    const cpfFinal =
      cpfCli || opEncontrada?.cpf || contrEncontrada?.cpf || '';
    const opFinal = opNum || opEncontrada?.op || '';
    const valGabarito = parseMoeda(
      valorStr || opEncontrada?.valor || contrEncontrada?.valor || '0'
    );

    // 1. Verifica primeiro se já existe uma Conferência de NFs/S567 salva na memória para esta Operação/Cliente!
    const chaveOpCache = `${nomeCli.toUpperCase().trim()}__${(
      opFinal || 'SEM_OP'
    )
      .toUpperCase()
      .trim()}`;
    if (typeof window !== 'undefined') {
      try {
        const rawMap = window.localStorage.getItem(
          STORAGE_KEY_CONFERENCIAS_S567_POR_OP
        );
        if (rawMap) {
          const mapaSalvo = JSON.parse(rawMap);
          const salvo =
            mapaSalvo[chaveOpCache] ||
            mapaSalvo[`${nomeCli.toUpperCase().trim()}__SEM_OP`];
          if (salvo && salvo.dadosConf && salvo.dadosConf.qtdItens > 0) {
            setDadosConf({
              ...salvo.dadosConf,
              nome: nomeCli.toUpperCase(),
              cpf: cpfFinal || salvo.dadosConf.cpf,
              numOp: opFinal || salvo.dadosConf.numOp,
              valorPropostaGabarito:
                valGabarito || salvo.dadosConf.valorPropostaGabarito,
            });
            if (salvo.metaS567) {
              setDtContrato(salvo.metaS567.dtContrato || '');
              setNumCcb(salvo.metaS567.numCcb || '');
              setNumContrato(salvo.metaS567.numContrato || '');
              setCcDestino(salvo.metaS567.ccDestino || '');
              setGedIc(salvo.metaS567.gedIc || '');
              setGedAditivo(salvo.metaS567.gedAditivo || '');
              setGedOp(salvo.metaS567.gedOp || '');
              setIdCompFin(salvo.metaS567.idCompFin || '');
              setNumParcelaRealDesemb(
                salvo.metaS567.numParcelaRealDesemb || '1'
              );
              setAssessoriaNoContrato(
                salvo.metaS567.assessoriaNoContrato || 'NÃO'
              );
              setTipoSolicitacaoDesemb(
                salvo.metaS567.tipoSolicitacaoDesemb ||
                  'Des Rural Animais e Const. Civil'
              );
              setFundoLiquidezStatus(
                salvo.metaS567.fundoLiquidezStatus || 'SIM'
              );
              setVisitaGerencialStatus(
                salvo.metaS567.visitaGerencialStatus || 'SIM'
              );
              setChecksMarcados(salvo.metaS567.checksMarcados || {});
            }
            return;
          }
        }
      } catch {
        // Ignora erro de parse
      }
    }

    // Verifica se temos os itens de inversão extraídos do PDF do Projeto no cache do Auditor!
    const cachePdf = obterDadosExtraidosParaParecer(cpfFinal || nomeCli);
    if (cachePdf && cachePdf.itensInversao && cachePdf.itensInversao.length > 0) {
      const qtdIt = cachePdf.itensInversao.length;
      const itensExtraidos: ItemFinanciadoConf[] = cachePdf.itensInversao.map(
        (it) => ({
          nome: it.discriminacao,
          qtd: it.quantidade,
          unidade: it.unidade || identificarUnidadeItem(it.discriminacao),
        })
      );
      const orcInicial = cachePdf.itensInversao.map((it) => [
        parseMoeda(it.valorFinanciado),
      ]);
      const compInicial = Array.from({ length: qtdIt }, () => [[]]);

      setDadosConf({
        etapaAtual: 1,
        nome: nomeCli.toUpperCase(),
        cpf: cpfFinal,
        numOp: opFinal,
        valorPropostaGabarito: valGabarito || parseMoeda(cachePdf.valorTotalFinanciado),
        qtdItens: qtdIt,
        qtdParcelas: 1,
        meses: ['Parcela 1'],
        itens: itensExtraidos,
        orcamento: orcInicial,
        comprovacoes: compInicial,
        desembolsoManual: {},
      });
      if (cachePdf.contaCorrenteExtraida) {
        setCcDestino(cachePdf.contaCorrenteExtraida);
      }
      return;
    }

    setDadosConf((prev) => ({
      ...prev,
      etapaAtual: 1,
      nome: nomeCli.toUpperCase(),
      cpf: cpfFinal,
      numOp: opFinal,
      valorPropostaGabarito: valGabarito,
    }));
  };

  // Auto-Save instantâneo por Cliente + Nº da Operação
  useEffect(() => {
    if (!aberto || !dadosConf.nome.trim() || typeof window === 'undefined') {
      return;
    }
    const chaveOpCache = `${dadosConf.nome.toUpperCase().trim()}__${(
      dadosConf.numOp || 'SEM_OP'
    )
      .toUpperCase()
      .trim()}`;
    try {
      const rawMap = window.localStorage.getItem(
        STORAGE_KEY_CONFERENCIAS_S567_POR_OP
      );
      const mapaSalvo = rawMap ? JSON.parse(rawMap) : {};
      mapaSalvo[chaveOpCache] = {
        dadosConf,
        metaS567: {
          dtContrato,
          numCcb,
          numContrato,
          ccDestino,
          gedIc,
          gedAditivo,
          gedOp,
          idCompFin,
          numParcelaRealDesemb,
          assessoriaNoContrato,
          tipoSolicitacaoDesemb,
          fundoLiquidezStatus,
          visitaGerencialStatus,
          checksMarcados,
        },
        atualizadoEm: new Date().toISOString(),
      };
      window.localStorage.setItem(
        STORAGE_KEY_CONFERENCIAS_S567_POR_OP,
        JSON.stringify(mapaSalvo)
      );
    } catch {
      // Ignora erro de quota
    }
  }, [
    aberto,
    dadosConf,
    dtContrato,
    numCcb,
    numContrato,
    ccDestino,
    gedIc,
    gedAditivo,
    gedOp,
    idCompFin,
    numParcelaRealDesemb,
    assessoriaNoContrato,
    tipoSolicitacaoDesemb,
    fundoLiquidezStatus,
    visitaGerencialStatus,
    checksMarcados,
  ]);

  // Redimensiona matrizes ao mudar Qtd de Itens ou Qtd de Parcelas na Etapa 1
  const ajustarDimensoesEstrutura = (
    novaQtdItens: number,
    novaQtdParcelas: number
  ) => {
    const qI = Math.max(1, Math.min(40, novaQtdItens || 1));
    const qP = Math.max(1, Math.min(24, novaQtdParcelas || 1));

    const novosMeses = Array.from(
      { length: qP },
      (_, p) => dadosConf.meses[p] || `Parc. ${p + 1}`
    );
    const novosItens: ItemFinanciadoConf[] = Array.from(
      { length: qI },
      (_, i) =>
        dadosConf.itens[i] || {
          nome: `Item ${i + 1}`,
          qtd: '1',
          unidade: 'UND',
        }
    );
    const novoOrc: number[][] = Array.from({ length: qI }, (_, i) =>
      Array.from(
        { length: qP },
        (__, p) => dadosConf.orcamento[i]?.[p] ?? 0
      )
    );
    const novasComp: number[][][] = Array.from({ length: qI }, (_, i) =>
      Array.from({ length: qP }, (__, p) =>
        dadosConf.comprovacoes[i]?.[p] ? [...dadosConf.comprovacoes[i][p]] : []
      )
    );

    setDadosConf((prev) => ({
      ...prev,
      qtdItens: qI,
      qtdParcelas: qP,
      meses: novosMeses,
      itens: novosItens,
      orcamento: novoOrc,
      comprovacoes: novasComp,
    }));
  };

  // =========================================================================
  // MOTOR MATEMÁTICO DE CÁLCULO CUMULATIVO DE PARCELAS E NFs (IDÊNTICO AO V98)
  // =========================================================================
  const matrizResultados = useMemo(() => {
    const res: CelulaResultadoCalculado[][] = Array.from(
      { length: dadosConf.qtdItens },
      () => new Array(dadosConf.qtdParcelas).fill(null)
    );

    for (let i = 0; i < dadosConf.qtdItens; i++) {
      const linhaOrc = dadosConf.orcamento[i] || [];
      const orcamentoTotalItem = linhaOrc.reduce((a, b) => a + (b || 0), 0);
      let pagoVirtual = 0;
      let sobraUtilAnterior = 0;

      for (let x = 0; x < dadosConf.qtdParcelas; x++) {
        const orcadoAtual = linhaOrc[x] || 0;
        const metaAcumulada = linhaOrc
          .slice(0, x + 1)
          .reduce((a, b) => a + (b || 0), 0);
        const pendenteAnterior = metaAcumulada - orcadoAtual - pagoVirtual;
        const necessidadeAcumulada = pendenteAnterior + orcadoAtual;
        const nfsLista = dadosConf.comprovacoes[i]?.[x] || [];
        const nfsNoMes = nfsLista.reduce(
          (a, b) => (Number(a) || 0) + (Number(b) || 0),
          0
        );
        const totalDisponivel = sobraUtilAnterior + nfsNoMes;
        let autorizadoNestaParcela = 0;

        if (
          necessidadeAcumulada > 0 &&
          totalDisponivel >= necessidadeAcumulada - 0.009
        ) {
          autorizadoNestaParcela = necessidadeAcumulada;
        }

        const manual = dadosConf.desembolsoManual[x];
        let desembolsadoNestaParcela = 0;
        let sobraReal = 0;

        if (manual) {
          desembolsadoNestaParcela = manual.valores[i] || 0;
          pagoVirtual += desembolsadoNestaParcela;
          sobraReal = totalDisponivel - desembolsadoNestaParcela;
        } else {
          pagoVirtual += autorizadoNestaParcela;
          sobraReal = totalDisponivel - autorizadoNestaParcela;
        }

        const sobraUtilMes = Math.max(
          0,
          Math.min(sobraReal, orcamentoTotalItem - metaAcumulada)
        );

        res[i][x] = {
          orcadoAtual,
          pendenteAnterior,
          necessidadeAcumulada,
          saldoNfsAnterior: sobraUtilAnterior,
          totalNfsDisponivelAqui: totalDisponivel,
          autorizadoNestaParcela,
          desembolsadoNestaParcela,
          sobraUtilMes,
          isManual: Boolean(manual),
        };
        sobraUtilAnterior = sobraUtilMes;
      }
    }
    return res;
  }, [dadosConf]);

  // Totais da Parcela Ativa e Globais
  const resumoCalculadoTela = useMemo(() => {
    const pIdx = Math.min(
      parcelaAtivaIdx,
      Math.max(0, dadosConf.qtdParcelas - 1)
    );
    let totalOrcamentoGlobal = 0;
    const restsPorItem: number[] = [];

    for (let i = 0; i < dadosConf.qtdItens; i++) {
      const totalOrcadoItem = (dadosConf.orcamento[i] || []).reduce(
        (a, b) => a + (b || 0),
        0
      );
      totalOrcamentoGlobal += totalOrcadoItem;

      let comprovadoAteAqui = 0;
      for (let x = 0; x <= pIdx; x++) {
        const cel = matrizResultados[i]?.[x];
        if (!cel) continue;
        if (cel.isManual) {
          comprovadoAteAqui += cel.desembolsadoNestaParcela;
        } else {
          comprovadoAteAqui += (dadosConf.comprovacoes[i]?.[x] || []).reduce(
            (a, b) => a + (Number(b) || 0),
            0
          );
        }
      }
      restsPorItem.push(Math.max(0, totalOrcadoItem - comprovadoAteAqui));
    }

    let totPendenteEstaParcela = 0;
    let totGeralDesembolsado = 0;
    let totAutorizadoEstaParcela = 0;
    let totGeralAutorizadoAteAqui = 0;

    for (let i = 0; i < dadosConf.qtdItens; i++) {
      const r = matrizResultados[i]?.[pIdx];
      for (let x = 0; x < dadosConf.qtdParcelas; x++) {
        const rG = matrizResultados[i]?.[x];
        if (!rG) continue;
        totGeralDesembolsado += rG.desembolsadoNestaParcela;
        if (x <= pIdx && !rG.isManual) {
          totGeralAutorizadoAteAqui += rG.autorizadoNestaParcela;
        }
      }
      if (r) {
        totAutorizadoEstaParcela += r.autorizadoNestaParcela;
        const faltaPagar =
          r.necessidadeAcumulada -
          (r.isManual ? r.desembolsadoNestaParcela : r.autorizadoNestaParcela);
        totPendenteEstaParcela += Math.max(0, faltaPagar);
      }
    }

    const totGeralPendente = Math.max(
      0,
      totalOrcamentoGlobal - totGeralDesembolsado
    );
    const todosItensComprovados =
      dadosConf.qtdItens > 0 && restsPorItem.every((v) => v <= 0.01);

    return {
      totalOrcamentoGlobal,
      restsPorItem,
      totPendenteEstaParcela,
      totGeralDesembolsado,
      totAutorizadoEstaParcela,
      totGeralAutorizadoAteAqui,
      totGeralPendente,
      todosItensComprovados,
    };
  }, [dadosConf, matrizResultados, parcelaAtivaIdx]);

  // Gerador do Resumo S567 Completo (Aba 2)
  const textoResumoS567Completo = useMemo(() => {
    const formatBr = (v: number) => formatarMoedaBD(v);
    let descItens = '*ITENS FINANCIADOS:\n\n';
    if (dadosConf.itens.length > 0) {
      const arr = dadosConf.itens.map(
        (it) =>
          `${(it.nome || 'ITEM').toUpperCase()} (${it.qtd || '1'} ${
            it.unidade || identificarUnidadeItem(it.nome)
          })`
      );
      const lines: string[] = [];
      for (let i = 0; i < arr.length; i += 3) {
        lines.push('| ' + arr.slice(i, i + 3).join(' | ') + ' |');
      }
      descItens += lines.join('\n');
    } else {
      descItens += 'Nenhum item cadastrado.';
    }

    let resumo = `SOLICITAÇÃO S567 - ${
      tipoSolicitacaoDesemb.toUpperCase() || 'DESEMBOLSO RURAL'
    }\n------------------------------------------\n${descItens}\n\n*CONTA DESEMBOLSO: ${
      ccDestino || 'Não informada'
    }\n*ID DOSSIÊS: IC(${gedIc || '-'}) | OP(${gedOp || '-'})${
      gedAditivo ? ` | ADITIVO(${gedAditivo})` : ''
    }\n*ID COMP. FINANCEIRA: ${
      idCompFin || '-'
    }\n\n*INFO COMPLEMENTARES:\n\n`;

    const parcelasLiberadas: number[] = [];
    let detalhesText = '';
    let tudoOk = true;

    for (let p = 0; p < dadosConf.qtdParcelas; p++) {
      let sumP = 0;
      for (let i = 0; i < dadosConf.qtdItens; i++) {
        sumP += dadosConf.orcamento[i]?.[p] || 0;
      }
      if (sumP > 0 && dadosConf.desembolsoManual[p]) {
        parcelasLiberadas.push(p + 1);
      }
    }

    for (let i = 0; i < dadosConf.qtdItens; i++) {
      const nomeItem = (dadosConf.itens[i]?.nome || `Item ${i + 1}`).toUpperCase();
      detalhesText += `${nomeItem}\n`;
      let temComprovacao = false;
      let historicoText = '';
      let totalComprovadoItem = 0;

      for (let p = 0; p < dadosConf.qtdParcelas; p++) {
        const comps = (dadosConf.comprovacoes[i]?.[p] || []).filter(
          (v) => v > 0
        );
        const manualVal = dadosConf.desembolsoManual[p]?.valores?.[i] || 0;

        if (comps.length > 0) {
          temComprovacao = true;
          const sumC = comps.reduce((a, b) => a + b, 0);
          totalComprovadoItem += sumC;
          historicoText += `  ${p + 1}ª Parcela: ${comps
            .map((c) => 'R$ ' + formatBr(c))
            .join(' + ')} = R$ ${formatBr(sumC)}\n`;
        } else if (manualVal > 0) {
          temComprovacao = true;
          totalComprovadoItem += manualVal;
          historicoText += `  ${p + 1}ª Parcela: R$ ${formatBr(
            manualVal
          )} (Liberado) = R$ ${formatBr(manualVal)}\n`;
        }
      }

      if (!temComprovacao) {
        detalhesText += `- Nenhuma comprovação identificada até o momento.\n`;
      } else {
        detalhesText += `- Histórico de Comprovações Inseridas:\n${historicoText}`;
      }

      const globalBudget = (dadosConf.orcamento[i] || []).reduce(
        (a, b) => a + (b || 0),
        0
      );
      const falta = Math.max(0, globalBudget - totalComprovadoItem);
      if (falta > 0.01) tudoOk = false;

      detalhesText += `- Total Comprovado (NFs): R$ ${formatBr(
        totalComprovadoItem
      )}  |  Falta p/ concluir item: R$ ${formatBr(falta)}\n\n`;
    }

    resumo += `- BENEFICIÁRIO: ${dadosConf.nome || '-'} (CPF: ${
      dadosConf.cpf || '-'
    })\n`;
    resumo += `- OPERAÇÃO: ${dadosConf.numOp || '-'} | CCB: ${
      numCcb || '-'
    }\n`;
    resumo += `- TOTAL ORÇADO: R$ ${formatBr(
      resumoCalculadoTela.totalOrcamentoGlobal
    )}\n`;
    resumo += `- TOTAL LIBERADO ATÉ O MOMENTO: R$ ${formatBr(
      resumoCalculadoTela.totGeralDesembolsado
    )}\n`;
    resumo += `- SALDO PENDENTE: R$ ${formatBr(
      resumoCalculadoTela.totGeralPendente
    )}\n`;

    const strParcelas =
      parcelasLiberadas.length > 0 ? parcelasLiberadas.join(', ') : 'Nenhuma';
    resumo += `- PARCELAS JÁ LIBERADAS: "${strParcelas} referente(s) ao ${
      numParcelaRealDesemb || '1'
    }º desembolso."\n\n*DETALHES DA(S) COMPROVAÇÃO(ÕES):\n\n${detalhesText}`;

    if (tudoOk && resumoCalculadoTela.totalOrcamentoGlobal > 0) {
      resumo += `>> OBS: Todas as comprovações foram inseridas e validadas no módulo de conferência.`;
    } else {
      resumo += `>> OBS: Existem pendências de comprovações para os itens ou a conferência está em andamento.`;
    }

    return resumo;
  }, [
    dadosConf,
    resumoCalculadoTela,
    tipoSolicitacaoDesemb,
    ccDestino,
    gedIc,
    gedOp,
    gedAditivo,
    idCompFin,
    numParcelaRealDesemb,
    numCcb,
  ]);

  // Salvar Análise Individual em JSON
  const salvarAnaliseJson = async () => {
    if (!dadosConf.nome.trim()) {
      alert('Informe o nome do cliente antes de salvar a análise.');
      return;
    }
    const partes = dadosConf.nome.trim().split(/\s+/);
    const nomeArquivo = `DESEMBOLSO - ${partes.slice(0, 2).join(' ')}.json`;
    const pacote = {
      ...dadosConf,
      metaS567: {
        dtContrato,
        numCcb,
        numContrato,
        ccDestino,
        gedIc,
        gedAditivo,
        gedOp,
        idCompFin,
        numParcelaRealDesemb,
        assessoriaNoContrato,
        tipoSolicitacaoDesemb,
        fundoLiquidezStatus,
        visitaGerencialStatus,
        checksMarcados,
      },
    };
    const dataStr = JSON.stringify(pacote, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nomeArquivo;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importarAnaliseJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const lido = JSON.parse(String(ev.target?.result));
        if (lido && lido.qtdItens && lido.orcamento) {
          setDadosConf({
            etapaAtual: 3,
            nome: lido.nome || '',
            cpf: lido.cpf || '',
            numOp: lido.numOp || '',
            valorPropostaGabarito: lido.valorPropostaGabarito || 0,
            qtdItens: lido.qtdItens,
            qtdParcelas: lido.qtdParcelas,
            meses: lido.meses || ['Parcela 1'],
            itens: lido.itens || [],
            orcamento: lido.orcamento || [],
            comprovacoes: lido.comprovacoes || [],
            desembolsoManual: lido.desembolsoManual || {},
          });
          if (lido.metaS567) {
            setDtContrato(lido.metaS567.dtContrato || '');
            setNumCcb(lido.metaS567.numCcb || '');
            setNumContrato(lido.metaS567.numContrato || '');
            setCcDestino(lido.metaS567.ccDestino || '');
            setGedIc(lido.metaS567.gedIc || '');
            setGedAditivo(lido.metaS567.gedAditivo || '');
            setGedOp(lido.metaS567.gedOp || '');
            setIdCompFin(lido.metaS567.idCompFin || '');
            setNumParcelaRealDesemb(
              lido.metaS567.numParcelaRealDesemb || '1'
            );
            setAssessoriaNoContrato(
              lido.metaS567.assessoriaNoContrato || 'NÃO'
            );
            setTipoSolicitacaoDesemb(
              lido.metaS567.tipoSolicitacaoDesemb ||
                'Des Rural Animais e Const. Civil'
            );
            setChecksMarcados(lido.metaS567.checksMarcados || {});
          }
          setParcelaAtivaIdx(0);
          alert('✅ Análise de Conferência de Desembolso carregada com sucesso!');
        }
      } catch {
        alert('❌ Arquivo JSON de conferência inválido.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Ações de Desembolso na Parcela
  const abrirSubmodalDesembolsarParcela = (pIndex: number) => {
    let totalAut = 0;
    const parciaisIniciais: string[] = [];
    for (let i = 0; i < dadosConf.qtdItens; i++) {
      const aut = matrizResultados[i]?.[pIndex]?.autorizadoNestaParcela || 0;
      totalAut += aut;
      parciaisIniciais.push(formatarMoedaBD(aut));
    }
    const jaDesembolsada = Boolean(dadosConf.desembolsoManual[pIndex]);
    if (totalAut <= 0 && !jaDesembolsada) {
      alert(
        '⚠️ Nenhum item está APTO nesta parcela. Insira os valores das Notas Fiscais para comprovar os itens antes de desembolsar.'
      );
      return;
    }
    setInputsParciaisStr(parciaisIniciais);
    setModoParcialAtivo(false);
    setModalDesembParcelaIdx(pIndex);
  };

  const confirmarDesembolsoParcela = (integral: boolean) => {
    if (modalDesembParcelaIdx === null) return;
    const p = modalDesembParcelaIdx;
    const vals: number[] = [];

    if (integral) {
      let soma = 0;
      for (let i = 0; i < dadosConf.qtdItens; i++) {
        const v = matrizResultados[i]?.[p]?.autorizadoNestaParcela || 0;
        vals.push(v);
        soma += v;
      }
      if (soma <= 0) {
        alert('Sem valores comprovados para liberar.');
        return;
      }
    } else {
      let totalInf = 0;
      for (let i = 0; i < dadosConf.qtdItens; i++) {
        const v = parseMoeda(inputsParciaisStr[i] || '0');
        vals.push(v);
        totalInf += v;
      }
      if (totalInf > resumoCalculadoTela.totGeralAutorizadoAteAqui + 0.05) {
        alert(
          '⚠️ Tentativa de desembolsar valor superior ao comprovado nesta parcela!'
        );
        return;
      }
    }

    setDadosConf((prev) => ({
      ...prev,
      desembolsoManual: {
        ...prev.desembolsoManual,
        [p]: { tipo: integral ? 'integral' : 'parcial', valores: vals },
      },
    }));
    setModalDesembParcelaIdx(null);
  };

  const reverterDesembolsoParcela = () => {
    if (modalDesembParcelaIdx === null) return;
    const p = modalDesembParcelaIdx;
    setDadosConf((prev) => {
      const copia = { ...prev.desembolsoManual };
      delete copia[p];
      return { ...prev, desembolsoManual: copia };
    });
    setModalDesembParcelaIdx(null);
  };

  const desembolsarTudoConcluirOrcamento = () => {
    if (
      !confirm(
        'Tem certeza que todo o saldo restante foi comprovado? Isso concluirá o orçamento inteiro nesta parcela.'
      )
    )
      return;

    const vals: number[] = [];
    for (let i = 0; i < dadosConf.qtdItens; i++) {
      const totalOrcadoItem = (dadosConf.orcamento[i] || []).reduce(
        (a, b) => a + (b || 0),
        0
      );
      let pagoAteAqui = 0;
      for (let x = 0; x < parcelaAtivaIdx; x++) {
        const cel = matrizResultados[i]?.[x];
        if (!cel) continue;
        pagoAteAqui += cel.isManual
          ? cel.desembolsadoNestaParcela
          : cel.autorizadoNestaParcela;
      }
      vals[i] = Math.max(0, totalOrcadoItem - pagoAteAqui);
    }

    const novoMapa = { ...dadosConf.desembolsoManual };
    novoMapa[parcelaAtivaIdx] = { tipo: 'parcial', valores: vals };
    for (let x = parcelaAtivaIdx + 1; x < dadosConf.qtdParcelas; x++) {
      novoMapa[x] = {
        tipo: 'parcial',
        valores: new Array(dadosConf.qtdItens).fill(0),
      };
    }

    setDadosConf((prev) => ({
      ...prev,
      desembolsoManual: novoMapa,
    }));
  };

  const gerarTextoCurtoS567 = () => {
    if (parcelasMarcadasS567.length === 0) {
      alert('Selecione pelo menos uma parcela desembolsada para somar.');
      return;
    }
    let texto = `COMPROVAÇÃO FINANCEIRA - ID: ${idCompFin || '[Informar ID]'}\n`;
    let teveItem = false;

    for (let i = 0; i < dadosConf.qtdItens; i++) {
      let somaItem = 0;
      parcelasMarcadasS567.forEach((p) => {
        somaItem += dadosConf.desembolsoManual[p]?.valores?.[i] || 0;
      });
      if (somaItem > 0) {
        teveItem = true;
        const it = dadosConf.itens[i] || {
          nome: `Item ${i + 1}`,
          qtd: '',
          unidade: 'UND',
        };
        const nomeUp = it.nome.toUpperCase();
        const unid = it.unidade || identificarUnidadeItem(nomeUp);
        const parenteses = it.qtd ? `${it.qtd} ${unid}` : unid;
        texto += `${nomeUp} (${parenteses}) - ${fmtBRL(somaItem)}\n`;
      }
    }

    if (!teveItem) {
      texto +=
        '(Nenhum valor desembolsado nos itens para as parcelas selecionadas)';
    }
    setTextoS567CurtoGerado(texto.trim());
  };

  if (!aberto || typeof document === 'undefined') return null;

  const itensChecklistAtivos = obterChecklistPorTipoSolicitacao(
    tipoSolicitacaoDesemb,
    assessoriaNoContrato === 'SIM'
  );

  const divergeDoGabarito =
    dadosConf.valorPropostaGabarito > 0 &&
    resumoCalculadoTela.totalOrcamentoGlobal > 0 &&
    Math.abs(
      resumoCalculadoTela.totalOrcamentoGlobal -
        dadosConf.valorPropostaGabarito
    ) > 0.05;

  const inputStyle: React.CSSProperties = {
    height: '32px',
    padding: '4px 8px',
    fontSize: '11.5px',
    borderRadius: '6px',
    border: '1px solid #cbd5e1',
    background: '#ffffff',
    color: '#0f172a',
    width: '100%',
  };

  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 23, 42, 0.78)',
        zIndex: 950000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backdropFilter: 'blur(3px)',
      }}
    >
      <div
        style={{
          background: '#f8fafc',
          width: '97vw',
          maxWidth: '1460px',
          height: '95vh',
          borderRadius: '12px',
          boxShadow: '0 25px 55px rgba(0,0,0,0.45)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          borderTop: '5px solid #8B1530',
        }}
      >
        {/* CABEÇALHO PRINCIPAL */}
        <div
          style={{
            padding: '10px 20px',
            background: '#ffffff',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '10px',
          }}
        >
          <div>
            <h3
              style={{
                margin: 0,
                fontSize: '15.5px',
                color: '#8B1530',
                fontWeight: 800,
              }}
            >
              📑 CONFERÊNCIA FINANCEIRA DE DESEMBOLSO (NFs) & GERADOR S567
            </h3>
            <span style={{ fontSize: '11px', color: '#64748b' }}>
              Controle de Orçamento por Parcela, Sobra Automática de NFs,
              Checklist de GTA/Semoventes e Despacho S567.
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              onClick={() => setAbaSuperior('CONFERENCIA_NF')}
              style={{
                width: 'auto',
                height: '32px',
                padding: '0 14px',
                fontSize: '11.5px',
                fontWeight: 800,
                borderRadius: '6px',
                border: '1px solid #8B1530',
                background:
                  abaSuperior === 'CONFERENCIA_NF' ? '#8B1530' : '#ffffff',
                color:
                  abaSuperior === 'CONFERENCIA_NF' ? '#ffffff' : '#8B1530',
                cursor: 'pointer',
              }}
            >
              📊 1. Conferência Detalhada de NFs e Parcelas
            </button>

            <button
              type="button"
              onClick={() => setAbaSuperior('CHECKLIST_S567')}
              style={{
                width: 'auto',
                height: '32px',
                padding: '0 14px',
                fontSize: '11.5px',
                fontWeight: 800,
                borderRadius: '6px',
                border: '1px solid #d97706',
                background:
                  abaSuperior === 'CHECKLIST_S567' ? '#d97706' : '#fffbeb',
                color:
                  abaSuperior === 'CHECKLIST_S567' ? '#ffffff' : '#b45309',
                cursor: 'pointer',
              }}
            >
              📋 2. Checklist Documental, Regras de NFs & Resumo S567
            </button>

            <button
              type="button"
              onClick={onFechar}
              style={{
                width: 'auto',
                background: 'none',
                border: 'none',
                fontSize: '24px',
                color: '#64748b',
                cursor: 'pointer',
                padding: '0 6px',
                lineHeight: 1,
              }}
            >
              &times;
            </button>
          </div>
        </div>

        {/* BARRA DE FERRAMENTAS GLOBAL DO MODAL */}
        <div
          style={{
            padding: '8px 20px',
            background: '#f1f5f9',
            borderBottom: '1px solid #cbd5e1',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '8px',
          }}
        >
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => {
                if (confirm('Limpar todos os dados da conferência atual?')) {
                  setDadosConf(ESTADO_INICIAL_CONF);
                  setParcelaAtivaIdx(0);
                }
              }}
              style={{
                width: 'auto',
                height: '30px',
                padding: '0 12px',
                fontSize: '11px',
                fontWeight: 800,
                background: '#fee2e2',
                color: '#b91c1c',
                border: '1px solid #fca5a5',
                borderRadius: '5px',
                cursor: 'pointer',
              }}
            >
              🗑️ Limpar Dados (Novo)
            </button>

            <button
              type="button"
              onClick={salvarAnaliseJson}
              style={{
                width: 'auto',
                height: '30px',
                padding: '0 12px',
                fontSize: '11px',
                fontWeight: 800,
                background: '#15803d',
                color: '#ffffff',
                border: 'none',
                borderRadius: '5px',
                cursor: 'pointer',
              }}
            >
              🗃️ Salvar Análise (.JSON)
            </button>

            <label
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                height: '30px',
                padding: '0 12px',
                fontSize: '11px',
                fontWeight: 800,
                background: '#ffffff',
                color: '#334155',
                border: '1px solid #cbd5e1',
                borderRadius: '5px',
                cursor: 'pointer',
                margin: 0,
              }}
            >
              📂 Continuar Análise (Importar .JSON)
              <input
                type="file"
                accept=".json"
                onChange={importarAnaliseJson}
                style={{ display: 'none' }}
              />
            </label>

            {dadosConf.etapaAtual === 3 && (
              <>
                <button
                  type="button"
                  onClick={() => setModalRelatorioAberto(true)}
                  style={{
                    width: 'auto',
                    height: '30px',
                    padding: '0 12px',
                    fontSize: '11px',
                    fontWeight: 800,
                    background: '#eff6ff',
                    color: '#1d4ed8',
                    border: '1px solid #93c5fd',
                    borderRadius: '5px',
                    cursor: 'pointer',
                  }}
                >
                  📊 Relatório da Conferência
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const desembolsadas = Object.keys(dadosConf.desembolsoManual)
                      .map(Number)
                      .filter((p) => dadosConf.desembolsoManual[p] !== undefined);
                    if (desembolsadas.length === 0) {
                      alert(
                        'Desembolse ao menos uma parcela na tabela abaixo antes de gerar o texto curto do S567!'
                      );
                      return;
                    }
                    setParcelasMarcadasS567([parcelaAtivaIdx]);
                    setTextoS567CurtoGerado('');
                    setModalS567CurtoAberto(true);
                  }}
                  style={{
                    width: 'auto',
                    height: '30px',
                    padding: '0 12px',
                    fontSize: '11px',
                    fontWeight: 800,
                    background: '#fef3c7',
                    color: '#92400e',
                    border: '1px solid #fcd34d',
                    borderRadius: '5px',
                    cursor: 'pointer',
                  }}
                >
                  📝 Gerar Texto S567 (Por Parcela)
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setDadosConf((prev) => ({ ...prev, etapaAtual: 1 }))
                  }
                  style={{
                    width: 'auto',
                    height: '30px',
                    padding: '0 10px',
                    fontSize: '11px',
                    fontWeight: 700,
                    background: '#ffffff',
                    color: '#475569',
                    border: '1px solid #cbd5e1',
                    borderRadius: '5px',
                    cursor: 'pointer',
                  }}
                >
                  ⚙️ 1. Estruturação
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setDadosConf((prev) => ({ ...prev, etapaAtual: 2 }))
                  }
                  style={{
                    width: 'auto',
                    height: '30px',
                    padding: '0 10px',
                    fontSize: '11px',
                    fontWeight: 700,
                    background: '#ffffff',
                    color: '#475569',
                    border: '1px solid #cbd5e1',
                    borderRadius: '5px',
                    cursor: 'pointer',
                  }}
                >
                  💰 2. Recadastrar Orçamento
                </button>
              </>
            )}
          </div>

          <div style={{ fontSize: '11.5px', fontWeight: 800, color: '#8B1530' }}>
            {dadosConf.nome
              ? `👤 ${dadosConf.nome} ${
                  dadosConf.numOp ? `• OP: ${dadosConf.numOp}` : ''
                }`
              : 'Selecione um cliente na Etapa 1'}
          </div>
        </div>

        {/* ALERTA LARANJA DE DIVERGÊNCIA COM O VALOR DO CONTRATO */}
        {divergeDoGabarito && (
          <div
            style={{
              margin: '10px 20px 0 20px',
              padding: '8px 14px',
              background: '#fef7e0',
              color: '#b06000',
              border: '1px solid #fde293',
              borderRadius: '6px',
              fontSize: '11.5px',
              fontWeight: 800,
            }}
          >
            ⚠️ Alerta: O orçamento cadastrado dos itens (
            {fmtBRL(resumoCalculadoTela.totalOrcamentoGlobal)}) diverge do Valor
            Contratado da Operação ({fmtBRL(dadosConf.valorPropostaGabarito)}).
          </div>
        )}

        {/* CONTEÚDO PRINCIPAL */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
          {abaSuperior === 'CONFERENCIA_NF' && (
            <>
              {/* ETAPA 1: ESTRUTURAÇÃO DO ORÇAMENTO */}
              {dadosConf.etapaAtual === 1 && (
                <div
                  style={{
                    background: '#ffffff',
                    border: '1px solid #cbd5e1',
                    borderRadius: '8px',
                    padding: '18px 20px',
                    maxWidth: '920px',
                    margin: '0 auto',
                  }}
                >
                  <h4
                    style={{
                      margin: '0 0 12px 0',
                      color: '#8B1530',
                      fontSize: '15px',
                      borderBottom: '1px solid #e2e8f0',
                      paddingBottom: '8px',
                    }}
                  >
                    1. Estruturação do Orçamento (Cliente, Quantidade de Itens e
                    Parcelas)
                  </h4>

                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1.8fr 1fr 1fr 1fr',
                      gap: '12px',
                      marginBottom: '14px',
                    }}
                  >
                    <div>
                      <label style={{ fontSize: '11px', fontWeight: 700 }}>
                        Nome Completo do Cliente (Puxar da Base)
                      </label>
                      <input
                        type="text"
                        list="dl_conf_desemb_ops"
                        value={dadosConf.nome}
                        onChange={(e) => {
                          const v = e.target.value;
                          setDadosConf((prev) => ({
                            ...prev,
                            nome: v.toUpperCase(),
                          }));
                          const achada = operacoesBase.find(
                            (o) =>
                              o.cliente.toUpperCase() === v.toUpperCase().trim()
                          );
                          if (achada) {
                            carregarDadosClienteOuOp(
                              achada.cliente,
                              achada.cpf,
                              achada.op,
                              achada.valor
                            );
                          }
                        }}
                        placeholder="Selecione ou digite..."
                        style={{ ...inputStyle, fontWeight: 700 }}
                      />
                      <datalist id="dl_conf_desemb_ops">
                        {operacoesBase.map((o) => (
                          <option key={o.id} value={o.cliente}>
                            OP: {o.op} — R$ {o.valor}
                          </option>
                        ))}
                      </datalist>
                    </div>

                    <div>
                      <label style={{ fontSize: '11px', fontWeight: 700 }}>
                        CPF
                      </label>
                      <input
                        type="text"
                        value={dadosConf.cpf}
                        onChange={(e) =>
                          setDadosConf((prev) => ({
                            ...prev,
                            cpf: aplicarMascaraCPF(e.target.value),
                          }))
                        }
                        placeholder="000.000.000-00"
                        style={inputStyle}
                      />
                    </div>

                    <div>
                      <label style={{ fontSize: '11px', fontWeight: 700 }}>
                        Nº da Operação
                      </label>
                      <input
                        type="text"
                        value={dadosConf.numOp}
                        onChange={(e) =>
                          setDadosConf((prev) => ({
                            ...prev,
                            numOp: e.target.value.toUpperCase(),
                          }))
                        }
                        placeholder="Ex: C30050102/001"
                        style={{ ...inputStyle, fontWeight: 700 }}
                      />
                    </div>

                    <div>
                      <label style={{ fontSize: '11px', fontWeight: 700 }}>
                        Valor Contratado (R$)
                      </label>
                      <input
                        type="text"
                        value={
                          dadosConf.valorPropostaGabarito > 0
                            ? formatarMoedaBD(dadosConf.valorPropostaGabarito)
                            : ''
                        }
                        onChange={(e) => {
                          const masc = aplicarMascaraMoedaInput(e.target.value);
                          setDadosConf((prev) => ({
                            ...prev,
                            valorPropostaGabarito: parseMoeda(masc),
                          }));
                        }}
                        placeholder="0,00"
                        style={{ ...inputStyle, fontWeight: 800, color: '#8B1530' }}
                      />
                    </div>
                  </div>

                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: '12px',
                      marginBottom: '14px',
                    }}
                  >
                    <div>
                      <label style={{ fontSize: '11px', fontWeight: 700 }}>
                        Quantidade de Itens Financiados:
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={40}
                        value={dadosConf.qtdItens}
                        onChange={(e) =>
                          ajustarDimensoesEstrutura(
                            parseInt(e.target.value) || 1,
                            dadosConf.qtdParcelas
                          )
                        }
                        style={{ ...inputStyle, fontWeight: 800 }}
                      />
                    </div>

                    <div>
                      <label style={{ fontSize: '11px', fontWeight: 700 }}>
                        Quantidade de Parcelas do Cronograma:
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={24}
                        value={dadosConf.qtdParcelas}
                        onChange={(e) =>
                          ajustarDimensoesEstrutura(
                            dadosConf.qtdItens,
                            parseInt(e.target.value) || 1
                          )
                        }
                        style={{ ...inputStyle, fontWeight: 800 }}
                      />
                    </div>
                  </div>

                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))',
                      gap: '10px',
                      marginBottom: '16px',
                      background: '#f8fafc',
                      padding: '12px',
                      borderRadius: '6px',
                      border: '1px solid #e2e8f0',
                    }}
                  >
                    {dadosConf.meses.map((mes, pIdx) => (
                      <div key={pIdx}>
                        <label style={{ fontSize: '10.5px', fontWeight: 700 }}>
                          Mês / Ref. da {pIdx + 1}ª Parcela:
                        </label>
                        <input
                          type="text"
                          value={mes}
                          onChange={(e) => {
                            const novos = [...dadosConf.meses];
                            novos[pIdx] = e.target.value;
                            setDadosConf((prev) => ({ ...prev, meses: novos }));
                          }}
                          placeholder={`Ex: Mês 0${pIdx + 1}`}
                          style={inputStyle}
                        />
                      </div>
                    ))}
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <button
                      type="button"
                      onClick={() =>
                        setDadosConf((prev) => ({ ...prev, etapaAtual: 2 }))
                      }
                      style={{
                        width: 'auto',
                        padding: '9px 22px',
                        fontSize: '12.5px',
                        fontWeight: 800,
                        background: '#8B1530',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                      }}
                    >
                      Avançar para Valores do Orçamento ➔
                    </button>
                  </div>
                </div>
              )}

              {/* ETAPA 2: CADASTRO DOS ITENS E VALORES POR PARCELA */}
              {dadosConf.etapaAtual === 2 && (
                <div
                  style={{
                    background: '#ffffff',
                    border: '1px solid #cbd5e1',
                    borderRadius: '8px',
                    padding: '18px 20px',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      borderBottom: '1px solid #e2e8f0',
                      paddingBottom: '8px',
                      marginBottom: '14px',
                    }}
                  >
                    <h4 style={{ margin: 0, color: '#8B1530', fontSize: '15px' }}>
                      2. Cadastro do Orçamento por Item e Parcela
                    </h4>
                    <span
                      style={{
                        fontSize: '12px',
                        fontWeight: 800,
                        color: '#15803d',
                      }}
                    >
                      Soma Atual:{' '}
                      {fmtBRL(resumoCalculadoTela.totalOrcamentoGlobal)}
                    </span>
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '12px',
                    }}
                  >
                    {dadosConf.itens.map((it, iIdx) => (
                      <div
                        key={iIdx}
                        style={{
                          background: '#f8fafc',
                          border: '1px solid #cbd5e1',
                          borderRadius: '6px',
                          padding: '12px',
                        }}
                      >
                        <div
                          style={{
                            display: 'grid',
                            gridTemplateColumns: '2.5fr 0.8fr 0.8fr',
                            gap: '10px',
                            marginBottom: '10px',
                          }}
                        >
                          <div>
                            <label
                              style={{
                                fontSize: '10.5px',
                                fontWeight: 800,
                                color: '#8B1530',
                              }}
                            >
                              Item {iIdx + 1} — Descrição (Ex: Aquisição de
                              Matrizes, Pastagem, Curral)
                            </label>
                            <input
                              type="text"
                              value={it.nome}
                              onChange={(e) => {
                                const novos = [...dadosConf.itens];
                                const novoNome = e.target.value;
                                novos[iIdx] = {
                                  ...novos[iIdx],
                                  nome: novoNome,
                                  unidade: identificarUnidadeItem(novoNome),
                                };
                                setDadosConf((prev) => ({
                                  ...prev,
                                  itens: novos,
                                }));
                              }}
                              style={{ ...inputStyle, fontWeight: 700 }}
                            />
                          </div>

                          <div>
                            <label style={{ fontSize: '10.5px', fontWeight: 700 }}>
                              Quantidade (S567)
                            </label>
                            <input
                              type="text"
                              value={it.qtd}
                              onChange={(e) => {
                                const novos = [...dadosConf.itens];
                                novos[iIdx] = {
                                  ...novos[iIdx],
                                  qtd: e.target.value,
                                };
                                setDadosConf((prev) => ({
                                  ...prev,
                                  itens: novos,
                                }));
                              }}
                              placeholder="Ex: 10"
                              style={inputStyle}
                            />
                          </div>

                          <div>
                            <label style={{ fontSize: '10.5px', fontWeight: 700 }}>
                              Unidade (UA / HA / UND)
                            </label>
                            <input
                              type="text"
                              value={it.unidade}
                              onChange={(e) => {
                                const novos = [...dadosConf.itens];
                                novos[iIdx] = {
                                  ...novos[iIdx],
                                  unidade: e.target.value.toUpperCase(),
                                };
                                setDadosConf((prev) => ({
                                  ...prev,
                                  itens: novos,
                                }));
                              }}
                              style={{ ...inputStyle, fontWeight: 700 }}
                            />
                          </div>
                        </div>

                        <div
                          style={{
                            display: 'grid',
                            gridTemplateColumns:
                              'repeat(auto-fill, minmax(180px, 1fr))',
                            gap: '10px',
                          }}
                        >
                          {dadosConf.meses.map((mesLabel, pIdx) => {
                            const valNum = dadosConf.orcamento[iIdx]?.[pIdx] || 0;
                            return (
                              <div key={pIdx}>
                                <label
                                  style={{ fontSize: '10.5px', fontWeight: 700 }}
                                >
                                  P{pIdx + 1} ({mesLabel}) — R$:
                                </label>
                                <input
                                  type="text"
                                  value={
                                    valNum > 0 ? formatarMoedaBD(valNum) : ''
                                  }
                                  onChange={(e) => {
                                    const m = aplicarMascaraMoedaInput(
                                      e.target.value
                                    );
                                    const num = parseMoeda(m);
                                    const novoOrc = dadosConf.orcamento.map(
                                      (row) => [...row]
                                    );
                                    if (!novoOrc[iIdx]) novoOrc[iIdx] = [];
                                    novoOrc[iIdx][pIdx] = num;
                                    setDadosConf((prev) => ({
                                      ...prev,
                                      orcamento: novoOrc,
                                    }));
                                  }}
                                  placeholder="0,00"
                                  style={{ ...inputStyle, fontWeight: 700 }}
                                />
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      marginTop: '16px',
                    }}
                  >
                    <button
                      type="button"
                      onClick={() =>
                        setDadosConf((prev) => ({ ...prev, etapaAtual: 1 }))
                      }
                      style={{
                        width: 'auto',
                        padding: '9px 18px',
                        fontSize: '12px',
                        fontWeight: 700,
                        background: '#e2e8f0',
                        color: '#334155',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                      }}
                    >
                      ⬅️ Voltar à Estruturação
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setParcelaAtivaIdx(0);
                        setDadosConf((prev) => ({ ...prev, etapaAtual: 3 }));
                      }}
                      style={{
                        width: 'auto',
                        padding: '9px 22px',
                        fontSize: '12.5px',
                        fontWeight: 800,
                        background: '#15803d',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                      }}
                    >
                      ✅ Finalizar Orçamento e Iniciar Conferência de NFs ➔
                    </button>
                  </div>
                </div>
              )}

              {/* ETAPA 3: PLANILHA DE CONFERÊNCIA DE NFs POR PARCELA */}
              {dadosConf.etapaAtual === 3 && (
                <div
                  style={{
                    background: '#ffffff',
                    border: '1px solid #cbd5e1',
                    borderRadius: '8px',
                    padding: '16px 18px',
                  }}
                >
                  {/* ABAS DAS PARCELAS + BOTÃO REGISTRAR DESEMBOLSO */}
                  <div
                    style={{
                      display: 'flex',
                      gap: '8px',
                      overflowX: 'auto',
                      paddingBottom: '8px',
                      marginBottom: '12px',
                      borderBottom: '2px solid #e2e8f0',
                    }}
                  >
                    {dadosConf.meses.map((mesLabel, pIdx) => {
                      const jaLiberada = Boolean(
                        dadosConf.desembolsoManual[pIdx]
                      );
                      const ativa = parcelaAtivaIdx === pIdx;
                      return (
                        <div
                          key={pIdx}
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            minWidth: '155px',
                          }}
                        >
                          <button
                            type="button"
                            onClick={() => setParcelaAtivaIdx(pIdx)}
                            style={{
                              width: '100%',
                              padding: '8px 10px',
                              fontSize: '11.5px',
                              fontWeight: 800,
                              background: ativa
                                ? '#8B1530'
                                : jaLiberada
                                ? '#dcfce7'
                                : '#f1f5f9',
                              color: ativa
                                ? '#ffffff'
                                : jaLiberada
                                ? '#166534'
                                : '#334155',
                              border: '1px solid #cbd5e1',
                              borderRadius: '6px 6px 0 0',
                              cursor: 'pointer',
                            }}
                          >
                            {jaLiberada ? '✅ ' : ''}
                            {pIdx + 1}ª Parc. ({mesLabel})
                          </button>
                          <button
                            type="button"
                            onClick={() => abrirSubmodalDesembolsarParcela(pIdx)}
                            style={{
                              width: '100%',
                              padding: '4px 6px',
                              fontSize: '10px',
                              fontWeight: 800,
                              background: jaLiberada ? '#15803d' : '#f59e0b',
                              color: '#ffffff',
                              border: 'none',
                              borderRadius: '0 0 6px 6px',
                              cursor: 'pointer',
                            }}
                          >
                            {jaLiberada
                              ? '💸 Desembolsada (Ver/Reverter)'
                              : '⚙️ Registrar Desembolso'}
                          </button>
                        </div>
                      );
                    })}
                  </div>

                  {/* TABELA MATRIZ DE EXIGÊNCIAS X COMPROVAÇÕES (NFs) */}
                  <div style={{ overflowX: 'auto' }}>
                    <table
                      className="conf-table"
                      style={{ width: '100%', fontSize: '11.5px', marginTop: 0 }}
                    >
                      <thead>
                        <tr>
                          <th rowSpan={2} style={{ minWidth: '180px' }}>
                            Item Financiado
                          </th>
                          <th
                            colSpan={3}
                            style={{ backgroundColor: '#7a1231' }}
                          >
                            Exigências do Cronograma
                          </th>
                          <th
                            colSpan={4}
                            style={{ backgroundColor: '#550a21' }}
                          >
                            Comprovações (Notas Fiscais / Recibos)
                          </th>
                          <th rowSpan={2}>
                            Status da
                            <br />
                            Parcela
                          </th>
                          <th rowSpan={2}>
                            Valor a
                            <br />
                            Desembolsar
                          </th>
                        </tr>
                        <tr>
                          <th style={{ backgroundColor: '#9c173f' }}>
                            Orçado no Mês
                          </th>
                          <th style={{ backgroundColor: '#9c173f' }}>
                            Pendente Ant.
                          </th>
                          <th style={{ backgroundColor: '#9c173f' }}>
                            Total Exigido
                          </th>
                          <th style={{ backgroundColor: '#7a1231' }}>
                            Sobra NFs Ant.
                          </th>
                          <th
                            style={{
                              backgroundColor: '#7a1231',
                              minWidth: '210px',
                            }}
                          >
                            Notas Fiscais Inseridas (R$)
                          </th>
                          <th style={{ backgroundColor: '#7a1231' }}>
                            Total Disp.
                          </th>
                          <th style={{ backgroundColor: '#8c1a3b' }}>
                            Total Rest.
                            <br />
                            (p/ Concluir Item)
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {dadosConf.itens.map((it, iIdx) => {
                          const r =
                            matrizResultados[iIdx]?.[parcelaAtivaIdx];
                          if (!r) return null;

                          const nfsAtuais =
                            dadosConf.comprovacoes[iIdx]?.[parcelaAtivaIdx] ||
                            [];
                          let statusLabel = '-';
                          let statusBg = 'transparent';
                          let statusColor = '#64748b';
                          let valorExibido = 0;

                          if (r.isManual) {
                            statusLabel = 'Desembolsado';
                            statusBg = '#dcfce7';
                            statusColor = '#15803d';
                            valorExibido = r.desembolsadoNestaParcela;
                          } else if (r.autorizadoNestaParcela > 0) {
                            statusLabel = 'Apto';
                            statusBg = '#dcfce7';
                            statusColor = '#15803d';
                            valorExibido = r.autorizadoNestaParcela;
                          } else if (r.necessidadeAcumulada > 0) {
                            statusLabel = 'Pendente';
                            statusBg = '#fee2e2';
                            statusColor = '#b91c1c';
                          }

                          return (
                            <tr key={iIdx}>
                              <td
                                style={{
                                  textAlign: 'left',
                                  fontWeight: 800,
                                  color: '#0f172a',
                                }}
                              >
                                {it.nome}{' '}
                                {it.qtd ? (
                                  <span
                                    style={{
                                      fontSize: '10px',
                                      color: '#64748b',
                                    }}
                                  >
                                    ({it.qtd} {it.unidade})
                                  </span>
                                ) : null}
                              </td>
                              <td>{fmtBRL(r.orcadoAtual)}</td>
                              <td
                                style={{
                                  color:
                                    r.pendenteAnterior > 0
                                      ? '#b91c1c'
                                      : '#64748b',
                                  fontWeight:
                                    r.pendenteAnterior > 0 ? 700 : 400,
                                }}
                              >
                                {fmtBRL(r.pendenteAnterior)}
                              </td>
                              <td
                                style={{
                                  background: '#fce8e6',
                                  color: '#b91c1c',
                                  fontWeight: 800,
                                }}
                              >
                                {fmtBRL(r.necessidadeAcumulada)}
                              </td>
                              <td style={{ color: '#475569' }}>
                                {fmtBRL(r.saldoNfsAnterior)}
                              </td>
                              <td>
                                {r.isManual ? (
                                  <span
                                    style={{
                                      background: '#dcfce7',
                                      color: '#15803d',
                                      padding: '3px 8px',
                                      borderRadius: '4px',
                                      fontWeight: 800,
                                      fontSize: '10.5px',
                                    }}
                                  >
                                    ✅ Parcela Desembolsada
                                  </span>
                                ) : (
                                  <div
                                    style={{
                                      display: 'flex',
                                      flexWrap: 'wrap',
                                      gap: '4px',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                    }}
                                  >
                                    {nfsAtuais.map((valNf, nfIdx) => (
                                      <div
                                        key={nfIdx}
                                        style={{
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          gap: '2px',
                                        }}
                                      >
                                        <input
                                          type="number"
                                          step="0.01"
                                          value={valNf || ''}
                                          onChange={(e) => {
                                            const v =
                                              parseFloat(e.target.value) || 0;
                                            const novasComp =
                                              dadosConf.comprovacoes.map(
                                                (itemArr) =>
                                                  itemArr.map((pArr) => [
                                                    ...pArr,
                                                  ])
                                              );
                                            novasComp[iIdx][parcelaAtivaIdx][
                                              nfIdx
                                            ] = v;
                                            setDadosConf((prev) => ({
                                              ...prev,
                                              comprovacoes: novasComp,
                                            }));
                                          }}
                                          placeholder="0,00"
                                          style={{
                                            width: '82px',
                                            padding: '3px 5px',
                                            fontSize: '11px',
                                            fontWeight: 700,
                                          }}
                                        />
                                        <button
                                          type="button"
                                          onClick={() => {
                                            const novasComp =
                                              dadosConf.comprovacoes.map(
                                                (itemArr) =>
                                                  itemArr.map((pArr) => [
                                                    ...pArr,
                                                  ])
                                              );
                                            novasComp[iIdx][
                                              parcelaAtivaIdx
                                            ].splice(nfIdx, 1);
                                            setDadosConf((prev) => ({
                                              ...prev,
                                              comprovacoes: novasComp,
                                            }));
                                          }}
                                          style={{
                                            width: 'auto',
                                            padding: '1px 4px',
                                            fontSize: '9px',
                                            background: '#fee2e2',
                                            color: '#b91c1c',
                                            border: 'none',
                                            borderRadius: '3px',
                                            cursor: 'pointer',
                                          }}
                                        >
                                          ✖
                                        </button>
                                      </div>
                                    ))}
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const novasComp =
                                          dadosConf.comprovacoes.map(
                                            (itemArr) =>
                                              itemArr.map((pArr) => [...pArr])
                                          );
                                        if (!novasComp[iIdx])
                                          novasComp[iIdx] = [];
                                        if (!novasComp[iIdx][parcelaAtivaIdx]) {
                                          novasComp[iIdx][parcelaAtivaIdx] = [];
                                        }
                                        novasComp[iIdx][parcelaAtivaIdx].push(
                                          0
                                        );
                                        setDadosConf((prev) => ({
                                          ...prev,
                                          comprovacoes: novasComp,
                                        }));
                                      }}
                                      style={{
                                        width: 'auto',
                                        padding: '3px 8px',
                                        fontSize: '10.5px',
                                        fontWeight: 800,
                                        background: '#ffffff',
                                        color: '#8B1530',
                                        border: '1px solid #8B1530',
                                        borderRadius: '4px',
                                        cursor: 'pointer',
                                      }}
                                    >
                                      + Add NF
                                    </button>
                                  </div>
                                )}
                              </td>
                              <td
                                style={{
                                  background: '#e8f0fe',
                                  color: '#1a73e8',
                                  fontWeight: 800,
                                }}
                              >
                                {r.isManual
                                  ? '-'
                                  : fmtBRL(r.totalNfsDisponivelAqui)}
                              </td>
                              <td
                                style={{
                                  color:
                                    resumoCalculadoTela.restsPorItem[iIdx] <=
                                    0.01
                                      ? '#15803d'
                                      : '#8B1530',
                                  fontWeight: 800,
                                }}
                              >
                                {fmtBRL(
                                  resumoCalculadoTela.restsPorItem[iIdx] || 0
                                )}
                              </td>
                              <td>
                                <span
                                  style={{
                                    background: statusBg,
                                    color: statusColor,
                                    padding: '4px 8px',
                                    borderRadius: '4px',
                                    fontWeight: 800,
                                    fontSize: '11px',
                                  }}
                                >
                                  {statusLabel}
                                </span>
                              </td>
                              <td
                                style={{
                                  fontWeight: 800,
                                  fontSize: '13px',
                                  color:
                                    valorExibido > 0 ? '#15803d' : '#64748b',
                                }}
                              >
                                {fmtBRL(valorExibido)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* DASHBOARD DE TOTAIS DA PARCELA E DO ORÇAMENTO GLOBAL */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: '14px',
                      marginTop: '16px',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '10px',
                      }}
                    >
                      <div
                        style={{
                          padding: '12px 16px',
                          borderRadius: '6px',
                          background: '#fce8e6',
                          color: '#d93025',
                          border: '1px solid #f1a8a2',
                          textAlign: 'right',
                          fontWeight: 700,
                        }}
                      >
                        Total Pendente nesta Parcela:{' '}
                        <strong style={{ fontSize: '17px', display: 'block' }}>
                          {fmtBRL(resumoCalculadoTela.totPendenteEstaParcela)}
                        </strong>
                      </div>

                      <div
                        style={{
                          padding: '12px 16px',
                          borderRadius: '6px',
                          background: '#fce8e6',
                          color: '#d93025',
                          border: '1px solid #f1a8a2',
                          textAlign: 'right',
                          fontWeight: 700,
                        }}
                      >
                        Total Geral Pendente (P/ Concluir Orçamento):{' '}
                        <strong style={{ fontSize: '17px', display: 'block' }}>
                          {fmtBRL(resumoCalculadoTela.totGeralPendente)}
                        </strong>

                        {resumoCalculadoTela.todosItensComprovados &&
                          resumoCalculadoTela.totGeralPendente > 0 && (
                            <button
                              type="button"
                              onClick={desembolsarTudoConcluirOrcamento}
                              style={{
                                width: '100%',
                                marginTop: '8px',
                                padding: '8px',
                                background: '#15803d',
                                color: '#ffffff',
                                fontWeight: 800,
                                fontSize: '12px',
                                border: 'none',
                                borderRadius: '5px',
                                cursor: 'pointer',
                              }}
                            >
                              💰 DESEMBOLSAR TUDO (Todo o Orçamento Comprovado!)
                            </button>
                          )}
                      </div>
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '10px',
                      }}
                    >
                      <div
                        style={{
                          padding: '12px 16px',
                          borderRadius: '6px',
                          background: '#e6f4ea',
                          color: '#13652c',
                          border: '1px solid #a8dab5',
                          textAlign: 'right',
                          fontWeight: 700,
                        }}
                      >
                        Total Desembolsado (Histórico Acumulado):{' '}
                        <strong style={{ fontSize: '17px', display: 'block' }}>
                          {fmtBRL(resumoCalculadoTela.totGeralDesembolsado)}
                        </strong>
                      </div>

                      <div
                        style={{
                          padding: '12px 16px',
                          borderRadius: '6px',
                          background: '#188038',
                          color: '#ffffff',
                          textAlign: 'right',
                          fontWeight: 700,
                          boxShadow: '0 4px 8px rgba(0,0,0,0.12)',
                        }}
                      >
                        Autorizado a Liberar nesta Parcela:{' '}
                        <strong style={{ fontSize: '19px', display: 'block' }}>
                          {fmtBRL(resumoCalculadoTela.totAutorizadoEstaParcela)}
                        </strong>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {/* ABA 2: CHECKLIST DOCUMENTAL, REGRAS DE NFs E RESUMO S567 COMPLETO */}
          {abaSuperior === 'CHECKLIST_S567' && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1.35fr 1fr',
                gap: '16px',
              }}
            >
              {/* COLUNA ESQUERDA: DADOS DO CONTRATO/CCB + CHECKLIST POR TIPO + GUIA DE SEMOVENTES E NFs */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '14px',
                }}
              >
                <div
                  style={{
                    background: '#ffffff',
                    border: '1px solid #cbd5e1',
                    borderRadius: '8px',
                    padding: '14px 16px',
                  }}
                >
                  <strong
                    style={{
                      fontSize: '12.5px',
                      color: '#8B1530',
                      display: 'block',
                      marginBottom: '10px',
                    }}
                  >
                    1. INFORMAÇÕES DA OPERAÇÃO, CCB E DOSSIÊS GED
                  </strong>

                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(4, 1fr)',
                      gap: '8px',
                      marginBottom: '8px',
                    }}
                  >
                    <div>
                      <label style={{ fontSize: '10.5px', fontWeight: 700 }}>
                        Nº da Operação Ativa
                      </label>
                      <input
                        type="text"
                        value={dadosConf.numOp}
                        onChange={(e) =>
                          setDadosConf((prev) => ({
                            ...prev,
                            numOp: e.target.value.toUpperCase(),
                          }))
                        }
                        style={inputStyle}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '10.5px', fontWeight: 700 }}>
                        Data do Contrato
                      </label>
                      <input
                        type="date"
                        value={dtContrato}
                        onChange={(e) => setDtContrato(e.target.value)}
                        style={inputStyle}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '10.5px', fontWeight: 700 }}>
                        Nº da CCB
                      </label>
                      <input
                        type="text"
                        value={numCcb}
                        onChange={(e) => setNumCcb(e.target.value)}
                        placeholder="Digite a CCB"
                        style={inputStyle}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '10.5px', fontWeight: 700 }}>
                        C/C de Desembolso
                      </label>
                      <input
                        type="text"
                        value={ccDestino}
                        onChange={(e) => setCcDestino(e.target.value)}
                        placeholder="Ex: 25841-2"
                        style={{ ...inputStyle, fontWeight: 700 }}
                      />
                    </div>
                  </div>

                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(4, 1fr)',
                      gap: '8px',
                      marginBottom: '8px',
                    }}
                  >
                    <div>
                      <label style={{ fontSize: '10.5px', fontWeight: 700 }}>
                        ID Dossiê I.C Original
                      </label>
                      <input
                        type="text"
                        value={gedIc}
                        onChange={(e) => setGedIc(e.target.value)}
                        style={inputStyle}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '10.5px', fontWeight: 700 }}>
                        ID Dossiê Op. Original
                      </label>
                      <input
                        type="text"
                        value={gedOp}
                        onChange={(e) => setGedOp(e.target.value)}
                        style={inputStyle}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '10.5px', fontWeight: 700 }}>
                        ID Comp. Financeira
                      </label>
                      <input
                        type="text"
                        value={idCompFin}
                        onChange={(e) => setIdCompFin(e.target.value)}
                        placeholder="GED ID"
                        style={{ ...inputStyle, fontWeight: 700 }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '10.5px', fontWeight: 700 }}>
                        Parcela Real Desembolso
                      </label>
                      <input
                        type="number"
                        min={1}
                        value={numParcelaRealDesemb}
                        onChange={(e) =>
                          setNumParcelaRealDesemb(e.target.value)
                        }
                        style={inputStyle}
                      />
                    </div>
                  </div>

                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1.5fr 1fr 1fr',
                      gap: '8px',
                    }}
                  >
                    <div>
                      <label
                        style={{
                          fontSize: '10.5px',
                          fontWeight: 800,
                          color: '#8B1530',
                        }}
                      >
                        Tipo da Solicitação (PCE / S567)
                      </label>
                      <select
                        value={tipoSolicitacaoDesemb}
                        onChange={(e) =>
                          setTipoSolicitacaoDesemb(e.target.value)
                        }
                        style={{ ...inputStyle, fontWeight: 700 }}
                      >
                        <option value="Des Rural Animais e Const. Civil">
                          Des Rural Animais e Const. Civil
                        </option>
                        <option value="Des Rural Aquisição Isolada">
                          Des Rural Aquisição Isolada
                        </option>
                        <option value="Des Rural Construção Civil">
                          Des Rural Construção Civil
                        </option>
                        <option value="Des Rural Custeio">
                          Des Rural Custeio
                        </option>
                        <option value="Des Rural FNE Sol">
                          Des Rural FNE Sol
                        </option>
                        <option value="Des Rural Cartão BNB Agro">
                          Des Rural Cartão BNB Agro
                        </option>
                        <option value="Des Rural PNCF">Des Rural PNCF</option>
                      </select>
                    </div>

                    <div>
                      <label style={{ fontSize: '10.5px', fontWeight: 700 }}>
                        Assessoria consta no contrato?
                      </label>
                      <select
                        value={assessoriaNoContrato}
                        onChange={(e) =>
                          setAssessoriaNoContrato(
                            e.target.value as 'NÃO' | 'SIM'
                          )
                        }
                        style={inputStyle}
                      >
                        <option value="NÃO">NÃO</option>
                        <option value="SIM">
                          SIM (Exige Recibo Assessoria)
                        </option>
                      </select>
                    </div>

                    <div>
                      <label style={{ fontSize: '10.5px', fontWeight: 700 }}>
                        Fundo de Liquidez (5%)
                      </label>
                      <select
                        value={fundoLiquidezStatus}
                        onChange={(e) => setFundoLiquidezStatus(e.target.value)}
                        style={inputStyle}
                      >
                        <option value="SIM">SIM - Saldo 5% verificado</option>
                        <option value="NÃO">NÃO - Sem saldo suficiente</option>
                        <option value="DISPENSADO">DISPENSADO (PRONAF)</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* CHECKLIST + GUIA RÁPIDO DE SEMOVENTES E REGRAS DE NFs DO V98 */}
                <div
                  style={{
                    background: '#ffffff',
                    border: '1px solid #cbd5e1',
                    borderRadius: '8px',
                    padding: '14px 16px',
                    display: 'grid',
                    gridTemplateColumns: '1.45fr 1fr',
                    gap: '12px',
                  }}
                >
                  <div>
                    <strong
                      style={{
                        fontSize: '12px',
                        color: '#8B1530',
                        display: 'block',
                        marginBottom: '8px',
                      }}
                    >
                      ✅ CHECKLIST DOCUMENTAL ({tipoSolicitacaoDesemb})
                    </strong>
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '5px',
                        maxHeight: '320px',
                        overflowY: 'auto',
                      }}
                    >
                      {itensChecklistAtivos.map((itemTxt, idxC) => {
                        const keyChk = `${tipoSolicitacaoDesemb}_${idxC}`;
                        return (
                          <label
                            key={keyChk}
                            style={{
                              display: 'flex',
                              alignItems: 'flex-start',
                              gap: '8px',
                              background: checksMarcados[keyChk]
                                ? '#f0fdf4'
                                : '#f8fafc',
                              border: `1px solid ${
                                checksMarcados[keyChk] ? '#86efac' : '#e2e8f0'
                              }`,
                              padding: '6px 8px',
                              borderRadius: '5px',
                              fontSize: '11px',
                              cursor: 'pointer',
                              margin: 0,
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={Boolean(checksMarcados[keyChk])}
                              onChange={(e) =>
                                setChecksMarcados((prev) => ({
                                  ...prev,
                                  [keyChk]: e.target.checked,
                                }))
                              }
                              style={{
                                width: '14px',
                                height: '14px',
                                marginTop: '2px',
                                accentColor: '#15803d',
                              }}
                            />
                            <span style={{ lineHeight: 1.35, color: '#1e293b' }}>
                              {itemTxt}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  {/* GUIA RÁPIDO DE CONFERÊNCIA (IDADES DOS ANIMAIS E REGRAS DE PAGAMENTO DE NOTAS) */}
                  <div
                    style={{
                      background: '#fff8e1',
                      border: '1px solid #ffe082',
                      padding: '12px',
                      borderRadius: '6px',
                      height: 'fit-content',
                    }}
                  >
                    <strong
                      style={{
                        color: '#d97706',
                        fontSize: '12px',
                        display: 'block',
                        marginBottom: '8px',
                      }}
                    >
                      📋 GUIA RÁPIDO DE CONFERÊNCIA (V98)
                    </strong>
                    <div
                      style={{
                        fontSize: '11px',
                        lineHeight: 1.5,
                        color: '#475569',
                      }}
                    >
                      <strong style={{ color: '#0f172a' }}>
                        🐄 Idades / Fases dos Animais (GTA × NF):
                      </strong>
                      <ul
                        style={{
                          margin: '4px 0 12px 0',
                          paddingLeft: '18px',
                        }}
                      >
                        <li>
                          <b>Bezerro(a):</b> 0 a 12 Meses
                        </li>
                        <li>
                          <b>Novilha (F):</b> 0 a 12 Meses
                        </li>
                        <li>
                          <b>Garrotes:</b> 13 a 24 Meses
                        </li>
                        <li>
                          <b>Reprodutores (M):</b> 36 Meses
                        </li>
                        <li>
                          <b>Matrizes (F):</b> 36 Meses
                        </li>
                      </ul>

                      <strong style={{ color: '#0f172a' }}>
                        🧾 Regras de Pagamento de Notas Fiscais:
                      </strong>
                      <ul style={{ margin: '4px 0 0 0', paddingLeft: '18px' }}>
                        <li>
                          <b>Até R$ 5.000:</b> Obrigatório apenas a NF.
                        </li>
                        <li>
                          <b>De R$ 5.000 a R$ 10.000:</b> Obrigatório
                          comprovante de pag. vinculado à NF.
                        </li>
                        <li>
                          <b>Acima de R$ 10.000:</b> Obrigatório comprovante de
                          pagamento da nota.
                        </li>
                        <li style={{ color: '#b91c1c', fontWeight: 800 }}>
                          ⚠️ Atenção: Notas NÃO podem estar como entrega futura!
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>

              {/* COLUNA DIREITA: RESUMO DA ANÁLISE DO DESEMBOLSO (S567) */}
              <div
                style={{
                  background: '#ffffff',
                  border: '1px solid #cbd5e1',
                  borderTop: '4px solid #15803d',
                  borderRadius: '8px',
                  padding: '14px 16px',
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '8px',
                  }}
                >
                  <strong style={{ fontSize: '12.5px', color: '#15803d' }}>
                    📝 RESUMO AUTOMÁTICO DA ANÁLISE DO DESEMBOLSO (S567)
                  </strong>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    {onRegistrarEventoNoHistorico && (
                      <button
                        type="button"
                        onClick={() => {
                          if (!dadosConf.nome.trim() || !dadosConf.numOp.trim()) {
                            alert(
                              'Informe o Cliente e o Nº da Operação (na Etapa 1 ou no quadro ao lado) antes de lançar no Histórico!'
                            );
                            return;
                          }
                          const valorParaLancar =
                            resumoCalculadoTela.totAutorizadoEstaParcela > 0
                              ? resumoCalculadoTela.totAutorizadoEstaParcela
                              : resumoCalculadoTela.totGeralDesembolsado > 0
                              ? resumoCalculadoTela.totGeralDesembolsado
                              : resumoCalculadoTela.totalOrcamentoGlobal;

                          onRegistrarEventoNoHistorico({
                            cliente: dadosConf.nome.toUpperCase().trim(),
                            op: dadosConf.numOp.toUpperCase().trim(),
                            valor: formatarMoedaBD(valorParaLancar),
                            parcela:
                              numParcelaRealDesemb ||
                              String(parcelaAtivaIdx + 1),
                            situacao: 'Solicitar Desembolso',
                            obs: textoResumoS567Completo,
                          });
                        }}
                        style={{
                          width: 'auto',
                          padding: '5px 10px',
                          fontSize: '11px',
                          fontWeight: 800,
                          background: '#8B1530',
                          color: '#ffffff',
                          border: 'none',
                          borderRadius: '5px',
                          cursor: 'pointer',
                        }}
                        title="Registra automaticamente este evento na Aba 3 (Histórico de Eventos) com o Resumo S567 nas observações"
                      >
                        ⏱️ Lançar no Histórico
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(textoResumoS567Completo);
                        alert(
                          '📋 Resumo S567 copiado para a Área de Transferência!'
                        );
                      }}
                      style={{
                        width: 'auto',
                        padding: '5px 12px',
                        fontSize: '11px',
                        fontWeight: 800,
                        background: '#15803d',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: '5px',
                        cursor: 'pointer',
                      }}
                    >
                      📋 Copiar Resumo S567
                    </button>
                  </div>
                </div>

                <textarea
                  readOnly
                  value={textoResumoS567Completo}
                  style={{
                    flex: 1,
                    width: '100%',
                    minHeight: '380px',
                    fontFamily: 'Consolas, monospace',
                    fontSize: '11.5px',
                    lineHeight: 1.45,
                    padding: '12px',
                    background: '#f8fafc',
                    border: '1px solid #cbd5e1',
                    borderRadius: '6px',
                    resize: 'none',
                  }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* SUBMODAL 1: CONFIRMAR / REVERTER DESEMBOLSO DA PARCELA */}
      {modalDesembParcelaIdx !== null && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.65)',
            zIndex: 999999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              background: '#ffffff',
              width: '520px',
              maxWidth: '95%',
              borderRadius: '8px',
              overflow: 'hidden',
              boxShadow: '0 15px 35px rgba(0,0,0,0.35)',
            }}
          >
            <div
              style={{
                background: '#8B1530',
                color: '#ffffff',
                padding: '12px 18px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontWeight: 800,
              }}
            >
              <span>
                💸 Desembolso da {modalDesembParcelaIdx + 1}ª Parcela (
                {dadosConf.meses[modalDesembParcelaIdx]})
              </span>
              <button
                type="button"
                onClick={() => setModalDesembParcelaIdx(null)}
                style={{
                  width: 'auto',
                  background: 'none',
                  border: 'none',
                  color: '#ffffff',
                  fontSize: '20px',
                  cursor: 'pointer',
                }}
              >
                &times;
              </button>
            </div>

            <div style={{ padding: '18px' }}>
              {dadosConf.desembolsoManual[modalDesembParcelaIdx] ? (
                <div>
                  <p style={{ color: '#b91c1c', fontWeight: 800 }}>
                    ⚠️ Atenção: Esta parcela já consta como Desembolsada.
                  </p>
                  <button
                    type="button"
                    onClick={reverterDesembolsoParcela}
                    style={{
                      width: '100%',
                      padding: '10px',
                      background: '#dc2626',
                      color: '#ffffff',
                      fontWeight: 800,
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                    }}
                  >
                    ↩️ REVERTER DESEMBOLSO (Cancelar Liberação)
                  </button>
                </div>
              ) : (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => confirmarDesembolsoParcela(true)}
                    style={{
                      width: '100%',
                      padding: '10px',
                      background: '#15803d',
                      color: '#ffffff',
                      fontWeight: 800,
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                    }}
                  >
                    ✅ SIM, VALOR COMPROVADO INTEGRALMENTE DESEMBOLSADO
                  </button>

                  <button
                    type="button"
                    onClick={() => setModoParcialAtivo(true)}
                    style={{
                      width: '100%',
                      padding: '10px',
                      background: '#d97706',
                      color: '#ffffff',
                      fontWeight: 800,
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                    }}
                  >
                    ✏️ NÃO, DESEMBOLSADO VALOR MENOR QUE O COMPROVADO
                  </button>

                  {modoParcialAtivo && (
                    <div
                      style={{
                        background: '#f8fafc',
                        border: '1px solid #cbd5e1',
                        borderRadius: '6px',
                        padding: '12px',
                        marginTop: '6px',
                      }}
                    >
                      <strong
                        style={{
                          fontSize: '11.5px',
                          display: 'block',
                          marginBottom: '8px',
                        }}
                      >
                        Informe o valor exato liberado para cada item:
                      </strong>
                      {dadosConf.itens.map((it, iIdx) => {
                        const aut =
                          matrizResultados[iIdx]?.[modalDesembParcelaIdx]
                            ?.autorizadoNestaParcela || 0;
                        return (
                          <div
                            key={iIdx}
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              marginBottom: '6px',
                              fontSize: '11.5px',
                            }}
                          >
                            <span>
                              {it.nome} (Máx: {fmtBRL(aut)})
                            </span>
                            <input
                              type="text"
                              disabled={aut <= 0}
                              value={inputsParciaisStr[iIdx] || '0,00'}
                              onChange={(e) => {
                                const novos = [...inputsParciaisStr];
                                novos[iIdx] = aplicarMascaraMoedaInput(
                                  e.target.value
                                );
                                setInputsParciaisStr(novos);
                              }}
                              style={{ ...inputStyle, width: '150px' }}
                            />
                          </div>
                        );
                      })}
                      <button
                        type="button"
                        onClick={() => confirmarDesembolsoParcela(false)}
                        style={{
                          width: '100%',
                          marginTop: '10px',
                          padding: '8px',
                          background: '#15803d',
                          color: '#ffffff',
                          fontWeight: 800,
                          border: 'none',
                          borderRadius: '5px',
                          cursor: 'pointer',
                        }}
                      >
                        💾 Salvar Desembolso Parcial
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* SUBMODAL 2: GERADOR DO TEXTO CURTO S567 POR PARCELAS SELECIONADAS */}
      {modalS567CurtoAberto && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.65)',
            zIndex: 999999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              background: '#ffffff',
              width: '560px',
              maxWidth: '95%',
              borderRadius: '8px',
              overflow: 'hidden',
              boxShadow: '0 15px 35px rgba(0,0,0,0.35)',
            }}
          >
            <div
              style={{
                background: '#8B1530',
                color: '#ffffff',
                padding: '12px 18px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontWeight: 800,
              }}
            >
              <span>📝 Gerar Texto S567 (Comprovação Financeira por Item)</span>
              <button
                type="button"
                onClick={() => setModalS567CurtoAberto(false)}
                style={{
                  width: 'auto',
                  background: 'none',
                  border: 'none',
                  color: '#ffffff',
                  fontSize: '20px',
                  cursor: 'pointer',
                }}
              >
                &times;
              </button>
            </div>

            <div style={{ padding: '18px' }}>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ fontSize: '11px', fontWeight: 700 }}>
                  ID da Comprovação Financeira (GED):
                </label>
                <input
                  type="text"
                  value={idCompFin}
                  onChange={(e) => setIdCompFin(e.target.value)}
                  placeholder="Ex: 12345678"
                  style={inputStyle}
                />
              </div>

              <strong
                style={{
                  fontSize: '11.5px',
                  display: 'block',
                  marginBottom: '6px',
                }}
              >
                Marque as parcelas desembolsadas que deseja somar no texto:
              </strong>
              <div style={{ marginBottom: '12px' }}>
                {Object.keys(dadosConf.desembolsoManual)
                  .map(Number)
                  .map((pIdx) => (
                    <label
                      key={pIdx}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        fontSize: '12px',
                        marginBottom: '6px',
                        cursor: 'pointer',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={parcelasMarcadasS567.includes(pIdx)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setParcelasMarcadasS567([
                              ...parcelasMarcadasS567,
                              pIdx,
                            ]);
                          } else {
                            setParcelasMarcadasS567(
                              parcelasMarcadasS567.filter((x) => x !== pIdx)
                            );
                          }
                        }}
                        style={{ width: '16px', height: '16px' }}
                      />
                      {pIdx + 1}ª Parcela ({dadosConf.meses[pIdx]})
                    </label>
                  ))}
              </div>

              <button
                type="button"
                onClick={gerarTextoCurtoS567}
                style={{
                  width: '100%',
                  padding: '9px',
                  background: '#8B1530',
                  color: '#ffffff',
                  fontWeight: 800,
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  marginBottom: '12px',
                }}
              >
                ⚡ Gerar Texto de Comprovação S567
              </button>

              {textoS567CurtoGerado && (
                <div>
                  <textarea
                    readOnly
                    rows={6}
                    value={textoS567CurtoGerado}
                    style={{
                      width: '100%',
                      fontFamily: 'Consolas, monospace',
                      fontSize: '12px',
                      padding: '10px',
                      borderRadius: '6px',
                      border: '1px solid #cbd5e1',
                      background: '#f8fafc',
                      marginBottom: '8px',
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(textoS567CurtoGerado);
                      alert('📋 Texto S567 copiado!');
                    }}
                    style={{
                      width: '100%',
                      padding: '8px',
                      background: '#15803d',
                      color: '#ffffff',
                      fontWeight: 800,
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                    }}
                  >
                    📋 Copiar para a Área de Transferência
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* SUBMODAL 3: RELATÓRIO CONSOLIDADO DA CONFERÊNCIA */}
      {modalRelatorioAberto && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.65)',
            zIndex: 999999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              background: '#ffffff',
              width: '760px',
              maxWidth: '95%',
              maxHeight: '88vh',
              borderRadius: '8px',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 15px 35px rgba(0,0,0,0.35)',
            }}
          >
            <div
              style={{
                background: '#8B1530',
                color: '#ffffff',
                padding: '12px 18px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontWeight: 800,
              }}
            >
              <span>📊 Relatório Detalhado da Conferência Financeira</span>
              <button
                type="button"
                onClick={() => setModalRelatorioAberto(false)}
                style={{
                  width: 'auto',
                  background: 'none',
                  border: 'none',
                  color: '#ffffff',
                  fontSize: '20px',
                  cursor: 'pointer',
                }}
              >
                &times;
              </button>
            </div>

            <div style={{ padding: '18px', overflowY: 'auto', flex: 1 }}>
              <div style={{ marginBottom: '12px', fontSize: '13px' }}>
                <div>
                  <strong>👤 Cliente:</strong> {dadosConf.nome}
                </div>
                <div>
                  <strong>📄 CPF:</strong> {dadosConf.cpf} |{' '}
                  <strong>OP:</strong> {dadosConf.numOp || '-'}
                </div>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '12px',
                  marginBottom: '16px',
                }}
              >
                <div
                  style={{
                    background: '#e6f4ea',
                    border: '1px solid #a8dab5',
                    padding: '12px',
                    borderRadius: '6px',
                  }}
                >
                  <div
                    style={{
                      fontSize: '11px',
                      fontWeight: 800,
                      color: '#13652c',
                    }}
                  >
                    💰 VALOR TOTAL DESEMBOLSADO
                  </div>
                  <div
                    style={{
                      fontSize: '18px',
                      fontWeight: 800,
                      color: '#13652c',
                    }}
                  >
                    {fmtBRL(resumoCalculadoTela.totGeralDesembolsado)}
                  </div>
                </div>

                <div
                  style={{
                    background: '#fce8e6',
                    border: '1px solid #f1a8a2',
                    padding: '12px',
                    borderRadius: '6px',
                  }}
                >
                  <div
                    style={{
                      fontSize: '11px',
                      fontWeight: 800,
                      color: '#d93025',
                    }}
                  >
                    ⏳ SALDO PENDENTE P/ CONCLUIR
                  </div>
                  <div
                    style={{
                      fontSize: '18px',
                      fontWeight: 800,
                      color: '#d93025',
                    }}
                  >
                    {fmtBRL(resumoCalculadoTela.totGeralPendente)}
                  </div>
                </div>
              </div>

              {dadosConf.itens.map((it, iIdx) => {
                const orcadoItem = (dadosConf.orcamento[iIdx] || []).reduce(
                  (a, b) => a + (b || 0),
                  0
                );
                let comprovadoItem = 0;
                return (
                  <div
                    key={iIdx}
                    style={{
                      background: '#f8fafc',
                      borderLeft: '4px solid #8B1530',
                      padding: '10px 12px',
                      marginBottom: '10px',
                      borderRadius: '0 6px 6px 0',
                    }}
                  >
                    <div style={{ fontWeight: 800, fontSize: '13px' }}>
                      {it.nome} (Orçado: {fmtBRL(orcadoItem)})
                    </div>
                    <div style={{ marginTop: '6px', fontSize: '12px' }}>
                      {Array.from({ length: dadosConf.qtdParcelas }).map(
                        (_, pIdx) => {
                          const nfs = (
                            dadosConf.comprovacoes[iIdx]?.[pIdx] || []
                          ).filter((v) => v > 0);
                          if (nfs.length === 0) return null;
                          const somaP = nfs.reduce((a, b) => a + b, 0);
                          comprovadoItem += somaP;
                          return (
                            <div key={pIdx} style={{ marginBottom: '4px' }}>
                              <strong style={{ color: '#1d4ed8' }}>
                                {pIdx + 1}ª Parcela:
                              </strong>{' '}
                              {nfs.map((v) => fmtBRL(v)).join(' + ')} ={' '}
                              <strong>{fmtBRL(somaP)}</strong>
                            </div>
                          );
                        }
                      )}
                    </div>
                    <div
                      style={{
                        marginTop: '6px',
                        paddingTop: '6px',
                        borderTop: '1px dashed #cbd5e1',
                        display: 'flex',
                        justifyContent: 'space-between',
                        fontSize: '12px',
                      }}
                    >
                      <span>
                        Total Comprovado (NFs):{' '}
                        <strong>{fmtBRL(comprovadoItem)}</strong>
                      </span>
                      <span
                        style={{
                          color:
                            orcadoItem - comprovadoItem > 0.01
                              ? '#b91c1c'
                              : '#15803d',
                          fontWeight: 800,
                        }}
                      >
                        Falta comprovar:{' '}
                        {fmtBRL(Math.max(0, orcadoItem - comprovadoItem))}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>,
    document.body
  );
}