// ⭐⭐⭐ "REVENDA VIRA FICHA DE 1 COMPONENTE" — A REGRA COM UM DONO SÓ (14/09/2026).
//
// A régua é de 09/09, decisão do dono: *"Produto vendido baixa estoque por UM mecanismo,
// não três. Revenda é só o caso particular de ficha com 1 componente ×1 — é o caminho que
// já cobre o caso complexo (xis, pizza, combo), então os simples cabem nele."*
//
// ⛔ **POR QUE ELA SAIU DE DENTRO DO `venda-map.ts`:** a revisão do import passou a oferecer
// *"criar ficha simples"* também pros **COMPLEMENTOS** (o caso `FRUKI LATA` comum), e o mapa
// de complementos é outro módulo. Copiar as ~20 linhas ali faria **duas** implementações da
// mesma decisão — e a segunda divergiria no primeiro caso de borda, que é exatamente a
// doença que os 7 detectores de par custaram a esta casa.
//
// ⚠️ **O QUE NÃO VEIO JUNTO: os GUARDS de destino.** Cada mapa continua com o seu
// (`venda-map` recusa INTERMEDIARIO, `complemento-map` ACEITA) — eles são opostos de
// propósito e unificá-los quebraria um dos dois. O que é comum é só a **construção** da
// ficha passa-direto.

import type { PrismaClient } from '@prisma/client'
import { criarFicha, fichaAtivaComNome } from '@/lib/stock/producao/fichas'

export class FichaDeRevendaError extends Error {}

/**
 * ⭐ A ficha é exatamente "aquele item ×1"? É o que autoriza reusá-la.
 *
 * ⛔⛔ REUSAR FICHA SÓ PELO NOME É PERIGOSO — um teste pegou isto antes de ir pra prod em
 * 09/09: uma ficha homônima que baixa OUTRA COISA seria reusada, e o produto passaria a
 * baixar o item errado **em silêncio** (no fixture degenerado virou explosão infinita).
 */
export async function ehPassaDiretoDoItem(companyId: string, fichaId: string, itemId: string, db: PrismaClient): Promise<boolean> {
  const f = await db.stockFicha.findFirst({ where: { id: fichaId, companyId }, select: { versaoAtual: true } })
  if (!f) return false
  const v = await db.stockFichaVersao.findFirst({ where: { fichaId, versao: f.versaoAtual }, select: { id: true } })
  if (!v) return false
  const c = await db.stockFichaComponente.findMany({ where: { versaoId: v.id }, select: { itemId: true, qtdPlanejada: true } })
  return c.length === 1 && c[0].qtdPlanejada === 1 && c[0].itemId === itemId
}

/**
 * Devolve o id da ficha passa-direto de `itemId` que atende `nomeSuitable` — reusando a que
 * já existe, criando só quando não existe.
 *
 * ⚠️ `criarFicha` abre transação própria: esta função **não** pode ser chamada de dentro de
 * uma `$transaction` (conferido nos dois callers).
 */
export async function garantirFichaDeRevenda(
  companyId: string,
  nomeSuitable: string,
  itemId: string,
  userId: string | undefined,
  db: PrismaClient,
): Promise<string> {
  const ja = await fichaAtivaComNome(companyId, nomeSuitable, db)
  if (ja && !(await ehPassaDiretoDoItem(companyId, ja.fichaId, itemId, db))) {
    throw new FichaDeRevendaError(
      `Já existe uma ficha chamada “${ja.nome}” que baixa outra coisa. ` +
      'Aponte o produto nela pela tela do cardápio, ou dê outro nome — ' +
      'reusar por semelhança de nome faria a venda baixar o item errado.',
    )
  }
  if (ja) return ja.fichaId
  const r = await criarFicha({
    companyId, userId, nomeProduzido: nomeSuitable, unidadeProduzido: 'UN',
    tipoProduto: 'PRODUTO_FINAL', loteBase: 1, unidadeLoteBase: 'UN',
    componentes: [{ itemId, qtdPlanejada: 1, unidade: 'UN', posicao: 0 }],
    // ⚠️ aqui o nome do PDV PODE ser igual ao do item ("FANTA LARANJA 2L"), e isso é o
    // esperado neste caminho — o guard de 09/09 existe pra o dono não duplicar SEM QUERER,
    // e aqui a duplicação é a própria linha do cardápio, criada de propósito.
    permitirItemNovoComNomeDeEstoque: true,
  }, db)
  return r.fichaId
}
