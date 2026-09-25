/**
 * ⭐⭐⭐ DATA DISTANTE PERGUNTA, NÃO RECUSA (25/09/2026) — régua do dono.
 *
 * **O caso da LAMANA:** venceu **15/09**, paga **21/09** — seis dias de atraso, rotina de
 * caixa. A conciliação respondia *"Datas distantes — 6 dias. Máximo 5"* **sem porta**.
 *
 * ⭐ *"A régua de datas existe pra evitar casamento ERRADO, não pra proibir atraso
 * VERDADEIRO."* Mesma família da diferença de valor (24/09): **o sinal vira pergunta**, a
 * resposta viaja no gesto e fica no rastro.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  avaliarDistanciaDeDatas, rastroDaDistancia, diasEntre,
  PASSA_DIRETO_DIAS, JANELA_ESTENDIDA_DIAS,
} from '../regua-da-data'
import { montarRastro } from '../rastro-da-conciliacao'

const ler = (p: string) => readFileSync(join(process.cwd(), p), 'utf-8')
/** ⚠️ sem comentário: o arquivo que DOCUMENTA o defeito não pode ser o que o absolve */
const semComentario = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
/** as datas do módulo são carimbadas ao MEIO-DIA UTC — é a convenção do banco */
const d = (iso: string) => new Date(`${iso}T12:00:00.000Z`)

/** ⭐ o caso REAL que abriu a frente */
const LAMANA_VENC = d('2026-09-15')
const LAMANA_PAGO = d('2026-09-21')

describe('⛔⛔ o caso da LAMANA — 6 dias de atraso deixa de ser muro', () => {
  it('⛔ SEM confirmar, o Conciliar NÃO acende — a pergunta é de verdade', () => {
    const v = avaliarDistanciaDeDatas(LAMANA_PAGO, LAMANA_VENC)
    expect(v.dias).toBe(6)
    expect(v.degrau).toBe('PERGUNTA')
    expect(v.podeFechar, 'passou sem o dono responder — a trava virou enfeite').toBe(false)
  })

  it('⭐ CONFIRMANDO os 6 dias, concilia', () => {
    const v = avaliarDistanciaDeDatas(LAMANA_PAGO, LAMANA_VENC, 6)
    expect(v.podeFechar).toBe(true)
  })

  it('⛔⛔ e NÃO é um `force`: número que não bate com os dias reais continua recusado', () => {
    /**
     * ⚠️ É a mesma régua do `diferencaAceita` (07/09): *bater exato é o que separa "vi os 6
     * dias e aceito" de "ignora a trava"*. Sem isto, bastaria mandar qualquer número.
     */
    expect(avaliarDistanciaDeDatas(LAMANA_PAGO, LAMANA_VENC, 1).podeFechar).toBe(false)
    expect(avaliarDistanciaDeDatas(LAMANA_PAGO, LAMANA_VENC, 60).podeFechar).toBe(false)
    expect(avaliarDistanciaDeDatas(LAMANA_PAGO, LAMANA_VENC, 0).podeFechar).toBe(false)
  })

  it('⭐ a pergunta diz AS DUAS DATAS e o sentido — nunca só "datas distantes"', () => {
    const v = avaliarDistanciaDeDatas(LAMANA_PAGO, LAMANA_VENC)
    expect(v.frase).toContain('15/09')
    expect(v.frase).toContain('21/09')
    expect(v.frase).toContain('6 dias depois')
    expect(v.frase).toContain('Foi pago com atraso?')
    expect(v.rotuloDaConfirmacao).toBe('sim, pago atrasado')
  })

  it('⭐ e o rastro NOMEIA o sentido — "distância" faria o contador perguntar pra que lado', () => {
    expect(rastroDaDistancia(6, 'ATRASO')).toBe('6 dias de atraso, confirmado por quem conciliou')
    expect(rastroDaDistancia(6, 'ADIANTAMENTO')).toBe('6 dias de adiantamento, confirmado por quem conciliou')
    // ⛔ dentro dos 5 dias não há o que registrar
    expect(rastroDaDistancia(3, 'ATRASO')).toBeNull()
  })
})

