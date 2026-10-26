'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { RegistroContratacao } from '@/types/painel';
import {
  aplicarMascaraCPF,
  obterListaProjetistas,
  ProjetistaConfig,
} from '@/lib/utils';
import {
  gerarDocumentoWordPeloMolde,
  gerarDocumentoPdfPeloMolde,
  baixarMoldeOriginalParaEdicao,
  salvarMoldeCustomizadoNoSistema,
  removerMoldeCustomizadoDoSistema,
  possuiMoldeCustomizadoSalvo,
} from '@/lib/motorWordDocx';
import {
  MOLDE_REGULARIDADE_AMBIENTAL_BASE64,
  MOLDE_REG_AMB_GARANTIDOR_BASE64,
  MOLDE_NAO_DESMATAMENTO_BASE64,
  MOLDE_RECOMPOSICAO_BASE64,
  MOLDE_BIOMA_AMAZONIA_BASE64,
  MOLDE_NAO_DESMAT_DESMEMBRAMENTO_BASE64,
  MOLDE_RESERVA_AMB_ACIMA4_BASE64,
  MOLDE_RETIFICACAO_CAR_BASE64,
  MOLDE_SOBREPOSICAO_CAR_BASE64,
  MOLDE_SOBREPOSICAO_CAR_DIF_BASE64,
  MOLDE_SOBREPOSICAO_CAR_POSSEIRO_BASE64,
  MOLDE_NAO_EXPLORACAO_BASE64,
  MOLDE_PROD_AUTOMATICOS_BASE64,
  MOLDE_ALTERACAO_PROPOSTA_BASE64,
} from '@/components/documentos/moldesBase64Originais';
import LabelComInfo from '@/components/documentos/LabelComInfo';

export type TipoDeclaracaoGeral =
  | 'REGULARIDADE_AMBIENTAL'
  | 'REG_AMB_GARANTIDOR'
  | 'NAO_DESMATAMENTO_2008'
  | 'RECOMPOSICAO'
  | 'BIOMA_AMAZONIA'
  | 'NAO_DESMAT_DESMEMBRAMENTO'
  | 'RESERVA_AMB_ACIMA_4'
  | 'RETIFICACAO_CAR'
  | 'SOBREPOSICAO_CAR'
  | 'SOBREPOSICAO_CAR_DIF'
  | 'SOBREPOSICAO_CAR_POSSEIRO'
  | 'NAO_EXPLORACAO'
  | 'PROD_AUTOMATICOS'
  | 'ALTERACAO_PROPOSTA';

interface ModalDeclaracoesAmbientaisProps {
  aberto: boolean;
  tipo: TipoDeclaracaoGeral | null;
  onFechar: () => void;
  contratacoes?: RegistroContratacao[];
}

interface ImovelMultiploItem {
  id: string;
  nome_imovel: string;
  matricula: string;
  cidade: string;
  estado: string;
}

interface VariavelExtraItem {
  id: string;
  chave: string;
  valor: string;
}

const DICIONARIO_UF_EXTENSO: Record<string, string> = {
  AC: 'acre',
  AL: 'alagoas',
  AP: 'amapá',
  AM: 'amazonas',
  BA: 'bahia',
  CE: 'ceará',
  DF: 'distrito federal',
  ES: 'espírito santo',
  GO: 'goiás',
  MA: 'maranhão',
  MT: 'mato grosso',
  MS: 'mato grosso do sul',
  MG: 'minas gerais',
  PA: 'pará',
  PB: 'paraíba',
  PR: 'paraná',
  PE: 'pernambuco',
  PI: 'piauí',
  RJ: 'rio de janeiro',
  RN: 'rio grande do norte',
  RS: 'rio grande do sul',
  RO: 'rondônia',
  RR: 'roraima',
  SC: 'santa catarina',
  SP: 'são paulo',
  SE: 'sergipe',
  TO: 'tocantins',
};

function obterDataExtensoHoje(): string {
  const meses = [
    'janeiro',
    'fevereiro',
    'março',
    'abril',
    'maio',
    'junho',
    'julho',
    'agosto',
    'setembro',
    'outubro',
    'novembro',
    'dezembro',
  ];
  const d = new Date();
  return `${d.getDate()} de ${meses[d.getMonth()]} de ${d.getFullYear()}`;
}

