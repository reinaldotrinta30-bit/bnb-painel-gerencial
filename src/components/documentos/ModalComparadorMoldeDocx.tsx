'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { saveAs } from 'file-saver';
import {
  BlocoDocxEditavel,
  carregarBufferDoMolde,
  extrairBlocosEditaveisDoDocx,
  reconstruirBufferDocxComBlocosEditados,
  salvarBufferMoldeCustomizadoNoSistema,
} from '@/lib/motorWordDocx';

interface ModalComparadorMoldeDocxProps {
  aberto: boolean;
  onFechar: () => void;
  tituloDocumento: string;
  chaveMolde: string;
  caminhoPublicDocx?: string;
  base64Fallback?: string;
  arquivoNovoInicial?: File | null;
  onMoldeAtualizadoComSucesso: () => void;
}

type StatusComparacaoLinha =
  | 'IGUAL'
  | 'MODIFICADO'
  | 'NOVO_NO_BANCO'
  | 'REMOVIDO_PELO_BANCO';

interface ParComparacaoAlinhado {
  idPar: string;
  status: StatusComparacaoLinha;
  idxEsquerda: number | null;
  idxDireita: number | null;
  blocoEsquerda: BlocoDocxEditavel | null;
  blocoDireita: BlocoDocxEditavel | null;
}

interface TokenDiff {
  texto: string;
  tipo: 'igual' | 'removido' | 'adicionado' | 'tag';
}

// Normaliza o texto ignorando espaços extras e tratando tags {variavel} como curingas para comparação de similaridade
function normalizarParaComparacao(txt: string): string {
  return (txt || '')
    .replace(/\{[^{}]+\}/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

// Calcula a similaridade (0 a 1) entre dois parágrafos/blocos
function calcularSimilaridadeBlocos(a: string, b: string): number {
  const normA = normalizarParaComparacao(a);
  const normB = normalizarParaComparacao(b);
  if (!normA && !normB) return 1;
  if (!normA || !normB) return 0;
  if (normA === normB) return 1;

  const palavrasA = normA.split(' ').filter((w) => w.length > 2);
  const palavrasB = normB.split(' ').filter((w) => w.length > 2);
  if (palavrasA.length === 0 || palavrasB.length === 0) {
    return normA === normB ? 1 : 0;
  }

  const setB = new Set(palavrasB);
  let comuns = 0;
  palavrasA.forEach((w) => {
    if (setB.has(w)) comuns++;
  });

  return (2 * comuns) / (palavrasA.length + palavrasB.length);
}

// Algoritmo LCS (Longest Common Subsequence) em nível de palavras para grifar exatamente o que saiu e o que entrou
function calcularDiffPalavras(textoAntigo: string, textoNovo: string): {
  tokensEsquerda: TokenDiff[];
  tokensDireita: TokenDiff[];
} {
  // Separa mantendo as tags {variavel} como tokens indivisíveis
  const tokenizar = (str: string): string[] => {
    const matches = str.match(/\{[^{}]+\}|\S+|\s+/g);
    return matches || [];
  };

  const arrA = tokenizar(textoAntigo);
  const arrB = tokenizar(textoNovo);

  // Para parágrafos muito grandes, evita matriz gigante
  if (arrA.length * arrB.length > 250000) {
    return {
      tokensEsquerda: [{ texto: textoAntigo, tipo: 'removido' }],
      tokensDireita: [{ texto: textoNovo, tipo: 'adicionado' }],
    };
  }

  const n = arrA.length;
  const m = arrB.length;
  const dp: Uint16Array[] = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));

  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      if (arrA[i] === arrB[j]) {
        dp[i][j] = dp[i + 1][j + 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }
  }

  const tokensEsquerda: TokenDiff[] = [];
  const tokensDireita: TokenDiff[] = [];

  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    const isTagA = /^\{[^{}]+\}$/.test(arrA[i]);
    if (arrA[i] === arrB[j]) {
      tokensEsquerda.push({
        texto: arrA[i],
        tipo: isTagA ? 'tag' : 'igual',
      });
      tokensDireita.push({
        texto: arrB[j],
        tipo: isTagA ? 'tag' : 'igual',
      });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      tokensEsquerda.push({
        texto: arrA[i],
        tipo: isTagA ? 'tag' : 'removido',
      });
      i++;
    } else {
      const isTagB = /^\{[^{}]+\}$/.test(arrB[j]);
      tokensDireita.push({
        texto: arrB[j],
        tipo: isTagB ? 'tag' : 'adicionado',
      });
      j++;
    }
  }

  while (i < n) {
    const isTagA = /^\{[^{}]+\}$/.test(arrA[i]);
    tokensEsquerda.push({
      texto: arrA[i],
      tipo: isTagA ? 'tag' : 'removido',
    });
    i++;
  }
  while (j < m) {
    const isTagB = /^\{[^{}]+\}$/.test(arrB[j]);
    tokensDireita.push({
      texto: arrB[j],
      tipo: isTagB ? 'tag' : 'adicionado',
    });
    j++;
  }

  return { tokensEsquerda, tokensDireita };
}

// Mescla inteligentemente um parágrafo modificado: aplica o novo texto do Banco,
// mas preserva etiquetas como {conta_corrente}, {nome}, {cpf}, {endereco}, {data_extenso} se o novo modelo veio sem as chaves
function mesclarTextoPreservandoTags(textoAntigoComTags: string, textoNovoBanco: string): string {
  // Se o texto novo já contém tags {...}, usa o texto novo diretamente
  if (/\{[^{}]+\}/.test(textoNovoBanco)) {
    return textoNovoBanco;
  }

  let resultado = textoNovoBanco;

  // 1. Se o parágrafo antigo tinha {conta_corrente} e o novo tem "de n° ____" ou "de número { }" ou um número de conta
  if (textoAntigoComTags.includes('{conta_corrente}') || textoAntigoComTags.includes('{  }')) {
    resultado = resultado.replace(
      /(movimentação\s+de\s+n(?:º|°|úmero)\s*)([0-9.\-X_]+|\{\s*\})/i,
      '$1{conta_corrente}'
    );
  }

  // 2. Se for o parágrafo de qualificação inicial com {nome} e {cpf}
  if (textoAntigoComTags.includes('{nome}') && textoAntigoComTags.includes('{cpf}')) {
    if (
      resultado.toUpperCase().includes('RESIDENTE E') &&
      resultado.toUpperCase().includes('DOMICILIADO')
    ) {
      return 'O (A) Sr.(ª) {nome}, CPF: {cpf}, residente e domiciliado (a) n(o)a {endereco}, declara, para todos os fins de direito e sob as penas da lei, que:';
    }
  }

  // 3. Se for linha de local e data por extenso (Ex: Santa Inês - MA, 09 de Setembro de 2026)
  if (textoAntigoComTags.includes('{data_extenso}')) {
    resultado = resultado.replace(
      /,\s*\d{1,2}\s+de\s+[a-zç]+\s+de\s+\d{4}/i,
      ', {data_extenso}'
    );
  }

  return resultado;
}

