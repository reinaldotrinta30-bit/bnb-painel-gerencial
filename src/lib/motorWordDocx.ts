// src/lib/motorWordDocx.ts
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import { saveAs } from 'file-saver';

const PREFIXO_STORAGE_MOLDE = 'bnb_v2_molde_docx_custom_';

export interface BlocoDocxEditavel {
  id: string;
  tipo: 'p' | 'tbl';
  texto: string;
  negrito?: boolean;
  alinhamento?: 'left' | 'center' | 'right' | 'both';
  linhasTabela?: string[][];
  xmlOriginal?: string;
  foiEditado?: boolean;
}

export function base64ParaArrayBuffer(base64: string): ArrayBuffer {
  const limpo = base64.replace(/\s+/g, '');
  const binaryString = window.atob(limpo);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

export function arrayBufferParaBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

export async function salvarMoldeCustomizadoNoSistema(
  chaveMolde: string,
  arquivoDocx: File
): Promise<void> {
  const buffer = await arquivoDocx.arrayBuffer();
  const b64 = arrayBufferParaBase64(buffer);
  window.localStorage.setItem(`${PREFIXO_STORAGE_MOLDE}${chaveMolde}`, b64);
}

export function salvarBufferMoldeCustomizadoNoSistema(
  chaveMolde: string,
  buffer: ArrayBuffer
): void {
  const b64 = arrayBufferParaBase64(buffer);
  window.localStorage.setItem(`${PREFIXO_STORAGE_MOLDE}${chaveMolde}`, b64);
}

export function removerMoldeCustomizadoDoSistema(chaveMolde: string): void {
  window.localStorage.removeItem(`${PREFIXO_STORAGE_MOLDE}${chaveMolde}`);
}

export function possuiMoldeCustomizadoSalvo(chaveMolde: string): boolean {
  if (typeof window === 'undefined') return false;
  return Boolean(window.localStorage.getItem(`${PREFIXO_STORAGE_MOLDE}${chaveMolde}`));
}

export async function carregarBufferDoMolde(params: {
  chaveMolde: string;
  caminhoPublicDocx?: string;
  base64Fallback?: string;
}): Promise<ArrayBuffer> {
  const { chaveMolde, caminhoPublicDocx, base64Fallback } = params;

  if (typeof window !== 'undefined') {
    const customB64 = window.localStorage.getItem(`${PREFIXO_STORAGE_MOLDE}${chaveMolde}`);
    if (customB64) {
      return base64ParaArrayBuffer(customB64);
    }
  }

  if (caminhoPublicDocx) {
    try {
      const resp = await fetch(caminhoPublicDocx, { cache: 'no-store' });
      if (resp.ok) {
        return await resp.arrayBuffer();
      }
    } catch {
      // Continua para o fallback em Base64
    }
  }

  if (base64Fallback && !base64Fallback.startsWith('COLE_AQUI')) {
    return base64ParaArrayBuffer(base64Fallback);
  }

  throw new Error(
    `O molde Word para [${chaveMolde}] ainda não foi carregado. Use o botão "📤 Atualizar Molde .DOCX" ou cole o Base64 original.`
  );
}

export async function baixarMoldeOriginalParaEdicao(params: {
  chaveMolde: string;
  caminhoPublicDocx?: string;
  base64Fallback?: string;
  nomeArquivoDownload: string;
}): Promise<void> {
  const buffer = await carregarBufferDoMolde(params);
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });
  saveAs(blob, params.nomeArquivoDownload);
}