describe('⭐ os três degraus', () => {
  it('⭐ até 5 dias PASSA direto, sem pergunta nenhuma', () => {
    for (const n of [0, 1, 5]) {
      const v = avaliarDistanciaDeDatas(d('2026-09-21'), new Date(d('2026-09-21').getTime() - n * 86_400_000))
      expect(v.degrau, `${n} dias devia passar direto`).toBe('PASSA')
      expect(v.podeFechar).toBe(true)
      expect(v.frase, 'o que passa direto não faz pergunta').toBe('')
    }
  })

  it('⭐ de 6 a 45 PERGUNTA', () => {
    for (const n of [6, 30, JANELA_ESTENDIDA_DIAS]) {
      const v = avaliarDistanciaDeDatas(d('2026-09-21'), new Date(d('2026-09-21').getTime() - n * 86_400_000))
      expect(v.degrau, `${n} dias devia perguntar`).toBe('PERGUNTA')
    }
  })

  it('⛔⛔ acima de 45 RECUSA — e a recusa ENSINA a saída', () => {
    const v = avaliarDistanciaDeDatas(d('2026-09-21'), d('2026-07-21')) // 62 dias
    expect(v.dias).toBe(62)
    expect(v.degrau).toBe('RECUSA')
    // ⛔ confirmar NÃO abre a porta aqui — senão o teto não existe
    expect(avaliarDistanciaDeDatas(d('2026-09-21'), d('2026-07-21'), 62).podeFechar).toBe(false)
    // ⭐ e ela diz PRA ONDE ir: recusa sem caminho é o beco de novo
    expect(v.frase).toContain('procurar outra')
    expect(v.frase).toContain('sem janela de data')
  })
})

describe('⭐ ADIANTAMENTO não é chamado de atraso', () => {
  /**
   * ⚠️ A caixa da Caçula tem várias linhas *"pago N dias antes de vencer"*. Perguntar *"foi
   * pago com atraso?"* sobre um adiantamento é o sistema errando o nome do fato na cara de
   * quem sabe a verdade.
   */
  it('⭐ pago 10 dias ANTES do vencimento', () => {
    const v = avaliarDistanciaDeDatas(d('2026-09-05'), d('2026-09-15'))
    expect(v.sentido).toBe('ADIANTAMENTO')
    expect(v.frase).toContain('10 dias antes')
    expect(v.frase).toContain('Foi pago adiantado?')
    expect(v.rotuloDaConfirmacao).toBe('sim, pago adiantado')
    expect(rastroDaDistancia(v.dias, v.sentido)).toContain('adiantamento')
  })

  it('⭐ mesmo dia não tem sentido nenhum, e passa', () => {
    const v = avaliarDistanciaDeDatas(d('2026-09-15'), d('2026-09-15'))
    expect(v.sentido).toBe('MESMO_DIA')
    expect(v.degrau).toBe('PASSA')
  })
})

