// src/lib/motorWordDocx.ts
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import { saveAs } from 'file-saver';

const PREFIXO_STORAGE_MOLDE = 'bnb_v2_molde_docx_custom_';

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
      // Fallback para o Base64 embutido
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

// Converte o word/document.xml renderizado pelo Docxtemplater em PDF A4 limpo
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
        '<table style="width:100%; border-collapse:collapse; margin:8px 0; font-size:9.5pt;">';
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

  const tituloPdf = params.nomeArquivoSaida.replace(/\.docx$/i, '.pdf');
  const janelaPdf = window.open('', '_blank', 'width=960,height=840');
  if (!janelaPdf) {
    alert('⚠️ Permita pop-ups no navegador para abrir a visualização/gravação em PDF.');
    return;
  }

  janelaPdf.document.write(`<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <title>${tituloPdf}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 15mm 16mm 15mm 16mm;
    }
    body {
      font-family: "Calibri", "Segoe UI", Arial, sans-serif;
      font-size: 10.5pt;
      color: #000000;
      margin: 0;
      padding: 20px;
      background: #ffffff;
    }
    @media print {
      body { padding: 0; }
      .barra-topo-pdf { display: none !important; }
    }
    .barra-topo-pdf {
      position: sticky;
      top: 0;
      background: #1e293b;
      color: #fff;
      padding: 10px 18px;
      margin: -20px -20px 20px -20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-family: sans-serif;
      font-size: 13px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.2);
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
    <span>📄 <strong>${tituloPdf}</strong> — Escolha "Salvar como PDF" na janela de impressão</span>
    <button onclick="window.print()">🖨️ Salvar como PDF / Imprimir</button>
  </div>
  <div>${htmlCorpo}</div>
  <script>
    window.onload = function() {
      setTimeout(function() { window.print(); }, 250);
    };
  </script>
</body>
</html>`);
  janelaPdf.document.close();
}