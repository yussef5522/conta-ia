'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Bell, Check } from 'lucide-react'
import { useEmpresa } from '@/lib/contexts/empresa-context'
import { fetchComTimeout } from '@/lib/http/fetch-com-timeout'
import { useDismissivel } from '@/lib/hooks/use-dismissivel'
import {
  FAMILIA_DA_SEVERIDADE,
  ROTULO_DO_SETOR,
  SETORES,
  type Setor,
} from '@/lib/avisos/tipos'
import type { AvisoNaTela } from '@/lib/avisos/central'

/**
 * ⭐⭐⭐ O SININHO GLOBAL (04/10/2026) — o canal que o alarme não tinha.
 *
 * **Pedido do dono:** *"sininho GLOBAL no topo de todas as telas (contador; painel agrupado por
 * setor; marcar lido; severidade = filete de cor)."*
 *
 * ⛔⛔ **A EMPRESA VEM DO `useEmpresa()`, NUNCA DE `document.cookie`.** É a cicatriz de 20/09
 * inteira: a Lixeira lia `current_empresa_id` com `document.cookie`, o cookie é **httpOnly**
 * desde o Sprint 4.0.5.b, e o resultado foi *"carregando…" PARA SEMPRE* — a rota respondia 200
 * em 104 ms e **o fetch nunca saía**. Inventar um 2º jeito de saber a empresa foi o erro; aqui
 * é a porta única.
 *
 * ⛔ **E O ESTADO É EXPLÍCITO** (`CARREGANDO | SEM_EMPRESA | FALHOU | OK`), com `fetchComTimeout`:
 * *"enquanto 'ausência de dado' servir de estado, o caso não previsto vira spinner eterno"*.
 */

type Estado = 'CARREGANDO' | 'SEM_EMPRESA' | 'FALHOU' | 'OK'

interface Payload {
  avisos: AvisoNaTela[]
  total: number
  naoLidos: number
}

export function Sininho() {
  const { currentEmpresaId } = useEmpresa()
  const [estado, setEstado] = useState<Estado>('CARREGANDO')
  const [dados, setDados] = useState<Payload | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [aberto, setAberto] = useState(false)
  /** ⭐ o hook único da casa (28/08): clique fora + ESC, nos dois viewports — dropdown novo
   *  nasce dispensável em vez de pendurado na tela (o defeito do BuscaItem). */
  const caixa = useDismissivel<HTMLDivElement>(aberto, () => setAberto(false))

  const carregar = useCallback(async () => {
    if (!currentEmpresaId) {
      // ⛔ estado PRÓPRIO: "ainda não sei a empresa" ≠ "não tem aviso" ≠ "falhou"
      setEstado('SEM_EMPRESA')
      return
    }
    setEstado('CARREGANDO')
    const r = await fetchComTimeout<Payload>(`/api/empresas/${currentEmpresaId}/avisos`)
    if (!r.ok || !r.data) {
      setErro(r.erro ?? 'não consegui carregar os avisos')
      setEstado('FALHOU')
      return
    }
    setDados(r.data)
    setEstado('OK')
  }, [currentEmpresaId])

  useEffect(() => {
    void carregar()
  }, [carregar])

  async function marcarLido(id: string) {
    if (!currentEmpresaId) return
    // ⭐ otimista na tela, servidor manda: se falhar, recarrega e a verdade volta
    setDados((d) =>
      d ? { ...d, avisos: d.avisos.map((a) => (a.id === id ? { ...a, lido: true } : a)), naoLidos: Math.max(0, d.naoLidos - 1) } : d,
    )
    const r = await fetchComTimeout(`/api/empresas/${currentEmpresaId}/avisos/${id}`, { method: 'PATCH' })
    if (!r.ok) void carregar()
  }

  async function marcarTodos() {
    if (!currentEmpresaId) return
    const r = await fetchComTimeout(`/api/empresas/${currentEmpresaId}/avisos`, { method: 'POST' })
    if (!r.ok) setErro(r.erro ?? 'não consegui marcar como lido')
    void carregar()
  }

  const naoLidos = dados?.naoLidos ?? 0

  return (
    <div className="relative" ref={caixa}>
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        title={naoLidos > 0 ? `${naoLidos} aviso(s) sem ler` : 'Avisos'}
        aria-label="Avisos"
        aria-expanded={aberto}
        className="relative flex h-9 w-9 items-center justify-center rounded-lg border transition-colors"
        style={{ borderColor: 'var(--prod-line)', background: 'var(--prod-surface)', color: 'var(--prod-secondary)' }}
      >
        <Bell className="h-4 w-4" />
        {/* ⚠️ o contador só aparece com número — badge zerado treina o dono a não olhar (10/09) */}
        {naoLidos > 0 && (
          <span
            className="num absolute -right-1 -top-1 flex h-[17px] min-w-[17px] items-center justify-center rounded-full px-1 text-[10px] font-medium"
            style={{ background: 'var(--fam-coral-mid)', color: '#fff' }}
          >
            {naoLidos > 9 ? '9+' : naoLidos}
          </span>
        )}
      </button>

      {aberto && (
        <div
          className="absolute right-0 top-full z-50 mt-2 w-[min(92vw,420px)] overflow-hidden rounded-xl border shadow-lg"
          style={{ borderColor: 'var(--prod-line)', background: 'var(--prod-surface)', boxShadow: 'var(--prod-sombra)' }}
        >
          <div
            className="flex items-center justify-between border-b px-3 py-2"
            style={{ borderColor: 'var(--prod-line)' }}
          >
            <p className="text-[13px] font-medium" style={{ color: 'var(--prod-primary)' }}>Avisos</p>
            {naoLidos > 0 && (
              <button onClick={marcarTodos} className="text-[11px] underline" style={{ color: 'var(--prod-secondary)' }}>
                marcar tudo lido
              </button>
            )}
          </div>

          <div className="max-h-[70vh] overflow-y-auto">
            {estado === 'CARREGANDO' && (
              <p className="px-3 py-6 text-center text-[12px]" style={{ color: 'var(--prod-muted)' }}>lendo os avisos…</p>
            )}
            {estado === 'SEM_EMPRESA' && (
              <p className="px-3 py-6 text-center text-[12px]" style={{ color: 'var(--prod-muted)' }}>
                escolha uma empresa pra ver os avisos dela
              </p>
            )}
            {estado === 'FALHOU' && (
              <div className="px-3 py-5 text-center">
                <p className="text-[12px]" style={{ color: 'var(--fam-coral-ink)' }}>{erro}</p>
                {/* ⛔ falha NUNCA vira "não tem aviso": a ausência não é prova (10/09) */}
                <button onClick={() => void carregar()} className="mt-2 text-[11px] underline" style={{ color: 'var(--prod-secondary)' }}>
                  tentar de novo
                </button>
              </div>
            )}
            {estado === 'OK' && dados!.avisos.length === 0 && (
              <p className="px-3 py-6 text-center text-[12px]" style={{ color: 'var(--prod-muted)' }}>
                🎉 nada pendente — nenhum aviso em aberto
              </p>
            )}
            {estado === 'OK' &&
              SETORES.filter((s) => dados!.avisos.some((a) => a.setor === s)).map((setor) => (
                <section key={setor}>
                  <p
                    className="px-3 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-wider"
                    style={{ color: 'var(--prod-muted)' }}
                  >
                    {ROTULO_DO_SETOR[setor as Setor]}
                  </p>
                  {dados!.avisos
                    .filter((a) => a.setor === setor)
                    .map((a) => (
                      <LinhaDoAviso key={a.id} a={a} onLido={() => void marcarLido(a.id)} />
                    ))}
                </section>
              ))}
          </div>
        </div>
      )}
    </div>
  )
}

