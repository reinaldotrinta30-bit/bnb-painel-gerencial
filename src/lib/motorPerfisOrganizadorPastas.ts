// src/lib/motorPerfisOrganizadorPastas.ts
import { ItemConformidadePronafA } from '@/components/ferramentas/ModalConformidadePronafA';
import { ImovelExtraidoProjetoPdf } from '@/lib/auditorInteligentePdfPasta';

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
  conjugeProcuradorNome?: string;
  avalistaNome: string;
  conjugeAvalistaNome?: string;
  projetistaNome: string;
  paOuImovelNome: string;
  imoveisExtraidosPdf?: ImovelExtraidoProjetoPdf[];
  envolveAnimaisNoInvestimento?: boolean;
  categoriasFaltandoViti?: Set<CategoriaDocPasta>;
  statusContaConsolidada?: 'OK' | 'FALTA' | 'NAO_LIDO';
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
  | 'ITEM_AUT_DEBITO_CONTA'
  | 'ITEM_EMBARGOS_TITULAR'
  | 'ITEM_EMBARGOS_CONJUGE'
  | 'ITEM_IMPROBIDADE_TITULAR'
  | 'ITEM_IMPROBIDADE_CONJUGE'
  | 'ITEM_CND_PF'
  | 'ITEM_CND_CONJUGE'
  | 'ITEM_CNDT_PF'
  | 'ITEM_CNDT_CONJUGE'
  | 'ITEM_EXTRATO_SICOR'
  | 'ITEM_CERT_SOCIO_COM_KML'
  | 'ITEM_CERT_SOCIO_SEM_KML'
  | 'ITEM_CREA'
  | 'ITEM_CONTRATO_ASSESSORIA'
  | 'ITEM_CCIR'
  | 'ITEM_CND_ITR_IMOVEL'
  | 'ITEM_TITULO_DOMINIO'
  | 'ITEM_ECPV_ESCRITURA'
  | 'ITEM_INTEIRO_TEOR'
  | 'ITEM_SELO_IMOVEL'
  | 'ITEM_MEMORIAL_DESCRITIVO'
  | 'ITEM_LAUDO_INTERNO'
  | 'ITEM_LAUDO_EXTERNO'
  | 'ITEM_DOC_IMOVEL_GENERICO'
  | 'ITEM_DCAA'
  | 'ITEM_FICHA_SANITARIA'
  | 'ITEM_ORCAMENTO'
  | 'ITEM_CONSOLIDADAS'
  | 'ITEM_DEC_AMBIENTAIS'
  | 'ITEM_DEC_REG_AMBIENTAL'
  | 'ITEM_DEC_NAO_DESMATAMENTO'
  | 'ITEM_DEC_RECOMPOSICAO'
  | 'ITEM_DEC_REG_AMB_GARANTIDOR'
  | 'ITEM_DEC_NAO_TRABALHO_INFANTIL'
  | 'ITEM_DEC_OUTRA_AMBIENTAL'
  | 'ITEM_PLANO_ATIVIDADE_RURAL'
  | 'ITEM_PARECER_TECNICO'
  | 'ITEM_PARECER_GERENCIAL'
  | 'ITEM_ESPELHO_UND'
  | 'ITEM_RB_PA'
  | 'ITEM_PARECER_SEMA'
  | 'ITEM_SOLICITACAO_LIMITE'
  // Subpasta CADASTRO (Titular, Cônjuge, Avalista, Procurador e Cônjuges destes)
  | 'CAD_1_IDENTIDADE_TITULAR'
  | 'CAD_1_IDENTIDADE_CONJUGE'
  | 'CAD_1_IDENTIDADE_AVALISTA'
  | 'CAD_1_IDENTIDADE_CONJUGE_AVALISTA'
  | 'CAD_1_IDENTIDADE_PROCURADOR'
  | 'CAD_1_IDENTIDADE_CONJUGE_PROCURADOR'
  | 'CAD_1_IDENTIDADE_OUTRO'
  | 'CAD_2_CERTIDAO_CASAMENTO'
  | 'CAD_2_CERTIDAO_ENVOLVIDO'
  | 'CAD_3_COMP_ENDERECO'
  | 'CAD_3_COMP_ENDERECO_ENVOLVIDO'
  | 'CAD_4_COMP_RENDA'
  | 'CAD_4_COMP_RENDA_ENVOLVIDO'
  | 'CAD_5_CAF_ENVOLVIDO'
  | 'CAD_5_PROPOSTA_CADASTRO'
  | 'CAD_5_PROPOSTA_CADASTRO_ENVOLVIDO'
  | 'CAD_6_PROCURACAO'
  | 'CAD_8_SELO_CARTORIO'
  | 'CAD_9_DECLARACAO_ENVOLVIDO'
  | 'CAD_9_OUTROS_CADASTRO'
  // Subpasta OUTROS
  | 'OUTROS_NAO_IDENTIFICADO';

export const CATEGORIAS_QUE_ACEITAM_VITI = new Set<CategoriaDocPasta>([
  'ITEM_PROJETO_PDF',
  'ITEM_AUT_ALTERACAO',
  'ITEM_AUT_DEBITO_CONTA',
  'ITEM_CONTRATO_ASSESSORIA',
  'ITEM_ORCAMENTO',
  'ITEM_CONSOLIDADAS',
  'ITEM_DEC_AMBIENTAIS',
  'ITEM_DEC_REG_AMBIENTAL',
  'ITEM_DEC_NAO_DESMATAMENTO',
  'ITEM_DEC_RECOMPOSICAO',
  'ITEM_DEC_REG_AMB_GARANTIDOR',
  'ITEM_DEC_NAO_TRABALHO_INFANTIL',
  'ITEM_DEC_OUTRA_AMBIENTAL',
  'ITEM_PARECER_TECNICO',
  'ITEM_SOLICITACAO_LIMITE',
  'ITEM_LAUDO_EXTERNO',
  'ITEM_MEMORIAL_DESCRITIVO',
  'ITEM_PLANO_ATIVIDADE_RURAL',
  'CAD_5_PROPOSTA_CADASTRO',
  'CAD_5_PROPOSTA_CADASTRO_ENVOLVIDO',
  'CAD_9_DECLARACAO_ENVOLVIDO',
]);

// Categorias que compõem o Kit Completo do Imóvel (numerados de 1 a 9 nas pastas de Imóveis e no Limite)
export const CATEGORIAS_KIT_IMOVEL = new Set<CategoriaDocPasta>([
  'ITEM_CAR',
  'ITEM_CONSULTA_CAR',
  'ITEM_CCIR',
  'ITEM_CND_ITR_IMOVEL',
  'ITEM_TITULO_DOMINIO',
  'ITEM_ECPV_ESCRITURA',
  'ITEM_INTEIRO_TEOR',
  'ITEM_SELO_IMOVEL',
  'ITEM_MEMORIAL_DESCRITIVO',
  'ITEM_LAUDO_INTERNO',
  'ITEM_LAUDO_EXTERNO',
  'ITEM_DOC_IMOVEL_GENERICO',
]);

export interface DestinoArquivoCalculado {
  pastaRelativa: string;
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

// Verifica se um candidato a nome de imóvel é na verdade o nome do Titular, Cônjuge, Procurador, Avalista ou Projetista
export function ehNomeDePessoaEnvolvida(
  candidato: string,
  nomesPessoasIgnorar?: string[]
): boolean {
  const candNorm = removerAcentos(candidato || '')
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!candNorm) return true;

  // Se tiver prefixo explícito de propriedade rural, nunca é nome de pessoa
  if (
    /\b(FAZENDA|FAZ|SITIO|CHACARA|LOTEAMENTO|LOTE|GLEBA|ASSENTAMENTO|ESTANCIA|GRANJA|RANCHO)\b/.test(
      candNorm
    ) ||
    /^P\s*A\b/.test(candNorm)
  ) {
    return false;
  }

  if (!nomesPessoasIgnorar || nomesPessoasIgnorar.length === 0) return false;

