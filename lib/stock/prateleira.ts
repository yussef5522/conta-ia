/**
 * ⭐⭐⭐ QUEM MEXE NA PRATELEIRA — A LISTA MORA AQUI, E SÓ AQUI.
 *
 * ⚠️⚠️ **POR QUE ELA SAIU DO `saldo.ts` (13/10/2026):** a porta do CUSTO VIGENTE precisa da
 * MESMA régua pra replayar a história do item, e `saldo.ts` precisa da porta do custo —
 * deixar a lista lá fazia **ciclo de import**. ⛔ E a saída preguiçosa (copiar a lista no
 * arquivo novo) seria a 2ª cópia da régua que o comentário abaixo existe pra impedir. O
 * `saldo.ts` **RE-EXPORTA** os dois símbolos, então os importadores de sempre não mudam.
 *
 * PRODUCAO_CONSUMO NÃO é evento de prateleira — é transferência interna da produção (o insumo
 * já saiu da prateleira no SEPARACAO_SAIDA). Contá-lo no saldo duplicaria a baixa.
 * SEPARACAO_SAIDA(−)/DEVOLUCAO_PRODUCAO(+) mexem na prateleira; PRODUCAO_GERACAO(+) é o
 * produto entrando.
 *
 * ⛔⛔ **POR QUE ELA É EXPORTADA (09/09/2026):** a regra era um `where` privado do `saldo.ts`, e
 * a TELA não tinha como saber dela — então o histórico do item mostrava a separação **e** o
 * consumo como duas saídas do mesmo tamanho, **somando o dobro do que o saldo baixou**. O
 * dono olhou e suspeitou de baixa dupla; o número estava certo e a TELA é que mentia.
 * *"Rastreio que deixa o dono na dúvida não rastreou nada."*
 *
 * ⚠️ Tipo NOVO entra na prateleira por default (`movePrateleira` é uma denylist): esquecer de
 * cadastrar um tipo novo faz ele **aparecer e somar**, que é o erro seguro — o inseguro seria
 * um movimento real sumir do saldo em silêncio.
 */
import type { PrismaClient, Prisma } from '@prisma/client'

type PrateleiraDb = PrismaClient | Prisma.TransactionClient

export const TIPOS_FORA_DA_PRATELEIRA: string[] = ['PRODUCAO_CONSUMO']

/** ⭐ esta linha mexe no saldo da prateleira? A MESMA pergunta que o saldo faz. */
export function movePrateleira(tipo: string): boolean {
  return !TIPOS_FORA_DA_PRATELEIRA.includes(tipo)
}

/**
 * ⛔⛔⛔ O ESTORNO DE UM MOVIMENTO INTERNO TAMBÉM É INTERNO (19/09/2026).
 *
 * **O defeito, achado durante a cirurgia da maionese:** `estornarMovimento` cria a linha
 * oposta com `tipo: 'ESTORNO'` — e ESTORNO **conta na prateleira**. Então desfazer um
 * `PRODUCAO_CONSUMO` (que é interno, e NÃO conta) **adicionava ao saldo**: o consumo saía
 * por fora e voltava por dentro. A CUBA MAIONESE ficou com **72,74 kg** onde a
 * reconstrução previa **36,49** — a diferença de **36,25** é a soma exata dos 6 consumos.
 *
 * ⚠️⚠️ **E O DEFEITO NÃO ERA MEU — a cirurgia só o expôs.** Medido: 9 estornos nessa
 * situação em prod, em 2 itens, e o «Patinho Bife (mesclado)» carregava **+38,16 kg /
 * R$ 1.754,36** a mais **desde uma mescla antiga**. *O estorno perde a informação do tipo
 * original, e a régua de prateleira olhava só o tipo da linha.*
 *
 * ⭐ **A cura é de LEITURA, não de dado:** o ledger está certo (estornar um consumo é
 * legítimo); quem estava errado era quem somava. Nada de UPDATE, nada de movimento novo —
 * é a mesma família do E2, que contava linha crua e acusava toda correção legítima.
 *
 * ⚠️⚠️ **E ELA MORA AQUI, não no `saldo.ts` (13/10/2026):** o replay da história do item (a
 * memória do custo) tem que usar a MESMÍSSIMA régua da leitura — senão o **juiz E17**
 * passaria a comparar o campo persistido contra uma opinião diferente da porta, e o drift
 * que ele acusasse **não diria nada sobre o dado**. Alarme que mente é pior que alarme
 * nenhum.
 */
export async function idsDeEstornoInterno(
  db: PrateleiraDb,
  companyId: string,
  itemId?: string,
): Promise<string[]> {
  const estornos = await db.stockMovement.findMany({
    where: { companyId, tipo: 'ESTORNO', estornoDeId: { not: null }, ...(itemId ? { itemId } : {}) },
    select: { id: true, estornoDeId: true },
  })
  if (!estornos.length) return []
  const originais = await db.stockMovement.findMany({
    where: {
      id: { in: estornos.map((e) => e.estornoDeId as string) },
      tipo: { in: TIPOS_FORA_DA_PRATELEIRA },
    },
    select: { id: true },
  })
  const fora = new Set(originais.map((o) => o.id))
  return estornos.filter((e) => fora.has(e.estornoDeId as string)).map((e) => e.id)
}
