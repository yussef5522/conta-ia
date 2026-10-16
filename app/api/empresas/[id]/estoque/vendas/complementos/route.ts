// Import do Relatório de COMPLEMENTOS do PDV. Espelha a rota de produtos.
//
// ⚠️ O MAPEAMENTO MORA EM OUTRA ROTA (`complementos/mapear`), e não é organização: a
// primeira versão usava UMA rota com a permissão dinâmica
// (`ehMapa ? 'stock.manage' : 'stock.operate'`) — e o guard estrutural
// `toda-rota-tem-trava` REPROVOU, porque ele exige a chave LITERAL pra poder auditar as
// ~50 rotas de estoque estaticamente. O guard estava certo: permissão em ternário é
// permissão que ninguém consegue conferir sem executar.
//   importar = operação do dia    → stock.operate
//   mapear   = configuração (pra onde a venda baixa) → stock.manage
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { guardStock } from '@/lib/stock/require-stock'
import { previewComplementos, confirmarComplementos, prateleiraGravada, ImportComplementoError } from '@/lib/stock/vendas/import-complementos'
import { exigirDiaDecidido, DiaNaoConfirmadoError } from '@/lib/stock/vendas/lei-da-data'
import { irmaoDoPar } from '@/lib/stock/vendas/registrar-arquivo'

interface Params { params: Promise<{ id: string }> }

const importSchema = z.object({
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Escolha a data (AAAA-MM-DD).'),
  html: z.string().max(5_000_000),
  confirmar: z.boolean().optional(),
  /**
   * ⭐ a resposta do dono à pergunta do dia (a lei da data, 16/10). ⛔ NÃO é um `force`: ela
   * só vale se bater com uma das opções que a pergunta ofereceu.
   */
  confirmouDia: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  // ⛔ PERÍODO semeia a prateleira e NUNCA baixa estoque (ver import-complementos.ts)
  modo: z.enum(['DIA', 'PERIODO']).optional(),
  /** ⭐ o nome do arquivo da dropzone (08/10) — o outro lado da conferência Σ do dia */
  nomeArquivo: z.string().trim().min(1).max(300).optional(),
})

/** A prateleira, sem precisar de upload — abre do que já está gravado. */
export async function GET(request: NextRequest, { params }: Params) {
  const { id: companyId } = await params
  const a = await guardStock(request, companyId, 'stock.view')
  if (a.erro) return a.erro
  // devolve { prateleira, periodo } — o período é o DESTE relatório, nunca o de produtos
  return NextResponse.json(await prateleiraGravada(companyId, prisma))
}

export async function POST(request: NextRequest, { params }: Params) {
  const { id: companyId } = await params
  const a = await guardStock(request, companyId, 'stock.operate')
  if (a.erro) return a.erro
  const parsed = importSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ erro: parsed.error.issues[0]?.message ?? 'Dados inválidos.' }, { status: 400 })
  const { data, html, confirmar, modo, nomeArquivo, confirmouDia } = parsed.data
  try {
    /**
     * ⛔⛔ **A LEI DA DATA, pela porta ÚNICA** (16/10). Ela roda **no preview E no confirm**:
     * perguntar só na gravação faria o dono ver o plano do dia errado e confirmar sem motivo
     * pra desconfiar — é a família do *"preview e confirm discordando"* que custou o import de
     * OFX inteiro.
     *
     * ⚠️ O PERÍODO fica fora: ele semeia a prateleira e **nunca é dia de venda** (02/09), então
     * perguntar "é de ontem?" ali seria pergunta sobre um dia que não significa nada.
     */
    const dia =
      (modo ?? 'DIA') === 'PERIODO'
        ? data
        : exigirDiaDecidido({
            diaEscolhido: data,
            agora: new Date(),
            irmao: await irmaoDoPar(companyId, 'COMPLEMENTOS', prisma),
            confirmouDia,
          })
    // ⚠️ o modo vai TAMBÉM pro preview: é ele que decide o `importId`, e sem isso o resumo
    // da baixa sairia calculado contra a chave errada (dia × período).
    if (!confirmar) return NextResponse.json(await previewComplementos(companyId, dia, html, prisma, modo ?? 'DIA'))
    return NextResponse.json(await confirmarComplementos(companyId, dia, html, a.user!.sub, prisma, modo ?? 'DIA', nomeArquivo))
  } catch (e) {
    /**
     * ⭐ 409 = **PERGUNTA**, nunca "erro" — o desenho do `SanidadeNaoConfirmadaError` (05/09):
     * a tela mostra a frase com os dois botões e reenviar o MESMO gesto com `confirmouDia`
     * passa. ⛔ Dia FUTURO vem com `opcoes: []`, e aí não há o que confirmar.
     */
    if (e instanceof DiaNaoConfirmadoError) {
      return NextResponse.json(
        { erro: e.message, code: 'CONFIRME_O_DIA', dia: e.veredicto },
        { status: 409 },
      )
    }
    if (e instanceof ImportComplementoError) return NextResponse.json({ erro: e.message }, { status: 422 })
    throw e
  }
}
