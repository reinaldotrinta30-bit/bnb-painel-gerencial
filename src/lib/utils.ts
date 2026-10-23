export const META_PRONAF = 3625000;
export const META_MINI = 4533920;

export const LISTA_PROJETISTAS_CURTOS = [
  'ZEZÃO', 'ISMAYLE', 'DEIMID', 'MARCOS', 'PEDRO', 'ALTEMAR',
  'LAÉRCIO', 'GREGORY', 'RUI', 'RAIMUNDO', 'JORDEAN', 'FAGNER', 'JOCELAN'
];

export function parseMoeda(str?: string | number): number {
  if (!str) return 0;
  if (typeof str === 'number') return str;
  return parseFloat(String(str).replace(/\./g, '').replace(',', '.')) || 0;
}

export function formatarMoedaBD(num: number): string {
  return (num || 0).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function aplicarMascaraCPF(valor: string): string {
  let v = valor.replace(/\D/g, '').slice(0, 11);
  v = v.replace(/(\d{3})(\d)/, '$1.$2');
  v = v.replace(/(\d{3})(\d)/, '$1.$2');
  v = v.replace(/(\d{3})(\d{1,2})$/, '$1-$2');
  return v;
}

export function aplicarMascaraMoedaInput(valor: string): string {
  const apenasDigitos = valor.replace(/\D/g, '');
  if (!apenasDigitos) return '';
  const numero = parseFloat(apenasDigitos) / 100;
  return numero.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function aplicarMascaraDataBR(valor: string): string {
  let v = valor.replace(/\D/g, '').slice(0, 8);
  if (v.length > 2) v = v.substring(0, 2) + '/' + v.substring(2);
  if (v.length > 5) v = v.substring(0, 5) + '/' + v.substring(5, 9);
  return v;
}

export function getHojeISO(): string {
  const d = new Date();
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mes}-${dia}`;
}

export function getHojeBR(): string {
  const d = new Date();
  const dia = String(d.getDate()).padStart(2, '0');
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  return `${dia}/${mes}/${d.getFullYear()}`;
}

export function formatarMoedaExcel(val: unknown): string {
  if (val === undefined || val === null || val === '') return '';
  let num: number | string = val as string | number;
  if (typeof val === 'string') {
    let limpo = val.replace(/[R$\s]/g, '').trim();
    if (limpo.includes(',') && !limpo.includes('.')) {
      limpo = limpo.replace(',', '.');
    } else if (limpo.includes('.') && limpo.includes(',')) {
      limpo = limpo.replace(/\./g, '').replace(',', '.');
    }
    num = parseFloat(limpo);
  }
  if (typeof num !== 'number' || isNaN(num)) {
    return typeof val === 'string' ? val : '';
  }
  return num.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatarDataExcel(val: unknown): string {
  if (!val) return '';
  if (val instanceof Date) {
    const d = val.getUTCDate();
    const m = val.getUTCMonth() + 1;
    const y = val.getUTCFullYear();
    return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`;
  }
  const str = String(val).trim();
  if (!isNaN(Number(str)) && Number(str) > 10000) {
    const excelDate = new Date(Math.round((Number(str) - 25569) * 86400 * 1000));
    const d = excelDate.getUTCDate();
    const m = excelDate.getUTCMonth() + 1;
    const y = excelDate.getUTCFullYear();
    return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`;
  }
  if (str.includes('-')) {
    const p = str.split('-');
    if (p[0].length === 4) return `${p[2]}/${p[1]}/${p[0]}`;
  } else if (str.includes('/')) {
    const p = str.split('/');
    if (p[2] && p[2].length === 4) {
      return `${p[0].padStart(2, '0')}/${p[1].padStart(2, '0')}/${p[2]}`;
    }
  }
  return str;
}

export const LISTA_PROGRAMAS_PADRAO = [
  'PRONAF COMUM (433)',
  'PRONAF MAIS ALIMENTOS (434)',
  'PRONAF MULHER (406)',
  'PRONAF JOVEM (407)',
  'PRONAF ECO (408)',
  'PRONAF A (368)',
  'PRONAF A - RES.5.183/24 (699)',
  'PRONAF A - JOVEM (673)',
  'FNE /RURAL (226)',
  'LCGH (975)',
  'LCGA (653)',
];

// Preparado para o Item 8 (Aba Ferramentas): lê programas customizados se existirem no sistema
export function obterListaProgramas(): string[] {
  if (typeof window === 'undefined') return LISTA_PROGRAMAS_PADRAO;
  try {
    const salvo = window.localStorage.getItem('bnb_v2_config_programas');
    if (salvo) {
      const parsed = JSON.parse(salvo);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {
    // fallback para padrão
  }
  return LISTA_PROGRAMAS_PADRAO;
}

// ITEM 7: Regra oficial de enquadramento no FNE Cada Vez Melhor (Programas 673, 408 e 406)
export function isEnquadradoCadaVezMelhor(
  programa?: string,
  flagLegada?: boolean
): boolean {
  if (programa && programa.trim() !== '') {
    const p = programa.toUpperCase().trim();
    return (
      p.includes('PRONAF A - JOVEM') ||
      p.includes('(673)') ||
      p.includes('PRONAF ECO') ||
      p.includes('(408)') ||
      p.includes('PRONAF MULHER') ||
      p.includes('(406)')
    );
  }
  return Boolean(flagLegada);
}

export interface ProjetistaConfig {
  nomeCurto: string;
  nomeCompleto?: string;
  registro?: string;
  cpf?: string;
  telefone?: string; // Formato DDD + Número para WhatsApp (ex: 98988887777)
}

export const LISTA_PROJETISTAS_PADRAO: ProjetistaConfig[] = [
  { nomeCurto: 'ZEZÃO', nomeCompleto: 'JOSÉ FRANCISCO LIMA SEIXAS', registro: '7069/D', cpf: '839.104.843-87', telefone: '' },
  { nomeCurto: 'ISMAYLE', nomeCompleto: 'ISMAYLE', registro: '', cpf: '', telefone: '' },
  { nomeCurto: 'DEIMID', nomeCompleto: 'DEIMID RODRIGUES DA SILVA', registro: '1120602378', cpf: '034.156.832-57', telefone: '' },
  { nomeCurto: 'MARCOS', nomeCompleto: 'MARCOS', registro: '', cpf: '', telefone: '' },
  { nomeCurto: 'PEDRO', nomeCompleto: 'PEDRO SILVA DUTRA', registro: '02410832300', cpf: '024.108.323-00', telefone: '' },
  { nomeCurto: 'ALTEMAR', nomeCompleto: 'ALTEMAR LEITE DA NOBREGA', registro: '1104537206', cpf: '665.167.304-15', telefone: '' },
  { nomeCurto: 'LAÉRCIO', nomeCompleto: 'JOSE LAERCIO PINTO FILHO', registro: '14305429349', cpf: '143.054.293-49', telefone: '' },
  { nomeCurto: 'GREGORY', nomeCompleto: 'GREGORY BANDEIRA DA SILVA', registro: '1122939604', cpf: '037.214.223-09', telefone: '' },
  { nomeCurto: 'RUI', nomeCompleto: 'RUI MENDES RODRIGUES', registro: '1600208053', cpf: '045.336.304-05', telefone: '' },
  { nomeCurto: 'RAIMUNDO', nomeCompleto: 'RAIMUNDO ALLANDERSON JOAB LIMA AZEVEDO', registro: '9800D/MA', cpf: '025.042.743-51', telefone: '' },
  { nomeCurto: 'JORDEAN', nomeCompleto: 'JORDEAN DA CONCEIÇÃO RODRIGUES', registro: '1727844335', cpf: '017.278.443-35', telefone: '' },
  { nomeCurto: 'FAGNER', nomeCompleto: 'FAGNER SOUSA NASCIMENTO', registro: '1107456002', cpf: '009.556.693-75', telefone: '' },
  { nomeCurto: 'JOCELAN', nomeCompleto: 'JOCELAN BEZERRA TINOCO', registro: '45012970349', cpf: '450.129.703-49', telefone: '' },
];

export function obterListaProjetistas(): ProjetistaConfig[] {
  if (typeof window === 'undefined') return LISTA_PROJETISTAS_PADRAO;
  try {
    const salvo = window.localStorage.getItem('bnb_v2_config_projetistas');
    if (salvo) {
      const parsed = JSON.parse(salvo);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {
    // fallback
  }
  return LISTA_PROJETISTAS_PADRAO;
}

export function buscarTelefoneProjetista(nomeProjetista?: string): string {
  if (!nomeProjetista) return '';
  const lista = obterListaProjetistas();
  const termo = nomeProjetista.toUpperCase().trim();
  const achado = lista.find(
    (p) =>
      p.nomeCurto.toUpperCase() === termo ||
      termo.includes(p.nomeCurto.toUpperCase())
  );
  return achado?.telefone ? achado.telefone.replace(/\D/g, '') : '';
}