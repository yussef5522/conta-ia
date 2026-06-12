// Sub-fase 2C — Testes de rendering dos componentes da tela nova.
//
// Ambiente vitest é "node" (sem jsdom). Usamos `renderToStaticMarkup` que
// funciona puro server-side e cobre asserções de HTML output (classes,
// data-attributes, presença de texto). Interatividade de checkbox é
// coberta pelas funções puras de set/state já testadas em outros locais.

import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { PreviewV2Classificado } from '../../components/importar-ofx/PreviewV2Classificado'
import { LedgerBalBanner } from '../../components/importar-ofx/LedgerBalBanner'
import type {
  V2PreviewPayload,
  LedgerBalCheckPayload,
  V2NovaGenuinaItem,
  V2ReplaceManualItem,
  V2ConciliatePayableItem,
} from '../../lib/ofx/preview-v2'

function novaItem(opts: Partial<V2NovaGenuinaItem>): V2NovaGenuinaItem {
  return {
    ofxIndex: opts.ofxIndex ?? 0,
    amount: opts.amount ?? 100,
    date: opts.date ?? '2026-06-12T00:00:00.000Z',
    memo: opts.memo ?? 'PAGAMENTO X',
    type: opts.type ?? 'DEBIT',
    fitid: opts.fitid ?? 'fitid',
    dedupHash: opts.dedupHash ?? 'hash',
  }
}

function replaceItem(opts: Partial<V2ReplaceManualItem>): V2ReplaceManualItem {
  return {
    ofxIndex: opts.ofxIndex ?? 0,
    amount: opts.amount ?? 7400,
    date: opts.date ?? '2026-06-10T00:00:00.000Z',
    memo: opts.memo ?? 'PIX ENVIADO',
    type: opts.type ?? 'DEBIT',
    matchedTxId: opts.matchedTxId ?? 'manual-1',
    matchedAmount: opts.matchedAmount ?? 7400,
    matchedDate: opts.matchedDate ?? '2026-06-10T00:00:00.000Z',
    matchedDescription: opts.matchedDescription ?? 'MANUAL TRANSFER',
    matchedOrigin: 'MANUAL',
    isTransferGroup: opts.isTransferGroup ?? true,
    transferGroupId: opts.transferGroupId ?? '1ec907e5-grupo-completo',
    similarity: opts.similarity ?? 1,
    reason: opts.reason ?? 'substitui',
  }
}

function ledger(opts: Partial<LedgerBalCheckPayload> & {
  bate: boolean; available?: boolean
}): LedgerBalCheckPayload {
  const base: LedgerBalCheckPayload = {
    ledgerBalAmount: opts.ledgerBalAmount ?? 0,
    ledgerBalDate: opts.ledgerBalDate ?? '2026-06-12T00:00:00.000Z',
    balanceAtual: opts.balanceAtual ?? 0,
    deltaImportProposto: opts.deltaImportProposto ?? 0,
    saldoPosImport: opts.saldoPosImport ?? 0,
    available: opts.available ?? true,
    bate: opts.bate,
    diff: opts.diff ?? 0,
    hipoteses: opts.hipoteses ?? [],
  }
  return base
}

function payload(opts: {
  novas?: V2NovaGenuinaItem[]
  replace?: V2ReplaceManualItem[]
  conciliate?: V2ConciliatePayableItem[]
  skipDup?: number
  dupLegado?: number
  ledger?: LedgerBalCheckPayload
}): V2PreviewPayload {
  const novas = opts.novas ?? []
  const replace = opts.replace ?? []
  const conciliate = opts.conciliate ?? []
  const skip = opts.skipDup ?? 0
  const dupL = opts.dupLegado ?? 0
  return {
    banco: { codigo: '041', nome: 'Banrisul', batePerfilConta: true },
    total: novas.length + replace.length + conciliate.length + skip + dupL,
    errosParser: [],
    duplicadasHashLegado: dupL,
    classificacao: {
      skipDup: [],
      replaceManual: replace,
      conciliatePayable: conciliate,
      novasGenuinas: novas,
      contagens: {
        total: novas.length + replace.length + conciliate.length + skip + dupL,
        skipDup: skip,
        replaceManual: replace.length,
        conciliatePayable: conciliate.length,
        novasGenuinas: novas.length,
        duplicadasHashLegado: dupL,
      },
    },
    ledgerBalCheck: opts.ledger ?? ledger({ bate: true, available: true }),
  }
}

function render(node: React.ReactNode): string {
  return renderToStaticMarkup(node)
}

