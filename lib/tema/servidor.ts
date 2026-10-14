/**
 * ⭐ LER E GRAVAR A PREFERÊNCIA DE TELA — a porta única (04/10/2026, trilho em 14/10).
 *
 * ⛔ Separado do `preferencia.ts` de propósito: aquele é PURO (roda em teste sem banco e no
 * cliente, que é quem desenha o botão); este toca o Prisma. Misturar faria o componente do
 * botão arrastar o client do Prisma pro bundle do navegador.
 *
 * ⭐⭐ **A PORTA É UMA SÓ, E ISSO É ORDEM DO DONO** (*"porta única de escrita"*, FRENTE B de
 * 14/10). `gravarPreferencia` é o ÚNICO lugar do sistema que escreve em
 * `user_tema_preferencia`; `salvarTema` e `salvarTrilho` são **cascas finas** sobre ela — o
 * padrão do `/apply-marks` (*"uma lógica, dois chamadores"*). Um segundo `upsert` em qualquer
 * rota seria a 2ª porta pro mesmo fato, e aí tema e trilho passariam a divergir no primeiro
 * campo novo. **Guard: `__tests__/trilho/porta-unica-da-preferencia.test.ts`.**
 */
import { prisma } from '@/lib/db'
import { normalizarTema, TEMA_PADRAO, type Tema } from './preferencia'
import { normalizarTrilho, TRILHO_PADRAO, type Trilho } from '@/lib/trilho/preferencia'

export interface PreferenciaDeTela {
  tema: Tema
  trilho: Trilho
}

/**
 * ⚠️⚠️ **FAIL-SOFT, E ISSO É DESENHO, NÃO DESCUIDO.** Esta função roda no LAYOUT — se ela
 * lançar, o app inteiro fica fora do ar por causa de uma preferência de tela. Banco fora,
 * migration ainda não aplicada (a janela entre `migrate deploy` e o build novo, que esta casa
 * já viu em 25/09), coluna estranha: tudo cai nos DEFAULTS declarados.
 *
 * ⭐ E a AUSÊNCIA de linha responde o mesmo que o DEFAULT da coluna (`recolhido`) e o mesmo que
 * `TRILHO_PADRAO`: **três caminhos, uma resposta** — usuário novo, usuário que só escolheu tema
 * antes de hoje, e banco fora do ar todos vêem o trilho recolhido.
 */
export async function lerPreferenciaDeTela(userId: string): Promise<PreferenciaDeTela> {
  try {
    const row = await prisma.userTemaPreferencia.findUnique({
      where: { userId },
      select: { tema: true, trilho: true },
    })
    return { tema: normalizarTema(row?.tema), trilho: normalizarTrilho(row?.trilho) }
  } catch {
    return { tema: TEMA_PADRAO, trilho: TRILHO_PADRAO }
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
 * ⛔⛔ **PARCIAL DE PROPÓSITO, e isto é o ponto fino:** gravar o trilho **não pode** sobrescrever
 * o tema, e vice-versa. Se o `update` mandasse os dois campos sempre, o «» do menu gravaria o
 * tema que o CLIENTE acha que está valendo — e numa aba velha isso é o tema ANTIGO, ou seja o
 * dono recolheria o menu e o app voltaria pro claro sozinho. Cada gesto escreve só o que ele
 * decidiu. ⚠️ No `create` o campo que falta cai no DEFAULT declarado, nunca num chute.
 *
 * ⚠️ Aqui NÃO é fail-soft: o dono tocou o botão, e gravação que falha em silêncio é a família
 * do *"salvo que mentia"* (ele volta amanhã no estado velho sem entender por quê). Quem chama é
 * a rota, que traduz a falha em erro visível na tela.
 */
export async function gravarPreferencia(
  userId: string,
  escolha: { tema?: unknown; trilho?: unknown },
): Promise<PreferenciaDeTela> {
  const update: { tema?: Tema; trilho?: Trilho } = {}
  if (escolha.tema !== undefined) update.tema = normalizarTema(escolha.tema)
  if (escolha.trilho !== undefined) update.trilho = normalizarTrilho(escolha.trilho)

  /**
   * ⛔ Gesto que não decide nada não escreve nada. Sem isto, um corpo vazio faria um `update {}`
   * que mexe no `atualizadoEm` e devolve "ok" sem ter guardado escolha nenhuma — a forma mais
   * barata de um gesto mudo parecer um gesto feito.
   */
  if (Object.keys(update).length === 0) return lerPreferenciaDeTela(userId)

  const row = await prisma.userTemaPreferencia.upsert({
    where: { userId },
    create: { userId, tema: update.tema ?? TEMA_PADRAO, ...(update.trilho ? { trilho: update.trilho } : {}) },
    update,
    select: { tema: true, trilho: true },
  })
  return { tema: normalizarTema(row.tema), trilho: normalizarTrilho(row.trilho) }
}

/** ⭐ casca fina — a lógica é da porta única acima (REGRA 4) */
export async function salvarTema(userId: string, bruto: unknown): Promise<Tema> {
  return (await gravarPreferencia(userId, { tema: bruto })).tema
}

/** ⭐ casca fina — a lógica é da porta única acima (REGRA 4) */
export async function salvarTrilho(userId: string, bruto: unknown): Promise<Trilho> {
  return (await gravarPreferencia(userId, { trilho: bruto })).trilho
}