// Extrai todos os parágrafos e tabelas de um ArrayBuffer .DOCX para o Comparador Lado a Lado
export function extrairBlocosEditaveisDoDocx(
  buffer: ArrayBuffer
): BlocoDocxEditavel[] {
  const zip = new PizZip(buffer);
  const xmlTexto = zip.file('word/document.xml')?.asText();
  if (!xmlTexto) {
    throw new Error('Arquivo .docx inválido (word/document.xml não encontrado).');
  }

  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlTexto, 'application/xml');
  const serializer = new XMLSerializer();
  const body = xmlDoc.getElementsByTagName('w:body')[0];
  if (!body) return [];

  const blocos: BlocoDocxEditavel[] = [];
  let contador = 0;

  Array.from(body.childNodes).forEach((node) => {
    if (node.nodeName === 'w:p') {
      const el = node as Element;
      const tNodes = Array.from(el.getElementsByTagName('w:t'));
      const texto = tNodes.map((t) => t.textContent || '').join('');

      // Ignora parágrafos totalmente vazios que são apenas quebras de espaçamento
      if (!texto.trim()) return;

      const bNodes = el.getElementsByTagName('w:b');
      const negrito = bNodes.length > 0 && texto.trim().length < 130;

      let alinhamento: 'left' | 'center' | 'right' | 'both' = 'both';
      const pPr = el.getElementsByTagName('w:pPr')[0];
      if (pPr) {
        const jc = pPr.getElementsByTagName('w:jc')[0];
        const val = jc?.getAttribute('w:val');
        if (val === 'center') alinhamento = 'center';
        else if (val === 'right' || val === 'end') alinhamento = 'right';
        else if (val === 'left' || val === 'start') alinhamento = 'left';
      }

      blocos.push({
        id: `blk_${++contador}_${Date.now()}`,
        tipo: 'p',
        texto,
        negrito,
        alinhamento,
        xmlOriginal: serializer.serializeToString(el),
        foiEditado: false,
      });
    } else if (node.nodeName === 'w:tbl') {
      const el = node as Element;
      const trs = Array.from(el.getElementsByTagName('w:tr'));
      const linhasTabela: string[][] = [];

      trs.forEach((tr) => {
        const tcs = Array.from(tr.getElementsByTagName('w:tc'));
        const linha: string[] = tcs.map((tc) => {
          const ps = Array.from(tc.getElementsByTagName('w:p'));
          return ps
            .map((p) =>
              Array.from(p.getElementsByTagName('w:t'))
                .map((t) => t.textContent || '')
                .join('')
            )
            .join('\n')
            .trim();
        });
        if (linha.length > 0) linhasTabela.push(linha);
      });

      const textoPlanoTabela = linhasTabela
        .map((l) => l.join(' | '))
        .join('\n');

      blocos.push({
        id: `tbl_${++contador}_${Date.now()}`,
        tipo: 'tbl',
        texto: textoPlanoTabela,
        linhasTabela,
        xmlOriginal: serializer.serializeToString(el),
        foiEditado: false,
      });
    }
  });

  return blocos;
}

