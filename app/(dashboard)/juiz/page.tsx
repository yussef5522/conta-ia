// Sprint Fase 3 CAMADA 3 (15/08/2026) — tela do juiz de módulo. Histórico das
// rodadas, detalhe por empresa e por invariante, e na falha o dado exato.
'use client'

import { useEffect, useState, useCallback } from 'react'
import { ShieldCheck, ShieldAlert, RefreshCw, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { formatBRL } from '@/lib/format/money'

interface Fail { contract: string; fails: string[] }
interface CompanyDetail { companyId: string; name: string; contracts: number; fails: Fail[] }
interface BalanceCheck { accountId: string; name: string; stored: number; recomputed: number; delta: number }
interface DupCheck { accountName: string; stableKey: string; txIds: string[]; date: string; amount: number; memo: string }
interface VendaCheck { invariante: string; companyName: string; detalhe: string }
interface CardCheck { invariante: string; companyName: string; detalhe: string }
interface CardResumo { companyName: string; filaCount: number; filaSoma: number; filaMaisAntigaDias: number | null; visionBancos: string[] }
interface Report {
  id: string
  runAt: string
  passed: boolean
  totalContracts: number
  totalFail: number
  balanceIssues: number
  dupIssues?: number
  vendaIssues?: number
  cardIssues?: number
  durationMs: number
  detail: { byCompany: CompanyDetail[]; sharedTx: { txId: string; parcelas: string[] }[]; balanceChecks: BalanceCheck[]; dupStableKey?: DupCheck[]; vendaChecks?: VendaCheck[]; cardChecks?: CardCheck[]; cardResumo?: CardResumo[] }
}

const dt = (iso: string) => new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })

