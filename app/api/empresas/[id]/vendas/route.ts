/**
 * ⭐⭐⭐ A API DA TELA DE VENDAS — v4 (10/10/2026). SÓ LEITURA.
 *
 * **Duas fontes, uma escolha por dia** (ordem do dono): o **PDV** (a central de importação)
 * é a verdade LISA; a **`VendaDiaria`** (derivada de `Transaction` por competência) é o
 * fallback com `~`. Quem escolhe é `montarDias` — esta rota só junta as duas e traduz.
 *
 * ⛔⛔ **O RELÓGIO NÃO DECIDE DADO** (a régua da casa): ele entra como `hoje` pra marcar a
 * célula, cobrar o import de dia que JÁ ACABOU e projetar o resto do mês. ⚠️ E é o dia do
 * **BRASIL**: o servidor roda em UTC, e às 21h de São Paulo o `toISOString()` já diz amanhã —
 * a tela abriria no mês errado na virada e cobraria import de um dia que ainda está vendendo.
 *
 * ⚠️ O recorte aceita `?mes=YYYY-MM` **ou** `?de=&ate=` (o 📅 datas livres). Default = **mês
 * corrente**, nunca o último mês com dado — ver o guard em `__tests__/vendas/`.
 */
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuthContext } from '@/lib/auth/rbac'
import { handleApiError } from '@/lib/api/handle-error'
import { mesCorrente, janelaDoMes, hojeBrasil } from '@/lib/periodo/mes-corrente'
import { totaisDoPdvPorDia } from '@/lib/stock/vendas/total-do-pdv'
import { whereCruzaOMes } from '@/lib/vendas/janela-mes'
import {
  montarDias, montarCartoes, composicaoPorMeio, diaTipico, segundaDaSemana,
  type EntradaDoExtrato,
} from '@/lib/vendas/dia-a-dia'

interface Params {
  params: Promise<{ id: string }>
}

const dia = (d: Date) => d.toISOString().slice(0, 10)
const dt = (s: string) => new Date(`${s}T00:00:00.000Z`)
const DIA_MS = 86_400_000
const ISO = /^\d{4}-\d{2}-\d{2}$/

/**
 * ⭐ O RECORTE — `mes` ou `de`/`ate`, com o mês CORRENTE como default.
 *
 * ⛔⛔ O default é o mês de HOJE, **SEMPRE**. A tela antiga tinha `useState('2026-08')` —
 * um mês LITERAL cravado, com o comentário *"o do início do sistema (agosto)"* — que
 * envelheceu e passou a abrir dois meses no passado. É a mesma classe da **data fixa no
 * futuro** (REGRA 12 de 01/09): *data fixa não é default, é uma data que o calendário alcança.*
 */
