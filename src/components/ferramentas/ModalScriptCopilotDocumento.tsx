'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  CategoriaDocPasta,
  PorteOrganizador,
  EscopoOperacaoPasta,
  ModalidadeDerivada,
  ModalidadeLimite,
} from '@/lib/motorPerfisOrganizadorPastas';

export interface ContextoPropostaParaCopilot {
  nomeArquivo: string;
  categoria: CategoriaDocPasta;
  porte: PorteOrganizador;
  escopo: EscopoOperacaoPasta;
  modalidadeDerivada: ModalidadeDerivada;
  modalidadeLimite?: ModalidadeLimite;
  titularNome: string;
  titularCpf?: string;
  estadoCivil?: string;
  conjugeNome?: string;
  conjugeCpf?: string;
  imovelNome?: string;
  areaEsperadaHa?: string;
  valorProposta?: string;
  prazoMeses?: string;
  carenciaMeses?: string;
  imovelAcima600k?: boolean;
}

export type TipoTemplateCopilot =
  | 'AUTO'
  | 'INTEIRO_TEOR'
  | 'TITULO_DOMINIO_ECPV'
  | 'PROJETO_TECNICO'
  | 'CERT_SOCIOAMBIENTAL'
  | 'LAUDO_AVALIACAO'
  | 'PROCURACAO_CASAMENTO'
  | 'GERAL_VALIDADE';

export interface DadosExtraidosRespostaCopilot {
  valorFinanciado?: string;
  prazoMeses?: string;
  carenciaMeses?: string;
  contaCorrente?: string;
  estadoCivil?: string;
  conjugeNome?: string;
  conjugeCpf?: string;
  conjugeNasc?: string;
  titularNasc?: string;
  areaHa?: string;
  itensInversao?: string;
}

function detectarTemplateIdealCopilot(
  cat: CategoriaDocPasta,
  nomeArquivo: string
): Exclude<TipoTemplateCopilot, 'AUTO'> {
  const nUp = (nomeArquivo || '').toUpperCase();
  if (
    cat === 'ITEM_INTEIRO_TEOR' ||
    cat === 'ITEM_DOC_IMOVEL_GENERICO' ||
    nUp.includes('INTEIRO TEOR') ||
    nUp.includes('MATRICULA') ||
    nUp.includes('MATRÍCULA')
  ) {
    return 'INTEIRO_TEOR';
  }
  if (
    cat === 'ITEM_TITULO_DOMINIO' ||
    cat === 'ITEM_ECPV_ESCRITURA' ||
    nUp.includes('TITULO') ||
    nUp.includes('TÍTULO') ||
    nUp.includes('ESCRITURA') ||
    nUp.includes('ECPV')
  ) {
    return 'TITULO_DOMINIO_ECPV';
  }
  if (
    cat === 'ITEM_PROJETO_PDF' ||
    cat === 'ITEM_ORCAMENTO' ||
    cat === 'ITEM_SOLICITACAO_LIMITE' ||
    nUp.includes('PROJETO') ||
    nUp.includes('ORCAMENTO') ||
    nUp.includes('ORÇAMENTO')
  ) {
    return 'PROJETO_TECNICO';
  }
  if (
    cat === 'ITEM_CERT_SOCIO_COM_KML' ||
    cat === 'ITEM_CERT_SOCIO_SEM_KML' ||
    nUp.includes('SOCIOAMBIENTAL') ||
    nUp.includes('CERT. SOCIO')
  ) {
    return 'CERT_SOCIOAMBIENTAL';
  }
  if (
    cat === 'ITEM_LAUDO_INTERNO' ||
    cat === 'ITEM_LAUDO_EXTERNO' ||
    nUp.includes('LAUDO')
  ) {
    return 'LAUDO_AVALIACAO';
  }
  if (
    cat === 'CAD_6_PROCURACAO' ||
    cat === 'CAD_2_CERTIDAO_CASAMENTO' ||
    nUp.includes('PROCURACAO') ||
    nUp.includes('PROCURAÇÃO') ||
    nUp.includes('CASAMENTO')
  ) {
    return 'PROCURACAO_CASAMENTO';
  }
  return 'GERAL_VALIDADE';
}

