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

interface Report {
  runAt: string
  passed: boolean
  totalContracts: number
  totalFail: number
  balanceIssues: number
}

const HH = (iso: string) =>
  new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
const DIA = (iso: string) =>
  new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })

export function JuizSelo() {
  const [latest, setLatest] = useState<Report | null | undefined>(undefined)

  useEffect(() => {
    fetch('/api/admin/juiz', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setLatest(d?.latest ?? null))
      .catch(() => setLatest(null))
  }, [])

  if (latest === undefined) return null // carregando — sem flash

  let cls = '', Icon = ShieldQuestion, label = ''
  if (!latest) {
    cls = 'bg-slate-50 text-slate-600 border-slate-200'; Icon = ShieldQuestion; label = 'Juiz nunca rodou'
  } else {
    const ageH = (Date.now() - new Date(latest.runAt).getTime()) / 3_600_000
    if (ageH > 24) {
      cls = 'bg-amber-50 text-amber-800 border-amber-300'; Icon = Clock
      label = `Juiz não rodou desde ${DIA(latest.runAt)}`
    } else if (latest.passed) {
      cls = 'bg-emerald-50 text-emerald-700 border-emerald-200'; Icon = ShieldCheck
      label = `Juiz ${latest.totalContracts - latest.totalFail}/${latest.totalContracts} · ${HH(latest.runAt)}`
    } else {
      cls = 'bg-rose-50 text-rose-700 border-rose-300'; Icon = ShieldAlert
      const n = latest.totalFail + latest.balanceIssues
      label = `Juiz: ${n} falha${n === 1 ? '' : 's'}`
    }
  }

  return (
    <Link
      href="/admin/juiz"
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors hover:brightness-95 ${cls}`}
      title="Juiz de módulo — invariantes do banco inteiro. Clique pro detalhe."
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </Link>
  )
}
