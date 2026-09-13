'use client'

// ⭐⭐ "DEFINIR PARCELAS E VENCIMENTOS" — o gesto que tira a nota do limbo (13/09/2026).
//
// **O caso do dono:** 21 notas · R$ 8.588,75 entraram só como estoque porque a conferência
// não tinha onde pôr vencimento. Elas viraram dívida invisível — e a linha da stone de
// 2.843,35 da MARIA LUIZA não fechava por causa de 4 delas.
//
// ⚠️⚠️ **REUSA O `EditorParcelas`, não nasce um segundo.** É o MESMO editor do "ajustar
// parcelas (renegociou?)" — o gesto é irmão (digitar valor + vencimento, ver a soma fechar
// com a nota), só muda PRA ONDE grava. Um segundo editor divergiria na primeira régua nova,
// que é a doença que este módulo mais paga.

import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { EditorParcelas, type ParcelaEditavel } from './editor-parcelas'

interface Props {
  empresaId: string
  nfeId: string
  /** o total da nota (o editor precisa dele pra conferir a soma) */
  totalNota: number
  onFechar: () => void
  /** chamado depois de gravar — a tela de trás recarrega e o estado vira ABERTA */
  onSalvo?: () => void
}

export function DefinirParcelasDaNota({ empresaId, nfeId, totalNota, onFechar, onSalvo }: Props) {
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [pronto, setPronto] = useState(false)

  // ⚠️ confere no SERVIDOR que a nota ainda está A DEFINIR antes de abrir: se ela foi
  // resolvida noutra aba, o editor abriria oferecendo um gesto que a rota vai recusar.
  useEffect(() => {
    let vivo = true
    fetch(`/api/empresas/${empresaId}/estoque/notas/${nfeId}/definir-parcelas`)
      .then(async (r) => ({ ok: r.ok, j: await r.json().catch(() => null) }))
      .then(({ ok, j }) => {
        if (!vivo) return
        if (!ok) { setErro(j?.erro ?? 'Não consegui abrir esta nota.'); return }
        if (!j?.aDefinir) { setErro('Esta nota já tem parcelas definidas — use "Ajustar parcelas".'); return }
        setPronto(true)
      })
      .catch(() => { if (vivo) setErro('Falha de conexão.') })
    return () => { vivo = false }
  }, [empresaId, nfeId])

  if (!pronto) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onFechar}>
        <div className="rounded-xl bg-white px-5 py-4 text-sm text-slate-600 shadow-xl" onClick={(e) => e.stopPropagation()}>
          {erro
            ? <span className="text-rose-600">{erro}</span>
            : <span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> abrindo…</span>}
        </div>
      </div>
    )
  }

  return (
    <>
      <EditorParcelas
        aberto
        onFechar={onFechar}
        // ⭐ a nota NÃO tem duplicata (é a definição deste estado) — o bloco "a nota diz"
        // fica vazio de propósito, e é justamente isso que o dono precisa ver: o boleto
        // está na mão dele, não no XML.
        xml={[]}
        totalNota={totalNota}
        inicial={[{ valor: totalNota.toFixed(2).replace('.', ','), dVenc: '' }]}
        contasQueSeraoCanceladas={0}
        salvando={salvando}
        onSalvar={async (parcelas: ParcelaEditavel[], motivo: string | null) => {
          setSalvando(true)
          setErro(null)
          try {
            const r = await fetch(`/api/empresas/${empresaId}/estoque/notas/${nfeId}/definir-parcelas`, {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({
                confirmar: true,
                motivo,
                cadastrarFornecedores: true,
                parcelas: parcelas.map((p) => ({
                  valor: Number(String(p.valor).replace(/\./g, '').replace(',', '.')),
                  dVenc: p.dVenc,
                })),
              }),
            })
            const j = await r.json().catch(() => null)
            // ⛔ falha NUNCA em silêncio: a recusa do servidor vira texto na cara do dono
            if (!r.ok) { setErro(j?.erro ?? 'Não consegui gravar.'); return }
            onSalvo?.()
            onFechar()
          } catch {
            setErro('Falha de conexão.')
          } finally {
            setSalvando(false)
          }
        }}
      />
      {erro && (
        <div className="fixed bottom-4 left-1/2 z-[60] -translate-x-1/2 rounded-lg bg-rose-600 px-4 py-2 text-sm text-white shadow-lg">
          {erro}
        </div>
      )}
    </>
  )
}
