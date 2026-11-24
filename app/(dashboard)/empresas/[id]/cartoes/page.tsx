// ⭐⭐⭐ CARTÕES v3 — A PÁGINA (docs/cartoes-referencia.html, R44/R45/R51/R52 · 24/11/2026).
//
// O topo responde em 4 cartões (a pagar agora · faturas abertas · comprometido em parcelas ·
// limite), a linha do mês mostra fechamentos e vencimentos com "hoje", e cada cartão é OBJETO
// completo: chip do banco, selo do ciclo, "vence em N dias" com pulso âmbar sem pagamento casado,
// UMA régua do disponível, parcelas futuras e o menu ⋯ (editar · arquivar · excluir LIGADOS).
// ⚠️ Tudo vem de UMA leitura em lote (`/cartoes/carteira` → `lerCarteira`): o N+1 morreu.
'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'
import { formatBRL } from '@/lib/format/money'
import type { Carteira, CartaoNaCarteira } from '@/lib/credit-card-pj/carteira'
import { alertasDaCarteira } from '@/lib/credit-card-pj/vigia'
import { ANCORAS } from '@/components/perguntas/ancoras'
import { PerguntaNoTopo } from '@/components/perguntas/pergunta-no-topo'
import { Hero, LinhaDoMes, CartaoObjeto, MenuDoCartao, fraseDoExcluir, fraseDoArquivar, SOMBRA, ROT } from '@/components/cartoes/visual'
import { EditarCartao } from '@/components/cartoes/editar-cartao'

const MESES_LABEL = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

type Confirmar = { tipo: 'arquivar' | 'excluir'; k: CartaoNaCarteira } | null