function escaparTextoXml(str: string): string {
  return (str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// Reconstrói um ArrayBuffer .DOCX 100% válido a partir da lista de blocos editados/mesclados
export function reconstruirBufferDocxComBlocosEditados(
  bufferMoldeBase: ArrayBuffer,
  blocosFinais: BlocoDocxEditavel[]
): ArrayBuffer {
  const zip = new PizZip(bufferMoldeBase);
  const xmlOriginalDoc = zip.file('word/document.xml')?.asText();
  if (!xmlOriginalDoc) {
    throw new Error('Não foi possível ler word/document.xml do molde base.');
  }

  const idxAbreBody = xmlOriginalDoc.indexOf('<w:body>');
  const idxFechaBody = xmlOriginalDoc.lastIndexOf('</w:body>');
  if (idxAbreBody === -1 || idxFechaBody === -1) {
    throw new Error('Estrutura <w:body> não encontrada no documento Word.');
  }

  const cabecalhoXml = xmlOriginalDoc.slice(0, idxAbreBody + '<w:body>'.length);
  const mioloAntigo = xmlOriginalDoc.slice(
    idxAbreBody + '<w:body>'.length,
    idxFechaBody
  );
  const idxSectPr = mioloAntigo.lastIndexOf('<w:sectPr');
  const sectPrXml = idxSectPr !== -1 ? mioloAntigo.slice(idxSectPr) : '';
  const rodapeXml = xmlOriginalDoc.slice(idxFechaBody);

  const blocosXmlString = blocosFinais
    .map((bloco) => {
      // Se o bloco não foi editado e já possui o XML original do Word, preserva 100% intacto!
      if (!bloco.foiEditado && bloco.xmlOriginal) {
        return bloco.xmlOriginal;
      }

      if (bloco.tipo === 'p') {
        let pPrXml = `<w:pPr><w:jc w:val="${bloco.alinhamento || 'both'}"/></w:pPr>`;
        let rPrXml = bloco.negrito ? '<w:rPr><w:b/></w:rPr>' : '';

        if (bloco.xmlOriginal) {
          const matchPPr = bloco.xmlOriginal.match(/<w:pPr[\s\S]*?<\/w:pPr>/);
          if (matchPPr) pPrXml = matchPPr[0];
          const matchRPr = bloco.xmlOriginal.match(/<w:rPr[\s\S]*?<\/w:rPr>/);
          if (matchRPr) rPrXml = matchRPr[0];
        }

        const linhas = (bloco.texto || '').split('\n');
        const runsInternos = linhas
          .map(
            (l, i) =>
              `${i > 0 ? '<w:br/>' : ''}<w:t xml:space="preserve">${escaparTextoXml(l)}</w:t>`
          )
          .join('');

        return `<w:p>${pPrXml}<w:r>${rPrXml}${runsInternos}</w:r></w:p>`;
      }

      // Se for uma tabela editada ou nova
      const linhas = bloco.linhasTabela || [];
      const trsXml = linhas
        .map((linha, rIdx) => {
          const tcsXml = linha
            .map((celula) => {
              const negritoCab = rIdx === 0 ? '<w:rPr><w:b/></w:rPr>' : '';
              return `<w:tc><w:tcPr><w:tcW w:w="2500" w:type="dxa"/></w:tcPr><w:p><w:r>${negritoCab}<w:t xml:space="preserve">${escaparTextoXml(
                celula
              )}</w:t></w:r></w:p></w:tc>`;
            })
            .join('');
          return `<w:tr>${tcsXml}</w:tr>`;
        })
        .join('');

      return `<w:tbl><w:tblPr><w:tblW w:w="5000" w:type="pct"/><w:tblBorders><w:top w:val="single" w:sz="4" w:space="0" w:color="334155"/><w:left w:val="single" w:sz="4" w:space="0" w:color="334155"/><w:bottom w:val="single" w:sz="4" w:space="0" w:color="334155"/><w:right w:val="single" w:sz="4" w:space="0" w:color="334155"/><w:insideH w:val="single" w:sz="4" w:space="0" w:color="334155"/><w:insideV w:val="single" w:sz="4" w:space="0" w:color="334155"/></w:tblBorders></w:tblPr>${trsXml}</w:tbl>`;
    })
    .join('');

  const novoXmlCompleto = `${cabecalhoXml}${blocosXmlString}${sectPrXml}${rodapeXml}`;
  zip.file('word/document.xml', novoXmlCompleto);

  return zip.generate({ type: 'arraybuffer' });
}

// Renderiza o molde Word em memória e retorna o PizZip resultante
async function renderizarZipDoMolde(params: {
  chaveMolde: string;
  caminhoPublicDocx?: string;
  base64Fallback?: string;
  dados: Record<string, unknown>;
}): Promise<PizZip> {
  const { chaveMolde, caminhoPublicDocx, base64Fallback, dados } = params;
  const bufferMolde = await carregarBufferDoMolde({
    chaveMolde,
    caminhoPublicDocx,
    base64Fallback,
  });

  const zip = new PizZip(bufferMolde);
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    nullGetter: () => '',
  });

  doc.render(dados);
  return doc.getZip();
}