function gerarScriptAuditoriaCopilot(
  ctx: ContextoPropostaParaCopilot,
  templateForcado: TipoTemplateCopilot = 'AUTO'
): { tituloTemplate: string; promptTexto: string } {
  const hoje = new Date().toLocaleDateString('pt-BR');
  const tpl =
    templateForcado === 'AUTO'
      ? detectarTemplateIdealCopilot(ctx.categoria, ctx.nomeArquivo)
      : templateForcado;

  const porteLegivel =
    ctx.porte === 'PRONAF_A'
      ? 'PRONAF A (Reforma Agrária)'
      : ctx.porte === 'PRONAF_V'
      ? 'PRONAF V (Agricultura Familiar Comum)'
      : 'FNE MINI / PEQUENO PRODUTOR';

  const escopoLegivel =
    ctx.escopo === 'LIMITE_PURO'
      ? `Abertura de Limite Garantido (${ctx.modalidadeLimite || 'LCGH/LCGA'})`
      : ctx.escopo === 'COMBO_DERIVADA_E_LIMITE'
      ? `Combo: Operação Derivada (${ctx.modalidadeDerivada}) + Limite (${
          ctx.modalidadeLimite || 'LCGH/LCGA'
        })`
      : `Operação Derivada (${ctx.modalidadeDerivada})`;

  const cabecalhoContexto = [
    `Você é um Auditor Sênior de Crédito Rural e Conformidade Jurídico-Documental do Banco do Nordeste (BNB).`,
    `Data de referência da auditoria (Hoje): ${hoje}.`,
    ``,
    `📌 DADOS DA PROPOSTA EM ANÁLISE NO SISTEMA:`,
    `- Documento anexado para leitura: "${ctx.nomeArquivo}"`,
    `- Porte / Programa: ${porteLegivel}`,
    `- Escopo da Operação: ${escopoLegivel}`,
    `- Cliente (Titular): ${ctx.titularNome || 'Não informado'}${
      ctx.titularCpf ? ` | CPF: ${ctx.titularCpf}` : ''
    }`,
    `- Estado Civil esperado: ${ctx.estadoCivil || 'Conferir no documento'}${
      ctx.conjugeNome
        ? ` | Cônjuge/Companheiro(a): ${ctx.conjugeNome}${
            ctx.conjugeCpf ? ` (CPF: ${ctx.conjugeCpf})` : ''
          }`
        : ''
    }`,
    `- Imóvel Rural / P.A. de referência: ${
      ctx.imovelNome || 'Conferir no documento'
    }${
      ctx.areaEsperadaHa
        ? ` | Área esperada no projeto: ${ctx.areaEsperadaHa} ha`
        : ''
    }`,
    ctx.valorProposta
      ? `- Valor Financiado previsto: R$ ${ctx.valorProposta}`
      : '',
  ]
    .filter(Boolean)
    .join('\n');

  if (tpl === 'INTEIRO_TEOR') {
    return {
      tituloTemplate:
        '🏡 Auditoria de Certidão de Inteiro Teor (15 Anos, Aquisição, Matrículas de Origem e Validade 30 Dias)',
      promptTexto: `${cabecalhoContexto}

🔍 TAREFA DE AUDITORIA PROFUNDA — CERTIDÃO DE INTEIRO TEOR DA MATRÍCULA:
Analise minuciosamente todas as páginas desta Certidão de Inteiro Teor (incluindo textos escaneados, carimbos, atos R- e AV- e rodapé de emissão) e responda de forma estruturada aos 7 itens obrigatórios abaixo:

1. IDENTIFICAÇÃO DA MATRÍCULA E IMÓVEL:
   - Qual é o número da Matrícula, o Livro (ex.: Livro 2 - Registro Geral), a Folha, a Comarca/Cartório, o nome do imóvel rural e a área (em ha) descrita na matrícula? Bate com a área esperada (${
     ctx.areaEsperadaHa ? `${ctx.areaEsperadaHa} ha` : 'informada no projeto'
   })?

2. VALIDADE DA CERTIDÃO (REGRA DOS 30 DIAS):
   - Qual a data de emissão/expedição desta certidão (geralmente na última página junto à assinatura/selo)?
   - Considerando que hoje é ${hoje}, quantos dias se passaram desde a emissão? Está VÁLIDA (≤ 30 dias) ou VENCIDA (> 30 dias)?

3. PROPRIETÁRIO ATUAL, FORMA DE AQUISIÇÃO E REGISTRO:
   - Quem consta como proprietário(a) atual no último registro de domínio? Confere com o titular (${
     ctx.titularNome || 'Cliente'
   }) e seu estado civil/cônjuge?
   - COMO o imóvel foi adquirido pelo titular (Compra e Venda, Doação, Herança/Formal de Partilha, Título de Domínio, Usucapião, Desmembramento)?
   - Em qual ato exato (ex.: R-1, R-3, AV-2, data e livro) essa aquisição está devidamente registrada?

4. CADEIA DOMINIAL DE 15 ANOS (REGRA CRÍTICA DE GARANTIA / PROPRIEDADE):
   - Qual é a data de abertura desta matrícula ou do primeiro registro dominial nela contido?
   - O histórico contido NESTA certidão completa pelo menos 15 ANOS de cadeia dominial até hoje (${hoje})?

5. MATRÍCULAS ANTERIORES / DE ORIGEM (CASO NÃO COMPLETE 15 ANOS):
   - Se esta matrícula tiver menos de 15 anos de aberta, identifique no texto de abertura quais são os números das MATRÍCULAS ANTERIORES / MATRÍCULAS DE ORIGEM (ou Transcrições e Livros anteriores) citadas das quais este imóvel foi desmembrado ou originado.
   - Indique exatamente qual(is) matrícula(s) anterior(es) devemos solicitar ao projetista para fechar a cadeia de 15 anos.

6. ÔNUS, GRAVAMES, PENHORAS OU CLÁUSULAS RESTRITIVAS:
   - Existe alguma hipoteca vigente sem averbação de baixa, alienação fiduciária a terceiros, penhora, bloqueio judicial, usufruto ou cláusula de inalienabilidade ativa?
   - Informe também o(s) código(s) do(s) Selo(s) de Fiscalização Cartorária presentes no documento.

7. VEREDITO FINAL E MENSAGEM PRONTA PARA O PROJETISTA (SE HOUVER PENDÊNCIA):
   - Dê o veredito: [APROVADO] ou [COM PENDÊNCIA].
   - Se faltar completar os 15 anos, se estiver vencida (> 30 dias) ou houver divergência de área/proprietário/baixa de hipoteca, escreva uma MENSAGEM PRONTA, curta e técnica para eu copiar e enviar no WhatsApp do projetista cobrando exatamente o documento ou matrícula anterior que falta.`,
    };
  }

  if (tpl === 'TITULO_DOMINIO_ECPV') {
    return {
      tituloTemplate:
        '📜 Auditoria de Título de Domínio / ECPV (Cláusula de Inalienabilidade × LCGH vs. LCGA)',
      promptTexto: `${cabecalhoContexto}

🔍 TAREFA DE AUDITORIA PROFUNDA — TÍTULO DE DOMÍNIO / ESCRITURA PÚBLICA (ECPV):
Analise integralmente o documento anexado e verifique obrigatoriamente:

1. DADOS DO TÍTULO / ESCRITURA E REGISTRO EM CARTÓRIO:
   - Qual o órgão emissor/outorgante (INCRA, ITERMA, Estado, Particular), número do Título/Escritura, nome do outorgado(a), nome do imóvel/lote e área em hectares?
   - Consta carimbo ou certidão de que este Título/ECPV já foi devidamente REGISTRADO no Cartório de Registro de Imóveis (informar nº da Matrícula e Livro 2)?

2. AUDITORIA DA CLÁUSULA DE INALIENABILIDADE (REGRA CRÍTICA LCGH vs. LCGA):
   - Verifique nas cláusulas/condições resolutivas se consta CLÁUSULA DE INALIENABILIDADE ou bloqueio de negociação/alienação.
   - Qual é o PRAZO de inalienabilidade especificado no texto (geralmente 10 anos contados da emissão/outorga, ou outro prazo fixado no documento)?
   - Qual é a DATA DE EMISSÃO / EXPEDIÇÃO deste Título de Domínio?
   - Faça o cálculo até hoje (${hoje}): o prazo de inalienabilidade JÁ TRANSCORREU (imóvel liberado) ou AINDA ESTÁ VIGENTE (informe em que data/ano exato se encerrará)?
   - ⚠️ REGRA DO BANCO: Se houver Cláusula de Inalienabilidade ainda vigente, este imóvel NÃO PODE SER DADO EM GARANTIA POR LCGA (Alienação Fiduciária), sendo permitido SOMENTE POR LCGH (Hipoteca). Diga expressamente se a operação pode usar LCGA ou se está restrita exclusivamente a LCGH!

3. MENSAGEM PARA O PROJETISTA (SE HOUVER PENDÊNCIA OU IMPEDIMENTO DE LCGA):
   - Caso haja impedimento para LCGA, falta de registro no Cartório de Imóveis ou divergência de titular/cônjuge/área, redija um texto curto pronto para WhatsApp orientando o projetista sobre o ajuste necessário.`,
    };
  }

  if (tpl === 'PROJETO_TECNICO') {
    return {
      tituloTemplate:
        '🚜 Extração Cirúrgica de Projeto Técnico / Orçamento (Tabelas em Quadrinhos, Inversões, Prazo e Carência)',
      promptTexto: `${cabecalhoContexto}

🔍 TAREFA DE EXTRAÇÃO E AUDITORIA — PROJETO TÉCNICO / PLANO DE NEGÓCIO / ORÇAMENTO:
Como os quadros deste PDF possuem formatação não linear ("em quadrinhos"), extraia com 100% de precisão todos os dados abaixo e valide a conformidade:

1. DADOS CADASTRAIS DO TITULAR E DO CÔNJUGE / COMPANHEIRO(A):
   - Nome completo, CPF, Data de Nascimento e Estado Civil do(a) Cliente.
   - Abaixo de "Dados Cadastrais Cônjuge / Companheira(o) do(a) Cliente": extraia Nome completo, CPF e Data de Nascimento do(a) Cônjuge.

2. CÁLCULO DO FINANCIAMENTO (VALOR, PRAZO, CARÊNCIA E JUROS):
   - Valor Total do Orçamento/Investimento (R$) e Valor Total Financiado (R$).
   - Prazo Total de Reembolso (em meses e em anos).
   - Prazo de Carência (em meses e em anos).
   - Periodicidade de pagamento (Anual/Mensal), Taxa de Juros (% a.a.) e Fonte de Recursos / Programa.

3. TABELA DE ITENS DE INVERSÃO / PROGRAMA DE INVESTIMENTOS:
   - Liste CADA ITEM financiado no projeto com: Discriminação exata, Quantidade, Unidade (ha, unid, m, cab, etc.), Valor Unitário (R$) e Valor Financiado (R$).
   - Verifique se há aquisição de animais/semoventes (para fins de exigência de Ficha Sanitária AGED).

4. IMÓVEIS VINCULADOS E GARANTIAS:
   - Liste todos os imóveis citados no projeto (Nome da Fazenda/Sítio/P.A., Município, Matrícula/Título, Área Total em ha, se "Realiza Inversão = Sim/Não" e se "Compõe Garantia = Sim/Não").
   - Quem é o Elaborador / Projetista técnico e se o documento está assinado pelo Cliente e pelo Elaborador.

5. BLOCO DE SINCRONIZAÇÃO AUTOMÁTICA COM O SISTEMA:
Ao final da sua resposta, inclua obrigatoriamente este bloco preenchido exatamente neste formato para eu colar de volta no meu sistema:
[DADOS_SISTEMA]
VALOR_FINANCIADO: (apenas números e vírgula, ex: 80.000,00)
PRAZO_MESES: (apenas números, ex: 120)
CARENCIA_MESES: (apenas números, ex: 36)
CONTA_CORRENTE: (número da conta com dígito se constar, ou VAZIO)
ESTADO_CIVIL: (SOLTEIRO(A), CASADO(A) ou UNIÃO ESTÁVEL)
CONJUGE_NOME: (nome completo ou VAZIO)
CONJUGE_CPF: (000.000.000-00 ou VAZIO)
CONJUGE_NASC: (DD/MM/AAAA ou VAZIO)
TITULAR_NASC: (DD/MM/AAAA ou VAZIO)
AREA_HA: (ex: 45,20)
ITENS_INVERSAO: (uma linha por item no formato: - QTD UNID de DESCRIÇÃO: R$ VALOR)
[/DADOS_SISTEMA]`,
    };
  }

  if (tpl === 'CERT_SOCIOAMBIENTAL') {
    return {
      tituloTemplate:
        '🌿 Auditoria de Relatório de Conformidade / Certificação Socioambiental (PRODES, RL, CAR e Glebas)',
      promptTexto: `${cabecalhoContexto}

🔍 TAREFA DE AUDITORIA — RELATÓRIO DE CONFORMIDADE / CERTIFICAÇÃO SOCIOAMBIENTAL:
Verifique todos os quadros do relatório anexado e informe:
1. TIPO DE CERTIFICAÇÃO: Possui o quadro de "Glebas" (COM KML - exigido para Derivadas de Investimento/Custeio) ou é SEM KML (usado para Limite LCGH/LCGA)?
2. DADOS DO CAR E ÁREA: Qual o número do Recibo CAR, a Situação do CAR (Ativo/Pendente/Cancelado), a Área Total do CAR (ha) e o percentual de Reserva Legal (%)?
3. DESMATAMENTO PRODES E EMBARGOS: Consta desmatamento PRODES? Se sim, qual a área (ha) e o ano (antes ou após 22/07/2008)? Consta embargo IBAMA/ICMBio ou sobreposição impeditiva (Terra Indígena, Unidade de Conservação, Quilombola)?
4. DECLARAÇÕES AMBIENTAIS EXIGIDAS: Com base nos apontamentos deste relatório, quais declarações ambientais são obrigatórias para instruir a pasta?`,
    };
  }

  if (tpl === 'LAUDO_AVALIACAO') {
    return {
      tituloTemplate:
        '📐 Auditoria de Laudo de Avaliação do Imóvel (Valor de Avaliação, R$ 600 mil e Garantia)',
      promptTexto: `${cabecalhoContexto}

🔍 TAREFA DE AUDITORIA — LAUDO DE AVALIAÇÃO DO IMÓVEL RURAL:
1. Qual o Nome do Imóvel, Matrícula, Município e Área Total (ha) avaliada?
2. Qual o VALOR TOTAL DE AVALIAÇÃO do imóvel (R$) e a data do laudo?
3. O valor de avaliação é igual ou superior a R$ 600.000,00? (Lembrando que imóveis ≥ R$ 600 mil exigem Laudo de Avaliação Interno elaborado por técnico do Banco).
4. O laudo foi emitido por projetista externo (convalidação) ou técnico interno do BNB, e está devidamente assinado?`,
    };
  }

  if (tpl === 'PROCURACAO_CASAMENTO') {
    return {
      tituloTemplate:
        '⚖️ Auditoria de Procuração Pública / Certidão de Casamento e Selos Cartorários',
      promptTexto: `${cabecalhoContexto}

🔍 TAREFA DE AUDITORIA — PROCURAÇÃO / CERTIDÃO DE ESTADO CIVIL:
1. Qual o tipo do documento, Cartório emissor, Livro, Folha, Termo e Data de lavratura/emissão?
2. Quem são as partes (Outorgante e Outorgado na Procuração, ou Cônjuges e Regime de Bens na Certidão de Casamento)? Extraia CPF e Data de Nascimento de ambos.
3. Se for Procuração: é Pública? Possui poderes específicos e vigentes para contratar operações de crédito rural/assinar cédulas e constituir garantias junto ao Banco do Nordeste?
4. Qual é o número do SELO DE FISCALIZAÇÃO CARTORÁRIA (TJMA/TJ) impresso no documento para conferência de autenticidade?`,
    };
  }

  return {
    tituloTemplate:
      '🔎 Auditoria Geral de Documento, Validade, Titularidade e Assinaturas',
    promptTexto: `${cabecalhoContexto}

🔍 TAREFA DE AUDITORIA DOCUMENTAL COMPLETA:
Analise o documento anexado ("${ctx.nomeArquivo}") e responda de forma direta:
1. QUE DOCUMENTO É ESTE: Qual o título oficial e a finalidade deste documento?
2. PERTINÊNCIA E TITULARIDADE: Os nomes, CPFs, datas de nascimento, números de matrícula/CAR/NIRF/CIB e áreas pertencem ao cliente (${
      ctx.titularNome || 'Titular'
    }), seu cônjuge ou ao imóvel (${ctx.imovelNome || 'Imóvel da proposta'})? Extraia o CPF e a Data de Nascimento se constarem no texto.
3. DATA DE EMISSÃO E PRAZO DE VALIDADE: Qual a data de emissão e a data de vencimento/validade (considerando hoje = ${hoje})? Faltam quantos dias para vencer?
4. ASSINATURAS E AUTENTICIDADE: O documento está assinado (física ou digitalmente via Gov.br/ICP-Brasil) ou possui selo/código de validação?
5. VEREDITO E COBRANÇA: Está 100% conforme as regras de crédito rural do BNB ou há alguma divergência/pendência? Se houver erro, escreva uma mensagem curta pronta para enviar ao projetista no WhatsApp.`,
  };
}

