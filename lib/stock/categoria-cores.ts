// ESTOQUE — cores por CATEGORIA no MESMO formato do `PAYABLE_STATUS_COLOR` da Contas a
// Pagar (24/08). Mesma forma de propósito: `stripe` (a tarja lateral da linha), `badgeBg`
// + `badgeText` (o chip), e o `tone` do card de resumo. Copiar a estrutura — e não só as
// cores — é o que faz as telas parecerem irmãs de verdade quando ficam lado a lado.
//
// Mapas EXPLÍCITOS: Tailwind não enxerga classe montada por interpolação.

import type { StatTone } from '@/components/ui/stat-card'

export interface CategoriaCor {
  stripe: string
  badgeBg: string
  badgeText: string
  tone: StatTone
}

const CINZA: CategoriaCor = {
  stripe: 'bg-slate-300',
  badgeBg: 'bg-slate-100 dark:bg-slate-800/40',
  badgeText: 'text-slate-600 dark:text-slate-300',
  tone: 'slate',
}

export const CATEGORIA_COR: Record<string, CategoriaCor> = {
  // ⭐ SABOR (03/09): o item produzido nasce com `categoria = tipoProduto`, então os ~50
  // invólucros de sabor aparecem no Catálogo etiquetados — decisão do dono: **visível**,
  // pra ele conferir que nasceram certos. Esconder cadastro é decisão de outro dia.
  SABOR: {
    stripe: 'bg-fuchsia-500',
    badgeBg: 'bg-fuchsia-100 dark:bg-fuchsia-950/40',
    badgeText: 'text-fuchsia-700 dark:text-fuchsia-300',
    tone: 'slate',
  },
  MATERIA_PRIMA: {
    stripe: 'bg-rose-500',
    badgeBg: 'bg-rose-100 dark:bg-rose-950/40',
    badgeText: 'text-rose-700 dark:text-rose-300',
    tone: 'rose',
  },
  REVENDA: {
    stripe: 'bg-sky-500',
    badgeBg: 'bg-sky-100 dark:bg-sky-950/40',
    badgeText: 'text-sky-700 dark:text-sky-300',
    tone: 'sky',
  },
  EMBALAGEM: {
    stripe: 'bg-amber-500',
    badgeBg: 'bg-amber-100 dark:bg-amber-950/40',
    badgeText: 'text-amber-700 dark:text-amber-300',
    tone: 'amber',
  },
  LIMPEZA: {
    stripe: 'bg-emerald-500',
    badgeBg: 'bg-emerald-100 dark:bg-emerald-950/40',
    badgeText: 'text-emerald-700 dark:text-emerald-300',
    tone: 'emerald',
  },
  USO_INTERNO: CINZA,
  INTERMEDIARIO: {
    stripe: 'bg-violet-500',
    badgeBg: 'bg-violet-100 dark:bg-violet-950/40',
    badgeText: 'text-violet-700 dark:text-violet-300',
    tone: 'violet',
  },
  PRODUTO_FINAL: {
    stripe: 'bg-violet-500',
    badgeBg: 'bg-violet-100 dark:bg-violet-950/40',
    badgeText: 'text-violet-700 dark:text-violet-300',
    tone: 'violet',
  },
}

export const corDaCategoria = (categoria: string): CategoriaCor => CATEGORIA_COR[categoria] ?? CINZA

/** Tarja da POSIÇÃO: quando o item tem mín/máx, a cor conta o ESTADO DO SALDO (é a
 *  informação mais urgente da linha); sem mín/máx, cai na cor da categoria. */
export const STRIPE_FAIXA: Record<string, string> = {
  verde: 'bg-emerald-500',
  vermelho: 'bg-rose-500',
  azul: 'bg-sky-500',
  cinza: 'bg-slate-300',
}