  for (const pessoa of nomesPessoasIgnorar) {
    const pNorm = removerAcentos(pessoa || '')
      .toUpperCase()
      .replace(/\(.*?\)/g, '')
      .replace(/[^A-Z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (!pNorm || pNorm.length < 3) continue;
    const primNome = pNorm.split(/\s+/)[0];
    if (
      candNorm === pNorm ||
      candNorm === primNome ||
      pNorm.startsWith(candNorm) ||
      candNorm.startsWith(pNorm)
    ) {
      return true;
    }
  }

  return false;
}

// Extrai o nome do imóvel (ex: FAZ. DOIS IRMÃOS, FAZENDA SÃO JOSÉ, SÍTIO BOA VISTA, LOTE 12, GLEBA B)
// ignorando estritamente nomes de titulares/envolvidos!
export function extrairNomeImovelDoNomeArquivo(
  nomeArquivo: string,
  imoveisConhecidos?: ImovelExtraidoProjetoPdf[],
  nomesPessoasIgnorar?: string[]
): string {
  const semExt = nomeArquivo.replace(/\.[^/.]+$/, '');
  const norm = removerAcentos(semExt)
    .toUpperCase()
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // 1. Verifica se cita algum dos imóveis lidos do PDF do Projeto
  if (imoveisConhecidos && imoveisConhecidos.length > 0) {
    for (const im of imoveisConhecidos) {
      const nIm = removerAcentos(im.nome).toUpperCase().trim();
      const nImSemPonto = nIm.replace(/\./g, '').replace(/\s+/g, ' ');
      const normSemPonto = norm.replace(/\./g, '').replace(/\s+/g, ' ');
      if (
        nIm.length >= 4 &&
        (norm.includes(nIm) || normSemPonto.includes(nImSemPonto)) &&
        !ehNomeDePessoaEnvolvida(im.nome, nomesPessoasIgnorar)
      ) {
        return im.nome.toUpperCase().trim();
      }
    }
  }

  // 2. Procura padrões clássicos de nome de imóvel rural (suporta "FAZ. DOIS IRMAOS", "SÍT. X", etc.)
  const matchImovel = norm.match(
    /\b((?:FAZENDA|FAZ\.?|SITIO|SIT\.?|CHACARA|CHAC\.?|LOTEAMENTO|LOTE|GLEBA|P\.?\s*A\.?|ASSENTAMENTO|ESTANCIA|GRANJA)\s+[A-Z0-9.\s]{2,38}?)(?:\s+ASSINADO|\s+COMPRESSED|\s+MATRICULA|\s+CPF|\s*-|$)/i
  );
  if (matchImovel && matchImovel[1]) {
    const extraido = matchImovel[1].replace(/\s+/g, ' ').trim();
    if (!ehNomeDePessoaEnvolvida(extraido, nomesPessoasIgnorar)) {
      return extraido;
    }
  }

  // 3. Se for "DOC. DO IMÓVEL - XXXXX", só aceita XXXXX se NÃO for nome de pessoa envolvida!
  const matchDocImovel = norm.match(
    /(?:DOC(?:UMENTACAO|\.)?\s+(?:DO\s+)?IMOVEL)\s*[-–:]?\s*([A-Z0-9.\s]{3,35})/i
  );
  if (matchDocImovel && matchDocImovel[1]) {
    const cand = matchDocImovel[1].replace(/\bASSINADO\b/g, '').trim();
    if (!ehNomeDePessoaEnvolvida(cand, nomesPessoasIgnorar)) {
      return cand;
    }
  }

  return '';
}

export function obterNomesCurtosDesambiguados(params: {
  titularCompleto: string;
  conjugeCompleto: string;
  procuradorCompleto: string;
  conjugeProcuradorCompleto?: string;
  avalistaCompleto: string;
  conjugeAvalistaCompleto?: string;
}) {
  const pTit = extrairPrimeiroNome(params.titularCompleto) || 'CLIENTE';
  const pConj = extrairPrimeiroNome(params.conjugeCompleto);
  const pProc = extrairPrimeiroNome(params.procuradorCompleto);
  const pConjProc = extrairPrimeiroNome(params.conjugeProcuradorCompleto || '');
  const pAval = extrairPrimeiroNome(params.avalistaCompleto);
  const pConjAval = extrairPrimeiroNome(params.conjugeAvalistaCompleto || '');

  const todos = [pTit, pConj, pProc, pConjProc, pAval, pConjAval].filter(
    Boolean
  );
  const contagem: Record<string, number> = {};
  todos.forEach((n) => {
    contagem[n] = (contagem[n] || 0) + 1;
  });

  return {
    titular: contagem[pTit] > 1 ? `${pTit} (TITULAR)` : pTit,
    conjuge: pConj ? (contagem[pConj] > 1 ? `${pConj} (CÔNJUGE)` : pConj) : '',
    procurador: pProc ? `${pProc} (PROCURADOR)` : '',
    conjugeProcurador: pConjProc ? `${pConjProc} (CÔNJ. PROCURADOR)` : '',
    avalista: pAval ? `${pAval} (AVALISTA)` : '',
    conjugeAvalista: pConjAval ? `${pConjAval} (CÔNJ. AVALISTA)` : '',
  };
}

// ============================================================================
// RECONHECIMENTO AUTOMÁTICO UNIVERSAL DE ARQUIVOS
// ============================================================================
export interface NomesEnvolvidosExtrasClassificacao {
  procuradorNome?: string;
  conjugeProcuradorNome?: string;
  avalistaNome?: string;
  conjugeAvalistaNome?: string;
}

export function classificarArquivoUniversal(
  nomeArquivo: string,
  primeiroNomeTitular: string,
  primeiroNomeConjuge: string,
  escopoAtual: EscopoOperacaoPasta,
  imoveisConhecidos?: ImovelExtraidoProjetoPdf[],
  envolvidosExtras?: NomesEnvolvidosExtrasClassificacao
): {
  categoria: CategoriaDocPasta;
  isViti: boolean;
  subtipoAmbientalExtra?: string;
  nomeImovelEspecifico?: string;
  tagEnvolvidoEspecifico?: string;
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

  const primProc = extrairPrimeiroNome(envolvidosExtras?.procuradorNome || '');
  const primConjProc = extrairPrimeiroNome(
    envolvidosExtras?.conjugeProcuradorNome || ''
  );
  const primAval = extrairPrimeiroNome(envolvidosExtras?.avalistaNome || '');
  const primConjAval = extrairPrimeiroNome(
    envolvidosExtras?.conjugeAvalistaNome || ''
  );

  const listaPessoasIgnorarImovel = [
    primeiroNomeTitular,
    primeiroNomeConjuge,
    primProc,
    primConjProc,
    primAval,
    primConjAval,
    envolvidosExtras?.procuradorNome || '',
    envolvidosExtras?.conjugeProcuradorNome || '',
    envolvidosExtras?.avalistaNome || '',
    envolvidosExtras?.conjugeAvalistaNome || '',
  ].filter(Boolean);

  const nomeImovelEsp = extrairNomeImovelDoNomeArquivo(
    nomeArquivo,
    imoveisConhecidos,
    listaPessoasIgnorarImovel
  );

  if (ext === 'KML' || ext === 'KMZ') {
    return {
      categoria: 'ITEM_KML',
      isViti: false,
      nomeImovelEspecifico: nomeImovelEsp || undefined,
    };
  }

  if (
    norm.includes('COORDENADAS') ||
    norm.includes('GEODESICA') ||
    norm.includes('GLEBAS') ||
    ((ext === 'XLSX' || ext === 'XLS' || ext === 'CSV') &&
      !norm.includes('ORCAMENTO'))
  ) {
    return {
      categoria: 'ITEM_PLANILHA_GEODESICA',
      isViti: false,
      nomeImovelEspecifico: nomeImovelEsp || undefined,
    };
  }

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

  const contemNomeIsolado = (nomeCurto: string) =>
    Boolean(
      nomeCurto &&
        nomeCurto.length > 2 &&
        new RegExp(`\\b${removerAcentos(nomeCurto).toUpperCase()}\\b`).test(
          miolo
        )
    );

  // Detecta se o arquivo refere-se especificamente ao Avalista, Procurador ou Cônjuges destes!
  const mencionaConjugeAvalista =
    /\b(CONJUGE|CONJ\.?|ESPOSA|MARIDO|COMPANHEIR[OA])\s+(?:D[OAE]\s+)?(?:AVALISTA|FIADOR|INTERVENIENTE)\b/.test(
      miolo
    ) ||
    /\b(?:AVALISTA)\s*[-–/]\s*(?:CONJUGE|CONJ\.?|COMPANHEIR[OA])\b/.test(
      miolo
    ) ||
    contemNomeIsolado(primConjAval);

  const mencionaConjugeProcurador =
    /\b(CONJUGE|CONJ\.?|ESPOSA|MARIDO|COMPANHEIR[OA])\s+(?:D[OAE]\s+)?(?:PROCURADOR|PROCURADORA)\b/.test(
      miolo
    ) ||
    /\b(?:PROCURADOR|PROCURADORA)\s*[-–/]\s*(?:CONJUGE|CONJ\.?|COMPANHEIR[OA])\b/.test(
      miolo
    ) ||
    contemNomeIsolado(primConjProc);

  const mencionaAvalista =
    !mencionaConjugeAvalista &&
    (/\b(AVALISTA|FIADOR|FIADORA|INTERVENIENTE|ANUENTE)\b/.test(miolo) ||
      contemNomeIsolado(primAval));

  const mencionaProcurador =
    !mencionaConjugeProcurador &&
    !miolo.includes('PROCURACAO') &&
    (/\b(PROCURADOR|PROCURADORA)\b/.test(miolo) || contemNomeIsolado(primProc));

  const mencionaConjugeTitular =
    !mencionaConjugeAvalista &&
    !mencionaConjugeProcurador &&
    !mencionaAvalista &&
    !mencionaProcurador &&
    (contemNomeIsolado(primeiroNomeConjuge) ||
      /\b(CONJUGE|ESPOSA|MARIDO|COMPANHEIR[OA])\b/.test(miolo));

  const ehEnvolvidoSecundario =
    mencionaConjugeAvalista ||
    mencionaConjugeProcurador ||
    mencionaAvalista ||
    mencionaProcurador;

  // Monta a tag descritiva do envolvido para usar no nome final dentro da pasta CADASTRO
  let tagEnvolvidoDetectado: string | undefined;
  if (mencionaConjugeAvalista) {
    tagEnvolvidoDetectado = primConjAval
      ? `${primConjAval} (CÔNJ. AVALISTA)`
      : 'CÔNJUGE DO AVALISTA';
  } else if (mencionaConjugeProcurador) {
    tagEnvolvidoDetectado = primConjProc
      ? `${primConjProc} (CÔNJ. PROCURADOR)`
      : 'CÔNJUGE DO PROCURADOR';
  } else if (mencionaAvalista) {
    tagEnvolvidoDetectado = primAval ? `${primAval} (AVALISTA)` : 'AVALISTA';
  } else if (mencionaProcurador) {
    tagEnvolvidoDetectado = primProc
      ? `${primProc} (PROCURADOR)`
      : 'PROCURADOR';
  } else if (mencionaConjugeTitular) {
    tagEnvolvidoDetectado = primeiroNomeConjuge
      ? `${removerAcentos(primeiroNomeConjuge).toUpperCase()} (CÔNJUGE)`
      : 'CÔNJUGE';
  }

  const finalizar = (
    categoria: CategoriaDocPasta,
    subtipoAmbientalExtra?: string,
    tagOverride?: string
  ) => ({
    categoria,
    isViti: pareceVitiPeloNome && CATEGORIAS_QUE_ACEITAM_VITI.has(categoria),
    subtipoAmbientalExtra,
    nomeImovelEspecifico: nomeImovelEsp || undefined,
    tagEnvolvidoEspecifico: tagOverride || tagEnvolvidoDetectado,
  });

  if (
    miolo.includes('PROPOSTA DE CADASTRO') ||
    miolo.includes('FICHA CADASTRAL') ||
    miolo.includes('S400') ||
    miolo.includes('ESPELHO CADASTRO') ||
    miolo.includes('FICHA CADASTRO')
  ) {
    if (ehEnvolvidoSecundario || mencionaConjugeTitular) {
      return finalizar('CAD_5_PROPOSTA_CADASTRO_ENVOLVIDO');
    }
    return finalizar('CAD_5_PROPOSTA_CADASTRO');
  }

  // Distingue SELO DO IMÓVEL vs SELO PESSOAL (Procuração / Casamento / Nascimento)
  if (
    /\bSELOS?\b/.test(miolo) ||
    miolo.includes('CONSULTA DE SELO') ||
    miolo.includes('CONSULTA SELO') ||
    miolo.includes('VALIDACAO DE SELO') ||
    /SELO\s*\d+/.test(miolo)
  ) {
    const ehSeloDeImovel =
      Boolean(nomeImovelEsp) ||
      /\b(IMOVEL|FAZENDA|SITIO|GLEBA|LOTE|MATRICULA|INTEIRO TEOR|ESCRITURA|ECPV|TITULO|HIPOTECA|ONUS)\b/.test(
        miolo
      );
    if (
      ehSeloDeImovel &&
      !miolo.includes('CASAMENTO') &&
      !miolo.includes('NASCIMENTO') &&
      !miolo.includes('PROCURACAO')
    ) {
      return finalizar('ITEM_SELO_IMOVEL');
    }
    return finalizar('CAD_8_SELO_CARTORIO');
  }

  if (
    miolo.includes('SOLICITACAO DE ABERTURA') ||
    miolo.includes('SOLICITACAO DE LIMITE') ||
    miolo.includes('SOLICITACAO DO LIMITE') ||
    miolo.includes('SOLICITACAO DE LCG') ||
    miolo.includes('ABERTURA DE LIMITE')
  ) {
    return finalizar('ITEM_SOLICITACAO_LIMITE');
  }

  if (
    miolo.includes('CONTRATO PARTICULAR') ||
    miolo.includes('CONTRATO DE ASSESSORIA') ||
    miolo.includes('ASSESSORIA')
  ) {
    return finalizar('ITEM_CONTRATO_ASSESSORIA');
  }

  if (
    (miolo.includes('AUTORIZACAO') || miolo.includes('AUT ')) &&
    (miolo.includes('ALTERACAO') || miolo.includes('MODIFICACAO'))
  ) {
    return finalizar('ITEM_AUT_ALTERACAO');
  }

  // Declarações de Débito / Autorização de Consulta / SCR / SICOR:
  // Se forem do Cônjuge, Avalista, Procurador ou Cônjuges destes -> vão para a raiz do CADASTRO!
  if (
    miolo.includes('AUTORIZACAO DE DEBITO') ||
    miolo.includes('DEBITO EM CONTA') ||
    miolo.includes('CONSULTA AO SCR') ||
    miolo.includes('AUTORIZACAO SCR') ||
    miolo.includes('CONSULTA AO SICOR') ||
    miolo.includes('AUTORIZACAO DE CONSULTA')
  ) {
    if (ehEnvolvidoSecundario || mencionaConjugeTitular) {
      return finalizar('CAD_9_DECLARACAO_ENVOLVIDO');
    }
    return finalizar('ITEM_AUT_DEBITO_CONTA');
  }

  if (miolo.includes('EMBARGO') || miolo.includes('IBAMA')) {
    return finalizar(
      mencionaConjugeTitular
        ? 'ITEM_EMBARGOS_CONJUGE'
        : 'ITEM_EMBARGOS_TITULAR'
    );
  }
  if (miolo.includes('IMPROBIDADE') || miolo.includes('CNJ')) {
    return finalizar(
      mencionaConjugeTitular
        ? 'ITEM_IMPROBIDADE_CONJUGE'
        : 'ITEM_IMPROBIDADE_TITULAR'
    );
  }

  if (
    miolo.includes('SOCIOAMBIENTAL') ||
    miolo.includes('SOCIO AMBIENTAL') ||
    miolo.includes('CONFORMIDADE SOCIO') ||
    /\bCERT\.?\s*SOCIO\b/.test(miolo)
  ) {
    if (
      miolo.includes('SEM KML') ||
      miolo.includes('S KML') ||
      miolo.includes('GARANTIA')
    ) {
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

  if (
    /\b(CREA|CFTA)\b/.test(miolo) ||
    miolo.includes('REGULARIDADE DO PROJETISTA')
  ) {
    return finalizar('ITEM_CREA');
  }

  if (/\bSICOR\b/.test(miolo)) {
    return finalizar('ITEM_EXTRATO_SICOR');
  }

  // Declarações Consolidadas: se forem do Cônjuge, Avalista, Procurador ou Cônjuges destes -> vão para a raiz do CADASTRO!
  if (
    miolo.includes('CONSOLIDADA') ||
    miolo.includes('DECLARACOES UNIFICADAS') ||
    miolo.includes('DECLARACAO UNIFICADA') ||
    miolo.includes('UNIFICADA RURAL') ||
    miolo.includes('UNIFICADA PRONAF')
  ) {
    if (ehEnvolvidoSecundario || mencionaConjugeTitular) {
      return finalizar('CAD_9_DECLARACAO_ENVOLVIDO');
    }
    return finalizar('ITEM_CONSOLIDADAS');
  }

  // Declarações Ambientais
  if (
    miolo.includes('TRABALHO INFANTIL') ||
    miolo.includes('EXPLORACAO DE TRABALHO') ||
    miolo.includes('TRABALHO ESCRAVO')
  ) {
    return finalizar(
      'ITEM_DEC_NAO_TRABALHO_INFANTIL',
      'DEC. DE NÃO TRABALHO INFANTIL'
    );
  }
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
  if (
    miolo.includes('NAO DESMATAMENTO') ||
    miolo.includes('DESMATAMENTO IRREGULAR') ||
    miolo.includes('DESMATAMENTO')
  ) {
    return finalizar('ITEM_DEC_NAO_DESMATAMENTO');
  }
  if (miolo.includes('RECOMPOSICAO') || miolo.includes('RESERVA LEGAL')) {
    return finalizar('ITEM_DEC_RECOMPOSICAO');
  }
  if (
    miolo.includes('BIOMA') ||
    miolo.includes('SOBREPOSICAO') ||
    miolo.includes('RETIFICACAO DO CAR') ||
    miolo.includes('RETIFICACAO CAR') ||
    miolo.includes('NAO EXPLORACAO') ||
    miolo.includes('POSSEIRO') ||
    miolo.includes('CAR DIFERENTE') ||
    miolo.includes('ACIMA DE 4 MODULOS') ||
    miolo.includes('RESERVA AMBIENTAL')
  ) {
    let sub = 'DEC. AMBIENTAL COMPLEMENTAR';
    if (miolo.includes('BIOMA')) sub = 'DEC. DE BIOMA AMAZÔNIA';
    else if (miolo.includes('POSSEIRO'))
      sub = 'DEC. SOBREPOSIÇÃO DO CAR (POSSEIRO)';
    else if (miolo.includes('DIFERENTE'))
      sub = 'DEC. SOBREPOSIÇÃO DE CAR DIFERENTE';
    else if (miolo.includes('SOBREPOSICAO'))
      sub = 'DEC. DE SOBREPOSIÇÃO DO CAR';
    else if (miolo.includes('RETIFICACAO')) sub = 'DEC. DE RETIFICAÇÃO DO CAR';
    else if (miolo.includes('NAO EXPLORACAO')) sub = 'DEC. DE NÃO EXPLORAÇÃO';
    else if (miolo.includes('4 MODULOS') || miolo.includes('RESERVA AMBIENTAL'))
      sub = 'DEC. DE RESERVA AMBIENTAL (ACIMA DE 4 MÓDULOS)';
    return finalizar('ITEM_DEC_OUTRA_AMBIENTAL', sub);
  }
  if (
    miolo.includes('DECLARACAO AMBIENTAL') ||
    miolo.includes('DEC. AMBIENTAIS') ||
    miolo.includes('DEC AMBIENTAIS') ||
    miolo.includes('DECLARACOES AMBIENTAIS') ||
    miolo.includes('MODELO DO BANCO')
  ) {
    return finalizar('ITEM_DEC_AMBIENTAIS');
  }

  // Qualquer outra Declaração que mencione Avalista, Procurador ou Cônjuges destes vai para CADASTRO
  if (
    ehEnvolvidoSecundario &&
    (miolo.includes('DECLARACAO') || miolo.includes('AUTORIZACAO'))
  ) {
    return finalizar('CAD_9_DECLARACAO_ENVOLVIDO');
  }

  if (/\bCCIR\b/.test(miolo)) {
    return finalizar('ITEM_CCIR');
  }
  if (/\bCNDT\b/.test(miolo) || miolo.includes('DEBITOS TRABALHISTAS')) {
    return finalizar(
      mencionaConjugeTitular ? 'ITEM_CNDT_CONJUGE' : 'ITEM_CNDT_PF'
    );
  }
  if (
    /\bITR\b/.test(miolo) ||
    miolo.includes('CND ITR') ||
    miolo.includes('CND DO IMOVEL') ||
    miolo.includes('IMOVEL RURAL') ||
    miolo.includes('CIB') ||
    miolo.includes('NIRF')
  ) {
    return finalizar('ITEM_CND_ITR_IMOVEL');
  }
  if (/\bCND\b/.test(miolo) || miolo.includes('RECEITA FEDERAL')) {
    return finalizar(
      mencionaConjugeTitular ? 'ITEM_CND_CONJUGE' : 'ITEM_CND_PF'
    );
  }

  if (
    miolo.includes('MEMORIAL DESCRITIVO') ||
    /\bMEMORIAL\b/.test(miolo)
  ) {
    return finalizar('ITEM_MEMORIAL_DESCRITIVO');
  }

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

  if (
    miolo.includes('INTEIRO TEOR') ||
    miolo.includes('CERTIDAO DE MATRICULA') ||
    miolo.includes('CADEIA DOMINIAL') ||
    miolo.includes('MATRICULA')
  ) {
    return finalizar('ITEM_INTEIRO_TEOR');
  }
  if (
    miolo.includes('ECPV') ||
    miolo.includes('ESCRITURA PUBLICA') ||
    miolo.includes('ESCRITURA DE COMPRA E VENDA') ||
    miolo.includes('COMPRA E VENDA')
  ) {
    return finalizar('ITEM_ECPV_ESCRITURA');
  }
  if (
    miolo.includes('TITULO DE DOMINIO') ||
    miolo.includes('TITULO DEFINITIVO') ||
    miolo.includes('CONCESSAO DE USO')
  ) {
    return finalizar('ITEM_TITULO_DOMINIO');
  }

  if (miolo.includes('FICHA SANITARIA') || miolo.includes('AGED')) {
    return finalizar('ITEM_FICHA_SANITARIA');
  }
  if (
    miolo.includes('PLANO DE ATIVIDADE') ||
    miolo.includes('ATIVIDADE RURAL')
  ) {
    return finalizar('ITEM_PLANO_ATIVIDADE_RURAL');
  }

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
  if (
    miolo.includes('EXTRATO DA CAF') ||
    miolo.includes('EXTRATO CAF') ||
    miolo.includes('CONSULTA CAF')
  ) {
    if (ehEnvolvidoSecundario) {
      return finalizar('CAD_5_CAF_ENVOLVIDO');
    }
    return finalizar('ITEM_EXTRATO_CAF');
  }
  if (/\b(CAF|DAP)\b/.test(miolo)) {
    // Se for CAF do Avalista, Procurador ou Cônjuge destes -> vai direto para a raiz da pasta CADASTRO!
    if (ehEnvolvidoSecundario) {
      return finalizar('CAD_5_CAF_ENVOLVIDO');
    }
    return finalizar('ITEM_CAF');
  }

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

  // Documentos Pessoais -> Raiz da Subpasta CADASTRO (Titular, Cônjuge, Avalista, Procurador e Cônjuges destes)
  if (
    miolo.includes('IDENTIDADE') ||
    miolo.includes('CNH') ||
    /\b(RG|CPF|CIN)\b/.test(miolo)
  ) {
    if (mencionaConjugeAvalista) {
      return finalizar('CAD_1_IDENTIDADE_CONJUGE_AVALISTA');
    }
    if (mencionaConjugeProcurador) {
      return finalizar('CAD_1_IDENTIDADE_CONJUGE_PROCURADOR');
    }
    if (mencionaAvalista) {
      return finalizar('CAD_1_IDENTIDADE_AVALISTA');
    }
    if (mencionaProcurador) {
      return finalizar('CAD_1_IDENTIDADE_PROCURADOR');
    }
    if (mencionaConjugeTitular) {
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
    miolo.includes('OBITO') ||
    miolo.includes('DIVORCIO') ||
    miolo.includes('AVERBACAO') ||
    miolo.includes('UNIAO ESTAVEL')
  ) {
    if (ehEnvolvidoSecundario) {
      return finalizar('CAD_2_CERTIDAO_ENVOLVIDO');
    }
    return finalizar('CAD_2_CERTIDAO_CASAMENTO');
  }

  if (
    miolo.includes('ENDERECO') ||
    miolo.includes('RESIDENCIA') ||
    miolo.includes('EQUATORIAL') ||
    miolo.includes('CAEMA')
  ) {
    if (ehEnvolvidoSecundario || mencionaConjugeTitular) {
      return finalizar('CAD_3_COMP_ENDERECO_ENVOLVIDO');
    }
    return finalizar('CAD_3_COMP_ENDERECO');
  }

  if (
    miolo.includes('RENDA') ||
    miolo.includes('IRPF') ||
    miolo.includes('IMPOSTO DE RENDA') ||
    miolo.includes('CONTRACHEQUE')
  ) {
    if (ehEnvolvidoSecundario || mencionaConjugeTitular) {
      return finalizar('CAD_4_COMP_RENDA_ENVOLVIDO');
    }
    return finalizar('CAD_4_COMP_RENDA');
  }

  if (miolo.includes('PROCURACAO')) {
    return finalizar('CAD_6_PROCURACAO');
  }

  if (
    nomeImovelEsp ||
    /\b(IMOVEL|FAZENDA|SITIO|CHACARA|GLEBA|LOTE|INCRA|CARTORIO|REGISTRO)\b/.test(
      miolo
    )
  ) {
    return finalizar('ITEM_DOC_IMOVEL_GENERICO');
  }

  return finalizar('OUTROS_NAO_IDENTIFICADO');
}

interface RegraItemPerfil {
  numeroPrefixo: string;
  rotuloBase: string;
  usaNomeProj?: boolean;
  usaNomePa?: boolean;
  usaNomeConjuge?: boolean;
  usaNomeImovelQuandoDisponivel?: boolean;
  semSufixoNome?: boolean;
  copiarParaSocioambientalComPrefixo?: string;
  copiarParaCadastroComPrefixo?: string;
}

// ============================================================================
// PERFIL 1: PRONAF A (INTOCADO CONFORME SOLICITADO)
// ============================================================================
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
    ITEM_DEC_NAO_TRABALHO_INFANTIL: {
      numeroPrefixo: '10.4.',
      rotuloBase: 'DEC. DE NÃO TRABALHO INFANTIL',
      copiarParaSocioambientalComPrefixo: '6.4.',
    },
    ITEM_DEC_OUTRA_AMBIENTAL: {
      numeroPrefixo: '10.5.',
      rotuloBase: 'DEC. AMBIENTAL COMPLEMENTAR',
      copiarParaSocioambientalComPrefixo: '6.5.',
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
    ITEM_DOC_IMOVEL_GENERICO: {
      numeroPrefixo: '13.1.',
      rotuloBase: 'DOC. DO IMÓVEL',
      usaNomeImovelQuandoDisponivel: true,
    },
  };
}

// ============================================================================
// KIT PADRÃO DE DOCUMENTAÇÃO DO IMÓVEL (1 A 9)
// Usado em:
// - CADASTRO/CADASTRO DO IMÓVEL (ou CADASTRO/CADASTRO DO IMÓVEL/FAZENDA X)
// - INVESTIMENTO/DOCUMENTAÇÃO DO IMÓVEL (ou .../FAZENDA X)
// - LCGH ou LCGA (na raiz quando 1 imóvel, ou em LCGH/FAZENDA X quando >1 imóvel)
// ============================================================================
function obterRegraKitImovel(
  cat: CategoriaDocPasta,
  nomeOriginal: string
): RegraItemPerfil | null {
  switch (cat) {
    case 'ITEM_CAR':
      return {
        numeroPrefixo: '1.',
        rotuloBase: 'CAR',
        usaNomeImovelQuandoDisponivel: true,
      };
    case 'ITEM_CONSULTA_CAR':
      return {
        numeroPrefixo: '2.',
        rotuloBase: 'CONSULTA AO CAR',
        usaNomeImovelQuandoDisponivel: true,
      };
    case 'ITEM_CCIR':
      return {
        numeroPrefixo: '2.',
        rotuloBase: 'CCIR',
        usaNomeImovelQuandoDisponivel: true,
      };
    case 'ITEM_CND_ITR_IMOVEL':
      return {
        numeroPrefixo: '3.',
        rotuloBase: 'ITR - CND DO IMÓVEL',
        usaNomeImovelQuandoDisponivel: true,
      };
    case 'ITEM_TITULO_DOMINIO':
      return {
        numeroPrefixo: '4.',
        rotuloBase: 'TÍTULO DE DOMÍNIO',
        usaNomeImovelQuandoDisponivel: true,
      };
    case 'ITEM_ECPV_ESCRITURA':
      return {
        numeroPrefixo: '5.',
        rotuloBase: 'ECPV',
        usaNomeImovelQuandoDisponivel: true,
      };
    case 'ITEM_INTEIRO_TEOR':
      return {
        numeroPrefixo: '6.',
        rotuloBase: 'INTEIRO TEOR',
        usaNomeImovelQuandoDisponivel: true,
      };
    case 'ITEM_DOC_IMOVEL_GENERICO':
      return {
        numeroPrefixo: '6.',
        rotuloBase: 'DOC. DO IMÓVEL',
        usaNomeImovelQuandoDisponivel: true,
      };
    case 'ITEM_SELO_IMOVEL': {
      const mNum = nomeOriginal.match(/SELO\s*(\d+)/i);
      const numSelo = mNum && mNum[1] ? ` ${mNum[1]}` : ' 1';
      return {
        numeroPrefixo: '6.',
        rotuloBase: `SELO${numSelo}`,
        usaNomeImovelQuandoDisponivel: true,
      };
    }
    case 'ITEM_MEMORIAL_DESCRITIVO':
      return {
        numeroPrefixo: '7.',
        rotuloBase: 'MEMORIAL DESCRITIVO',
        usaNomeImovelQuandoDisponivel: true,
      };
    case 'ITEM_LAUDO_INTERNO':
      return {
        numeroPrefixo: '8.',
        rotuloBase: 'LAUDO DE AVALIAÇÃO INTERNO',
        usaNomeImovelQuandoDisponivel: true,
      };
    case 'ITEM_LAUDO_EXTERNO':
      return {
        numeroPrefixo: '9.',
        rotuloBase: 'LAUDO DE AVALIAÇÃO EXTERNO',
        usaNomeImovelQuandoDisponivel: true,
      };
    default:
      return null;
  }
}

// ============================================================================
// PERFIL 2: RAIZ DA PASTA DE DERIVADA (INVESTIMENTO / CUSTEIO) — PRONAF V & MINI
// ============================================================================
function obterMapaRaizDerivadaPronafVMini(
  porte: PorteOrganizador
): Partial<Record<CategoriaDocPasta, RegraItemPerfil>> {
  const isPronafV = porte === 'PRONAF_V';
  return {
    ITEM_CONSOLIDADAS: {
      numeroPrefixo: '0.',
      rotuloBase: 'DECLARAÇÕES CONSOLIDADAS',
    },
    ...(isPronafV
      ? {
          ITEM_CAF: {
            numeroPrefixo: '0.',
            rotuloBase: 'CAF',
            copiarParaCadastroComPrefixo: '5.',
          },
          ITEM_EXTRATO_CAF: {
            numeroPrefixo: '0.1.',
            rotuloBase: 'EXTRATO DA CAF',
          },
        }
      : {}),
    ITEM_ARQ_ELETRONICO_PROJETO: {
      numeroPrefixo: '1.',
      rotuloBase: 'PROJETO',
    },
    ITEM_PROJETO_PDF: {
      numeroPrefixo: '2.',
      rotuloBase: 'PROJETO',
    },
    ITEM_ORCAMENTO: {
      numeroPrefixo: '2.',
      rotuloBase: 'ORÇAMENTO',
    },
    ITEM_CAPA_ANALISADOR: {
      numeroPrefixo: '3.',
      rotuloBase: 'CAPA DO ANALISADOR',
    },
    ITEM_CONTRATO_ASSESSORIA: {
      numeroPrefixo: '3.',
      rotuloBase: 'CONTRATO DE ASSESSORIA',
    },
    ITEM_CREA: {
      numeroPrefixo: '4.',
      rotuloBase: 'CREA',
      usaNomeProj: true,
    },
    ITEM_KML: {
      numeroPrefixo: '5.',
      rotuloBase: 'KML',
      usaNomeImovelQuandoDisponivel: true,
      copiarParaSocioambientalComPrefixo: '3.',
    },
    ITEM_PLANILHA_GEODESICA: {
      numeroPrefixo: '5.1.',
      rotuloBase: 'PLANILHA DE COORDENADAS GEODÉSICAS',
      usaNomeImovelQuandoDisponivel: true,
    },
    ITEM_CERT_SOCIO_COM_KML: {
      numeroPrefixo: '5.2.',
      rotuloBase: 'CERT. SOCIOAMBIENTAL COM KML',
      usaNomeImovelQuandoDisponivel: true,
      copiarParaSocioambientalComPrefixo: '4.',
    },
    ITEM_FICHA_SANITARIA: {
      numeroPrefixo: '6.',
      rotuloBase: 'FICHA SANITÁRIA',
    },
    ITEM_DCAA: {
      numeroPrefixo: '7.',
      rotuloBase: 'DCAA',
      copiarParaSocioambientalComPrefixo: '6.',
    },
    ITEM_CND_PF: {
      numeroPrefixo: '8.',
      rotuloBase: 'CND',
    },
    ITEM_CND_CONJUGE: {
      numeroPrefixo: '8.',
      rotuloBase: 'CND',
      usaNomeConjuge: true,
    },
    ITEM_CNDT_PF: {
      numeroPrefixo: '9.',
      rotuloBase: 'CNDT',
    },
    ITEM_CNDT_CONJUGE: {
      numeroPrefixo: '9.',
      rotuloBase: 'CNDT',
      usaNomeConjuge: true,
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
    ITEM_EXTRATO_SICOR: {
      numeroPrefixo: '12.',
      rotuloBase: 'EXTRATO SICOR',
    },
    ITEM_AUT_ALTERACAO: {
      numeroPrefixo: '13.',
      rotuloBase: 'AUTORIZAÇÃO DE MODIFICAÇÃO DO PROJETO',
    },
    ITEM_AUT_DEBITO_CONTA: {
      numeroPrefixo: '14.',
      rotuloBase: 'AUTORIZAÇÃO DE DÉBITO EM CONTA',
    },
    ITEM_DEC_AMBIENTAIS: {
      numeroPrefixo: '15.',
      rotuloBase: 'DECLARAÇÃO AMBIENTAL',
      copiarParaSocioambientalComPrefixo: '7.',
    },
    ITEM_DEC_REG_AMBIENTAL: {
      numeroPrefixo: '15.',
      rotuloBase: 'DECLARAÇÃO AMBIENTAL',
      copiarParaSocioambientalComPrefixo: '7.1.',
    },
    ITEM_DEC_REG_AMB_GARANTIDOR: {
      numeroPrefixo: '15.1.',
      rotuloBase: 'DECLARAÇÃO AMBIENTAL DO IMÓVEL GARANTIDOR',
      copiarParaSocioambientalComPrefixo: '7.4.',
    },
    ITEM_PLANO_ATIVIDADE_RURAL: {
      numeroPrefixo: '16.',
      rotuloBase: 'PLANO DE ATIVIDADE RURAL',
    },
    ITEM_PARECER_TECNICO: {
      numeroPrefixo: '17.',
      rotuloBase: 'PARECER TÉCNICO',
    },
    ITEM_PARECER_GERENCIAL: {
      numeroPrefixo: '18.',
      rotuloBase: 'PARECER GERENCIAL',
    },
  };
}

// ============================================================================
// PERFIL 3: RAIZ DA PASTA DE LIMITE (LCGH / LCGA)
// Dinâmico: Numeração 10..16 quando há 1 Imóvel na raiz, ou 2..8 quando há >1 Imóvel (em subpastas)
// ============================================================================
function obterMapaRaizLimiteLcg(
  modalidadeLim: ModalidadeLimite,
  temMultiplosImoveisGarantia: boolean
): Partial<Record<CategoriaDocPasta, RegraItemPerfil>> {
  const nDcaa = temMultiplosImoveisGarantia ? '2.' : '10.';
  const nCnd = temMultiplosImoveisGarantia ? '3.' : '11.';
  const nCndt = temMultiplosImoveisGarantia ? '4.' : '12.';
  const nEmb = temMultiplosImoveisGarantia ? '5.' : '13.';
  const nImp = temMultiplosImoveisGarantia ? '6.' : '14.';
  const nSicor = temMultiplosImoveisGarantia ? '7.' : '15.';
  const nDecAmb = temMultiplosImoveisGarantia ? '8.' : '16.';
  const nDecGar = temMultiplosImoveisGarantia ? '8.1.' : '16.1.';
  const nParGer = temMultiplosImoveisGarantia ? '9.' : '17.';

  return {
    ITEM_CERT_SOCIO_SEM_KML: {
      numeroPrefixo: '0.',
      rotuloBase: 'CERT. SOCIOAMBIENTAL SEM KML',
      usaNomeImovelQuandoDisponivel: temMultiplosImoveisGarantia,
      copiarParaSocioambientalComPrefixo: '3.',
    },
    ITEM_CONSOLIDADAS: {
      numeroPrefixo: '0.',
      rotuloBase: 'DECLARAÇÕES CONSOLIDADAS',
    },
    ITEM_SOLICITACAO_LIMITE: {
      numeroPrefixo: '0.',
      rotuloBase: `SOLICITAÇÃO DE ${modalidadeLim}`,
    },
    ITEM_DCAA: {
      numeroPrefixo: nDcaa,
      rotuloBase: 'DCAA',
      copiarParaSocioambientalComPrefixo: '5.',
    },
    ITEM_CND_PF: {
      numeroPrefixo: nCnd,
      rotuloBase: 'CND',
    },
    ITEM_CND_CONJUGE: {
      numeroPrefixo: nCnd,
      rotuloBase: 'CND',
      usaNomeConjuge: true,
    },
    ITEM_CNDT_PF: {
      numeroPrefixo: nCndt,
      rotuloBase: 'CNDT',
    },
    ITEM_CNDT_CONJUGE: {
      numeroPrefixo: nCndt,
      rotuloBase: 'CNDT',
      usaNomeConjuge: true,
    },
    ITEM_EMBARGOS_TITULAR: {
      numeroPrefixo: nEmb,
      rotuloBase: 'EMBARGOS',
      copiarParaSocioambientalComPrefixo: '4.',
    },
    ITEM_EMBARGOS_CONJUGE: {
      numeroPrefixo: nEmb,
      rotuloBase: 'EMBARGOS',
      usaNomeConjuge: true,
      copiarParaSocioambientalComPrefixo: '4.',
    },
    ITEM_IMPROBIDADE_TITULAR: {
      numeroPrefixo: nImp,
      rotuloBase: 'IMPROBIDADE',
    },
    ITEM_IMPROBIDADE_CONJUGE: {
      numeroPrefixo: nImp,
      rotuloBase: 'IMPROBIDADE',
      usaNomeConjuge: true,
    },
    ITEM_EXTRATO_SICOR: {
      numeroPrefixo: nSicor,
      rotuloBase: 'EXTRATO SICOR',
    },
    ITEM_DEC_AMBIENTAIS: {
      numeroPrefixo: nDecAmb,
      rotuloBase: 'DEC. DE REGULARIDADE AMBIENTAL',
      copiarParaSocioambientalComPrefixo: '6.',
    },
    ITEM_DEC_REG_AMBIENTAL: {
      numeroPrefixo: nDecAmb,
      rotuloBase: 'DEC. DE REGULARIDADE AMBIENTAL',
      copiarParaSocioambientalComPrefixo: '6.1.',
    },
    ITEM_DEC_REG_AMB_GARANTIDOR: {
      numeroPrefixo: nDecGar,
      rotuloBase: 'DEC. DE REG. AMBIENTAL DO IMÓVEL GARANTIDOR',
      copiarParaSocioambientalComPrefixo: '6.4.',
    },
    ITEM_PARECER_GERENCIAL: {
      numeroPrefixo: nParGer,
      rotuloBase: 'PARECER GERENCIAL',
    },
  };
}

// ============================================================================
// DECLARAÇÕES AMBIENTAIS COMPLEMENTARES QUE VÃO EXCLUSIVAMENTE PARA A SUBPASTA
// "CERTIFICAÇÃO SOCIOAMBIENTAL" (No PRONAF V, MINI e Limites)
// ============================================================================
function obterRegraExclusivaSubpastaSocioambiental(
  cat: CategoriaDocPasta
): RegraItemPerfil | null {
  switch (cat) {
    case 'ITEM_CAR':
      return {
        numeroPrefixo: '1.',
        rotuloBase: 'CAR',
        usaNomeImovelQuandoDisponivel: true,
      };
    case 'ITEM_CONSULTA_CAR':
      return {
        numeroPrefixo: '2.',
        rotuloBase: 'CONSULTA AO CAR',
        usaNomeImovelQuandoDisponivel: true,
      };
    case 'ITEM_DEC_NAO_DESMATAMENTO':
      return {
        numeroPrefixo: '7.2.',
        rotuloBase: 'DEC. DE NÃO DESMATAMENTO',
      };
    case 'ITEM_DEC_RECOMPOSICAO':
      return {
        numeroPrefixo: '7.3.',
        rotuloBase: 'DEC. DE RECOMPOSIÇÃO',
      };
    case 'ITEM_DEC_NAO_TRABALHO_INFANTIL':
      return {
        numeroPrefixo: '7.5.',
        rotuloBase: 'DEC. DE NÃO TRABALHO INFANTIL',
      };
    case 'ITEM_DEC_OUTRA_AMBIENTAL':
      return {
        numeroPrefixo: '7.6.',
        rotuloBase: 'DEC. AMBIENTAL COMPLEMENTAR',
      };
    default:
      return null;
  }
}

function formatarNomePadronizado(
  regra: RegraItemPerfil,
  item: {
    nomeOriginal: string;
    extensao: string;
    categoria: CategoriaDocPasta;
    isViti: boolean;
    subtipoAmbientalExtra?: string;
    nomeImovelEspecifico?: string;
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
    const sufixoArq = mExt
      ? mExt[1].toUpperCase()
      : `.${item.extensao || 'PRONAF'}`;
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

  const listaPessoasIgnorar = [
    nomes.titular,
    nomes.conjuge,
    nomes.procurador,
    nomes.avalista,
    cfg.titularNome,
    cfg.conjugeNome,
    cfg.procuradorNome,
    cfg.avalistaNome,
    cfg.projetistaNome,
  ];

  const nomeImovelArqValidado =
    item.nomeImovelEspecifico &&
    !ehNomeDePessoaEnvolvida(item.nomeImovelEspecifico, listaPessoasIgnorar)
      ? item.nomeImovelEspecifico
      : extrairNomeImovelDoNomeArquivo(
          item.nomeOriginal,
          cfg.imoveisExtraidosPdf,
          listaPessoasIgnorar
        );

  const nomeImovelArq = nomeImovelArqValidado;

  if (
    CATEGORIAS_KIT_IMOVEL.has(item.categoria) ||
    regra.usaNomeImovelQuandoDisponivel
  ) {
    const imovelPadrao =
      nomeImovelArq ||
      (cfg.imoveisExtraidosPdf && cfg.imoveisExtraidosPdf[0]?.nome) ||
      cfg.paOuImovelNome ||
      nomes.titular;
    const sufixoImovel = imovelPadrao.toUpperCase().trim();
    return `${prefNum} ${prefViti}${rotulo} - ${sufixoImovel}${ext}`;
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

// Retorna o nome da pasta OUTROS na raiz seguindo a sequência numérica do perfil ativo
// (Mantém sem número quando for PRONAF A Padrão)
export function obterNomePastaOutrosRaiz(cfg: ConfiguracaoPerfilPasta): string {
  if (cfg.porte === 'PRONAF_A' && cfg.escopo !== 'LIMITE_PURO') {
    return 'OUTROS';
  }
  if (cfg.escopo === 'COMBO_DERIVADA_E_LIMITE') {
    return '4. OUTROS';
  }
  return '2. OUTROS';
}

// Numera as pastas da raiz na sequência:
// 1. CADASTRO -> 2. LIMITE (LCGH/LCGA) -> 3. DERIVADA (INVESTIMENTO/CUSTEIO) -> 4. OUTROS
// (Mantém sem numeração quando for PRONAF A Padrão)
export function aplicarNumeracaoPastasRaiz(
  pastaRelativa: string,
  cfg: ConfiguracaoPerfilPasta
): string {
  const limpa = (pastaRelativa || '').trim();
  if (!limpa) return '';

  const partes = limpa.split('/').filter(Boolean);
  if (partes.length === 0) return '';

  // Remove eventual numeração anterior do 1º nível para recalcular de forma limpa
  const raizSemNumero = partes[0].replace(/^\d+\.\s*/, '').trim();
  const raizUp = removerAcentos(raizSemNumero).toUpperCase();

  // Quando for PRONAF A Padrão, mantém os nomes originais sem numeração
  if (cfg.porte === 'PRONAF_A' && cfg.escopo !== 'LIMITE_PURO') {
    partes[0] = raizSemNumero;
    return partes.join('/');
  }

  const isCombo = cfg.escopo === 'COMBO_DERIVADA_E_LIMITE';

  let novaRaiz = raizSemNumero;
  if (raizUp === 'CADASTRO') {
    novaRaiz = '1. CADASTRO';
  } else if (raizUp === 'LCGH' || raizUp === 'LCGA') {
    novaRaiz = `2. ${raizUp}`;
  } else if (raizUp === 'INVESTIMENTO' || raizUp === 'CUSTEIO') {
    novaRaiz = isCombo ? `3. ${raizUp}` : `2. ${raizUp}`;
  } else if (raizUp === 'OUTROS') {
    novaRaiz = isCombo ? '4. OUTROS' : '2. OUTROS';
  }

  partes[0] = novaRaiz;
  return partes.join('/');
}

export function calcularTodosDestinosDoArquivo(
  item: {
    nomeOriginal: string;
    extensao: string;
    categoria: CategoriaDocPasta;
    isViti: boolean;
    origemSubpasta?: string;
    subtipoAmbientalExtra?: string;
    nomeImovelEspecifico?: string;
    tagEnvolvidoEspecifico?: string;
  },
  cfg: ConfiguracaoPerfilPasta
): DestinoArquivoCalculado[] {
  return calcularTodosDestinosDoArquivoInterno(item, cfg).map((dest) => ({
    ...dest,
    pastaRelativa: aplicarNumeracaoPastasRaiz(dest.pastaRelativa, cfg),
  }));
}

function calcularTodosDestinosDoArquivoInterno(
  item: {
    nomeOriginal: string;
    extensao: string;
    categoria: CategoriaDocPasta;
    isViti: boolean;
    origemSubpasta?: string;
    subtipoAmbientalExtra?: string;
    nomeImovelEspecifico?: string;
    tagEnvolvidoEspecifico?: string;
  },
  cfg: ConfiguracaoPerfilPasta
): DestinoArquivoCalculado[] {
  if (item.categoria === 'IGNORAR') return [];

  const nomes = obterNomesCurtosDesambiguados({
    titularCompleto: cfg.titularNome,
    conjugeCompleto: cfg.conjugeNome,
    procuradorCompleto: cfg.procuradorNome,
    conjugeProcuradorCompleto: cfg.conjugeProcuradorNome,
    avalistaCompleto: cfg.avalistaNome,
    conjugeAvalistaCompleto: cfg.conjugeAvalistaNome,
  });

  const ext = item.extensao ? `.${item.extensao}` : '.pdf';
  const aceitaViti = CATEGORIAS_QUE_ACEITAM_VITI.has(item.categoria);
  const prefViti = item.isViti && aceitaViti ? 'VITI - ' : '';
  const tit = nomes.titular || 'CLIENTE';
  const conj = nomes.conjuge || 'CÔNJUGE';
  const aval = nomes.avalista || 'AVALISTA';
  const conjAval = nomes.conjugeAvalista || 'CÔNJUGE DO AVALISTA';
  const proc = nomes.procurador || 'PROCURADOR';
  const conjProc = nomes.conjugeProcurador || 'CÔNJUGE DO PROCURADOR';

  // Descobre automaticamente a tag da pessoa caso o arquivo seja de um envolvido (Avalista, Procurador ou Cônjuges)
  const resolverTagEnvolvidoDoItem = (padraoFallback: string): string => {
    if (item.tagEnvolvidoEspecifico) return item.tagEnvolvidoEspecifico;
    const nUp = removerAcentos(item.nomeOriginal).toUpperCase();
    if (
      /\b(CONJUGE|CONJ\.?|ESPOSA|MARIDO|COMPANHEIR[OA])\s+(?:D[OAE]\s+)?AVALISTA\b/.test(
        nUp
      )
    ) {
      return conjAval;
    }
    if (
      /\b(CONJUGE|CONJ\.?|ESPOSA|MARIDO|COMPANHEIR[OA])\s+(?:D[OAE]\s+)?PROCURADOR/.test(
        nUp
      )
    ) {
      return conjProc;
    }
    if (/\b(AVALISTA|FIADOR|INTERVENIENTE)\b/.test(nUp)) return aval;
    if (/\bPROCURADOR/.test(nUp)) return proc;
    if (/\b(CONJUGE|ESPOSA|MARIDO|COMPANHEIR[OA])\b/.test(nUp)) return conj;
    return (
      nomes.avalista ||
      nomes.procurador ||
      nomes.conjugeAvalista ||
      nomes.conjugeProcurador ||
      padraoFallback
    );
  };

  if (item.categoria === 'OUTROS_NAO_IDENTIFICADO') {
    const subOrigem = (item.origemSubpasta || '').trim();
    const subOrigemUp = subOrigem.toUpperCase();
    const PASTAS_OFICIAIS_RAIZ = new Set([
      'CADASTRO',
      'LCGH',
      'LCGA',
      'INVESTIMENTO',
      'CUSTEIO',
      'CERTIFICAÇÃO SOCIOAMBIENTAL',
      'DOCUMENTAÇÃO DO IMÓVEL',
      'DOCUMENTAÇÃO DO(S) IMÓVEL(IS)',
    ]);

    const subOrigemSemNum = subOrigem.replace(/^\d+\.\s*/, '').trim();
    const subOrigemSemNumUp = subOrigemSemNum.toUpperCase();

    let pastaDestinoOutros = 'OUTROS';
    if (subOrigemSemNum) {
      if (
        subOrigemSemNumUp === 'OUTROS' ||
        subOrigemSemNumUp.startsWith('OUTROS/')
      ) {
        pastaDestinoOutros = subOrigemSemNum;
      } else if (!PASTAS_OFICIAIS_RAIZ.has(subOrigemSemNumUp)) {
        pastaDestinoOutros = `OUTROS/${subOrigem}`;
      }
    }

    return [
      {
        pastaRelativa: pastaDestinoOutros,
        nomeArquivoFinal: item.nomeOriginal,
        ordemExibicao: 850,
      },
    ];
  }

  // Raiz da Subpasta CADASTRO (Documentos Pessoais do Titular, Cônjuge, Avalista, Procurador e Cônjuges destes)
  if (item.categoria.startsWith('CAD_')) {
    let nomeCad = '';
    let ordem = 300;
    const tagEnv = resolverTagEnvolvidoDoItem('ENVOLVIDO');
    const nOrigUp = removerAcentos(item.nomeOriginal).toUpperCase();

    switch (item.categoria) {
      case 'CAD_1_IDENTIDADE_TITULAR':
        nomeCad = `1. IDENTIDADE - ${tit}${ext}`;
        ordem = 301;
        break;
      case 'CAD_1_IDENTIDADE_CONJUGE':
        nomeCad = `1. IDENTIDADE - ${conj}${ext}`;
        ordem = 302;
        break;
      case 'CAD_1_IDENTIDADE_AVALISTA':
        nomeCad = `1. IDENTIDADE - ${aval}${ext}`;
        ordem = 302.2;
        break;
      case 'CAD_1_IDENTIDADE_CONJUGE_AVALISTA':
        nomeCad = `1. IDENTIDADE - ${conjAval}${ext}`;
        ordem = 302.4;
        break;
      case 'CAD_1_IDENTIDADE_PROCURADOR':
        nomeCad = `1. IDENTIDADE - ${proc}${ext}`;
        ordem = 302.6;
        break;
      case 'CAD_1_IDENTIDADE_CONJUGE_PROCURADOR':
        nomeCad = `1. IDENTIDADE - ${conjProc}${ext}`;
        ordem = 302.8;
        break;
      case 'CAD_1_IDENTIDADE_OUTRO':
        nomeCad = `1. IDENTIDADE - ${tagEnv}${ext}`;
        ordem = 303;
        break;
      case 'CAD_2_CERTIDAO_CASAMENTO': {
        const tipoCertTit = nOrigUp.includes('NASCIMENTO')
          ? 'CERTIDÃO DE NASCIMENTO'
          : nOrigUp.includes('OBITO')
          ? 'CERTIDÃO DE ÓBITO'
          : nOrigUp.includes('DIVORCIO')
          ? 'AVERBAÇÃO DE DIVÓRCIO'
          : 'CERTIDÃO DE CASAMENTO';
        nomeCad = `2. ${tipoCertTit} - ${tit}${ext}`;
        ordem = 304;
        break;
      }
      case 'CAD_2_CERTIDAO_ENVOLVIDO': {
        const tipoCertEnv = nOrigUp.includes('NASCIMENTO')
          ? 'CERTIDÃO DE NASCIMENTO'
          : nOrigUp.includes('OBITO')
          ? 'CERTIDÃO DE ÓBITO'
          : nOrigUp.includes('DIVORCIO')
          ? 'AVERBAÇÃO DE DIVÓRCIO'
          : 'CERTIDÃO DE CASAMENTO';
        nomeCad = `2. ${tipoCertEnv} - ${tagEnv}${ext}`;
        ordem = 304.5;
        break;
      }
      case 'CAD_3_COMP_ENDERECO':
        nomeCad = `3. COMPROVANTE DE ENDEREÇO - ${tit}${ext}`;
        ordem = 305;
        break;
      case 'CAD_3_COMP_ENDERECO_ENVOLVIDO':
        nomeCad = `3. COMPROVANTE DE ENDEREÇO - ${tagEnv}${ext}`;
        ordem = 305.5;
        break;
      case 'CAD_4_COMP_RENDA':
        nomeCad = `4. COMPROVANTE DE RENDA - ${tit}${ext}`;
        ordem = 306;
        break;
      case 'CAD_4_COMP_RENDA_ENVOLVIDO': {
        const rotRenda =
          nOrigUp.includes('IRPF') || nOrigUp.includes('IMPOSTO DE RENDA')
            ? 'IRPF - COMPROVANTE DE RENDA'
            : 'COMPROVANTE DE RENDA';
        nomeCad = `4. ${rotRenda} - ${tagEnv}${ext}`;
        ordem = 306.2;
        break;
      }
      case 'CAD_5_CAF_ENVOLVIDO':
        nomeCad = `5. CAF - ${tagEnv}${ext}`;
        ordem = 306.7;
        break;
      case 'CAD_5_PROPOSTA_CADASTRO':
        nomeCad = `6. ${prefViti}PROPOSTA DE CADASTRO - ${tit}${ext}`;
        ordem = 307;
        break;
      case 'CAD_5_PROPOSTA_CADASTRO_ENVOLVIDO':
        nomeCad = `6. ${prefViti}PROPOSTA DE CADASTRO - ${tagEnv}${ext}`;
        ordem = 307.5;
        break;
      case 'CAD_6_PROCURACAO':
        nomeCad = `7. PROCURAÇÃO - ${nomes.procurador || tit}${ext}`;
        ordem = 308;
        break;
      case 'CAD_8_SELO_CARTORIO':
        nomeCad = `8. SELO DE FISCALIZAÇÃO - ${
          item.tagEnvolvidoEspecifico || tit
        }${ext}`;
        ordem = 309;
        break;
      case 'CAD_9_DECLARACAO_ENVOLVIDO': {
        let rotDec = 'DECLARAÇÃO';
        if (nOrigUp.includes('CONSOLIDADA'))
          rotDec = 'DECLARAÇÕES CONSOLIDADAS';
        else if (nOrigUp.includes('SCR')) rotDec = 'AUTORIZAÇÃO CONSULTA SCR';
        else if (nOrigUp.includes('DEBITO')) rotDec = 'AUTORIZAÇÃO DE DÉBITO';
        else if (nOrigUp.includes('SICOR'))
          rotDec = 'AUTORIZAÇÃO CONSULTA SICOR';
        nomeCad = `9. ${prefViti}${rotDec} - ${tagEnv}${ext}`;
        ordem = 309.5;
        break;
      }
      default:
        nomeCad = `9. DOC. CADASTRAL (${tagEnv}) - ${item.nomeOriginal}`;
        ordem = 310;
        break;
    }
    return [
      {
        pastaRelativa: 'CADASTRO',
        nomeArquivoFinal: nomeCad,
        ordemExibicao: ordem + (item.isViti ? 0.25 : 0),
      },
    ];
  }

  const destinos: DestinoArquivoCalculado[] = [];

  // ==========================================================================
  // MODO 1: PRONAF A (Mantido 100% no padrão original 1..21)
  // ==========================================================================
  if (cfg.escopo === 'PRONAF_A_PADRAO' || cfg.porte === 'PRONAF_A') {
    const mapaPronafA = obterMapaRegrasDerivadaPronafA();
    const regra = mapaPronafA[item.categoria];
    if (!regra) return destinos;

    const numFloat =
      parseFloat(regra.numeroPrefixo.replace(/[^\d.]/g, '')) || 99;
    const ordemCalculada = numFloat * 10 + (item.isViti ? 0.5 : 0);
    const nomePrincipal = formatarNomePadronizado(regra, item, nomes, cfg);

    destinos.push({
      pastaRelativa: '',
      nomeArquivoFinal: nomePrincipal,
      ordemExibicao: ordemCalculada,
    });

    if (regra.copiarParaCadastroComPrefixo) {
      destinos.push({
        pastaRelativa: 'CADASTRO',
        nomeArquivoFinal: `${regra.copiarParaCadastroComPrefixo} CAF - ${tit}${ext}`,
        ordemExibicao: 306.5,
      });
    }

    if (regra.copiarParaSocioambientalComPrefixo) {
      destinos.push({
        pastaRelativa: 'CERTIFICAÇÃO SOCIOAMBIENTAL',
        nomeArquivoFinal: formatarNomePadronizado(
          regra,
          item,
          nomes,
          cfg,
          regra.copiarParaSocioambientalComPrefixo
        ),
        ordemExibicao: ordemCalculada + 0.1,
      });
    }

    return destinos;
  }

  // ==========================================================================
  // MODO 2: PRONAF V E MINI/PEQUENO (DERIVADA, LIMITE E COMBO)
  // ==========================================================================
  const imoveisLidos = cfg.imoveisExtraidosPdf || [];
  const imoveisGarantia = imoveisLidos.filter((i) => i.compoeGarantia);
  const imoveisBeneficiados = imoveisLidos.filter((i) => i.realizaInversao);

  const temMultiplosImoveisGeral = imoveisLidos.length > 1;
  const temMultiplosImoveisGarantia =
    imoveisGarantia.length > 1 ||
    (imoveisGarantia.length === 0 && temMultiplosImoveisGeral);
  const temMultiplosImoveisBenef =
    imoveisBeneficiados.length > 1 ||
    (imoveisBeneficiados.length === 0 && temMultiplosImoveisGeral);

  const listaPessoasIgnorarDest = [
    nomes.titular,
    nomes.conjuge,
    nomes.procurador,
    nomes.avalista,
    cfg.titularNome,
    cfg.conjugeNome,
    cfg.procuradorNome,
    cfg.avalistaNome,
    cfg.projetistaNome,
  ];

  const nomeImovelValidadoDest =
    item.nomeImovelEspecifico &&
    !ehNomeDePessoaEnvolvida(item.nomeImovelEspecifico, listaPessoasIgnorarDest)
      ? item.nomeImovelEspecifico
      : extrairNomeImovelDoNomeArquivo(
          item.nomeOriginal,
          imoveisLidos,
          listaPessoasIgnorarDest
        );

  const nomeImovelEspecificoArq = (
    nomeImovelValidadoDest ||
    imoveisLidos[0]?.nome ||
    cfg.paOuImovelNome ||
    tit
  )
    .toUpperCase()
    .trim();

  const ehDocKitImovel = CATEGORIAS_KIT_IMOVEL.has(item.categoria);
  const regraKitImovel = ehDocKitImovel
    ? obterRegraKitImovel(item.categoria, item.nomeOriginal)
    : null;

  // 1. Se for documento do Kit do Imóvel (CAR, Consulta CAR, CCIR, ITR, Título, ECPV, Inteiro Teor, Selos do Imóvel, Memorial, Laudos):
  // Vai SEMPRE para "CADASTRO/CADASTRO DO IMÓVEL" (ou "CADASTRO/CADASTRO DO IMÓVEL/FAZENDA X" se >1 imóvel)!
  if (regraKitImovel) {
    const nomeArqKit = formatarNomePadronizado(
      regraKitImovel,
      item,
      nomes,
      cfg
    );
    const numKit =
      parseFloat(regraKitImovel.numeroPrefixo.replace(/[^\d.]/g, '')) || 5;

    const pastaCadImovel = temMultiplosImoveisGeral
      ? `CADASTRO/CADASTRO DO IMÓVEL/${nomeImovelEspecificoArq}`
      : 'CADASTRO/CADASTRO DO IMÓVEL';

    destinos.push({
      pastaRelativa: pastaCadImovel,
      nomeArquivoFinal: nomeArqKit,
      ordemExibicao: 320 + numKit,
    });
  }

  // Função auxiliar para popular a pasta de DERIVADA (INVESTIMENTO ou CUSTEIO)
  const aplicarRegrasPastaDerivada = (pastaBaseDeriv: string, offset = 0) => {
    const mapaRaizDeriv = obterMapaRaizDerivadaPronafVMini(cfg.porte);
    const pastaSocioDeriv = pastaBaseDeriv
      ? `${pastaBaseDeriv}/CERTIFICAÇÃO SOCIOAMBIENTAL`
      : 'CERTIFICAÇÃO SOCIOAMBIENTAL';

    // A) Documentos do Kit do Imóvel vão para a subpasta "DOCUMENTAÇÃO DO IMÓVEL" (com subpasta FAZENDA X se >1 imóvel)
    if (regraKitImovel) {
      const nomeArqKit = formatarNomePadronizado(
        regraKitImovel,
        item,
        nomes,
        cfg
      );
      const numKit =
        parseFloat(regraKitImovel.numeroPrefixo.replace(/[^\d.]/g, '')) || 5;
      const baseDocImovel = pastaBaseDeriv
        ? `${pastaBaseDeriv}/DOCUMENTAÇÃO DO IMÓVEL`
        : 'DOCUMENTAÇÃO DO IMÓVEL';
      const pastaDocImovelFinal = temMultiplosImoveisBenef
        ? `${baseDocImovel}/${nomeImovelEspecificoArq}`
        : baseDocImovel;

      destinos.push({
        pastaRelativa: pastaDocImovelFinal,
        nomeArquivoFinal: nomeArqKit,
        ordemExibicao: offset + 200 + numKit,
      });
    }

    // B) Documentos que ficam na RAIZ da pasta da Derivada (0 a 18)
    const regraRaiz = mapaRaizDeriv[item.categoria];
    if (regraRaiz) {
      const numFloat =
        parseFloat(regraRaiz.numeroPrefixo.replace(/[^\d.]/g, '')) || 0;
      const ordemCalc = offset + numFloat * 10 + (item.isViti ? 0.5 : 0);
      const nomeRaiz = formatarNomePadronizado(regraRaiz, item, nomes, cfg);

      destinos.push({
        pastaRelativa: pastaBaseDeriv,
        nomeArquivoFinal: nomeRaiz,
        ordemExibicao: ordemCalc,
      });

      if (
        regraRaiz.copiarParaCadastroComPrefixo &&
        !destinos.some((d) => d.pastaRelativa === 'CADASTRO')
      ) {
        destinos.push({
          pastaRelativa: 'CADASTRO',
          nomeArquivoFinal: `${regraRaiz.copiarParaCadastroComPrefixo} CAF - ${tit}${ext}`,
          ordemExibicao: 306.5,
        });
      }

      if (regraRaiz.copiarParaSocioambientalComPrefixo) {
        destinos.push({
          pastaRelativa: pastaSocioDeriv,
          nomeArquivoFinal: formatarNomePadronizado(
            regraRaiz,
            item,
            nomes,
            cfg,
            regraRaiz.copiarParaSocioambientalComPrefixo
          ),
          ordemExibicao: ordemCalc + 0.1,
        });
      }
    }

    // C) Declarações Ambientais Complementares e CAR/Consulta CAR que vão para "CERTIFICAÇÃO SOCIOAMBIENTAL"
    const regraSocioExclusiva = obterRegraExclusivaSubpastaSocioambiental(
      item.categoria
    );
    if (regraSocioExclusiva) {
      const numFloat =
        parseFloat(regraSocioExclusiva.numeroPrefixo.replace(/[^\d.]/g, '')) ||
        7;
      destinos.push({
        pastaRelativa: pastaSocioDeriv,
        nomeArquivoFinal: formatarNomePadronizado(
          regraSocioExclusiva,
          item,
          nomes,
          cfg
        ),
        ordemExibicao: offset + 150 + numFloat,
      });
    }
  };

  // Função auxiliar para popular a pasta de LIMITE (LCGH ou LCGA)
  const aplicarRegrasPastaLimite = (pastaBaseLim: string, offset = 500) => {
    const mapaRaizLim = obterMapaRaizLimiteLcg(
      cfg.modalidadeLimite,
      temMultiplosImoveisGarantia
    );
    const pastaSocioLim = pastaBaseLim
      ? `${pastaBaseLim}/CERTIFICAÇÃO SOCIOAMBIENTAL`
      : 'CERTIFICAÇÃO SOCIOAMBIENTAL';

    // A) Documentos do Kit do Imóvel (1 a 9):
    // Se for 1 único imóvel dado em garantia -> ficam na RAIZ da pasta de Limite (1. a 9.)!
    // Se forem múltiplos imóveis dados em garantia -> cria subpasta para cada imóvel ("LCGH/FAZENDA X")!
    if (regraKitImovel) {
      const nomeArqKit = formatarNomePadronizado(
        regraKitImovel,
        item,
        nomes,
        cfg
      );
      const numKit =
        parseFloat(regraKitImovel.numeroPrefixo.replace(/[^\d.]/g, '')) || 5;
      const pastaImovelNoLimite = temMultiplosImoveisGarantia
        ? pastaBaseLim
          ? `${pastaBaseLim}/${nomeImovelEspecificoArq}`
          : nomeImovelEspecificoArq
        : pastaBaseLim;

      destinos.push({
        pastaRelativa: pastaImovelNoLimite,
        nomeArquivoFinal: nomeArqKit,
        ordemExibicao: offset + numKit * 10,
      });
    }

    // B) Documentos da Raiz do Limite (0., DCAA, CND, CNDT, Embargos, Improbidade, SICOR, Dec. Reg. Ambiental)
    let catLim = item.categoria;
    if (
      catLim === 'ITEM_CERT_SOCIO_COM_KML' &&
      cfg.escopo === 'LIMITE_PURO'
    ) {
      catLim = 'ITEM_CERT_SOCIO_SEM_KML';
    }
    const regraRaizLim = mapaRaizLim[catLim];
    if (regraRaizLim) {
      const numFloat =
        parseFloat(regraRaizLim.numeroPrefixo.replace(/[^\d.]/g, '')) || 0;
      const ordemCalc = offset + numFloat * 10 + (item.isViti ? 0.5 : 0);
      const nomeRaizLim = formatarNomePadronizado(
        regraRaizLim,
        item,
        nomes,
        cfg
      );

      destinos.push({
        pastaRelativa: pastaBaseLim,
        nomeArquivoFinal: nomeRaizLim,
        ordemExibicao: ordemCalc,
      });

      if (regraRaizLim.copiarParaSocioambientalComPrefixo) {
        destinos.push({
          pastaRelativa: pastaSocioLim,
          nomeArquivoFinal: formatarNomePadronizado(
            regraRaizLim,
            item,
            nomes,
            cfg,
            regraRaizLim.copiarParaSocioambientalComPrefixo
          ),
          ordemExibicao: ordemCalc + 0.1,
        });
      }
    }

    // C) Demais Declarações Ambientais e CAR/Consulta CAR vão para "LCGH/CERTIFICAÇÃO SOCIOAMBIENTAL"
    const regraSocioLim = obterRegraExclusivaSubpastaSocioambiental(
      item.categoria
    );
    if (regraSocioLim) {
      const numFloat =
        parseFloat(regraSocioLim.numeroPrefixo.replace(/[^\d.]/g, '')) || 6;
      destinos.push({
        pastaRelativa: pastaSocioLim,
        nomeArquivoFinal: formatarNomePadronizado(
          regraSocioLim,
          item,
          nomes,
          cfg
        ),
        ordemExibicao: offset + 180 + numFloat,
      });
    }
  };

  if (cfg.escopo === 'LIMITE_PURO') {
    aplicarRegrasPastaLimite('', 0);
  } else if (cfg.escopo === 'DERIVADA_PURA') {
    aplicarRegrasPastaDerivada('', 0);
  } else if (cfg.escopo === 'COMBO_DERIVADA_E_LIMITE') {
    aplicarRegrasPastaDerivada(cfg.modalidadeDerivada, 0);
    aplicarRegrasPastaLimite(cfg.modalidadeLimite, 500);
  }

  return destinos;
}

// ============================================================================
// GERADOR INTELIGENTE DE LEMBRETES .TXT POR PERFIL E POR SUBPASTA DE IMÓVEL
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

  const imoveisLidos = cfg.imoveisExtraidosPdf || [];
  const imoveisGarantia = imoveisLidos.filter((i) => i.compoeGarantia);
  const imoveisBeneficiados = imoveisLidos.filter((i) => i.realizaInversao);

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

  // ==========================================================================
  // MODO 1: PRONAF A (INTOCADO CONFORME SOLICITADO)
  // ==========================================================================
  if (cfg.porte === 'PRONAF_A' && registroConformidadePronafA) {
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
    if (cfg.statusContaConsolidada === 'FALTA') {
      add('9. FALTA CONTA CORRENTE NA CONSOLIDADA.txt');
    } else if (cfg.statusContaConsolidada !== 'OK') {
      add('9. VERIFICAR C-C NA CONSOLIDADA.txt');
    }
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
    if (
      cfg.modalidadeDerivada !== 'CUSTEIO' &&
      !categoriasPresentes.has('ITEM_CAPA_ANALISADOR')
    )
      add(`19. CAPA DO ANALISADOR - ${tit}.txt`);
    if (
      !categoriasPresentes.has('ITEM_PARECER_GERENCIAL') &&
      !parecerGerencialExtraidoNaPasta
    )
      add('20. FALTA PARECER GERENCIAL.txt');
    if (!categoriasPresentes.has('ITEM_PARECER_SEMA'))
      add('21. PARECER DA SEMA.txt');

    return lembretes;
  }

  // ==========================================================================
  // MODO 2: PRONAF V E MINI/PEQUENO (DERIVADA, LIMITE E COMBO)
  // ==========================================================================
  // Regra de Equivalência: ECPV (Escritura Pública de Compra e Venda) substitui a ausência de Título de Domínio e vice-versa!
  const temTituloOuEcpv =
    categoriasPresentes.has('ITEM_TITULO_DOMINIO') ||
    categoriasPresentes.has('ITEM_ECPV_ESCRITURA');

  const gerarTxtsKitImovelEmPasta = (
    pastaDestinoImovel: string,
    nomeImovelAlvo: string,
    exigeGarantiaHipotecaria: boolean
  ) => {
    const addIm = (txt: string) =>
      lembretes.push({
        pastaRelativa: pastaDestinoImovel,
        nomeArquivoTxt: txt,
      });

    if (!categoriasPresentes.has('ITEM_CAR'))
      addIm(`1. CAR - ${nomeImovelAlvo}.txt`);
    if (!categoriasPresentes.has('ITEM_CONSULTA_CAR'))
      addIm(`2. CONSULTA AO CAR - ${nomeImovelAlvo}.txt`);
    if (!categoriasPresentes.has('ITEM_CCIR'))
      addIm(`2. CCIR - ${nomeImovelAlvo}.txt`);
    if (!categoriasPresentes.has('ITEM_CND_ITR_IMOVEL'))
      addIm(`3. ITR - CND DO IMÓVEL - ${nomeImovelAlvo}.txt`);

    if (!temTituloOuEcpv) {
      addIm(`4. TÍTULO DE DOMÍNIO OU ECPV - ${nomeImovelAlvo}.txt`);
    }

    if (
      exigeGarantiaHipotecaria &&
      !categoriasPresentes.has('ITEM_INTEIRO_TEOR')
    ) {
      addIm(`6. INTEIRO TEOR (15 ANOS) - ${nomeImovelAlvo}.txt`);
    }

    if (
      cfg.imovelAvaliadoAcima600k &&
      exigeGarantiaHipotecaria &&
      !categoriasPresentes.has('ITEM_LAUDO_INTERNO')
    ) {
      addIm(
        `8. LAUDO DE AVALIAÇÃO INTERNO (ACIMA DE 600 MIL) - ${nomeImovelAlvo}.txt`
      );
    }

    if (
      exigeGarantiaHipotecaria &&
      !categoriasPresentes.has('ITEM_LAUDO_EXTERNO') &&
      !categoriasPresentes.has('ITEM_LAUDO_INTERNO')
    ) {
      addIm(`9. LAUDO DE AVALIAÇÃO EXTERNO - ${nomeImovelAlvo}.txt`);
    }
  };

  const gerarTxtsPastaDerivada = (pastaAlvo: string) => {
    const isPronafV = cfg.porte === 'PRONAF_V';
    const isCusteio = cfg.modalidadeDerivada === 'CUSTEIO';
    const temGarantiaImovel =
      cfg.garantiaDerivada === 'LCGH_LCGA' ||
      cfg.escopo === 'COMBO_DERIVADA_E_LIMITE' ||
      imoveisGarantia.length > 0;

    const listaImoveisDeriv =
      imoveisBeneficiados.length > 0
        ? imoveisBeneficiados.map((i) => i.nome)
        : imoveisLidos.length > 0
        ? imoveisLidos.map((i) => i.nome)
        : [pa];

    const add = (nomeTxt: string) =>
      lembretes.push({ pastaRelativa: pastaAlvo, nomeArquivoTxt: nomeTxt });

    const pastaSocioDeriv = pastaAlvo
      ? `${pastaAlvo}/CERTIFICAÇÃO SOCIOAMBIENTAL`
      : 'CERTIFICAÇÃO SOCIOAMBIENTAL';

    const addSocio = (nomeTxt: string) =>
      lembretes.push({
        pastaRelativa: pastaSocioDeriv,
        nomeArquivoTxt: nomeTxt,
      });

    // 1. Raiz da Pasta de Derivada (0 a 18)
    if (!categoriasPresentes.has('ITEM_CONSOLIDADAS')) {
      add(`0. DECLARAÇÕES CONSOLIDADAS - ${tit}.txt`);
    }
    if (cfg.statusContaConsolidada === 'FALTA') {
      add('0. FALTA CONTA CORRENTE NA CONSOLIDADA.txt');
    } else if (cfg.statusContaConsolidada !== 'OK') {
      add('0. VERIFICAR C-C NA CONSOLIDADA.txt');
    }

    if (isPronafV) {
      if (!categoriasPresentes.has('ITEM_CAF')) add(`0. CAF - ${tit}.txt`);
      if (!categoriasPresentes.has('ITEM_EXTRATO_CAF')) {
        add(`0.1. CONSULTAR EXTRATO DA CAF NO DIA - ${tit}.txt`);
      }
    }

    if (!categoriasPresentes.has('ITEM_ARQ_ELETRONICO_PROJETO')) {
      add(
        `1. PROJETO (${
          isCusteio ? '.CUSTEIO' : isPronafV ? '.PRONAF' : '.INVUR'
        }) - ${tit}.txt`
      );
    }
    if (!categoriasPresentes.has('ITEM_PROJETO_PDF')) {
      add(`2. PROJETO (PDF) - ${tit}.txt`);
    }
    if (
      !categoriasPresentes.has('ITEM_ORCAMENTO') &&
      !(isCusteio && categoriasPresentes.has('ITEM_PROJETO_PDF'))
    ) {
      add(`2. ORÇAMENTO - ${tit}.txt`);
    }
    // ITEM 1: Quando for CUSTEIO de qualquer porte, NÃO exige Capa do Analisador!
    if (!isCusteio && !categoriasPresentes.has('ITEM_CAPA_ANALISADOR')) {
      add(`3. CAPA DO ANALISADOR - ${tit}.txt`);
    }
    if (!categoriasPresentes.has('ITEM_CONTRATO_ASSESSORIA')) {
      add(`3. CONTRATO DE ASSESSORIA - ${tit}.txt`);
    }
    if (!categoriasPresentes.has('ITEM_CREA')) {
      add(`4. CREA - ${proj}.txt`);
    }

    if (!categoriasPresentes.has('ITEM_KML')) {
      listaImoveisDeriv.forEach((nIm) => add(`5. KML - ${nIm}.txt`));
    }
    if (isCusteio && !categoriasPresentes.has('ITEM_PLANILHA_GEODESICA')) {
      listaImoveisDeriv.forEach((nIm) =>
        add(`5.1. PLANILHA DE COORDENADAS GEODÉSICAS - ${nIm}.txt`)
      );
    }
    if (!categoriasPresentes.has('ITEM_CERT_SOCIO_COM_KML')) {
      listaImoveisDeriv.forEach((nIm) =>
        add(`5.2. CERT. SOCIOAMBIENTAL COM KML - ${nIm}.txt`)
      );
    }

    // Ficha Sanitária: sempre obrigatória em Custeio, ou em Investimento quando envolve aquisição de animais
    const exigeFichaSanitaria =
      isCusteio || cfg.envolveAnimaisNoInvestimento !== false;
    if (
      exigeFichaSanitaria &&
      !categoriasPresentes.has('ITEM_FICHA_SANITARIA')
    ) {
      add(`6. FICHA SANITÁRIA - ${tit}.txt`);
    }

    if (!categoriasPresentes.has('ITEM_DCAA')) {
      add(`7. DCAA - ${tit}.txt`);
    }
    if (!categoriasPresentes.has('ITEM_CND_PF')) {
      add(`8. CND - ${tit}.txt`);
    }
    if (conj && !categoriasPresentes.has('ITEM_CND_CONJUGE')) {
      add(`8. CND - ${conj}.txt`);
    }
    if (!categoriasPresentes.has('ITEM_CNDT_PF')) {
      add(`9. CNDT - ${tit}.txt`);
    }
    if (conj && !categoriasPresentes.has('ITEM_CNDT_CONJUGE')) {
      add(`9. CNDT - ${conj}.txt`);
    }
    if (!categoriasPresentes.has('ITEM_EMBARGOS_TITULAR')) {
      add(`10. EMBARGOS - ${tit}.txt`);
    }
    if (conj && !categoriasPresentes.has('ITEM_EMBARGOS_CONJUGE')) {
      add(`10. EMBARGOS - ${conj}.txt`);
    }
    if (!categoriasPresentes.has('ITEM_IMPROBIDADE_TITULAR')) {
      add(`11. IMPROBIDADE - ${tit}.txt`);
    }
    if (conj && !categoriasPresentes.has('ITEM_IMPROBIDADE_CONJUGE')) {
      add(`11. IMPROBIDADE - ${conj}.txt`);
    }
    if (!categoriasPresentes.has('ITEM_EXTRATO_SICOR')) {
      add(`12. EXTRATO SICOR - ${tit}.txt`);
    }
    if (!categoriasPresentes.has('ITEM_AUT_ALTERACAO')) {
      add(`13. AUTORIZAÇÃO DE MODIFICAÇÃO DO PROJETO - ${tit}.txt`);
    }
    // Nota: 14. AUTORIZAÇÃO DE DÉBITO EM CONTA é opcional (já consta na Consolidada), portanto não gera lembrete!

    if (
      !categoriasPresentes.has('ITEM_DEC_REG_AMBIENTAL') &&
      !categoriasPresentes.has('ITEM_DEC_AMBIENTAIS')
    ) {
      add(`15. DECLARAÇÃO AMBIENTAL - ${tit}.txt`);
    }
    if (
      temGarantiaImovel &&
      !categoriasPresentes.has('ITEM_DEC_REG_AMB_GARANTIDOR')
    ) {
      add(`15.1. DECLARAÇÃO AMBIENTAL DO IMÓVEL GARANTIDOR - ${tit}.txt`);
    }

    // Parecer Técnico NÃO é obrigatório em PRONAF V (apenas em MINI/PEQUENO)
    if (!isPronafV && !categoriasPresentes.has('ITEM_PARECER_TECNICO')) {
      add(`17. PARECER TÉCNICO - ${tit}.txt`);
    }

    if (
      !categoriasPresentes.has('ITEM_PARECER_GERENCIAL') &&
      !parecerGerencialExtraidoNaPasta
    ) {
      add('18. FALTA PARECER GERENCIAL.txt');
    }

    // 2. Subpasta CERTIFICAÇÃO SOCIOAMBIENTAL (Apenas as declarações obrigatórias: Não Desmatamento e Recomposição)
    // As declarações excedentes/opcionais (Retificação CAR, Sobreposição, Não Exploração, Não Trabalho Infantil) NÃO geram lembrete!
    if (!categoriasPresentes.has('ITEM_DEC_NAO_DESMATAMENTO')) {
      addSocio(`7.2. DEC. DE NÃO DESMATAMENTO - ${tit}.txt`);
    }
    if (!categoriasPresentes.has('ITEM_DEC_RECOMPOSICAO')) {
      addSocio(`7.3. DEC. DE RECOMPOSIÇÃO - ${tit}.txt`);
    }

    // 3. Subpasta DOCUMENTAÇÃO DO IMÓVEL (e subpastas FAZENDA X, FAZENDA Y quando >1 imóvel)
    const baseDocImovel = pastaAlvo
      ? `${pastaAlvo}/DOCUMENTAÇÃO DO IMÓVEL`
      : 'DOCUMENTAÇÃO DO IMÓVEL';

    listaImoveisDeriv.forEach((nIm) => {
      const subIm =
        listaImoveisDeriv.length > 1 ? `${baseDocImovel}/${nIm}` : baseDocImovel;
      gerarTxtsKitImovelEmPasta(subIm, nIm, temGarantiaImovel);
    });
  };

  const gerarTxtsPastaLimite = (pastaAlvo: string) => {
    const listaImoveisLim =
      imoveisGarantia.length > 0
        ? imoveisGarantia.map((i) => i.nome)
        : imoveisLidos.length > 0
        ? imoveisLidos.map((i) => i.nome)
        : [pa];

    const multiImoveis = listaImoveisLim.length > 1;

    const add = (nomeTxt: string) =>
      lembretes.push({ pastaRelativa: pastaAlvo, nomeArquivoTxt: nomeTxt });

    const pastaSocioLim = pastaAlvo
      ? `${pastaAlvo}/CERTIFICAÇÃO SOCIOAMBIENTAL`
      : 'CERTIFICAÇÃO SOCIOAMBIENTAL';

    const addSocio = (nomeTxt: string) =>
      lembretes.push({
        pastaRelativa: pastaSocioLim,
        nomeArquivoTxt: nomeTxt,
      });

    // Itens 0. na Raiz do Limite
    if (
      !categoriasPresentes.has('ITEM_CERT_SOCIO_SEM_KML') &&
      !categoriasPresentes.has('ITEM_CERT_SOCIO_COM_KML')
    ) {
      if (multiImoveis) {
        listaImoveisLim.forEach((nIm) =>
          add(`0. CERT. SOCIOAMBIENTAL SEM KML - ${nIm}.txt`)
        );
      } else {
        add(`0. CERT. SOCIOAMBIENTAL SEM KML - ${tit}.txt`);
      }
    }
    if (!categoriasPresentes.has('ITEM_CONSOLIDADAS')) {
      add(`0. DECLARAÇÕES CONSOLIDADAS - ${tit}.txt`);
    }
    if (cfg.statusContaConsolidada === 'FALTA') {
      add('0. FALTA CONTA CORRENTE NA CONSOLIDADA.txt');
    } else if (cfg.statusContaConsolidada !== 'OK') {
      add('0. VERIFICAR C-C NA CONSOLIDADA.txt');
    }

    if (!categoriasPresentes.has('ITEM_SOLICITACAO_LIMITE')) {
      add(`0. SOLICITAÇÃO DE ${cfg.modalidadeLimite} - ${tit}.txt`);
    }

    // Kit de Documentação do(s) Imóvel(is) Dado(s) em Garantia (1 a 9):
    // Se 1 imóvel -> direto na raiz do Limite; se >1 imóvel -> dentro da subpasta de cada Fazenda!
    listaImoveisLim.forEach((nIm) => {
      const pastaImovelLim = multiImoveis
        ? pastaAlvo
          ? `${pastaAlvo}/${nIm}`
          : nIm
        : pastaAlvo;
      gerarTxtsKitImovelEmPasta(pastaImovelLim, nIm, true);
    });

    // Demais itens da Raiz do Limite (10..17 quando 1 imóvel | 2..9 quando >1 imóvel)
    const nDcaa = multiImoveis ? '2.' : '10.';
    const nCnd = multiImoveis ? '3.' : '11.';
    const nCndt = multiImoveis ? '4.' : '12.';
    const nEmb = multiImoveis ? '5.' : '13.';
    const nImp = multiImoveis ? '6.' : '14.';
    const nSicor = multiImoveis ? '7.' : '15.';
    const nDecAmb = multiImoveis ? '8.' : '16.';
    const nDecGar = multiImoveis ? '8.1.' : '16.1.';
    const nParGer = multiImoveis ? '9.' : '17.';

    if (!categoriasPresentes.has('ITEM_DCAA'))
      add(`${nDcaa} DCAA - ${tit}.txt`);
    if (!categoriasPresentes.has('ITEM_CND_PF'))
      add(`${nCnd} CND - ${tit}.txt`);
    if (conj && !categoriasPresentes.has('ITEM_CND_CONJUGE'))
      add(`${nCnd} CND - ${conj}.txt`);
    if (!categoriasPresentes.has('ITEM_CNDT_PF'))
      add(`${nCndt} CNDT - ${tit}.txt`);
    if (conj && !categoriasPresentes.has('ITEM_CNDT_CONJUGE'))
      add(`${nCndt} CNDT - ${conj}.txt`);
    if (!categoriasPresentes.has('ITEM_EMBARGOS_TITULAR'))
      add(`${nEmb} EMBARGOS - ${tit}.txt`);
    if (conj && !categoriasPresentes.has('ITEM_EMBARGOS_CONJUGE'))
      add(`${nEmb} EMBARGOS - ${conj}.txt`);
    if (!categoriasPresentes.has('ITEM_IMPROBIDADE_TITULAR'))
      add(`${nImp} IMPROBIDADE - ${tit}.txt`);
    if (conj && !categoriasPresentes.has('ITEM_IMPROBIDADE_CONJUGE'))
      add(`${nImp} IMPROBIDADE - ${conj}.txt`);
    if (!categoriasPresentes.has('ITEM_EXTRATO_SICOR'))
      add(`${nSicor} EXTRATO SICOR - ${tit}.txt`);
    if (
      !categoriasPresentes.has('ITEM_DEC_REG_AMBIENTAL') &&
      !categoriasPresentes.has('ITEM_DEC_AMBIENTAIS')
    ) {
      add(`${nDecAmb} DEC. DE REGULARIDADE AMBIENTAL - ${tit}.txt`);
    }
    if (!categoriasPresentes.has('ITEM_DEC_REG_AMB_GARANTIDOR')) {
      add(
        `${nDecGar} DEC. DE REG. AMBIENTAL DO IMÓVEL GARANTIDOR - ${tit}.txt`
      );
    }
    if (
      !categoriasPresentes.has('ITEM_PARECER_GERENCIAL') &&
      !parecerGerencialExtraidoNaPasta
    ) {
      add(`${nParGer} FALTA PARECER GERENCIAL.txt`);
    }

    // Declarações obrigatórias dentro de LCGH/CERTIFICAÇÃO SOCIOAMBIENTAL
    if (!categoriasPresentes.has('ITEM_DEC_NAO_DESMATAMENTO')) {
      addSocio(`6.2. DEC. DE NÃO DESMATAMENTO - ${tit}.txt`);
    }
    if (!categoriasPresentes.has('ITEM_DEC_RECOMPOSICAO')) {
      addSocio(`6.3. DEC. DE RECOMPOSIÇÃO - ${tit}.txt`);
    }
  };

  // Também garante os lembretes na subpasta "CADASTRO/CADASTRO DO IMÓVEL"
  const listaTodosImoveis =
    imoveisLidos.length > 0 ? imoveisLidos.map((i) => i.nome) : [pa];
  const exigeGarantiaGeral =
    cfg.escopo === 'LIMITE_PURO' ||
    cfg.escopo === 'COMBO_DERIVADA_E_LIMITE' ||
    cfg.garantiaDerivada === 'LCGH_LCGA';

  listaTodosImoveis.forEach((nIm) => {
    const pastaCadIm =
      listaTodosImoveis.length > 1
        ? `CADASTRO/CADASTRO DO IMÓVEL/${nIm}`
        : 'CADASTRO/CADASTRO DO IMÓVEL';
    gerarTxtsKitImovelEmPasta(pastaCadIm, nIm, exigeGarantiaGeral);
  });

  if (cfg.escopo === 'LIMITE_PURO') {
    gerarTxtsPastaLimite('');
  } else if (cfg.escopo === 'DERIVADA_PURA') {
    gerarTxtsPastaDerivada('');
  } else if (cfg.escopo === 'COMBO_DERIVADA_E_LIMITE') {
    gerarTxtsPastaDerivada(cfg.modalidadeDerivada);
    gerarTxtsPastaLimite(cfg.modalidadeLimite);
  }

  // ITEM 5: Se houver documentos assinados digitalmente na pasta sem o respectivo relatório VITI,
  // gera o lembrete .TXT seguindo exatamente a pasta e a numeração do arquivo de origem!
  if (cfg.categoriasFaltandoViti && cfg.categoriasFaltandoViti.size > 0) {
    cfg.categoriasFaltandoViti.forEach((catSemViti) => {
      const destinosViti = calcularTodosDestinosDoArquivo(
        {
          nomeOriginal: 'DOCUMENTO.pdf',
          extensao: 'txt',
          categoria: catSemViti,
          isViti: true,
        },
        cfg
      );

      destinosViti.forEach((dest) => {
        // Evita duplicar lembrete de VITI dentro da subpasta de cópia socioambiental se já colocou na pasta principal
        if (dest.pastaRelativa.includes('CERTIFICAÇÃO SOCIOAMBIENTAL')) return;
        const nomeTxtViti = dest.nomeArquivoFinal
          .replace(/\bVITI\s*-\s*/i, 'FALTA VITI - ')
          .replace(/\.pdf$/i, '.txt');
        if (
          !lembretes.some(
            (l) =>
              aplicarNumeracaoPastasRaiz(l.pastaRelativa, cfg) ===
                dest.pastaRelativa && l.nomeArquivoTxt === nomeTxtViti
          )
        ) {
          lembretes.push({
            pastaRelativa: dest.pastaRelativa,
            nomeArquivoTxt: nomeTxtViti,
          });
        }
      });
    });
  }

  return lembretes.map((l) => ({
    ...l,
    pastaRelativa: aplicarNumeracaoPastasRaiz(l.pastaRelativa, cfg),
  }));
}