function extrairDadosDaRespostaDoCopilot(
  textoResposta: string
): DadosExtraidosRespostaCopilot {
  if (!textoResposta || !textoResposta.trim()) return {};
  const resultado: DadosExtraidosRespostaCopilot = {};

  const mValor = textoResposta.match(/VALOR_FINANCIADO:\s*([^\r\n]+)/i);
  if (mValor && !mValor[1].includes('VAZIO')) {
    resultado.valorFinanciado = mValor[1].replace(/[^\d.,]/g, '').trim();
  }

  const mPrazo = textoResposta.match(/PRAZO_MESES:\s*(\d{1,3})/i);
  if (mPrazo) resultado.prazoMeses = mPrazo[1].trim();

  const mCar = textoResposta.match(/CARENCIA_MESES:\s*(\d{1,2})/i);
  if (mCar) resultado.carenciaMeses = mCar[1].trim();

  const mCc =
    textoResposta.match(/CONTA_CORRENTE:\s*([^\r\n]+)/i) ||
    textoResposta.match(
      /livre\s+movimenta[çc][ãa]o\s+de\s+n[úu]mero\s*:?\s*([0-9.\-X]{4,12})/i
    );
  if (mCc && !mCc[1].toUpperCase().includes('VAZIO')) {
    resultado.contaCorrente = mCc[1].trim();
  }

  const mEst = textoResposta.match(/ESTADO_CIVIL:\s*([^\r\n]+)/i);
  if (mEst && !mEst[1].includes('VAZIO')) {
    resultado.estadoCivil = mEst[1].trim().toUpperCase();
  }

  const mConjN = textoResposta.match(/CONJUGE_NOME:\s*([^\r\n]+)/i);
  if (mConjN && !mConjN[1].toUpperCase().includes('VAZIO')) {
    resultado.conjugeNome = mConjN[1].trim().toUpperCase();
  }

  const mConjCpf = textoResposta.match(
    /CONJUGE_CPF:\s*(\d{3}\.?\d{3}\.?\d{3}-?\d{2})/i
  );
  if (mConjCpf) resultado.conjugeCpf = mConjCpf[1].trim();

  const mConjNasc = textoResposta.match(
    /CONJUGE_NASC:\s*(\d{2}\/\d{2}\/\d{4})/i
  );
  if (mConjNasc) resultado.conjugeNasc = mConjNasc[1].trim();

  const mTitNasc = textoResposta.match(
    /TITULAR_NASC:\s*(\d{2}\/\d{2}\/\d{4})/i
  );
  if (mTitNasc) resultado.titularNasc = mTitNasc[1].trim();

  const mArea = textoResposta.match(/AREA_HA:\s*([0-9.,]+)/i);
  if (mArea) resultado.areaHa = mArea[1].trim();

  const mItens = textoResposta.match(
    /ITENS_INVERSAO:\s*([\s\S]+?)(?:\[\/DADOS_SISTEMA\]|$)/i
  );
  if (mItens && mItens[1].trim()) {
    resultado.itensInversao = mItens[1].trim();
  }

  return resultado;
}