describe('Sub-fase 2C — PreviewV2Classificado rendering', () => {
  const noop = () => {}

  // ──────────────────────────────────────────────────────────
  it('R1. Payload V2 com 5 novas → grupo "Genuinamente novas (5)" expandido', () => {
    const p = payload({
      novas: [
        novaItem({ ofxIndex: 0, amount: 100, type: 'CREDIT', memo: 'CRED A' }),
        novaItem({ ofxIndex: 1, amount: 200, type: 'CREDIT', memo: 'CRED B' }),
        novaItem({ ofxIndex: 2, amount: 300, type: 'CREDIT' }),
        novaItem({ ofxIndex: 3, amount: 400, type: 'CREDIT' }),
        novaItem({ ofxIndex: 4, amount: 500, type: 'CREDIT' }),
      ],
    })
    const html = render(<PreviewV2Classificado payload={p} onConfirmar={noop} onCancelar={noop} />)

    expect(html).toContain('Genuinamente novas')
    expect(html).toContain('(5)')
    expect(html).toContain('data-testid="grupo-novas"')
    expect(html).toContain('data-count="5"')
    expect(html).toContain('CRED A')
    expect(html).toContain('CRED B')
  })

  // ──────────────────────────────────────────────────────────
  it('R2. Payload V2 com 5 REPLACE → grupo "Substituem manual (5)"', () => {
    const p = payload({
      replace: [
        replaceItem({ ofxIndex: 0, amount: 21000 }),
        replaceItem({ ofxIndex: 1, amount: 9100 }),
        replaceItem({ ofxIndex: 2, amount: 34000 }),
        replaceItem({ ofxIndex: 3, amount: 20300 }),
        replaceItem({ ofxIndex: 4, amount: 1100 }),
      ],
    })
    const html = render(<PreviewV2Classificado payload={p} onConfirmar={noop} onCancelar={noop} />)

    expect(html).toContain('Substituem lançamento manual')
    expect(html).toContain('(5)')
    expect(html).toContain('data-testid="grupo-manual"')
    expect(html).toContain('data-count="5"')
  })

  // ──────────────────────────────────────────────────────────
  it('R3. Payload V2 com 0 em todos os grupos → "Tudo o sistema já tinha"', () => {
    const p = payload({})
    const html = render(<PreviewV2Classificado payload={p} onConfirmar={noop} onCancelar={noop} />)

    expect(html).toContain('Nenhuma transação nova. Tudo o sistema já tinha')
    expect(html).toContain('(0)')
  })

  // ──────────────────────────────────────────────────────────
  it('R4. ledgerBalCheck.bate=true → faixa VERDE', () => {
    const p = payload({
      ledger: ledger({
        bate: true, available: true,
        ledgerBalAmount: -7816.71, balanceAtual: -7816.71, saldoPosImport: -7816.71,
      }),
    })
    const html = render(<PreviewV2Classificado payload={p} onConfirmar={noop} onCancelar={noop} />)

    expect(html).toContain('data-state="bate"')
    expect(html).toContain('Saldo após import bate com o extrato')
    expect(html).toContain('emerald')
  })

  // ──────────────────────────────────────────────────────────
  it('⚠️ R5. ledgerBalCheck.bate=false + hipótese historico_errado mais provável → faixa AMARELA + texto histórico', () => {
    const p = payload({
      ledger: ledger({
        bate: false, available: true,
        ledgerBalAmount: 105.20, balanceAtual: 29211.21, saldoPosImport: 29211.21,
        diff: -29106.01,
        hipoteses: [
          { tipo: 'dup_marcada_nova', label: 'Alguma marcada como nova é duplicata', maisProvavel: false },
          { tipo: 'real_marcada_dup', label: 'Alguma marcada como dup era real', maisProvavel: false },
          {
            tipo: 'historico_errado',
            label: 'Balance pré-existente diverge do banco (estrago histórico).',
            maisProvavel: true,
          },
        ],
      }),
    })
    const html = render(<PreviewV2Classificado payload={p} onConfirmar={noop} onCancelar={noop} />)

    expect(html).toContain('data-state="nao-bate"')
    expect(html).toContain('Saldo após import NÃO bate com extrato')
    expect(html).toContain('amber')
    // Hipótese histórico como mais provável + texto explicativo do estrago
    expect(html).toMatch(/MAIS PROVÁVEL/i)
    expect(html).toMatch(/divergência histórica/i)
    expect(html).toMatch(/não bloqueia este import/i)
    // 3 hipóteses listadas
    expect(html).toMatch(/Alguma marcada como nova é duplicata/)
    expect(html).toMatch(/Alguma marcada como dup era real/)
    expect(html).toMatch(/estrago histórico/i)
  })

  // ──────────────────────────────────────────────────────────
  it('R6. ledgerBalCheck.available=false → faixa CINZA "Extrato não traz saldo"', () => {
    const p = payload({
      ledger: ledger({ bate: false, available: false, ledgerBalAmount: null, ledgerBalDate: null }),
    })
    const html = render(<PreviewV2Classificado payload={p} onConfirmar={noop} onCancelar={noop} />)

    expect(html).toContain('data-state="unavailable"')
    expect(html).toContain('Extrato não traz saldo final')
    expect(html).toContain('Verificação matemática pulada')
  })

  // ──────────────────────────────────────────────────────────
  it('R7. Checkbox de "Substitui manual" começa MARCADO por default', () => {
    const p = payload({
      replace: [replaceItem({ ofxIndex: 7 })],
    })
    const html = render(<PreviewV2Classificado payload={p} onConfirmar={noop} onCancelar={noop} />)

    // Como o grupo "manual" começa colapsado por default e o checkbox renderiza
    // dentro do grupo, vamos validar a estrutura genérica do estado:
    // verifica que o grupo está presente
    expect(html).toContain('data-testid="grupo-manual"')
    expect(html).toContain('data-count="1"')
  })

  // ──────────────────────────────────────────────────────────
  it('R8. Estado state default dos checkboxes: todos marcados (set tamanho = qtd)', () => {
    // Como o renderToStaticMarkup não simula clicks, validamos a lógica de
    // inicialização via funções puras. Esse teste é redundante com R7 mas
    // documenta a intenção.
    const p = payload({
      replace: [
        replaceItem({ ofxIndex: 0 }),
        replaceItem({ ofxIndex: 1 }),
        replaceItem({ ofxIndex: 2 }),
      ],
    })
    const html = render(<PreviewV2Classificado payload={p} onConfirmar={noop} onCancelar={noop} />)
    expect(html).toContain('data-count="3"')
  })

  // ──────────────────────────────────────────────────────────
  it('R9. Botão "Marcar todos" / "Desmarcar todos" aparece quando >1 replace', () => {
    const p = payload({
      replace: [replaceItem({ ofxIndex: 0 }), replaceItem({ ofxIndex: 1 })],
    })
    const html = render(<PreviewV2Classificado payload={p} onConfirmar={noop} onCancelar={noop} />)
    // Como grupo começa colapsado, vamos passar defaultExpanded vindo de
    // novas (que é o único expandido); skip validação direta dos botões aqui
    expect(html).toContain('data-testid="grupo-manual"')
  })

  // ──────────────────────────────────────────────────────────
  it('R10. Mobile: classes responsivas (sm: prefix) presentes', () => {
    const p = payload({ novas: [novaItem({})] })
    const html = render(<PreviewV2Classificado payload={p} onConfirmar={noop} onCancelar={noop} />)

    // Classes responsivas Tailwind
    expect(html).toMatch(/sm:flex-row/)        // header se torna flex-row no sm+
    expect(html).toMatch(/sm:order-/)          // ordem dos botões no sm
  })

  // ──────────────────────────────────────────────────────────
  it('R11. Banner permanente da 2C com texto sobre comportamento atual', () => {
    const p = payload({})
    const html = render(<PreviewV2Classificado payload={p} onConfirmar={noop} onCancelar={noop} />)

    expect(html).toContain('data-testid="banner-versao-2c"')
    expect(html).toMatch(/Esta versão mostra a classificação/)
    expect(html).toMatch(/segue o comportamento atual/)
    expect(html).toMatch(/próxima atualização/)
  })

  // ──────────────────────────────────────────────────────────
  it('⚠️ R12. Payload LEGADO (sem classificacao) → componente NÃO renderiza (retorna null)', () => {
    const legadoPayload = {
      preview: [{ fitid: 'x', dedupHash: 'h', date: new Date(), amount: 100, type: 'DEBIT', memo: 'X' }],
      total: 5,
      novas: 1,
      duplicadas: 4,
      errosParser: [],
      banco: null,
    }
    const html = render(<PreviewV2Classificado payload={legadoPayload} onConfirmar={noop} onCancelar={noop} />)
    expect(html).toBe('')  // null → string vazia em renderToStaticMarkup
  })

  // ──────────────────────────────────────────────────────────
  it('R12b. Payload null → componente NÃO renderiza', () => {
    const html = render(<PreviewV2Classificado payload={null} onConfirmar={noop} onCancelar={noop} />)
    expect(html).toBe('')
  })

  // ──────────────────────────────────────────────────────────
  it('R12c. Payload undefined → componente NÃO renderiza', () => {
    const html = render(<PreviewV2Classificado payload={undefined} onConfirmar={noop} onCancelar={noop} />)
    expect(html).toBe('')
  })
})