export async function gerarDocumentoWordPeloMolde(params: {
  chaveMolde: string;
  caminhoPublicDocx?: string;
  base64Fallback?: string;
  dados: Record<string, unknown>;
  nomeArquivoSaida: string;
}): Promise<void> {
  const zipRenderizado = await renderizarZipDoMolde(params);

  const blobSaida = zipRenderizado.generate({
    type: 'blob',
    mimeType:
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });

  const win = window as Window & {
    showSaveFilePicker?: (opts: unknown) => Promise<{
      createWritable: () => Promise<{
        write: (d: Blob) => Promise<void>;
        close: () => Promise<void>;
      }>;
    }>;
  };

  if (win.showSaveFilePicker) {
    try {
      const handle = await win.showSaveFilePicker({
        suggestedName: params.nomeArquivoSaida,
        types: [
          {
            description: 'Documento Word (.docx)',
            accept: {
              'application/vnd.openxmlformats-officedocument.wordprocessingml.document': [
                '.docx',
              ],
            },
          },
        ],
      });
      const writable = await handle.createWritable();
      await writable.write(blobSaida);
      await writable.close();
      return;
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return;
    }
  }

  saveAs(blobSaida, params.nomeArquivoSaida);
}

// Converte um parágrafo XML do Word (<w:p>) para HTML fiel
function converterParagrafoWordParaHtml(pNode: Element): string {
  let align = 'justify';
  const pPr = pNode.getElementsByTagName('w:pPr')[0];
  if (pPr) {
    const jc = pPr.getElementsByTagName('w:jc')[0];
    const val = jc?.getAttribute('w:val');
    if (val === 'center') align = 'center';
    else if (val === 'right' || val === 'end') align = 'right';
    else if (val === 'left' || val === 'start') align = 'left';
  }

  const runs = Array.from(pNode.getElementsByTagName('w:r'));
  let htmlInterno = '';

  runs.forEach((r) => {
    const rPr = r.getElementsByTagName('w:rPr')[0];
    const isBold = Boolean(rPr && rPr.getElementsByTagName('w:b').length > 0);
    const isItalic = Boolean(rPr && rPr.getElementsByTagName('w:i').length > 0);
    const isUnderline = Boolean(rPr && rPr.getElementsByTagName('w:u').length > 0);

    let textoRun = '';
    Array.from(r.childNodes).forEach((child) => {
      if (child.nodeName === 'w:t') {
        textoRun += (child.textContent || '')
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;');
      } else if (child.nodeName === 'w:br') {
        textoRun += '<br/>';
      } else if (child.nodeName === 'w:tab') {
        textoRun += '&nbsp;&nbsp;&nbsp;&nbsp;';
      }
    });

    if (textoRun) {
      if (isUnderline) textoRun = `<u>${textoRun}</u>`;
      if (isItalic) textoRun = `<i>${textoRun}</i>`;
      if (isBold) textoRun = `<strong>${textoRun}</strong>`;
      htmlInterno += textoRun;
    }
  });

  if (!htmlInterno.trim()) {
    return `<p style="margin: 4px 0; min-height: 8px;"></p>`;
  }

  return `<p style="margin: 5px 0; text-align: ${align}; line-height: 1.42;">${htmlInterno}</p>`;
}