export default function JuizPage() {
  const [history, setHistory] = useState<Report[] | null>(null)
  const [sel, setSel] = useState<Report | null>(null)
  const [running, setRunning] = useState(false)

  const load = useCallback(() => {
    fetch('/api/juiz', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { setHistory(d?.history ?? []); setSel(d?.latest ?? null) })
      .catch(() => setHistory([]))
  }, [])
  useEffect(() => { load() }, [load])

  const rodar = async () => {
    setRunning(true)
    try {
      await fetch('/api/juiz', { method: 'POST', credentials: 'include' })
      load()
    } finally { setRunning(false) }
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-medium">Juiz de módulo</h1>
          <p className="text-sm text-muted-foreground">Invariantes do banco inteiro (todas as empresas) + cache de saldo. Roda de madrugada; aqui o histórico.</p>
        </div>
        <Button onClick={rodar} disabled={running} variant="outline">
          {running ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-1" />}
          Rodar agora
        </Button>
      </div>

      {sel && (
        <Card className={sel.passed ? 'border-emerald-200 bg-emerald-50/40' : 'border-rose-300 bg-rose-50/40'}>
          <CardContent className="py-4 space-y-3">
            <div className="flex items-center gap-2">
              {sel.passed ? <ShieldCheck className="h-5 w-5 text-emerald-600" /> : <ShieldAlert className="h-5 w-5 text-rose-600" />}
              <span className="font-medium">{sel.passed ? 'Tudo OK' : `${sel.totalFail + sel.balanceIssues + (sel.dupIssues ?? 0) + (sel.vendaIssues ?? 0) + (sel.cardIssues ?? 0)} falha(s)`}</span>
              <span className="text-sm text-muted-foreground">· {sel.totalContracts - sel.totalFail}/{sel.totalContracts} contratos · {dt(sel.runAt)} · {sel.durationMs}ms</span>
            </div>

            {sel.detail.byCompany.map((c) => (
              <div key={c.companyId} className="text-sm">
                <span className="font-medium">{c.name}</span> <span className="text-muted-foreground">({c.contracts} contratos)</span>
                {c.fails.length === 0 ? (
                  <span className="text-emerald-600"> · ✓</span>
                ) : (
                  <ul className="mt-1 ml-4 list-disc text-rose-700">
                    {c.fails.map((f) => (
                      <li key={f.contract}><span className="font-mono">{f.contract}</span> → {f.fails.join(', ')}</li>
                    ))}
                  </ul>
                )}
              </div>
            ))}

            {sel.detail.sharedTx.length > 0 && (
              <div className="text-sm text-rose-700">
                <span className="font-medium">I6 — tx compartilhada entre parcelas:</span>
                <ul className="ml-4 list-disc">{sel.detail.sharedTx.map((s) => <li key={s.txId}>{s.parcelas.join(' + ')}</li>)}</ul>
              </div>
            )}

            {sel.detail.balanceChecks.length > 0 && (
              <div className="text-sm text-rose-700">
                <span className="font-medium">I9 — saldo ≠ Σ transações (cache podre):</span>
                <ul className="ml-4 list-disc">
                  {sel.detail.balanceChecks.map((b) => (
                    <li key={b.accountId}>{b.name}: gravado {formatBRL(b.stored)} vs recalc {formatBRL(b.recomputed)} (Δ {formatBRL(b.delta)})</li>
                  ))}
                </ul>
              </div>
            )}
            {(sel.detail.dupStableKey?.length ?? 0) > 0 && (
              <div className="text-sm text-rose-700">
                <span className="font-medium">I10 — duplicata de tx (mesma linha importada 2×):</span>
                <ul className="ml-4 list-disc">
                  {sel.detail.dupStableKey!.map((d) => (
                    <li key={d.txIds.join()}>{d.accountName}: {d.date} {formatBRL(d.amount)} <span className="font-mono">{d.memo}</span> criada {d.txIds.length}× → <span className="font-mono text-xs">{d.txIds.join(', ')}</span></li>
                  ))}
                </ul>
              </div>
            )}
            {(sel.detail.vendaChecks?.length ?? 0) > 0 && (
              <div className="text-sm text-rose-700">
                <span className="font-medium">Vendas V1-V4 — VendaDiaria diverge das transações:</span>
                <ul className="ml-4 list-disc">
                  {sel.detail.vendaChecks!.map((v, i) => (
                    <li key={i}><span className="font-mono">{v.invariante}</span> · {v.companyName}: {v.detalhe}</li>
                  ))}
                </ul>
              </div>
            )}
            {(sel.detail.cardChecks?.length ?? 0) > 0 && (
              <div className="text-sm text-rose-700">
                <span className="font-medium">Cartão K1-K7 — invariantes:</span>
                <ul className="ml-4 list-disc">
                  {sel.detail.cardChecks!.map((c, i) => (
                    <li key={i}><span className="font-mono">{c.invariante}</span> · {c.companyName}: {c.detalhe}</li>
                  ))}
                </ul>
              </div>
            )}
            {(sel.detail.cardResumo ?? []).filter((r) => r.filaCount > 0 || r.visionBancos.length > 0).map((r, i) => (
              <div key={i} className="text-xs text-muted-foreground">
                Cartão {r.companyName}: fila A_CLASSIFICAR {r.filaCount} linhas / {r.filaSoma.toFixed(2)}{r.filaMaisAntigaDias != null ? ` (mais antiga ${r.filaMaisAntigaDias}d)` : ''}{r.visionBancos.length ? ` · Vision: ${r.visionBancos.join(', ')}` : ''}
              </div>
            ))}
            {sel.detail.balanceChecks.length === 0 && sel.detail.sharedTx.length === 0 && sel.totalFail === 0 && (sel.detail.dupStableKey?.length ?? 0) === 0 && (sel.detail.vendaChecks?.length ?? 0) === 0 && (sel.detail.cardChecks?.length ?? 0) === 0 && (
              <p className="text-xs text-muted-foreground">I6, I9, I10, Vendas V1-V4 e Cartão K1-K7: limpos.</p>
            )}
          </CardContent>
        </Card>
      )}

      <div>
        <h2 className="text-sm font-medium mb-2 text-muted-foreground">Histórico</h2>
        {history === null ? (
          <div className="flex items-center gap-2 text-muted-foreground text-sm py-4"><Loader2 className="h-4 w-4 animate-spin" /> carregando…</div>
        ) : history.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">Nenhuma rodada ainda. Clique "Rodar agora".</p>
        ) : (
          <div className="border rounded-lg divide-y">
            {history.map((r) => (
              <button key={r.id} onClick={() => setSel(r)} className={`w-full flex items-center justify-between px-3 py-2 text-sm text-left hover:bg-muted/50 ${sel?.id === r.id ? 'bg-muted/40' : ''}`}>
                <span className="flex items-center gap-2">
                  {r.passed ? <ShieldCheck className="h-4 w-4 text-emerald-600" /> : <ShieldAlert className="h-4 w-4 text-rose-600" />}
                  {dt(r.runAt)}
                </span>
                <span className="text-muted-foreground">
                  {r.totalContracts - r.totalFail}/{r.totalContracts} · {r.passed ? 'ok' : `${r.totalFail + r.balanceIssues + (r.dupIssues ?? 0) + (r.vendaIssues ?? 0) + (r.cardIssues ?? 0)} falha(s)`}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
