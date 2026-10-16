/**
 * ⛔⛔⛔ **A LEI DA DATA — e o caso de 16/10 reproduzido ao segundo (16/10/2026).**
 *
 * O caso real, medido em prod: os dois relatórios da quinta 15/10 entraram às **03:40:04** e
 * **03:40:20** de 16/10, e o de PRODUTOS foi apontado pra **16/10** — uma sexta que nem abriu.
 * 15/10 ficou com R$ 769 (só os sabores) e 16/10 com R$ 13.749.
 *
 * ⚠️⚠️ **A REGRA MAIS IMPORTANTE DESTE ARQUIVO É A QUE EXIGE SILÊNCIO:** *"rotina normal: zero
 * perguntas"*. A rotina medida da casa é **madrugada importando o dia ANTERIOR** (13/10 04:19→
 * 12/10 · 14/10 03:24→13/10 · 15/10 03:43→14/10) — e ela passa **calada** em todos os testes
 * abaixo. Uma lei que perguntasse ali seria pior que o defeito: ele racha um dia de vez em
 * quando, e o ruído diário ensina o dono a confirmar sem ler (os 111 falsos de 26/08).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  avaliarDiaDoRelatorio,
  exigirDiaDecidido,
  DiaNaoConfirmadoError,
  nomeDoDia,
  MADRUGADA_ATE_HORA,
  MESMO_LOTE_MINUTOS,
} from '../lei-da-data'

/** 16/10/2026 03:40:04 em São Paulo = 06:40:04 UTC — o instante REAL do import de prod */
const MADRUGADA_16 = new Date('2026-10-16T06:40:04.000Z')
/** 16/10/2026 14:00 em São Paulo — horário comercial do mesmo dia */
const TARDE_16 = new Date('2026-10-16T17:00:00.000Z')

describe('⭐⭐ o caso REAL de 16/10 — a pergunta que não existia', () => {
  it('⛔⛔ madrugada apontando pra HOJE: a lei PERGUNTA e aposta em ONTEM', () => {
    const v = avaliarDiaDoRelatorio({ diaEscolhido: '2026-10-16', agora: MADRUGADA_16 })

    expect(v.decisao).toBe('PERGUNTA')
    expect(v.porque).toBe('MADRUGADA')
    expect(v.dia, 'a aposta é a quinta 15/10').toBe('2026-10-15')
    expect(v.frase).toContain('quinta 15/10')
    expect(v.frase).toContain('03h')
    // ⭐ as duas opções, na mão, com a sugerida primeiro
    expect(v.opcoes.map((o) => o.dia)).toEqual(['2026-10-15', '2026-10-16'])
    expect(v.opcoes[1].rotulo).toContain('é de hoje mesmo')
  })

  it('⭐⭐ a ROTINA passa CALADA — madrugada apontando pra ONTEM', () => {
    /** 13/10 04:19→12/10 · 14/10 03:24→13/10 · 15/10 03:43→14/10: os três dias medidos */
    for (const [agora, dia] of [
      ['2026-10-13T07:19:00.000Z', '2026-10-12'],
      ['2026-10-14T06:24:00.000Z', '2026-10-13'],
      ['2026-10-15T06:43:00.000Z', '2026-10-14'],
    ] as const) {
      const v = avaliarDiaDoRelatorio({ diaEscolhido: dia, agora: new Date(agora) })
      expect(v.decisao, `${agora} → ${dia}`).toBe('ACEITA')
      expect(v.frase, 'zero pergunta na rotina').toBeNull()
      expect(v.porque).toBe('DONO')
    }
  })

  it('⭐ de DIA apontando pra hoje passa calado — a madrugada é que é a evidência', () => {
    const v = avaliarDiaDoRelatorio({ diaEscolhido: '2026-10-16', agora: TARDE_16 })
    expect(v.decisao).toBe('ACEITA')
    expect(v.frase).toBeNull()
  })

  it(`⛔ a janela da madrugada é ${MADRUGADA_ATE_HORA}h — na borda ela já não morde`, () => {
    // 06:00 em São Paulo = 09:00 UTC
    const v = avaliarDiaDoRelatorio({ diaEscolhido: '2026-10-16', agora: new Date('2026-10-16T09:00:00.000Z') })
    expect(v.decisao).toBe('ACEITA')
  })
})

