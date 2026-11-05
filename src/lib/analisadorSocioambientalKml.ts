// src/lib/analisadorSocioambientalKml.ts

export interface GlebaSocioambientalItem {
  id: string;
  nomeArea: string; // Ex: "Area 1"
  itemKml: string; // Ex: "PASTAGEM", "CURRAL", "CERCA"
  tamanhoHa: string;
  percentualNoCar: string;
  possuiSobreposicao: 'NÃO' | 'SIM';
  sobreposicoesDetalhe: string[];
}

export interface DadosExtraidosSocioambientalKml {
  dataAnalise: string;
  areaCarHa: string;
  areaConsolidadaHa: string;
  areaConsolidadaPerc: string;
  pastagemTotalHa: string;
  pastagemTotalPerc: string;
  appHa: string;
  appPerc: string;
  reservaLegalHa: string;
  reservaLegalPerc: string;
  trabalhoEscravo: 'NÃO' | 'SIM' | '';
  alertasAmbientais: 'NÃO' | 'SIM' | '';
  embargosAmbientais: 'NÃO' | 'SIM' | '';
  desmatamentoProdes: 'NÃO' | 'SIM' | '';
  desmatamentoProdesObs: string;
  carContiguo: 'NÃO' | 'SIM' | '';
  sobreposicaoOutrasPropriedades:
    | 'NÃO'
    | 'SIM, MAS SEM RESTRIÇÕES IDENTIFICADAS'
    | 'SIM E COM RESTRIÇÕES'
    | '';
  possuiBlocoGlebasNoPdf: boolean; // True = Certificação COM KML | False = Certificação SEM KML (LCGH/LCGA)
  glebas: GlebaSocioambientalItem[];
  itensLidosDoKml: string[];
  logsVerificacaoKml: string[];
  kmlCorrigidoTexto: string | null;
}

export interface DiagnosticoConformidadeSocioambiental {
  statusGeral: 'APROVADO' | 'APROVADO_COM_RESSALVAS' | 'IMPEDIMENTO' | 'PENDENTE';
  errosCriticos: string[];
  justificativasERessalvas: string[];
  exigenciasDocumentais: string[];
}

