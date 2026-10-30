// src/app/api/ferramentas-sync/route.ts
import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const CAMINHO_DB_FERRAMENTAS = path.join(
  process.cwd(),
  'public',
  'dados-ferramentas-sync.json'
);

export async function GET() {
  try {
    if (!fs.existsSync(CAMINHO_DB_FERRAMENTAS)) {
      return NextResponse.json({ existe: false, dados: null });
    }
    const raw = fs.readFileSync(CAMINHO_DB_FERRAMENTAS, 'utf-8');
    return NextResponse.json({ existe: true, dados: JSON.parse(raw) });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro ao ler dados';
    return NextResponse.json({ existe: false, erro: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    let atual: Record<string, unknown> = {};

    if (fs.existsSync(CAMINHO_DB_FERRAMENTAS)) {
      try {
        atual = JSON.parse(fs.readFileSync(CAMINHO_DB_FERRAMENTAS, 'utf-8'));
      } catch {
        atual = {};
      }
    }

    const atualizado = {
      ...atual,
      ...body,
      ultimaSincronizacao: new Date().toISOString(),
    };

    fs.writeFileSync(
      CAMINHO_DB_FERRAMENTAS,
      JSON.stringify(atualizado, null, 2),
      'utf-8'
    );

    return NextResponse.json({ sucesso: true, dados: atualizado });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro ao salvar dados';
    return NextResponse.json({ sucesso: false, erro: msg }, { status: 500 });
  }
}