interface ModalScriptCopilotDocumentoProps {
  aberto: boolean;
  onFechar: () => void;
  contexto: ContextoPropostaParaCopilot;
  fileObj?: File | null;
  onAbrirLocalArquivo?: () => void;
  onImportarDadosDoCopilot?: (dados: DadosExtraidosRespostaCopilot) => void;
}

export default function ModalScriptCopilotDocumento({
  aberto,
  onFechar,
  contexto,
  fileObj,
  onAbrirLocalArquivo,
  onImportarDadosDoCopilot,
}: ModalScriptCopilotDocumentoProps) {
  const [templateAtivo, setTemplateAtivo] =
    useState<TipoTemplateCopilot>('AUTO');
  const [promptEditavel, setPromptEditavel] = useState('');
  const [tituloTemplate, setTituloTemplate] = useState('');
  const [feedbackCopia, setFeedbackCopia] = useState('');
  const [copiandoImagem, setCopiandoImagem] = useState(false);
  const [respostaColadaCopilot, setRespostaColadaCopilot] = useState('');

  useEffect(() => {
    if (!aberto) return;
    const gerado = gerarScriptAuditoriaCopilot(contexto, templateAtivo);
    setTituloTemplate(gerado.tituloTemplate);
    setPromptEditavel(gerado.promptTexto);
  }, [aberto, contexto, templateAtivo]);

  const mostrarAviso = (msg: string) => {
    setFeedbackCopia(msg);
    setTimeout(() => setFeedbackCopia(''), 5000);
  };

  const copiarPromptParaTransferencia = async () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(promptEditavel);
        mostrarAviso(
          '✅ Script copiado! Agora basta anexar o PDF no Copilot e pressionar Ctrl+V!'
        );
      } catch {
        mostrarAviso('⚠️ Permissão de área de transferência bloqueada.');
      }
    }
  };

  const copiarPromptEAbrirLocalDoPdf = async () => {
    await copiarPromptParaTransferencia();
    if (onAbrirLocalArquivo) {
      onAbrirLocalArquivo();
    }
  };

  const copiarPdfComoImagemParaCopilot = async () => {
    if (!fileObj) return;
    const win = window as any;
    const pdfjsLib = win.pdfjsLib;
    if (!pdfjsLib || !navigator.clipboard || !window.ClipboardItem) {
      mostrarAviso(
        '⚠️ Seu navegador não suporta cópia direta de imagem ou o PDF.js ainda não carregou.'
      );
      return;
    }

    setCopiandoImagem(true);
    try {
      const buffer = await fileObj.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: buffer.slice(0) }).promise;
      const numPags = Math.min(pdf.numPages || 1, 4);
      const canvases: HTMLCanvasElement[] = [];
      let larguraMax = 0;
      let alturaTotal = 0;

      for (let p = 1; p <= numPags; p++) {
        const page = await pdf.getPage(p);
        const vp = page.getViewport({ scale: 1.65 });
        const c = document.createElement('canvas');
        c.width = vp.width;
        c.height = vp.height;
        const ctx = c.getContext('2d');
        if (ctx) {
          await page.render({ canvasContext: ctx, viewport: vp }).promise;
          canvases.push(c);
          if (vp.width > larguraMax) larguraMax = vp.width;
          alturaTotal += vp.height + 12;
        }
      }

      const canvasFinal = document.createElement('canvas');
      canvasFinal.width = larguraMax;
      canvasFinal.height = alturaTotal;
      const ctxFinal = canvasFinal.getContext('2d');
      if (ctxFinal) {
        ctxFinal.fillStyle = '#ffffff';
        ctxFinal.fillRect(0, 0, larguraMax, alturaTotal);
        let yOffset = 0;
        for (const c of canvases) {
          ctxFinal.drawImage(c, 0, yOffset);
          yOffset += c.height + 12;
        }
      }

      const blob: Blob | null = await new Promise((res) =>
        canvasFinal.toBlob(res, 'image/png')
      );
      if (blob) {
        await navigator.clipboard.write([
          new window.ClipboardItem({ 'image/png': blob }),
        ]);
        mostrarAviso(
          `📸 Imagem das ${numPags} página(s) copiada! Vá no Copilot, dê Ctrl+V para colar a imagem do documento e depois clique em "Copiar Script"!`
        );
      }
    } catch (err) {
      console.error('Erro ao copiar imagem do PDF:', err);
      mostrarAviso(
        '⚠️ Não foi possível converter como imagem. Use o botão de anexar o arquivo PDF.'
      );
    } finally {
      setCopiandoImagem(false);
    }
  };

  if (!aberto || typeof document === 'undefined') return null;

  return createPortal(
    <div
      onClick={onFechar}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 23, 42, 0.78)',
        zIndex: 10000050,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backdropFilter: 'blur(3px)',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#ffffff',
          width: '94vw',
          maxWidth: '880px',
          maxHeight: '92vh',
          borderRadius: '12px',
          borderTop: '5px solid #2563eb',
          boxShadow: '0 25px 55px rgba(0,0,0,0.5)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '12px 20px',
            background: 'linear-gradient(90deg, #1e3a8a 0%, #2563eb 100%)',
            color: '#ffffff',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <div>
            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 900 }}>
              🤖 ASSISTENTE DE AUDITORIA P/ MICROSOFT COPILOT — SCRIPT DINÂMICO
            </h3>
            <span style={{ fontSize: '11px', color: '#dbeafe' }}>
              Documento alvo: <b>{contexto.nomeArquivo}</b> • {tituloTemplate}
            </span>
          </div>

          <button
            type="button"
            onClick={onFechar}
            style={{
              width: 'auto',
              background: 'rgba(255,255,255,0.18)',
              color: '#ffffff',
              border: 'none',
              borderRadius: '6px',
              padding: '5px 12px',
              fontSize: '12px',
              fontWeight: 800,
              cursor: 'pointer',
            }}
          >
            ✖ Fechar
          </button>
        </div>

        <div
          style={{
            padding: '14px 20px',
            overflowY: 'auto',
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
              gap: '8px',
              background: '#f8fafc',
              padding: '8px 12px',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <label
                style={{
                  fontSize: '11.5px',
                  fontWeight: 800,
                  color: '#1e3a8a',
                  margin: 0,
                }}
              >
                🎯 Regras do Script:
              </label>
              <select
                value={templateAtivo}
                onChange={(e) =>
                  setTemplateAtivo(e.target.value as TipoTemplateCopilot)
                }
                style={{
                  width: 'auto',
                  height: '32px',
                  padding: '4px 10px',
                  fontSize: '11.5px',
                  fontWeight: 800,
                  borderRadius: '6px',
                  border: '1px solid #93c5fd',
                  color: '#0f172a',
                }}
              >
                <option value="AUTO">
                  ⚡ Automático pelo Tipo do Documento
                </option>
                <option value="INTEIRO_TEOR">
                  🏡 Inteiro Teor da Matrícula (15 Anos, Aquisição, Origem e 30
                  Dias)
                </option>
                <option value="TITULO_DOMINIO_ECPV">
                  📜 Título de Domínio / ECPV (Inalienabilidade 10 Anos × LCGH vs
                  LCGA)
                </option>
                <option value="PROJETO_TECNICO">
                  🚜 Projeto Técnico / Orçamento (Extrair Quadrinhos, Inversões,
                  Prazo e Carência)
                </option>
                <option value="CERT_SOCIOAMBIENTAL">
                  🌿 Certificação Socioambiental (PRODES, RL, CAR e Glebas)
                </option>
                <option value="LAUDO_AVALIACAO">
                  📐 Laudo de Avaliação do Imóvel (Valor e Regra R$ 600 mil)
                </option>
                <option value="PROCURACAO_CASAMENTO">
                  ⚖️ Procuração / Certidão de Casamento e Selos
                </option>
                <option value="GERAL_VALIDADE">
                  🔎 Qualquer Documento / Certidão (Validade, Titularidade e
                  Críticas)
                </option>
              </select>
            </div>

            <a
              href="https://copilot.microsoft.com/"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                padding: '6px 12px',
                background: '#0f172a',
                color: '#ffffff',
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: 800,
                textDecoration: 'none',
              }}
            >
              ↗️ Abrir Copilot
            </a>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1.2fr 1.2fr 1fr',
              gap: '8px',
            }}
          >
            <button
              type="button"
              onClick={copiarPromptParaTransferencia}
              style={{
                width: '100%',
                padding: '10px 12px',
                background: '#2563eb',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: 900,
                cursor: 'pointer',
                boxShadow: '0 3px 8px rgba(37, 99, 235, 0.3)',
              }}
            >
              📋 1. Copiar Script p/ Ctrl+V
            </button>

            {onAbrirLocalArquivo && (
              <button
                type="button"
                onClick={copiarPromptEAbrirLocalDoPdf}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  background: '#15803d',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '11.5px',
                  fontWeight: 900,
                  cursor: 'pointer',
                }}
                title="Copia o Script e já abre a pasta do Windows onde este PDF está para você arrastar para o Copilot!"
              >
                📂 Copiar Script + Abrir Pasta do PDF
              </button>
            )}

            {fileObj && (
              <button
                type="button"
                disabled={copiandoImagem}
                onClick={copiarPdfComoImagemParaCopilot}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  background: '#7c3aed',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '11.5px',
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
                title="Copia as primeiras páginas do PDF como Imagem para você colar direto com Ctrl+V na caixa de texto do Copilot!"
              >
                {copiandoImagem
                  ? '⏳ Gerando Imagem...'
                  : '📸 Copiar PDF como Imagem (Ctrl+V)'}
              </button>
            )}
          </div>

          {feedbackCopia && (
            <div
              style={{
                background: '#dcfce7',
                color: '#166534',
                border: '1px solid #86efac',
                padding: '7px 12px',
                borderRadius: '6px',
                fontSize: '11.5px',
                fontWeight: 800,
                textAlign: 'center',
              }}
            >
              {feedbackCopia}
            </div>
          )}

          <div>
            <label
              style={{
                fontSize: '11px',
                fontWeight: 800,
                color: '#334155',
                display: 'block',
                marginBottom: '4px',
              }}
            >
              📝 Script Gerado Sob Medida (Você pode editar antes de copiar se
              desejar):
            </label>
            <textarea
              rows={12}
              value={promptEditavel}
              onChange={(e) => setPromptEditavel(e.target.value)}
              style={{
                width: '100%',
                fontSize: '11.5px',
                lineHeight: 1.4,
                fontFamily: 'monospace',
                padding: '10px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                background: '#f8fafc',
                color: '#0f172a',
              }}
            />
          </div>

          {onImportarDadosDoCopilot && (
            <div
              style={{
                background: '#fffbeb',
                border: '1px solid #fcd34d',
                borderRadius: '8px',
                padding: '10px 12px',
              }}
            >
              <strong
                style={{
                  fontSize: '11.5px',
                  color: '#92400e',
                  display: 'block',
                  marginBottom: '4px',
                }}
              >
                🔄 Opcional — Importar Resposta do Copilot para o Raio-X /
                Parecer:
              </strong>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <textarea
                  rows={2}
                  value={respostaColadaCopilot}
                  onChange={(e) => setRespostaColadaCopilot(e.target.value)}
                  placeholder="Se você usou o Script de Projeto Técnico, cole aqui a resposta do Copilot para atualizar automaticamente Valor, Prazo, Carência, Cônjuge e Itens de Inversão no sistema..."
                  style={{
                    flex: 1,
                    fontSize: '11px',
                    padding: '6px 8px',
                    borderRadius: '6px',
                    border: '1px solid #f59e0b',
                    background: '#ffffff',
                  }}
                />
                <button
                  type="button"
                  disabled={!respostaColadaCopilot.trim()}
                  onClick={() => {
                    const extraidos = extrairDadosDaRespostaDoCopilot(
                      respostaColadaCopilot
                    );
                    onImportarDadosDoCopilot(extraidos);
                    mostrarAviso(
                      '✅ Dados da resposta do Copilot importados para o Raio-X e Parecer!'
                    );
                    setRespostaColadaCopilot('');
                  }}
                  style={{
                    width: 'auto',
                    height: '44px',
                    padding: '0 14px',
                    background: '#b45309',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '11px',
                    fontWeight: 900,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  ⚡ Aplicar no Sistema
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}