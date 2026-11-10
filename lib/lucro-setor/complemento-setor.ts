/**
 * ⭐ COMPLEMENTO → SETOR — o mapa mínimo, EDITÁVEL, da Fatia 1 do Lucro por Setor (10/11/2026).
 *
 * ⛔ O relatório de complementos do PDV NÃO diz qual produto vendeu cada ocorrência (sem
 * produto-pai). Então a atribuição só existe onde o próprio complemento só cabe num setor:
 *   1. REGRA DE GRUPO: o grupo VIGENTE `SABOR` (cardápio + override do dono, `gruposVigentes`)
 *      → PIZZAS. Sabor de pizza só sai em pizza.
 *   2. NOMES MEDIDOS (30 dias até 08/11): as BORDAS e os sabores de pizza que o grupo ainda
 *      chama de OUTRO (promo Black Friday, pizza doce pequena...). Lista explícita, nunca regex:
 *      borda nova que o PDV inventar cai em SEM SETOR, visível, até alguém escrever aqui.
 *   3. O RESTO → SEM SETOR, visível (lei S11). ⚠️ O grosso disso é refri 2L e xis escolhidos
 *      DENTRO de combo ("Combo Caçula" está em OUTROS; as promos de pizza em PIZZAS): sem o laço
 *      pedido→item não há como saber de quem é a receita. Chutar BEBIDAS poria custo sem venda
 *      num setor e lucro inflado no outro. O laço da SuitAPI (fatia futura) resolve de verdade.
 *
 * ⚠️ É CÓDIGO, não tabela, de propósito: a Fatia 1 não grava nada. A edição pela tela (com
 * rastro do dono) é da Fatia 2 — aí isto vira o SEED, como `SABORES_DO_CARDAPIO` já é.
 * As chaves são `normalizarNome` (acento, caixa, espaço): a mesma porta dos dois lados.
 */
import { normalizarNome, type GrupoComplemento } from '@/lib/stock/vendas/grupo-complemento'

export const SEM_SETOR = 'SEM_SETOR'
export const NOME_SEM_SETOR = 'Sem setor'

export const SETOR_DO_GRUPO: Readonly<Record<GrupoComplemento, string | null>> = {
  SABOR: 'PIZZAS',
  OUTRO: null,
}

const PIZZAS = 'PIZZAS'
const BORDA = 'borda de pizza (medido 30d)'
const SABOR_FORA_DO_GRUPO = 'sabor de pizza que o grupo ainda chama de OUTRO (medido 30d)'

const BRUTO: readonly [string, string, string][] = [
  // bordas — todas as grafias vistas no relatório de 10/10 a 08/11
  ...[
    'BORDA CATUPIRY', 'BORDA CATUPIRY g', 'BORDA CHEDDAR', 'BORDA CHEDDAR g', 'BORDA NUTELLA', 'BORDA NUTELLA g',
    'BORDA CHOCOLATE PRETO', 'BORDA CHOCOLATE PRETO g', 'BORDA CHOCOLATE BRANCO', 'BORDA CHOCOLATE BRANCO g',
    'BORDA KITKAT', 'BORDA CALABRESA', 'BORDA FRANGO CATUPIRY', 'BORDA FRANGO CATUPIRY g',
    'BORDA BACON COM CHEDDAR', 'BORDA BACON COM CHEDDAR g', 'BORDA MUSSARELA', 'BORDA MUSSARELA g',
    'BORDA MUSSARELA GRANDE', 'BORDA MUSSARELA FAMILIA', 'BORDA MUSSARELA COM CATUPIRY', 'BORDA MUSSARELA COM CATUPIRY g',
    'BORDA MUSSARELA COM CATUPIRY GRANDE', 'BORDA MUSSARELA COM CATUPIRY FAMILIA', 'BORDA MUSSARELA COM ALHO',
    'BORDA MUSSARELA COM ALHO g', 'BORDA MUSSARELA COM ALHO GRANDE', 'BORDA MUSSARELA COM ALHO FAMILIA',
  ].map((n) => [n, PIZZAS, BORDA] as [string, string, string]),
  // sabores de pizza fora do grupo SABOR
  ...[
    'CALABRESA BLACK FRIDAY', 'FRANGO BLACK FRIDAY', 'MUSSARELA BLACK FRIDAY', 'STROGONOFF DE CARNE FAMILIA',
    'SABOR CREME DE AVELA PROMO', 'BATATA FRITA EM CIMA DA PIZZA', 'pizza família (45cm)',
    'PIZZA PEQUENA CHOCOLATE PRETO', 'PIZZA PEQUENA CHOCOLATE BRANCO', 'PIZZA PEQUENA OURO BRANCO', 'PIZZA PEQUENA KITKAT',
  ].map((n) => [n, PIZZAS, SABOR_FORA_DO_GRUPO] as [string, string, string]),
]

/** nome normalizado → seção. ⛔ Chave repetida é erro de quem editou — quebra na carga. */
export const COMPLEMENTO_PARA_SECAO: ReadonlyMap<string, { secao: string; porQue: string }> = (() => {
  const m = new Map<string, { secao: string; porQue: string }>()
  for (const [nome, secao, porQue] of BRUTO) {
    const k = normalizarNome(nome)
    if (m.has(k)) throw new Error(`complemento-setor: "${nome}" aparece duas vezes no mapa`)
    m.set(k, { secao, porQue })
  }
  return m
})()

/** O setor de um complemento: nome explícito manda; depois o grupo; senão SEM SETOR. */
export function setorDoComplemento(
  nomeSuitable: string,
  grupo: GrupoComplemento,
  mapa: ReadonlyMap<string, { secao: string; porQue: string }> = COMPLEMENTO_PARA_SECAO,
): { secao: string; porQue: string } {
  const explicito = mapa.get(normalizarNome(nomeSuitable))
  if (explicito) return explicito
  const doGrupo = SETOR_DO_GRUPO[grupo]
  if (doGrupo) return { secao: doGrupo, porQue: `grupo ${grupo}` }
  return { secao: SEM_SETOR, porQue: 'sem atribuição (sem laço pedido→item)' }
}