// Gera o PDF A4 100% limpo (SEM cabeçalho, SEM rodapé, SEM paginação e SEM data/hora)
export async function gerarDocumentoPdfPeloMolde(params: {
  chaveMolde: string;
  caminhoPublicDocx?: string;
  base64Fallback?: string;
  dados: Record<string, unknown>;
  nomeArquivoSaida: string;
}): Promise<void> {
  const zipRenderizado = await renderizarZipDoMolde(params);
  const xmlTexto = zipRenderizado.file('word/document.xml')?.asText();
  if (!xmlTexto) {
    throw new Error('Não foi possível extrair o corpo do documento Word para gerar o PDF.');
  }

  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlTexto, 'application/xml');
  const body = xmlDoc.getElementsByTagName('w:body')[0];
  if (!body) {
    throw new Error('Estrutura XML do documento inválida.');
  }

  let htmlCorpo = '';
  Array.from(body.childNodes).forEach((node) => {
    if (node.nodeName === 'w:p') {
      htmlCorpo += converterParagrafoWordParaHtml(node as Element);
    } else if (node.nodeName === 'w:tbl') {
      const rows = Array.from((node as Element).getElementsByTagName('w:tr'));
      let htmlTabela =
        '<table class="tabela-interna-doc" style="width:100%; border-collapse:collapse; margin:8px 0; font-size:9.5pt;">';
      rows.forEach((tr, rowIdx) => {
        htmlTabela += '<tr>';
        const cells = Array.from(tr.getElementsByTagName('w:tc'));
        cells.forEach((tc) => {
          const ps = Array.from(tc.getElementsByTagName('w:p'));
          const cellContent = ps.map((p) => converterParagrafoWordParaHtml(p)).join('');
          const bgHeader = rowIdx === 0 ? 'background:#f8fafc; font-weight:bold;' : '';
          htmlTabela += `<td style="border:1px solid #334155; padding:4px 6px; vertical-align:middle; ${bgHeader}">${cellContent}</td>`;
        });
        htmlTabela += '</tr>';
      });
      htmlTabela += '</table>';
      htmlCorpo += htmlTabela;
    }
  });

  const nomeSugeridoPdf = params.nomeArquivoSaida.replace(/\.docx$/i, '.pdf');
  const janelaPdf = window.open('', '_blank', 'width=960,height=840');
  if (!janelaPdf) {
    alert('⚠️ Permita pop-ups no navegador para abrir a gravação em PDF.');
    return;
  }

  janelaPdf.document.write(`<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <title>&nbsp;</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 0mm !important;
      @top-left { content: "" !important; }
      @top-center { content: "" !important; }
      @top-right { content: "" !important; }
      @bottom-left { content: "" !important; }
      @bottom-center { content: "" !important; }
      @bottom-right { content: "" !important; }
    }

    html, body {
      font-family: "Calibri", "Segoe UI", Arial, sans-serif;
      font-size: 10.5pt;
      color: #000000;
      margin: 0 !important;
      padding: 0 !important;
      background: #ffffff;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    table.folha-a4-limpa {
      width: 100%;
      border-collapse: collapse;
      border: none;
    }
    table.folha-a4-limpa > thead {
      display: table-header-group;
    }
    table.folha-a4-limpa > tfoot {
      display: table-footer-group;
    }
    table.folha-a4-limpa > thead > tr > td,
    table.folha-a4-limpa > tfoot > tr > td {
      border: none !important;
      padding: 0 !important;
    }
    .espacador-margem-vertical {
      height: 15mm;
      width: 100%;
    }
    td.celula-conteudo-a4 {
      border: none !important;
      padding: 0 16mm !important;
      vertical-align: top;
    }

    @media print {
      .barra-topo-pdf {
        display: none !important;
      }
    }

    .barra-topo-pdf {
      position: sticky;
      top: 0;
      background: #1e293b;
      color: #fff;
      padding: 10px 18px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-family: sans-serif;
      font-size: 13px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.2);
      z-index: 9999;
    }
    .barra-topo-pdf button {
      background: #dc2626;
      color: #fff;
      border: none;
      padding: 7px 16px;
      border-radius: 6px;
      font-weight: bold;
      cursor: pointer;
      font-size: 12px;
    }
  </style>
</head>
<body>
  <div class="barra-topo-pdf">
    <span>📄 <strong>${nomeSugeridoPdf}</strong> — Documento limpo (sem cabeçalho, rodapé, data/hora ou paginação)</span>
    <button onclick="window.print()">🖨️ Salvar como PDF / Imprimir</button>
  </div>

  <table class="folha-a4-limpa">
    <thead>
      <tr>
        <td><div class="espacador-margem-vertical"></div></td>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td class="celula-conteudo-a4">
          ${htmlCorpo}
        </td>
      </tr>
    </tbody>
    <tfoot>
      <tr>
        <td><div class="espacador-margem-vertical"></div></td>
      </tr>
    </tfoot>
  </table>

  <script>
    window.onload = function() {
      try {
        history.replaceState(null, '', '/');
      } catch (e) {}
      setTimeout(function() {
        window.print();
      }, 250);
    };
  </script>
</body>
</html>`);
  janelaPdf.document.close();
}