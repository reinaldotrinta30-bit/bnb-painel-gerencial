// src/app/api/moldes-word/route.ts
import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { caminhoPublicDocx, base64 } = body as {
      caminhoPublicDocx?: string;
      base64?: string;
    };

    if (!caminhoPublicDocx || !base64) {
      return NextResponse.json(
        { erro: 'Parâmetros incompletos.' },
        { status: 400 }
      );
    }

    const nomeArquivo = path.basename(caminhoPublicDocx);
    const pastaDestino = path.join(process.cwd(), 'public', 'moldes-word');

    if (!fs.existsSync(pastaDestino)) {
      fs.mkdirSync(pastaDestino, { recursive: true });
    }

    const caminhoCompleto = path.join(pastaDestino, nomeArquivo);
    const buffer = Buffer.from(base64.replace(/\s+/g, ''), 'base64');
    fs.writeFileSync(caminhoCompleto, buffer);

    return NextResponse.json({
      sucesso: true,
      arquivoSalvo: `/moldes-word/${nomeArquivo}`,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro ao gravar arquivo .docx';
    return NextResponse.json({ erro: msg }, { status: 500 });
  }
}