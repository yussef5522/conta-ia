// ⛔⛔ O CASO REAL, PELA CONSULTA DE VERDADE: lote concluído às 21h some do "hoje".
//
// O teste puro (`lib/datas/__tests__/dia-sao-paulo.test.ts`) trava a RÉGUA; este trava o
// CAMINHO — monta a janela como o painel monta e roda a MESMA query que a tela roda
// (`conclusoesNoPeriodo`). Sem ele, a régua poderia estar certa e a tela continuar pedindo o
// dia errado, que foi exatamente o que aconteceu: o recorte do servidor já tinha sido
// corrigido em 02/09 **no ramo que a tela nunca usa**.

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { prisma } from '@/lib/db'
import { conclusoesNoPeriodo } from '../conclusao'
import { diaEmSaoPaulo, janelaDoDiaSP } from '@/lib/datas/dia-sao-paulo'

const CNPJ = '50505050000177'
let companyId = ''

/** o instante real em que o dono abriu o painel: 22:16 de São Paulo (já 06/09 em UTC) */
const QUANDO_ELE_OLHOU = new Date('2026-09-06T01:16:25.378Z')

/** três lotes da noite: 17:49 (antes da virada UTC), 21:30 e 23:50 — o pior caso da borda */
const NOITE = [
  new Date('2026-09-05T20:49:24.257Z'), // 17:49 SP — o horário real dos 9 lotes
  new Date('2026-09-06T00:30:00.000Z'), // 21:30 SP
  new Date('2026-09-06T02:50:00.000Z'), // 23:50 SP
]

beforeEach(async () => {
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
  companyId = (await prisma.company.create({ data: { cnpj: CNPJ, name: 'DIA SP' } })).id
  for (const criadoEm of NOITE) {
    await prisma.stockProducaoConclusao.create({
      data: {
        companyId, ordemId: `ordem-${criadoEm.getTime()}`, qtdGerada: 25, escalaConsumida: 1,
        custoLoteReal: 90.5, custoUnitarioReal: 3.62, rendimento: 25, criadoEm,
      },
    })
  }
})

afterEach(async () => {
  await prisma.stockProducaoConclusao.deleteMany({ where: { companyId } })
  await prisma.company.deleteMany({ where: { id: companyId } })
})

describe('⛔⛔ o painel de produção mostra o que foi feito HOJE, inclusive às 23h', () => {
  it('⭐⭐ "hoje" às 22:16 de SP traz os 3 lotes da noite', async () => {
    const hoje = diaEmSaoPaulo(QUANDO_ELE_OLHOU)
    expect(hoje).toBe('2026-09-05')
    const { de, ate } = janelaDoDiaSP(hoje, hoje)
    const cs = await conclusoesNoPeriodo(companyId, de, ate)
    expect(cs, 'os lotes que sumiam da tela').toHaveLength(3)
  })

  it('⛔ com o recorte ANTIGO (dia UTC) a tela abria com ZERO — o red do fix', async () => {
    const diaUtc = QUANDO_ELE_OLHOU.toISOString().slice(0, 10) // '2026-09-06'
    const cs = await conclusoesNoPeriodo(
      companyId,
      new Date(`${diaUtc}T00:00:00.000Z`),
      new Date(`${diaUtc}T23:59:59.999Z`),
    )
    // ⚠️ NÃO é zero: o recorte antigo pegava só o que caiu DEPOIS das 21h de SP e perdia o
    // resto do dia. O estrago é pior que "some tudo" — é uma lista PARCIAL, que parece certa.
    expect(cs).toHaveLength(2)
    expect(cs.length).toBeLessThan(3)
  })

  it('⛔ e o dia ANTERIOR não vaza pro de hoje (a janela não empresta 3 horas do vizinho)', async () => {
    const { de, ate } = janelaDoDiaSP('2026-09-04', '2026-09-04')
    expect(await conclusoesNoPeriodo(companyId, de, ate), 'lote de 05/09 caiu no dia 4').toHaveLength(0)
  })

  it('⭐ e "semana" continua trazendo tudo (era o sintoma que denunciou o bug)', async () => {
    const { de, ate } = janelaDoDiaSP('2026-08-30', diaEmSaoPaulo(QUANDO_ELE_OLHOU))
    expect(await conclusoesNoPeriodo(companyId, de, ate)).toHaveLength(3)
  })
})