async function obterPdfJsLib(): Promise<any> {
  if (typeof window === 'undefined') return null;
  const win = window as any;
  if (win.pdfjsLib) return win.pdfjsLib;

  return new Promise((resolve) => {
    const script = document.createElement('script');
    script.src =
      'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
    script.async = true;
    script.onload = () => {
      if (win.pdfjsLib) {
        win.pdfjsLib.GlobalWorkerOptions.workerSrc =
          'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      }
      resolve(win.pdfjsLib || null);
    };
    script.onerror = () => resolve(null);
    document.head.appendChild(script);
  });
}

export function parseFloatBR(val: string | number | undefined): number {
  if (val === undefined || val === null) return 0;
  if (typeof val === 'number') return val;
  const limpo = val
    .toString()
    .replace(/[^\d,.-]/g, '')
    .replace(/\.(?=\d{3})/g, '')
    .replace(',', '.');
  return parseFloat(limpo) || 0;
}

// 1. Lê e audita o arquivo .KML (verifica fechamento de polígonos e extrai nomes das glebas/itens)
export async function processarArquivoKmlSocioambiental(file: File): Promise<{
  itensEncontrados: string[];
  logs: string[];
  kmlCorrigidoTexto: string | null;
}> {
  const text = await file.text();
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(text, 'text/xml');
  const placemarks = xmlDoc.getElementsByTagName('Placemark');

  const itensEncontrados: string[] = [];
  const logs: string[] = [];
  let errorsFound = false;

  if (placemarks.length === 0) {
    return {
      itensEncontrados: [],
      logs: ['⚠️ Nenhum Placemark ou Gleba encontrado no arquivo KML.'],
      kmlCorrigidoTexto: null,
    };
  }

  for (let i = 0; i < placemarks.length; i++) {
    const nameTag = placemarks[i].getElementsByTagName('name')[0];
    const name = nameTag ? (nameTag.textContent || '').trim() : `Area ${i + 1}`;
    itensEncontrados.push(name);

    const coordsTags = placemarks[i].getElementsByTagName('coordinates');
    let itemFechado = true;

    for (let j = 0; j < coordsTags.length; j++) {
      const coordsText = (coordsTags[j].textContent || '').trim();
      const coordsArray = coordsText.split(/\s+/).filter((c) => c.length > 0);

      if (coordsArray.length > 0) {
        const firstPoint = coordsArray[0].trim();
        const lastPoint = coordsArray[coordsArray.length - 1].trim();
        if (firstPoint !== lastPoint) {
          itemFechado = false;
          errorsFound = true;
          coordsTags[j].textContent = `${coordsText} ${firstPoint}`;
        }
      }
    }

    if (!itemFechado) {
      logs.push(
        `🔧 [CORRIGIDO] Gleba '${name}': Polígono estava aberto (coordenada inicial diferente da final).`
      );
    } else {
      logs.push(`✅ [OK] Gleba '${name}': Polígono fechado e íntegro.`);
    }
  }

  let kmlCorrigidoTexto: string | null = null;
  if (errorsFound) {
    const serializer = new XMLSerializer();
    kmlCorrigidoTexto = serializer.serializeToString(xmlDoc);
  }

  return { itensEncontrados, logs, kmlCorrigidoTexto };
}

// 2. Lê o PDF da Certificação Socioambiental e cruza com os itens do KML (se fornecidos)
export async function extrairDadosPdfCertificacaoSocioambiental(
  filePdf: File,
  itensKmlPreCarregados: string[] = []
): Promise<DadosExtraidosSocioambientalKml> {
  const buffer = await filePdf.arrayBuffer();
  const pdfjsLib = await obterPdfJsLib();
  let textoExtraido = '';

  if (pdfjsLib) {
    const pdf = await pdfjsLib.getDocument({ data: buffer.slice(0) }).promise;
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      textoExtraido +=
        (textContent.items || []).map((item: any) => item.str || '').join(' ') +
        ' ';
    }
  }

  const txt = textoExtraido.replace(/\n/g, ' ').replace(/\s+/g, ' ');

  // Data da Análise
  let dataAnalise = '';
  const matchData = txt.match(/dia\s+(\d{2}\/\d{2}\/\d{4})\s+às/i);
  if (matchData && matchData[1]) {
    const [dd, mm, aaaa] = matchData[1].split('/');
    dataAnalise = `${aaaa}-${mm}-${dd}`;
  }

  const getAreaAndPerc = (regexArea: RegExp, regexPerc: RegExp) => {
    let area = '';
    let perc = '';
    const mArea = txt.match(regexArea);
    if (mArea && mArea[1]) area = mArea[1].trim();
    const mPerc = txt.match(regexPerc);
    if (mPerc && mPerc[1]) perc = mPerc[1].trim().replace('%', '') + '%';
    return { area, perc };
  };

  const consolidada = getAreaAndPerc(
    /Área Consolidada\s*Área:\s*([\d,.]+)\s*H[AÁaá]/i,
    /Área Consolidada.*?Percentual sobre(?:[\s\S]{0,35}?)área do CAR:\s*([\d,.]+)/i
  );
  const pastagem = getAreaAndPerc(
    /Pastagem Total\s*Área:\s*([\d,.]+)\s*H[AÁaá]/i,
    /Pastagem Total.*?Percentual sobre(?:[\s\S]{0,35}?)área do CAR:\s*([\d,.]+)/i
  );
  const app = getAreaAndPerc(
    /APP \(Área de preservação permanente\)\s*Área:\s*([\d,.]+)\s*H[AÁaá]/i,
    /APP \(Área de preservação permanente\).*?Percentual sobre(?:[\s\S]{0,35}?)área do CAR:\s*([\d,.]+)/i
  );
  const reserva = getAreaAndPerc(
    /Reserva Legal\s*Área:\s*([\d,.]+)\s*H[AÁaá]/i,
    /Reserva Legal.*?Percentual sobre(?:[\s\S]{0,35}?)área do CAR:\s*([\d,.]+)/i
  );

  const mCar = txt.match(/Bioma:.*?Área:\s*([\d.,]+)/i);
  const areaCarHa = mCar ? mCar[1].trim() : '';

  // Análise de Riscos Ambientais e Sociais
  let txtPosProdes = txt;
  const idxProdes = txt.toLowerCase().indexOf('desmatamento prodes:');
  if (idxProdes > -1) {
    txtPosProdes = txt.substring(idxProdes);
  }

  let desmatamentoProdes: 'NÃO' | 'SIM' = 'NÃO';
  let desmatamentoProdesObs = '';
  const mProdes = txtPosProdes.match(
    /Desmatamento PRODES:\s*(.*?)(?:Embargo:|CAR Cont[íi]guo:|$)/i
  );
  if (mProdes) {
    const pText = mProdes[1].trim();
    if (!pText.toLowerCase().includes('não há dados')) {
      desmatamentoProdes = 'SIM';
      desmatamentoProdesObs = pText;
    }
  }

  let embargosAmbientais: 'NÃO' | 'SIM' = 'NÃO';
  const mEmbargo = txtPosProdes.match(
    /Embargo:\s*(.*?)(?:CAR Cont[íi]guo|Nome:|$)/i
  );
  if (mEmbargo && !mEmbargo[1].toLowerCase().includes('não há dados')) {
    embargosAmbientais = 'SIM';
  }

  let carContiguo: 'NÃO' | 'SIM' = 'NÃO';
  const mCont = txtPosProdes.match(/CAR Cont[íi]guo:\s*(.*?)(?:Nome:|$)/i);
  if (mCont && !mCont[1].toLowerCase().includes('não há dados')) {
    carContiguo = 'SIM';
  }

  let sobreposicaoOutrasPropriedades:
    | 'NÃO'
    | 'SIM, MAS SEM RESTRIÇÕES IDENTIFICADAS'
    | 'SIM E COM RESTRIÇÕES' = 'NÃO';
  const mSobre = txt.match(/Sobreposições do CAR:(.*?)Desmatamento PRODES:/i);
  if (mSobre) {
    const sobreText = mSobre[1];
    if (/CAR Sobreposto:/i.test(sobreText)) {
      if (
        /Restrição não identificada/i.test(sobreText) &&
        !/possível restrição|indicando uma restrição/i.test(sobreText)
      ) {
        sobreposicaoOutrasPropriedades =
          'SIM, MAS SEM RESTRIÇÕES IDENTIFICADAS';
      } else {
        sobreposicaoOutrasPropriedades = 'SIM E COM RESTRIÇÕES';
      }
    }
  }

  const trabalhoEscravo: 'NÃO' | 'SIM' =
    /(?:Restrição de\s*trabalho escravo:|trabalho escravo:)\s*(?:☑|x|X)?\s*Sim/i.test(
      txt
    )
      ? 'SIM'
      : 'NÃO';

  const alertasAmbientais: 'NÃO' | 'SIM' =
    /Alertas Ambientais:\s*(?:☑|x|X)?\s*Sim/i.test(txt) ? 'SIM' : 'NÃO';

  // Extração Estrita do Bloco de Glebas ("Area 1", "Area 2"...)
  const glebas: GlebaSocioambientalItem[] = [];
  let possuiBlocoGlebasNoPdf = false;
  const glebasStart = txt.indexOf('Glebas');

  if (glebasStart > -1) {
    const textGlebas = txt.substring(glebasStart);
    const glebaBlocks = textGlebas
      .split(/(?=Nome(?:\s*da\s*Gleba)?:\s*Area\s*\d+)/i)
      .filter((b) => /Nome(?:\s*da\s*Gleba)?:\s*Area\s*\d+/i.test(b));

    if (glebaBlocks.length > 0) {
      possuiBlocoGlebasNoPdf = true;

      glebaBlocks.forEach((g, idx) => {
        const nomeMatch = g.match(/Nome(?:\s*da\s*Gleba)?:\s*(Area\s*\d+)/i);
        const gNome = nomeMatch ? nomeMatch[1].trim() : `Area ${idx + 1}`;

        const areaMatch = g.match(/Área:\s*([\d.,]+)\s*H[AÁaá]/i);
        const percMatch =
          g.match(/Percentual da Gleba\s*dentro do CAR:\s*([\d.,]+%)/i) ||
          g.match(/([\d.,]+%)\s*(?:X|☑)?\s*O percentual/i) ||
          g.match(/Percentual\s*de\s*([\d.,]+%)/i);

        const gArea = areaMatch ? areaMatch[1].trim() : '';
        const gPerc = percMatch ? percMatch[1].trim() : '100,00%';

        const overlaps: string[] = [];
        if (gPerc) {
          const pVal = parseFloatBR(gPerc.replace('%', ''));
          if (pVal > 0 && pVal < 100) {
            overlaps.push(
              'Restrição: O percentual da gleba dentro do CAR é inferior a 100%, indicando uma restrição.'
            );
          }
        }

        const reTipo =
          /Tipo:\s*(Reserva Legal|APP.*?)\s*Área\s*sobreposta:\s*([\d.,]+)\s*H[AÁaá].*?(?:Percentual.*?([\d.,]+%))/gi;
        let mt: RegExpExecArray | null;
        while ((mt = reTipo.exec(g)) !== null) {
          overlaps.push(
            `Sobreposição com ${mt[1].trim()}:\n- Área: ${mt[2]} HA\n- Percentual: ${mt[3]}`
          );
        }

        const reGlebaSobreposta =
          /Nome da\s*Gleba\s*sobreposta:\s*(Area\s*\d+).*?Área de\s*Sobreposição:\s*([\d.,]+)\s*H[AÁaá].*?(?:Percentual.*?([\d.,]+%)|☑\s*([\d.,]+%))/gi;
        let mg: RegExpExecArray | null;
        while ((mg = reGlebaSobreposta.exec(g)) !== null) {
          const perc = mg[3] || mg[4] || '100,00%';
          overlaps.push(
            `Sobreposição com Gleba ${mg[1].trim()}:\n- Área: ${mg[2]} HA\n- Percentual: ${perc}`
          );
        }

        const itemKmlAssociado = itensKmlPreCarregados[idx] || '';

        glebas.push({
          id: `gl_${idx + 1}_${Date.now()}`,
          nomeArea: gNome,
          itemKml: itemKmlAssociado,
          tamanhoHa: gArea,
          percentualNoCar: gPerc,
          possuiSobreposicao: overlaps.length > 0 ? 'SIM' : 'NÃO',
          sobreposicoesDetalhe: overlaps,
        });
      });
    }
  }

  return sincronizarNomesKmlNasGlebas({
    dataAnalise,
    areaCarHa,
    areaConsolidadaHa: consolidada.area,
    areaConsolidadaPerc: consolidada.perc,
    pastagemTotalHa: pastagem.area,
    pastagemTotalPerc: pastagem.perc,
    appHa: app.area,
    appPerc: app.perc,
    reservaLegalHa: reserva.area,
    reservaLegalPerc: reserva.perc,
    trabalhoEscravo,
    alertasAmbientais,
    embargosAmbientais,
    desmatamentoProdes,
    desmatamentoProdesObs,
    carContiguo,
    sobreposicaoOutrasPropriedades,
    possuiBlocoGlebasNoPdf,
    glebas,
    itensLidosDoKml: itensKmlPreCarregados,
    logsVerificacaoKml: [],
    kmlCorrigidoTexto: null,
  });
}