function obterDataAbreviadaHoje(): string {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(
    2,
    '0'
  )}/${d.getFullYear()}`;
}

export default function ModalDeclaracoesAmbientais({
  aberto,
  tipo,
  onFechar,
  contratacoes = [],
}: ModalDeclaracoesAmbientaisProps) {
  const meta = useMemo(() => {
    switch (tipo) {
      case 'REG_AMB_GARANTIDOR':
        return {
          chave: 'DECL_REG_AMB_GARANTIDOR',
          titulo: 'DECL. DE REGULARIDADE AMBIENTAL — IMÓVEL GARANTIDOR',
          caminhoPublic: '/moldes-word/decl-reg-amb-garantidor.docx',
          base64: MOLDE_REG_AMB_GARANTIDOR_BASE64,
          prefixoArq: 'DECL. REG. AMB. IMOVEL GARANTIDOR',
          corTopo: '#15803d',
        };
      case 'NAO_DESMATAMENTO_2008':
        return {
          chave: 'DECL_NAO_DESMATAMENTO_2008',
          titulo: 'DECLARAÇÃO DE NÃO DESMATAMENTO APÓS 2008',
          caminhoPublic: '/moldes-word/decl-nao-desmatamento-2008.docx',
          base64: MOLDE_NAO_DESMATAMENTO_BASE64,
          prefixoArq: 'DECL. NAO DESMATAMENTO',
          corTopo: '#15803d',
        };
      case 'RECOMPOSICAO':
        return {
          chave: 'DECL_RECOMPOSICAO',
          titulo: 'DECLARAÇÃO DE RECOMPOSIÇÃO AMBIENTAL',
          caminhoPublic: '/moldes-word/decl-recomposicao.docx',
          base64: MOLDE_RECOMPOSICAO_BASE64,
          prefixoArq: 'DECL. RECOMPOSICAO',
          corTopo: '#15803d',
        };
      case 'BIOMA_AMAZONIA':
        return {
          chave: 'DECL_BIOMA_AMAZONIA',
          titulo: 'DECLARAÇÃO DE BIOMA AMAZÔNIA',
          caminhoPublic: '/moldes-word/decl-bioma-amazonia.docx',
          base64: MOLDE_BIOMA_AMAZONIA_BASE64,
          prefixoArq: 'DECL. BIOMA AMAZONIA',
          corTopo: '#15803d',
        };
      case 'NAO_DESMAT_DESMEMBRAMENTO':
        return {
          chave: 'DECL_NAO_DESMAT_DESMEMBRAMENTO',
          titulo: 'DECLARAÇÃO DE NÃO DESMATAMENTO E DESMEMBRAMENTO',
          caminhoPublic: '/moldes-word/decl-desmembramento.docx',
          base64: MOLDE_NAO_DESMAT_DESMEMBRAMENTO_BASE64,
          prefixoArq: 'DECL. DESMEMBRAMENTO',
          corTopo: '#15803d',
        };
      case 'RESERVA_AMB_ACIMA_4':
        return {
          chave: 'DECL_RESERVA_AMB_ACIMA_4',
          titulo: 'DECLARAÇÃO DE RESERVA AMBIENTAL (ACIMA DE 4 MÓDULOS)',
          caminhoPublic: '/moldes-word/decl-reserva-acima-4m.docx',
          base64: MOLDE_RESERVA_AMB_ACIMA4_BASE64,
          prefixoArq: 'DECL. RESERVA AMB MAIOR 4',
          corTopo: '#15803d',
        };
      case 'RETIFICACAO_CAR':
        return {
          chave: 'DECL_RETIFICACAO_CAR',
          titulo: 'DECLARAÇÃO DE RETIFICAÇÃO DO CAR',
          caminhoPublic: '/moldes-word/decl-retificacao-car.docx',
          base64: MOLDE_RETIFICACAO_CAR_BASE64,
          prefixoArq: 'DECL. RETIFICACAO DO CAR',
          corTopo: '#0369a1',
        };
      case 'SOBREPOSICAO_CAR':
        return {
          chave: 'DECL_SOBREPOSICAO_CAR',
          titulo: 'DECLARAÇÃO DE SOBREPOSIÇÃO DO CAR',
          caminhoPublic: '/moldes-word/decl-sobreposicao-car.docx',
          base64: MOLDE_SOBREPOSICAO_CAR_BASE64,
          prefixoArq: 'DECL. SOBREPOSICAO CAR',
          corTopo: '#0369a1',
        };
      case 'SOBREPOSICAO_CAR_DIF':
        return {
          chave: 'DECL_SOBREPOSICAO_CAR_DIF',
          titulo: 'DECLARAÇÃO DE SOBREPOSIÇÃO DE CAR DIFERENTE',
          caminhoPublic: '/moldes-word/decl-sobreposicao-car-dif.docx',
          base64: MOLDE_SOBREPOSICAO_CAR_DIF_BASE64,
          prefixoArq: 'DECL. SOBREPOSICAO CAR DIFERENTE',
          corTopo: '#0369a1',
        };
      case 'SOBREPOSICAO_CAR_POSSEIRO':
        return {
          chave: 'DECL_SOBREPOSICAO_CAR_POSSEIRO',
          titulo: 'DECLARAÇÃO DE SOBREPOSIÇÃO DO CAR (POSSEIRO)',
          caminhoPublic: '/moldes-word/decl-sobreposicao-car-posseiro.docx',
          base64: MOLDE_SOBREPOSICAO_CAR_POSSEIRO_BASE64,
          prefixoArq: 'DECL. SOBREPOSICAO CAR POSSEIRO',
          corTopo: '#0369a1',
        };
      case 'NAO_EXPLORACAO':
        return {
          chave: 'DECL_NAO_EXPLORACAO',
          titulo: 'DECLARAÇÃO DE NÃO EXPLORAÇÃO',
          caminhoPublic: '/moldes-word/decl-nao-exploracao.docx',
          base64: MOLDE_NAO_EXPLORACAO_BASE64,
          prefixoArq: 'DECL. NAO EXPLORACAO',
          corTopo: '#b45309',
        };
      case 'PROD_AUTOMATICOS':
        return {
          chave: 'DECL_PROD_AUTOMATICOS',
          titulo: 'DECLARAÇÃO PARA CONTRATAÇÃO DE PRODUTOS AUTOMÁTICOS',
          caminhoPublic: '/moldes-word/decl-produtos-automaticos.docx',
          base64: MOLDE_PROD_AUTOMATICOS_BASE64,
          prefixoArq: 'DECL. PRODUTOS AUTOMATICOS',
          corTopo: '#b45309',
        };
      case 'ALTERACAO_PROPOSTA':
        return {
          chave: 'DECL_ALTERACAO_PROPOSTA',
          titulo: 'DECLARAÇÃO DE ALTERAÇÃO / MODIFICAÇÃO DA PROPOSTA',
          caminhoPublic: '/moldes-word/decl-alteracao-proposta.docx',
          base64: MOLDE_ALTERACAO_PROPOSTA_BASE64,
          prefixoArq: 'DEC. ALTERACAO PROPOSTA',
          corTopo: '#b45309',
        };
      default:
        return {
          chave: 'DECL_REGULARIDADE_AMBIENTAL',
          titulo: 'DECLARAÇÃO DE REGULARIDADE AMBIENTAL (PROPONENTE + PROJETISTA)',
          caminhoPublic: '/moldes-word/decl-regularidade-ambiental.docx',
          base64: MOLDE_REGULARIDADE_AMBIENTAL_BASE64,
          prefixoArq: 'DECLARACAO REG. AMBIENTAL',
          corTopo: '#15803d',
        };
    }
  }, [tipo]);

  const [temMoldeCustom, setTemMoldeCustom] = useState(false);
  const inputUploadMoldeRef = useRef<HTMLInputElement>(null);

  const [clienteBusca, setClienteBusca] = useState('');
  const [nome, setNome] = useState('');
  const [cpf, setCpf] = useState('');
  const [dataExtenso, setDataExtenso] = useState(() => obterDataExtensoHoje());
  const [dataAbreviada, setDataAbreviada] = useState(() => obterDataAbreviadaHoje());

  const [tipoDoc, setTipoDoc] = useState('RG');
  const [numDoc, setNumDoc] = useState('');
  const [orgaoDoc, setOrgaoDoc] = useState('SSP');
  const [ufDoc, setUfDoc] = useState('MA');

  const [endereco, setEndereco] = useState('');
  const [cidadeEnd, setCidadeEnd] = useState('SANTA INÊS');
  const [ufEnd, setUfEnd] = useState('MA');

  const [nomeImovelUnico, setNomeImovelUnico] = useState('');
  const [cidadeImovelUnico, setCidadeImovelUnico] = useState('SANTA INÊS');
  const [ufImovelUnico, setUfImovelUnico] = useState('MA');
  const [numCar, setNumCar] = useState('');
  const [areaTotalImovel, setAreaTotalImovel] = useState('');
  const [qtddAnosPosse, setQtddAnosPosse] = useState('10');

  const [listaProjetistas, setListaProjetistas] = useState<ProjetistaConfig[]>([]);
  const [projNome, setProjNome] = useState('');
  const [projRegistro, setProjRegistro] = useState('');
  const [projCpf, setProjCpf] = useState('');

  const [imoveisMultiplos, setImoveisMultiplos] = useState<ImovelMultiploItem[]>([
    { id: 'imo_1', nome_imovel: '', matricula: '', cidade: 'SANTA INÊS', estado: 'MA' },
  ]);

  const [variaveisExtras, setVariaveisExtras] = useState<VariavelExtraItem[]>([]);

  useEffect(() => {
    if (aberto && tipo) {
      setTemMoldeCustom(possuiMoldeCustomizadoSalvo(meta.chave));
      setDataExtenso(obterDataExtensoHoje());
      setDataAbreviada(obterDataAbreviadaHoje());
      setListaProjetistas(obterListaProjetistas());
    }
  }, [aberto, tipo, meta.chave]);

  const clientesUnicosCarteira = useMemo(() => {
    const mapa = new Map<string, RegistroContratacao>();
    contratacoes.forEach((r) => {
      const ch = (r.cpf || r.cliente || '').trim();
      if (ch && !mapa.has(ch)) mapa.set(ch, r);
    });
    return Array.from(mapa.values());
  }, [contratacoes]);

  const autocompletarDadosProjetista = (valorDigitado: string) => {
    setProjNome(valorDigitado);
    const limpo = valorDigitado.toUpperCase().trim();
    const encontrado = listaProjetistas.find(
      (p) =>
        p.nomeCurto.toUpperCase() === limpo ||
        (p.nomeCompleto && p.nomeCompleto.toUpperCase() === limpo)
    );
    if (encontrado) {
      if (encontrado.nomeCompleto) setProjNome(encontrado.nomeCompleto);
      if (encontrado.registro) setProjRegistro(encontrado.registro);
      if (encontrado.cpf) setProjCpf(encontrado.cpf);
    }
  };

  const selecionarClienteDaCarteira = (termo: string) => {
    setClienteBusca(termo);
    const achado = contratacoes.find(
      (r) =>
        `${r.cliente} (${r.cpf || 'S/ CPF'})` === termo ||
        r.cliente.toUpperCase() === termo.toUpperCase().trim()
    );
    if (achado) {
      setNome(achado.cliente);
      setCpf(achado.cpf || '');
      if (achado.projetista) {
        autocompletarDadosProjetista(achado.projetista);
      }
    }
  };

  if (!aberto || !tipo) return null;

  const precisaRgTitular = tipo === 'REG_AMB_GARANTIDOR';
  const precisaEnderecoTitular = [
    'NAO_DESMATAMENTO_2008',
    'BIOMA_AMAZONIA',
    'SOBREPOSICAO_CAR_DIF',
    'NAO_EXPLORACAO',
    'PROD_AUTOMATICOS',
  ].includes(tipo);

  const precisaCidadeUfTitular = [
    'NAO_DESMATAMENTO_2008',
    'SOBREPOSICAO_CAR_DIF',
    'NAO_EXPLORACAO',
  ].includes(tipo);

  const precisaProjetista = tipo === 'REGULARIDADE_AMBIENTAL';
  const precisaImoveisMultiplos =
    tipo === 'REG_AMB_GARANTIDOR' || tipo === 'BIOMA_AMAZONIA';

  const precisaImovelUnico = [
    'RECOMPOSICAO',
    'NAO_DESMAT_DESMEMBRAMENTO',
    'RESERVA_AMB_ACIMA_4',
    'SOBREPOSICAO_CAR_DIF',
  ].includes(tipo);

  const precisaNumCar = [
    'RECOMPOSICAO',
    'RESERVA_AMB_ACIMA_4',
    'RETIFICACAO_CAR',
    'SOBREPOSICAO_CAR',
    'SOBREPOSICAO_CAR_DIF',
  ].includes(tipo);

  const handleUploadNovoMolde = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await salvarMoldeCustomizadoNoSistema(meta.chave, file);
      setTemMoldeCustom(true);
      alert(`✅ Novo molde Word (${file.name}) salvo com sucesso!`);
    } catch {
      alert('❌ Erro ao ler o arquivo .docx.');
    }
    e.target.value = '';
  };

  const montarPacoteDados = () => {
    const ufEndUpper = ufEnd.toUpperCase().trim() || 'MA';
    const ufEndExtenso =
      DICIONARIO_UF_EXTENSO[ufEndUpper] || ufEndUpper.toLowerCase();

    const ufImoUpper = ufImovelUnico.toUpperCase().trim() || 'MA';
    const ufImoExtenso =
      DICIONARIO_UF_EXTENSO[ufImoUpper] || ufImoUpper.toLowerCase();

    const listaImsFormatada = imoveisMultiplos
      .filter((im) => im.nome_imovel.trim() !== '')
      .map((im) => {
        const sig = im.estado.toUpperCase().trim() || 'MA';
        return {
          nome_imóvel: im.nome_imovel.trim(),
          nome_imovel: im.nome_imovel.trim(),
          nomeimovel: im.nome_imovel.trim(),
          matricula: im.matricula.trim(),
          cidade: im.cidade.trim(),
          municipio_imovel: im.cidade.trim(),
          estado: sig,
          estadoporextenso: DICIONARIO_UF_EXTENSO[sig] || sig.toLowerCase(),
        };
      });

    const mapaExtras: Record<string, string> = {};
    variaveisExtras.forEach((v) => {
      const ch = v.chave.replace(/[{}]/g, '').trim();
      if (ch) mapaExtras[ch] = v.valor;
    });

    const dadosWord: Record<string, unknown> = {
      nome: nome || '[NOME]',
      cpf: cpf || '[CPF]',
      data_extenso: dataExtenso || obterDataExtensoHoje(),
      data_abreviada: dataAbreviada || obterDataAbreviadaHoje(),

      tipo_doc: tipoDoc || 'RG',
      num_doc: numDoc || '[NÚMERO]',
      orgao_doc: orgaoDoc || 'SSP',
      uf_doc: ufDoc || 'MA',

      endereco: endereco || '[ENDEREÇO]',
      cidade: cidadeEnd || '[CIDADE]',
      cidade_estado: `${cidadeEnd || '[CIDADE]'} - ${ufEndUpper}`,
      estadoporextenso:
        tipo === 'NAO_DESMAT_DESMEMBRAMENTO' ? ufImoExtenso : ufEndExtenso,

      nomeprojetista: projNome || '[NOME DO PROJETISTA]',
      registroprojetista: projRegistro || '[CREA/CFTA]',
      cpfprojetista: projCpf || '[CPF DO PROJETISTA]',

      nomedoimóvel: nomeImovelUnico || '[NOME DO IMÓVEL]',
      nomedoimovel: nomeImovelUnico || '[NOME DO IMÓVEL]',
      nome_imovel: nomeImovelUnico || '[NOME DO IMÓVEL]',
      cidadedoimóvel: cidadeImovelUnico || '[CIDADE DO IMÓVEL]',
      cidadedoimovel: cidadeImovelUnico || '[CIDADE DO IMÓVEL]',
      cidadeimovel: cidadeImovelUnico || '[CIDADE DO IMÓVEL]',
      cidade_imovel: cidadeImovelUnico || '[CIDADE DO IMÓVEL]',
      cide_imovel: cidadeImovelUnico || '[CIDADE DO IMÓVEL]',
      endereco_imovel: cidadeImovelUnico || '[ENDEREÇO/CIDADE DO IMÓVEL]',
      estadoimovel: ufImoExtenso,
      numCAR: numCar || '[NÚMERO DO CAR]',
      areatotal: areaTotalImovel || '[ÁREA]',
      qtddanos: qtddAnosPosse || '[ANOS]',

      imoveis: listaImsFormatada,
      ...mapaExtras,
    };

    const partesNome = (nome || 'CLIENTE').trim().toUpperCase().split(/\s+/);
    const doisPrimeiros = partesNome.slice(0, 2).join(' ');
    const nomeArq = `${meta.prefixoArq} - ${doisPrimeiros}.docx`;

    return { dadosWord, nomeArq };
  };

  const handleGerarDocumento = async (formato: 'DOCX' | 'PDF') => {
    const { dadosWord, nomeArq } = montarPacoteDados();
    try {
      if (formato === 'PDF') {
        await gerarDocumentoPdfPeloMolde({
          chaveMolde: meta.chave,
          caminhoPublicDocx: meta.caminhoPublic,
          base64Fallback: meta.base64,
          dados: dadosWord,
          nomeArquivoSaida: nomeArq,
        });
      } else {
        await gerarDocumentoWordPeloMolde({
          chaveMolde: meta.chave,
          caminhoPublicDocx: meta.caminhoPublic,
          base64Fallback: meta.base64,
          dados: dadosWord,
          nomeArquivoSaida: nomeArq,
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro desconhecido';
      alert('⚠️ Atenção:\n\n' + msg);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 23, 42, 0.65)',
        zIndex: 999999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backdropFilter: 'blur(3px)',
      }}
    >
      <div
        style={{
          background: '#ffffff',
          width: '94%',
          maxWidth: '840px',
          maxHeight: '92vh',
          borderRadius: '12px',
          boxShadow: '0 20px 45px rgba(0,0,0,0.35)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          borderTop: `5px solid ${meta.corTopo}`,
        }}
      >
        {/* CABEÇALHO */}
        <div
          style={{
            padding: '14px 20px',
            background: '#f8fafc',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '10px',
          }}
        >
          <div>
            <h3 style={{ margin: 0, fontSize: '14.5px', color: meta.corTopo, fontWeight: 800 }}>
              📄 {meta.titulo}
            </h3>
            <span style={{ fontSize: '11px', color: '#64748b' }}>
              {temMoldeCustom
                ? '🟢 Usando Molde .DOCX atualizado por você'
                : '⚪ Usando Molde .DOCX padrão do sistema'}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <input
              ref={inputUploadMoldeRef}
              type="file"
              accept=".docx"
              style={{ display: 'none' }}
              onChange={handleUploadNovoMolde}
            />
            <button
              type="button"
              onClick={() =>
                baixarMoldeOriginalParaEdicao({
                  chaveMolde: meta.chave,
                  caminhoPublicDocx: meta.caminhoPublic,
                  base64Fallback: meta.base64,
                  nomeArquivoDownload: `MOLDE_${meta.chave}.docx`,
                }).catch((e) => alert(e.message))
              }
              style={{
                width: 'auto',
                padding: '6px 10px',
                fontSize: '11px',
                fontWeight: 700,
                background: '#ffffff',
                color: '#334155',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                cursor: 'pointer',
              }}
            >
              📥 Baixar Molde .DOCX
            </button>

            <button
              type="button"
              onClick={() => inputUploadMoldeRef.current?.click()}
              style={{
                width: 'auto',
                padding: '6px 10px',
                fontSize: '11px',
                fontWeight: 700,
                background: '#eff6ff',
                color: '#1d4ed8',
                border: '1px solid #bfdbfe',
                borderRadius: '6px',
                cursor: 'pointer',
              }}
            >
              📤 Atualizar Molde .DOCX
            </button>

            {temMoldeCustom && (
              <button
                type="button"
                onClick={() => {
                  removerMoldeCustomizadoDoSistema(meta.chave);
                  setTemMoldeCustom(false);
                }}
                style={{
                  width: 'auto',
                  padding: '6px 8px',
                  fontSize: '10.5px',
                  background: '#fee2e2',
                  color: '#b91c1c',
                  border: '1px solid #fecaca',
                  borderRadius: '6px',
                }}
              >
                ↺ Resetar
              </button>
            )}

            <button
              type="button"
              onClick={onFechar}
              style={{
                width: 'auto',
                background: 'none',
                border: 'none',
                fontSize: '22px',
                color: '#64748b',
                cursor: 'pointer',
              }}
            >
              &times;
            </button>
          </div>
        </div>

        {/* CORPO */}
        <div
          style={{
            padding: '20px',
            overflowY: 'auto',
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
          }}
        >
          {clientesUnicosCarteira.length > 0 && (
            <div
              style={{
                background: '#f0fdf4',
                border: '1px solid #bbf7d0',
                borderRadius: '8px',
                padding: '10px 14px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
              }}
            >
              <strong style={{ fontSize: '12px', color: '#15803d' }}>
                ⚡ Puxar Cliente da Carteira:
              </strong>
              <input
                type="search"
                list="dl_clientes_decl_geral"
                value={clienteBusca}
                onChange={(e) => selecionarClienteDaCarteira(e.target.value)}
                placeholder="Selecione o cliente para preencher Nome, CPF e Projetista..."
                style={{ flex: 1, height: '32px', fontSize: '12px' }}
              />
              <datalist id="dl_clientes_decl_geral">
                {clientesUnicosCarteira.map((c) => (
                  <option key={c.id} value={`${c.cliente} (${c.cpf || 'S/ CPF'})`} />
                ))}
              </datalist>
            </div>
          )}

          {/* 1. DADOS DO PROPONENTE */}
          <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '14px' }}>
            <strong style={{ fontSize: '12px', color: '#8B1530', display: 'block', marginBottom: '10px' }}>
              1. IDENTIFICAÇÃO DO PROPONENTE / TITULAR
            </strong>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1.2fr', gap: '10px' }}>
              <div>
                <LabelComInfo texto="Nome Completo" tagWord="{nome}" />
                <input type="text" value={nome} onChange={(e) => setNome(e.target.value)} />
              </div>
              <div>
                <LabelComInfo texto="CPF" tagWord="{cpf}" />
                <input
                  type="text"
                  value={cpf}
                  onChange={(e) => setCpf(aplicarMascaraCPF(e.target.value))}
                  maxLength={14}
                />
              </div>
              {tipo === 'ALTERACAO_PROPOSTA' ? (
                <div>
                  <LabelComInfo texto="Data Abreviada" tagWord="{data_abreviada}" />
                  <input
                    type="text"
                    value={dataAbreviada}
                    onChange={(e) => setDataAbreviada(e.target.value)}
                  />
                </div>
              ) : (
                <div>
                  <LabelComInfo texto="Data por Extenso" tagWord="{data_extenso}" />
                  <input
                    type="text"
                    value={dataExtenso}
                    onChange={(e) => setDataExtenso(e.target.value)}
                  />
                </div>
              )}
            </div>

            {precisaRgTitular && (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '0.8fr 1.2fr 1fr 0.7fr',
                  gap: '10px',
                  marginTop: '10px',
                }}
              >
                <div>
                  <LabelComInfo texto="Tipo Doc" tagWord="{tipo_doc}" />
                  <select value={tipoDoc} onChange={(e) => setTipoDoc(e.target.value)}>
                    <option value="RG">RG</option>
                    <option value="CNH">CNH</option>
                  </select>
                </div>
                <div>
                  <LabelComInfo texto="Nº Documento" tagWord="{num_doc}" />
                  <input type="text" value={numDoc} onChange={(e) => setNumDoc(e.target.value)} />
                </div>
                <div>
                  <LabelComInfo texto="Órgão Emissor" tagWord="{orgao_doc}" />
                  <input
                    type="text"
                    value={orgaoDoc}
                    onChange={(e) => setOrgaoDoc(e.target.value)}
                  />
                </div>
                <div>
                  <LabelComInfo texto="UF" tagWord="{uf_doc}" />
                  <input type="text" value={ufDoc} onChange={(e) => setUfDoc(e.target.value)} />
                </div>
              </div>
            )}

            {precisaEnderecoTitular && (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: precisaCidadeUfTitular ? '2fr 1.2fr 0.6fr' : '1fr',
                  gap: '10px',
                  marginTop: '10px',
                }}
              >
                <div>
                  <LabelComInfo texto="Endereço Completo" tagWord="{endereco}" />
                  <input
                    type="text"
                    value={endereco}
                    onChange={(e) => setEndereco(e.target.value)}
                    placeholder="Rua / Povoado / Assentamento..."
                  />
                </div>
                {precisaCidadeUfTitular && (
                  <>
                    <div>
                      <LabelComInfo texto="Cidade" tagWord="{cidade}" />
                      <input
                        type="text"
                        value={cidadeEnd}
                        onChange={(e) => setCidadeEnd(e.target.value)}
                      />
                    </div>
                    <div>
                      <LabelComInfo texto="UF" tagWord="{estadoporextenso}" />
                      <input
                        type="text"
                        value={ufEnd}
                        onChange={(e) => setUfEnd(e.target.value.toUpperCase())}
                        maxLength={2}
                      />
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* 2. DADOS DO IMÓVEL ÚNICO E/OU CAR */}
          {(precisaImovelUnico || precisaNumCar) && (
            <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '14px' }}>
              <strong style={{ fontSize: '12px', color: '#0369a1', display: 'block', marginBottom: '10px' }}>
                📍 2. DADOS DO IMÓVEL RURAL E REGISTRO NO CAR
              </strong>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
                  gap: '10px',
                }}
              >
                {precisaImovelUnico && (
                  <>
                    <div>
                      <LabelComInfo texto="Nome do Imóvel / Fazenda" tagWord="{nome_imovel} / {nomedoimóvel}" />
                      <input
                        type="text"
                        value={nomeImovelUnico}
                        onChange={(e) => setNomeImovelUnico(e.target.value)}
                        placeholder="Ex: FAZENDA SÃO JOSÉ"
                      />
                    </div>
                    <div>
                      <LabelComInfo texto="Município / Localização" tagWord="{cidade_imovel} / {cidadedoimóvel}" />
                      <input
                        type="text"
                        value={cidadeImovelUnico}
                        onChange={(e) => setCidadeImovelUnico(e.target.value)}
                        placeholder="Ex: SANTA INÊS"
                      />
                    </div>
                    <div>
                      <LabelComInfo texto="UF do Imóvel" tagWord="{estadoimovel}" />
                      <input
                        type="text"
                        value={ufImovelUnico}
                        onChange={(e) => setUfImovelUnico(e.target.value.toUpperCase())}
                        maxLength={2}
                      />
                    </div>
                  </>
                )}

                {precisaNumCar && (
                  <div>
                    <LabelComInfo texto="Número do CAR" tagWord="{numCAR}" corTexto="#0369a1" />
                    <input
                      type="text"
                      value={numCar}
                      onChange={(e) => setNumCar(e.target.value)}
                      placeholder="MA-2109908-..."
                    />
                  </div>
                )}

                {tipo === 'SOBREPOSICAO_CAR_DIF' && (
                  <>
                    <div>
                      <LabelComInfo texto="Área Total (ha)" tagWord="{areatotal}" />
                      <input
                        type="text"
                        value={areaTotalImovel}
                        onChange={(e) => setAreaTotalImovel(e.target.value)}
                        placeholder="Ex: 50,00"
                      />
                    </div>
                    <div>
                      <LabelComInfo texto="Tempo de Posse (Anos)" tagWord="{qtddanos}" />
                      <input
                        type="text"
                        value={qtddAnosPosse}
                        onChange={(e) => setQtddAnosPosse(e.target.value)}
                        placeholder="Ex: 10"
                      />
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* 3. DADOS DO PROJETISTA */}
          {precisaProjetista && (
            <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '14px' }}>
              <strong style={{ fontSize: '12px', color: '#15803d', display: 'block', marginBottom: '10px' }}>
                👨‍💼 2. DADOS DO PROJETISTA / RESPONSÁVEL TÉCNICO
              </strong>
              <datalist id="dl_projetistas_modal_amb">
                {listaProjetistas.map((p, i) => (
                  <option key={p.nomeCurto + i} value={p.nomeCompleto || p.nomeCurto}>
                    {p.nomeCurto} — {p.registro || 'S/ Reg'}
                  </option>
                ))}
              </datalist>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '10px' }}>
                <div>
                  <LabelComInfo texto="Nome Completo do Projetista" tagWord="{nomeprojetista}" />
                  <input
                    type="search"
                    list="dl_projetistas_modal_amb"
                    value={projNome}
                    onChange={(e) => autocompletarDadosProjetista(e.target.value)}
                    placeholder="Selecione ou digite..."
                  />
                </div>
                <div>
                  <LabelComInfo texto="Nº Registro CREA/CFTA" tagWord="{registroprojetista}" />
                  <input
                    type="text"
                    value={projRegistro}
                    onChange={(e) => setProjRegistro(e.target.value)}
                  />
                </div>
                <div>
                  <LabelComInfo texto="CPF do Projetista" tagWord="{cpfprojetista}" />
                  <input
                    type="text"
                    value={projCpf}
                    onChange={(e) => setProjCpf(aplicarMascaraCPF(e.target.value))}
                    maxLength={14}
                  />
                </div>
              </div>
            </div>
          )}

          {/* 4. LISTA MÚLTIPLA DE IMÓVEIS */}
          {precisaImoveisMultiplos && (
            <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '14px' }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '10px',
                }}
              >
                <LabelComInfo
                  texto="📍 2. LISTA DE IMÓVEIS"
                  tagWord="{#imoveis} {nome_imóvel} {matricula} {cidade} {estado} {/imoveis}"
                  corTexto="#15803d"
                />
                <button
                  type="button"
                  onClick={() =>
                    setImoveisMultiplos([
                      ...imoveisMultiplos,
                      {
                        id: `imo_${Date.now()}`,
                        nome_imovel: '',
                        matricula: '',
                        cidade: 'SANTA INÊS',
                        estado: 'MA',
                      },
                    ])
                  }
                  style={{
                    width: 'auto',
                    padding: '4px 10px',
                    fontSize: '11px',
                    background: '#dcfce7',
                    color: '#15803d',
                    border: '1px solid #86efac',
                    borderRadius: '6px',
                    fontWeight: 700,
                  }}
                >
                  + Adicionar Imóvel
                </button>
              </div>

              {imoveisMultiplos.map((im, idx) => (
                <div
                  key={im.id}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '2fr 1fr 1.2fr 0.5fr auto',
                    gap: '8px',
                    marginBottom: '8px',
                    alignItems: 'center',
                  }}
                >
                  <input
                    type="text"
                    value={im.nome_imovel}
                    onChange={(e) => {
                      const n = [...imoveisMultiplos];
                      n[idx].nome_imovel = e.target.value;
                      setImoveisMultiplos(n);
                    }}
                    placeholder="Nome do Imóvel"
                  />
                  <input
                    type="text"
                    value={im.matricula}
                    onChange={(e) => {
                      const n = [...imoveisMultiplos];
                      n[idx].matricula = e.target.value;
                      setImoveisMultiplos(n);
                    }}
                    placeholder="Matrícula"
                  />
                  <input
                    type="text"
                    value={im.cidade}
                    onChange={(e) => {
                      const n = [...imoveisMultiplos];
                      n[idx].cidade = e.target.value;
                      setImoveisMultiplos(n);
                    }}
                    placeholder="Município"
                  />
                  <input
                    type="text"
                    value={im.estado}
                    onChange={(e) => {
                      const n = [...imoveisMultiplos];
                      n[idx].estado = e.target.value.toUpperCase();
                      setImoveisMultiplos(n);
                    }}
                    placeholder="UF"
                    maxLength={2}
                  />
                  {imoveisMultiplos.length > 1 && (
                    <button
                      type="button"
                      onClick={() =>
                        setImoveisMultiplos(imoveisMultiplos.filter((_, i) => i !== idx))
                      }
                      style={{
                        width: 'auto',
                        padding: '6px 10px',
                        background: '#fee2e2',
                        color: '#b91c1c',
                        border: 'none',
                        borderRadius: '4px',
                      }}
                    >
                      🗑️
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* 5. VARIÁVEIS EXTRAS */}
          <div
            style={{
              border: '1px dashed #cbd5e1',
              borderRadius: '8px',
              padding: '10px 14px',
              background: '#f8fafc',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <LabelComInfo
                texto="➕ Etiquetas Extras do Word (Opcional)"
                tagWord="{sua_nova_variavel}"
              />
              <button
                type="button"
                onClick={() =>
                  setVariaveisExtras([
                    ...variaveisExtras,
                    { id: `ext_${Date.now()}`, chave: '', valor: '' },
                  ])
                }
                style={{
                  width: 'auto',
                  padding: '3px 10px',
                  fontSize: '11px',
                  background: '#ffffff',
                  color: '#334155',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  fontWeight: 700,
                }}
              >
                + Nova Etiqueta
              </button>
            </div>
            {variaveisExtras.map((v, idx) => (
              <div
                key={v.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 2fr auto',
                  gap: '8px',
                  marginTop: '8px',
                }}
              >
                <input
                  type="text"
                  value={v.chave}
                  onChange={(e) => {
                    const n = [...variaveisExtras];
                    n[idx].chave = e.target.value;
                    setVariaveisExtras(n);
                  }}
                  placeholder="Etiqueta (Ex: numero_caf)"
                />
                <input
                  type="text"
                  value={v.valor}
                  onChange={(e) => {
                    const n = [...variaveisExtras];
                    n[idx].valor = e.target.value;
                    setVariaveisExtras(n);
                  }}
                  placeholder="Valor para preencher no Word"
                />
                <button
                  type="button"
                  onClick={() =>
                    setVariaveisExtras(variaveisExtras.filter((_, i) => i !== idx))
                  }
                  style={{
                    width: 'auto',
                    padding: '4px 8px',
                    background: '#fee2e2',
                    color: '#b91c1c',
                    border: 'none',
                    borderRadius: '4px',
                  }}
                >
                  ✖
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* RODAPÉ COM DUPLA OPÇÃO: PDF + WORD */}
        <div
          style={{
            padding: '14px 20px',
            background: '#f1f5f9',
            borderTop: '1px solid #e2e8f0',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '10px',
            flexWrap: 'wrap',
          }}
        >
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
            onClick={() => handleGerarDocumento('PDF')}
            style={{
              width: 'auto',
              padding: '8px 18px',
              fontSize: '12.5px',
              background: '#dc2626',
              color: '#ffffff',
              border: 'none',
              borderRadius: '6px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            📄 Gerar em PDF
          </button>

          <button
            type="button"
            onClick={() => handleGerarDocumento('DOCX')}
            style={{
              width: 'auto',
              padding: '8px 20px',
              fontSize: '12.5px',
              background: meta.corTopo,
              color: '#ffffff',
              border: 'none',
              borderRadius: '6px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            📝 Gerar em Word (.DOCX)
          </button>
        </div>
      </div>
    </div>
  );
}