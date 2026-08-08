// #8 GUARD (07/08) — todo caminho de import de EXTRATO bancário tem que descartar
// movimento futuro: OU roteando pelo runImportV2, OU usando o helper central
// partitionFutureLines. Se alguém criar um caminho novo e esquecer, este teste
// pega. Registry explícito: quando um caminho for migrado, vira 'DONE' e o teste
// exige o símbolo no fonte; enquanto 'TODO', documenta a dívida (não falha).
//
// Regra pra caminho NOVO: adicione aqui. TODO só é aceitável temporariamente.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const ROOT = join(__dirname, '..')

// Cada caminho de import de EXTRATO bancário (não Excel/cartão/agenda — lá futuro
// é intencional). status: DONE = tem que referenciar o símbolo; TODO = dívida aberta.
const CAMINHOS: Array<{ file: string; status: 'DONE' | 'TODO'; via: RegExp }> = [
  { file: 'app/api/contas-bancarias/[id]/importar-ofx/route.ts', status: 'DONE', via: /runImportV2/ },
  { file: 'app/api/contas-bancarias/[id]/importar-ofx-multiplos/route.ts', status: 'DONE', via: /runImportV2/ },
  { file: 'lib/reconciliation/import-orchestrator.ts', status: 'DONE', via: /partitionFutureLines/ },
  { file: 'app/api/contas-bancarias/[id]/importar-pdf-extrato/confirm/route.ts', status: 'DONE', via: /partitionFutureLines/ },
  // PF (fase 7): o descarte vive na LIB de cada import (a route é fina). Aponta
  // pro arquivo que realmente cria a PersonalTransaction.
  { file: 'lib/ofx-card/queries.ts', status: 'DONE', via: /partitionFutureLines/ },
  { file: 'lib/pdf-import/confirm.ts', status: 'DONE', via: /isFutureStatementLine|partitionFutureLines/ },
]

describe('#8 guard — caminhos de import de extrato descartam futuro', () => {
  for (const c of CAMINHOS) {
    const nome = c.file.split('/').slice(-2).join('/')
    it(`${c.status}: ${nome} ${c.status === 'DONE' ? 'usa o descarte' : '(dívida registrada)'}`, () => {
      const src = readFileSync(join(ROOT, c.file), 'utf8')
      if (c.status === 'DONE') {
        expect(c.via.test(src), `${c.file} deve referenciar ${c.via}`).toBe(true)
      } else {
        // TODO: só garante que o arquivo existe (dívida rastreada). Quando migrar,
        // trocar status pra DONE — aí o teste passa a EXIGIR o helper.
        expect(src.length).toBeGreaterThan(0)
      }
    })
  }

  it('nenhum caminho DONE voltou a reimplementar dedup próprio (filtrarNovasOFX)', () => {
    const multiplos = readFileSync(
      join(ROOT, 'app/api/contas-bancarias/[id]/importar-ofx-multiplos/route.ts'), 'utf8',
    )
    // Rota legada usava filtrarNovasOFX — não pode voltar (é sinal de motor paralelo).
    expect(multiplos).not.toMatch(/filtrarNovasOFX/)
  })
})