// Alinha os blocos do Modelo Atual (Esquerda) com os blocos do Novo Modelo (Direita)
function alinharBlocosParaComparacao(
  esquerda: BlocoDocxEditavel[],
  direita: BlocoDocxEditavel[]
): ParComparacaoAlinhado[] {
  const pares: ParComparacaoAlinhado[] = [];
  let i = 0;
  let j = 0;

  while (i < esquerda.length && j < direita.length) {
    const bEsq = esquerda[i];
    const bDir = direita[j];

    const simDireta = calcularSimilaridadeBlocos(bEsq.texto, bDir.texto);

    if (bEsq.texto.trim() === bDir.texto.trim()) {
      pares.push({
        idPar: `par_${i}_${j}`,
        status: 'IGUAL',
        idxEsquerda: i,
        idxDireita: j,
        blocoEsquerda: bEsq,
        blocoDireita: bDir,
      });
      i++;
      j++;
      continue;
    }

    if (simDireta >= 0.42) {
      pares.push({
        idPar: `par_${i}_${j}`,
        status: 'MODIFICADO',
        idxEsquerda: i,
        idxDireita: j,
        blocoEsquerda: bEsq,
        blocoDireita: bDir,
      });
      i++;
      j++;
      continue;
    }

    // Procura janela à frente na direita (para detectar se entrou um bloco novo no modelo do Banco)
    let achouNaDireita = -1;
    for (let k = j + 1; k < Math.min(direita.length, j + 12); k++) {
      if (calcularSimilaridadeBlocos(bEsq.texto, direita[k].texto) >= 0.48) {
        achouNaDireita = k;
        break;
      }
    }

    // Procura janela à frente na esquerda (para detectar se o Banco removeu blocos antigos como PROAGRO/CEI/Ônus)
    let achouNaEsquerda = -1;
    for (let k = i + 1; k < Math.min(esquerda.length, i + 25); k++) {
      if (calcularSimilaridadeBlocos(esquerda[k].texto, bDir.texto) >= 0.48) {
        achouNaEsquerda = k;
        break;
      }
    }

    if (
      achouNaDireita !== -1 &&
      (achouNaEsquerda === -1 || achouNaDireita - j <= achouNaEsquerda - i)
    ) {
      while (j < achouNaDireita) {
        pares.push({
          idPar: `par_novo_${j}`,
          status: 'NOVO_NO_BANCO',
          idxEsquerda: null,
          idxDireita: j,
          blocoEsquerda: null,
          blocoDireita: direita[j],
        });
        j++;
      }
    } else if (achouNaEsquerda !== -1) {
      while (i < achouNaEsquerda) {
        pares.push({
          idPar: `par_rem_${i}`,
          status: 'REMOVIDO_PELO_BANCO',
          idxEsquerda: i,
          idxDireita: null,
          blocoEsquerda: esquerda[i],
          blocoDireita: null,
        });
        i++;
      }
    } else {
      pares.push({
        idPar: `par_mod_${i}_${j}`,
        status: 'MODIFICADO',
        idxEsquerda: i,
        idxDireita: j,
        blocoEsquerda: bEsq,
        blocoDireita: bDir,
      });
      i++;
      j++;
    }
  }

  while (i < esquerda.length) {
    pares.push({
      idPar: `par_rem_tail_${i}`,
      status: 'REMOVIDO_PELO_BANCO',
      idxEsquerda: i,
      idxDireita: null,
      blocoEsquerda: esquerda[i],
      blocoDireita: null,
    });
    i++;
  }

  while (j < direita.length) {
    pares.push({
      idPar: `par_novo_tail_${j}`,
      status: 'NOVO_NO_BANCO',
      idxEsquerda: null,
      idxDireita: j,
      blocoEsquerda: null,
      blocoDireita: direita[j],
    });
    j++;
  }

  return pares;
}

