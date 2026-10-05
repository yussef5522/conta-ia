/**
 * ⭐⭐ O LOGO DA RECEITA — o quadradinho colorido, com DONO ÚNICO (05/10/2026).
 *
 * **Ordem do dono (página da ordem, v4):** *"logo da receita (o quadradinho 48px do mapa v4,
 * **mesma família/ícone da lista**)"*.
 *
 * ⛔⛔ **É ESSE "MESMA" QUE OBRIGA O COMPONENTE A SAIR DA HOME.** Ele nasceu dentro de
 * `producao/page.tsx` como `IconeDaFicha`; copiá-lo pra página da ordem daria duas traduções
 * de `nome → (ícone, cor)` — e elas divergiriam no 1º grupo novo do mapa, fazendo a MESMA
 * receita aparecer com caras diferentes em duas telas. O reconhecimento (a razão de ele
 * existir) morre justamente aí.
 *
 * ⭐ A decisão de QUAL cara continua na lib PURA (`cara-da-receita`, 13 grupos nascidos das 44
 * receitas reais); aqui só se traduz o nome do ícone em componente e se desenha.
 */
import { Beef, Carrot, Drumstick, Egg, Factory, Flame, Ham, Milk, Pizza, Scissors, Slice, UtensilsCrossed, Droplet } from 'lucide-react'

import { caraDaReceita, type IconeDaReceita } from '@/lib/stock/producao/cara-da-receita'

/** ⚠️ nome → componente: a lib é PURA e devolve o NOME do ícone, nunca JSX */
const ICONES: Record<IconeDaReceita, typeof Beef> = {
  queijo: Milk, carne: Beef, bacon: Slice, calabresa: Ham, frango: Drumstick, frito: Flame,
  massa: Pizza, molho: Droplet, ovo: Egg, legume: Carrot, preparo: Scissors,
  porcao: UtensilsCrossed, generico: Factory,
}

/** ⭐ a família de cor em 3 degraus, pelos tokens da casa (invertem no tema escuro) */
const fam = (f: string) => ({ bg: `var(--fam-${f}-bg)`, mid: `var(--fam-${f}-mid)` })

/**
 * ⭐ Os três tamanhos da casa: **32** onde o logo é um marcador ao lado de texto, **38** na
 * lista de concluídas e **48** no cabeçalho da página da ordem.
 *
 * ⚠️ Tamanho é PARÂMETRO, não um segundo componente — duas versões divergiriam no 1º ajuste
 * de raio. O raio acompanha a escala (9 · 11 · 14) porque raio fixo em quadrado grande fica
 * quadrado e em pequeno fica círculo.
 */
const MEDIDA = {
  32: { caixa: 'h-8 w-8 rounded-[9px]', icone: 'h-4 w-4', ponto: 'h-[9px] w-[9px] -right-[3px] -top-[3px]' },
  38: { caixa: 'h-[38px] w-[38px] rounded-[11px]', icone: 'h-[18px] w-[18px]', ponto: 'h-[9px] w-[9px] -right-[3px] -top-[3px]' },
  48: { caixa: 'h-12 w-12 rounded-[14px]', icone: 'h-[22px] w-[22px]', ponto: 'h-[11px] w-[11px] -right-[3px] -top-[3px]' },
} as const

export function LogoDaReceita({ nome, forcar, tamanho = 32, alerta }: {
  nome: string
  /** ⭐ o escape pra linguagem de ESTADO (a ordem atrasada troca o ícone pelo relógio coral) */
  forcar?: { familia: string; Icone: typeof Beef }
  tamanho?: 32 | 38 | 48
  /**
   * ⭐⭐ o PONTINHO do fiscal, no canto — e o **anel da superfície** é o que o separa do fundo
   * colorido do logo: sem ele, coral sobre rosa vira mancha e o sinal que existe pra ser visto
   * some.
   */
  alerta?: { titulo: string } | null
}) {
  const c = caraDaReceita(nome)
  const t = fam(forcar?.familia ?? c.familia)
  const Icone = forcar?.Icone ?? ICONES[c.icone]
  const m = MEDIDA[tamanho]
  return (
    <span className="relative inline-flex shrink-0">
      <span className={`inline-flex items-center justify-center ${m.caixa}`} style={{ background: t.bg }}>
        <Icone className={m.icone} style={{ color: t.mid }} />
      </span>
      {alerta && (
        <span
          aria-label={alerta.titulo}
          title={alerta.titulo}
          className={`absolute rounded-full ${m.ponto}`}
          style={{ background: 'var(--fam-coral-mid)', boxShadow: '0 0 0 2px var(--prod-surface)' }}
        />
      )}
    </span>
  )
}
