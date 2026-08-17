// Sprint Fase 3 CAMADA 3 (15/08/2026) — SELO DO JUIZ no dashboard. O único lugar
// que o Yussef olha toda manhã sem precisar lembrar. 4 estados:
//   VERDE   "Juiz 9/9 · 06:00"        — última rodada passou
//   VERMELHO "Juiz: N falhas"          — invariante quebrou (link pro detalhe)
//   AMARELO "Juiz não rodou desde X"  — >24h sem rodar (cron parado = falha
//            silenciosa; o selo é o único que avisa)
//   CINZA   "Juiz nunca rodou"
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ShieldCheck, ShieldAlert, ShieldQuestion, Clock } from 'lucide-react'
import { judgeSeloState, type SeloLatest } from '@/lib/loans/judge-selo-state'

export function JuizSelo() {
  const [latest, setLatest] = useState<SeloLatest | null | undefined>(undefined)

  useEffect(() => {
    fetch('/api/juiz', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setLatest(d?.latest ?? null))
      .catch(() => setLatest(null))
  }, [])

  if (latest === undefined) return null // carregando — sem flash

  // Estado via função pura testada (4 estados distintos — ver judge-selo-state.ts).
  const state = judgeSeloState(latest, Date.now())
  const TONE = {
    green: { cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', Icon: ShieldCheck },
    red: { cls: 'bg-rose-50 text-rose-700 border-rose-300', Icon: ShieldAlert },
    yellow: { cls: 'bg-amber-50 text-amber-800 border-amber-300', Icon: Clock },
    gray: { cls: 'bg-slate-50 text-slate-600 border-slate-200', Icon: ShieldQuestion },
  } as const
  const { cls, Icon } = TONE[state.tone]
  const label = state.label

  return (
    <Link
      href="/juiz"
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors hover:brightness-95 ${cls}`}
      title="Juiz de módulo — invariantes do banco inteiro. Clique pro detalhe."
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </Link>
  )
}
