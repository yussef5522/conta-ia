'use client'

// UI — CAMADA DISPENSÁVEL (28/08). Todo dropdown/painel flutuante fecha do MESMO jeito.
//
// ⚠️ O BUG QUE PEDIU ISTO: a busca de ingredientes do modal da receita abria a lista e **não
// tinha como sair sem escolher** — clicar fora não fechava, ESC não fechava, e a lista ficava
// pendurada na tela. O dono desiste de escolher e fica preso; no celular, pior ainda.
//
// ⭐ Não existia NENHUM utilitário de clique-fora no projeto: cada dropdown novo ia
// reinventar (ou esquecer, como este esqueceu). Vira UM lugar (REGRA 4/5) — dropdown novo
// chama o hook e nasce dispensável, em vez de depender de alguém lembrar.
//
// ⚠️ `mousedown`/`touchstart`, NÃO `click`: com `click` o alvo de fora pode re-renderizar
// entre o press e o release e o evento se perde — o padrão de mercado é fechar já no press.

import { useEffect, useRef } from 'react'

/** PURA — a tecla fecha? (Escape; `Esc` é o nome legado do IE/Edge antigo) */
export function ehTeclaDeFechar(key: string): boolean {
  return key === 'Escape' || key === 'Esc'
}

/**
 * PURA — o toque/clique foi FORA do painel?
 * Duck-typed de propósito: recebe qualquer coisa com `contains`, então dá pra provar a
 * decisão em ambiente node (o projeto não tem jsdom) sem mockar o DOM inteiro.
 * ⚠️ Sem container (ainda não montou) → NÃO fecha: fechar por ausência de referência
 * derrubaria o painel no primeiro render.
 */
export function cliqueFoiFora(
  container: { contains(alvo: unknown): boolean } | null | undefined,
  alvo: unknown,
): boolean {
  if (!container) return false
  if (alvo == null) return false
  return !container.contains(alvo)
}

/**
 * Liga clique-fora + ESC enquanto `aberto`. Devolve o ref pra pendurar no painel.
 *
 *   const ref = useDismissivel(aberto, () => setAberto(false))
 *   <div ref={ref}> …dropdown… </div>
 */
export function useDismissivel<T extends HTMLElement = HTMLDivElement>(
  aberto: boolean,
  aoFechar: () => void,
) {
  const ref = useRef<T>(null)
  // guarda o callback num ref pra o efeito não re-assinar a cada render do pai
  const fechar = useRef(aoFechar)
  fechar.current = aoFechar

  useEffect(() => {
    if (!aberto) return

    const porFora = (e: MouseEvent | TouchEvent) => {
      if (cliqueFoiFora(ref.current, e.target)) fechar.current()
    }
    const porTecla = (e: KeyboardEvent) => {
      if (ehTeclaDeFechar(e.key)) fechar.current()
    }

    // ⚠️ `touchstart` é o que faz funcionar no CELULAR, que é onde o dono monta as fichas.
    document.addEventListener('mousedown', porFora)
    document.addEventListener('touchstart', porFora, { passive: true })
    document.addEventListener('keydown', porTecla)
    return () => {
      document.removeEventListener('mousedown', porFora)
      document.removeEventListener('touchstart', porFora)
      document.removeEventListener('keydown', porTecla)
    }
  }, [aberto])

  return ref
}

/**
 * Só o ESC — pra painel que já fecha no backdrop (modal/sheet), onde clique-fora seria
 * redundante. Ex.: o sheet "Que produto é este?" da conferência fechava no fundo e no X,
 * mas ESC não fazia nada; num fluxo de teclado isso trava o dono no meio da nota.
 */
export function useEscape(ativo: boolean, aoFechar: () => void) {
  const fechar = useRef(aoFechar)
  fechar.current = aoFechar
  useEffect(() => {
    if (!ativo) return
    const h = (e: KeyboardEvent) => { if (ehTeclaDeFechar(e.key)) fechar.current() }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [ativo])
}
