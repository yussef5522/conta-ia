'use client'

import { useEffect, useState } from 'react'
import { alternarTrilho, caraDoRecolher, classeDoTrilho, type Trilho } from '@/lib/trilho/preferencia'

/**
 * ⭐⭐ O «» QUE FIXA O TRILHO ABERTO (14/10/2026).
 *
 * **Ordem do dono:** *"o botão «» FIXA aberto"* + *"a escolha fica SALVA POR USUÁRIO"*.
 *
 * ⛔⛔ **ELE NÃO CONTROLA A LARGURA — ele controla a CLASSE.** Quem abre e fecha é o CSS
 * (`.trilho.rec` / `.trilho.rec:hover`); este botão só liga e desliga o `rec`. Guardar a largura
 * num `useState` e aplicá-la por `style` pareceria igual e mataria o hover de graça: `:hover`
 * não tem como vencer um inline style, e o *"parou o mouse em cima → cresce"* — que é o pedido
 * central — deixaria de funcionar sem nada quebrar.
 *
 * ⛔ **A TROCA É LOCAL E A GRAVAÇÃO VEM DEPOIS**, na ordem do `BotaoTema`: a classe muda no mesmo
 * frame do clique e o PUT viaja atrás. ⚠️ **E se o PUT falhar, a largura VOLTA** com o motivo na
 * tela: menu que fica aberto e não gravou é o *"salvo que mentia"* — o dono volta amanhã no
 * estado velho sem entender por quê.
 */

/**
 * ⭐ O ÚNICO lugar que toca a classe do trilho — e ele ANUNCIA, porque o trilho é desenhado DUAS
 * vezes (a barra do desktop e a gaveta do celular, uma escondida por CSS). Sem o anúncio, fixar
 * aberto no desktop deixaria o «» da gaveta com a seta girada pro lado ERRADO: invisível hoje,
 * visível no instante em que a janela for redimensionada. É a mesma cura do `tema:mudou`.
 */
function aplicarTrilho(trilho: Trilho) {
  for (const el of document.querySelectorAll('.trilho')) {
    /** ⚠️ a gaveta é sempre aberta (não há `:hover` no toque) — ela ignora a classe, não o evento */
    if (el.classList.contains('gaveta')) continue
    if (classeDoTrilho(trilho) === 'rec') el.classList.add('rec')
    else el.classList.remove('rec')
  }
  window.dispatchEvent(new CustomEvent<Trilho>('trilho:mudou', { detail: trilho }))
}

export function BotaoRecolher({ trilhoInicial }: { trilhoInicial: Trilho }) {
  const [trilho, setTrilho] = useState<Trilho>(trilhoInicial)
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    const ouvir = (e: Event) => setTrilho((e as CustomEvent<Trilho>).detail)
    window.addEventListener('trilho:mudou', ouvir)
    return () => window.removeEventListener('trilho:mudou', ouvir)
  }, [])

  async function trocar() {
    const alvo = alternarTrilho(trilho)
    const anterior = trilho
    setErro(null)
    setSalvando(true)
    aplicarTrilho(alvo) // ⭐ muda agora
    setTrilho(alvo)
    try {
      const res = await fetch('/api/trilho', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ trilho: alvo }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error((j as { erro?: string }).erro ?? 'não consegui guardar a escolha')
      }
    } catch (e) {
      // ⛔ VOLTA a largura: melhor o dono ver o menu como estava, com o motivo escrito, que
      //    ficar com um estado que o banco não conhece e que sumiria no próximo login.
      aplicarTrilho(anterior)
      setTrilho(anterior)
      setErro(e instanceof Error ? e.message : 'não consegui guardar a escolha')
    } finally {
      setSalvando(false)
    }
  }

  const cara = caraDoRecolher(trilho)

  return (
    <>
      <button
        type="button"
        onClick={trocar}
        disabled={salvando}
        title={cara.titulo}
        aria-label={cara.titulo}
        aria-expanded={trilho === 'aberto'}
        className="recolhe disabled:opacity-60"
      >
        {/* ⚠️ o `«` gira 180° pelo CSS quando o trilho está recolhido (vira `»`) — um ícone, dois
            sentidos, e a rotação é o que anuncia pra onde o toque leva */}
        <svg
          viewBox="0 0 24 24"
          width="15"
          height="15"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M11 17l-5-5 5-5M18 17l-5-5 5-5" />
        </svg>
      </button>
      {/* ⚠️ a falha aparece DENTRO do trilho, não num toast que some: o dono precisa saber que a
          largura voltou e por quê — mensagem que desaparece sozinha não carrega decisão (15/09).
          ⭐ E ela usa `.rotulo`, então no recolhido ela fica escondida junto dos nomes: um texto
          de 2 linhas num trilho de 64px estouraria a coluna. */}
      {erro && (
        <p
          className="rotulo mb-2 rounded-md px-2 py-1 text-[10.5px] leading-snug"
          style={{
            background: 'var(--fam-coral-bg)',
            color: 'var(--fam-coral-ink)',
          }}
        >
          {erro}
        </p>
      )}
    </>
  )
}
