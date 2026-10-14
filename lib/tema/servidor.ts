/**
 * ⭐ LER E GRAVAR A PREFERÊNCIA DE TELA — a porta única (04/10/2026, trilho aposentado em 14/10).
 *
 * ⛔ Separado do `preferencia.ts` de propósito: aquele é PURO (roda em teste sem banco e no
 * cliente, que é quem desenha o botão do tema); este toca o Prisma. Misturar faria o componente
 * do botão arrastar o client do Prisma pro bundle do navegador.
 *
 * ⭐⭐ **A PORTA É UMA SÓ, E ISSO É ORDEM DO DONO** (*"porta única de escrita"*, FRENTE B de
 * 14/10). `gravarPreferencia` é o ÚNICO lugar do sistema que escreve em
 * `user_tema_preferencia`; `salvarTema` é **casca fina** sobre ela — o padrão do `/apply-marks`
 * (*"uma lógica, dois chamadores"*). Um segundo `upsert` em qualquer rota seria a 2ª porta pro
 * mesmo fato. **Guard: `__tests__/trilho/o-trilho-nasce-recolhido.test.ts`.**
 *
 * ⚠️⚠️ **A PREFERÊNCIA DO TRILHO FOI APOSENTADA (14/10, tarde).** Ela existia pro «», que o dono
 * aposentou — *"nao ajuda em nada entao melhor tirar pq so chega com mouse"*. **A coluna
 * `trilho` DORME no banco** (segue `NOT NULL DEFAULT 'recolhido'`, com o CHECK de forma), porque
 * apagá-la exigiria um ALTER numa tabela com dado real e migration aplicada não se reescreve. O
 * que morreu foi o LEITOR e o ESCRITOR — e esta porta deixou de falar dela de propósito: campo
 * que chega na tela é campo que alguém religa por descuido (a cicatriz da conferência de saldo
 * que saiu do payload em 10/09).
 */
import { prisma } from '@/lib/db'
import { normalizarTema, TEMA_PADRAO, type Tema } from './preferencia'

export interface PreferenciaDeTela {
  tema: Tema
}

/**
 * ⚠️⚠️ **FAIL-SOFT, E ISSO É DESENHO, NÃO DESCUIDO.** Esta função roda no LAYOUT — se ela
 * lançar, o app inteiro fica fora do ar por causa de uma preferência de tela. Banco fora,
 * migration ainda não aplicada (a janela entre `migrate deploy` e o build novo, que esta casa
 * já viu em 25/09), coluna estranha: tudo cai no DEFAULT declarado.
 *
 * ⚠️ O `select` pede SÓ o tema — a coluna `trilho` existe e dorme. Trazê-la "porque a linha é a
 * mesma" poria na tela um campo sem leitor.
 */
export async function lerPreferenciaDeTela(userId: string): Promise<PreferenciaDeTela> {
  try {
    const row = await prisma.userTemaPreferencia.findUnique({
      where: { userId },
      select: { tema: true },
    })
    return { tema: normalizarTema(row?.tema) }
  } catch {
    return { tema: TEMA_PADRAO }
  }
}

/**
 * ⚠️ Mantida pelo nome antigo porque o `lerTema` tem chamador (o layout) e renomear por estética
 * é como link antigo vira 404 — mesma disciplina do redirect de `/pendentes`.
 */
export async function lerTema(userId: string): Promise<Tema> {
  return (await lerPreferenciaDeTela(userId)).tema
}

/**
 * ⭐⭐ A PORTA ÚNICA. Idempotente pelo upsert na PK — tocar o botão duas vezes rápido não cria
 * linha nenhuma a mais, porque `userId` É a chave primária.
 *
 * ⛔⛔ **PARCIAL DE PROPÓSITO, e o motivo é uma cicatriz:** se o `update` mandasse todo campo
 * sempre, um gesto gravaria o valor que o CLIENTE acha que está valendo — e numa aba velha isso
 * é o valor ANTIGO. Cada gesto escreve só o que ELE decidiu. Hoje há um campo só (o tema), e a
 * forma fica: ela é o que mantém a porta correta quando o segundo campo voltar a existir.
 * ⚠️ No `create` o campo que falta cai no DEFAULT declarado, nunca num chute.
 *
 * ⚠️ Aqui NÃO é fail-soft: o dono tocou o botão, e gravação que falha em silêncio é a família
 * do *"salvo que mentia"* (ele volta amanhã no estado velho sem entender por quê). Quem chama é
 * a rota, que traduz a falha em erro visível na tela.
 */
export async function gravarPreferencia(
  userId: string,
  escolha: { tema?: unknown },
): Promise<PreferenciaDeTela> {
  const update: { tema?: Tema } = {}
  if (escolha.tema !== undefined) update.tema = normalizarTema(escolha.tema)

  /**
   * ⛔ Gesto que não decide nada não escreve nada. Sem isto, um corpo vazio faria um `update {}`
   * que mexe no `atualizadoEm` e devolve "ok" sem ter guardado escolha nenhuma — a forma mais
   * barata de um gesto mudo parecer um gesto feito.
   */
  if (Object.keys(update).length === 0) return lerPreferenciaDeTela(userId)

  const row = await prisma.userTemaPreferencia.upsert({
    where: { userId },
    create: { userId, tema: update.tema ?? TEMA_PADRAO },
    update,
    select: { tema: true },
  })
  return { tema: normalizarTema(row.tema) }
}

/** ⭐ casca fina — a lógica é da porta única acima (REGRA 4) */
export async function salvarTema(userId: string, bruto: unknown): Promise<Tema> {
  return (await gravarPreferencia(userId, { tema: bruto })).tema
}
