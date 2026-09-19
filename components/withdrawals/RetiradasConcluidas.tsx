'use client'

// ⭐⭐ AS RETIRADAS QUE JÁ VIRARAM PONTE (19/09/2026).
//
// **O dono:** *"depois eu não sei ONDE achar as retiradas pra completar/conferir. Fiz 2 que
// teriam ido pra PF e não sei se deram certo."*
//
// ⛔ A tela de Retiradas só mostrava as **pendentes** (as órfãs, pra resolver em lote). Quem
// já foi mandada pro perfil sumia da vista — e *"deu certo?"* virava uma pergunta sem tela.
// ⭐ Aqui ficam as CONCLUÍDAS, cada uma com o link pra ponte (que mostra as duas pontas).

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowUpRight, Loader2 } from 'lucide-react'
import { fetchComTimeout } from '@/lib/http/fetch-com-timeout'

interface Ponte {
  id: string
  kind: string
  amount: number
  date: string
  pjDescription?: string | null
  pjBankAccountName?: string | null
  profileName?: string | null
}

const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const dia = (d: string) => d.slice(0, 10).split('-').reverse().join('/')

const ROTULO: Record<string, string> = {
  DISTRIBUICAO: 'Distribuição de lucros',
  PRO_LABORE: 'Pró-labore',
  REEMBOLSO: 'Reembolso',
  ADIANTAMENTO: 'Adiantamento',
  RETIRADA_SOCIOS: 'Retirada de sócios',
}

export function RetiradasConcluidas({ empresaId }: { empresaId: string }) {
  const [pontes, setPontes] = useState<Ponte[] | null>(null)
  /** ⛔ erro ≠ vazio: sem isto "nenhuma ponte" mentiria quando a chamada falha */
  const [falhou, setFalhou] = useState(false)

  useEffect(() => {
    void (async () => {
      const r = await fetchComTimeout<{ bridges?: Ponte[] }>(`/api/empresas/${empresaId}/pontes?pageSize=50`)
      if (!r.ok || !r.data?.bridges) { setFalhou(true); setPontes([]); return }
      setPontes(r.data.bridges)
    })()
  }, [empresaId])

  if (pontes === null) {
    return (
      <p className="flex items-center gap-2 px-1 py-3 text-sm text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" /> carregando as retiradas concluídas…
      </p>
    )
  }

  return (
    <section className="space-y-2">
      <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
        Já mandadas pro perfil pessoal{pontes.length > 0 && <span className="ml-1.5 font-normal text-slate-400">({pontes.length})</span>}
      </h2>

      {falhou && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12.5px] text-amber-900">
          Não consegui carregar as retiradas concluídas — recarregue a página. (A ausência
          aqui <b>não</b> quer dizer que não existam.)
        </p>
      )}

      {!falhou && pontes.length === 0 && (
        <p className="px-1 text-[12.5px] text-slate-500">
          Nenhuma retirada foi mandada pro perfil pessoal ainda.
        </p>
      )}

      <ul className="divide-y rounded-xl border dark:divide-slate-800 dark:border-slate-800">
        {pontes.map((p) => (
          <li key={p.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2.5 text-[13px]">
            <span className="tabular-nums text-slate-500">{dia(p.date)}</span>
            <b className="tabular-nums font-extrabold text-slate-900 dark:text-slate-100">{brl(p.amount)}</b>
            <span className="rounded-full bg-violet-50 px-2 py-[2px] text-[11.5px] font-bold text-violet-700">
              {ROTULO[p.kind] ?? p.kind}
            </span>
            <span className="min-w-0 flex-1 truncate text-slate-500">
              {p.pjDescription ?? '—'}{p.pjBankAccountName ? ` · ${p.pjBankAccountName}` : ''}
            </span>
            {/* ⭐ o link que responde "deu certo?": a ponte mostra AS DUAS pontas */}
            <Link href={`/pontes/${p.id}`}
              className="inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-[5px] text-[12px] font-bold text-violet-700 hover:bg-violet-50 dark:border-slate-700">
              conferir as 2 pontas <ArrowUpRight className="h-3 w-3" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
