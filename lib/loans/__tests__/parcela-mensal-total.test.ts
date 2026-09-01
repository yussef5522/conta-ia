// ⭐⭐ SUBSTITUI UM GREP DE CÓDIGO-FONTE POR UM NÚMERO (01/09/2026).
//
// ⛔ O TESTE QUE MORREU AQUI abria `app/(dashboard)/…/emprestimos/page.tsx` e procurava a
// STRING `/Parcela mensal total/`. Ficou VERMELHO por dias e o grep não sabia dizer se o
// rótulo tinha mudado ou se o CARD estava somando errado — que é a diferença entre um
// vermelho de estilo e um vermelho de dinheiro. **REGRA 3: o teste tem que EXECUTAR.**
//
// ⚠️ Pra isso a soma teve que sair do laço da rota e virar `lib/loans/parcela-mensal-total.ts`.
// Enquanto a régua vivia solta dentro do handler, o número **não tinha como ser conferido**
// sem levantar banco e sessão — e foi por isso que ela acabou guardada por um grep.

import { describe, it, expect } from 'vitest'
import { parcelaMensalTotal, type LinhaParcelaMensal } from '../parcela-mensal-total'

/** a carteira real da Caçula, com os valores documentados de cada contrato */
const BANCARIOS: LinhaParcelaMensal[] = [
  { status: 'ACTIVE', flexible: false, forecastValor: 10234.35 }, // C41033828 #21
  { status: 'ACTIVE', flexible: false, forecastValor: 5951.33 },  // C41022570 #12 (sweep)
  { status: 'ACTIVE', flexible: false, forecastValor: 2927.02 },  // 1837311 #30 (Caixa)
  { status: 'ACTIVE', flexible: false, forecastValor: 7358.36 },  // 1827478 #31
]
/** o mútuo da Arafat: 0%, sem prazo, devolução conforme caixa */
const ARAFAT: LinhaParcelaMensal = { status: 'ACTIVE', flexible: true, forecastValor: 41428.57 }

describe('⭐ o card "Parcela mensal total" soma a PREVISÃO dos contratos ativos', () => {
  it('⭐ os 4 bancários somam R$ 26.471,06 — e o número é conferível', () => {
    expect(parcelaMensalTotal(BANCARIOS).total).toBeCloseTo(26471.06, 2)
  })

  it('⛔⛔ o mútuo FLEXIBLE fica FORA — senão a tela prometeria 67.899,63 por mês', () => {
    // ⚠️ a Arafat tem agenda NOMINAL de 7× 41.428,57, mas a devolução é conforme caixa.
    // Somar isso faria o card anunciar um compromisso mensal que ninguém assumiu — e é
    // justamente o card que o dono usa pra saber quanto precisa ter em conta.
    const comArafat = parcelaMensalTotal([...BANCARIOS, ARAFAT])
    expect(comArafat.total).toBeCloseTo(26471.06, 2)
    expect(comArafat.total).not.toBeCloseTo(67899.63, 2) // o que dava somando tudo
  })

  it('⛔ contrato QUITADO não compromete o mês seguinte', () => {
    const quitado: LinhaParcelaMensal = { status: 'PAID_OFF', flexible: false, forecastValor: 3000 }
    expect(parcelaMensalTotal([...BANCARIOS, quitado]).total).toBeCloseTo(26471.06, 2)
  })

  it('⚠️⚠️ contrato SEM previsão é "a apurar" — NUNCA vira zero calado', () => {
    // pós-fixado sem nenhuma parcela casada: não dá pra prever o débito. Contar como 0
    // baixaria o total e o dono planejaria com um número menor que a realidade. A régua
    // devolve a CONTAGEM, pra tela poder dizer "+ 1 contrato a apurar".
    const semPrev: LinhaParcelaMensal = { status: 'ACTIVE', flexible: false, forecastValor: null }
    const r = parcelaMensalTotal([...BANCARIOS, semPrev])
    expect(r.total).toBeCloseTo(26471.06, 2) // não somou 0 nem inventou valor
    expect(r.semPrevisao).toBe(1)            // mas CONTOU que ficou faltando um
  })

  it('⭐ carteira vazia é 0 sem explodir', () => {
    expect(parcelaMensalTotal([])).toEqual({ total: 0, semPrevisao: 0 })
  })
})