// 3. Sincroniza os nomes dos itens do KML dentro das descrições de sobreposição entre Glebas ("Area 1 - PASTAGEM")
export function sincronizarNomesKmlNasGlebas(
  dados: DadosExtraidosSocioambientalKml
): DadosExtraidosSocioambientalKml {
  const mapaAreaParaItem: Record<string, string> = {};
  dados.glebas.forEach((gl, idx) => {
    const item = gl.itemKml || dados.itensLidosDoKml[idx] || '';
    gl.itemKml = item;
    if (gl.nomeArea) {
      mapaAreaParaItem[gl.nomeArea.toLowerCase().trim()] = item;
    }
  });

  const glebasAtualizadas = dados.glebas.map((gl) => {
    const novasSobreposicoes = gl.sobreposicoesDetalhe.map((txt) =>
      txt.replace(
        /Sobreposição com Gleba (Area\s*\d+)(?:\s*-\s*[^:\n]*)?:/gi,
        (_match, p1) => {
          const itemAlvo = mapaAreaParaItem[p1.toLowerCase().trim()];
          return itemAlvo
            ? `Sobreposição com Gleba ${p1} - ${itemAlvo}:`
            : `Sobreposição com Gleba ${p1}:`;
        }
      )
    );
    return {
      ...gl,
      sobreposicoesDetalhe: novasSobreposicoes,
    };
  });

  return {
    ...dados,
    glebas: glebasAtualizadas,
  };
}