export default function CartoesPage() {
  const params = useParams<{ id: string }>()
  const { toast } = useToast()
  const [c, setC] = useState<Carteira | null>(null)
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [reviewQueue, setReviewQueue] = useState<{ count: number; sum: number; oldestMonth: string | null } | null>(null)
  const [menuDe, setMenuDe] = useState<string | null>(null)
  const [editando, setEditando] = useState<CartaoNaCarteira | null>(null)
  const [confirmar, setConfirmar] = useState<Confirmar>(null)
  const [gravando, setGravando] = useState(false)

  const carregar = useCallback(() => {
    setLoading(true)
    fetch(`/api/empresas/${params.id}/cartoes/carteira`, { credentials: 'include' })
      .then(async (r) => { if (!r.ok) throw new Error((await r.json().catch(() => ({}))).erro ?? 'não consegui ler os cartões'); return r.json() })
      .then((d: Carteira) => { setC(d); setErro(null) })
      .catch((e: Error) => setErro(e.message))
      .finally(() => setLoading(false))
    fetch(`/api/empresas/${params.id}/cartoes/review-queue`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null)).then((q) => setReviewQueue(q)).catch(() => {})
  }, [params.id])
  useEffect(() => { carregar() }, [carregar])

  async function patch(k: CartaoNaCarteira, body: Record<string, unknown>, ok: string) {
    setGravando(true)
    try {
      const r = await fetch(`/api/empresas/${params.id}/cartoes/${k.id}`, { method: 'PATCH', credentials: 'include', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) { toast({ title: 'Não consegui salvar', description: j.erro ?? 'tente de novo', variant: 'destructive' }); return false }
      toast({ title: ok })
      carregar()
      return true
    } finally { setGravando(false) }
  }
  async function reativar(id: string, nome: string) {
    const r = await fetch(`/api/empresas/${params.id}/cartoes/${id}`, { method: 'PATCH', credentials: 'include', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ isActive: true }) })
    if (!r.ok) { toast({ title: 'Não consegui reativar', variant: 'destructive' }); return }
    toast({ title: `${nome} voltou pra página` })
    carregar()
  }
  async function executar() {
    if (!confirmar) return
    const { tipo, k } = confirmar
    setGravando(true)
    try {
      if (tipo === 'arquivar') {
        if (await patch(k, { isActive: false }, `${k.bankName ?? k.name} arquivado`)) setConfirmar(null)
        return
      }
      // ⭐ R23 — a API que já existia: com história some das telas (isActive=false), sem história apaga
      const r = await fetch(`/api/empresas/${params.id}/cartoes/${k.id}`, { method: 'DELETE', credentials: 'include' })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) { toast({ title: 'Não consegui excluir', description: j.erro ?? 'tente de novo', variant: 'destructive' }); return }
      toast({ title: j.softDeleted ? `${k.bankName ?? k.name} saiu das telas — ${j.txCount} lançamentos intactos` : `${k.bankName ?? k.name} apagado` })
      setConfirmar(null)
      carregar()
    } finally { setGravando(false) }
  }

  const alertas = c ? alertasDaCarteira(params.id, c) : []
  const hrefAPagar = c?.hero.aPagar.cartaoId ? `/empresas/${params.id}/cartoes/${c.hero.aPagar.cartaoId}?fatura=${c.hero.aPagar.mes}` : null

  return (
    <div className="min-h-full pb-10" style={{ color: 'var(--esc-tinta)' }} onClick={() => menuDe && setMenuDe(null)}>
      {/* ⛔ S24 — a LARGURA DA ÁREA ÚTIL do app: nenhum max-w próprio; o respiro lateral é o do shell */}
      <div>
        <header className="flex flex-wrap items-center justify-between gap-[14px] pt-3">
          <h1 className="m-0 text-[21px] font-extrabold tracking-[-0.01em]">Cartões de crédito</h1>
          <Link href={`/empresas/${params.id}/cartoes/novo`} className="inline-flex h-10 items-center rounded-[10px] px-4 text-[13px] font-extrabold" style={{ background: 'var(--esc-indigo)', color: 'var(--esc-on)' }}>+ Novo cartão</Link>
        </header>

        {/* ⭐ R51 + lei do topo: o que o sininho avisa, a página mostra AQUI, na âncora onde ele pousa */}
        <div className="mt-4">
          <PerguntaNoTopo id={ANCORAS.CARTAO_VIGIA} titulo="O que pede olho nos cartões" quantas={alertas.length} singular="aviso" plural="avisos">
            <ul className="mt-2 space-y-2">
              {alertas.map((a) => (
                <li key={a.alvo} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                  <span className="min-w-0 flex-1"><b>{a.titulo}</b> — {a.corpo}</span>
                  <Link href={a.acaoHref} className="font-semibold text-amber-900 underline">{a.acaoRotulo} →</Link>
                </li>
              ))}
            </ul>
          </PerguntaNoTopo>
        </div>

        {/* Fila "A CLASSIFICAR" — GRITA (nunca silenciosa). O objetivo é ESVAZIAR. */}
        {reviewQueue && reviewQueue.count > 0 && (
          <div className="mt-4 rounded-[14px] px-4 py-3 text-sm" style={{ background: 'var(--esc-roxo50)', color: 'var(--esc-roxo-t)' }}>
            <strong>{reviewQueue.count} compras de cartão aguardando classificação</strong> ({formatBRL(reviewQueue.sum)})
            {reviewQueue.oldestMonth && (() => {
              const [y, m] = reviewQueue.oldestMonth.split('-')
              return <> — a mais antiga desde <strong>{MESES_LABEL[parseInt(m, 10) - 1]}/{y}</strong></>
            })()}
            . Fora do DRE até você classificar. Abra o cartão pra mover em lote.
          </div>
        )}

        {loading && !c && (
          <div className="flex h-32 items-center justify-center" style={{ color: 'var(--esc-tinta3)' }}>
            <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Carregando…
          </div>
        )}
        {erro && <p className="mt-4 rounded-[12px] px-4 py-3 text-sm font-bold" style={{ background: 'var(--esc-perigo-bg)', color: 'var(--esc-perigo)' }}>{erro}</p>}

        {c && c.cartoes.length === 0 && (
          <div className="mt-6 rounded-[20px] px-6 py-14 text-center" style={{ ...SOMBRA, background: 'var(--esc-card)' }}>
            <p className="text-base font-extrabold">Nenhum cartão cadastrado</p>
            <p className="mt-1 text-sm" style={{ color: 'var(--esc-tinta3)' }}>Cadastre o 1º cartão pra importar a fatura PDF e categorizar as compras.</p>
            <Link href={`/empresas/${params.id}/cartoes/novo`} className="mt-4 inline-flex h-10 items-center rounded-[10px] px-4 text-[13px] font-extrabold" style={{ background: 'var(--esc-indigo)', color: 'var(--esc-on)' }}>Cadastrar cartão</Link>
          </div>
        )}

        {c && c.cartoes.length > 0 && (
          <>
            <Hero carteira={c} hrefAPagar={hrefAPagar} />
            <LinhaDoMes carteira={c} />
            <div id="cartoes" className="mt-[14px] grid grid-cols-1 gap-[14px] lg:grid-cols-2 2xl:grid-cols-3">
              {c.cartoes.map((k) => (
                <CartaoObjeto
                  key={k.id}
                  k={k}
                  hoje={c.hoje}
                  hrefFatura={`/empresas/${params.id}/cartoes/${k.id}`}
                  onMenu={() => setMenuDe(menuDe === k.id ? null : k.id)}
                  onArquivar={() => setConfirmar({ tipo: 'arquivar', k })}
                  menu={menuDe === k.id ? (
                    <div onClick={(e) => e.stopPropagation()}>
                      <MenuDoCartao
                        onEditar={() => { setMenuDe(null); setEditando(k) }}
                        onArquivar={() => { setMenuDe(null); setConfirmar({ tipo: 'arquivar', k }) }}
                        onExcluir={() => { setMenuDe(null); setConfirmar({ tipo: 'excluir', k }) }}
                      />
                    </div>
                  ) : null}
                />
              ))}
            </div>
          </>
        )}

        {c && c.arquivados.length > 0 && (
          <div className="mt-6 rounded-[16px] px-4 py-3" style={{ background: 'var(--esc-card)', ...SOMBRA }}>
            <div className={ROT} style={{ color: 'var(--esc-tinta3)' }}>Arquivados · {c.arquivados.length}</div>
            <ul className="mt-1">
              {c.arquivados.map((a) => (
                <li key={a.id} className="flex items-center gap-3 py-1.5 text-[12.5px] font-bold">
                  <span className="min-w-0 flex-1 truncate">{a.bankName ?? a.name}{a.lastDigits ? ` · •••• ${a.lastDigits}` : ''}</span>
                  <button type="button" className="font-extrabold" style={{ color: 'var(--esc-indigo)' }} onClick={() => reativar(a.id, a.bankName ?? a.name)}>reativar</button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {confirmar && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center" onClick={() => !gravando && setConfirmar(null)}>
          <div data-testid="confirmar-cartao" className="w-full max-w-[420px] rounded-[18px] p-5" style={{ background: 'var(--esc-card)', ...SOMBRA }} onClick={(e) => e.stopPropagation()}>
            <p className="text-[14px] font-bold leading-relaxed">{confirmar.tipo === 'excluir' ? fraseDoExcluir(confirmar.k) : fraseDoArquivar(confirmar.k)}</p>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" disabled={gravando} onClick={() => setConfirmar(null)} className="h-9 rounded-[10px] px-4 text-[13px] font-extrabold" style={{ background: 'var(--esc-trilho)', color: 'var(--esc-tinta2)' }}>Cancelar</button>
              <button type="button" disabled={gravando} onClick={executar} className="h-9 rounded-[10px] px-4 text-[13px] font-extrabold"
                style={{ background: confirmar.tipo === 'excluir' ? 'var(--esc-perigo)' : 'var(--esc-indigo)', color: 'var(--esc-on)' }}>
                {gravando ? '…' : confirmar.tipo === 'excluir' ? 'Excluir' : 'Arquivar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {editando && (
        <EditarCartao
          k={editando}
          gravando={gravando}
          onFechar={() => setEditando(null)}
          onSalvar={async (body) => { if (await patch(editando, body, 'Cartão salvo')) setEditando(null) }}
        />
      )}
    </div>
  )
}
