/**
 * ⭐⭐⭐ A PORTA ÚNICA DAS CONCLUSÕES QUE VALEM (12/10/2026) — *"uma ordem = um cartão"*.
 *
 * **O defeito do dono, na tela de hoje:** a ordem da MAIONESE apareceu **duas vezes** na lista
 * do dia — *"aguardando conferência · fez 34,236"* às 16:21 **e** *"✓✓ corrigido e conferido
 * (era 34,236) · fez 34,296"* às 18:25. A faixa do topo somou as duas: **68,53 KG** num dia em
 * que a cozinha produziu **34,30**. Idem a calabresa (107 + 127), o *"Concluídas hoje 20"* (real
 * 18), o *"1.723 UN"*, o *"R$ 5.516,73"* e o *"Rendimento do dia (de 20 lotes)"*.
 *
 * ═══ ⭐⭐ A CAUSA EXATA (medida em prod, read-only, antes de uma linha de código) ═══
 *
 * A correção do gerente é **ESTORNA-E-RELANÇA**: ela **não edita** a conclusão (o ledger é
 * imutável — correção é estorno + novo). Ela cria uma conclusão NOVA e marca a antiga em
 * `stock_conclusao_estornada`. O ledger fica certo e líquido:
 *
 * ```
 *   19:21  PRODUCAO_GERACAO   +34,236 KG
 *   21:25  ESTORNO            −34,236 KG
 *   21:25  PRODUCAO_GERACAO   +34,296 KG     ⭐ líquido que entrou: 34,296 (UMA vez)
 * ```
 *
 * ⛔⛔ **Então o estoque SEMPRE esteve certo — o defeito era de LEITURA.** A régua *"estornada
 * não conta"* existia desde **19/09** (`conclusao-estornada.ts`, criada pros lotes de 22.864) e
 * tinha **DOIS consumidores**: o rendimento medido e a fila do gerente. **Os outros NOVE
 * somavam as duas.** ***A régua existia e não tinha dono: cada leitor novo nascia sem ela.***
 *
 * ═══ ⛔ POR QUE UMA PORTA, E NÃO "acrescentar o filtro nos 9 lugares" ═══
 *
 * Porque amanhã nasce o décimo. É a mesma família dos **7 detectores de par** de transferência,
 * do **B1**, dos **6 lugares que somavam fatura** e do `faturaNetTotal`: *quando N leitores
 * precisam da MESMA decisão, a decisão vira função — senão N−1 ficam certos e ninguém avisa*.
 * O guard `__tests__/regras-ui/uma-ordem-um-cartao.test.ts` fecha a classe: consulta direta a
 * `stockProducaoConclusao` fora desta porta (e das exceções NOMEADAS) é **vermelho no CI**.
 *
 * ═══ ⚠️⚠️ O QUE ESTA PORTA **NÃO** FAZ: dedup por ORDEM ═══
 *
 * A lei do dono é *"uma ordem = um cartão"*, e ela vale porque **a corrigida é a MESMA
 * declaração em versão nova**. Mas **produção PARCIAL é legítima e desenhada** (*"300 hoje, 200
 * amanhã"* — a flag `parcial` existe desde 21/08): ali duas conclusões vivas da mesma ordem são
 * **dois lotes de verdade**, e colapsá-las apagaria metade do que saiu da cozinha.
 *
 * ⭐ Por isso o dedup é pelo **ESTADO ATUAL** (estornada não conta), **nunca por `ordemId`**.
 * ⚠️ Medido em prod (12/10): **0 ordens com 2+ conclusões vivas** em 525 conclusões — então
 * hoje as duas réguas dão o mesmo resultado, e a diferença entre elas é o dia em que a cozinha
 * fechar um lote em duas vezes.
 */
import type { PrismaClient, Prisma } from '@prisma/client'
import { prisma as defaultPrisma } from '@/lib/db'

type Db = PrismaClient | Prisma.TransactionClient

