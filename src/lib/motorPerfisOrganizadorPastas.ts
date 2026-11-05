// src/lib/motorPerfisOrganizadorPastas.ts
import { ItemConformidadePronafA } from '@/components/ferramentas/ModalConformidadePronafA';

export type PorteOrganizador = 'PRONAF_A' | 'PRONAF_V' | 'MINI_PEQUENO';

export type EscopoOperacaoPasta =
  | 'PRONAF_A_PADRAO'
  | 'DERIVADA_PURA'
  | 'LIMITE_PURO'
  | 'COMBO_DERIVADA_E_LIMITE';

export type ModalidadeDerivada = 'INVESTIMENTO' | 'CUSTEIO';
export type ModalidadeLimite = 'LCGH' | 'LCGA';
export type GarantiaDerivada = 'AVAL' | 'LCGH_LCGA' | 'SEM_GARANTIA';

export interface ConfiguracaoPerfilPasta {
  porte: PorteOrganizador;
  escopo: EscopoOperacaoPasta;
  modalidadeDerivada: ModalidadeDerivada;
  modalidadeLimite: ModalidadeLimite;
  garantiaDerivada: GarantiaDerivada;
  imovelAvaliadoAcima600k: boolean;
  titularNome: string;
  conjugeNome: string;
  procuradorNome: string;
  avalistaNome: string;
  projetistaNome: string;
  paOuImovelNome: string;
}

export type CategoriaDocPasta =
  | 'IGNORAR'
  | 'ITEM_ARQ_ELETRONICO_PROJETO'
  | 'ITEM_PROJETO_PDF'
  | 'ITEM_CAPA_ANALISADOR'
  | 'ITEM_KML'
  | 'ITEM_PLANILHA_GEODESICA'
  | 'ITEM_CAF'
  | 'ITEM_EXTRATO_CAF'
  | 'ITEM_CAR'
  | 'ITEM_CONSULTA_CAR'
  | 'ITEM_AUT_ALTERACAO'
  | 'ITEM_EMBARGOS_TITULAR'
  | 'ITEM_EMBARGOS_CONJUGE'
  | 'ITEM_IMPROBIDADE_TITULAR'
  | 'ITEM_IMPROBIDADE_CONJUGE'
  | 'ITEM_CND_PF'
  | 'ITEM_CNDT_PF'
  | 'ITEM_EXTRATO_SICOR'
  | 'ITEM_CERT_SOCIO_COM_KML'
  | 'ITEM_CERT_SOCIO_SEM_KML'
  | 'ITEM_CREA'
  | 'ITEM_CONTRATO_ASSESSORIA'
  | 'ITEM_CCIR'
  | 'ITEM_CND_ITR_IMOVEL'
  | 'ITEM_LAUDO_EXTERNO'
  | 'ITEM_LAUDO_INTERNO'
  | 'ITEM_DCAA'
  | 'ITEM_FICHA_SANITARIA'
  | 'ITEM_ORCAMENTO'
  | 'ITEM_CONSOLIDADAS'
  | 'ITEM_DEC_AMBIENTAIS'
  | 'ITEM_DEC_REG_AMBIENTAL'
  | 'ITEM_DEC_NAO_DESMATAMENTO'
  | 'ITEM_DEC_RECOMPOSICAO'
  | 'ITEM_DEC_REG_AMB_GARANTIDOR'
  | 'ITEM_DEC_OUTRA_AMBIENTAL'
  | 'ITEM_TITULO_DOMINIO'
  | 'ITEM_INTEIRO_TEOR'
  | 'ITEM_PLANO_ATIVIDADE_RURAL'
  | 'ITEM_PARECER_TECNICO'
  | 'ITEM_PARECER_GERENCIAL'
  | 'ITEM_ESPELHO_UND'
  | 'ITEM_RB_PA'
  | 'ITEM_PARECER_SEMA'
  | 'ITEM_SOLICITACAO_LIMITE'
  // Subpasta CADASTRO
  | 'CAD_1_IDENTIDADE_TITULAR'
  | 'CAD_1_IDENTIDADE_CONJUGE'
  | 'CAD_1_IDENTIDADE_OUTRO'
  | 'CAD_2_CERTIDAO_CASAMENTO'
  | 'CAD_3_COMP_ENDERECO'
  | 'CAD_4_COMP_RENDA'
  | 'CAD_5_PROPOSTA_CADASTRO'
  | 'CAD_6_PROCURACAO'
  | 'CAD_8_SELO_CARTORIO'
  | 'CAD_9_OUTROS_CADASTRO';

export const CATEGORIAS_QUE_ACEITAM_VITI = new Set<CategoriaDocPasta>([
  'ITEM_PROJETO_PDF',
  'ITEM_AUT_ALTERACAO',
  'ITEM_CONTRATO_ASSESSORIA',
  'ITEM_ORCAMENTO',
  'ITEM_CONSOLIDADAS',
  'ITEM_DEC_AMBIENTAIS',
  'ITEM_DEC_REG_AMBIENTAL',
  'ITEM_DEC_NAO_DESMATAMENTO',
  'ITEM_DEC_RECOMPOSICAO',
  'ITEM_DEC_REG_AMB_GARANTIDOR',
  'ITEM_DEC_OUTRA_AMBIENTAL',
  'ITEM_PARECER_TECNICO',
  'ITEM_SOLICITACAO_LIMITE',
  'ITEM_LAUDO_EXTERNO',
  'ITEM_PLANO_ATIVIDADE_RURAL',
  'CAD_5_PROPOSTA_CADASTRO',
]);

export interface DestinoArquivoCalculado {
  pastaRelativa: string; // '' = Raiz, 'CADASTRO', 'CERTIFICAÇÃO SOCIOAMBIENTAL', 'LCGH', 'LCGH/CERTIFICAÇÃO SOCIOAMBIENTAL', 'INVESTIMENTO', etc.
  nomeArquivoFinal: string;
  ordemExibicao: number;
}

export interface LembreteTxtCalculado {
  pastaRelativa: string;
  nomeArquivoTxt: string;
}

