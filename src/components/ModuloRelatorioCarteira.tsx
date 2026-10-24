'use client';

import React, { useState, useMemo, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { RegistroContratacao, CardKanban } from '@/types/painel';
import {
  parseMoeda,
  formatarMoedaBD,
  isEnquadradoCadaVezMelhor,
} from '@/lib/utils';
import { localizarCardDoClienteNoKanban } from '@/lib/integradorSincronizado';

interface ModuloRelatorioCarteiraProps {
  contratacoes: RegistroContratacao[];
  cardsKanban: CardKanban[];
}

interface ParametrosOficiaisBanco {
  carteira: string;
  categorizacao: string;
  pontuacao: number;
  receitaEstAnual: number;
  gestaoAtivo: number;
  fneContratacao: number;
  fneDesembolso: number;
  // Indicadores (Bloco 2)
  pronafRealizadoOficial: number;
  pronafMetaPeriodo: number;
  pronafMetaAnual: number;
  pronafMetaPontos: number;
  pronafPontosFeitos: number;

  miniRealizadoOficial: number;
  miniMetaPeriodo: number;
  miniMetaAnual: number;
  miniMetaPontos: number;
  miniPontosFeitos: number;

  cvmRealizadoOficial: number;
  cvmMetaPeriodo: number;
  cvmMetaAnual: number;
  cvmMetaPontos: number;
  cvmPontosFeitos: number;

  reembolsoRealizado: number;
  reembolsoMetaPeriodo: number;
  reembolsoMetaPontos: number;
  reembolsoPontosFeitos: number;
}

const STORAGE_KEY_PARAMETROS_CARTEIRA = 'bnb_v2_parametros_oficiais_carteira';

// Valores padrão baseados exatamente no arquivo 1. PLANILHA DE ANÁLISE DA CARTEIRA.xlsx e no PDF
const PARAMETROS_INICIAIS: ParametrosOficiaisBanco = {
  carteira: '3332',
  categorizacao: '1',
  pontuacao: 58.74,
  receitaEstAnual: 0.0226,
  gestaoAtivo: 0.9223,
  fneContratacao: 0.3631,
  fneDesembolso: 1.5933,

  pronafRealizadoOficial: 986005.0,
  pronafMetaPeriodo: 2801400.0,
  pronafMetaAnual: 4060000.0,
  pronafMetaPontos: 9.0,
  pronafPontosFeitos: 3.17,

  miniRealizadoOficial: 287348.0,
  miniMetaPeriodo: 2090700.0,
  miniMetaAnual: 3030000.0,
  miniMetaPontos: 9.0,
  miniPontosFeitos: 0.0,

  cvmRealizadoOficial: 80172.0,
  cvmMetaPeriodo: 1027341.0,
  cvmMetaAnual: 1488900.0,
  cvmMetaPontos: 9.0,
  cvmPontosFeitos: 0.0,

  reembolsoRealizado: 3106838.51,
  reembolsoMetaPeriodo: 4317849.71,
  reembolsoMetaPontos: 10.0,
  reembolsoPontosFeitos: 0.0,
};

export default function ModuloRelatorioCarteira({
  contratacoes,
  cardsKanban,
}: ModuloRelatorioCarteiraProps) {
  const [params, setParams] = useState<ParametrosOficiaisBanco>(PARAMETROS_INICIAIS);
  const [modoEdicaoParametros, setModoEdicaoParametros] = useState(false);
  const [considerarArquivados, setConsiderarArquivados] = useState(false);

  // Carrega os parâmetros salvos localmente
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const salvo = window.localStorage.getItem(STORAGE_KEY_PARAMETROS_CARTEIRA);
      if (salvo) {
        setParams({ ...PARAMETROS_INICIAIS, ...JSON.parse(salvo) });
      }
    } catch {
      // Ignora erro de leitura
    }
  }, []);

  const atualizarParametro = <K extends keyof ParametrosOficiaisBanco>(
    chave: K,
    valor: ParametrosOficiaisBanco[K]
  ) => {
    setParams((prev) => {
      const novo = { ...prev, [chave]: valor };
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(
          STORAGE_KEY_PARAMETROS_CARTEIRA,
          JSON.stringify(novo)
        );
      }
      return novo;
    });
  };

  // =========================================================================
  // MOTOR DE CÁLCULO DO ESTOQUE E REALIZADO A PARTIR DA BASE DE CONTRATAÇÕES
  // Obedece rigorosamente aos 34 pontos do Manual da Planilha da Carteira
  // =========================================================================
  const apuracaoCarteira = useMemo(() => {
    const estoque = {
      pronaf: { AG: 0, CENTRAL: 0, DEVOLVIDO_AG: 0, RENOV_CUSTEIO: 0, total: 0 },
      mini: { AG: 0, CENTRAL: 0, DEVOLVIDO_AG: 0, RENOV_CUSTEIO: 0, total: 0 },
      cvm: { AG: 0, CENTRAL: 0, DEVOLVIDO_AG: 0, RENOV_CUSTEIO: 0, total: 0 },
      pronafA: { AG: 0, CENTRAL: 0, DEVOLVIDO_AG: 0, RENOV_CUSTEIO: 0, total: 0 },
    };

    const realizadoNaBase = {
      pronaf: 0,
      mini: 0,
      cvm: 0,
    };

    let qtdExcluidasLCG = 0;
    let qtdNoEstoque = 0;

    (Array.isArray(contratacoes) ? contratacoes : []).forEach((reg) => {
      const tipoUpper = (reg.tipo || '').toUpperCase().trim();
      // Ponto 11 e 32: Valores de LCGH e LCGA devem ser excluídos
      if (tipoUpper === 'LCGH' || tipoUpper === 'LCGA') {
        qtdExcluidasLCG++;
        return;
      }

      const val = parseMoeda(reg.valor);
      if (val <= 0) return;

      const porteUpper = (reg.porte || '').toUpperCase().trim();
      const isPronafA = porteUpper === 'PRONAF A';
      const isPronafGeral = porteUpper.includes('PRONAF'); // Inclui PRONAF V e PRONAF A
      const isMini = porteUpper === 'MINI';
      // Ponto 5 e Item 7: Enquadramento em FNE Cada Vez Melhor pelos programas 673, 408 ou 406
      const isCVM =
        isPronafGeral &&
        isEnquadradoCadaVezMelhor(reg.programa, reg.cadaVezMelhor);

      // Se já está Contratado, compõe o Realizado da base (MESMO ARQUIVADO! Pois a meta já foi batida)
      if (reg.situacao === 'Contratado') {
        if (isPronafGeral) realizadoNaBase.pronaf += val;
        if (isMini) realizadoNaBase.mini += val;
        if (isCVM) realizadoNaBase.cvm += val;
        return;
      }

      // ITEM 6.1 e 6.3: Para Estoque em Tramitação, verifica se a proposta está ARQUIVADA no Kanban
      const card = localizarCardDoClienteNoKanban(reg, cardsKanban);
      const isArquivado = card?.statusCor === 'roxo';
      
      if (isArquivado && !considerarArquivados) {
        return; // Ignora esta proposta: ela não entra no cálculo de estoque da Agência/Central!
      }

      // Ponto 9 e 10: Propostas em andamento entram no Estoque por Etapa
      qtdNoEstoque++;
      let etapaEstoque: 'AG' | 'CENTRAL' | 'DEVOLVIDO_AG' | 'RENOV_CUSTEIO' = 'AG';

      // Ponto 10: Renovações de custeio mantidas em classificação própria independentemente da providência
      if (tipoUpper.includes('RENOVAÇÃO')) {
        etapaEstoque = 'RENOV_CUSTEIO';
      } else if (reg.situacao === 'Na Central') {
        etapaEstoque = 'CENTRAL';
      } else if (reg.situacao === 'Devolvido AG') {
        etapaEstoque = 'DEVOLVIDO_AG';
      } else {
        // Na Agência ou Com Cliente/Projetista
        etapaEstoque = 'AG';
      }

      // Ponto 12 e 17: FNE PRONAF = PRONAF Convencional + Cada Vez Melhor + PRONAF A
      if (isPronafGeral) {
        estoque.pronaf[etapaEstoque] += val;
        estoque.pronaf.total += val;
      }
      if (isMini) {
        estoque.mini[etapaEstoque] += val;
        estoque.mini.total += val;
      }
      // Ponto 15 e 16: Recortes gerenciais (já estão contidos no PRONAF, destacados separadamente)
      if (isCVM) {
        estoque.cvm[etapaEstoque] += val;
        estoque.cvm.total += val;
      }
      if (isPronafA) {
        estoque.pronafA[etapaEstoque] += val;
        estoque.pronafA.total += val;
      }
    });

    // Ponto 18 e 25: Total Consolidado Correto do Estoque = FNE PRONAF + FNE MINI (Sem duplicar CVM nem PRONAF A)
    const estoqueConsolidadoGeral = estoque.pronaf.total + estoque.mini.total;

    // Ponto 6: % do Período = Realizado / Meta do Período
    const percPeriodoPronaf =
      params.pronafMetaPeriodo > 0
        ? (params.pronafRealizadoOficial / params.pronafMetaPeriodo) * 100
        : 0;
    const percPeriodoMini =
      params.miniMetaPeriodo > 0
        ? (params.miniRealizadoOficial / params.miniMetaPeriodo) * 100
        : 0;
    const percPeriodoCvm =
      params.cvmMetaPeriodo > 0
        ? (params.cvmRealizadoOficial / params.cvmMetaPeriodo) * 100
        : 0;
    const percPeriodoReembolso =
      params.reembolsoMetaPeriodo > 0
        ? (params.reembolsoRealizado / params.reembolsoMetaPeriodo) * 100
        : 0;

    // Ponto 8: Falta Ganhar = Meta de Pontos - Pontos Feitos
    const faltaPontosPronaf = params.pronafMetaPontos - params.pronafPontosFeitos;
    const faltaPontosMini = params.miniMetaPontos - params.miniPontosFeitos;
    const faltaPontosCvm = params.cvmMetaPontos - params.cvmPontosFeitos;
    const faltaPontosReembolso =
      params.reembolsoMetaPontos - params.reembolsoPontosFeitos;

    // Ponto 19 e 20: Falta/Período = Meta do Período - Realizado - Estoque (Negativo = Excedente Potencial)
    const faltaPeriodoPronaf =
      params.pronafMetaPeriodo - params.pronafRealizadoOficial - estoque.pronaf.total;
    const faltaPeriodoMini =
      params.miniMetaPeriodo - params.miniRealizadoOficial - estoque.mini.total;
    const faltaPeriodoCvm =
      params.cvmMetaPeriodo - params.cvmRealizadoOficial - estoque.cvm.total;

    // Ponto 21: Falta/Ano = Meta Anual - Realizado - Estoque
    const faltaAnoPronaf =
      params.pronafMetaAnual - params.pronafRealizadoOficial - estoque.pronaf.total;
    const faltaAnoMini =
      params.miniMetaAnual - params.miniRealizadoOficial - estoque.mini.total;
    const faltaAnoCvm =
      params.cvmMetaAnual - params.cvmRealizadoOficial - estoque.cvm.total;

    // Pontos 22 a 29: Faixas de 100%, 90% e 80% (Somente FNE PRONAF + FNE MINI)
    const metaAnualConsolidada = params.pronafMetaAnual + params.miniMetaAnual;
    const realizadoConsolidado =
      params.pronafRealizadoOficial + params.miniRealizadoOficial;

    const faltaFaixa100 =
      1.0 * metaAnualConsolidada - realizadoConsolidado - estoqueConsolidadoGeral;
    const faltaFaixa90 =
      0.9 * metaAnualConsolidada - realizadoConsolidado - estoqueConsolidadoGeral;
    const faltaFaixa80 =
      0.8 * metaAnualConsolidada - realizadoConsolidado - estoqueConsolidadoGeral;

    return {
      estoque,
      realizadoNaBase,
      qtdExcluidasLCG,
      qtdNoEstoque,
      estoqueConsolidadoGeral,
      percPeriodoPronaf,
      percPeriodoMini,
      percPeriodoCvm,
      percPeriodoReembolso,
      faltaPontosPronaf,
      faltaPontosMini,
      faltaPontosCvm,
      faltaPontosReembolso,
      faltaPeriodoPronaf,
      faltaPeriodoMini,
      faltaPeriodoCvm,
      faltaAnoPronaf,
      faltaAnoMini,
      faltaAnoCvm,
      metaAnualConsolidada,
      realizadoConsolidado,
      faltaFaixa100,
      faltaFaixa90,
      faltaFaixa80,
    };
  }, [contratacoes, params, cardsKanban, considerarArquivados]);

  // Sincroniza o Realizado Oficial com a soma das propostas "Contratado" da aba Contratações
  const puxarRealizadoDaAbaContratacoes = () => {
    setParams((prev) => {
      const novo = {
        ...prev,
        pronafRealizadoOficial: apuracaoCarteira.realizadoNaBase.pronaf,
        miniRealizadoOficial: apuracaoCarteira.realizadoNaBase.mini,
        cvmRealizadoOficial: apuracaoCarteira.realizadoNaBase.cvm,
      };
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(
          STORAGE_KEY_PARAMETROS_CARTEIRA,
          JSON.stringify(novo)
        );
      }
      return novo;
    });
    alert(
      '✅ Valores de "Realizado" atualizados com base nas propostas marcadas como "Contratado" na guia de Contratações!'
    );
  };

  // =========================================================================
  // EXPORTADOR EXCEL (.XLSX) NO MOLDE EXATO DO GERENTE GERAL DA AGÊNCIA
  // =========================================================================
  const exportarPlanilhaGerenteGeral = () => {
    const wb = XLSX.utils.book_new();
    const e = apuracaoCarteira.estoque;

    // Criamos a matriz de 36 linhas x 8 colunas espelhando célula por célula a aba 'MOLDE DO QUADRO'
    const aoa: (string | number | null)[][] = Array.from({ length: 36 }, () =>
      Array(8).fill(null)
    );

    // Linhas 1 a 4: Identificação e Faixas Consolidadas (100%, 90%, 80%)
    aoa[0][0] = 'RELATÓRIO GERAL';
    aoa[1][0] = 'CARTEIRA';
    aoa[1][1] = Number(params.carteira) || params.carteira;
    aoa[1][6] = '≥ 100 %';
    aoa[1][7] = apuracaoCarteira.faltaFaixa100;

    aoa[2][0] = 'CATEGORIZAÇÃO';
    aoa[2][1] = Number(params.categorizacao) || params.categorizacao;
    aoa[2][6] = '≥ 90%';
    aoa[2][7] = apuracaoCarteira.faltaFaixa90;

    aoa[3][6] = '≥ 80%';
    aoa[3][7] = apuracaoCarteira.faltaFaixa80;

    // Linhas 6 e 7: Indicadores Gerais da Agência
    aoa[5][0] = 'PONTUAÇÃO ';
    aoa[5][2] = 'RECEITA EST. ANUAL';
    aoa[5][3] = 'GESTÃO DO ATIVO';
    aoa[5][4] = 'FNE CONTRATAÇÃO';
    aoa[5][6] = 'FNE DESEMBOLSO';

    aoa[6][0] = params.pontuacao;
    aoa[6][2] = params.receitaEstAnual;
    aoa[6][3] = params.gestaoAtivo;
    aoa[6][4] = params.fneContratacao;
    aoa[6][6] = params.fneDesembolso;

    // Linhas 9 a 13: Tabela de Indicadores e Metas
    aoa[8] = [
      'INDICADOR',
      'REALIZADO',
      'META DO PERÍODO ',
      '% DO PERÍODO',
      'META ANUAL',
      'META DE PONTOS',
      'PONTOS FEITOS',
      'FALTA GANHAR',
    ];

    aoa[9] = [
      'FNE PRONAF',
      params.pronafRealizadoOficial,
      params.pronafMetaPeriodo,
      apuracaoCarteira.percPeriodoPronaf / 100,
      params.pronafMetaAnual,
      params.pronafMetaPontos,
      params.pronafPontosFeitos,
      apuracaoCarteira.faltaPontosPronaf,
    ];

    aoa[10] = [
      'FNE MINI',
      params.miniRealizadoOficial,
      params.miniMetaPeriodo,
      apuracaoCarteira.percPeriodoMini / 100,
      params.miniMetaAnual,
      params.miniMetaPontos,
      params.miniPontosFeitos,
      apuracaoCarteira.faltaPontosMini,
    ];

    aoa[11] = [
      'FNE CADA VEZ MELHOR',
      params.cvmRealizadoOficial,
      params.cvmMetaPeriodo,
      apuracaoCarteira.percPeriodoCvm / 100,
      params.cvmMetaAnual,
      params.cvmMetaPontos,
      params.cvmPontosFeitos,
      apuracaoCarteira.faltaPontosCvm,
    ];

    aoa[12] = [
      'REEMBOLSO',
      params.reembolsoRealizado,
      params.reembolsoMetaPeriodo,
      apuracaoCarteira.percPeriodoReembolso / 100,
      '-',
      params.reembolsoMetaPontos,
      params.reembolsoPontosFeitos,
      apuracaoCarteira.faltaPontosReembolso,
    ];

    // Linhas 16 e 17: Cabeçalho do Estoque da Carteira
    aoa[15][0] = 'ESTOQUE DA CARTEIRA';
    aoa[16] = [
      'LOCAL',
      'INDICADOR',
      'R$',
      'TOTAL',
      'FALTA / PERÍODO',
      null,
      'FALTA / ANO',
      null,
    ];

    // Bloco FNE PRONAF (Linhas 18 a 21)
    aoa[17] = [
      'AG',
      'FNE PRONAF',
      e.pronaf.AG,
      e.pronaf.total,
      apuracaoCarteira.faltaPeriodoPronaf,
      null,
      apuracaoCarteira.faltaAnoPronaf,
      null,
    ];
    aoa[18] = ['CENTRAL', null, e.pronaf.CENTRAL, null, null, null, null, null];
    aoa[19] = ['DEVOLVIDO AG', null, e.pronaf.DEVOLVIDO_AG, null, null, null, null, null];
    aoa[20] = ['RENOV. CUSTEIO', null, e.pronaf.RENOV_CUSTEIO, null, null, null, null, null];

    // Bloco FNE MINI (Linhas 23 a 26)
    aoa[22] = [
      'AG',
      'FNE MINI',
      e.mini.AG,
      e.mini.total,
      apuracaoCarteira.faltaPeriodoMini,
      null,
      apuracaoCarteira.faltaAnoMini,
      null,
    ];
    aoa[23] = ['CENTRAL', null, e.mini.CENTRAL, null, null, null, null, null];
    aoa[24] = ['DEVOLVIDO AG', null, e.mini.DEVOLVIDO_AG, null, null, null, null, null];
    aoa[25] = ['RENOV. CUSTEIO', null, e.mini.RENOV_CUSTEIO, null, null, null, null, null];

    // Bloco FNE CADA VEZ MELHOR (Linhas 28 a 31)
    aoa[27] = [
      'AG',
      'FNE CADA VEZ MELHOR',
      e.cvm.AG,
      e.cvm.total,
      apuracaoCarteira.faltaPeriodoCvm,
      null,
      apuracaoCarteira.faltaAnoCvm,
      null,
    ];
    aoa[28] = ['CENTRAL', null, e.cvm.CENTRAL, null, null, null, null, null];
    aoa[29] = ['DEVOLVIDO AG', null, e.cvm.DEVOLVIDO_AG, null, null, null, null, null];
    aoa[30] = ['RENOV. CUSTEIO', null, e.cvm.RENOV_CUSTEIO, null, null, null, null, null];

    // Bloco FNE PRONAF A (Linhas 33 a 36)
    aoa[32] = [
      'AG',
      'FNE PRONAF A',
      e.pronafA.AG,
      e.pronafA.total,
      'MESMOS PARÂMETROS DE FNE PRONAF',
      null,
      'MESMOS PARÂMETROS DE FNE PRONAF',
      null,
    ];
    aoa[33] = ['CENTRAL', null, e.pronafA.CENTRAL, null, null, null, null, null];
    aoa[34] = ['DEVOLVIDO AG', null, e.pronafA.DEVOLVIDO_AG, null, null, null, null, null];
    aoa[35] = ['RENOV. CUSTEIO', null, e.pronafA.RENOV_CUSTEIO, null, null, null, null, null];

    const ws = XLSX.utils.aoa_to_sheet(aoa);

    // Injeta as FÓRMULAS REAIS DO EXCEL nas células exatas do Molde do Gerente Geral
    ws['H2'] = { t: 'n', f: '1*SUM(E10:E11)-SUM(B10:B11)-SUM(D18,D23)', v: apuracaoCarteira.faltaFaixa100 };
    ws['H3'] = { t: 'n', f: '0.9*SUM(E10:E11)-SUM(B10:B11)-SUM(D18,D23)', v: apuracaoCarteira.faltaFaixa90 };
    ws['H4'] = { t: 'n', f: '0.8*SUM(E10:E11)-SUM(B10:B11)-SUM(D18,D23)', v: apuracaoCarteira.faltaFaixa80 };

    ws['D10'] = { t: 'n', f: 'B10/C10', v: apuracaoCarteira.percPeriodoPronaf / 100 };
    ws['D11'] = { t: 'n', f: 'B11/C11', v: apuracaoCarteira.percPeriodoMini / 100 };
    ws['D12'] = { t: 'n', f: 'B12/C12', v: apuracaoCarteira.percPeriodoCvm / 100 };
    ws['D13'] = { t: 'n', f: 'B13/C13', v: apuracaoCarteira.percPeriodoReembolso / 100 };

    ws['H10'] = { t: 'n', f: 'F10-G10', v: apuracaoCarteira.faltaPontosPronaf };
    ws['H11'] = { t: 'n', f: 'F11-G11', v: apuracaoCarteira.faltaPontosMini };
    ws['H12'] = { t: 'n', f: 'F12-G12', v: apuracaoCarteira.faltaPontosCvm };
    ws['H13'] = { t: 'n', f: 'F13-G13', v: apuracaoCarteira.faltaPontosReembolso };

    // Fórmulas do Estoque FNE PRONAF
    ws['D18'] = { t: 'n', f: 'SUM(C18:C21)', v: e.pronaf.total };
    ws['E18'] = { t: 'n', f: 'C10-B10-D18', v: apuracaoCarteira.faltaPeriodoPronaf };
    ws['G18'] = { t: 'n', f: 'E10-B10-D18', v: apuracaoCarteira.faltaAnoPronaf };

    // Fórmulas do Estoque FNE MINI
    ws['D23'] = { t: 'n', f: 'SUM(C23:C26)', v: e.mini.total };
    ws['E23'] = { t: 'n', f: 'C11-B11-D23', v: apuracaoCarteira.faltaPeriodoMini };
    ws['G23'] = { t: 'n', f: 'E11-B11-D23', v: apuracaoCarteira.faltaAnoMini };

    // Fórmulas do Estoque FNE CADA VEZ MELHOR
    ws['D28'] = { t: 'n', f: 'SUM(C28:C31)', v: e.cvm.total };
    ws['E28'] = { t: 'n', f: 'C12-B12-D28', v: apuracaoCarteira.faltaPeriodoCvm };
    ws['G28'] = { t: 'n', f: 'E12-B12-D28', v: apuracaoCarteira.faltaAnoCvm };

    // Fórmula do Estoque FNE PRONAF A
    ws['D33'] = { t: 'n', f: 'SUM(C33:C36)', v: e.pronafA.total };

    // Configuração idêntica de células mescladas (Merges) da planilha original
    ws['!merges'] = [
      XLSX.utils.decode_range('A1:H1'),
      XLSX.utils.decode_range('A6:B6'),
      XLSX.utils.decode_range('E6:F6'),
      XLSX.utils.decode_range('G6:H6'),
      XLSX.utils.decode_range('A7:B7'),
      XLSX.utils.decode_range('E7:F7'),
      XLSX.utils.decode_range('G7:H7'),
      XLSX.utils.decode_range('A16:H16'),
      XLSX.utils.decode_range('E17:F17'),
      XLSX.utils.decode_range('G17:H17'),
      XLSX.utils.decode_range('B18:B21'),
      XLSX.utils.decode_range('D18:D21'),
      XLSX.utils.decode_range('E18:F21'),
      XLSX.utils.decode_range('G18:H21'),
      XLSX.utils.decode_range('B23:B26'),
      XLSX.utils.decode_range('D23:D26'),
      XLSX.utils.decode_range('E23:F26'),
      XLSX.utils.decode_range('G23:H26'),
      XLSX.utils.decode_range('B28:B31'),
      XLSX.utils.decode_range('D28:D31'),
      XLSX.utils.decode_range('E28:F31'),
      XLSX.utils.decode_range('G28:H31'),
      XLSX.utils.decode_range('B33:B36'),
      XLSX.utils.decode_range('D33:D36'),
      XLSX.utils.decode_range('E33:F36'),
      XLSX.utils.decode_range('G33:H36'),
    ];

    ws['!cols'] = [
      { wch: 22 },
      { wch: 22 },
      { wch: 18 },
      { wch: 18 },
      { wch: 18 },
      { wch: 16 },
      { wch: 16 },
      { wch: 18 },
    ];

    XLSX.utils.book_append_sheet(wb, ws, 'MOLDE DO QUADRO');
    const hoje = new Date().toISOString().split('T')[0];
    XLSX.writeFile(wb, `PLANILHA_DE_ANALISE_DA_CARTEIRA_${hoje}.xlsx`);
  };

  const renderBlocoEstoque = (
    titulo: string,
    corDestaque: string,
    dados: { AG: number; CENTRAL: number; DEVOLVIDO_AG: number; RENOV_CUSTEIO: number; total: number },
    faltaPeriodo: number | string,
    faltaAno: number | string,
    avisoSubconjunto?: string
  ) => {
    const isNum = typeof faltaPeriodo === 'number' && typeof faltaAno === 'number';
    const excedentePeriodo = isNum && (faltaPeriodo as number) < 0;

    return (
      <div
        className="person-card"
        style={{
          borderLeftColor: corDestaque,
          background: '#fff',
          padding: '16px',
          marginBottom: '15px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <div>
            <strong style={{ color: corDestaque, fontSize: '14px', textTransform: 'uppercase' }}>
              {titulo}
            </strong>
            {avisoSubconjunto && (
              <span
                style={{
                  marginLeft: '10px',
                  fontSize: '11px',
                  background: '#fff3cd',
                  color: '#856404',
                  padding: '2px 8px',
                  borderRadius: '10px',
                  fontWeight: 'bold',
                }}
              >
                ⚠️ {avisoSubconjunto}
              </span>
            )}
          </div>
          <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#555' }}>
            Total do Estoque: <strong style={{ color: '#111', fontSize: '14px' }}>R$ {formatarMoedaBD(dados.total)}</strong>
          </span>
        </div>

        <table className="conf-table" style={{ marginTop: 0 }}>
          <thead>
            <tr>
              <th style={{ width: '160px' }}>LOCAL / ETAPA</th>
              <th>VALOR EM ESTOQUE (R$)</th>
              <th>TOTAL CONSOLIDADO</th>
              <th>FALTA / PERÍODO</th>
              <th>FALTA / ANO</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={{ fontWeight: 'bold', textAlign: 'left', paddingLeft: '12px' }}>AG (Agência / PCE)</td>
              <td style={{ textAlign: 'right', fontWeight: 'bold' }}>R$ {formatarMoedaBD(dados.AG)}</td>
              <td
                rowSpan={4}
                style={{
                  fontWeight: 'bold',
                  fontSize: '15px',
                  background: '#f8fafc',
                  color: 'var(--primary-color)',
                }}
              >
                R$ {formatarMoedaBD(dados.total)}
              </td>
              <td
                rowSpan={4}
                style={{
                  fontWeight: 'bold',
                  fontSize: isNum ? '14px' : '11px',
                  background: excedentePeriodo ? '#e6f4ea' : '#fff',
                  color: isNum
                    ? excedentePeriodo
                      ? '#137333'
                      : '#c62828'
                    : '#666',
                }}
              >
                {isNum ? (
                  <>
                    R$ {formatarMoedaBD(faltaPeriodo as number)}
                    {excedentePeriodo && (
                      <div style={{ fontSize: '10px', marginTop: '4px' }}>
                        ✅ Excedente Potencial
                      </div>
                    )}
                  </>
                ) : (
                  faltaPeriodo
                )}
              </td>
              <td
                rowSpan={4}
                style={{
                  fontWeight: 'bold',
                  fontSize: isNum ? '14px' : '11px',
                  background:
                    isNum && (faltaAno as number) <= 0 ? '#e6f4ea' : '#fff',
                  color: isNum
                    ? (faltaAno as number) <= 0
                      ? '#137333'
                      : '#333'
                    : '#666',
                }}
              >
                {isNum ? `R$ ${formatarMoedaBD(faltaAno as number)}` : faltaAno}
              </td>
            </tr>
            <tr>
              <td style={{ fontWeight: 'bold', textAlign: 'left', paddingLeft: '12px' }}>CENTRAL (S522)</td>
              <td style={{ textAlign: 'right', fontWeight: 'bold' }}>R$ {formatarMoedaBD(dados.CENTRAL)}</td>
            </tr>
            <tr>
              <td style={{ fontWeight: 'bold', textAlign: 'left', paddingLeft: '12px' }}>DEVOLVIDO AG</td>
              <td style={{ textAlign: 'right', fontWeight: 'bold' }}>R$ {formatarMoedaBD(dados.DEVOLVIDO_AG)}</td>
            </tr>
            <tr>
              <td style={{ fontWeight: 'bold', textAlign: 'left', paddingLeft: '12px' }}>RENOV. CUSTEIO</td>
              <td style={{ textAlign: 'right', fontWeight: 'bold' }}>R$ {formatarMoedaBD(dados.RENOV_CUSTEIO)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: '20px', background: '#f4f7f9' }}>
      <div style={{ maxWidth: '1250px', margin: '0 auto' }}>
        {/* BARRA DE COMANDO DO RELATÓRIO DO GERENTE GERAL (DESIGN EXECUTIVO COMPACTO) */}
        <div
          className="person-card"
          style={{
            borderLeftColor: 'var(--primary-color)',
            background: '#ffffff',
            padding: '12px 18px',
            marginBottom: '15px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          {/* Título e Subtítulo Informativo */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <h2
                style={{
                  margin: 0,
                  color: 'var(--primary-color)',
                  fontSize: '15px',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: '0.2px',
                }}
              >
                📑 PLANILHA DE ANÁLISE DA CARTEIRA
              </h2>
              <span
                style={{
                  fontSize: '10.5px',
                  fontWeight: 700,
                  background: '#fdf2f4',
                  color: 'var(--primary-color)',
                  border: '1px solid #f5c2c7',
                  padding: '2px 8px',
                  borderRadius: '12px',
                  textTransform: 'uppercase',
                }}
              >
                Visão GG
              </span>
            </div>
            
          </div>

          {/* Toolbar de Ações Compacta e Alinhada */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              flexWrap: 'wrap',
            }}
          >
            <label
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                width: 'auto',
                height: '32px',
                padding: '0 12px',
                background: considerarArquivados ? '#f3e8ff' : '#f8fafc',
                color: considerarArquivados ? '#6b21a8' : '#475569',
                border: `1px solid ${considerarArquivados ? '#d8b4fe' : '#cbd5e1'}`,
                borderRadius: '6px',
                fontSize: '11.5px',
                fontWeight: 600,
                cursor: 'pointer',
                margin: 0,
                whiteSpace: 'nowrap',
                userSelect: 'none',
                transition: 'all 0.15s ease',
              }}
              title="Se marcado, inclui as propostas arquivadas no cálculo de estoque."
            >
              <input
                type="checkbox"
                checked={considerarArquivados}
                onChange={(e) => setConsiderarArquivados(e.target.checked)}
                style={{
                  width: '13px',
                  height: '13px',
                  margin: 0,
                  padding: 0,
                  cursor: 'pointer',
                  accentColor: '#7e22ce',
                }}
              />
              📦 Considerar Arquivados?
            </label>

            <button
              type="button"
              onClick={puxarRealizadoDaAbaContratacoes}
              style={{
                width: 'auto',
                height: '32px',
                padding: '0 12px',
                background: '#eff6ff',
                color: '#1d4ed8',
                border: '1px solid #bfdbfe',
                borderRadius: '6px',
                fontSize: '11.5px',
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                whiteSpace: 'nowrap',
                cursor: 'pointer',
              }}
              title="Substitui o Realizado Oficial pela soma das propostas com status Contratado na aba Contratações"
            >
              ⚡ Puxar &quot;Realizado&quot;
            </button>

            <button
              type="button"
              onClick={() => setModoEdicaoParametros((prev) => !prev)}
              style={{
                width: 'auto',
                height: '32px',
                padding: '0 12px',
                background: modoEdicaoParametros ? 'var(--accent-color)' : '#ffffff',
                color: modoEdicaoParametros ? '#ffffff' : '#334155',
                border: `1px solid ${modoEdicaoParametros ? 'var(--accent-color)' : '#cbd5e1'}`,
                borderRadius: '6px',
                fontSize: '11.5px',
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                whiteSpace: 'nowrap',
                cursor: 'pointer',
              }}
            >
              ⚙️ {modoEdicaoParametros ? 'Concluir Edição' : 'Editar Metas / Banco'}
            </button>

            <button
              type="button"
              onClick={exportarPlanilhaGerenteGeral}
              style={{
                width: 'auto',
                height: '32px',
                padding: '0 14px',
                background: '#15803d',
                color: '#ffffff',
                border: '1px solid #166534',
                borderRadius: '6px',
                fontSize: '11.5px',
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                whiteSpace: 'nowrap',
                cursor: 'pointer',
                boxShadow: '0 1px 2px rgba(0,0,0,0.08)',
              }}
            >
              📊 Exportar (.XLSX)
            </button>
          </div>
        </div>

        {/* BLOCO 1: IDENTIFICAÇÃO, DESEMPENHO E FAIXAS DE 100%, 90% E 80% */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '15px', marginBottom: '15px' }}>
          <div className="person-card" style={{ background: '#fff', marginBottom: 0 }}>
            <strong style={{ color: 'var(--primary-color)', fontSize: '13px', display: 'block', marginBottom: '10px', textTransform: 'uppercase' }}>
              🏦 1. Identificação e Desempenho Corporativo
            </strong>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
              <div style={{ background: '#f8fafc', padding: '10px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 'bold' }}>CARTEIRA / CATEG.</div>
                {modoEdicaoParametros ? (
                  <div style={{ display: 'flex', gap: '5px', marginTop: '4px' }}>
                    <input value={params.carteira} onChange={(e) => atualizarParametro('carteira', e.target.value)} style={{ padding: '4px', fontSize: '12px' }} />
                    <input value={params.categorizacao} onChange={(e) => atualizarParametro('categorizacao', e.target.value)} style={{ padding: '4px', fontSize: '12px', width: '50px' }} />
                  </div>
                ) : (
                  <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#333' }}>
                    {params.carteira} <span style={{ fontSize: '12px', color: 'var(--primary-color)' }}>(Nível {params.categorizacao})</span>
                  </div>
                )}
              </div>

              <div style={{ background: '#f8fafc', padding: '10px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 'bold' }}>PONTUAÇÃO ATUAL</div>
                {modoEdicaoParametros ? (
                  <input type="number" step="0.01" value={params.pontuacao} onChange={(e) => atualizarParametro('pontuacao', parseFloat(e.target.value) || 0)} style={{ padding: '4px', fontSize: '12px', marginTop: '4px' }} />
                ) : (
                  <div style={{ fontSize: '16px', fontWeight: 'bold', color: 'var(--primary-color)' }}>
                    {params.pontuacao.toFixed(2)} pts
                  </div>
                )}
              </div>

              <div style={{ background: '#f8fafc', padding: '10px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 'bold' }}>ESTOQUE CONSOLIDADO (PRONAF+MINI)</div>
                <div style={{ fontSize: '15px', fontWeight: 'bold', color: '#137333' }}>
                  R$ {formatarMoedaBD(apuracaoCarteira.estoqueConsolidadoGeral)}
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginTop: '10px' }}>
              <div style={{ background: '#fff', padding: '6px 8px', borderRadius: '4px', border: '1px solid #eee', fontSize: '11px' }}>
                <span style={{ color: '#666', display: 'block', fontSize: '10px' }}>RECEITA EST. ANUAL</span>
                <strong>{(params.receitaEstAnual * 100).toFixed(2)}%</strong>
              </div>
              <div style={{ background: '#fff', padding: '6px 8px', borderRadius: '4px', border: '1px solid #eee', fontSize: '11px' }}>
                <span style={{ color: '#666', display: 'block', fontSize: '10px' }}>GESTÃO DO ATIVO</span>
                <strong>{(params.gestaoAtivo * 100).toFixed(2)}%</strong>
              </div>
              <div style={{ background: '#fff', padding: '6px 8px', borderRadius: '4px', border: '1px solid #eee', fontSize: '11px' }}>
                <span style={{ color: '#666', display: 'block', fontSize: '10px' }}>FNE CONTRATAÇÃO</span>
                <strong>{(params.fneContratacao * 100).toFixed(2)}%</strong>
              </div>
              <div style={{ background: '#fff', padding: '6px 8px', borderRadius: '4px', border: '1px solid #eee', fontSize: '11px' }}>
                <span style={{ color: '#666', display: 'block', fontSize: '10px' }}>FNE DESEMBOLSO</span>
                <strong>{(params.fneDesembolso * 100).toFixed(2)}%</strong>
              </div>
            </div>
          </div>

          {/* FAIXAS DE META ANUAL CONSOLIDADA (PRONAF + MINI) */}
          <div className="person-card" style={{ borderLeftColor: 'var(--accent-color)', background: '#fff', marginBottom: 0 }}>
            <strong style={{ color: 'var(--primary-color)', fontSize: '13px', display: 'block', marginBottom: '8px', textTransform: 'uppercase' }}>
              🎯 Faixas de Cumprimento Anual (PRONAF + MINI = R$ {formatarMoedaBD(apuracaoCarteira.metaAnualConsolidada)})
            </strong>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {[
                { label: '≥ 100% da Meta Anual', valor: apuracaoCarteira.faltaFaixa100 },
                { label: '≥ 90% da Meta Anual', valor: apuracaoCarteira.faltaFaixa90 },
                { label: '≥ 80% da Meta Anual', valor: apuracaoCarteira.faltaFaixa80 },
              ].map((faixa) => {
                const superada = faixa.valor <= 0;
                return (
                  <div
                    key={faixa.label}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      background: superada ? '#e6f4ea' : '#fff8e1',
                      border: `1px solid ${superada ? '#a8dab5' : '#ffe082'}`,
                    }}
                  >
                    <span style={{ fontWeight: 'bold', fontSize: '12px', color: '#333' }}>
                      {faixa.label}
                    </span>
                    <span
                      style={{
                        fontWeight: 'bold',
                        fontSize: '14px',
                        color: superada ? '#137333' : '#b06000',
                      }}
                    >
                      {superada ? '✅ Faixa Superada (' : 'Falta: '}R$ {formatarMoedaBD(faixa.valor)}
                      {superada ? ')' : ''}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* BLOCO 2: TABELA DE INDICADORES E METAS */}
        <div className="person-card" style={{ background: '#fff' }}>
          <strong style={{ color: 'var(--primary-color)', fontSize: '14px', display: 'block', marginBottom: '10px', textTransform: 'uppercase' }}>
            📈 2. Indicadores, Metas e Pontuação
          </strong>
          <div style={{ overflowX: 'auto' }}>
            <table className="conf-table">
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', paddingLeft: '12px' }}>INDICADOR</th>
                  <th>REALIZADO (R$)</th>
                  <th>META DO PERÍODO (R$)</th>
                  <th>% DO PERÍODO</th>
                  <th>META ANUAL (R$)</th>
                  <th>META DE PONTOS</th>
                  <th>PONTOS FEITOS</th>
                  <th>FALTA GANHAR</th>
                </tr>
              </thead>
              <tbody>
                {/* FNE PRONAF */}
                <tr>
                  <td style={{ fontWeight: 'bold', textAlign: 'left', paddingLeft: '12px' }}>FNE PRONAF (Consolidado)</td>
                  <td style={{ textAlign: 'right', fontWeight: 'bold' }}>
                    {modoEdicaoParametros ? (
                      <input type="number" step="0.01" value={params.pronafRealizadoOficial} onChange={(e) => atualizarParametro('pronafRealizadoOficial', parseFloat(e.target.value) || 0)} />
                    ) : (
                      `R$ ${formatarMoedaBD(params.pronafRealizadoOficial)}`
                    )}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    {modoEdicaoParametros ? (
                      <input type="number" step="0.01" value={params.pronafMetaPeriodo} onChange={(e) => atualizarParametro('pronafMetaPeriodo', parseFloat(e.target.value) || 0)} />
                    ) : (
                      `R$ ${formatarMoedaBD(params.pronafMetaPeriodo)}`
                    )}
                  </td>
                  <td style={{ fontWeight: 'bold', color: 'var(--primary-color)' }}>
                    {apuracaoCarteira.percPeriodoPronaf.toFixed(2)}%
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    {modoEdicaoParametros ? (
                      <input type="number" step="0.01" value={params.pronafMetaAnual} onChange={(e) => atualizarParametro('pronafMetaAnual', parseFloat(e.target.value) || 0)} />
                    ) : (
                      `R$ ${formatarMoedaBD(params.pronafMetaAnual)}`
                    )}
                  </td>
                  <td>{params.pronafMetaPontos.toFixed(2)}</td>
                  <td>
                    {modoEdicaoParametros ? (
                      <input type="number" step="0.01" value={params.pronafPontosFeitos} onChange={(e) => atualizarParametro('pronafPontosFeitos', parseFloat(e.target.value) || 0)} />
                    ) : (
                      params.pronafPontosFeitos.toFixed(2)
                    )}
                  </td>
                  <td style={{ fontWeight: 'bold' }}>{apuracaoCarteira.faltaPontosPronaf.toFixed(2)}</td>
                </tr>

                {/* FNE MINI */}
                <tr>
                  <td style={{ fontWeight: 'bold', textAlign: 'left', paddingLeft: '12px' }}>FNE MINI</td>
                  <td style={{ textAlign: 'right', fontWeight: 'bold' }}>
                    {modoEdicaoParametros ? (
                      <input type="number" step="0.01" value={params.miniRealizadoOficial} onChange={(e) => atualizarParametro('miniRealizadoOficial', parseFloat(e.target.value) || 0)} />
                    ) : (
                      `R$ ${formatarMoedaBD(params.miniRealizadoOficial)}`
                    )}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    {modoEdicaoParametros ? (
                      <input type="number" step="0.01" value={params.miniMetaPeriodo} onChange={(e) => atualizarParametro('miniMetaPeriodo', parseFloat(e.target.value) || 0)} />
                    ) : (
                      `R$ ${formatarMoedaBD(params.miniMetaPeriodo)}`
                    )}
                  </td>
                  <td style={{ fontWeight: 'bold', color: 'var(--primary-color)' }}>
                    {apuracaoCarteira.percPeriodoMini.toFixed(2)}%
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    {modoEdicaoParametros ? (
                      <input type="number" step="0.01" value={params.miniMetaAnual} onChange={(e) => atualizarParametro('miniMetaAnual', parseFloat(e.target.value) || 0)} />
                    ) : (
                      `R$ ${formatarMoedaBD(params.miniMetaAnual)}`
                    )}
                  </td>
                  <td>{params.miniMetaPontos.toFixed(2)}</td>
                  <td>
                    {modoEdicaoParametros ? (
                      <input type="number" step="0.01" value={params.miniPontosFeitos} onChange={(e) => atualizarParametro('miniPontosFeitos', parseFloat(e.target.value) || 0)} />
                    ) : (
                      params.miniPontosFeitos.toFixed(2)
                    )}
                  </td>
                  <td style={{ fontWeight: 'bold' }}>{apuracaoCarteira.faltaPontosMini.toFixed(2)}</td>
                </tr>

                {/* FNE CADA VEZ MELHOR */}
                <tr style={{ background: '#fff9fb' }}>
                  <td style={{ fontWeight: 'bold', textAlign: 'left', paddingLeft: '12px', color: '#ad1457' }}>
                    FNE CADA VEZ MELHOR 
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 'bold' }}>
                    {modoEdicaoParametros ? (
                      <input type="number" step="0.01" value={params.cvmRealizadoOficial} onChange={(e) => atualizarParametro('cvmRealizadoOficial', parseFloat(e.target.value) || 0)} />
                    ) : (
                      `R$ ${formatarMoedaBD(params.cvmRealizadoOficial)}`
                    )}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    {modoEdicaoParametros ? (
                      <input type="number" step="0.01" value={params.cvmMetaPeriodo} onChange={(e) => atualizarParametro('cvmMetaPeriodo', parseFloat(e.target.value) || 0)} />
                    ) : (
                      `R$ ${formatarMoedaBD(params.cvmMetaPeriodo)}`
                    )}
                  </td>
                  <td style={{ fontWeight: 'bold', color: '#ad1457' }}>
                    {apuracaoCarteira.percPeriodoCvm.toFixed(2)}%
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    {modoEdicaoParametros ? (
                      <input type="number" step="0.01" value={params.cvmMetaAnual} onChange={(e) => atualizarParametro('cvmMetaAnual', parseFloat(e.target.value) || 0)} />
                    ) : (
                      `R$ ${formatarMoedaBD(params.cvmMetaAnual)}`
                    )}
                  </td>
                  <td>{params.cvmMetaPontos.toFixed(2)}</td>
                  <td>
                    {modoEdicaoParametros ? (
                      <input type="number" step="0.01" value={params.cvmPontosFeitos} onChange={(e) => atualizarParametro('cvmPontosFeitos', parseFloat(e.target.value) || 0)} />
                    ) : (
                      params.cvmPontosFeitos.toFixed(2)
                    )}
                  </td>
                  <td style={{ fontWeight: 'bold' }}>{apuracaoCarteira.faltaPontosCvm.toFixed(2)}</td>
                </tr>

                {/* REEMBOLSO */}
                <tr>
                  <td style={{ fontWeight: 'bold', textAlign: 'left', paddingLeft: '12px' }}>REEMBOLSO</td>
                  <td style={{ textAlign: 'right', fontWeight: 'bold' }}>
                    {modoEdicaoParametros ? (
                      <input type="number" step="0.01" value={params.reembolsoRealizado} onChange={(e) => atualizarParametro('reembolsoRealizado', parseFloat(e.target.value) || 0)} />
                    ) : (
                      `R$ ${formatarMoedaBD(params.reembolsoRealizado)}`
                    )}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    {modoEdicaoParametros ? (
                      <input type="number" step="0.01" value={params.reembolsoMetaPeriodo} onChange={(e) => atualizarParametro('reembolsoMetaPeriodo', parseFloat(e.target.value) || 0)} />
                    ) : (
                      `R$ ${formatarMoedaBD(params.reembolsoMetaPeriodo)}`
                    )}
                  </td>
                  <td style={{ fontWeight: 'bold', color: 'var(--primary-color)' }}>
                    {apuracaoCarteira.percPeriodoReembolso.toFixed(2)}%
                  </td>
                  <td style={{ color: '#999' }}>Não informado</td>
                  <td>{params.reembolsoMetaPontos.toFixed(2)}</td>
                  <td>
                    {modoEdicaoParametros ? (
                      <input type="number" step="0.01" value={params.reembolsoPontosFeitos} onChange={(e) => atualizarParametro('reembolsoPontosFeitos', parseFloat(e.target.value) || 0)} />
                    ) : (
                      params.reembolsoPontosFeitos.toFixed(2)
                    )}
                  </td>
                  <td style={{ fontWeight: 'bold' }}>{apuracaoCarteira.faltaPontosReembolso.toFixed(2)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* BLOCO 3: ESTOQUE DA CARTEIRA POR ETAPA E SUBCONJUNTOS */}
        {renderBlocoEstoque(
          '1. Estoque Consolidado — FNE PRONAF (Inclui Convencional + Cada Vez Melhor + PRONAF A)',
          'var(--primary-color)',
          apuracaoCarteira.estoque.pronaf,
          apuracaoCarteira.faltaPeriodoPronaf,
          apuracaoCarteira.faltaAnoPronaf
        )}

        {renderBlocoEstoque(
          '2. Estoque Consolidado — FNE MINI',
          '#1967d2',
          apuracaoCarteira.estoque.mini,
          apuracaoCarteira.faltaPeriodoMini,
          apuracaoCarteira.faltaAnoMini
        )}

        {renderBlocoEstoque(
          '3. Destaque Gerencial — FNE CADA VEZ MELHOR (Mulheres PRONAF)',
          '#ad1457',
          apuracaoCarteira.estoque.cvm,
          apuracaoCarteira.faltaPeriodoCvm,
          apuracaoCarteira.faltaAnoCvm,
          'Já incluído no FNE PRONAF (Não somado novamente ao consolidado)'
        )}

        {renderBlocoEstoque(
          '4. Destaque Gerencial — FNE PRONAF A',
          '#e65100',
          apuracaoCarteira.estoque.pronafA,
          'MESMOS PARÂMETROS DE FNE PRONAF',
          'MESMOS PARÂMETROS DE FNE PRONAF',
          'Já incluído no FNE PRONAF (Não somado novamente ao consolidado)'
        )}
      </div>
    </div>
  );
}