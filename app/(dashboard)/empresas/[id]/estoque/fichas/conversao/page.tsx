'use client'

/**
 * ⛔⛔⛔ ROTA LEGADA — A TELA "CORRIGIR O LOTE" FOI APOSENTADA EM 11/10/2026 (item 4 do dono).
 *
 * **Ordem do dono:** *"zerada por 1+2, a tela «Corrigir o lote» é aposentada (rota vira
 * redirect/registro); o aviso antigo aponta pro novo caminho enquanto houver pendente."*
 *
 * ═══ ⭐⭐ O QUE SUBSTITUIU, item por item (remoção sem realocação é perda — 10/09) ═══
 *
 * - **as NEUTRAS** (36 das 37 medidas em prod) não têm mais fila: a **auto-conversão** corrige o
 *   rótulo sozinha, com a prova de que a separação não se move, e avisa no sininho.
 * - **as PENDENTES** (o número é do dono) viraram **chip na LINHA** da lista de receitas de
 *   produção + **aviso no sininho**, os dois abrindo a ficha com o campo aceso (`?foco=rendimento`).
 * - **a FERRAMENTA de rever o rendimento** mudou de casa pro **editor da ficha**, onde o campo
 *   mora e onde o preview *"separa hoje × separa depois"* mostra o efeito ANTES de salvar.
 *
 * ⛔ **E A ROTA NÃO FOI DELETADA**: link velho em print, no histórico do navegador ou colado num
 * aviso antigo não pode virar 404 silencioso (a régua dos redirects de 15/09). Com `?ficha=`
 * ela leva **direto à ficha daquela receita, com o campo aceso** — o destino que o link antigo
 * de fato queria; sem o parâmetro, à lista de receitas, que é a fila agora.
 */

import { use, useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function ConversaoLegadaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()

  useEffect(() => {
    const qp = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null
    const ficha = qp?.get('ficha')
    // ⚠️ `replace`, nunca `push`: a tela aposentada não merece uma entrada no histórico — o
    // "voltar" do dono tem que devolver pra onde ele estava antes, não pra este redirect.
    router.replace(ficha
      ? `/empresas/${id}/estoque/fichas/${ficha}?foco=rendimento&voltar=${encodeURIComponent(`/empresas/${id}/estoque/producao/receitas`)}`
      : `/empresas/${id}/estoque/producao/receitas`)
  }, [id, router])

  return (
    <div className="mx-auto max-w-xl p-6">
      <p className="text-sm text-slate-500">
        A fila de correção do lote foi aposentada — o rendimento agora se declara na própria ficha.
        Levando você pra lá…
      </p>
    </div>
  )
}