/**
 * ⭐ O SELECT é RICO de propósito: são 11 colunas (a tabela quase inteira), e cada leitor pega
 * o que precisa do resultado.
 *
 * ⚠️ Um `select` por chamador faria a porta voltar a ser N consultas diferentes — e a próxima
 * nasceria sem o filtro, que é exatamente o defeito que ela mata. **Over-fetch de 8 colunas é
 * barato; leitor novo sem a régua custou o dia 12/10.**
 */
export interface ConclusaoVigente {
  id: string
  companyId: string
  ordemId: string
  qtdGerada: number
  rendimento: number
  escalaConsumida: number
  custoLoteReal: number
  custoUnitarioReal: number | null
  colaboradorId: string | null
  validadeAte: Date | null
  parcial: boolean
  criadoEm: Date
}

export interface FiltroDeConclusoes {
  /** a janela (inclusive nos dois extremos, como os leitores de hoje já faziam) */
  de?: Date
  ate?: Date
  /** ou as ordens pedidas (o caminho da página da ordem, do fiscal e das execuções) */
  ordemIds?: string[]
}

/**
 * ⭐ Os ids que NÃO contam. **Delega pro dono da pergunta** (`conclusao-estornada.ts`) quando há
 * empresa; a variante global existe só pro juiz, que varre o banco inteiro.
 *
 * ⛔ Reescrever o `findMany` aqui seria a 2ª resposta pra *"quais foram desfeitas?"*.
 *
 * ⚠️ **EXPORTADA em 16/10** pra o leitor que já tem os ids na mão (os carimbos da fita do dia)
 * poder filtrar **sem laço `for … await`** e **sem** escrever a 2ª régua. ⛔ `conclusaoEstaEstornada`
 * continua sendo a porta pra UMA conclusão; esta é pra o CONJUNTO.
 */
export async function idsEstornados(companyId: string | null, db: Db = defaultPrisma): Promise<Set<string>> {
  const rows = await db.stockConclusaoEstornada.findMany({
    where: companyId ? { companyId } : {},
    select: { conclusaoId: true },
  })
  return new Set(rows.map((r) => r.conclusaoId))
}

/**
 * ⭐⭐ **A PORTA.** Devolve as conclusões do recorte **no estado ATUAL** — a corrigida entra com
 * o número conferido, a declaração antiga fica fora.
 *
 * ⚠️ `companyId: null` é SÓ pro juiz noturno (que roda contra todas as empresas); todo caminho
 * de tela passa a empresa, e o multi-tenant continua no `where`.
 *
 * ⚠️ São **2 consultas** (as estornadas + as conclusões), nunca uma por conclusão: a lição dos
 * 4.909 ms (28/09) vale aqui, que é tela de todo dia.
 */
export async function conclusoesVigentes(
  companyId: string | null,
  filtro: FiltroDeConclusoes = {},
  db: Db = defaultPrisma,
): Promise<ConclusaoVigente[]> {
  /** ⛔ `ordemIds: []` é *"nenhuma ordem"*, não *"todas"* — sem isto a página de uma ordem sem
   *  conclusão receberia o período inteiro da empresa. */
  if (filtro.ordemIds && filtro.ordemIds.length === 0) return []

  const [estornadas, rows] = await Promise.all([
    idsEstornados(companyId, db),
    db.stockProducaoConclusao.findMany({
      where: {
        ...(companyId ? { companyId } : {}),
        ...(filtro.ordemIds ? { ordemId: { in: [...new Set(filtro.ordemIds)] } } : {}),
        ...(filtro.de || filtro.ate
          ? { criadoEm: { ...(filtro.de ? { gte: filtro.de } : {}), ...(filtro.ate ? { lte: filtro.ate } : {}) } }
          : {}),
      },
      select: {
        id: true, companyId: true, ordemId: true, qtdGerada: true, rendimento: true,
        escalaConsumida: true, custoLoteReal: true, custoUnitarioReal: true,
        colaboradorId: true, validadeAte: true, parcial: true, criadoEm: true,
      },
      orderBy: { criadoEm: 'asc' },
    }),
  ])
  return rows.filter((r) => !estornadas.has(r.id))
}