export function resolverRecorte(
  p: URLSearchParams,
  agora: Date,
): { de: string; ate: string; mes: string | null; ehMesInteiro: boolean } {
  const hoje = hojeBrasil(agora)

  // ── 📅 DATAS LIVRES: o dono apontou as duas pontas (e `de == ate` é 1 dia, legítimo)
  const de = p.get('de')
  const ate = p.get('ate')
  if (de && ISO.test(de) && ate && ISO.test(ate) && de <= ate) {
    return { de, ate, mes: null, ehMesInteiro: false }
  }

  /**
   * ⭐⭐ DIA e SEMANA são resolvidos AQUI, não no cliente — **um relógio só manda**.
   *
   * ⛔ Se a tela mandasse `de=<hoje do navegador>`, um aparelho com a hora torta pediria um
   * dia e o servidor marcaria outro como `hoje`: a célula "hoje" acenderia num dia e o
   * recorte seria de outro. É a régua da casa (*"o cronômetro é da tela, o instante é do
   * servidor"*), e o tablet com hora atrasada já custou um cronômetro parado em 00:00 (08/09).
   */
  const periodo = p.get('periodo')
  if (periodo === 'DIA') return { de: hoje, ate: hoje, mes: null, ehMesInteiro: false }
  if (periodo === 'SEMANA') {
    return { de: segundaDaSemana(hoje), ate: hoje, mes: null, ehMesInteiro: false }
  }

  const m = p.get('mes')
  const mes = m && /^\d{4}-\d{2}$/.test(m) ? m : mesCorrente(agora)
  const j = janelaDoMes(mes)
  return {
    de: dia(j.de),
    // ⚠️ `ate` é INCLUSIVO aqui (o último dia do mês), porque é o que a tela desenha
    ate: dia(new Date(j.ate.getTime() - DIA_MS)),
    mes,
    ehMesInteiro: true,
  }
}

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { id: companyId } = await params
    /**
     * ⛔ VAZAMENTO FECHADO (30/08): `getAuthContext` só prova que a pessoa É DA EMPRESA —
     * não que ela pode ver ISTO. O faturamento diário é dado financeiro.
     */
    const ctx = await getAuthContext(request, companyId)
    ctx.requirePermission('transaction.view')

    const agora = new Date()
    const hoje = hojeBrasil(agora)
    const r = resolverRecorte(request.nextUrl.searchParams, agora)

    const de = dt(r.de)
    /** ⚠️ exclusivo na consulta, inclusivo na tela — o dia seguinte ao último */
    const ateEx = new Date(dt(r.ate).getTime() + DIA_MS)

    /** ⭐ a semana ANTERIOR à atual, pra a sub "vs semana passada" acender sozinha */
    const segAtual = segundaDaSemana(hoje)
    const segPassada = dia(new Date(dt(segAtual).getTime() - 7 * DIA_MS))

    const [primeira, pdv, vs, pdvPassada, vsPassada] = await Promise.all([
      // Início do módulo = 1ª vigência do perfil. Sem perfil → null (célula "sem dado").
      prisma.regraRecebimento.findFirst({
        where: { companyId }, orderBy: { vigenteDe: 'asc' }, select: { vigenteDe: true },
      }),
      totaisDoPdvPorDia(companyId, de, ateEx, prisma),
      /**
       * ⚠️ SOBREPOSIÇÃO, não pertencimento (25/08): o bloco de fim de semana começa na SEXTA
       * — se a sexta cai no mês anterior, filtrar por `dataCompetencia` dentro do mês esconde
       * o bloco INTEIRO (foram R$ 43.106,03 invisíveis).
       *
       * ⭐ E a régua vem do DONO (`whereCruzaOMes`), nunca reescrita aqui: escrevê-la à mão
       * é como o juiz e o recompute divergiram da tela e geraram 111 alarmes falsos (26/08).
       */
      prisma.vendaDiaria.findMany({
        where: { companyId, ...whereCruzaOMes(de, ateEx) },
        orderBy: { dataCompetencia: 'asc' },
        select: { dataCompetencia: true, dataCompetenciaFim: true, meio: true, valorLiquido: true },
      }),
      totaisDoPdvPorDia(companyId, dt(segPassada), dt(segAtual), prisma),
      prisma.vendaDiaria.findMany({
        where: { companyId, ...whereCruzaOMes(dt(segPassada), dt(segAtual)) },
        select: { dataCompetencia: true, dataCompetenciaFim: true, meio: true, valorLiquido: true },
      }),
    ])

    const paraExtrato = (xs: typeof vs): EntradaDoExtrato[] =>
      xs.map((v) => ({
        dia: dia(v.dataCompetencia),
        fim: dia(v.dataCompetenciaFim),
        total: v.valorLiquido,
        meio: v.meio,
      }))

    const moduleInicio = primeira ? dia(primeira.vigenteDe) : null
    /**
     * ⭐ A COMPOSIÇÃO VIAJA (10/10) — `totaisDoPdvPorDia` separa produtos de complementos, e
     * jogar isso fora aqui era o motivo de a tela não poder DIZER o que ela soma (a
     * divergência medida contra a central: R$ 17.102,63 × R$ 15.873,77 no dia 06/10).
     */
    const mapaPdv = new Map([...pdv].map(([k, v]) =>
      [k, { total: v.total, unidades: v.unidades, produtos: v.produtos, complementos: v.complementos }]))

    const dias = montarDias({
      de: r.de, ate: r.ate, pdv: mapaPdv, extrato: paraExtrato(vs), hoje, moduleInicio,
    })

    /**
     * ⭐ A semana passada vira `DiaDeVenda[]` pelo MESMO `montarDias` — uma régua, dois
     * recortes. Uma soma própria aqui faria a comparação usar outra fonte que a célula.
     */
    const diasSemanaPassada = montarDias({
      de: segPassada,
      ate: dia(new Date(dt(segAtual).getTime() - DIA_MS)),
      pdv: new Map([...pdvPassada].map(([k, v]) =>
        [k, { total: v.total, unidades: v.unidades, produtos: v.produtos, complementos: v.complementos }])),
      extrato: paraExtrato(vsPassada),
      hoje,
      moduleInicio,
    })

    return NextResponse.json({
      recorte: { de: r.de, ate: r.ate, mes: r.mes, ehMesInteiro: r.ehMesInteiro },
      hoje,
      moduleInicio,
      dias,
      cartoes: montarCartoes({ dias, hoje, ehMesInteiro: r.ehMesInteiro, diasSemanaPassada }),
      /** ⚠️ o MEIO só existe no extrato — o PDV não diz por onde o dinheiro entrou */
      meios: composicaoPorMeio(paraExtrato(vs)),
      diaTipico: diaTipico(dias),
      /** ⭐ a cobertura do PDV no recorte — é ela que diz se o número é liso ou estimado */
      cobertura: {
        comPdv: dias.filter((d) => d.fonte === 'PDV').length,
        peloExtrato: dias.filter((d) => d.estimado && d.total != null).length,
        pedemImport: dias.filter((d) => d.pedeImport).length,
      },
    })
  } catch (e) {
    return handleApiError(e)
  }
}
