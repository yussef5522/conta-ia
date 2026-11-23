// ⭐ a recusa da DIREÇÃO vira JSON com a frase do servidor (recusa ensina a saída) — erro que
// ninguém previu CONTINUA re-lançado: inventar frase amigável pra bug desconhecido esconde o bug.
import { NextResponse } from 'next/server'
import { DirecaoError } from './direcao-dados'

export function respostaDaDirecao(e: unknown): NextResponse {
  if (e instanceof DirecaoError) return NextResponse.json({ erro: e.message, code: e.code }, { status: e.status })
  throw e
}