function removerAcentos(str: string): string {
  return (str || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export function extrairPrimeiroNome(nomeCompleto: string): string {
  const limpo = (nomeCompleto || '').trim().toUpperCase();
  if (!limpo) return '';
  return limpo.split(/\s+/)[0];
}

export function isArquivoParecerGerencialReal(nomeArquivo: string): boolean {
  const norm = removerAcentos(nomeArquivo).toUpperCase().trim();
  if (!norm.includes('PARECER GERENCIAL')) return false;
  if (norm.includes('FALTA PARECER GERENCIAL')) return false;
  return true;
}

export function obterNomesCurtosDesambiguados(params: {
  titularCompleto: string;
  conjugeCompleto: string;
  procuradorCompleto: string;
  avalistaCompleto: string;
}) {
  const pTit = extrairPrimeiroNome(params.titularCompleto) || 'CLIENTE';
  const pConj = extrairPrimeiroNome(params.conjugeCompleto);
  const pProc = extrairPrimeiroNome(params.procuradorCompleto);
  const pAval = extrairPrimeiroNome(params.avalistaCompleto);

  const todos = [pTit, pConj, pProc, pAval].filter(Boolean);
  const contagem: Record<string, number> = {};
  todos.forEach((n) => {
    contagem[n] = (contagem[n] || 0) + 1;
  });

  return {
    titular: contagem[pTit] > 1 ? `${pTit} (TITULAR)` : pTit,
    conjuge: pConj ? (contagem[pConj] > 1 ? `${pConj} (CÔNJUGE)` : pConj) : '',
    procurador: pProc
      ? contagem[pProc] > 1
        ? `${pProc} (PROCURADOR)`
        : pProc
      : '',
    avalista: pAval ? (contagem[pAval] > 1 ? `${pAval} (AVALISTA)` : pAval) : '',
  };
}

// ============================================================================
// RECONHECIMENTO AUTOMÁTICO UNIVERSAL DE ARQUIVOS (TODOS OS PORTES E TIPOS)
// ============================================================================
export function classificarArquivoUniversal(
  nomeArquivo: string,
  primeiroNomeTitular: string,
  primeiroNomeConjuge: string,
  escopoAtual: EscopoOperacaoPasta
): {
  categoria: CategoriaDocPasta;
  isViti: boolean;
  subtipoAmbientalExtra?: string;
} {
  const semExt = nomeArquivo.replace(/\.[^/.]+$/, '');
  const ext = (nomeArquivo.split('.').pop() || '').toUpperCase();
  const norm = removerAcentos(semExt)
    .toUpperCase()
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (ext === 'TXT') {
    if (isArquivoParecerGerencialReal(nomeArquivo)) {
      return { categoria: 'ITEM_PARECER_GERENCIAL', isViti: false };
    }
    return { categoria: 'IGNORAR', isViti: false };
  }

  // 1. Arquivo KML Geodésico
  if (ext === 'KML' || ext === 'KMZ') {
    return { categoria: 'ITEM_KML', isViti: false };
  }

  // 2. Planilha de Coordenadas Geodésicas (Custeio)
  if (
    norm.includes('COORDENADAS') ||
    norm.includes('GEODESICA') ||
    norm.includes('GLEBAS') ||
    ((ext === 'XLSX' || ext === 'XLS' || ext === 'CSV') &&
      !norm.includes('ORCAMENTO'))
  ) {
    return { categoria: 'ITEM_PLANILHA_GEODESICA', isViti: false };
  }

  // 3. Arquivo Eletrônico do Projeto (.PRONAF, .INVUR, .CUSTEIOPECUARIO, .INV, .CUST)
  if (
    ext.includes('PRONAF') ||
    ext.includes('INVUR') ||
    ext.includes('CUSTEIO') ||
    ext === 'INV' ||
    ext === 'CUST' ||
    nomeArquivo.toUpperCase().includes('.PRONAF') ||
    nomeArquivo.toUpperCase().includes('.INVUR') ||
    nomeArquivo.toUpperCase().includes('.CUSTEIO')
  ) {
    return { categoria: 'ITEM_ARQ_ELETRONICO_PROJETO', isViti: false };
  }

  const pareceVitiPeloNome =
    /^(RELATORIO|VITI)\b/.test(norm) ||
    /^\d+(\.\d+)?\.?\s*VITI\b/.test(norm) ||
    norm.includes('VALIDACAO ITI');

  const miolo = norm
    .replace(/^RELATORIO\s*[-–]?\s*/, '')
    .replace(/^\d+(\.\d+)?\s*[.\-–]\s*VITI\s*[-–]?\s*/, '')
    .replace(/^VITI\s*[-–]?\s*/, '')
    .replace(/^\d+(\.\d+)?\s*[.\-–]\s*/, '')
    .trim();

  const mencionaConjuge = Boolean(
    primeiroNomeConjuge &&
      primeiroNomeConjuge.length > 2 &&
      new RegExp(
        `\\b${removerAcentos(primeiroNomeConjuge).toUpperCase()}\\b`
      ).test(miolo)
  );

  const finalizar = (
    categoria: CategoriaDocPasta,
    subtipoAmbientalExtra?: string
  ) => ({
    categoria,
    isViti: pareceVitiPeloNome && CATEGORIAS_QUE_ACEITAM_VITI.has(categoria),
    subtipoAmbientalExtra,
  });

  // 4. Itens Específicos de Cadastro
  if (
    miolo.includes('PROPOSTA DE CADASTRO') ||
    miolo.includes('FICHA CADASTRAL')
  ) {
    return finalizar('CAD_5_PROPOSTA_CADASTRO');
  }

  if (
    /\bSELOS?\b/.test(miolo) ||
    miolo.includes('CONSULTA DE SELO') ||
    miolo.includes('CONSULTA SELO') ||
    miolo.includes('VALIDACAO DE SELO') ||
    /SELO\s*\d+/.test(miolo)
  ) {
    return finalizar('CAD_8_SELO_CARTORIO');
  }

  // 5. Solicitação de Abertura de Limite (LCGH / LCGA)
  if (
    miolo.includes('SOLICITACAO DE ABERTURA') ||
    miolo.includes('SOLICITACAO DE LIMITE') ||
    miolo.includes('SOLICITACAO DO LIMITE') ||
    miolo.includes('ABERTURA DE LIMITE')
  ) {
    return finalizar('ITEM_SOLICITACAO_LIMITE');
  }

  // 6. Contrato de Assessoria
  if (
    miolo.includes('CONTRATO PARTICULAR') ||
    miolo.includes('CONTRATO DE ASSESSORIA') ||
    miolo.includes('ASSESSORIA')
  ) {
    return finalizar('ITEM_CONTRATO_ASSESSORIA');
  }

  // 7. Autorização de Alteração / Modificação do Projeto
  if (
    (miolo.includes('AUTORIZACAO') || miolo.includes('AUT ')) &&
    (miolo.includes('ALTERACAO') || miolo.includes('MODIFICACAO'))
  ) {
    return finalizar('ITEM_AUT_ALTERACAO');
  }

  // 8. Embargos e Improbidade
  if (miolo.includes('EMBARGO') || miolo.includes('IBAMA')) {
    return finalizar(
      mencionaConjuge ? 'ITEM_EMBARGOS_CONJUGE' : 'ITEM_EMBARGOS_TITULAR'
    );
  }
  if (miolo.includes('IMPROBIDADE') || miolo.includes('CNJ')) {
    return finalizar(
      mencionaConjuge ? 'ITEM_IMPROBIDADE_CONJUGE' : 'ITEM_IMPROBIDADE_TITULAR'
    );
  }

  // 9. Certificação Socioambiental (Com KML vs Sem KML)
  if (miolo.includes('SOCIOAMBIENTAL') || miolo.includes('SOCIO AMBIENTAL')) {
    if (miolo.includes('SEM KML') || miolo.includes('S KML') || miolo.includes('GARANTIA')) {
      return finalizar('ITEM_CERT_SOCIO_SEM_KML');
    }
    if (miolo.includes('COM KML') || miolo.includes('C KML')) {
      return finalizar('ITEM_CERT_SOCIO_COM_KML');
    }
    return finalizar(
      escopoAtual === 'LIMITE_PURO'
        ? 'ITEM_CERT_SOCIO_SEM_KML'
        : 'ITEM_CERT_SOCIO_COM_KML'
    );
  }

  // 10. Regularidade do Projetista (CREA / CFTA)
  if (
    /\b(CREA|CFTA)\b/.test(miolo) ||
    miolo.includes('REGULARIDADE DO PROJETISTA')
  ) {
    return finalizar('ITEM_CREA');
  }

  // 11. Extrato SICOR
  if (/\bSICOR\b/.test(miolo)) {
    return finalizar('ITEM_EXTRATO_SICOR');
  }

  // 12. Declarações Consolidadas / Unificadas
  if (
    miolo.includes('CONSOLIDADA') ||
    miolo.includes('DECLARACOES UNIFICADAS') ||
    miolo.includes('DECLARACAO UNIFICADA') ||
    miolo.includes('UNIFICADA RURAL') ||
    miolo.includes('UNIFICADA PRONAF')
  ) {
    return finalizar('ITEM_CONSOLIDADAS');
  }

  // 13. Declarações Ambientais (Garantidor, Regularidade, Não Desmatamento, Recomposição, etc.)
  if (
    miolo.includes('IMOVEL GARANTIDOR') ||
    miolo.includes('GARANTIDOR') ||
    miolo.includes('REG AMB GARANTIDOR')
  ) {
    return finalizar('ITEM_DEC_REG_AMB_GARANTIDOR');
  }
  if (miolo.includes('REGULARIDADE AMBIENTAL')) {
    return finalizar('ITEM_DEC_REG_AMBIENTAL');
  }
  if (miolo.includes('NAO DESMATAMENTO') || miolo.includes('DESMATAMENTO')) {
    return finalizar('ITEM_DEC_NAO_DESMATAMENTO');
  }
  if (miolo.includes('RECOMPOSICAO') || miolo.includes('RESERVA LEGAL')) {
    return finalizar('ITEM_DEC_RECOMPOSICAO');
  }
  if (
    miolo.includes('DECLARACAO AMBIENTAL') ||
    miolo.includes('DEC. AMBIENTAIS') ||
    miolo.includes('DEC AMBIENTAIS') ||
    miolo.includes('DECLARACOES AMBIENTAIS')
  ) {
    return finalizar('ITEM_DEC_AMBIENTAIS');
  }
  if (
    miolo.includes('BIOMA AMAZONIA') ||
    miolo.includes('SOBREPOSICAO') ||
    miolo.includes('RETIFICACAO DO CAR') ||
    miolo.includes('NAO EXPLORACAO') ||
    miolo.includes('ACIMA DE 4 MODULOS')
  ) {
    let sub = 'DEC. AMBIENTAL COMPLEMENTAR';
    if (miolo.includes('BIOMA')) sub = 'DEC. DE BIOMA AMAZÔNIA';
    else if (miolo.includes('SOBREPOSICAO'))
      sub = 'DEC. DE SOBREPOSIÇÃO DO CAR';
    else if (miolo.includes('RETIFICACAO')) sub = 'DEC. DE RETIFICAÇÃO DO CAR';
    else if (miolo.includes('NAO EXPLORACAO')) sub = 'DEC. DE NÃO EXPLORAÇÃO';
    else if (miolo.includes('4 MODULOS'))
      sub = 'DEC. DE RESERVA AMBIENTAL (ACIMA DE 4 MÓDULOS)';
    return finalizar('ITEM_DEC_OUTRA_AMBIENTAL', sub);
  }

  // 14. CCIR, ITR/CND Imóvel, CND PF e CNDT
  if (/\bCCIR\b/.test(miolo)) {
    return finalizar('ITEM_CCIR');
  }
  if (/\bCNDT\b/.test(miolo) || miolo.includes('DEBITOS TRABALHISTAS')) {
    return finalizar('ITEM_CNDT_PF');
  }
  if (
    /\bITR\b/.test(miolo) ||
    miolo.includes('CND ITR') ||
    miolo.includes('CND DO IMOVEL') ||
    miolo.includes('IMOVEL RURAL') ||
    miolo.includes('CIB')
  ) {
    return finalizar('ITEM_CND_ITR_IMOVEL');
  }
  if (/\bCND\b/.test(miolo) || miolo.includes('RECEITA FEDERAL')) {
    return finalizar('ITEM_CND_PF');
  }

  // 15. Laudos de Avaliação (Interno vs Externo / Convalidação)
  if (
    miolo.includes('LAUDO INTERNO') ||
    miolo.includes('AVALIACAO INTERNA') ||
    miolo.includes('LAUDO DE AVALIACAO INTERNO')
  ) {
    return finalizar('ITEM_LAUDO_INTERNO');
  }
  if (
    miolo.includes('LAUDO') ||
    miolo.includes('CONVALIDACAO') ||
    miolo.includes('AVALIACAO DO IMOVEL') ||
    miolo.includes('AVALIACAO EXTERNA')
  ) {
    return finalizar('ITEM_LAUDO_EXTERNO');
  }

  // 16. Inteiro Teor e Título de Domínio / Escritura
  if (
    miolo.includes('INTEIRO TEOR') ||
    miolo.includes('CERTIDAO DE MATRICULA') ||
    miolo.includes('CADEIA DOMINIAL') ||
    miolo.includes('MATRICULA')
  ) {
    return finalizar('ITEM_INTEIRO_TEOR');
  }
  if (
    miolo.includes('TITULO DE DOMINIO') ||
    miolo.includes('TITULO DEFINITIVO') ||
    miolo.includes('ESCRITURA PUBLICA') ||
    miolo.includes('COMPRA E VENDA')
  ) {
    return finalizar('ITEM_TITULO_DOMINIO');
  }

  // 17. Ficha Sanitária e Plano de Atividade Rural
  if (miolo.includes('FICHA SANITARIA') || miolo.includes('AGED')) {
    return finalizar('ITEM_FICHA_SANITARIA');
  }
  if (
    miolo.includes('PLANO DE ATIVIDADE') ||
    miolo.includes('ATIVIDADE RURAL')
  ) {
    return finalizar('ITEM_PLANO_ATIVIDADE_RURAL');
  }

  // 18. Espelho UND, Parecer Técnico, Orçamento, Projeto PDF
  if (miolo.includes('ESPELHO') || miolo.includes('RELATORIO DA UND')) {
    return finalizar('ITEM_ESPELHO_UND');
  }
  if (miolo.includes('PARECER TECNICO')) {
    return finalizar('ITEM_PARECER_TECNICO');
  }
  if (miolo.includes('ORCAMENTO') || miolo.includes('CARTA PROPOSTA')) {
    return finalizar('ITEM_ORCAMENTO');
  }
  if (
    /\bPROJETO\b/.test(miolo) ||
    miolo.includes('PLANO DE NEGOCIO') ||
    miolo.includes('PROPOSTA DE CREDITO')
  ) {
    return finalizar('ITEM_PROJETO_PDF');
  }

  // 19. CAR, Consulta ao CAR, CAF e Extrato da CAF
  if (
    miolo.includes('CONSULTA DO CAR') ||
    miolo.includes('CONSULTA AO CAR') ||
    miolo.includes('DEMONSTRATIVO CAR') ||
    miolo.includes('CONSULTA CAR')
  ) {
    return finalizar('ITEM_CONSULTA_CAR');
  }
  if (/\bCAR\b/.test(miolo)) {
    return finalizar('ITEM_CAR');
  }
  if (miolo.includes('EXTRATO DA CAF') || miolo.includes('EXTRATO CAF') || miolo.includes('CONSULTA CAF')) {
    return finalizar('ITEM_EXTRATO_CAF');
  }
  if (/\b(CAF|DAP)\b/.test(miolo)) {
    return finalizar('ITEM_CAF');
  }

  // 20. DCAA, RB, Capa do Analisador, Parecer Gerencial, SEMA
  if (/\bDCAA\b/.test(miolo)) {
    return finalizar('ITEM_DCAA');
  }
  if (/\bRB\b/.test(miolo) || miolo.includes('RELACAO DE BENEFICIARIOS')) {
    return finalizar('ITEM_RB_PA');
  }
  if (miolo.includes('CAPA DO ANALISADOR') || miolo.includes('ANALISADOR')) {
    return finalizar('ITEM_CAPA_ANALISADOR');
  }
  if (isArquivoParecerGerencialReal(nomeArquivo)) {
    return finalizar('ITEM_PARECER_GERENCIAL');
  }
  if (/\bSEMA\b/.test(miolo) || miolo.includes('DISPENSA AMBIENTAL')) {
    return finalizar('ITEM_PARECER_SEMA');
  }

  // 21. Documentos Cadastrais
  if (
    miolo.includes('IDENTIDADE') ||
    miolo.includes('CNH') ||
    /\b(RG|CPF)\b/.test(miolo)
  ) {
    if (mencionaConjuge) {
      return finalizar('CAD_1_IDENTIDADE_CONJUGE');
    }
    const titNorm = removerAcentos(primeiroNomeTitular).toUpperCase();
    if (titNorm && miolo.includes(titNorm)) {
      return finalizar('CAD_1_IDENTIDADE_TITULAR');
    }
    return finalizar('CAD_1_IDENTIDADE_OUTRO');
  }
  if (
    miolo.includes('CASAMENTO') ||
    miolo.includes('NASCIMENTO') ||
    miolo.includes('UNIAO ESTAVEL')
  ) {
    return finalizar('CAD_2_CERTIDAO_CASAMENTO');
  }
  if (
    miolo.includes('ENDERECO') ||
    miolo.includes('RESIDENCIA') ||
    miolo.includes('EQUATORIAL') ||
    miolo.includes('CAEMA')
  ) {
    return finalizar('CAD_3_COMP_ENDERECO');
  }
  if (
    miolo.includes('RENDA') ||
    miolo.includes('IRPF') ||
    miolo.includes('CONTRACHEQUE')
  ) {
    return finalizar('CAD_4_COMP_RENDA');
  }
  if (miolo.includes('PROCURACAO')) {
    return finalizar('CAD_6_PROCURACAO');
  }

  return finalizar('CAD_9_OUTROS_CADASTRO');
}

// ============================================================================
// TABELAS DE NUMERAÇÃO E DESTINOS POR PERFIL DE OPERAÇÃO
// ============================================================================
interface RegraItemPerfil {
  numeroPrefixo: string; // Ex: "1.", "10.1.", "17 -"
  rotuloBase: string;
  usaNomeProj?: boolean;
  usaNomePa?: boolean;
  usaNomeConjuge?: boolean;
  semSufixoNome?: boolean;
  copiarParaSocioambientalComPrefixo?: string; // Ex: "1.", "6.1."
  copiarParaCadastroComPrefixo?: string; // Ex: "5." (para a CAF)
}

function obterMapaRegrasDerivadaPronafA(): Partial<
  Record<CategoriaDocPasta, RegraItemPerfil>
> {
  return {
    ITEM_ARQ_ELETRONICO_PROJETO: { numeroPrefixo: '1.', rotuloBase: 'PROJETO' },
    ITEM_AUT_ALTERACAO: {
      numeroPrefixo: '2.',
      rotuloBase: 'AUTORIZAÇÃO DE ALTERAÇÃO',
    },
    ITEM_EMBARGOS_TITULAR: {
      numeroPrefixo: '3.',
      rotuloBase: 'EMBARGOS',
      copiarParaSocioambientalComPrefixo: '3.',
    },
    ITEM_EMBARGOS_CONJUGE: {
      numeroPrefixo: '3.',
      rotuloBase: 'EMBARGOS',
      usaNomeConjuge: true,
      copiarParaSocioambientalComPrefixo: '3.',
    },
    ITEM_IMPROBIDADE_TITULAR: { numeroPrefixo: '4.', rotuloBase: 'IMPROBIDADE' },
    ITEM_IMPROBIDADE_CONJUGE: {
      numeroPrefixo: '4.',
      rotuloBase: 'IMPROBIDADE',
      usaNomeConjuge: true,
    },
    ITEM_CERT_SOCIO_COM_KML: {
      numeroPrefixo: '5.',
      rotuloBase: 'CERT. SOCIOAMBIENTAL',
      copiarParaSocioambientalComPrefixo: '1.',
    },
    ITEM_CERT_SOCIO_SEM_KML: {
      numeroPrefixo: '5.',
      rotuloBase: 'CERT. SOCIOAMBIENTAL',
      copiarParaSocioambientalComPrefixo: '1.',
    },
    ITEM_CREA: { numeroPrefixo: '6.', rotuloBase: 'CREA', usaNomeProj: true },
    ITEM_EXTRATO_SICOR: { numeroPrefixo: '7.', rotuloBase: 'EXTRATO SICOR' },
    ITEM_CONTRATO_ASSESSORIA: {
      numeroPrefixo: '8.',
      rotuloBase: 'CONTRATO DE ASSESSORIA',
    },
    ITEM_CONSOLIDADAS: {
      numeroPrefixo: '9.',
      rotuloBase: 'DECLARAÇÕES CONSOLIDADAS',
    },
    ITEM_DEC_AMBIENTAIS: {
      numeroPrefixo: '10.',
      rotuloBase: 'DEC. AMBIENTAIS',
      copiarParaSocioambientalComPrefixo: '6.',
    },
    ITEM_DEC_REG_AMBIENTAL: {
      numeroPrefixo: '10.1.',
      rotuloBase: 'DEC. DE REGULARIDADE AMBIENTAL',
      copiarParaSocioambientalComPrefixo: '6.1.',
    },
    ITEM_DEC_NAO_DESMATAMENTO: {
      numeroPrefixo: '10.2.',
      rotuloBase: 'DEC. DE NÃO DESMATAMENTO',
      copiarParaSocioambientalComPrefixo: '6.2.',
    },
    ITEM_DEC_RECOMPOSICAO: {
      numeroPrefixo: '10.3.',
      rotuloBase: 'DEC. DE RECOMPOSIÇÃO',
      copiarParaSocioambientalComPrefixo: '6.3.',
    },
    ITEM_DEC_OUTRA_AMBIENTAL: {
      numeroPrefixo: '10.4.',
      rotuloBase: 'DEC. AMBIENTAL COMPLEMENTAR',
      copiarParaSocioambientalComPrefixo: '6.4.',
    },
    ITEM_ESPELHO_UND: {
      numeroPrefixo: '11.',
      rotuloBase: 'ESPELHO - RELATÓRIO DA UND',
    },
    ITEM_PROJETO_PDF: { numeroPrefixo: '12.', rotuloBase: 'PROJETO' },
    ITEM_CAR: {
      numeroPrefixo: '13.',
      rotuloBase: 'CAR',
      usaNomePa: true,
      copiarParaSocioambientalComPrefixo: '2.',
    },
    ITEM_CONSULTA_CAR: {
      numeroPrefixo: '13.',
      rotuloBase: 'CONSULTA DO CAR',
      usaNomePa: true,
      copiarParaSocioambientalComPrefixo: '2.',
    },
    ITEM_CAF: {
      numeroPrefixo: '14.',
      rotuloBase: 'CAF',
      copiarParaCadastroComPrefixo: '5.',
    },
    ITEM_DCAA: {
      numeroPrefixo: '15.',
      rotuloBase: 'DCAA',
      copiarParaSocioambientalComPrefixo: '4.',
    },
    ITEM_PARECER_TECNICO: {
      numeroPrefixo: '16.',
      rotuloBase: 'PARECER TÉCNICO',
    },
    ITEM_RB_PA: {
      numeroPrefixo: '17 -',
      rotuloBase: 'RB',
      usaNomePa: true,
    },
    ITEM_ORCAMENTO: { numeroPrefixo: '18.', rotuloBase: 'ORÇAMENTO' },
    ITEM_CAPA_ANALISADOR: {
      numeroPrefixo: '19.',
      rotuloBase: 'CAPA DO ANALISADOR',
    },
    ITEM_PARECER_GERENCIAL: {
      numeroPrefixo: '20.',
      rotuloBase: 'PARECER GERENCIAL',
    },
    ITEM_PARECER_SEMA: {
      numeroPrefixo: '21.',
      rotuloBase: 'PARECER DA SEMA',
      semSufixoNome: true,
      copiarParaSocioambientalComPrefixo: '5.',
    },
  };
}

// EXIGÊNCIAS 1: PRONAF V (COMUM) — OPERAÇÕES DERIVADAS (INVESTIMENTO / CUSTEIO)
function obterMapaRegrasDerivadaPronafV(): Partial<
  Record<CategoriaDocPasta, RegraItemPerfil>
> {
  return {
    ITEM_ARQ_ELETRONICO_PROJETO: { numeroPrefixo: '1.', rotuloBase: 'PROJETO' },
    ITEM_PROJETO_PDF: { numeroPrefixo: '2.', rotuloBase: 'PROJETO' },
    ITEM_CAPA_ANALISADOR: {
      numeroPrefixo: '3.',
      rotuloBase: 'CAPA DO ANALISADOR',
    },
    ITEM_KML: {
      numeroPrefixo: '4.',
      rotuloBase: 'KML',
      copiarParaSocioambientalComPrefixo: '3.',
    },
    ITEM_PLANILHA_GEODESICA: {
      numeroPrefixo: '4.1.',
      rotuloBase: 'PLANILHA DE COORDENADAS GEODÉSICAS',
    },
    ITEM_CAF: {
      numeroPrefixo: '5.',
      rotuloBase: 'CAF',
      copiarParaCadastroComPrefixo: '5.',
    },
    ITEM_EXTRATO_CAF: {
      numeroPrefixo: '6.',
      rotuloBase: 'EXTRATO DA CAF',
    },
    ITEM_CAR: {
      numeroPrefixo: '7.',
      rotuloBase: 'CAR',
      copiarParaSocioambientalComPrefixo: '1.',
    },
    ITEM_CONSULTA_CAR: {
      numeroPrefixo: '8.',
      rotuloBase: 'CONSULTA AO CAR',
      copiarParaSocioambientalComPrefixo: '2.',
    },
    ITEM_AUT_ALTERACAO: {
      numeroPrefixo: '9.',
      rotuloBase: 'AUTORIZAÇÃO DE MODIFICAÇÃO DO PROJETO',
    },
    ITEM_EMBARGOS_TITULAR: {
      numeroPrefixo: '10.',
      rotuloBase: 'EMBARGOS',
      copiarParaSocioambientalComPrefixo: '5.',
    },
    ITEM_EMBARGOS_CONJUGE: {
      numeroPrefixo: '10.',
      rotuloBase: 'EMBARGOS',
      usaNomeConjuge: true,
      copiarParaSocioambientalComPrefixo: '5.',
    },
    ITEM_IMPROBIDADE_TITULAR: {
      numeroPrefixo: '11.',
      rotuloBase: 'IMPROBIDADE',
    },
    ITEM_IMPROBIDADE_CONJUGE: {
      numeroPrefixo: '11.',
      rotuloBase: 'IMPROBIDADE',
      usaNomeConjuge: true,
    },
    ITEM_CNDT_PF: { numeroPrefixo: '12.', rotuloBase: 'CNDT' },
    ITEM_EXTRATO_SICOR: { numeroPrefixo: '13.', rotuloBase: 'EXTRATO SICOR' },
    ITEM_CERT_SOCIO_COM_KML: {
      numeroPrefixo: '14.',
      rotuloBase: 'CERT. SOCIOAMBIENTAL COM KML',
      copiarParaSocioambientalComPrefixo: '4.',
    },
    ITEM_CREA: { numeroPrefixo: '15.', rotuloBase: 'CREA', usaNomeProj: true },
    ITEM_CONTRATO_ASSESSORIA: {
      numeroPrefixo: '16.',
      rotuloBase: 'CONTRATO DE ASSESSORIA',
    },
    ITEM_CCIR: { numeroPrefixo: '17.', rotuloBase: 'CCIR' },
    ITEM_LAUDO_EXTERNO: {
      numeroPrefixo: '18.',
      rotuloBase: 'LAUDO DE AVALIAÇÃO EXTERNO',
    },
    ITEM_CND_ITR_IMOVEL: { numeroPrefixo: '19.', rotuloBase: 'CND ITR' },
    ITEM_LAUDO_INTERNO: {
      numeroPrefixo: '20.',
      rotuloBase: 'LAUDO DE AVALIAÇÃO INTERNO',
    },
    ITEM_DCAA: {
      numeroPrefixo: '21.',
      rotuloBase: 'DCAA',
      copiarParaSocioambientalComPrefixo: '6.',
    },
    ITEM_FICHA_SANITARIA: {
      numeroPrefixo: '22.',
      rotuloBase: 'FICHA SANITÁRIA',
    },
    ITEM_ORCAMENTO: { numeroPrefixo: '23.', rotuloBase: 'ORÇAMENTO' },
    ITEM_CONSOLIDADAS: {
      numeroPrefixo: '24.',
      rotuloBase: 'DECLARAÇÃO CONSOLIDADA PRONAF',
    },
    ITEM_DEC_AMBIENTAIS: {
      numeroPrefixo: '25.',
      rotuloBase: 'DEC. AMBIENTAIS',
      copiarParaSocioambientalComPrefixo: '7.',
    },
    ITEM_DEC_REG_AMBIENTAL: {
      numeroPrefixo: '25.1.',
      rotuloBase: 'DEC. DE REGULARIDADE AMBIENTAL',
      copiarParaSocioambientalComPrefixo: '7.1.',
    },
    ITEM_DEC_NAO_DESMATAMENTO: {
      numeroPrefixo: '25.2.',
      rotuloBase: 'DEC. DE NÃO DESMATAMENTO',
      copiarParaSocioambientalComPrefixo: '7.2.',
    },
    ITEM_DEC_RECOMPOSICAO: {
      numeroPrefixo: '25.3.',
      rotuloBase: 'DEC. DE RECOMPOSIÇÃO',
      copiarParaSocioambientalComPrefixo: '7.3.',
    },
    ITEM_DEC_REG_AMB_GARANTIDOR: {
      numeroPrefixo: '25.4.',
      rotuloBase: 'DEC. REG. AMB. IMÓVEL GARANTIDOR',
      copiarParaSocioambientalComPrefixo: '7.4.',
    },
    ITEM_DEC_OUTRA_AMBIENTAL: {
      numeroPrefixo: '25.5.',
      rotuloBase: 'DEC. AMBIENTAL COMPLEMENTAR',
      copiarParaSocioambientalComPrefixo: '7.5.',
    },
    ITEM_TITULO_DOMINIO: {
      numeroPrefixo: '26.',
      rotuloBase: 'TÍTULO DE DOMÍNIO',
    },
    ITEM_INTEIRO_TEOR: {
      numeroPrefixo: '27.',
      rotuloBase: 'INTEIRO TEOR DO IMÓVEL',
    },
    ITEM_PARECER_GERENCIAL: {
      numeroPrefixo: '28.',
      rotuloBase: 'PARECER GERENCIAL',
    },
  };
}

// EXIGÊNCIAS 2: MINI OU PEQUENO — OPERAÇÕES DERIVADAS (INVESTIMENTO / CUSTEIO)
function obterMapaRegrasDerivadaMiniPequeno(): Partial<
  Record<CategoriaDocPasta, RegraItemPerfil>
> {
  return {
    ITEM_ARQ_ELETRONICO_PROJETO: { numeroPrefixo: '1.', rotuloBase: 'PROJETO' },
    ITEM_PROJETO_PDF: { numeroPrefixo: '2.', rotuloBase: 'PROJETO' },
    ITEM_CAPA_ANALISADOR: {
      numeroPrefixo: '3.',
      rotuloBase: 'CAPA DO ANALISADOR',
    },
    ITEM_KML: {
      numeroPrefixo: '4.',
      rotuloBase: 'KML',
      copiarParaSocioambientalComPrefixo: '3.',
    },
    ITEM_PLANILHA_GEODESICA: {
      numeroPrefixo: '4.1.',
      rotuloBase: 'PLANILHA DE COORDENADAS GEODÉSICAS',
    },
    ITEM_CAR: {
      numeroPrefixo: '5.',
      rotuloBase: 'CAR',
      copiarParaSocioambientalComPrefixo: '1.',
    },
    ITEM_CONSULTA_CAR: {
      numeroPrefixo: '6.',
      rotuloBase: 'CONSULTA AO CAR',
      copiarParaSocioambientalComPrefixo: '2.',
    },
    ITEM_AUT_ALTERACAO: {
      numeroPrefixo: '7.',
      rotuloBase: 'AUTORIZAÇÃO DE MODIFICAÇÃO DO PROJETO',
    },
    ITEM_EMBARGOS_TITULAR: {
      numeroPrefixo: '8.',
      rotuloBase: 'EMBARGOS',
      copiarParaSocioambientalComPrefixo: '5.',
    },
    ITEM_EMBARGOS_CONJUGE: {
      numeroPrefixo: '8.',
      rotuloBase: 'EMBARGOS',
      usaNomeConjuge: true,
      copiarParaSocioambientalComPrefixo: '5.',
    },
    ITEM_IMPROBIDADE_TITULAR: {
      numeroPrefixo: '9.',
      rotuloBase: 'IMPROBIDADE',
    },
    ITEM_IMPROBIDADE_CONJUGE: {
      numeroPrefixo: '9.',
      rotuloBase: 'IMPROBIDADE',
      usaNomeConjuge: true,
    },
    ITEM_CND_PF: { numeroPrefixo: '10.', rotuloBase: 'CND' },
    ITEM_CNDT_PF: { numeroPrefixo: '11.', rotuloBase: 'CNDT' },
    ITEM_EXTRATO_SICOR: { numeroPrefixo: '12.', rotuloBase: 'EXTRATO SICOR' },
    ITEM_CERT_SOCIO_COM_KML: {
      numeroPrefixo: '13.',
      rotuloBase: 'CERT. SOCIOAMBIENTAL COM KML',
      copiarParaSocioambientalComPrefixo: '4.',
    },
    ITEM_CREA: { numeroPrefixo: '14.', rotuloBase: 'CREA', usaNomeProj: true },
    ITEM_CONTRATO_ASSESSORIA: {
      numeroPrefixo: '15.',
      rotuloBase: 'CONTRATO DE ASSESSORIA',
    },
    ITEM_CCIR: { numeroPrefixo: '16.', rotuloBase: 'CCIR' },
    ITEM_CND_ITR_IMOVEL: { numeroPrefixo: '17.', rotuloBase: 'CND ITR' },
    ITEM_LAUDO_EXTERNO: {
      numeroPrefixo: '18.',
      rotuloBase: 'LAUDO DE AVALIAÇÃO EXTERNO',
    },
    ITEM_LAUDO_INTERNO: {
      numeroPrefixo: '19.',
      rotuloBase: 'LAUDO DE AVALIAÇÃO INTERNO',
    },
    ITEM_DCAA: {
      numeroPrefixo: '20.',
      rotuloBase: 'DCAA',
      copiarParaSocioambientalComPrefixo: '6.',
    },
    ITEM_FICHA_SANITARIA: {
      numeroPrefixo: '21.',
      rotuloBase: 'FICHA SANITÁRIA',
    },
    ITEM_ORCAMENTO: { numeroPrefixo: '22.', rotuloBase: 'ORÇAMENTO' },
    ITEM_CONSOLIDADAS: {
      numeroPrefixo: '23.',
      rotuloBase: 'DECLARAÇÃO CONSOLIDADA RURAL PF',
    },
    ITEM_DEC_AMBIENTAIS: {
      numeroPrefixo: '24.',
      rotuloBase: 'DEC. AMBIENTAIS',
      copiarParaSocioambientalComPrefixo: '7.',
    },
    ITEM_DEC_REG_AMBIENTAL: {
      numeroPrefixo: '24.1.',
      rotuloBase: 'DEC. DE REGULARIDADE AMBIENTAL',
      copiarParaSocioambientalComPrefixo: '7.1.',
    },
    ITEM_DEC_NAO_DESMATAMENTO: {
      numeroPrefixo: '24.2.',
      rotuloBase: 'DEC. DE NÃO DESMATAMENTO',
      copiarParaSocioambientalComPrefixo: '7.2.',
    },
    ITEM_DEC_RECOMPOSICAO: {
      numeroPrefixo: '24.3.',
      rotuloBase: 'DEC. DE RECOMPOSIÇÃO',
      copiarParaSocioambientalComPrefixo: '7.3.',
    },
    ITEM_DEC_REG_AMB_GARANTIDOR: {
      numeroPrefixo: '24.4.',
      rotuloBase: 'DEC. REG. AMB. IMÓVEL GARANTIDOR',
      copiarParaSocioambientalComPrefixo: '7.4.',
    },
    ITEM_DEC_OUTRA_AMBIENTAL: {
      numeroPrefixo: '24.5.',
      rotuloBase: 'DEC. AMBIENTAL COMPLEMENTAR',
      copiarParaSocioambientalComPrefixo: '7.5.',
    },
    ITEM_TITULO_DOMINIO: {
      numeroPrefixo: '25.',
      rotuloBase: 'TÍTULO DE DOMÍNIO',
    },
    ITEM_INTEIRO_TEOR: {
      numeroPrefixo: '26.',
      rotuloBase: 'INTEIRO TEOR DO IMÓVEL',
    },
    ITEM_PLANO_ATIVIDADE_RURAL: {
      numeroPrefixo: '27.',
      rotuloBase: 'PLANO DE ATIVIDADE RURAL',
    },
    ITEM_PARECER_TECNICO: {
      numeroPrefixo: '28.',
      rotuloBase: 'PARECER TÉCNICO',
    },
    ITEM_PARECER_GERENCIAL: {
      numeroPrefixo: '29.',
      rotuloBase: 'PARECER GERENCIAL',
    },
  };
}

// EXIGÊNCIAS 3: GARANTIA POR LCGH / LCGA (QUALQUER PORTE — ITENS 1 A 19)
function obterMapaRegrasLimiteLcg(): Partial<
  Record<CategoriaDocPasta, RegraItemPerfil>
> {
  return {
    ITEM_SOLICITACAO_LIMITE: {
      numeroPrefixo: '1.',
      rotuloBase: 'SOLICITAÇÃO DE ABERTURA DE LIMITE',
    },
    ITEM_CAR: {
      numeroPrefixo: '2.',
      rotuloBase: 'CAR',
      copiarParaSocioambientalComPrefixo: '1.',
    },
    ITEM_CONSULTA_CAR: {
      numeroPrefixo: '3.',
      rotuloBase: 'CONSULTA AO CAR',
      copiarParaSocioambientalComPrefixo: '2.',
    },
    ITEM_CERT_SOCIO_SEM_KML: {
      numeroPrefixo: '4.',
      rotuloBase: 'CERT. SOCIOAMBIENTAL',
      copiarParaSocioambientalComPrefixo: '3.',
    },
    ITEM_CCIR: { numeroPrefixo: '5.', rotuloBase: 'CCIR' },
    ITEM_CND_ITR_IMOVEL: { numeroPrefixo: '6.', rotuloBase: 'CND ITR' },
    ITEM_LAUDO_INTERNO: {
      numeroPrefixo: '7.',
      rotuloBase: 'LAUDO INTERNO DO BANCO',
    },
    ITEM_LAUDO_EXTERNO: {
      numeroPrefixo: '8.',
      rotuloBase: 'LAUDO EXTERNO DO BANCO',
    },
    ITEM_INTEIRO_TEOR: {
      numeroPrefixo: '9.',
      rotuloBase: 'INTEIRO TEOR 15 ANOS',
    },
    ITEM_TITULO_DOMINIO: {
      numeroPrefixo: '10.',
      rotuloBase: 'TÍTULO DE DOMÍNIO OU ESCRITURA',
    },
    ITEM_CND_PF: { numeroPrefixo: '11.', rotuloBase: 'CND PF' },
    ITEM_CNDT_PF: { numeroPrefixo: '12.', rotuloBase: 'CNDT PF' },
    ITEM_EMBARGOS_TITULAR: {
      numeroPrefixo: '13.',
      rotuloBase: 'EMBARGOS',
      copiarParaSocioambientalComPrefixo: '4.',
    },
    ITEM_EMBARGOS_CONJUGE: {
      numeroPrefixo: '13.',
      rotuloBase: 'EMBARGOS',
      usaNomeConjuge: true,
      copiarParaSocioambientalComPrefixo: '4.',
    },
    ITEM_IMPROBIDADE_TITULAR: {
      numeroPrefixo: '14.',
      rotuloBase: 'IMPROBIDADE',
    },
    ITEM_IMPROBIDADE_CONJUGE: {
      numeroPrefixo: '14.',
      rotuloBase: 'IMPROBIDADE',
      usaNomeConjuge: true,
    },
    ITEM_EXTRATO_SICOR: { numeroPrefixo: '15.', rotuloBase: 'EXTRATO SICOR' },
    ITEM_DCAA: {
      numeroPrefixo: '16.',
      rotuloBase: 'DCAA',
      copiarParaSocioambientalComPrefixo: '5.',
    },
    ITEM_DEC_AMBIENTAIS: {
      numeroPrefixo: '17.',
      rotuloBase: 'DEC. AMBIENTAIS',
      copiarParaSocioambientalComPrefixo: '6.',
    },
    ITEM_DEC_REG_AMBIENTAL: {
      numeroPrefixo: '17.1.',
      rotuloBase: 'DEC. DE REGULARIDADE AMBIENTAL',
      copiarParaSocioambientalComPrefixo: '6.1.',
    },
    ITEM_DEC_NAO_DESMATAMENTO: {
      numeroPrefixo: '17.2.',
      rotuloBase: 'DEC. DE NÃO DESMATAMENTO',
      copiarParaSocioambientalComPrefixo: '6.2.',
    },
    ITEM_DEC_RECOMPOSICAO: {
      numeroPrefixo: '17.3.',
      rotuloBase: 'DEC. DE RECOMPOSIÇÃO',
      copiarParaSocioambientalComPrefixo: '6.3.',
    },
    ITEM_DEC_REG_AMB_GARANTIDOR: {
      numeroPrefixo: '17.4.',
      rotuloBase: 'DEC. REG. AMB. IMÓVEL GARANTIDOR',
      copiarParaSocioambientalComPrefixo: '6.4.',
    },
    ITEM_DEC_OUTRA_AMBIENTAL: {
      numeroPrefixo: '17.5.',
      rotuloBase: 'DEC. AMBIENTAL COMPLEMENTAR',
      copiarParaSocioambientalComPrefixo: '6.5.',
    },
    ITEM_CONSOLIDADAS: {
      numeroPrefixo: '18.',
      rotuloBase: 'DECLARAÇÕES CONSOLIDADAS',
    },
    ITEM_PARECER_GERENCIAL: {
      numeroPrefixo: '19.',
      rotuloBase: 'PARECER GERENCIAL',
    },
  };
}

function formatarNomePadronizado(
  regra: RegraItemPerfil,
  item: {
    nomeOriginal: string;
    extensao: string;
    categoria: CategoriaDocPasta;
    isViti: boolean;
    subtipoAmbientalExtra?: string;
  },
  nomes: {
    titular: string;
    conjuge: string;
    procurador: string;
    avalista: string;
  },
  cfg: ConfiguracaoPerfilPasta,
  prefixoOverride?: string
): string {
  const prefNum = prefixoOverride || regra.numeroPrefixo;
  const aceitaViti = CATEGORIAS_QUE_ACEITAM_VITI.has(item.categoria);
  const prefViti = item.isViti && aceitaViti ? 'VITI - ' : '';

  if (item.categoria === 'ITEM_ARQ_ELETRONICO_PROJETO') {
    const mExt = item.nomeOriginal.match(
      /(\.(?:PRONAF|INVUR|CUSTEIO)[A-Za-z0-9_]*|\.[A-Za-z0-9_]+)$/i
    );
    const sufixoArq = mExt ? mExt[1].toUpperCase() : `.${item.extensao || 'PRONAF'}`;
    return `${prefNum} PROJETO - ${nomes.titular}${sufixoArq}`;
  }

  const ext = item.extensao ? `.${item.extensao}` : '.pdf';

  if (
    item.categoria === 'ITEM_PARECER_GERENCIAL' &&
    item.nomeOriginal.toUpperCase().includes('FALTA AJUSTAR')
  ) {
    return `${prefNum} PARECER GERENCIAL - FALTA AJUSTAR${ext}`;
  }

  const rotulo =
    item.categoria === 'ITEM_DEC_OUTRA_AMBIENTAL' && item.subtipoAmbientalExtra
      ? item.subtipoAmbientalExtra
      : regra.rotuloBase;

  if (regra.semSufixoNome) {
    return `${prefNum} ${prefViti}${rotulo}${ext}`;
  }
  if (regra.usaNomeProj) {
    const proj = (cfg.projetistaNome || 'PROJETISTA').toUpperCase().trim();
    return `${prefNum} ${prefViti}${rotulo} - ${proj}${ext}`;
  }
  if (regra.usaNomePa) {
    const pa = (cfg.paOuImovelNome || nomes.titular).toUpperCase().trim();
    const sep = prefNum.endsWith('-') ? ' ' : ' - ';
    return `${prefNum} ${rotulo}${sep}${pa}${ext}`.replace(/\s+/g, ' ');
  }
  if (regra.usaNomeConjuge) {
    const conj = nomes.conjuge || 'CÔNJUGE';
    return `${prefNum} ${prefViti}${rotulo} - ${conj}${ext}`;
  }

  return `${prefNum} ${prefViti}${rotulo} - ${nomes.titular}${ext}`;
}

// ============================================================================
// CÁLCULO MULTI-PASTA DOS DESTINOS DE CADA ARQUIVO
// ============================================================================
export function calcularTodosDestinosDoArquivo(
  item: {
    nomeOriginal: string;
    extensao: string;
    categoria: CategoriaDocPasta;
    isViti: boolean;
    subtipoAmbientalExtra?: string;
  },
  cfg: ConfiguracaoPerfilPasta
): DestinoArquivoCalculado[] {
  if (item.categoria === 'IGNORAR') return [];

  const nomes = obterNomesCurtosDesambiguados({
    titularCompleto: cfg.titularNome,
    conjugeCompleto: cfg.conjugeNome,
    procuradorCompleto: cfg.procuradorNome,
    avalistaCompleto: cfg.avalistaNome,
  });

  const ext = item.extensao ? `.${item.extensao}` : '.pdf';
  const aceitaViti = CATEGORIAS_QUE_ACEITAM_VITI.has(item.categoria);
  const prefViti = item.isViti && aceitaViti ? 'VITI - ' : '';
  const tit = nomes.titular || 'CLIENTE';
  const conj = nomes.conjuge || 'CÔNJUGE';

  // 1. Verifica se é um documento exclusivo da Subpasta CADASTRO
  if (item.categoria.startsWith('CAD_')) {
    let nomeCad = '';
    let ordem = 300;
    switch (item.categoria) {
      case 'CAD_1_IDENTIDADE_TITULAR':
        nomeCad = `1. IDENTIDADE - ${tit}${ext}`;
        ordem = 301;
        break;
      case 'CAD_1_IDENTIDADE_CONJUGE':
        nomeCad = `1. IDENTIDADE - ${conj}${ext}`;
        ordem = 302;
        break;
      case 'CAD_1_IDENTIDADE_OUTRO':
        nomeCad = `1. IDENTIDADE - ${
          nomes.procurador || nomes.avalista || 'ENVOLVIDO'
        }${ext}`;
        ordem = 303;
        break;
      case 'CAD_2_CERTIDAO_CASAMENTO':
        nomeCad = `2. CERTIDÃO DE CASAMENTO - ${tit}${ext}`;
        ordem = 304;
        break;
      case 'CAD_3_COMP_ENDERECO':
        nomeCad = `3. COMPROVANTE DE ENDEREÇO - ${tit}${ext}`;
        ordem = 305;
        break;
      case 'CAD_4_COMP_RENDA':
        nomeCad = `4. COMPROVANTE DE RENDA - ${tit}${ext}`;
        ordem = 306;
        break;
      case 'CAD_5_PROPOSTA_CADASTRO':
        nomeCad = `6. ${prefViti}PROPOSTA DE CADASTRO - ${tit}${ext}`;
        ordem = 307;
        break;
      case 'CAD_6_PROCURACAO':
        nomeCad = `7. PROCURAÇÃO - ${nomes.procurador || tit}${ext}`;
        ordem = 308;
        break;
      case 'CAD_8_SELO_CARTORIO':
        nomeCad = `8. SELO DE FISCALIZAÇÃO - ${tit}${ext}`;
        ordem = 309;
        break;
      default:
        nomeCad = `9. DOC. CADASTRAL - ${item.nomeOriginal}`;
        ordem = 310;
        break;
    }
    return [
      {
        pastaRelativa: 'CADASTRO',
        nomeArquivoFinal: nomeCad,
        ordemExibicao: ordem + (item.isViti ? 0.5 : 0),
      },
    ];
  }

  const destinos: DestinoArquivoCalculado[] = [];

  const aplicarMapaEmPasta = (
    mapa: Partial<Record<CategoriaDocPasta, RegraItemPerfil>>,
    pastaBase: string, // '' para Raiz ou 'LCGH', 'INVESTIMENTO', etc.
    offsetOrdem = 0
  ) => {
    let catAlvo = item.categoria;
    // Se na pasta Limite veio apenas uma Cert. Socioambiental classificada como COM_KML (ou vice-versa na Derivada), aproveita!
    if (!mapa[catAlvo]) {
      if (
        catAlvo === 'ITEM_CERT_SOCIO_COM_KML' &&
        mapa['ITEM_CERT_SOCIO_SEM_KML']
      ) {
        catAlvo = 'ITEM_CERT_SOCIO_SEM_KML';
      } else if (
        catAlvo === 'ITEM_CERT_SOCIO_SEM_KML' &&
        mapa['ITEM_CERT_SOCIO_COM_KML']
      ) {
        catAlvo = 'ITEM_CERT_SOCIO_COM_KML';
      }
    }

    const regra = mapa[catAlvo];
    if (!regra) return;

    const numFloat =
      parseFloat(regra.numeroPrefixo.replace(/[^\d.]/g, '')) || 99;
    const ordemCalculada =
      offsetOrdem + numFloat * 10 + (item.isViti ? 0.5 : 0);

    const nomePrincipal = formatarNomePadronizado(regra, item, nomes, cfg);
    destinos.push({
      pastaRelativa: pastaBase,
      nomeArquivoFinal: nomePrincipal,
      ordemExibicao: ordemCalculada,
    });

    // Copia para a subpasta CADASTRO se exigido (ex: CAF)
    if (
      regra.copiarParaCadastroComPrefixo &&
      !destinos.some((d) => d.pastaRelativa === 'CADASTRO')
    ) {
      destinos.push({
        pastaRelativa: 'CADASTRO',
        nomeArquivoFinal: `${regra.copiarParaCadastroComPrefixo} CAF - ${tit}${ext}`,
        ordemExibicao: 306.5,
      });
    }

    // Copia para a respectiva subpasta CERTIFICAÇÃO SOCIOAMBIENTAL com a numeração própria dela!
    if (regra.copiarParaSocioambientalComPrefixo) {
      const pastaSocio = pastaBase
        ? `${pastaBase}/CERTIFICAÇÃO SOCIOAMBIENTAL`
        : 'CERTIFICAÇÃO SOCIOAMBIENTAL';
      const nomeSocio = formatarNomePadronizado(
        regra,
        item,
        nomes,
        cfg,
        regra.copiarParaSocioambientalComPrefixo
      );
      destinos.push({
        pastaRelativa: pastaSocio,
        nomeArquivoFinal: nomeSocio,
        ordemExibicao: ordemCalculada + 0.1,
      });
    }
  };

  if (cfg.escopo === 'PRONAF_A_PADRAO' || cfg.porte === 'PRONAF_A') {
    aplicarMapaEmPasta(obterMapaRegrasDerivadaPronafA(), '');
  } else if (cfg.escopo === 'LIMITE_PURO') {
    aplicarMapaEmPasta(obterMapaRegrasLimiteLcg(), '');
  } else if (cfg.escopo === 'DERIVADA_PURA') {
    const mapaDeriv =
      cfg.porte === 'PRONAF_V'
        ? obterMapaRegrasDerivadaPronafV()
        : obterMapaRegrasDerivadaMiniPequeno();
    aplicarMapaEmPasta(mapaDeriv, '');
  } else if (cfg.escopo === 'COMBO_DERIVADA_E_LIMITE') {
    // MODO COMBO: Cria e abastece simultaneamente a subpasta LCGH/LCGA e a subpasta INVESTIMENTO/CUSTEIO!
    const nomePastaLim = cfg.modalidadeLimite; // 'LCGH' ou 'LCGA'
    const nomePastaDeriv = cfg.modalidadeDerivada; // 'INVESTIMENTO' ou 'CUSTEIO'
    const mapaDeriv =
      cfg.porte === 'PRONAF_V'
        ? obterMapaRegrasDerivadaPronafV()
        : obterMapaRegrasDerivadaMiniPequeno();

    aplicarMapaEmPasta(mapaDeriv, nomePastaDeriv, 0);
    aplicarMapaEmPasta(obterMapaRegrasLimiteLcg(), nomePastaLim, 500);
  }

  return destinos;
}

// ============================================================================
// GERADOR INTELIGENTE DE LEMBRETES .TXT PARA TODOS OS PERFIS E SUBPASTAS
// ============================================================================
export function gerarLembretesTxtPorPerfil(params: {
  categoriasPresentes: Set<CategoriaDocPasta>;
  cfg: ConfiguracaoPerfilPasta;
  registroConformidadePronafA?: ItemConformidadePronafA | null;
  jaTemSeloNoCadastro: boolean;
  jaTemProcuracaoOuCasamentoNoCadastro: boolean;
  parecerGerencialExtraidoNaPasta: boolean;
}): LembreteTxtCalculado[] {
  const {
    categoriasPresentes,
    cfg,
    registroConformidadePronafA,
    jaTemSeloNoCadastro,
    jaTemProcuracaoOuCasamentoNoCadastro,
    parecerGerencialExtraidoNaPasta,
  } = params;

  const lembretes: LembreteTxtCalculado[] = [];
  const nomes = obterNomesCurtosDesambiguados({
    titularCompleto: cfg.titularNome,
    conjugeCompleto: cfg.conjugeNome,
    procuradorCompleto: cfg.procuradorNome,
    avalistaCompleto: cfg.avalistaNome,
  });

  const tit = nomes.titular || 'CLIENTE';
  const conj = nomes.conjuge;
  const proj = (cfg.projetistaNome || 'PROJETISTA').toUpperCase().trim();
  const pa = (cfg.paOuImovelNome || 'IMÓVEL').toUpperCase().trim();

  // 1. Regra de Selos na Subpasta CADASTRO
  const temProcOuCasamento =
    categoriasPresentes.has('CAD_6_PROCURACAO') ||
    categoriasPresentes.has('CAD_2_CERTIDAO_CASAMENTO') ||
    jaTemProcuracaoOuCasamentoNoCadastro;
  const temSelo =
    categoriasPresentes.has('CAD_8_SELO_CARTORIO') || jaTemSeloNoCadastro;

  if (temProcOuCasamento && !temSelo) {
    lembretes.push({
      pastaRelativa: 'CADASTRO',
      nomeArquivoTxt: 'FALTA CONSULTAR SELOS.txt',
    });
    lembretes.push({
      pastaRelativa: '',
      nomeArquivoTxt: '0. FALTA CONSULTAR SELOS (VER PASTA CADASTRO).txt',
    });
  }

  // 2. Alertas "0." da Conformidade PRONAF A (se aplicável)
  if (registroConformidadePronafA) {
    const temConjConf = Boolean(
      registroConformidadePronafA.conjugeNome.trim() ||
        registroConformidadePronafA.conjugeCpf.trim()
    );
    const temProcConf = Boolean(
      registroConformidadePronafA.procuradorNome.trim() ||
        registroConformidadePronafA.procuradorCpf.trim()
    );

    const elab: string[] = [];
    if (registroConformidadePronafA.cadastroClienteOk === 'A_ELABORAR')
      elab.push('DO TITULAR');
    if (
      temConjConf &&
      registroConformidadePronafA.cadastroConjugeOk === 'A_ELABORAR'
    )
      elab.push('DO CÔNJUGE');
    if (
      temProcConf &&
      registroConformidadePronafA.cadastroProcuradorOk === 'A_ELABORAR'
    )
      elab.push('DO PROCURADOR');

    if (elab.length === 3) {
      lembretes.push({
        pastaRelativa: '',
        nomeArquivoTxt:
          '0. ELABORAR CADASTRO DO TITULAR, CÔNJUGE E PROCURADOR.txt',
      });
    } else if (elab.length === 2) {
      lembretes.push({
        pastaRelativa: '',
        nomeArquivoTxt: `0. ELABORAR CADASTRO ${elab[0]} E ${elab[1]}.txt`,
      });
    } else if (elab.length === 1) {
      lembretes.push({
        pastaRelativa: '',
        nomeArquivoTxt: `0. ELABORAR CADASTRO ${elab[0]}.txt`,
      });
    }

    const renov: string[] = [];
    if (registroConformidadePronafA.cadastroClienteOk === 'A_RENOVAR')
      renov.push('DO TITULAR');
    if (
      temConjConf &&
      registroConformidadePronafA.cadastroConjugeOk === 'A_RENOVAR'
    )
      renov.push('DO CÔNJUGE');
    if (
      temProcConf &&
      registroConformidadePronafA.cadastroProcuradorOk === 'A_RENOVAR'
    )
      renov.push('DO PROCURADOR');

    if (renov.length === 3) {
      lembretes.push({
        pastaRelativa: '',
        nomeArquivoTxt:
          '0. RENOVAR CADASTRO DO TITULAR, CÔNJUGE E PROCURADOR.txt',
      });
    } else if (renov.length === 2) {
      lembretes.push({
        pastaRelativa: '',
        nomeArquivoTxt: `0. RENOVAR CADASTRO ${renov[0]} E ${renov[1]}.txt`,
      });
    } else if (renov.length === 1) {
      lembretes.push({
        pastaRelativa: '',
        nomeArquivoTxt: `0. RENOVAR CADASTRO ${renov[0]}.txt`,
      });
    }

    if (registroConformidadePronafA.restricaoClienteNivel === 'GRAVE') {
      lembretes.push({
        pastaRelativa: '',
        nomeArquivoTxt: '0. CLIENTE COM RESTRIÇÃO GRAVE.txt',
      });
    }
  }

  // Função interna para gerar os .TXT de uma pasta Derivada (PRONAF V ou MINI/PEQUENO)
  const gerarTxtsPastaDerivada = (pastaAlvo: string) => {
    const isPronafV = cfg.porte === 'PRONAF_V';
    const isCusteio = cfg.modalidadeDerivada === 'CUSTEIO';
    const temGarantiaImovel =
      cfg.garantiaDerivada === 'LCGH_LCGA' ||
      cfg.escopo === 'COMBO_DERIVADA_E_LIMITE';

    const add = (nomeTxt: string) =>
      lembretes.push({ pastaRelativa: pastaAlvo, nomeArquivoTxt: nomeTxt });

    if (!categoriasPresentes.has('ITEM_ARQ_ELETRONICO_PROJETO')) {
      add(`1. PROJETO (${isCusteio ? 'ARQ. CUSTEIO' : isPronafV ? '.PRONAF' : '.INVUR'}) - ${tit}.txt`);
    }
    if (!categoriasPresentes.has('ITEM_PROJETO_PDF')) {
      add(`2. PROJETO - ${tit}.txt`);
    }
    if (!categoriasPresentes.has('ITEM_CAPA_ANALISADOR')) {
      add(`3. CAPA DO ANALISADOR - ${tit}.txt`);
    }
    if (!categoriasPresentes.has('ITEM_KML')) {
      add(`4. KML - ${tit}.txt`);
    }
    // Peculiaridade Custeio: Exige Planilha de Coordenadas Geodésicas além do KML!
    if (isCusteio && !categoriasPresentes.has('ITEM_PLANILHA_GEODESICA')) {
      add(`4.1. PLANILHA DE COORDENADAS GEODÉSICAS - ${tit}.txt`);
    }

    if (isPronafV) {
      if (!categoriasPresentes.has('ITEM_CAF')) add(`5. CAF - ${tit}.txt`);
      if (!categoriasPresentes.has('ITEM_EXTRATO_CAF')) {
        add(`6. CONSULTAR EXTRATO DA CAF NO DIA - ${tit}.txt`);
      }
      if (!categoriasPresentes.has('ITEM_CAR')) add(`7. CAR - ${tit}.txt`);
      if (!categoriasPresentes.has('ITEM_CONSULTA_CAR'))
        add(`8. CONSULTA AO CAR - ${tit}.txt`);
      if (!categoriasPresentes.has('ITEM_AUT_ALTERACAO'))
        add(`9. AUTORIZAÇÃO DE MODIFICAÇÃO DO PROJETO - ${tit}.txt`);
      if (!categoriasPresentes.has('ITEM_EMBARGOS_TITULAR'))
        add(`10. EMBARGOS - ${tit}.txt`);
      if (conj && !categoriasPresentes.has('ITEM_EMBARGOS_CONJUGE'))
        add(`10. EMBARGOS - ${conj}.txt`);
      if (!categoriasPresentes.has('ITEM_IMPROBIDADE_TITULAR'))
        add(`11. IMPROBIDADE - ${tit}.txt`);
      if (conj && !categoriasPresentes.has('ITEM_IMPROBIDADE_CONJUGE'))
        add(`11. IMPROBIDADE - ${conj}.txt`);
      if (!categoriasPresentes.has('ITEM_CNDT_PF'))
        add(`12. EMITIR CNDT NO DIA - ${tit}.txt`);
      if (!categoriasPresentes.has('ITEM_EXTRATO_SICOR'))
        add(`13. EXTRATO SICOR - ${tit}.txt`);
      if (!categoriasPresentes.has('ITEM_CERT_SOCIO_COM_KML'))
        add(`14. CERT. SOCIOAMBIENTAL COM KML - ${tit}.txt`);
      if (!categoriasPresentes.has('ITEM_CREA')) add(`15. CREA - ${proj}.txt`);
      if (!categoriasPresentes.has('ITEM_CONTRATO_ASSESSORIA'))
        add(`16. CONTRATO DE ASSESSORIA - ${tit}.txt`);
      if (!categoriasPresentes.has('ITEM_CCIR'))
        add(`17. CCIR (ANO VIGENTE) - ${tit}.txt`);

      // Laudo Externo (18) e Interno (20): Somente quando houver imóvel dado em garantia!
      // O Laudo Interno substitui o Externo quando este estiver ausente.
      if (temGarantiaImovel) {
        if (
          !categoriasPresentes.has('ITEM_LAUDO_EXTERNO') &&
          !categoriasPresentes.has('ITEM_LAUDO_INTERNO')
        ) {
          add(`18. LAUDO DE AVALIAÇÃO EXTERNO DO IMÓVEL - ${tit}.txt`);
        }
        if (
          cfg.imovelAvaliadoAcima600k &&
          !categoriasPresentes.has('ITEM_LAUDO_INTERNO')
        ) {
          add(`20. LAUDO DE AVALIAÇÃO INTERNO (ACIMA DE 600 MIL) - ${tit}.txt`);
        }
      }

      if (!categoriasPresentes.has('ITEM_CND_ITR_IMOVEL'))
        add(`19. CND OU ITR DO IMÓVEL - ${tit}.txt`);
      if (!categoriasPresentes.has('ITEM_DCAA')) add(`21. DCAA - ${tit}.txt`);
      if (!categoriasPresentes.has('ITEM_FICHA_SANITARIA'))
        add(`22. FICHA SANITÁRIA - ${tit}.txt`);

      // Peculiaridade Custeio: Orçamento pode ser substituído pelo próprio Projeto em PDF!
      if (
        !categoriasPresentes.has('ITEM_ORCAMENTO') &&
        !(isCusteio && categoriasPresentes.has('ITEM_PROJETO_PDF'))
      ) {
        add(`23. CARTA-PROPOSTA - ORÇAMENTO - ${tit}.txt`);
      }

      if (!categoriasPresentes.has('ITEM_CONSOLIDADAS'))
        add(`24. DECLARAÇÃO CONSOLIDADA PRONAF - ${tit}.txt`);
      add('24. VERIFICAR C-C NA CONSOLIDADA.txt');

      if (!categoriasPresentes.has('ITEM_DEC_REG_AMBIENTAL'))
        add(`25.1. DEC. DE REGULARIDADE AMBIENTAL - ${tit}.txt`);
      if (
        temGarantiaImovel &&
        !categoriasPresentes.has('ITEM_DEC_REG_AMB_GARANTIDOR')
      ) {
        add(`25.4. DEC. REG. AMB. IMÓVEL GARANTIDOR - ${tit}.txt`);
      }

      // Regra de Título de Domínio (26) vs Inteiro Teor (27):
      // Quando há imóvel em garantia: Inteiro Teor (15 anos) é sempre exigido.
      // Quando não há imóvel em garantia: Título de Domínio pode substituir Inteiro Teor (e vice-versa).
      if (temGarantiaImovel) {
        if (!categoriasPresentes.has('ITEM_INTEIRO_TEOR')) {
          add(`27. INTEIRO TEOR DO IMÓVEL (HISTÓRICO 15 ANOS) - ${tit}.txt`);
        }
      } else {
        if (
          !categoriasPresentes.has('ITEM_TITULO_DOMINIO') &&
          !categoriasPresentes.has('ITEM_INTEIRO_TEOR')
        ) {
          add(`26. TÍTULO DE DOMÍNIO OU INTEIRO TEOR DO IMÓVEL - ${tit}.txt`);
        }
      }

      if (
        !categoriasPresentes.has('ITEM_PARECER_GERENCIAL') &&
        !parecerGerencialExtraidoNaPasta
      ) {
        add('28. FALTA PARECER GERENCIAL.txt');
      }
    } else {
      // MINI OU PEQUENO (Itens 5 a 29)
      if (!categoriasPresentes.has('ITEM_CAR')) add(`5. CAR - ${tit}.txt`);
      if (!categoriasPresentes.has('ITEM_CONSULTA_CAR'))
        add(`6. CONSULTA AO CAR - ${tit}.txt`);
      if (!categoriasPresentes.has('ITEM_AUT_ALTERACAO'))
        add(`7. AUTORIZAÇÃO DE MODIFICAÇÃO DO PROJETO - ${tit}.txt`);
      if (!categoriasPresentes.has('ITEM_EMBARGOS_TITULAR'))
        add(`8. EMBARGOS - ${tit}.txt`);
      if (conj && !categoriasPresentes.has('ITEM_EMBARGOS_CONJUGE'))
        add(`8. EMBARGOS - ${conj}.txt`);
      if (!categoriasPresentes.has('ITEM_IMPROBIDADE_TITULAR'))
        add(`9. IMPROBIDADE - ${tit}.txt`);
      if (conj && !categoriasPresentes.has('ITEM_IMPROBIDADE_CONJUGE'))
        add(`9. IMPROBIDADE - ${conj}.txt`);
      if (!categoriasPresentes.has('ITEM_CND_PF'))
        add(`10. CND PESSOA FÍSICA - ${tit}.txt`);
      if (!categoriasPresentes.has('ITEM_CNDT_PF'))
        add(`11. EMITIR CNDT NO DIA - ${tit}.txt`);
      if (!categoriasPresentes.has('ITEM_EXTRATO_SICOR'))
        add(`12. EXTRATO SICOR - ${tit}.txt`);
      if (!categoriasPresentes.has('ITEM_CERT_SOCIO_COM_KML'))
        add(`13. CERT. SOCIOAMBIENTAL COM KML - ${tit}.txt`);
      if (!categoriasPresentes.has('ITEM_CREA')) add(`14. CREA - ${proj}.txt`);
      if (!categoriasPresentes.has('ITEM_CONTRATO_ASSESSORIA'))
        add(`15. CONTRATO DE ASSESSORIA - ${tit}.txt`);
      if (!categoriasPresentes.has('ITEM_CCIR'))
        add(`16. CCIR (ANO VIGENTE) - ${tit}.txt`);
      if (!categoriasPresentes.has('ITEM_CND_ITR_IMOVEL'))
        add(`17. CND OU ITR DO IMÓVEL - ${tit}.txt`);

      if (
        !categoriasPresentes.has('ITEM_LAUDO_EXTERNO') &&
        !categoriasPresentes.has('ITEM_LAUDO_INTERNO')
      ) {
        add(`18. LAUDO DE AVALIAÇÃO EXTERNO DO IMÓVEL - ${tit}.txt`);
      }
      if (
        cfg.imovelAvaliadoAcima600k &&
        !categoriasPresentes.has('ITEM_LAUDO_INTERNO')
      ) {
        add(`19. LAUDO DE AVALIAÇÃO INTERNO (ACIMA DE 600 MIL) - ${tit}.txt`);
      }

      if (!categoriasPresentes.has('ITEM_DCAA')) add(`20. DCAA - ${tit}.txt`);
      if (!categoriasPresentes.has('ITEM_FICHA_SANITARIA'))
        add(`21. FICHA SANITÁRIA - ${tit}.txt`);

      if (
        !categoriasPresentes.has('ITEM_ORCAMENTO') &&
        !(isCusteio && categoriasPresentes.has('ITEM_PROJETO_PDF'))
      ) {
        add(`22. CARTA-PROPOSTA - ORÇAMENTO - ${tit}.txt`);
      }

      if (!categoriasPresentes.has('ITEM_CONSOLIDADAS'))
        add(`23. DECLARAÇÃO CONSOLIDADA RURAL PF - ${tit}.txt`);
      add('23. VERIFICAR C-C NA CONSOLIDADA.txt');

      if (!categoriasPresentes.has('ITEM_DEC_REG_AMBIENTAL'))
        add(`24.1. DEC. DE REGULARIDADE AMBIENTAL - ${tit}.txt`);
      if (
        temGarantiaImovel &&
        !categoriasPresentes.has('ITEM_DEC_REG_AMB_GARANTIDOR')
      ) {
        add(`24.4. DEC. REG. AMB. IMÓVEL GARANTIDOR - ${tit}.txt`);
      }

      if (temGarantiaImovel) {
        if (!categoriasPresentes.has('ITEM_INTEIRO_TEOR')) {
          add(`26. INTEIRO TEOR DO IMÓVEL (HISTÓRICO 15 ANOS) - ${tit}.txt`);
        }
      } else {
        if (
          !categoriasPresentes.has('ITEM_TITULO_DOMINIO') &&
          !categoriasPresentes.has('ITEM_INTEIRO_TEOR')
        ) {
          add(`25. TÍTULO DE DOMÍNIO OU INTEIRO TEOR DO IMÓVEL - ${tit}.txt`);
        }
      }

      if (!categoriasPresentes.has('ITEM_PLANO_ATIVIDADE_RURAL'))
        add(`27. PLANO DE ATIVIDADE RURAL - ${tit}.txt`);
      if (!categoriasPresentes.has('ITEM_PARECER_TECNICO'))
        add(`28. PARECER TÉCNICO DO BANCO - ${tit}.txt`);
      if (
        !categoriasPresentes.has('ITEM_PARECER_GERENCIAL') &&
        !parecerGerencialExtraidoNaPasta
      ) {
        add('29. FALTA PARECER GERENCIAL.txt');
      }
    }
  };

  // Função interna para gerar os .TXT de uma pasta Limite LCGH/LCGA (Itens 1 a 19)
  const gerarTxtsPastaLimite = (pastaAlvo: string) => {
    const add = (nomeTxt: string) =>
      lembretes.push({ pastaRelativa: pastaAlvo, nomeArquivoTxt: nomeTxt });

    if (!categoriasPresentes.has('ITEM_SOLICITACAO_LIMITE'))
      add(`1. SOLICITAÇÃO DE ABERTURA DE LIMITE - ${tit}.txt`);
    if (!categoriasPresentes.has('ITEM_CAR')) add(`2. CAR - ${tit}.txt`);
    if (!categoriasPresentes.has('ITEM_CONSULTA_CAR'))
      add(`3. CONSULTA AO CAR - ${tit}.txt`);
    if (
      !categoriasPresentes.has('ITEM_CERT_SOCIO_SEM_KML') &&
      !categoriasPresentes.has('ITEM_CERT_SOCIO_COM_KML')
    ) {
      add(`4. CERT. SOCIOAMBIENTAL (SEM KML) - ${tit}.txt`);
    }
    if (!categoriasPresentes.has('ITEM_CCIR')) add(`5. CCIR - ${tit}.txt`);
    if (!categoriasPresentes.has('ITEM_CND_ITR_IMOVEL'))
      add(`6. ITR OU CND DO IMÓVEL - ${tit}.txt`);
    if (
      cfg.imovelAvaliadoAcima600k &&
      !categoriasPresentes.has('ITEM_LAUDO_INTERNO')
    ) {
      add(`7. LAUDO INTERNO DO BANCO (ACIMA DE 600 MIL) - ${tit}.txt`);
    }
    if (!categoriasPresentes.has('ITEM_LAUDO_EXTERNO'))
      add(`8. LAUDO EXTERNO DO BANCO - ${tit}.txt`);
    if (!categoriasPresentes.has('ITEM_INTEIRO_TEOR'))
      add(`9. INTEIRO TEOR DAS MATRÍCULAS (15 ANOS) - ${tit}.txt`);
    if (!categoriasPresentes.has('ITEM_TITULO_DOMINIO'))
      add(`10. TÍTULO DE DOMÍNIO OU ESCRITURA PÚBLICA - ${tit}.txt`);
    if (!categoriasPresentes.has('ITEM_CND_PF'))
      add(`11. CND PESSOA FÍSICA - ${tit}.txt`);
    if (!categoriasPresentes.has('ITEM_CNDT_PF'))
      add(`12. CNDT PESSOA FÍSICA - ${tit}.txt`);
    if (!categoriasPresentes.has('ITEM_EMBARGOS_TITULAR'))
      add(`13. EMBARGOS - ${tit}.txt`);
    if (conj && !categoriasPresentes.has('ITEM_EMBARGOS_CONJUGE'))
      add(`13. EMBARGOS - ${conj}.txt`);
    if (!categoriasPresentes.has('ITEM_IMPROBIDADE_TITULAR'))
      add(`14. IMPROBIDADE - ${tit}.txt`);
    if (conj && !categoriasPresentes.has('ITEM_IMPROBIDADE_CONJUGE'))
      add(`14. IMPROBIDADE - ${conj}.txt`);
    if (!categoriasPresentes.has('ITEM_EXTRATO_SICOR'))
      add(`15. EXTRATO SICOR - ${tit}.txt`);
    if (!categoriasPresentes.has('ITEM_DCAA')) add(`16. DCAA - ${tit}.txt`);
    if (!categoriasPresentes.has('ITEM_DEC_REG_AMB_GARANTIDOR'))
      add(`17.4. DEC. REG. AMB. IMÓVEL GARANTIDOR - ${tit}.txt`);
    if (!categoriasPresentes.has('ITEM_CONSOLIDADAS'))
      add(`18. DECLARAÇÃO CONSOLIDADA - ${tit}.txt`);
    if (
      !categoriasPresentes.has('ITEM_PARECER_GERENCIAL') &&
      !parecerGerencialExtraidoNaPasta
    ) {
      add('19. FALTA PARECER GERENCIAL.txt');
    }
  };

  // Roteamento conforme o escopo selecionado
  if (cfg.escopo === 'PRONAF_A_PADRAO' || cfg.porte === 'PRONAF_A') {
    const add = (nomeTxt: string) =>
      lembretes.push({ pastaRelativa: '', nomeArquivoTxt: nomeTxt });

    if (!categoriasPresentes.has('ITEM_ARQ_ELETRONICO_PROJETO'))
      add(`1. PROJETO - ${tit}.txt`);
    if (!categoriasPresentes.has('ITEM_AUT_ALTERACAO'))
      add(`2. AUTORIZAÇÃO DE ALTERAÇÃO - ${tit}.txt`);
    if (!categoriasPresentes.has('ITEM_EMBARGOS_TITULAR'))
      add(`3. EMBARGOS - ${tit}.txt`);
    if (conj && !categoriasPresentes.has('ITEM_EMBARGOS_CONJUGE'))
      add(`3. EMBARGOS - ${conj}.txt`);
    if (!categoriasPresentes.has('ITEM_IMPROBIDADE_TITULAR'))
      add(`4. IMPROBIDADE - ${tit}.txt`);
    if (conj && !categoriasPresentes.has('ITEM_IMPROBIDADE_CONJUGE'))
      add(`4. IMPROBIDADE - ${conj}.txt`);
    if (
      !categoriasPresentes.has('ITEM_CERT_SOCIO_COM_KML') &&
      !categoriasPresentes.has('ITEM_CERT_SOCIO_SEM_KML')
    )
      add(`5. CERT. SOCIOAMBIENTAL - ${tit}.txt`);
    if (!categoriasPresentes.has('ITEM_CREA')) add(`6. CREA - ${proj}.txt`);
    if (!categoriasPresentes.has('ITEM_EXTRATO_SICOR'))
      add(`7. EXTRATO SICOR - ${tit}.txt`);
    if (!categoriasPresentes.has('ITEM_CONTRATO_ASSESSORIA'))
      add(`8. CONTRATO DE ASSESSORIA - ${tit}.txt`);
    if (!categoriasPresentes.has('ITEM_CONSOLIDADAS'))
      add(`9. DECLARAÇÕES CONSOLIDADAS - ${tit}.txt`);
    add('9. VERIFICAR C-C NA CONSOLIDADA.txt');
    if (!categoriasPresentes.has('ITEM_DEC_AMBIENTAIS'))
      add(`10. DEC. AMBIENTAIS - ${tit}.txt`);
    if (!categoriasPresentes.has('ITEM_DEC_REG_AMBIENTAL'))
      add(`10.1. DEC. DE REGULARIDADE AMBIENTAL - ${tit}.txt`);
    if (!categoriasPresentes.has('ITEM_DEC_NAO_DESMATAMENTO'))
      add(`10.2. DEC. DE NÃO DESMATAMENTO - ${tit}.txt`);
    if (!categoriasPresentes.has('ITEM_DEC_RECOMPOSICAO'))
      add(`10.3. DEC. DE RECOMPOSIÇÃO - ${tit}.txt`);
    if (!categoriasPresentes.has('ITEM_ESPELHO_UND'))
      add(`11. ESPELHO - RELATÓRIO DA UND - ${tit}.txt`);
    if (!categoriasPresentes.has('ITEM_PROJETO_PDF'))
      add(`12. PROJETO - ${tit}.txt`);
    if (
      !categoriasPresentes.has('ITEM_CAR') &&
      !categoriasPresentes.has('ITEM_CONSULTA_CAR')
    )
      add(`13. CAR - ${pa}.txt`);
    if (!categoriasPresentes.has('ITEM_CAF')) add(`14. CAF - ${tit}.txt`);
    if (!categoriasPresentes.has('ITEM_DCAA')) add(`15. DCAA - ${tit}.txt`);
    if (!categoriasPresentes.has('ITEM_PARECER_TECNICO'))
      add(`16. PARECER TÉCNICO - ${tit}.txt`);
    if (!categoriasPresentes.has('ITEM_RB_PA')) add(`17 - RB ${pa}.txt`);
    if (!categoriasPresentes.has('ITEM_ORCAMENTO'))
      add(`18. ORÇAMENTO - ${tit}.txt`);
    if (!categoriasPresentes.has('ITEM_CAPA_ANALISADOR'))
      add(`19. CAPA DO ANALISADOR - ${tit}.txt`);
    if (
      !categoriasPresentes.has('ITEM_PARECER_GERENCIAL') &&
      !parecerGerencialExtraidoNaPasta
    )
      add('20. FALTA PARECER GERENCIAL.txt');
    if (!categoriasPresentes.has('ITEM_PARECER_SEMA'))
      add('21. PARECER DA SEMA.txt');
  } else if (cfg.escopo === 'LIMITE_PURO') {
    gerarTxtsPastaLimite('');
  } else if (cfg.escopo === 'DERIVADA_PURA') {
    gerarTxtsPastaDerivada('');
  } else if (cfg.escopo === 'COMBO_DERIVADA_E_LIMITE') {
    gerarTxtsPastaDerivada(cfg.modalidadeDerivada);
    gerarTxtsPastaLimite(cfg.modalidadeLimite);
  }

  return lembretes;
}