// ⭐⭐⭐ ONDE O MENU DO CHIP CABE (18/09/2026).
//
// ⛔⛔ **O DEFEITO QUE ISTO CONSERTA, medido em prod:** o dono clicou *"parcela de
// empréstimo"* e o seletor abriu **sem nenhum contrato** — com a empresa tendo 10. O log do
// nginx é a prova de que o dado CHEGOU: `GET /api/empresas/…/emprestimos → 200 · 8024
// bytes`, às 23:37:06, no navegador dele.
//
// ⭐ A causa era **CSS, não dado**: o cartão ≍ é `overflow-hidden` (pra arredondar os dois
// lados do grid) e o menu era `absolute` DENTRO dele — ou seja, **o painel era recortado
// pela borda do cartão**, e os chips são o último bloco. O dono via o chip abrir e nada
// embaixo. *Menu que abre fora da vista é indistinguível de menu vazio.*
//
// ⚠️ Por isso o painel foi pro **portal** (fora de qualquer ancestral que corte) e a
// posição passou a ser calculada. A conta mora aqui, pura e testável — *regra que mora num
// `style={{}}` é regra que ninguém prova*.

export interface Retangulo { left: number; top: number; bottom: number; width: number }
export interface Janela { largura: number; altura: number }

export interface PosicaoDoMenu {
  left: number
  /** posicionado pelo topo (abre pra baixo) ou pela base (abre pra cima) */
  top?: number
  bottom?: number
  largura: number
  maxAltura: number
  /** ⭐ pra tela poder dizer o que fez, e pro teste afirmar */
  lado: 'ABAIXO' | 'ACIMA'
}

const MARGEM = 12
const LARGURA_MAX = 320
const ALTURA_MIN = 160

/**
 * ⭐ Decide onde o painel cabe, com a régua que o dono espera de um menu:
 *
 *  · **abre pra baixo** quando há espaço; **pra cima** quando o de baixo é apertado e o de
 *    cima é maior — chip no rodapé da tela não pode abrir num vão de 40px;
 *  · **nunca sangra pela direita** (no celular o chip fica perto da borda);
 *  · a altura máxima é o **espaço REAL** que sobra, não um número fixo — foi um número
 *    fixo dentro de um ancestral que corta que produziu o menu "vazio".
 */
export function posicaoDoMenu(chip: Retangulo, janela: Janela): PosicaoDoMenu {
  const largura = Math.min(LARGURA_MAX, janela.largura - MARGEM * 2)
  const left = Math.max(MARGEM, Math.min(chip.left, janela.largura - largura - MARGEM))

  const espacoAbaixo = janela.altura - chip.bottom - MARGEM
  const espacoAcima = chip.top - MARGEM

  // ⛔ só sobe quando o de baixo é apertado E o de cima é de fato melhor
  if (espacoAbaixo < ALTURA_MIN && espacoAcima > espacoAbaixo) {
    return { left, bottom: janela.altura - chip.top + 6, largura, maxAltura: Math.max(ALTURA_MIN, espacoAcima - 6), lado: 'ACIMA' }
  }
  return { left, top: chip.bottom + 6, largura, maxAltura: Math.max(ALTURA_MIN, espacoAbaixo - 6), lado: 'ABAIXO' }
}
