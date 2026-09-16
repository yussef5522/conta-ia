'use client'

// ⭐⭐ O GESTO DE EXCLUIR RECEITA — um componente, as duas telas (16/09/2026).
//
// **A régua do dono:** botão *"excluir receita"* **à vista, vermelho discreto, celular e
// desktop (REGRA 12; nada de só-hover)** — na lista e na tela de editar.
//
// ⛔⛔ **A TELA SÓ PERGUNTA.** Quem decide entre APAGAR e DESATIVAR é o servidor: a prévia
// vem dele (`OPTIONS`) e o gesto re-avalia dentro da transação. Uma tela que decidisse
// mandaria o `DELETE` de uma receita com 40 lotes.
//
// ⚠️ **SEM digitar o nome pra confirmar** — decisão do dono: *"exagero pra cozinha"*. O
// que segura é a frase dizendo **o efeito**, não a cerimônia.

import { useState } from 'react'
import { Trash2, Loader2 } from 'lucide-react'

interface Previsao {
  caso: 'EXCLUI' | 'DESATIVA'
  nome: string
  lotes: number
  frase: string
}

export function ExcluirReceita({ empresaId, fichaId, aoConcluir, compacto }: {
  empresaId: string
  fichaId: string
  /** ⭐ a tela decide o que fazer depois (recarregar a lista, voltar da edição) */
  aoConcluir: (r: { caso: string; nome: string; efeito: string }) => void
  /** versão de ícone só, pra caber no card da lista */
  compacto?: boolean
}) {
  const [previa, setPrevia] = useState<Previsao | null>(null)
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const base = `/api/empresas/${empresaId}/estoque/fichas/${fichaId}`

  async function perguntar() {
    setCarregando(true); setErro(null)
    try {
      // ⭐ a prévia é do SERVIDOR — a tela não calcula o caso
      const r = await fetch(base, { method: 'OPTIONS' })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) { setErro(j?.erro ?? 'Não consegui ver o que vai acontecer com esta receita.'); return }
      setPrevia(j)
    } catch {
      setErro('A rede falhou — tente de novo.')
    } finally { setCarregando(false) }
  }

  async function confirmar() {
    if (!previa) return
    setCarregando(true); setErro(null)
    try {
      // ⚠️ manda o que a tela PROMETEU: se o servidor decidir diferente, ele avisa
      const r = await fetch(`${base}?prometido=${previa.caso}`, { method: 'DELETE' })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) { setErro(j?.erro ?? 'O sistema falhou e não devolveu o motivo — isso é defeito nosso.'); return }
      setPrevia(null)
      aoConcluir(j)
    } catch {
      setErro('A rede falhou ao excluir — nada mudou; tente de novo.')
    } finally { setCarregando(false) }
  }

  return (
    <>
      {/*
        ⭐ O BOTÃO É VISÍVEL SEMPRE — borda e cor, não `hover:`.
        ⛔ *"Ação escondida sem afordância não existe, principalmente no celular"* (30/08),
        e foi exatamente isso que fez o "revisar" do import sumir pro dono em 14/09.
      */}
      <button type="button" onClick={perguntar} disabled={carregando}
        title="excluir esta receita"
        className={`inline-flex items-center gap-1.5 rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50 disabled:opacity-50 ${
          compacto ? 'h-8 px-2.5 text-xs' : 'h-9 px-3 text-sm'
        }`}>
        {carregando && !previa ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
        {compacto ? '' : 'excluir receita'}
      </button>

      {erro && !previa && (
        <p className="mt-1 rounded-md bg-rose-50 px-2 py-1 text-[11px] text-rose-700">{erro}</p>
      )}

      {previa && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
          onClick={() => !carregando && setPrevia(null)}>
          {/* ⚠️ no celular o card sobe de baixo (polegar); no desktop centraliza — REGRA 12 */}
          <div onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-t-2xl bg-white p-4 sm:rounded-2xl">
            <h3 className="text-[15px] font-bold text-slate-900">
              {previa.caso === 'EXCLUI' ? 'Excluir a receita?' : 'Desativar a receita?'}
            </h3>

            {/* ⛔⛔ A FRASE DIZ O EFEITO — nunca um "tem certeza?" seco */}
            <p className="mt-1.5 text-[13px] leading-relaxed text-slate-600">{previa.frase}</p>

            {previa.caso === 'DESATIVA' && (
              <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-[12px] text-slate-500">
                Ela sai do planejar e do produzir. Os lotes antigos continuam no histórico,
                com o nome e a versão que foi usada — o passado não se reescreve.
              </p>
            )}

            {erro && <p className="mt-2 rounded-md bg-rose-50 px-2 py-1 text-[12px] text-rose-700">{erro}</p>}

            <div className="mt-4 flex gap-2">
              <button type="button" onClick={() => setPrevia(null)} disabled={carregando}
                className="h-10 flex-1 rounded-xl border border-slate-300 text-sm font-medium text-slate-600">
                cancelar
              </button>
              <button type="button" onClick={confirmar} disabled={carregando}
                className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-rose-600 text-sm font-bold text-white disabled:opacity-50">
                {carregando ? <Loader2 className="h-4 w-4 animate-spin" />
                  : previa.caso === 'EXCLUI' ? 'Excluir de vez' : 'Desativar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
