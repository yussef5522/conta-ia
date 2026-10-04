/**
 * ⭐ LER E GRAVAR O TEMA — a porta única (04/10/2026).
 *
 * ⛔ Separado do `preferencia.ts` de propósito: aquele é PURO (roda em teste sem banco e no
 * cliente, que é quem desenha o botão); este toca o Prisma. Misturar faria o componente do
 * botão arrastar o client do Prisma pro bundle do navegador.
 */
import { prisma } from '@/lib/db'
import { normalizarTema, TEMA_PADRAO, type Tema } from './preferencia'

/**
 * ⚠️⚠️ **FAIL-SOFT, E ISSO É DESENHO, NÃO DESCUIDO.** Esta função roda no LAYOUT — se ela
 * lançar, o app inteiro fica fora do ar por causa de uma preferência de cor. Banco fora,
 * migration ainda não aplicada (a janela entre `migrate deploy` e o build novo, que esta casa
 * já viu em 25/09), coluna estranha: tudo cai no CLARO, que é o default declarado.
 */
export async function lerTema(userId: string): Promise<Tema> {
  try {
    const row = await prisma.userTemaPreferencia.findUnique({
      where: { userId },
      select: { tema: true },
    })
    return normalizarTema(row?.tema)
  } catch {
    return TEMA_PADRAO
  }
}

/**
 * ⭐ Grava a escolha. Idempotente pelo upsert na PK — tocar o botão duas vezes rápido não cria
 * linha nenhuma a mais, porque `userId` É a chave primária.
 *
 * ⚠️ Aqui NÃO é fail-soft: o dono tocou o botão, e gravação que falha em silêncio é a família
 * do *"salvo que mentia"* (ele volta amanhã no tema velho sem entender por quê). Quem chama é
 * a rota, que traduz a falha em erro visível na tela.
 */
export async function salvarTema(userId: string, bruto: unknown): Promise<Tema> {
  const tema = normalizarTema(bruto)
  await prisma.userTemaPreferencia.upsert({
    where: { userId },
    create: { userId, tema },
    update: { tema },
  })
  return tema
}
