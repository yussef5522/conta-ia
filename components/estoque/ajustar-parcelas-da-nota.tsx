'use client'

// ⭐ AJUSTAR PARCELAS DE UMA NOTA — a casca que sabe CARREGAR e GRAVAR o combinado.
//
// ⚠️ POR QUE ISTO EXISTE (30/08/2026): a tela `/estoque/contas-a-pagar` tinha um bloco
// "Já no Contas a Pagar" que era, na prática, uma SEGUNDA lista de dívida — e dívida mora
// num lugar só (o Contas a Pagar do financeiro). O bloco saiu. Mas RENEGOCIAR não é
// listar dívida: é mexer no combinado da NOTA. Então o gesto mudou de casa em vez de
// morrer — agora abre a partir da própria nota, em Recebimentos → Recebidas.
//
// ⚠️ Ele carrega TUDO sozinho (`GET .../notas/[nfeId]/parcelas` devolve o XML, o combinado
// de hoje e o que já virou conta a pagar). Quem chama só precisa do `nfeId` — assim
// qualquer tela que tenha uma nota na mão pode oferecer o ajuste sem repetir o fetch,
// sem repetir o mapeamento e sem chance de as duas divergirem (REGRA 4).

import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { EditorParcelas, type ParcelaEditavel } from './editor-parcelas'

interface Carregado {
  nota: { id: string; total: number }
  xml: Array<{ numero: string; valor: number; dVenc: string | null }>
  combinado: Array<{ numero: string; valor: number; dVenc: string; origem: string }>
  motivo: string | null
  enviadas: Array<{ numero: string; existe: boolean; intocavel: boolean }>
}

interface Props {
  empresaId: string
  nfeId: string
  onFechar: () => void
  /** chamado depois de gravar — pra a tela de trás recarregar */
  onSalvo?: () => void
}

export function AjustarParcelasDaNota({ empresaId, nfeId, onFechar, onSalvo }: Props) {
  const [dados, setDados] = useState<Carregado | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    let vivo = true
    fetch(`/api/empresas/${empresaId}/estoque/notas/${nfeId}/parcelas`)
      .then(async (r) => ({ ok: r.ok, j: await r.json().catch(() => null) }))
      .then(({ ok, j }) => {
        if (!vivo) return
        if (!ok) { setErro(j?.erro ?? 'Não consegui abrir as parcelas desta nota.'); return }
        setDados(j as Carregado)
      })
      .catch(() => { if (vivo) setErro('Falha de conexão.') })
    return () => { vivo = false }
  }, [empresaId, nfeId])

  // ⚠️ enquanto carrega, um véu com spinner — abrir o editor VAZIO e preencher depois
  // faria as linhas pularem na cara de quem está digitando.
  if (!dados) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onFechar}>
        <div className="rounded-xl bg-white px-5 py-4 text-sm text-slate-600 shadow-xl" onClick={(e) => e.stopPropagation()}>
          {erro
            ? <span className="text-rose-600">{erro}</span>
            : <span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> abrindo as parcelas…</span>}
        </div>
      </div>
    )
  }

  return (
    <>
      <EditorParcelas
        aberto
        onFechar={onFechar}
        xml={dados.xml}
        totalNota={dados.nota.total}
        inicial={dados.combinado.map((p) => ({ valor: String(p.valor).replace('.', ','), dVenc: p.dVenc.slice(0, 10) }))}
        motivoInicial={dados.motivo}
        contasQueSeraoCanceladas={dados.enviadas.filter((x) => x.existe && !x.intocavel).length}
        salvando={salvando}
        onSalvar={async (parcelas: ParcelaEditavel[], motivo: string | null) => {
          setSalvando(true)
          setErro(null)
          try {
            const res = await fetch(`/api/empresas/${empresaId}/estoque/notas/${nfeId}/parcelas`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                parcelas: parcelas.map((x) => ({ valor: Number(x.valor.replace(/\./g, '').replace(',', '.')), dVenc: x.dVenc })),
                motivo,
              }),
            })
            const j = await res.json().catch(() => null)
            // ⛔ 422 aqui é a recusa de reescrever conta PAGA/CONCILIADA — a mensagem
            // nomeia qual. Nunca engolir: dinheiro que já saiu não se reescreve.
            if (!res.ok) { setErro(j?.erro ?? 'Não foi possível salvar as parcelas.'); return }
            onSalvo?.()
            onFechar()
          } catch {
            setErro('Falha de conexão.')
          } finally { setSalvando(false) }
        }}
      />
      {erro && (
        <div className="fixed inset-x-0 bottom-4 z-[60] mx-auto w-fit rounded-lg bg-rose-600 px-4 py-2 text-sm text-white shadow-lg">{erro}</div>
      )}
    </>
  )
}