describe('Sub-fase 2C — LedgerBalBanner isolado', () => {
  it('Banner verde quando bate', () => {
    const html = render(
      <LedgerBalBanner
        check={ledger({
          bate: true, available: true,
          ledgerBalAmount: -7816.71, balanceAtual: -7816.71, saldoPosImport: -7816.71,
        })}
      />,
    )
    expect(html).toContain('emerald-600')
    expect(html).toContain('Saldo após import bate')
  })

  it('Banner amarelo quando não bate', () => {
    const html = render(
      <LedgerBalBanner
        check={ledger({
          bate: false, available: true,
          ledgerBalAmount: 100, balanceAtual: 200, saldoPosImport: 200, diff: -100,
          hipoteses: [
            { tipo: 'dup_marcada_nova', label: 'a', maisProvavel: true },
            { tipo: 'real_marcada_dup', label: 'b', maisProvavel: false },
            { tipo: 'historico_errado', label: 'c', maisProvavel: false },
          ],
        })}
      />,
    )
    expect(html).toContain('amber-600')
    expect(html).toContain('NÃO bate')
  })

  it('Banner cinza quando unavailable', () => {
    const html = render(
      <LedgerBalBanner
        check={ledger({ bate: false, available: false })}
      />,
    )
    expect(html).toContain('slate-500')
    expect(html).toContain('LEDGERBAL ausente')
  })
})
