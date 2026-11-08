'use client';

import React, { useState } from 'react';
import { aplicarMascaraCPF, aplicarMascaraDataBR } from '@/lib/utils';

interface PainelConsultasRapidasAgrupadasProps {
  cpfTitular: string;
  dataNascTitular?: string;
  cpfConjuge?: string;
  dataNascConjuge?: string;
  cpfProcuradorOuAvalista?: string;
  dataNascProcuradorOuAvalista?: string;
  carRecibo?: string;
  compacto?: boolean;
}

interface ItemConsultaLink {
  id: string;
  ordem?: number;
  label: string;
  url: string;
  tipoCopy: 'CPF' | 'CAR' | 'NENHUM';
  grupoTitular: boolean;
  grupoEnvolvidos: boolean;
}

const LISTA_LINKS_CONSULTAS: ItemConsultaLink[] = [
  {
    id: 'S400',
    ordem: 1,
    label: '1. S400 Ficha',
    url: 'http://d001mfp1.capgv.intra.bnb/S400-CCClientes/faces/consultarCadastros.jsp',
    tipoCopy: 'CPF',
    grupoTitular: true,
    grupoEnvolvidos: true,
  },
  {
    id: 'CI',
    ordem: 2,
    label: '2. CI / BACEN',
    url: 'http://d001mfp1.capgv.intra.bnb/S255-CentralInformacoes/faces/index.jsp',
    tipoCopy: 'CPF',
    grupoTitular: true,
    grupoEnvolvidos: true,
  },
  {
    id: 'CND',
    ordem: 3,
    label: '3. CND Federal',
    url: 'https://servicos.receitafederal.gov.br/servico/certidoes/#/home/cpf',
    tipoCopy: 'CPF',
    grupoTitular: true,
    grupoEnvolvidos: true,
  },
  {
    id: 'CNDT',
    ordem: 4,
    label: '4. CNDT Trab.',
    url: 'https://cndt-certidao.tst.jus.br/inicio.faces',
    tipoCopy: 'CPF',
    grupoTitular: true,
    grupoEnvolvidos: true,
  },
  {
    id: 'EMBARGOS',
    ordem: 5,
    label: '5. Embargos',
    url: 'https://servicos.ibama.gov.br/ctf/publico/areasembargadas/',
    tipoCopy: 'CPF',
    grupoTitular: true,
    grupoEnvolvidos: true,
  },
  {
    id: 'IMPROBIDADE',
    ordem: 6,
    label: '6. Improbidade',
    url: 'https://www.cnj.jus.br/improbidade_adm/consultar_requerido.php',
    tipoCopy: 'CPF',
    grupoTitular: true,
    grupoEnvolvidos: true,
  },
  {
    id: 'CERT_SOCIO',
    ordem: 7,
    label: '7. Cert. Socio.',
    url: 'https://apps.powerapps.com/play/e/c1f0ee77-2c47-e9c2-b736-03ded17586e4/a/eaa18c62-628b-4795-8c40-5176bc1f0a68?tenantId=efb605aa-4527-4640-9dac-65d150e949ca&hint=ea5829fb-55f8-4575-b3ab-3fdea078a70c&sourcetime=1742221966987',
    tipoCopy: 'CAR',
    grupoTitular: true,
    grupoEnvolvidos: false,
  },
  {
    id: 'EXTRATO_CAF',
    ordem: 8,
    label: '8. Extrato CAF',
    url: 'https://caf.mda.gov.br/consulta-publica/ufpa',
    tipoCopy: 'CPF',
    grupoTitular: true,
    grupoEnvolvidos: false,
  },
  {
    id: 'SICAR',
    ordem: 9,
    label: '9. CAR (SICAR)',
    url: 'https://www.car.gov.br/#/consultar',
    tipoCopy: 'CAR',
    grupoTitular: true,
    grupoEnvolvidos: false,
  },
  {
    id: 'ITI',
    label: 'Validar ITI',
    url: 'https://validar.iti.gov.br/',
    tipoCopy: 'NENHUM',
    grupoTitular: false,
    grupoEnvolvidos: false,
  },
  {
    id: 'SELO_TJMA',
    label: 'Selo TJMA',
    url: 'https://selo.tjma.jus.br/#/',
    tipoCopy: 'NENHUM',
    grupoTitular: false,
    grupoEnvolvidos: false,
  },
  {
    id: 'CCIR',
    label: 'Emitir CCIR',
    url: 'https://sncr.serpro.gov.br/ccir/emissao;jsessionid=cMDhZasyXEwvhyQ1wZ8Uw3kF.ccir4?windowId=db4',
    tipoCopy: 'CPF',
    grupoTitular: false,
    grupoEnvolvidos: false,
  },
  {
    id: 'CND_ITR',
    label: 'CND / ITR',
    url: 'https://servicos.receitafederal.gov.br/servico/certidoes/#/home/cib',
    tipoCopy: 'CPF',
    grupoTitular: false,
    grupoEnvolvidos: false,
  },
  {
    id: 'GED',
    label: 'GED BNB',
    url: 'https://s1jbsp01.capgv.intra.bnb:8443/flexps/fxd/home.xhtml',
    tipoCopy: 'CPF',
    grupoTitular: false,
    grupoEnvolvidos: false,
  },
  {
    id: 'S567',
    label: 'S567 PCE',
    url: 'https://s1wlbp20.capgv.intra.bnb/ProcessPortal',
    tipoCopy: 'CPF',
    grupoTitular: false,
    grupoEnvolvidos: false,
  },
  {
    id: 'FARMCHECK',
    label: 'Farmcheck',
    url: 'https://farmcheck.brainag.app/login',
    tipoCopy: 'CAR',
    grupoTitular: false,
    grupoEnvolvidos: false,
  },
];