export default function ModalComparadorMoldeDocx({
  aberto,
  onFechar,
  tituloDocumento,
  chaveMolde,
  caminhoPublicDocx,
  base64Fallback,
  arquivoNovoInicial,
  onMoldeAtualizadoComSucesso,
}: ModalComparadorMoldeDocxProps) {
  const [bufferBaseSistema, setBufferBaseSistema] = useState<ArrayBuffer | null>(null);
  const [blocosEsquerda, setBlocosEsquerda] = useState<BlocoDocxEditavel[]>([]);
  const [blocosDireita, setBlocosDireita] = useState<BlocoDocxEditavel[]>([]);
  const [nomeArquivoNovo, setNomeArquivoNovo] = useState<string>('');

  const [rolagemSincronizada, setRolagemSincronizada] = useState(true);
  const [somenteDiferencas, setSomenteDiferencas] = useState(false);
  const [modoEdicaoLivre, setModoEdicaoLivre] = useState(false);

  // Modal interno para colar texto de um PDF caso o novo modelo do Banco tenha vindo em PDF
  const [modalColarTextoPdfAberto, setModalColarTextoPdfAberto] = useState(false);
  const [textoColadoPdf, setTextoColadoPdf] = useState('');

  const painelEsqRef = useRef<HTMLDivElement>(null);
  const painelDirRef = useRef<HTMLDivElement>(null);
  const sincronizandoScrollRef = useRef(false);
  const inputTrocarArqRef = useRef<HTMLInputElement>(null);

  // Carrega o molde atual do sistema (Esquerda)
  useEffect(() => {
    if (!aberto) return;
    carregarBufferDoMolde({
      chaveMolde,
      caminhoPublicDocx,
      base64Fallback,
    })
      .then((buf) => {
        setBufferBaseSistema(buf);
        const extraidos = extrairBlocosEditaveisDoDocx(buf);
        setBlocosEsquerda(extraidos);
      })
      .catch((err) => {
        alert('Erro ao carregar o molde atual do sistema: ' + err.message);
      });
  }, [aberto, chaveMolde, caminhoPublicDocx, base64Fallback]);

  // Carrega o novo arquivo importado pelo usuário (Direita)
  useEffect(() => {
    if (!aberto || !arquivoNovoInicial) return;
    lerArquivoNovoImportado(arquivoNovoInicial);
  }, [aberto, arquivoNovoInicial]);

  const lerArquivoNovoImportado = async (file: File) => {
    setNomeArquivoNovo(file.name);
    if (file.name.toLowerCase().endsWith('.docx')) {
      try {
        const buf = await file.arrayBuffer();
        const extraidos = extrairBlocosEditaveisDoDocx(buf);
        setBlocosDireita(extraidos);
      } catch {
        alert('❌ Não foi possível ler o arquivo .docx selecionado.');
      }
    } else {
      const txt = await file.text();
      converterTextoBrutoParaBlocosDireita(txt, file.name);
    }
  };

  const converterTextoBrutoParaBlocosDireita = (txt: string, labelOrigem: string) => {
    const linhas = txt
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    const novosBlocos: BlocoDocxEditavel[] = linhas.map((linha, idx) => ({
      id: `novo_txt_${idx}_${Date.now()}`,
      tipo: 'p',
      texto: linha,
      negrito: linha.length < 95 && !linha.startsWith('(') && !linha.endsWith('.'),
      alinhamento: 'both',
      foiEditado: true,
    }));
    setBlocosDireita(novosBlocos);
    setNomeArquivoNovo(labelOrigem);
  };

  // Sincronia de rolagem simultânea entre os dois painéis
  const handleScrollEsquerda = () => {
    if (!rolagemSincronizada || sincronizandoScrollRef.current) return;
    const esq = painelEsqRef.current;
    const dir = painelDirRef.current;
    if (!esq || !dir) return;

    sincronizandoScrollRef.current = true;
    const maxEsq = esq.scrollHeight - esq.clientHeight;
    const maxDir = dir.scrollHeight - dir.clientHeight;
    if (maxEsq > 0 && maxDir > 0) {
      dir.scrollTop = (esq.scrollTop / maxEsq) * maxDir;
    }
    setTimeout(() => {
      sincronizandoScrollRef.current = false;
    }, 25);
  };

  const handleScrollDireita = () => {
    if (!rolagemSincronizada || sincronizandoScrollRef.current) return;
    const esq = painelEsqRef.current;
    const dir = painelDirRef.current;
    if (!esq || !dir) return;

    sincronizandoScrollRef.current = true;
    const maxDir = dir.scrollHeight - dir.clientHeight;
    const maxEsq = esq.scrollHeight - esq.clientHeight;
    if (maxDir > 0 && maxEsq > 0) {
      esq.scrollTop = (dir.scrollTop / maxDir) * maxEsq;
    }
    setTimeout(() => {
      sincronizandoScrollRef.current = false;
    }, 25);
  };

  const paresAlinhados = useMemo(
    () => alinharBlocosParaComparacao(blocosEsquerda, blocosDireita),
    [blocosEsquerda, blocosDireita]
  );

  // Estatísticas da varredura
  const estatisticas = useMemo(() => {
    let iguais = 0;
    let modificados = 0;
    let novos = 0;
    let removidos = 0;
    paresAlinhados.forEach((p) => {
      if (p.status === 'IGUAL') iguais++;
      else if (p.status === 'MODIFICADO') modificados++;
      else if (p.status === 'NOVO_NO_BANCO') novos++;
      else if (p.status === 'REMOVIDO_PELO_BANCO') removidos++;
    });
    return { iguais, modificados, novos, removidos };
  }, [paresAlinhados]);

  // Extrai todas as tags {variavel} presentes no Molde Atual para a barra de inserção rápida
  const tagsDetectadasNoMolde = useMemo(() => {
    const conj = new Set<string>();
    blocosEsquerda.forEach((b) => {
      const matches = b.texto.match(/\{[^{}]+\}/g);
      matches?.forEach((m) => conj.add(m));
    });
    return Array.from(conj);
  }, [blocosEsquerda]);

  // AÇÃO INDIVIDUAL: Aceitar modificação de 1 parágrafo específico (Direita -> Esquerda, preservando tags)
  const aplicarModificacaoNoBlocoEsquerdo = (par: ParComparacaoAlinhado) => {
    if (par.idxEsquerda === null || !par.blocoDireita) return;
    const copia = [...blocosEsquerda];
    const antigo = copia[par.idxEsquerda];
    const textoMesclado = mesclarTextoPreservandoTags(
      antigo.texto,
      par.blocoDireita.texto
    );
    copia[par.idxEsquerda] = {
      ...antigo,
      texto: textoMesclado,
      linhasTabela: par.blocoDireita.linhasTabela
        ? [...par.blocoDireita.linhasTabela]
        : antigo.linhasTabela,
      foiEditado: true,
    };
    setBlocosEsquerda(copia);
  };

  // AÇÃO INDIVIDUAL: Inserir cláusula nova do Banco no Molde do Sistema
  const inserirBlocoNovoNoMoldeEsquerdo = (par: ParComparacaoAlinhado, indicePar: number) => {
    if (!par.blocoDireita) return;
    // Descobre a posição imediatamente posterior ao último bloco esquerdo visto antes deste par
    let posInsercao = blocosEsquerda.length;
    for (let k = indicePar - 1; k >= 0; k--) {
      const idxAnt = paresAlinhados[k].idxEsquerda;
      if (idxAnt !== null) {
        posInsercao = idxAnt + 1;
        break;
      }
    }
    if (indicePar === 0) posInsercao = 0;

    const novoBloco: BlocoDocxEditavel = {
      ...par.blocoDireita,
      id: `ins_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      foiEditado: true,
    };

    const copia = [...blocosEsquerda];
    copia.splice(posInsercao, 0, novoBloco);
    setBlocosEsquerda(copia);
  };

  // AÇÃO INDIVIDUAL: Remover do Molde do Sistema um bloco que foi excluído pelo Banco
  const removerBlocoDoMoldeEsquerdo = (idxEsquerda: number) => {
    setBlocosEsquerda(blocosEsquerda.filter((_, i) => i !== idxEsquerda));
  };

  // AÇÃO MESTRA (1 CLIQUE): Aplicar todas as atualizações do novo modelo no modelo antigo (preservando tags {...})
  const aplicarTodasAsMudancasAutomaticamente = () => {
    if (blocosDireita.length === 0) {
      alert('Importe primeiro o novo modelo do Banco para aplicar as atualizações!');
      return;
    }

    const novaListaEsquerda: BlocoDocxEditavel[] = [];

    paresAlinhados.forEach((par) => {
      if (par.status === 'IGUAL' && par.blocoEsquerda) {
        novaListaEsquerda.push(par.blocoEsquerda);
      } else if (
        par.status === 'MODIFICADO' &&
        par.blocoEsquerda &&
        par.blocoDireita
      ) {
        // Se o bloco da esquerda for uma tabela com tags {#imoveis} (ex: Suporte Forrageiro),
        // preserva as tags da tabela atualizando apenas ajustes necessários
        if (par.blocoEsquerda.tipo === 'tbl' && par.blocoEsquerda.texto.includes('{#')) {
          novaListaEsquerda.push(par.blocoEsquerda);
        } else {
          const textoMesclado = mesclarTextoPreservandoTags(
            par.blocoEsquerda.texto,
            par.blocoDireita.texto
          );
          novaListaEsquerda.push({
            ...par.blocoEsquerda,
            texto: textoMesclado,
            foiEditado: true,
          });
        }
      } else if (par.status === 'NOVO_NO_BANCO' && par.blocoDireita) {
        novaListaEsquerda.push({
          ...par.blocoDireita,
          id: `merged_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          foiEditado: true,
        });
      }
      // Se status === 'REMOVIDO_PELO_BANCO', não inclui na novaListaEsquerda (pois saiu no modelo novo!)
    });

    setBlocosEsquerda(novaListaEsquerda);
    alert(
      '✨ Todas as atualizações do novo modelo foram aplicadas ao Molde do Sistema (preservando as etiquetas {...})!\n\nConfira o resultado na coluna da esquerda e clique em "💾 Salvar no Sistema" para gravar.'
    );
  };

  const salvarMoldeMescladoNoSistema = () => {
    if (!bufferBaseSistema) return;
    try {
      const novoBuffer = reconstruirBufferDocxAPartirDeBlocosSeguros(
        bufferBaseSistema,
        blocosEsquerda
      );
      salvarBufferMoldeCustomizadoNoSistema(chaveMolde, novoBuffer);
      onMoldeAtualizadoComSucesso();
      alert(
        '✅ Molde atualizado e salvo no sistema com sucesso! Todas as próximas gerações em Word (.DOCX) e PDF já usarão esta nova versão.'
      );
      onFechar();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao salvar molde';
      alert('❌ Erro ao reconstruir o arquivo .docx: ' + msg);
    }
  };

  const baixarMoldeMescladoDocx = () => {
    if (!bufferBaseSistema) return;
    try {
      const novoBuffer = reconstruirBufferDocxAPartirDeBlocosSeguros(
        bufferBaseSistema,
        blocosEsquerda
      );
      const blob = new Blob([novoBuffer], {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });
      saveAs(blob, `MOLDE_ATUALIZADO_${chaveMolde}.docx`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao baixar molde';
      alert('❌ Erro ao gerar arquivo .docx: ' + msg);
    }
  };

  function reconstruirBufferDocxAPartirDeBlocosSeguros(
    bufBase: ArrayBuffer,
    blocos: BlocoDocxEditavel[]
  ): ArrayBuffer {
    return reconstruirBufferDocxComBlocosEditados(bufBase, blocos);
  }

  if (!aberto || typeof document === 'undefined') return null;

  const paresVisiveis = somenteDiferencas
    ? paresAlinhados.filter((p) => p.status !== 'IGUAL')
    : paresAlinhados;

  return createPortal(
    <div
      onMouseDown={(e) => e.stopPropagation()}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 23, 42, 0.82)',
        zIndex: 20000050,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backdropFilter: 'blur(4px)',
      }}
    >
      <div
        style={{
          background: '#ffffff',
          width: '97vw',
          height: '95vh',
          borderRadius: '12px',
          boxShadow: '0 25px 60px rgba(0,0,0,0.55)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          borderTop: '5px solid #1d4ed8',
        }}
      >
        {/* ================================================================= */}
        {/* BARRA SUPERIOR DO COMPARADOR INTELIGENTE DE MODELOS               */}
        {/* ================================================================= */}
        <div
          style={{
            padding: '12px 20px',
            background: '#0f172a',
            color: '#ffffff',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '10px',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <h3 style={{ margin: 0, fontSize: '15.5px', fontWeight: 800, color: '#ffffff' }}>
                🔍 COMPARADOR E ATUALIZADOR INTELIGENTE DE MODELOS: {tituloDocumento}
              </h3>
              {nomeArquivoNovo && (
                <span
                  style={{
                    background: '#1e293b',
                    border: '1px solid #475569',
                    color: '#38bdf8',
                    padding: '2px 10px',
                    borderRadius: '12px',
                    fontSize: '11px',
                    fontWeight: 700,
                  }}
                >
                  📄 Comparando com: {nomeArquivoNovo}
                </span>
              )}
            </div>
            <div style={{ display: 'flex', gap: '12px', marginTop: '5px', fontSize: '11.5px', flexWrap: 'wrap' }}>
              <span style={{ color: '#94a3b8' }}>
                ⚪ <b>{estatisticas.iguais}</b> idênticos
              </span>
              <span style={{ color: '#fde047' }}>
                🟡 <b>{estatisticas.modificados}</b> modificados
              </span>
              <span style={{ color: '#4ade80' }}>
                🟢 <b>+{estatisticas.novos}</b> blocos novos no modelo do Banco
              </span>
              <span style={{ color: '#f87171' }}>
                🔴 <b>-{estatisticas.removidos}</b> blocos removidos pelo Banco
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <input
              ref={inputTrocarArqRef}
              type="file"
              accept=".docx,.txt"
              style={{ display: 'none' }}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) lerArquivoNovoImportado(f);
                e.target.value = '';
              }}
            />

            <button
              type="button"
              onClick={() => inputTrocarArqRef.current?.click()}
              style={{
                width: 'auto',
                padding: '6px 12px',
                fontSize: '11.5px',
                fontWeight: 700,
                background: '#1e293b',
                color: '#e2e8f0',
                border: '1px solid #475569',
                borderRadius: '6px',
                cursor: 'pointer',
              }}
            >
              📂 Carregar Outro .DOCX
            </button>

            <button
              type="button"
              onClick={() => setModalColarTextoPdfAberto(true)}
              style={{
                width: 'auto',
                padding: '6px 12px',
                fontSize: '11.5px',
                fontWeight: 700,
                background: '#1e293b',
                color: '#fde047',
                border: '1px solid #475569',
                borderRadius: '6px',
                cursor: 'pointer',
              }}
              title="Se o novo modelo do Banco estiver em PDF, cole o texto dele aqui para comparar!"
            >
              📋 Colar Texto de Novo PDF/Word
            </button>

            <button
              type="button"
              onClick={aplicarTodasAsMudancasAutomaticamente}
              style={{
                width: 'auto',
                padding: '7px 14px',
                fontSize: '12px',
                fontWeight: 800,
                background: '#2563eb',
                color: '#ffffff',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(37,99,235,0.4)',
              }}
              title="Atualiza automaticamente o modelo antigo com todas as cláusulas novas e alterações do modelo novo, preservando as variáveis {...}"
            >
              ⚡ Aplicar Mudanças Automaticamente no Modelo Antigo
            </button>

            <button
              type="button"
              onClick={onFechar}
              style={{
                width: 'auto',
                background: 'none',
                border: 'none',
                fontSize: '24px',
                color: '#94a3b8',
                cursor: 'pointer',
                padding: '0 4px',
              }}
            >
              &times;
            </button>
          </div>
        </div>

        {/* ================================================================= */}
        {/* SUB-BARRA DE CONTROLES: ROLAGEM SIMULTÂNEA, FILTRO E TAGS RÁPIDAS */}
        {/* ================================================================= */}
        <div
          style={{
            padding: '8px 20px',
            background: '#f1f5f9',
            borderBottom: '1px solid #cbd5e1',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '10px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <label
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '12px',
                fontWeight: 800,
                color: rolagemSincronizada ? '#1d4ed8' : '#475569',
                cursor: 'pointer',
                margin: 0,
              }}
            >
              <input
                type="checkbox"
                checked={rolagemSincronizada}
                onChange={(e) => setRolagemSincronizada(e.target.checked)}
                style={{ width: '14px', height: '14px', margin: 0 }}
              />
              🔗 Rolagem Simultânea Lado a Lado
            </label>

            <label
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '12px',
                fontWeight: 700,
                color: somenteDiferencas ? '#b45309' : '#475569',
                cursor: 'pointer',
                margin: 0,
              }}
            >
              <input
                type="checkbox"
                checked={somenteDiferencas}
                onChange={(e) => setSomenteDiferencas(e.target.checked)}
                style={{ width: '14px', height: '14px', margin: 0 }}
              />
              🎯 Mostrar Apenas Parágrafos com Diferenças
            </label>

            <button
              type="button"
              onClick={() => setModoEdicaoLivre((prev) => !prev)}
              style={{
                width: 'auto',
                padding: '4px 12px',
                fontSize: '11.5px',
                fontWeight: 800,
                background: modoEdicaoLivre ? '#8B1530' : '#ffffff',
                color: modoEdicaoLivre ? '#ffffff' : '#334155',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                cursor: 'pointer',
              }}
            >
              {modoEdicaoLivre
                ? '🔍 Voltar p/ Visão Grifada (Diff)'
                : '✍️ Alternar p/ Edição Direta de Texto nos 2 Documentos'}
            </button>
          </div>

          {/* Barra de Etiquetas Detectadas (Clique para copiar e colar onde quiser) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#475569' }}>
              🏷️ Etiquetas do Molde (Clique p/ copiar):
            </span>
            {tagsDetectadasNoMolde.slice(0, 10).map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(tag);
                }}
                title="Clique para copiar esta etiqueta para a área de transferência"
                style={{
                  width: 'auto',
                  padding: '2px 7px',
                  fontSize: '10.5px',
                  fontFamily: 'monospace',
                  fontWeight: 700,
                  background: '#fef9c3',
                  color: '#854d0e',
                  border: '1px solid #fde047',
                  borderRadius: '4px',
                  cursor: 'pointer',
                }}
              >
                {tag}
              </button>
            ))}
          </div>
        </div>

        {/* ================================================================= */}
        {/* CABEÇALHOS FIXOS DAS DUAS FOLHAS LADO A LADO                      */}
        {/* ================================================================= */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            background: '#e2e8f0',
            borderBottom: '1px solid #cbd5e1',
            fontWeight: 800,
            fontSize: '12px',
          }}
        >
          <div
            style={{
              padding: '8px 18px',
              color: '#8B1530',
              borderRight: '1px solid #cbd5e1',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span>📄 DOCUMENTO 1: MODELO ATUAL DO SISTEMA (EDITÁVEL)</span>
            <button
              type="button"
              onClick={() =>
                setBlocosEsquerda([
                  ...blocosEsquerda,
                  {
                    id: `novo_man_${Date.now()}`,
                    tipo: 'p',
                    texto: 'Novo parágrafo...',
                    foiEditado: true,
                  },
                ])
              }
              style={{
                width: 'auto',
                padding: '2px 8px',
                fontSize: '10.5px',
                background: '#ffffff',
                color: '#8B1530',
                border: '1px solid #8B1530',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            >
              + Adicionar Parágrafo ao Final
            </button>
          </div>
          <div
            style={{
              padding: '8px 18px',
              color: '#15803d',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span>🆕 DOCUMENTO 2: NOVO MODELO IMPORTADO DO BANCO (EDITÁVEL)</span>
            <span style={{ fontSize: '10.5px', fontWeight: 600, color: '#475569' }}>
              Grifos em verde = texto novo • Grifos em vermelho = texto que saiu
            </span>
          </div>
        </div>

        {/* ================================================================= */}
        {/* CORPO PRINCIPAL: TELA DIVIDIDA COM ROLAGEM SIMULTÂNEA             */}
        {/* ================================================================= */}
        <div
          style={{
            flex: 1,
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            overflow: 'hidden',
            background: '#cbd5e1',
            gap: '1px',
          }}
        >
          {/* COLUNA DA ESQUERDA: MODELO DO SISTEMA NA ÍNTEGRA */}
          <div
            ref={painelEsqRef}
            onScroll={handleScrollEsquerda}
            style={{
              overflowY: 'auto',
              background: '#ffffff',
              padding: '18px 22px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
            }}
          >
            {paresVisiveis.map((par) => {
              const bEsq = par.blocoEsquerda;
              const bDir = par.blocoDireita;

              if (!bEsq) {
                // Espaço alinhado correspondente a um bloco que só existe no Novo Modelo (Direita)
                return (
                  <div
                    key={par.idPar}
                    style={{
                      border: '1.5px dashed #86efac',
                      background: '#f0fdf4',
                      borderRadius: '8px',
                      padding: '12px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      minHeight: '54px',
                    }}
                  >
                    <span style={{ fontSize: '11.5px', color: '#15803d', fontWeight: 700 }}>
                      ➕ Cláusula/Parágrafo novo detectado no modelo do Banco ao lado ➔
                    </span>
                  </div>
                );
              }

              const diff =
                par.status === 'MODIFICADO' && bDir
                  ? calcularDiffPalavras(bEsq.texto, bDir.texto)
                  : null;

              const corBordaEsq =
                par.status === 'REMOVIDO_PELO_BANCO'
                  ? '#ef4444'
                  : par.status === 'MODIFICADO'
                  ? '#f59e0b'
                  : '#e2e8f0';

              const corFundoEsq =
                par.status === 'REMOVIDO_PELO_BANCO'
                  ? '#fef2f2'
                  : par.status === 'MODIFICADO'
                  ? '#fffbeb'
                  : '#ffffff';

              return (
                <div
                  key={par.idPar}
                  style={{
                    border: `1px solid ${corBordaEsq}`,
                    borderLeft: `4px solid ${corBordaEsq}`,
                    background: corFundoEsq,
                    borderRadius: '6px',
                    padding: '10px 12px',
                  }}
                >
                  {/* Barra de status e ações rápidas do bloco esquerdo */}
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: '6px',
                    }}
                  >
                    <span
                      style={{
                        fontSize: '10px',
                        fontWeight: 800,
                        color:
                          par.status === 'REMOVIDO_PELO_BANCO'
                            ? '#dc2626'
                            : par.status === 'MODIFICADO'
                            ? '#b45309'
                            : '#64748b',
                      }}
                    >
                      {par.status === 'REMOVIDO_PELO_BANCO'
                        ? '🔴 REMOVIDO NO NOVO MODELO DO BANCO'
                        : par.status === 'MODIFICADO'
                        ? '🟡 REDAÇÃO ALTERADA NO NOVO MODELO'
                        : '⚪ MANTIDO IGUAL'}
                    </span>

                    <div style={{ display: 'flex', gap: '6px' }}>
                      {par.idxEsquerda !== null && (
                        <button
                          type="button"
                          onClick={() => removerBlocoDoMoldeEsquerdo(par.idxEsquerda!)}
                          style={{
                            width: 'auto',
                            padding: '2px 8px',
                            fontSize: '10px',
                            fontWeight: 700,
                            background: '#fee2e2',
                            color: '#b91c1c',
                            border: '1px solid #fecaca',
                            borderRadius: '4px',
                            cursor: 'pointer',
                          }}
                          title="Excluir este parágrafo/tabela do Molde do Sistema"
                        >
                          🗑️ Excluir do Molde
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Conteúdo do Bloco Esquerdo: Modo Grifado vs Modo Edição Direta */}
                  {modoEdicaoLivre ? (
                    <textarea
                      value={bEsq.texto}
                      rows={Math.max(2, Math.ceil(bEsq.texto.length / 85))}
                      onChange={(e) => {
                        if (par.idxEsquerda === null) return;
                        const copia = [...blocosEsquerda];
                        copia[par.idxEsquerda] = {
                          ...copia[par.idxEsquerda],
                          texto: e.target.value,
                          foiEditado: true,
                        };
                        setBlocosEsquerda(copia);
                      }}
                      style={{
                        width: '100%',
                        fontSize: '12px',
                        lineHeight: 1.45,
                        padding: '6px 8px',
                        border: '1px solid #cbd5e1',
                        borderRadius: '4px',
                        fontWeight: bEsq.negrito ? 700 : 400,
                      }}
                    />
                  ) : (
                    <div
                      onClick={() => setModoEdicaoLivre(true)}
                      title="Clique para editar manualmente o texto"
                      style={{
                        fontSize: '12px',
                        lineHeight: 1.5,
                        color: '#0f172a',
                        fontWeight: bEsq.negrito ? 700 : 400,
                        whiteSpace: 'pre-wrap',
                        cursor: 'text',
                      }}
                    >
                      {diff
                        ? diff.tokensEsquerda.map((tk, idxTk) => {
                            if (tk.tipo === 'tag') {
                              return (
                                <span
                                  key={idxTk}
                                  style={{
                                    background: '#fef9c3',
                                    color: '#854d0e',
                                    border: '1px solid #fde047',
                                    padding: '0 4px',
                                    borderRadius: '4px',
                                    fontFamily: 'monospace',
                                    fontWeight: 700,
                                  }}
                                >
                                  {tk.texto}
                                </span>
                              );
                            }
                            if (tk.tipo === 'removido') {
                              return (
                                <span
                                  key={idxTk}
                                  style={{
                                    background: '#fecaca',
                                    color: '#991b1b',
                                    textDecoration: 'line-through',
                                    padding: '0 2px',
                                    borderRadius: '2px',
                                  }}
                                >
                                  {tk.texto}
                                </span>
                              );
                            }
                            return <span key={idxTk}>{tk.texto}</span>;
                          })
                        : bEsq.texto.split(/(\{[^{}]+\})/g).map((parte, idxP) =>
                            /^\{[^{}]+\}$/.test(parte) ? (
                              <span
                                key={idxP}
                                style={{
                                  background: '#fef9c3',
                                  color: '#854d0e',
                                  border: '1px solid #fde047',
                                  padding: '0 4px',
                                  borderRadius: '4px',
                                  fontFamily: 'monospace',
                                  fontWeight: 700,
                                }}
                              >
                                {parte}
                              </span>
                            ) : (
                              <span
                                key={idxP}
                                style={
                                  par.status === 'REMOVIDO_PELO_BANCO'
                                    ? {
                                        background: '#fee2e2',
                                        color: '#991b1b',
                                        textDecoration: 'line-through',
                                      }
                                    : undefined
                                }
                              >
                                {parte}
                              </span>
                            )
                          )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* COLUNA DA DIREITA: NOVO MODELO IMPORTADO DO BANCO NA ÍNTEGRA */}
          <div
            ref={painelDirRef}
            onScroll={handleScrollDireita}
            style={{
              overflowY: 'auto',
              background: '#ffffff',
              padding: '18px 22px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
            }}
          >
            {blocosDireita.length === 0 ? (
              <div
                style={{
                  border: '2px dashed #94a3b8',
                  borderRadius: '10px',
                  padding: '40px 20px',
                  textAlign: 'center',
                  color: '#475569',
                  margin: 'auto 0',
                }}
              >
                <h4 style={{ margin: '0 0 8px 0', color: '#1e293b' }}>
                  📤 Nenhum Novo Modelo Carregado Ainda
                </h4>
                <p style={{ fontSize: '12px', margin: '0 0 14px 0' }}>
                  Selecione o arquivo <b>.DOCX</b> baixado do sistema do Banco ou cole o texto de um <b>PDF</b> para varrer todas as diferenças lado a lado:
                </p>
                <div style={{ display: 'flex', justifyContent: 'center', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={() => inputTrocarArqRef.current?.click()}
                    style={{
                      width: 'auto',
                      padding: '8px 16px',
                      background: '#2563eb',
                      color: '#fff',
                      borderRadius: '6px',
                      border: 'none',
                      fontWeight: 700,
                      fontSize: '12px',
                      cursor: 'pointer',
                    }}
                  >
                    📂 Selecionar Arquivo .DOCX do Banco
                  </button>
                  <button
                    type="button"
                    onClick={() => setModalColarTextoPdfAberto(true)}
                    style={{
                      width: 'auto',
                      padding: '8px 16px',
                      background: '#0f172a',
                      color: '#fde047',
                      borderRadius: '6px',
                      border: 'none',
                      fontWeight: 700,
                      fontSize: '12px',
                      cursor: 'pointer',
                    }}
                  >
                    📋 Colar Texto de Novo PDF
                  </button>
                </div>
              </div>
            ) : (
              paresVisiveis.map((par, idxParVisivel) => {
                const bEsq = par.blocoEsquerda;
                const bDir = par.blocoDireita;

                if (!bDir) {
                  // Espaço alinhado correspondente a um bloco que foi removido pelo Banco
                  return (
                    <div
                      key={par.idPar}
                      style={{
                        border: '1.5px dashed #fca5a5',
                        background: '#fef2f2',
                        borderRadius: '8px',
                        padding: '12px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        minHeight: '54px',
                      }}
                    >
                      <span style={{ fontSize: '11.5px', color: '#b91c1c', fontWeight: 700 }}>
                        ⬅️ Este trecho não consta mais no novo modelo do Banco.
                      </span>
                      {par.idxEsquerda !== null && (
                        <button
                          type="button"
                          onClick={() => removerBlocoDoMoldeEsquerdo(par.idxEsquerda!)}
                          style={{
                            width: 'auto',
                            padding: '4px 10px',
                            fontSize: '11px',
                            fontWeight: 800,
                            background: '#dc2626',
                            color: '#ffffff',
                            border: 'none',
                            borderRadius: '5px',
                            cursor: 'pointer',
                          }}
                        >
                          🗑️ Remover também do Molde Antigo
                        </button>
                      )}
                    </div>
                  );
                }

                const diff =
                  par.status === 'MODIFICADO' && bEsq
                    ? calcularDiffPalavras(bEsq.texto, bDir.texto)
                    : null;

                const corBordaDir =
                  par.status === 'NOVO_NO_BANCO'
                    ? '#16a34a'
                    : par.status === 'MODIFICADO'
                    ? '#f59e0b'
                    : '#e2e8f0';

                const corFundoDir =
                  par.status === 'NOVO_NO_BANCO'
                    ? '#f0fdf4'
                    : par.status === 'MODIFICADO'
                    ? '#fffbeb'
                    : '#ffffff';

                return (
                  <div
                    key={par.idPar}
                    style={{
                      border: `1px solid ${corBordaDir}`,
                      borderLeft: `4px solid ${corBordaDir}`,
                      background: corFundoDir,
                      borderRadius: '6px',
                      padding: '10px 12px',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: '6px',
                        flexWrap: 'wrap',
                        gap: '6px',
                      }}
                    >
                      <span
                        style={{
                          fontSize: '10px',
                          fontWeight: 800,
                          color:
                            par.status === 'NOVO_NO_BANCO'
                              ? '#15803d'
                              : par.status === 'MODIFICADO'
                              ? '#b45309'
                              : '#64748b',
                        }}
                      >
                        {par.status === 'NOVO_NO_BANCO'
                          ? '🟢 CLÁUSULA NOVA ADICIONADA PELO BANCO'
                          : par.status === 'MODIFICADO'
                          ? '🟡 REDAÇÃO ATUALIZADA PELO BANCO'
                          : '⚪ IDÊNTICO AO MODELO ATUAL'}
                      </span>

                      <div style={{ display: 'flex', gap: '6px' }}>
                        {par.status === 'MODIFICADO' && (
                          <button
                            type="button"
                            onClick={() => aplicarModificacaoNoBlocoEsquerdo(par)}
                            style={{
                              width: 'auto',
                              padding: '3px 10px',
                              fontSize: '10.5px',
                              fontWeight: 800,
                              background: '#2563eb',
                              color: '#ffffff',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: 'pointer',
                            }}
                            title="Atualiza o parágrafo correspondente na esquerda mantendo as etiquetas {...}"
                          >
                            ⬅️ Atualizar no Molde Antigo
                          </button>
                        )}

                        {par.status === 'NOVO_NO_BANCO' && (
                          <button
                            type="button"
                            onClick={() =>
                              inserirBlocoNovoNoMoldeEsquerdo(par, idxParVisivel)
                            }
                            style={{
                              width: 'auto',
                              padding: '3px 10px',
                              fontSize: '10.5px',
                              fontWeight: 800,
                              background: '#15803d',
                              color: '#ffffff',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: 'pointer',
                            }}
                          >
                            ⬅️ Inserir esta Cláusula no Molde Antigo
                          </button>
                        )}
                      </div>
                    </div>

                    {modoEdicaoLivre ? (
                      <textarea
                        value={bDir.texto}
                        rows={Math.max(2, Math.ceil(bDir.texto.length / 85))}
                        onChange={(e) => {
                          if (par.idxDireita === null) return;
                          const copia = [...blocosDireita];
                          copia[par.idxDireita] = {
                            ...copia[par.idxDireita],
                            texto: e.target.value,
                            foiEditado: true,
                          };
                          setBlocosDireita(copia);
                        }}
                        style={{
                          width: '100%',
                          fontSize: '12px',
                          lineHeight: 1.45,
                          padding: '6px 8px',
                          border: '1px solid #cbd5e1',
                          borderRadius: '4px',
                          fontWeight: bDir.negrito ? 700 : 400,
                        }}
                      />
                    ) : (
                      <div
                        onClick={() => setModoEdicaoLivre(true)}
                        title="Clique para editar ou selecionar texto"
                        style={{
                          fontSize: '12px',
                          lineHeight: 1.5,
                          color: '#0f172a',
                          fontWeight: bDir.negrito ? 700 : 400,
                          whiteSpace: 'pre-wrap',
                          cursor: 'text',
                        }}
                      >
                        {diff ? (
                          diff.tokensDireita.map((tk, idxTk) => {
                            if (tk.tipo === 'adicionado') {
                              return (
                                <span
                                  key={idxTk}
                                  style={{
                                    background: '#bbf7d0',
                                    color: '#14532d',
                                    fontWeight: 700,
                                    padding: '0 2px',
                                    borderRadius: '2px',
                                  }}
                                >
                                  {tk.texto}
                                </span>
                              );
                            }
                            return <span key={idxTk}>{tk.texto}</span>;
                          })
                        ) : (
                          <span
                            style={
                              par.status === 'NOVO_NO_BANCO'
                                ? { background: '#dcfce7', color: '#14532d', fontWeight: 600 }
                                : undefined
                            }
                          >
                            {bDir.texto}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ================================================================= */}
        {/* RODAPÉ COM SALVAMENTO DIRETO NO SISTEMA E DOWNLOAD .DOCX          */}
        {/* ================================================================= */}
        <div
          style={{
            padding: '12px 20px',
            background: '#f8fafc',
            borderTop: '1px solid #cbd5e1',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '10px',
          }}
        >
          <span style={{ fontSize: '11.5px', color: '#475569' }}>
            💡 Você pode aplicar mudanças com 1 clique ou clicar sobre qualquer texto para editar manualmente os dois documentos.
          </span>

          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={onFechar}
              style={{
                width: 'auto',
                padding: '8px 16px',
                fontSize: '12px',
                background: '#ffffff',
                color: '#475569',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                fontWeight: 700,
              }}
            >
              Cancelar
            </button>

            <button
              type="button"
              onClick={baixarMoldeMescladoDocx}
              style={{
                width: 'auto',
                padding: '8px 16px',
                fontSize: '12px',
                background: '#eff6ff',
                color: '#1d4ed8',
                border: '1px solid #bfdbfe',
                borderRadius: '6px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              📥 Baixar Novo Molde (.DOCX)
            </button>

            <button
              type="button"
              onClick={salvarMoldeMescladoNoSistema}
              style={{
                width: 'auto',
                padding: '8px 20px',
                fontSize: '12.5px',
                background: '#15803d',
                color: '#ffffff',
                border: 'none',
                borderRadius: '6px',
                fontWeight: 800,
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(21,128,61,0.35)',
              }}
            >
              💾 Salvar e Atualizar Modelo Oficial no Sistema
            </button>
          </div>
        </div>
      </div>

      {/* SUB-MODAL PARA COLAR TEXTO DE UM PDF DO BANCO */}
      {modalColarTextoPdfAberto && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.6)',
            zIndex: 20000060,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              background: '#ffffff',
              padding: '20px',
              borderRadius: '10px',
              width: '650px',
              maxWidth: '94%',
              boxShadow: '0 15px 40px rgba(0,0,0,0.4)',
            }}
          >
            <h4 style={{ margin: '0 0 6px 0', color: '#8B1530' }}>
              📋 Colar Texto do Novo Modelo (PDF ou Word do Banco)
            </h4>
            <p style={{ fontSize: '11.5px', color: '#64748b', margin: '0 0 10px 0' }}>
              Se o Banco disponibilizou o novo modelo em PDF, basta selecionar todo o texto do PDF (<code>Ctrl+A</code> e <code>Ctrl+C</code>) e colar abaixo para o sistema comparar parágrafo por parágrafo com o modelo antigo:
            </p>
            <textarea
              rows={11}
              value={textoColadoPdf}
              onChange={(e) => setTextoColadoPdf(e.target.value)}
              placeholder="Cole aqui o texto integral do novo documento..."
              style={{ width: '100%', fontSize: '12px', lineHeight: 1.45 }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}>
              <button
                type="button"
                onClick={() => setModalColarTextoPdfAberto(false)}
                style={{ width: 'auto', padding: '7px 14px', background: '#e2e8f0', color: '#334155', fontSize: '12px' }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!textoColadoPdf.trim()) return;
                  converterTextoBrutoParaBlocosDireita(
                    textoColadoPdf,
                    'Texto Colado do Novo Modelo'
                  );
                  setModalColarTextoPdfAberto(false);
                }}
                style={{ width: 'auto', padding: '7px 18px', background: '#2563eb', color: '#fff', fontSize: '12px', fontWeight: 700 }}
              >
                🔍 Varrer e Comparar Diferenças Agora
              </button>
            </div>
          </div>
        </div>
      )}
    </div>,
    document.body
  );
}