describe('⛔ dia FUTURO é RECUSA, não pergunta', () => {
  it('⛔⛔ não existe venda de dia que não aconteceu — e confirmar não resolve', () => {
    const i = { diaEscolhido: '2026-10-20', agora: TARDE_16 }
    const v = avaliarDiaDoRelatorio(i)
    expect(v.decisao).toBe('RECUSA')
    expect(v.porque).toBe('FUTURO')
    expect(v.opcoes, 'botão que não resolve nada é ruído').toHaveLength(0)
    // ⛔ e o `confirmouDia` NÃO abre a porta do futuro
    expect(() => exigirDiaDecidido({ ...i, confirmouDia: '2026-10-20' })).toThrow(DiaNaoConfirmadoError)
  })

  it('⭐ o dia de HOJE não é futuro', () => {
    expect(avaliarDiaDoRelatorio({ diaEscolhido: '2026-10-16', agora: TARDE_16 }).decisao).toBe('ACEITA')
  })
})

describe('⛔⛔ o IRMÃO do mesmo lote em outro dia — o estado que RACHA o dia', () => {
  it('⭐⭐ produtos 16/10 com os complementos de 15/10 entrando 16s antes: PERGUNTA', () => {
    const v = avaliarDiaDoRelatorio({
      diaEscolhido: '2026-10-16',
      agora: MADRUGADA_16,
      irmao: { dia: '2026-10-15', importadoEm: new Date('2026-10-16T06:39:48.000Z') },
    })
    expect(v.decisao).toBe('PERGUNTA')
    expect(v.dia).toBe('2026-10-15')
    expect(v.frase).toContain('um fica com o faturamento e o outro com os sabores')
    expect(v.opcoes[1].rotulo).toContain('dias diferentes mesmo')
  })

  it('⭐ o irmão no MESMO dia não diz nada', () => {
    const v = avaliarDiaDoRelatorio({
      diaEscolhido: '2026-10-15',
      agora: new Date('2026-10-16T06:40:20.000Z'),
      irmao: { dia: '2026-10-15', importadoEm: new Date('2026-10-16T06:40:04.000Z') },
    })
    expect(v.decisao).toBe('ACEITA')
  })

  it(`⛔⛔ fora da janela de ${MESMO_LOTE_MINUTOS} min não é "mesmo lote" — o batch passa calado`, () => {
    /**
     * ⚠️ É a régua que impede o ruído: o dono subindo o dia de ontem às 3h, tendo subido o par
     * de anteontem às 3h do dia anterior, **não** está rachando dia nenhum.
     */
    const v = avaliarDiaDoRelatorio({
      diaEscolhido: '2026-10-15',
      agora: TARDE_16,
      irmao: { dia: '2026-10-14', importadoEm: new Date('2026-10-15T06:40:00.000Z') },
    })
    expect(v.decisao).toBe('ACEITA')
  })

  it('⛔ dias DISTANTES no mesmo lote não é racha — é o dono recuperando atraso', () => {
    const v = avaliarDiaDoRelatorio({
      diaEscolhido: '2026-10-15',
      agora: TARDE_16,
      irmao: { dia: '2026-10-02', importadoEm: new Date('2026-10-16T16:59:00.000Z') },
    })
    expect(v.decisao, 'treze dias de distância não é troca de ontem por hoje').toBe('ACEITA')
  })
})

describe('⭐ 1º DEGRAU — o arquivo manda (construído e dormente)', () => {
  it('⭐ arquivo e dono concordando: ACEITA, e o degrau fica NOMEADO', () => {
    const v = avaliarDiaDoRelatorio({
      diaEscolhido: '2026-10-15',
      diaDoArquivo: '2026-10-15',
      agora: MADRUGADA_16,
    })
    expect(v.decisao).toBe('ACEITA')
    expect(v.porque, 'quem decidiu foi o ARQUIVO, não o dono').toBe('ARQUIVO')
  })

  it('⛔⛔ arquivo discordando do dono: PERGUNTA, com o documento na frente', () => {
    const v = avaliarDiaDoRelatorio({
      diaEscolhido: '2026-10-16',
      diaDoArquivo: '2026-10-15',
      agora: TARDE_16,
    })
    expect(v.decisao).toBe('PERGUNTA')
    expect(v.porque).toBe('ARQUIVO_DISCORDA')
    expect(v.opcoes[0].rotulo).toContain('o arquivo diz')
  })

  it('⭐⭐ o arquivo GANHA da madrugada — documento é mais forte que heurística de hora', () => {
    /**
     * ⚠️ É a ordem dos degraus valendo: com o arquivo declarando o MESMO dia que o dono
     * apontou, nem a madrugada pergunta. *Heurística de hora não discute com documento.*
     */
    const v = avaliarDiaDoRelatorio({
      diaEscolhido: '2026-10-16',
      diaDoArquivo: '2026-10-16',
      agora: MADRUGADA_16,
    })
    expect(v.decisao).toBe('ACEITA')
    expect(v.porque).toBe('ARQUIVO')
  })
})

