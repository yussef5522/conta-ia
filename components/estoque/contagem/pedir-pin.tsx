'use client'
// ⭐ R37/R42 — em conta de APARELHO (o tablet), fechar a zona ou a contagem pede o PIN de quem
// contou, como na Janela da Cozinha: o PIN só vive na memória desta modal e vai ao servidor, que
// confere (`quemEstaComOPin`) e assina com o NOME do dono do PIN. O cliente nunca diz quem é.
import { useState } from 'react'
import { Delete, Loader2 } from 'lucide-react'

export function PedirPin({ titulo, erro, ocupado, onPin, onFechar }: {
  titulo: string; erro: string | null; ocupado: boolean; onPin: (pin: string) => void; onFechar: () => void
}) {
  const [pin, setPin] = useState('')
  const tecla = (k: string) => {
    if (ocupado) return
    if (k === '⌫') return setPin((p) => p.slice(0, -1))
    const novo = (pin + k).slice(0, 4)
    setPin(novo)
    if (novo.length === 4) { onPin(novo); setPin('') }
  }
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 sm:items-center" onClick={onFechar} data-testid="pedir-pin">
      <div className="w-full rounded-t-2xl p-4 sm:max-w-xs sm:rounded-xl" style={{ background: 'var(--prod-surface)' }} onClick={(e) => e.stopPropagation()}>
        <p className="text-sm font-semibold" style={{ color: 'var(--prod-primary)' }}>{titulo}</p>
        <div className="my-3 flex justify-center gap-3">
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className="h-3.5 w-3.5 rounded-full border-2" style={{ borderColor: 'var(--prod-acao-bg)', background: i < pin.length ? 'var(--prod-acao-bg)' : 'transparent' }} />
          ))}
        </div>
        {erro && <p className="mb-2 text-center text-xs font-semibold" style={{ color: 'var(--fam-coral-ink)' }}>{erro}</p>}
        <div className="grid grid-cols-3 gap-2">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'].map((k, i) => k === ''
            ? <span key={i} />
            : (
              <button key={i} type="button" onClick={() => tecla(k)} disabled={ocupado} aria-label={k === '⌫' ? 'apagar' : k}
                className="flex h-14 items-center justify-center rounded-xl border text-xl font-extrabold disabled:opacity-50"
                style={{ borderColor: 'var(--prod-line-strong)', color: 'var(--prod-primary)' }}>
                {k === '⌫' ? <Delete className="h-5 w-5" /> : k}
              </button>
            ))}
        </div>
        {ocupado && <Loader2 className="mx-auto mt-2 h-4 w-4 animate-spin" style={{ color: 'var(--prod-muted)' }} />}
        <button onClick={onFechar} className="mt-2 h-9 w-full rounded-lg text-xs" style={{ color: 'var(--prod-muted)' }}>agora não</button>
      </div>
    </div>
  )
}
