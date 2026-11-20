'use client'
// ⭐⭐⭐ LEI DA PERGUNTA NO TOPO (19/11/2026) — VALE PRO SISTEMA TODO.
//
// ⛔ O CASO: a trava de sanidade perguntou "FRUKI LATA: 81 num dia — o normal é 1.7. Confirma?" e a
// pergunta morava no RODAPÉ do modal de confirmar a baixa, depois da lista inteira do que sai do
// estoque — o dono ficou procurando até achar. *Pergunta escondida é pergunta que não existe.*
//
// ⭐ A REGRA: toda pergunta pendente que espera decisão do dono (sanidade do dia, pares parecidos,
// conflito de grafia, e qualquer futura) é um CARTÃO DESTACADO NO TOPO da tela/modal dona dela —
// nunca no meio ou no fim da lista. Mais de uma → contador ("2 pares esperando tua decisão").
// ⚠️ PORTA ÚNICA: a pergunta nasce AQUI, e o guard (`__tests__/regras-ui/pergunta-no-topo.test.tsx`)
// procura `data-pergunta-do-sistema` no markup. O `id` é a âncora onde o sininho pousa (`#id`).
import { useEffect, useRef, type ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'

/** "1 par esperando tua decisão" · "2 pares esperando tua decisão" — o contador da lei */
export function contadorDaPergunta(n: number, singular: string, plural: string): string {
  return `${n} ${n === 1 ? singular : plural} esperando tua decisão`
}

/**
 * ⭐ o POUSO do sininho: a tela desenha a pergunta DEPOIS do fetch, então a âncora nativa do
 * navegador já passou quando ela nasce. Quando o `#id` da URL é o desta pergunta, rola até ela.
 */
export function usePousoDaPergunta(id: string, pronta: boolean) {
  const feito = useRef(false)
  useEffect(() => {
    if (!pronta || feito.current || typeof window === 'undefined') return
    if (window.location.hash !== `#${id}`) return
    feito.current = true
    document.getElementById(id)?.scrollIntoView({ block: 'start', behavior: 'smooth' })
  }, [id, pronta])
}

export function PerguntaNoTopo({
  id, titulo, quantas, singular, plural, children,
}: {
  /** a âncora onde o aviso do sininho pousa */
  id: string
  titulo: string
  /** quantas perguntas o cartão carrega — acima de 1, o contador aparece */
  quantas: number
  singular: string
  plural: string
  children: ReactNode
}) {
  usePousoDaPergunta(id, quantas > 0)
  if (quantas <= 0) return null
  return (
    <section
      id={id}
      data-pergunta-do-sistema={id}
      role="alert"
      className="scroll-mt-24 rounded-xl border-2 border-amber-400 bg-amber-50 p-3 text-amber-950 shadow-sm"
    >
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
        <p className="text-sm font-semibold">{titulo}</p>
        {quantas > 1 && (
          <span data-testid="contador-da-pergunta" className="rounded-full bg-amber-500 px-2 py-0.5 text-[11px] font-bold text-white">
            {contadorDaPergunta(quantas, singular, plural)}
          </span>
        )}
      </div>
      <div className="mt-2">{children}</div>
    </section>
  )
}