/** ⭐ a severidade é um FILETE de cor na borda esquerda — o pedido literal do dono */
function LinhaDoAviso({ a, onLido }: { a: AvisoNaTela; onLido: () => void }) {
  const fam = FAMILIA_DA_SEVERIDADE[a.severidade]
  return (
    <div
      className="border-b px-3 py-2.5 last:border-b-0"
      style={{
        borderColor: 'var(--prod-line)',
        borderLeft: `3px solid var(--fam-${fam}-mid)`,
        background: a.lido ? 'transparent' : 'var(--prod-surface-1)',
      }}
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-medium leading-snug" style={{ color: 'var(--prod-primary)' }}>
            {a.titulo}
          </p>
          <p className="mt-0.5 text-[12px] leading-snug" style={{ color: 'var(--prod-secondary)' }}>{a.corpo}</p>
          {/* ⛔⛔ "O que fazer" é OBRIGATÓRIO e aparece SEMPRE — é o que separa aviso de ruído */}
          <p className="mt-1 text-[12px] leading-snug" style={{ color: 'var(--prod-primary)' }}>
            <span className="font-medium">O que fazer:</span> {a.oQueFazer}
          </p>
          {a.acaoHref && a.acaoRotulo && (
            <Link
              href={a.acaoHref}
              className="mt-1.5 inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-medium"
              style={{ borderColor: `var(--fam-${fam}-mid)`, color: `var(--fam-${fam}-ink)`, background: `var(--fam-${fam}-bg)` }}
            >
              {a.acaoRotulo} →
            </Link>
          )}
          {a.vezes > 1 && (
            <p className="num mt-1 text-[10px]" style={{ color: 'var(--prod-muted)' }}>
              repetiu {a.vezes}×
            </p>
          )}
        </div>
        {!a.lido && (
          <button
            onClick={onLido}
            title="marcar como lido"
            aria-label="marcar como lido"
            className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border"
            style={{ borderColor: 'var(--prod-line)', color: 'var(--prod-muted)' }}
          >
            <Check className="h-3 w-3" />
          </button>
        )}
      </div>
    </div>
  )
}
