// #8 GUARD (07/08) — todo caminho de import de EXTRATO bancário tem que descartar
// movimento futuro: OU roteando pelo runImportV2, OU usando o helper central
// partitionFutureLines. Se alguém criar um caminho novo e esquecer, este teste
// pega. Registry explícito: quando um caminho for migrado, vira 'DONE' e o teste
// exige o símbolo no fonte; enquanto 'TODO', documenta a dívida (não falha).
//
// Regra pra caminho NOVO: adicione aqui. TODO só é aceitável temporariamente.
//
// ⚠️ LIÇÃO (09/08, REGRA 3): este registry é ESTRUTURAL (grep de símbolo no
// fonte) e por isso deu FALSO NEGATIVO — passava verde enquanto o PREVIEW do
// OFX/PDF oferecia linhas futuras (o helper existia no arquivo, mas só rodava no
// CONFIRM). Grep de string NÃO prova comportamento. A prova COMPORTAMENTAL (roda
// o pipeline do preview contra o Extrato_20260809.ofx REAL) vive em:
//   - __tests__/preview-futuro-extrato-real.test.ts        (preview OFX)
//   - lib/pdf-bank-statement/__tests__/partition-future.test.ts (preview PDF)
// O registry abaixo fica como PISO (pega caminho novo que nem importa o helper);
// a garantia real é o teste que EXECUTA.

import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'

const ROOT = join(__dirname, '..')

// Cada caminho de import de EXTRATO bancário (não Excel/cartão/agenda — lá futuro
// é intencional). status: DONE = tem que referenciar o símbolo; TODO = dívida aberta.
const CAMINHOS: Array<{ file: string; status: 'DONE' | 'TODO'; via: RegExp }> = [
  { file: 'app/api/contas-bancarias/[id]/importar-ofx/route.ts', status: 'DONE', via: /runImportV2/ },
  { file: 'app/api/contas-bancarias/[id]/importar-ofx-multiplos/route.ts', status: 'DONE', via: /runImportV2/ },
  { file: 'lib/reconciliation/import-orchestrator.ts', status: 'DONE', via: /partitionFutureLines/ },
  { file: 'app/api/contas-bancarias/[id]/importar-pdf-extrato/confirm/route.ts', status: 'DONE', via: /partitionFutureLines/ },
  // PREVIEW (09/08): regressão do sprint — o preview também tem que descartar.
  { file: 'app/api/contas-bancarias/[id]/importar-pdf-extrato/preview/route.ts', status: 'DONE', via: /partitionFutureStatementLines/ },
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

  // FORA DE ESCOPO (documentado) — não são import de EXTRATO, então não descartam
  // futuro. Se a premissa de cada um mudar, o teste abaixo quebra e força revisão.
  it('from-ofx opera sobre tx JÁ importada (não sobre linha crua) — descarte já ocorreu no import', () => {
    const src = readFileSync(join(ROOT, 'lib/transfers/from-ofx.ts'), 'utf8')
    // Se um dia passar a parsear OFX cru aqui, esta premissa cai → revisar.
    expect(src).toMatch(/transaction\.findUnique/)
    expect(src).not.toMatch(/parseOFX\(/)
  })

  it('v2-confirm REMOVIDO (código morto — sprint 08/08) — não pode voltar', () => {
    // Removido: route + lib/ofx/v2-confirm.ts + run/detect órfãos. Guard: nem o
    // arquivo volta, nem o fluxo vivo passa a referenciá-lo.
    expect(existsSync(join(ROOT, 'app/api/contas-bancarias/[id]/importar-ofx/v2-confirm/route.ts'))).toBe(false)
    expect(existsSync(join(ROOT, 'lib/ofx/v2-confirm.ts'))).toBe(false)
    const rota = readFileSync(join(ROOT, 'app/api/contas-bancarias/[id]/importar-ofx/route.ts'), 'utf8')
    expect(rota).not.toMatch(/v2-confirm/)
  })

  it('import/staging (OFX) REMOVIDO (código morto, 0 uso) — não pode voltar', () => {
    expect(existsSync(join(ROOT, 'app/api/empresas/[id]/import/staging'))).toBe(false)
    expect(existsSync(join(ROOT, 'app/(dashboard)/empresas/[id]/import/staging'))).toBe(false)
  })
})