/**
 * ⭐⭐ **A HISTÓRIA INTEIRA — com a estornada MARCADA.** É o que a página da ordem desenha: o
 * rastro *"era 107 → 127"* é **LEI** (ordem do dono), e o que morre é o cartão duplicado na
 * LISTA e nos TOTAIS, nunca a história.
 *
 * ⛔ Por isso ela devolve as duas e **diz qual é qual** (`estornada`), em vez de a tela
 * adivinhar pela ausência de carimbo — era a ausência de carimbo que fazia a declaração antiga
 * aparecer como *"aguardando conferência"*, ou seja **pedindo um trabalho que já foi feito**.
 */
export async function conclusoesComHistoria(
  companyId: string,
  filtro: FiltroDeConclusoes = {},
  db: Db = defaultPrisma,
): Promise<Array<ConclusaoVigente & { estornada: boolean }>> {
  if (filtro.ordemIds && filtro.ordemIds.length === 0) return []
  const [estornadas, rows] = await Promise.all([
    idsEstornados(companyId, db),
    db.stockProducaoConclusao.findMany({
      where: {
        companyId,
        ...(filtro.ordemIds ? { ordemId: { in: [...new Set(filtro.ordemIds)] } } : {}),
        ...(filtro.de || filtro.ate
          ? { criadoEm: { ...(filtro.de ? { gte: filtro.de } : {}), ...(filtro.ate ? { lte: filtro.ate } : {}) } }
          : {}),
      },
      select: {
        id: true, companyId: true, ordemId: true, qtdGerada: true, rendimento: true,
        escalaConsumida: true, custoLoteReal: true, custoUnitarioReal: true,
        colaboradorId: true, validadeAte: true, parcial: true, criadoEm: true,
      },
      orderBy: { criadoEm: 'asc' },
    }),
  ])
  return rows.map((r) => ({ ...r, estornada: estornadas.has(r.id) }))
}

/** ⭐ uma conclusão pelo id, dizendo se ela ainda vale (a etiqueta e o relançamento perguntam) */
export async function conclusaoEstaEstornada(
  companyId: string,
  conclusaoId: string,
  db: Db = defaultPrisma,
): Promise<boolean> {
  const r = await db.stockConclusaoEstornada.findFirst({
    where: { companyId, conclusaoId }, select: { conclusaoId: true },
  })
  return r != null
}

/**
 * ⭐⭐⭐ O INVARIANTE DE GUARDA (pedido do dono) — PURO, pra rodar contra dado real e contra
 * fixture.
 *
 * *"Nenhuma ordem aparece 2× em NENHUMA listagem de período; total do período == soma dos
 * estados atuais."*
 *
 * ⚠️⚠️ **E ele tem uma exceção NOMEADA, senão seria um invariante ERRADO** — e *invariante que
 * falha no caso legítimo é pior que invariante nenhum* (a lição do saldo devedor, 14/08): com
 * **produção PARCIAL** a mesma ordem tem duas conclusões vivas de verdade. Então a régua é:
 * duas linhas da mesma ordem só podem existir se **TODAS** forem parciais.
 */
export function listagemSemOrdemRepetida(
  linhas: Array<{ ordemId: string; parcial?: boolean }>,
): { ok: boolean; repetidas: Array<{ ordemId: string; vezes: number }> } {
  const porOrdem = new Map<string, Array<{ parcial?: boolean }>>()
  for (const l of linhas) porOrdem.set(l.ordemId, [...(porOrdem.get(l.ordemId) ?? []), l])
  const repetidas: Array<{ ordemId: string; vezes: number }> = []
  for (const [ordemId, lista] of porOrdem) {
    if (lista.length < 2) continue
    /** ⭐ parcial é legítimo — o que não existe é a MESMA declaração duas vezes */
    if (lista.every((l) => l.parcial)) continue
    repetidas.push({ ordemId, vezes: lista.length })
  }
  return { ok: repetidas.length === 0, repetidas }
}