// 4. Motor de Conformidade Socioambiental idêntico ao V98 (Regras de 4 MF, 22/07/2008, RL 16%, APP/Cerca, Gado/Pastagem, etc.)
export function avaliarConformidadeSocioambientalV98(params: {
  dados: DadosExtraidosSocioambientalKml;
  areaImovelHa?: string;
  dataAquisicaoISO?: string; // Formato YYYY-MM-DD
  forcarAte4ModulosAntes2008?: boolean;
}): DiagnosticoConformidadeSocioambiental {
  const { dados, areaImovelHa, dataAquisicaoISO, forcarAte4ModulosAntes2008 } =
    params;

  const errosCriticos: string[] = [];
  const justificativasERessalvas: string[] = [];
  const exigenciasDocumentais: string[] = [];

  // 1. Alertas Graves Macro
  if (dados.trabalhoEscravo === 'SIM') {
    errosCriticos.push('Restrição de Trabalho Escravo identificada na Certificação.');
  }
  if (dados.alertasAmbientais === 'SIM') {
    errosCriticos.push('Alertas Ambientais identificados na Certificação.');
  }
  if (dados.embargosAmbientais === 'SIM') {
    errosCriticos.push('Embargos Ambientais identificados na Certificação.');
  }
  if (dados.desmatamentoProdes === 'SIM') {
    errosCriticos.push(
      `Desmatamento PRODES identificado após 31/07/2019${
        dados.desmatamentoProdesObs ? ` (${dados.desmatamentoProdesObs})` : ''
      }.`
    );
  }
  if (dados.sobreposicaoOutrasPropriedades === 'SIM E COM RESTRIÇÕES') {
    errosCriticos.push(
      'Sobreposição do CAR com outras propriedades COM restrições identificadas.'
    );
  } else if (
    dados.sobreposicaoOutrasPropriedades ===
    'SIM, MAS SEM RESTRIÇÕES IDENTIFICADAS'
  ) {
    justificativasERessalvas.push(
      'Sobreposição de CAR com terceiros sem restrições impeditivas (Apresentar Declaração de Sobreposição do CAR).'
    );
    exigenciasDocumentais.push('DECLARAÇÃO DE SOBREPOSIÇÃO DO CAR');
  }

  // 2. Regra Cumulativa: 4 Módulos Fiscais (<= 240 ha) + Marco Temporal (22/07/2008)
  const areaNum = parseFloatBR(areaImovelHa || dados.areaCarHa);
  const isMaiorQue4MF = areaNum > 240;

  let isDataApos2008 = false;
  if (dataAquisicaoISO) {
    const partes = dataAquisicaoISO.split('-').map(Number);
    if (partes.length === 3) {
      const dtAq = new Date(partes[0], partes[1] - 1, partes[2]);
      const dtCorte = new Date(2008, 6, 22);
      isDataApos2008 = dtAq > dtCorte;
    }
  }

  const exigeDeclaracoes = forcarAte4ModulosAntes2008
    ? false
    : isMaiorQue4MF || (!isMaiorQue4MF && isDataApos2008);

  if (dataAquisicaoISO || forcarAte4ModulosAntes2008 || isMaiorQue4MF) {
    if (exigeDeclaracoes) {
      const msgExig =
        'EXIGÊNCIA DOCUMENTAL: O imóvel exige apresentar a "DECLARAÇÃO DE RECOMPOSIÇÃO" e a "DECLARAÇÃO DE NÃO DESMATAMENTO IRREGULAR APÓS 2008".';
      justificativasERessalvas.push(msgExig);
      exigenciasDocumentais.push(
        'DECLARAÇÃO DE RECOMPOSIÇÃO',
        'DECLARAÇÃO DE NÃO DESMATAMENTO APÓS 2008'
      );
    } else {
      justificativasERessalvas.push(
        'DISPENSA DOCUMENTAL: Imóvel dispensado das Declarações de Recomposição e Não Desmatamento (Imóvel de até 4 Módulos Fiscais adquirido antes de 22/07/2008).'
      );
    }
  }

  // 3. Validação da Reserva Legal (Mínimo 16%)
  const rlPercNum = parseFloatBR(dados.reservaLegalPerc);
  if (rlPercNum > 0 || dados.reservaLegalHa) {
    const labelRl = dados.reservaLegalPerc || `${dados.reservaLegalHa} ha`;
    if (rlPercNum < 16 && exigeDeclaracoes) {
      errosCriticos.push(
        `Reserva Legal (${labelRl}): O Imóvel deve obedecer o mínimo de 16% de reserva legal.`
      );
    } else if (rlPercNum < 16 && !exigeDeclaracoes) {
      justificativasERessalvas.push(
        `Reserva Legal (${labelRl}): Percentual inferior a 16% justificado e isento (Imóvel de até 4 Módulos Fiscais adquirido antes de 22/07/2008).`
      );
    } else if (rlPercNum >= 16) {
      if (rlPercNum < 80 && !exigeDeclaracoes) {
        justificativasERessalvas.push(
          `Reserva Legal (${labelRl}): Imóvel dispensado de apresentar reserva legal acima de 80% por possuir até 4 módulos fiscais antes de 22/07/2008 e a área objeto do pleito estar totalmente dentro da área consolidada.`
        );
      } else {
        justificativasERessalvas.push(
          `Reserva Legal (${labelRl}): Em conformidade com o percentual exigido.`
        );
      }
    }
  }

  // 4. Análise Detalhada das Glebas (KML x Certificação Socioambiental)
  dados.glebas.forEach((gl) => {
    const gNome = gl.nomeArea || 'Gleba';
    const gItem = (gl.itemKml || 'ITEM NÃO VINCULADO').toUpperCase();
    const numericPerc = parseFloatBR(gl.percentualNoCar);

    if (numericPerc > 0 && numericPerc < 100) {
      errosCriticos.push(
        `Gleba ${gNome} (${gItem}): Fora do CAR (Apenas ${gl.percentualNoCar} dentro). Deve ser no mínimo 100%.`
      );
    }

    gl.sobreposicoesDetalhe.forEach((sobRaw) => {
      const txt = sobRaw.toUpperCase();
      if (txt.includes('RESERVA LEGAL')) {
        errosCriticos.push(
          `Gleba ${gNome} (${gItem}): Sobreposição proibida com Reserva Legal.`
        );
      } else if (
        txt.includes('APP') ||
        txt.includes('PRESERVAÇÃO PERMANENTE') ||
        txt.includes('PRESERVACAO PERMANENTE')
      ) {
        if (gItem.includes('CERCA')) {
          justificativasERessalvas.push(
            `Gleba ${gNome} (CERCA): Sobreposição em APP justificada. A instalação de cercas nesta área é permitida por tratar-se de delimitação do perímetro da propriedade.`
          );
        } else {
          errosCriticos.push(
            `Gleba ${gNome} (${gItem}): Sobreposição proibida com APP (Permitida apenas a instalação de cercas para delimitação).`
          );
        }
      } else if (txt.includes('SOBREPOSIÇÃO COM GLEBA AREA')) {
        const isSeguroAss =
          gItem.includes('SEGURO') || gItem.includes('ASSESSORIA');
        const targetIsSeguroAss =
          txt.includes('SEGURO') || txt.includes('ASSESSORIA');
        const isGadoPastagem =
          gItem.includes('MATRIZ') ||
          gItem.includes('REPRODUTOR') ||
          gItem.includes('BOVIN') ||
          gItem.includes('ANIMAIS') ||
          gItem.includes('PASTAGEM') ||
          gItem.includes('CAPIM');
        const targetIsGadoPastagem =
          txt.includes('MATRIZ') ||
          txt.includes('REPRODUTOR') ||
          txt.includes('BOVIN') ||
          txt.includes('ANIMAIS') ||
          txt.includes('PASTAGEM') ||
          txt.includes('CAPIM');
        const isCerca = gItem.includes('CERCA');
        const targetIsCerca = txt.includes('CERCA');

        if (isSeguroAss || targetIsSeguroAss) {
          // Silencioso conforme V98
        } else if (
          (isGadoPastagem || isCerca) &&
          (targetIsGadoPastagem || targetIsCerca)
        ) {
          justificativasERessalvas.push(
            `Gleba ${gNome} (${gItem}): Sobreposição interna justificada. É permitida a sobreposição de animais com a pastagem/cercas.`
          );
        } else {
          errosCriticos.push(
            `Gleba ${gNome} (${gItem}): Sobreposição interna não permitida com o item correspondente nesta área.`
          );
        }
      } else if (
        txt.includes('RESTRIÇÃO') ||
        txt.includes('INFERIOR A 100%')
      ) {
        if (
          !errosCriticos.some(
            (e) => e.includes(`Gleba ${gNome}`) && e.includes('Fora do CAR')
          )
        ) {
          errosCriticos.push(
            `Gleba ${gNome} (${gItem}): O percentual da gleba dentro do CAR é inferior a 100% ou possui restrição (Impedimento Crítico).`
          );
        }
      }
    });
  });

  // Verifica se a quantidade de áreas na Certificação bate com a quantidade de itens no KML
  if (
    dados.possuiBlocoGlebasNoPdf &&
    dados.itensLidosDoKml.length > 0 &&
    dados.glebas.length !== dados.itensLidosDoKml.length
  ) {
    justificativasERessalvas.push(
      `⚠️ Atenção: O arquivo KML possui ${dados.itensLidosDoKml.length} item(ns), enquanto a Certificação Socioambiental lista ${dados.glebas.length} gleba(s). Verifique a correspondência.`
    );
  }

  const temPreenchimentoReal = Boolean(
    dados.dataAnalise.trim() ||
      dados.areaCarHa.trim() ||
      dados.glebas.length > 0
  );

  let statusGeral: DiagnosticoConformidadeSocioambiental['statusGeral'] =
    'PENDENTE';
  if (temPreenchimentoReal) {
    if (errosCriticos.length > 0) {
      statusGeral = 'IMPEDIMENTO';
    } else if (justificativasERessalvas.length > 0) {
      statusGeral = 'APROVADO_COM_RESSALVAS';
    } else {
      statusGeral = 'APROVADO';
    }
  }

  return {
    statusGeral,
    errosCriticos,
    justificativasERessalvas,
    exigenciasDocumentais,
  };
}