describe('⛔⛔ a régua tem UM DONO — a tela pergunta o que o servidor exige', () => {
  it('⭐ o SERVIDOR consome a régua, e a régua velha MORREU', () => {
    const r = semComentario(ler('lib/conciliacao/reconcile.ts'))
    expect(r, 'o servidor tem régua própria de novo').toContain('avaliarDistanciaDeDatas(ofx.date, candidateDate, input.distanciaAceita)')
    expect(r, 'o `MAX_DAYS_APART` voltou como constante órfã — a 2ª régua esperando religar')
      .not.toContain('MAX_DAYS_APART')
    // ⛔ e a recusa seca de antes não pode voltar
    expect(r).not.toMatch(/if \(days > /)
  })

  it('⭐ a TELA consome a MESMA função — nunca uma cópia', () => {
    const t = semComentario(ler('components/conciliacao/caixa-de-entrada.tsx'))
    expect(t).toContain("from '@/lib/conciliacao/regua-da-data'")
    expect(t).toContain('avaliarDistanciaDeDatas(')
  })

  it('⛔⛔ e a resposta CHEGA NO GESTO — coletar e não enviar foi o bug de 12/09', () => {
    const t = semComentario(ler('components/conciliacao/caixa-de-entrada.tsx'))
    // ⭐ o que morde é o campo dentro do CORPO que o gesto monta
    const i = t.indexOf('const comDiferenca =')
    const corpo = t.slice(i, i + 900)
    expect(corpo, 'a confirmação do atraso ficou num estado de tela que ninguém envia')
      .toContain('distanciaAceita: vdata.dias')
  })

  it('⛔⛔ e a ROTA declara o campo — o que o schema não declara SOME em silêncio', () => {
    /** ⚠️ a cicatriz do `empresaId` do lote (23/09): zod recorta, e a tela promete sozinha */
    const r = semComentario(ler('app/api/conciliacao/resolver/route.ts'))
    expect(r).toMatch(/distanciaAceita: z\./)
    const c = semComentario(ler('app/api/conciliacao/confirmar/route.ts'))
    expect(c).toMatch(/distanciaAceita: z\./)
  })
})

describe('⭐⭐ O CASO COMBINADO — atrasou E pagou juros, um confirmar só', () => {
  /**
   * ⭐ É o caso COMUM (o dono nomeou): *"se tiver diferença de valor TAMBÉM (juros do
   * atraso), as DUAS perguntas aparecem juntas no mesmo card e um confirmar só resolve"*.
   */
  const t = semComentario(ler('components/conciliacao/caixa-de-entrada.tsx'))

  it('⭐ o botão espera AS DUAS respostas', () => {
    /**
     * ⚠️⚠️ **A 1ª VERSÃO VEIO VERDE COM O DEFEITO REPOSTO.** Eu procurava a frase
     * `!difRespondida || !dataRespondida` no arquivo — e ela também aparece no **AVISO**
     * logo abaixo, então liberar o BOTÃO deixava o teste passar. *"Menção, não uso"* de
     * novo. ⭐ O que morde é ancorar no `disabled=` do próprio botão.
     */
    const i = t.indexOf('onClick={() => onGesto(l, l.palpite!.acao, comDiferenca(')
    const botao = t.slice(Math.max(0, i - 400), i)
    expect(botao, 'o botão parou de esperar a confirmação do atraso')
      .toContain('!dataRespondida')
  })

  it('⛔ e o aviso do que falta DIZ as duas quando faltam as duas', () => {
    expect(t, 'botão travado mudo é o dono adivinhando')
      .toContain('responda o atraso e a diferença')
  })

  it('⭐ o corpo do gesto leva as DUAS confirmações juntas', () => {
    const i = t.indexOf('const comDiferenca =')
    const corpo = t.slice(i, i + 900)
    expect(corpo).toContain('diferencaAceita: vd.diferenca')
    expect(corpo).toContain('distanciaAceita: vdata.dias')
  })

  it('⭐⭐ e o RASTRO guarda as duas — meia história é o contador sem resposta', () => {
    /**
     * ⚠️⚠️ **ESTE TESTE VEIO VERDE COM O RASTRO ARRANCADO**, porque ele conferia a MENÇÃO
     * (`rastroDaDistancia(`) dentro de uma função que só roda com banco. ⭐ O problema era
     * de DESENHO: a regra morava enterrada em 300 linhas. Extraída pra `montarRastro`, ela
     * é EXECUTADA aqui — com os números reais da LAMANA.
     */
    const os_dois = montarRastro({
      dataDaLinha: '2026-09-21', valorDaLinha: 918.46,
      diferenca: { valor: 35.12, motivo: 'JUROS' },
      distancia: { dias: 6, sentido: 'ATRASO' },
    })
    expect(os_dois).toContain('R$ 35.12')
    expect(os_dois, 'o rastro do atraso sumiu — a conta guarda meia história')
      .toContain('6 dias de atraso, confirmado por quem conciliou')
    // ⭐ UM rastro com os dois pedaços, nunca dois textos brigando pelo mesmo campo
    expect((os_dois!.match(/pagamento conciliado/g) ?? []).length).toBe(1)
  })

  it('⭐ e cada confirmação sozinha também fica escrita', () => {
    expect(montarRastro({
      dataDaLinha: '2026-09-21', valorDaLinha: 918.46,
      distancia: { dias: 6, sentido: 'ATRASO' },
    })).toContain('6 dias de atraso')
    expect(montarRastro({
      dataDaLinha: '2026-09-21', valorDaLinha: 918.46,
      diferenca: { valor: 35.12, motivo: 'JUROS' },
    })).toContain('R$ 35.12')
    // ⛔ conciliação limpa não ganha nota nenhuma
    expect(montarRastro({ dataDaLinha: '2026-09-21', valorDaLinha: 918.46 })).toBeNull()
  })
})

describe('⭐ o caminho manual continua sem teto (senão o beco só mudou de sala)', () => {
  it('⛔ o Find & Match aceita janela `all`', () => {
    const f = semComentario(ler('app/api/conciliacao/find-and-match/route.ts'))
    expect(f).toContain("data.windowDays !== 'all'")
  })

  it('⛔⛔ e a gravação de lá PULA esta pré-validação (allowMultiReconcile)', () => {
    /**
     * ⚠️ Medido antes de prometer a saída: a gravação do Find & Match passa pelo MESMO
     * `reconcileTransactions`. Se ela caísse no teto, a recusa de 62 dias mandaria o dono
     * pra uma sala onde o muro é o mesmo.
     */
    const rota = semComentario(ler('app/api/conciliacao/find-and-match/reconcile/route.ts'))
    expect(rota).toContain('allowMultiReconcile: true')
    const r = semComentario(ler('lib/conciliacao/reconcile.ts'))
    expect(r).toContain('if (!input.force && !input.allowMultiReconcile)')
  })
})

describe('⭐ dias inteiros de calendário', () => {
  it('⛔ arredonda, não trunca — as datas são carimbadas ao meio-dia UTC', () => {
    expect(diasEntre(d('2026-09-21'), d('2026-09-15'))).toBe(6)
    expect(diasEntre(d('2026-09-15'), d('2026-09-21'))).toBe(6)
    expect(PASSA_DIRETO_DIAS).toBe(5)
  })
})
