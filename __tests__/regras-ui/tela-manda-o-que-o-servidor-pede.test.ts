// ⛔⛔⛔ A TELA COLETAVA E NÃO MANDAVA (12/09/2026)
//
// O card do "escolher na mão" perguntava a natureza da diferença, acendia o Conciliar com a
// resposta — e **postava só os `candidateIds`**. O servidor recusava com *"Tolerância
// máxima: R$ 0,02"*, e o dono ficava procurando um erro que não existia.
//
// ⚠️ ESTE GUARD É ESTRUTURAL E ASSUMIDO COMO TAL: o projeto roda em `environment: node`,
// sem jsdom, então não dá pra clicar no botão e inspecionar o `fetch`. Ele trava o que
// quebrou de fato — o campo sumir do corpo do POST — e tem AUTO-TESTE do detector, senão
// passaria verde por cegueira (a lição dos três guards que nasceram mentindo).

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const raiz = join(__dirname, '..', '..')
const card = readFileSync(join(raiz, 'components/conciliacao/escolher-na-mao-card.tsx'), 'utf8')
const rota = readFileSync(join(raiz, 'app/api/conciliacao/find-and-match/reconcile/route.ts'), 'utf8')

/**
 * o corpo do POST que o card monta.
 * ⚠️ O primeiro recorte cortava em `'}),'` e parava no fechamento do spread INTERNO
 * (`...(parcial ? {…} : {})`) — o teste ficou vermelho apontando um campo que estava lá.
 * Agora vai até o `headers`/fim da chamada, que é o fim de verdade.
 */
function corpoDoPost(fonte: string): string {
  const i = fonte.indexOf('body: JSON.stringify({')
  expect(i, 'o card deixou de montar um corpo de POST').toBeGreaterThan(-1)
  const fim = fonte.indexOf('\n      })', i)
  return fonte.slice(i, fim > i ? fim : fonte.length)
}

describe('⛔⛔ o que a tela COLETA, a tela MANDA', () => {
  it('⛔⛔ o card envia a diferença nomeada — era exatamente isto que faltava', () => {
    expect(corpoDoPost(card)).toContain('diferencaNomeada')
  })

  it('⭐ e o servidor ACEITA esse campo — as duas pontas do mesmo fio', () => {
    expect(rota).toContain('diferencaNomeada')
    expect(rota).toContain('servidorAceitaADiferenca')
  })

  it('⛔⛔ a régua de 0,02 SOLTA morreu na rota — ela vive na régua única agora', () => {
    // ⚠️ só no CÓDIGO: o comentário do topo cita a mensagem antiga de propósito, pra quem
    // ler o arquivo em 2027 saber o que existia e por que morreu.
    const codigo = rota.split('\n').filter((l) => !l.trim().startsWith('*') && !l.trim().startsWith('//')).join('\n')
    expect(codigo).not.toContain('SUM_TOLERANCE')
    expect(codigo).not.toContain('Tolerância máxima')
  })

  it('⭐ o card acende o botão pela MESMA função que o servidor aplica', () => {
    expect(card).toContain('avaliarDiferenca')
    expect(card).toContain('veredicto.podeFechar')
  })

  it('⚠️ AUTO-TESTE DO DETECTOR: ele reprova um corpo sem o campo', () => {
    const falso = "body: JSON.stringify({ ofxTransactionId: x, candidateIds: y }),"
    expect(corpoDoPost(falso)).not.toContain('diferencaNomeada')
  })

  it('⛔ e nenhum número de diferença fica solto no componente', () => {
    // `const TETO = 25` e `const TOL = 0.02` viviam aqui — número solto é a segunda régua
    expect(card).not.toMatch(/const TETO = 25\s*$/m)
    expect(card).not.toMatch(/const TOL = 0\.02\s*$/m)
    expect(card).toContain('FECHA_AO_CENTAVO')
  })
})
