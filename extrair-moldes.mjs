// extrair-moldes.mjs
import fs from 'fs';
import path from 'path';

const arquivoFonte = path.resolve('src/components/documentos/moldesBase64Originais.ts');
const pastaDestino = path.resolve('public/moldes-word');

if (!fs.existsSync(pastaDestino)) {
  fs.mkdirSync(pastaDestino, { recursive: true });
}

const conteudo = fs.readFileSync(arquivoFonte, 'utf-8');

const mapaArquivos = {
  MOLDE_CONSOLIDADA_PF_BASE64: 'consolidada-rural-pf.docx',
  MOLDE_CONSOLIDADA_PRONAF_BASE64: 'consolidada-rural-pronaf.docx',
  MOLDE_REGULARIDADE_AMBIENTAL_BASE64: 'decl-regularidade-ambiental.docx',
  MOLDE_REG_AMB_GARANTIDOR_BASE64: 'decl-reg-amb-garantidor.docx',
  MOLDE_NAO_DESMATAMENTO_BASE64: 'decl-nao-desmatamento-2008.docx',
  MOLDE_RECOMPOSICAO_BASE64: 'decl-recomposicao.docx',
  MOLDE_BIOMA_AMAZONIA_BASE64: 'decl-bioma-amazonia.docx',
  MOLDE_NAO_DESMAT_DESMEMBRAMENTO_BASE64: 'decl-desmembramento.docx',
  MOLDE_RESERVA_AMB_ACIMA4_BASE64: 'decl-reserva-acima-4m.docx',
  MOLDE_RETIFICACAO_CAR_BASE64: 'decl-retificacao-car.docx',
  MOLDE_SOBREPOSICAO_CAR_BASE64: 'decl-sobreposicao-car.docx',
  MOLDE_SOBREPOSICAO_CAR_DIF_BASE64: 'decl-sobreposicao-car-dif.docx',
  MOLDE_SOBREPOSICAO_CAR_POSSEIRO_BASE64: 'decl-sobreposicao-car-posseiro.docx',
  MOLDE_NAO_EXPLORACAO_BASE64: 'decl-nao-exploracao.docx',
  MOLDE_PROD_AUTOMATICOS_BASE64: 'decl-produtos-automaticos.docx',
  MOLDE_ALTERACAO_PROPOSTA_BASE64: 'decl-alteracao-proposta.docx',
  MOLDE_PROTOCOLO_PLANTA_BASE64: 'protocolo-planta-nordeste.docx',
  MOLDE_SOLICITACAO_PLANTA_BASE64: 'solicitacao-planta-nordeste.docx',
};

let extraidos = 0;

for (const [constName, fileName] of Object.entries(mapaArquivos)) {
  const regex = new RegExp(`export\\s+const\\s+${constName}\\s*=\\s*["'\`]([^"'\`]+)["'\`]`);
  const match = conteudo.match(regex);
  if (match && match[1] && !match[1].startsWith('COLE_AQUI')) {
    const buffer = Buffer.from(match[1].replace(/\s+/g, ''), 'base64');
    fs.writeFileSync(path.join(pastaDestino, fileName), buffer);
    console.log(`✅ Gerado: public/moldes-word/${fileName}`);
    extraidos++;
  } else {
    console.warn(`⚠️ Ignorado (vazio ou não preenchido): ${constName}`);
  }
}

console.log(`\n🎉 Concluído! ${extraidos} moldes Word (.docx) extraídos para public/moldes-word/`);