describe('⛔⛔ a resposta do dono NÃO é um `force`', () => {
  const caso = { diaEscolhido: '2026-10-16', agora: MADRUGADA_16 }

  it('⭐ respondendo uma das OPÇÕES, passa', () => {
    expect(exigirDiaDecidido({ ...caso, confirmouDia: '2026-10-15' })).toBe('2026-10-15')
    expect(exigirDiaDecidido({ ...caso, confirmouDia: '2026-10-16' })).toBe('2026-10-16')
  })

  it('⛔⛔ respondendo um dia QUALQUER, continua recusando', () => {
    /** aceitar valor fora das opções transformaria o campo num `force` (a régua de 07/09) */
    expect(() => exigirDiaDecidido({ ...caso, confirmouDia: '2026-09-01' })).toThrow(DiaNaoConfirmadoError)
    expect(() => exigirDiaDecidido({ ...caso, confirmouDia: '' })).toThrow(DiaNaoConfirmadoError)
    expect(() => exigirDiaDecidido(caso)).toThrow(DiaNaoConfirmadoError)
  })

  it('⭐ o erro CARREGA o veredicto — a tela desenha os botões sem recalcular nada', () => {
    try {
      exigirDiaDecidido(caso)
      expect.fail('devia ter lançado')
    } catch (e) {
      expect(e).toBeInstanceOf(DiaNaoConfirmadoError)
      const v = (e as DiaNaoConfirmadoError).veredicto
      expect(v.opcoes).toHaveLength(2)
      expect(v.frase).toContain('quinta 15/10')
    }
  })

  it('⭐ a rotina não precisa confirmar nada', () => {
    expect(exigirDiaDecidido({ diaEscolhido: '2026-10-15', agora: MADRUGADA_16 })).toBe('2026-10-15')
  })
})

describe('⭐ o nome do dia sai do TEXTO, nunca de `new Date(dia)`', () => {
  it('⛔ 15/10/2026 é QUINTA — e o fuso não desloca', () => {
    /** `new Date('2026-10-15')` em -03:00 vira 14/10 21h: foi a cicatriz do fmt de 21/08 */
    expect(nomeDoDia('2026-10-15')).toBe('quinta 15/10')
    expect(nomeDoDia('2026-10-16')).toBe('sexta 16/10')
    expect(nomeDoDia('2026-10-01')).toBe('quinta 01/10')
  })
})

describe('⛔⛔ a lei é NOW-INDEPENDENTE por construção', () => {
  it('⭐⭐ o módulo não lê o relógio em lugar nenhum — o `agora` entra por parâmetro', () => {
    /**
     * ⚠️⚠️ **Por que isto vale mais que "as datas do teste estão no passado":** as âncoras
     * daqui são o INSTANTE REAL do caso de 16/10 (evidência de um fato), e um teste que as
     * movesse pro passado perderia a fidelidade sem ganhar garantia. ⭐ O que de fato impede
     * bomba de calendário é o módulo **não ter como** olhar o relógio: sem `new Date()`
     * interno, a mesma entrada dá a mesma resposta hoje, amanhã e em 2030.
     *
     * ⛔ É a régua de 13/08 em forma de teste: *"o relógio serve pra exibir hoje na tela,
     * nunca pra decidir"*.
     */
    const src = readFileSync(join(process.cwd(), 'lib/stock/vendas/lei-da-data.ts'), 'utf8')
    const sem = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
    expect(sem, 'relógio dentro da lei seria a 2ª fonte da decisão').not.toMatch(/new Date\(\s*\)/)
    expect(sem).not.toMatch(/Date\.now\(/)
  })

  it('⭐ a MESMA entrada devolve a MESMA resposta em qualquer ordem de execução', () => {
    const entrada = { diaEscolhido: '2026-10-16', agora: MADRUGADA_16 }
    const a = avaliarDiaDoRelatorio(entrada)
    const b = avaliarDiaDoRelatorio(entrada)
    expect(a).toEqual(b)
  })
})
