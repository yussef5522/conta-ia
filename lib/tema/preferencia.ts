/**
 * ⭐⭐ A PREFERÊNCIA DE TEMA — POR USUÁRIO, EM TABELA (04/10/2026).
 *
 * **Ordem do dono:** *"escolha SALVA EM TABELA por usuário — **nunca localStorage**; aplicada
 * em todas as telas e nos 2 viewports; **default = claro**."*
 *
 * ⛔⛔ **O "NUNCA localStorage" É A MESMA RÉGUA DO REAL×TEÓRICO (29/09), e por um motivo
 * medido:** o dono confere no celular E no notebook. localStorage é por NAVEGADOR — a escolha
 * feita num aparelho **sumiria no outro**, e *"salvo por usuário" só é verdade se for no banco*.
 * Pior: a classe no `<html>` é decidida no SERVIDOR (é o que mata o flash de tema errado no
 * primeiro paint), e o servidor não tem como ler localStorage.
 *
 * ⚠️⚠️ **O VOCABULÁRIO MORA AQUI, NÃO NO CHECK DO BANCO.** A migration valida a FORMA
 * (`tema <> '' AND tema = lower(tema)`), nunca a lista de valores — é a cicatriz de 21/09, em
 * que o `CHECK (lista IN ('CAROS','PORCOES'))` do radar virou PAREDE **um dia depois**, quando
 * o dono pediu a terceira lista, porque migration de módulo é CREATE-only e `ALTER` é proibido.
 * Tema é CONFIGURAÇÃO: o dia em que entrar um `'sistema'` (seguir o aparelho) se resolve
 * editando a lista abaixo, sem tocar no banco.
 */

export const TEMAS = ['claro', 'escuro'] as const
export type Tema = (typeof TEMAS)[number]

/** ⭐ o default é CLARO, por ordem do dono — e ele vale pra ausência E pra lixo */
export const TEMA_PADRAO: Tema = 'claro'

/**
 * PURA e DEFENSIVA — traduz o que veio do banco/da rede num tema válido.
 *
 * ⚠️ Ela NUNCA lança: a preferência é **enfeite**, e derrubar o layout inteiro (que é onde
 * isto roda) por causa de uma string estranha seria trocar "tema errado" por "app fora do ar".
 * Valor desconhecido cai no claro, que é o default declarado.
 */
export function normalizarTema(bruto: unknown): Tema {
  if (typeof bruto !== 'string') return TEMA_PADRAO
  const t = bruto.trim().toLowerCase()
  return (TEMAS as readonly string[]).includes(t) ? (t as Tema) : TEMA_PADRAO
}

/** ⭐ a classe que o Tailwind espera (`darkMode: ['class']`) — `''` no claro, nunca `'light'` */
export function classeDoTema(tema: Tema): string {
  return tema === 'escuro' ? 'dark' : ''
}

/** o tema OPOSTO — o que o botão vai aplicar quando o dono toca nele */
export function alternar(tema: Tema): Tema {
  return tema === 'escuro' ? 'claro' : 'escuro'
}

/**
 * ⭐ O QUE O BOTÃO MOSTRA — e é o contrário do que parece, de propósito.
 *
 * **Pedido do dono:** *"no claro mostra lua, no escuro sol"*. O ícone anuncia **pra onde o
 * toque leva**, não o estado atual: no tema claro a lua significa *"clique pra escurecer"*.
 * É a convenção do GitHub/Linear/Stripe — e o `title` escreve isso, porque ícone sozinho
 * ensina pela metade.
 */
export function caraDoBotao(tema: Tema): { icone: 'lua' | 'sol'; titulo: string } {
  return tema === 'escuro'
    ? { icone: 'sol', titulo: 'Tema escuro — clique pra voltar ao claro' }
    : { icone: 'lua', titulo: 'Tema claro — clique pra escurecer' }
}
