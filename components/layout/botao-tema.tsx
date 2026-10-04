'use client'

import { useEffect, useState } from 'react'
import { Moon, Sun } from 'lucide-react'
import { alternar, caraDoBotao, classeDoTema, type Tema } from '@/lib/tema/preferencia'

/**
 * ⭐⭐ O QUADRADINHO 🌙/☀️ DO TOPO GLOBAL (04/10/2026).
 *
 * **Pedido do dono:** *"quadradinho no topo global, entre o sininho e a ação primária da tela;
 * no claro mostra lua, no escuro sol; **troca instantânea sem reload**; escolha salva em tabela
 * por usuário."*
 *
 * ⛔⛔ **A TROCA É LOCAL E A GRAVAÇÃO VEM DEPOIS — nesta ordem, de propósito.** A classe no
 * `<html>` muda no mesmo frame do toque; o PUT viaja atrás. Esperar o servidor pra pintar faria
 * um botão de tema com meio segundo de atraso parecer quebrado. ⚠️ **E se o PUT falhar, a cor
 * VOLTA** com o motivo na tela: tema que fica trocado e não gravou é o *"salvo que mentia"* —
 * o dono volta amanhã no tema velho sem entender por quê.
 */

/** ⭐ o ÚNICO lugar que toca a classe do `<html>` — e ele ANUNCIA, pra as duas instâncias do
 *  botão (desktop e celular) nunca divergirem sobre qual tema está no ar */
function aplicarTema(tema: Tema) {
  const html = document.documentElement
  if (classeDoTema(tema) === 'dark') html.classList.add('dark')
  else html.classList.remove('dark')
  window.dispatchEvent(new CustomEvent<Tema>('tema:mudou', { detail: tema }))
}

export function BotaoTema({ temaInicial }: { temaInicial: Tema }) {
  const [tema, setTema] = useState<Tema>(temaInicial)
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)

  /**
   * ⚠️⚠️ O TOPO É DESENHADO DUAS VEZES (barra do desktop + header do celular, um escondido por
   * CSS). Sem este ouvinte, trocar o tema no desktop deixaria o botão do celular com o ícone
   * ERRADO — invisível hoje, visível no instante em que a janela for redimensionada.
   */
  useEffect(() => {
    const ouvir = (e: Event) => setTema((e as CustomEvent<Tema>).detail)
    window.addEventListener('tema:mudou', ouvir)
    return () => window.removeEventListener('tema:mudou', ouvir)
  }, [])

  async function trocar() {
    const alvo = alternar(tema)
    const anterior = tema
    setErro(null)
    setSalvando(true)
    aplicarTema(alvo)           // ⭐ pinta agora
    setTema(alvo)
    try {
      const res = await fetch('/api/tema', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ tema: alvo }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error((j as { erro?: string }).erro ?? 'não consegui guardar a escolha')
      }
    } catch (e) {
      // ⛔ VOLTA a cor: melhor o dono ver o tema velho com o motivo escrito que ficar com um
      //    tema que o banco não conhece e que sumiria no próximo login.
      aplicarTema(anterior)
      setTema(anterior)
      setErro(e instanceof Error ? e.message : 'não consegui guardar a escolha')
    } finally {
      setSalvando(false)
    }
  }

  const cara = caraDoBotao(tema)

  return (
    <div className="relative">
      <button
        type="button"
        onClick={trocar}
        disabled={salvando}
        title={cara.titulo}
        aria-label={cara.titulo}
        className="flex h-9 w-9 items-center justify-center rounded-lg border transition-colors disabled:opacity-60"
        style={{
          borderColor: 'var(--prod-line)',
          background: 'var(--prod-surface)',
          color: 'var(--prod-secondary)',
        }}
      >
        {cara.icone === 'sol' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      </button>
      {/* ⚠️ a falha aparece ANCORADA NO BOTÃO, não num toast que some: o dono precisa saber que
          a cor voltou e por quê — mensagem que desaparece sozinha não carrega decisão (15/09). */}
      {erro && (
        <p
          className="absolute right-0 top-full z-50 mt-1 w-56 rounded-md border px-2 py-1 text-[11px] shadow-sm"
          style={{
            borderColor: 'var(--fam-coral-mid)',
            background: 'var(--fam-coral-bg)',
            color: 'var(--fam-coral-ink)',
          }}
        >
          {erro}
        </p>
      )}
    </div>
  )
}
