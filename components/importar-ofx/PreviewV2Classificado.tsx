// Sub-fase 2C — Tela do preview com classificação 4 grupos + ledgerBalCheck.
//
// Renderiza só quando o payload do /preview tem shape V2 (campo `classificacao`).
// Se vier payload legado, retorna null e a UI legada cuida.
//
// ⚠️ ESCOPO 2C: tela puramente INFORMATIVA. Botão Confirmar chama o /confirm
// LEGADO (= comportamento atual de hoje, dedup por FITID). Banner permanente
// avisa o user. A 2D refatora /confirm pra respeitar a classificação.

'use client'

import { useMemo, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Info } from 'lucide-react'
import { cn } from '@/lib/utils'
import { LedgerBalBanner } from './LedgerBalBanner'
import { GrupoClassificacao } from './GrupoClassificacao'
import type {
  V2PreviewPayload,
  V2NovaGenuinaItem,
  V2ReplaceManualItem,
  V2ConciliatePayableItem,
  V2SkipDupItem,
} from '@/lib/ofx/preview-v2'

function fmtBRL(value: number): string {
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function fmtData(iso: string): string {
  const d = new Date(iso)
  return `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

interface Props {
  payload: unknown                // pode ser legado (null) ou V2
  // Sprint Preview-Truth (29/06/2026): callback recebe decisões declarativas
  // por dedupHash. SKIP = linha desmarcada pelo user (não vira tx). Tipo
  // opcional pra back-compat com callers que não precisam das decisões.
  onConfirmar: (
    decisions?: Array<{
      dedupHash: string
      action: 'CREATE_NEW' | 'SKIP' | 'REPLACE_MANUAL' | 'CONCILIATE_PAYABLE'
    }>,
  ) => void
  onCancelar: () => void
  loading?: boolean
}

/** Type guard: payload é V2? */
function isV2Payload(p: unknown): p is V2PreviewPayload {
  if (!p || typeof p !== 'object') return false
  const obj = p as Record<string, unknown>
  return 'classificacao' in obj && 'ledgerBalCheck' in obj
}

export function PreviewV2Classificado({ payload, onConfirmar, onCancelar, loading }: Props) {
  if (!isV2Payload(payload)) return null

  const p = payload
  const { classificacao, ledgerBalCheck, banco, total } = p
  const c = classificacao

  // Sprint Preview-Truth (29/06/2026) — state das DECISÕES por dedupHash.
  // Default: TODAS as `novasGenuinas` marcadas (entrarão). User pode
  // desmarcar individualmente — desmarcadas viram action=SKIP no confirm.
  const [skipNovas, setSkipNovas] = useState<Set<string>>(new Set())
  const toggleSkipNova = (dedupHash: string) => {
    setSkipNovas((prev) => {
      const next = new Set(prev)
      if (next.has(dedupHash)) next.delete(dedupHash)
      else next.add(dedupHash)
      return next
    })
  }
  const novasMarcadasCount = c.novasGenuinas.length - skipNovas.size

  // State dos checkboxes em REPLACE e CONCILIATE (informativo legado).
  const [marcadosReplace, setMarcadosReplace] = useState<Set<number>>(
    new Set(c.replaceManual.map((x) => x.ofxIndex)),
  )
  const [marcadosConcil, setMarcadosConcil] = useState<Set<number>>(
    new Set(c.conciliatePayable.map((x) => x.ofxIndex)),
  )

  const toggleReplace = (idx: number) => {
    setMarcadosReplace((prev) => {
      const next = new Set(prev)
      if (next.has(idx)) next.delete(idx)
      else next.add(idx)
      return next
    })
  }
  const toggleConcil = (idx: number) => {
    setMarcadosConcil((prev) => {
      const next = new Set(prev)
      if (next.has(idx)) next.delete(idx)
      else next.add(idx)
      return next
    })
  }
  const marcarTodosReplace = () =>
    setMarcadosReplace(new Set(c.replaceManual.map((x) => x.ofxIndex)))
  const desmarcarTodosReplace = () => setMarcadosReplace(new Set())

  const contagemBate = useMemo(() => {
    return c.contagens.novasGenuinas === 0 &&
      c.contagens.replaceManual + c.contagens.conciliatePayable === 0
  }, [c])

  return (
    <div className="space-y-4" data-testid="preview-v2-classificado">
      {/* ─── Header ─── */}
      <Card className="p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-lg font-semibold">
              📄 Extrato {banco ? `${banco.nome} (${banco.codigo})` : 'do banco'}
            </p>
            <p className="text-sm text-slate-600">
              {total} transações no arquivo
            </p>
          </div>
          {banco && banco.batePerfilConta !== false && (
            <p className="text-sm text-emerald-700">
              ✓ Banco bate com perfil da conta
            </p>
          )}
          {banco && banco.batePerfilConta === false && (
            <p className="text-sm text-amber-700">
              ⚠️ Banco do extrato difere do banco cadastrado
            </p>
          )}
        </div>
      </Card>

      {/* ─── LedgerBal no TOPO (decisão Yussef) ─── */}
      <LedgerBalBanner check={ledgerBalCheck} />

      {/* ─── 4 grupos da classificação ─── */}
      <GrupoClassificacao
        titulo="Genuinamente novas — vão entrar"
        emoji="🆕"
        count={c.contagens.novasGenuinas}
        variant="novas"
        defaultExpanded
        emptyMessage="Nenhuma transação nova. Tudo o sistema já tinha."
      >
        <ul className="space-y-2">
          {c.novasGenuinas.map((it) => (
            <NovaRow
              key={it.ofxIndex}
              item={it}
              marcado={!skipNovas.has(it.dedupHash)}
              onToggle={() => toggleSkipNova(it.dedupHash)}
            />
          ))}
        </ul>
        {/* Sprint Preview-Truth: contagem dinâmica reflete desmarcações */}
        {skipNovas.size > 0 && (
          <p className="mt-2 text-xs text-amber-700">
            {novasMarcadasCount} marcada(s) — {skipNovas.size} desmarcada(s) não vão entrar
          </p>
        )}
      </GrupoClassificacao>

      <GrupoClassificacao
        titulo="Substituem lançamento manual"
        emoji="🔁"
        count={c.contagens.replaceManual}
        variant="manual"
        subtexto="A OFX assume o lugar do lançamento manual que você fez antes. Saldo não duplica."
        emptyMessage="Nenhum lançamento manual a substituir."
      >
        <ul className="space-y-2">
          {c.replaceManual.map((it) => (
            <ReplaceRow
              key={it.ofxIndex}
              item={it}
              marcado={marcadosReplace.has(it.ofxIndex)}
              onToggle={() => toggleReplace(it.ofxIndex)}
            />
          ))}
        </ul>
        {c.replaceManual.length > 1 && (
          <div className="mt-3 flex gap-2">
            <Button size="sm" variant="ghost" onClick={marcarTodosReplace}>
              Marcar todos
            </Button>
            <Button size="sm" variant="ghost" onClick={desmarcarTodosReplace}>
              Desmarcar todos
            </Button>
          </div>
        )}
      </GrupoClassificacao>

      <GrupoClassificacao
        titulo="Concilia conta a pagar Excel"
        emoji="✓"
        count={c.contagens.conciliatePayable}
        variant="payable"
        subtexto="A OFX casa com conta a pagar pendente — vai conciliar."
        emptyMessage="Nenhuma conta a pagar pendente bate com este extrato."
      >
        <ul className="space-y-2">
          {c.conciliatePayable.map((it) => (
            <ConciliateRow
              key={it.ofxIndex}
              item={it}
              marcado={marcadosConcil.has(it.ofxIndex)}
              onToggle={() => toggleConcil(it.ofxIndex)}
            />
          ))}
        </ul>
      </GrupoClassificacao>

      <GrupoClassificacao
        titulo="Já no sistema — não importa"
        emoji="✅"
        count={c.contagens.skipDup + c.contagens.duplicadasHashLegado}
        variant="skip"
        subtexto={`${c.contagens.duplicadasHashLegado} detectadas por FITID idêntico · ${c.contagens.skipDup} detectadas por valor+data+descrição (FITID reciclado)`}
      >
        <ul className="space-y-2">
          {c.skipDup.map((it) => (
            <SkipRow key={it.ofxIndex} item={it} />
          ))}
        </ul>
      </GrupoClassificacao>

      {/* ─── Resumo + Banner temporário 2C + Ações ─── */}
      <Card className="p-4">
        <div className="mb-4 text-sm">
          <p className="font-medium">Resumo:</p>
          <p className="text-slate-700">
            Total {total} transações no arquivo. {c.contagens.novasGenuinas} vão entrar como
            novas · {c.contagens.replaceManual} substituem manuais · {c.contagens.conciliatePayable}{' '}
            conciliam contas a pagar · {c.contagens.skipDup + c.contagens.duplicadasHashLegado} já
            existem.
          </p>
        </div>

        {/* Banner permanente — explica o limite atual desta versão */}
        <div
          className="mb-4 flex items-start gap-3 rounded-md border border-slate-300 bg-slate-50 p-3 text-sm"
          data-testid="banner-versao-2c"
        >
          <Info className="h-4 w-4 flex-shrink-0 text-slate-600" />
          <p className="text-slate-700">
            Esta versão mostra a classificação para você revisar. Ao confirmar, o import segue o
            comportamento atual — a classificação acima ainda não é aplicada automaticamente. Isso
            chega na próxima atualização.
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button
            variant="ghost"
            onClick={onCancelar}
            disabled={loading}
            className="sm:order-1"
          >
            Cancelar
          </Button>
          <Button
            onClick={() => {
              // Sprint Preview-Truth: monta decisões declarativas.
              // - novasGenuinas marcadas → CREATE_NEW; desmarcadas → SKIP
              // - replaceManual marcadas → REPLACE_MANUAL; desmarcadas → SKIP
              //   (não substitui; preview continua mostrando, user pode pular)
              // - conciliatePayable marcadas → CONCILIATE_PAYABLE; desmarcadas → SKIP
              const decisions: Array<{
                dedupHash: string
                action: 'CREATE_NEW' | 'SKIP' | 'REPLACE_MANUAL' | 'CONCILIATE_PAYABLE'
              }> = []
              for (const it of c.novasGenuinas) {
                decisions.push({
                  dedupHash: it.dedupHash,
                  action: skipNovas.has(it.dedupHash) ? 'SKIP' : 'CREATE_NEW',
                })
              }
              onConfirmar(decisions)
            }}
            disabled={loading}
            className="sm:order-2"
          >
            {loading
              ? 'Importando...'
              : `Confirmar ${novasMarcadasCount} ${novasMarcadasCount === 1 ? 'transação' : 'transações'}`}
          </Button>
        </div>
      </Card>
    </div>
  )
}

// ───────────────────────────────────────────────────────────
// Linhas individuais
// ───────────────────────────────────────────────────────────

function NovaRow({
  item,
  marcado,
  onToggle,
}: {
  item: V2NovaGenuinaItem
  marcado: boolean
  onToggle: () => void
}) {
  const sinal = item.type === 'CREDIT' ? '+' : '−'
  return (
    <li
      className={cn(
        'flex items-center justify-between gap-2 rounded bg-white/60 px-3 py-2 text-sm',
        !marcado && 'opacity-50',
      )}
    >
      <div className="flex items-center gap-3">
        <Checkbox
          checked={marcado}
          onCheckedChange={onToggle}
          aria-label={
            marcado
              ? 'Desmarcar — não importar esta transação'
              : 'Marcar — importar esta transação'
          }
        />
        <div>
          <span className="text-slate-500">{fmtData(item.date)}</span>{' '}
          <span className="font-medium">{item.memo}</span>
          {!marcado && (
            <span className="ml-2 text-xs text-amber-700">não vai entrar</span>
          )}
        </div>
      </div>
      <span className="tabular-nums font-medium text-blue-900">
        {sinal} {fmtBRL(item.amount)}
      </span>
    </li>
  )
}

function ReplaceRow({
  item, marcado, onToggle,
}: {
  item: V2ReplaceManualItem; marcado: boolean; onToggle: () => void
}) {
  const sinal = item.type === 'CREDIT' ? '+' : '−'
  return (
    <li className="flex items-start gap-3 rounded bg-white/60 px-3 py-2 text-sm">
      <Checkbox
        checked={marcado}
        onCheckedChange={onToggle}
        aria-label="Marcar para substituir"
        className="mt-0.5"
      />
      <div className="flex-1">
        <div className="flex items-center justify-between gap-2">
          <span>
            <span className="text-slate-500">{fmtData(item.date)}</span>{' '}
            <span className="font-medium">{item.memo}</span>
          </span>
          <span className="tabular-nums font-medium">
            {sinal} {fmtBRL(item.amount)}
          </span>
        </div>
        <p className="mt-1 text-xs text-slate-600">
          → casa com Manual{' '}
          {item.isTransferGroup && item.transferGroupId
            ? `TRANSFER do grupo ${item.transferGroupId.slice(0, 8)}…`
            : 'EFFECTED'}{' '}
          ({fmtBRL(item.matchedAmount)})
        </p>
      </div>
    </li>
  )
}

function ConciliateRow({
  item, marcado, onToggle,
}: {
  item: V2ConciliatePayableItem; marcado: boolean; onToggle: () => void
}) {
  const sinal = item.type === 'CREDIT' ? '+' : '−'
  return (
    <li className="flex items-start gap-3 rounded bg-white/60 px-3 py-2 text-sm">
      <Checkbox
        checked={marcado}
        onCheckedChange={onToggle}
        aria-label="Marcar para conciliar"
        className="mt-0.5"
      />
      <div className="flex-1">
        <div className="flex items-center justify-between gap-2">
          <span>
            <span className="text-slate-500">{fmtData(item.date)}</span>{' '}
            <span className="font-medium">{item.memo}</span>
          </span>
          <span className="tabular-nums font-medium">
            {sinal} {fmtBRL(item.amount)}
          </span>
        </div>
        <p className="mt-1 text-xs text-slate-600">
          → casa com conta a pagar Excel ({fmtBRL(item.matchedAmount)})
          {item.matchedCategoryName && ` · ${item.matchedCategoryName}`}
          {Math.abs(item.diff) > 0.02 && (
            <>
              {' '}
              · diff <span className="tabular-nums">{fmtBRL(item.diff)}</span> (provável
              juros/multa)
            </>
          )}
        </p>
      </div>
    </li>
  )
}

function SkipRow({ item }: { item: V2SkipDupItem }) {
  const sinal = item.type === 'CREDIT' ? '+' : '−'
  return (
    <li className="flex items-center justify-between gap-2 rounded bg-white/60 px-3 py-2 text-sm">
      <div>
        <span className="text-slate-500">{fmtData(item.date)}</span>{' '}
        <span>{item.memo}</span>
      </div>
      <span className="tabular-nums text-slate-600">
        {sinal} {fmtBRL(item.amount)}
      </span>
    </li>
  )
}
