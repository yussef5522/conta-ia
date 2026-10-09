/**
 * ⭐⭐ "ESTA RECEITA ACEITA RETALHO?" — a rota que a tela de criar ordem pergunta (09/10/2026).
 *
 * ⛔⛔ **ROTA PRÓPRIA em vez de engordar o payload de `/fichas`.** Aquele payload serve 4 telas
 * e já custou 4.909 ms uma vez (28/09): pendurar duas colunas nele faria TODA lista de ficha
 * pagar por uma pergunta que só o formulário de ordem faz, e só pra UMA ficha de cada vez.
 *
 * ⚠️ `stock.view`: é LEITURA. O guard estrutural da casa (*"GET é sempre view"*) morde quem
 * pedir mais — e pedir `operate` aqui esconderia a pergunta de quem pode ler a produção.
 */
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { guardStock } from '@/lib/stock/require-stock'
import { configDeRetalho, ultimoRetalhoDaFicha, PESO_DA_METADE_G } from '@/lib/stock/producao/retalho'

interface Params { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, { params }: Params) {
  const { id: companyId } = await params
  const a = await guardStock(request, companyId, 'stock.view')
  if (a.erro) return a.erro

  const fichaId = request.nextUrl.searchParams.get('ficha') ?? ''
  if (!fichaId) return NextResponse.json({ erro: 'Diga qual ficha.' }, { status: 400 })

  const cfg = (await configDeRetalho(companyId, [fichaId], prisma)).get(fichaId)
  /**
   * ⛔⛔ **FICHA NÃO MARCADA DEVOLVE `aceita: false` E PRONTO** — nem o peso, nem o último kg.
   *
   * ⚠️ Mandar o `pesoUnidadeG` padrão aqui seria dar à tela tudo de que ela precisa pra montar
   * a pergunta numa receita que o dono não marcou: *a ausência da pergunta tem que vir da
   * ausência do DADO*, não de um `if` na tela que alguém remove num refactor.
   */
  if (!cfg?.aceita) return NextResponse.json({ aceita: false })

  const ultimo = await ultimoRetalhoDaFicha(companyId, fichaId, prisma)
  return NextResponse.json({
    aceita: true,
    pesoUnidadeG: cfg.pesoUnidadeG,
    /** ⚠️ o LEMBRETE, nunca o valor do campo: ele nasce VAZIO (ordem do dono) */
    ultimoKg: ultimo?.kg ?? null,
    ultimoEm: ultimo?.declaradoEm ?? null,
    /** ⭐ pra a tela dizer "a metade pesa 200 g" sem cravar o número — ela lê o do banco */
    pesoPadraoG: PESO_DA_METADE_G,
  })
}