export default function PainelConsultasRapidasAgrupadas({
  cpfTitular,
  dataNascTitular = '',
  cpfConjuge = '',
  dataNascConjuge = '',
  cpfProcuradorOuAvalista = '',
  dataNascProcuradorOuAvalista = '',
  carRecibo = '',
}: PainelConsultasRapidasAgrupadasProps) {
  const [alvoSelecionado, setAlvoSelecionado] = useState<
    'TITULAR' | 'CONJUGE' | 'OUTRO'
  >('TITULAR');
  const [cpfOutroManual, setCpfOutroManual] = useState(cpfProcuradorOuAvalista);
  const [nascOutroManual, setNascOutroManual] = useState(
    dataNascProcuradorOuAvalista
  );
  const [feedback, setFeedback] = useState('');

  const obterCpfAtivo = (): string => {
    if (alvoSelecionado === 'CONJUGE') return cpfConjuge || '';
    if (alvoSelecionado === 'OUTRO')
      return cpfOutroManual || cpfProcuradorOuAvalista || '';
    return cpfTitular || '';
  };

  const obterDataNascAtiva = (): string => {
    if (alvoSelecionado === 'CONJUGE') return dataNascConjuge || '';
    if (alvoSelecionado === 'OUTRO')
      return nascOutroManual || dataNascProcuradorOuAvalista || '';
    return dataNascTitular || '';
  };

  const copiarTexto = (txt: string) => {
    if (!txt || typeof navigator === 'undefined' || !navigator.clipboard)
      return;
    navigator.clipboard.writeText(txt).catch(() => {});
  };

  const mostrarAviso = (msg: string) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(''), 5000);
  };

  const abrirConsultaUnica = (item: ItemConsultaLink) => {
    if (item.tipoCopy === 'CAR') {
      if (carRecibo) {
        copiarTexto(carRecibo);
        mostrarAviso(`⚡ ${item.label}: CAR (${carRecibo}) copiado p/ Ctrl+V!`);
      } else {
        mostrarAviso(`🔗 Abrindo ${item.label}...`);
      }
    } else if (item.tipoCopy === 'CPF') {
      const cpfBruto = obterCpfAtivo();
      const limpo = cpfBruto.replace(/\D/g, '');
      const dtNasc = obterDataNascAtiva();
      if (limpo) {
        copiarTexto(limpo);
        mostrarAviso(
          `⚡ ${item.label}: CPF (${cpfBruto}) copiado!${
            dtNasc ? ` • 🎂 Nasc.: ${dtNasc}` : ''
          }`
        );
      } else {
        mostrarAviso(`🔗 Abrindo ${item.label} (CPF não informado)...`);
      }
    } else {
      mostrarAviso(`🔗 Abrindo ${item.label}...`);
    }

    window.open(item.url, '_blank', 'noopener,noreferrer');
  };

  const abrirAgrupamentoDeGuias = () => {
    const cpfBruto = obterCpfAtivo();
    const cpfLimpo = cpfBruto.replace(/\D/g, '');
    if (cpfLimpo) {
      copiarTexto(cpfLimpo);
    }

    const listaGrupo = LISTA_LINKS_CONSULTAS.filter((lk) =>
      alvoSelecionado === 'TITULAR' ? lk.grupoTitular : lk.grupoEnvolvidos
    ).sort((a, b) => (a.ordem || 99) - (b.ordem || 99));

    let bloqueouAlguma = false;
    listaGrupo.forEach((lk) => {
      const win = window.open(lk.url, '_blank');
      if (!win) bloqueouAlguma = true;
    });

    if (bloqueouAlguma) {
      mostrarAviso(
        '⚠️ O navegador bloqueou múltiplas guias! Clique no ícone de Pop-up na barra de endereço do Chrome (canto direito) e marque "Sempre permitir pop-ups".'
      );
    } else {
      mostrarAviso(
        `🚀 Agrupamento aberto (${listaGrupo.length} guias na ordem)${
          cpfLimpo ? ` + CPF (${cpfBruto}) copiado p/ Ctrl+V!` : '!'
        }`
      );
    }
  };

  const cpfAtivoAtual = obterCpfAtivo();
  const nascAtivaAtual = obterDataNascAtiva();

  return (
    <div
      style={{
        background: '#ffffff',
        borderRadius: '8px',
        border: '1px solid #cbd5e1',
        borderTop: '4px solid #ea580c',
        padding: '10px 12px',
        display: 'flex',
        flexDirection: 'column',
        gap: '7px',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '6px',
        }}
      >
        <strong style={{ fontSize: '11.5px', color: '#c2410c' }}>
          🔗 CONSULTAS DO DIA (AGRUPADAS OU INDIVIDUAIS)
        </strong>
      </div>

      {/* SELETOR DE QUEM CONSULTAR (TITULAR vs CÔNJUGE vs ENVOLVIDOS) COM CPF E DATA DE NASCIMENTO */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '5px',
        }}
      >
        <button
          type="button"
          onClick={() => setAlvoSelecionado('TITULAR')}
          style={{
            width: '100%',
            padding: '5px 6px',
            fontSize: '10px',
            fontWeight: 800,
            borderRadius: '5px',
            border: '1px solid #ea580c',
            background: alvoSelecionado === 'TITULAR' ? '#ea580c' : '#fff7ed',
            color: alvoSelecionado === 'TITULAR' ? '#ffffff' : '#c2410c',
            cursor: 'pointer',
            textAlign: 'center',
          }}
        >
          👤 Titular
          <span style={{ display: 'block', fontSize: '9.5px', opacity: 0.95 }}>
            {cpfTitular || 'S/ CPF'}
          </span>
          {dataNascTitular && (
            <span style={{ display: 'block', fontSize: '9px', opacity: 0.9 }}>
              🎂 {dataNascTitular}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setAlvoSelecionado('CONJUGE')}
          style={{
            width: '100%',
            padding: '5px 6px',
            fontSize: '10px',
            fontWeight: 800,
            borderRadius: '5px',
            border: '1px solid #9333ea',
            background: alvoSelecionado === 'CONJUGE' ? '#9333ea' : '#faf5ff',
            color: alvoSelecionado === 'CONJUGE' ? '#ffffff' : '#7e22ce',
            cursor: 'pointer',
            textAlign: 'center',
          }}
        >
          💍 Cônjuge
          <span style={{ display: 'block', fontSize: '9.5px', opacity: 0.95 }}>
            {cpfConjuge || 'S/ CPF'}
          </span>
          {dataNascConjuge && (
            <span style={{ display: 'block', fontSize: '9px', opacity: 0.9 }}>
              🎂 {dataNascConjuge}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setAlvoSelecionado('OUTRO')}
          style={{
            width: '100%',
            padding: '5px 6px',
            fontSize: '10px',
            fontWeight: 800,
            borderRadius: '5px',
            border: '1px solid #0369a1',
            background: alvoSelecionado === 'OUTRO' ? '#0369a1' : '#f0f9ff',
            color: alvoSelecionado === 'OUTRO' ? '#ffffff' : '#0369a1',
            cursor: 'pointer',
            textAlign: 'center',
          }}
        >
          🤝 Aval./Proc.
          <span style={{ display: 'block', fontSize: '9.5px', opacity: 0.95 }}>
            {cpfOutroManual || cpfProcuradorOuAvalista || 'Digitar'}
          </span>
          {(nascOutroManual || dataNascProcuradorOuAvalista) && (
            <span style={{ display: 'block', fontSize: '9px', opacity: 0.9 }}>
              🎂 {nascOutroManual || dataNascProcuradorOuAvalista}
            </span>
          )}
        </button>
      </div>

      {alvoSelecionado === 'OUTRO' && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1.2fr 1fr',
            gap: '6px',
          }}
        >
          <input
            type="text"
            value={cpfOutroManual}
            onChange={(e) =>
              setCpfOutroManual(aplicarMascaraCPF(e.target.value))
            }
            placeholder="CPF Avalista/Procurador..."
            maxLength={14}
            style={{
              width: '100%',
              height: '28px',
              fontSize: '11px',
              padding: '3px 8px',
              borderRadius: '5px',
              border: '1px solid #93c5fd',
              background: '#f0f9ff',
              fontWeight: 700,
            }}
          />
          <input
            type="text"
            value={nascOutroManual}
            onChange={(e) =>
              setNascOutroManual(aplicarMascaraDataBR(e.target.value))
            }
            placeholder="Nasc: DD/MM/AAAA"
            maxLength={10}
            style={{
              width: '100%',
              height: '28px',
              fontSize: '11px',
              padding: '3px 8px',
              borderRadius: '5px',
              border: '1px solid #93c5fd',
              background: '#f0f9ff',
              fontWeight: 700,
            }}
          />
        </div>
      )}

      {/* BARRA RÁPIDA DE CÓPIA DE CPF E DATA DE NASCIMENTO (PARA COLAR NO SITE DA CND) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '6px',
        }}
      >
        <button
          type="button"
          onClick={() => {
            const limpo = cpfAtivoAtual.replace(/\D/g, '');
            if (limpo) {
              copiarTexto(limpo);
              mostrarAviso(`📋 CPF (${cpfAtivoAtual}) copiado para o Ctrl+V!`);
            } else {
              mostrarAviso('⚠️ Nenhum CPF disponível para copiar.');
            }
          }}
          style={{
            width: '100%',
            padding: '4px 8px',
            fontSize: '10px',
            fontWeight: 800,
            background: '#f1f5f9',
            color: '#0f172a',
            border: '1px solid #cbd5e1',
            borderRadius: '5px',
            cursor: 'pointer',
          }}
          title="Copia apenas os números do CPF selecionado"
        >
          📋 Copiar CPF: {cpfAtivoAtual || '-'}
        </button>

        <button
          type="button"
          onClick={() => {
            if (nascAtivaAtual) {
              const limpoData = nascAtivaAtual.replace(/\D/g, '');
              copiarTexto(limpoData);
              mostrarAviso(
                `🎂 Data de Nasc. (${nascAtivaAtual}) copiada p/ colar na CND!`
              );
            } else {
              mostrarAviso('⚠️ Data de nascimento não identificada nos PDFs.');
            }
          }}
          style={{
            width: '100%',
            padding: '4px 8px',
            fontSize: '10px',
            fontWeight: 800,
            background: '#ecfdf5',
            color: '#047857',
            border: '1px solid #a7f3d0',
            borderRadius: '5px',
            cursor: 'pointer',
          }}
          title="Copia a Data de Nascimento para colar na emissão da CND da Receita Federal"
        >
          🎂 Copiar Nasc. (CND): {nascAtivaAtual || 'Não lida'}
        </button>
      </div>

      {/* BOTÃO DE DISPARO DO AGRUPAMENTO COMPLETO NA ORDEM EXATA */}
      <button
        type="button"
        onClick={abrirAgrupamentoDeGuias}
        style={{
          width: '100%',
          padding: '8px 10px',
          fontSize: '11px',
          fontWeight: 900,
          borderRadius: '6px',
          border: 'none',
          background:
            alvoSelecionado === 'TITULAR'
              ? 'linear-gradient(90deg, #ea580c 0%, #c2410c 100%)'
              : 'linear-gradient(90deg, #7e22ce 0%, #6b21a8 100%)',
          color: '#ffffff',
          cursor: 'pointer',
          boxShadow: '0 2px 6px rgba(234, 88, 12, 0.28)',
          textAlign: 'center',
        }}
      >
        {alvoSelecionado === 'TITULAR'
          ? '🚀 ABRIR AGRUPAMENTO DO TITULAR (9 GUIAS NA ORDEM)'
          : `🚀 ABRIR AGRUPAMENTO ${
              alvoSelecionado === 'CONJUGE' ? 'DO CÔNJUGE' : 'DO ENVOLVIDO'
            } (6 GUIAS)`}
      </button>

      {feedback && (
        <div
          style={{
            background: feedback.startsWith('⚠️') ? '#fef3c7' : '#dcfce7',
            color: feedback.startsWith('⚠️') ? '#92400e' : '#166534',
            border: `1px solid ${
              feedback.startsWith('⚠️') ? '#fcd34d' : '#86efac'
            }`,
            padding: '4px 8px',
            borderRadius: '5px',
            fontSize: '10.5px',
            fontWeight: 800,
            textAlign: 'center',
          }}
        >
          {feedback}
        </div>
      )}

      {/* BOTÕES INDIVIDUAIS */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '4px',
        }}
      >
        {LISTA_LINKS_CONSULTAS.map((lk) => {
          const fazParteDoGrupoAtivo =
            alvoSelecionado === 'TITULAR'
              ? lk.grupoTitular
              : lk.grupoEnvolvidos;
          return (
            <button
              key={lk.id}
              type="button"
              onClick={() => abrirConsultaUnica(lk)}
              style={{
                width: '100%',
                padding: '4px 5px',
                fontSize: '9.5px',
                fontWeight: 800,
                background: fazParteDoGrupoAtivo ? '#fff7ed' : '#f8fafc',
                color: fazParteDoGrupoAtivo ? '#9a3412' : '#475569',
                border: `1px solid ${
                  fazParteDoGrupoAtivo ? '#fed7aa' : '#e2e8f0'
                }`,
                borderRadius: '4px',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {lk.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}