/**
 * ⭐⭐⭐ O PALPITE COM DIFERENÇA DEIXA NOMEAR O JURO (24/09/2026).
 *
 * **O dono, no BORTOLAZZO:** *"o palpite mostra «diferença de R$ 2,00 a mais — juros/tarifa?»
 * MAS NÃO TEM COMO RESPONDER — o ✓ Confirmar não pergunta/não deixa nomear os R$ 2,00."*
 *
 * ⛔ É a régua de 23/09 no **segundo caso**: ***toda exigência aponta pra um controle QUE
 * ABRE***. O servidor só fecha com a diferença NOMEADA (`podeFechar: nomeada`) — então a
 * tela exigia uma resposta que ela não oferecia.
 *
 * ⚠️ **A família medida em prod são CINCO palpites, não um** — BORTOLAZZO 2,00 · TOZZO 6,40
 * · LAMANA 35,12 · LATICINIOS 70,58 · DALMOLIN 72,00 = **R$ 186,10** de juros travados.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { avaliarDiferenca, textoDoMotivo, MOTIVOS_DA_DIFERENCA } from '@/lib/conciliacao/regua-da-diferenca'

const ler = (p: string) => readFileSync(join(process.cwd(), p), 'utf-8')
const semComentario = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
const CAIXA = semComentario(ler('components/conciliacao/caixa-de-entrada.tsx'))

describe('⛔⛔ a régua exige nome — e agora a tela oferece o controle', () => {
  it('⭐⭐ O CASO DO BORTOLAZZO: sem nomear NÃO fecha; nomeando fecha', () => {
    const sem = avaliarDiferenca(948.5, 2.0)
    expect(sem.degrau).toBe('OFERECE')
    expect(sem.podeFechar, 'o servidor fecharia sem o dono nomear — isso é inventar juros').toBe(false)
    expect(avaliarDiferenca(948.5, 2.0, true).podeFechar).toBe(true)
  })

  it('⭐ os 5 casos reais de prod, cada um no seu degrau', () => {
    const casos: [string, number, number, string][] = [
      ['BORTOLAZZO', 948.5, 2.0, 'OFERECE'],
      ['TOZZO', 649.6, 6.4, 'OFERECE'],
      ['LAMANA', 918.46, 35.12, 'PERGUNTA'],
      ['LATICINIOS', 2785.7, 70.58, 'PERGUNTA'],
      ['DALMOLIN', 3708.49, 72.0, 'PERGUNTA'],
    ]
    for (const [nome, linha, dif, degrau] of casos) {
      const v = avaliarDiferenca(linha, dif, true)
      expect(v.degrau, nome).toBe(degrau)
      expect(v.podeFechar, `${nome} travado mesmo nomeado`).toBe(true)
    }
  })

  it('⛔ e acima do teto do gesto continua RECUSANDO — a régua não afrouxou', () => {
    // 500 de juros numa linha de 600 não é juros, é outra coisa (a régua de 11/09)
    const v = avaliarDiferenca(600, 500, true)
    expect(v.degrau).toBe('RECUSA')
    expect(v.podeFechar).toBe(false)
  })
})

describe('⭐⭐ o MOTIVO vai pro rastro — e "desconto" não pode virar "juros"', () => {
  it('⛔⛔ o texto segue o motivo escolhido', () => {
    /**
     * ⚠️ Antes era **cravado** em `reconcile.ts` (*"= juros/tarifa de boleto"*), então um
     * DESCONTO — que é o oposto — ficava gravado como juros. ***Número no rastro com o nome
     * errado é pior que número sem nome.***
     */
    expect(textoDoMotivo('JUROS')).toBe('juros de atraso')
    expect(textoDoMotivo('DESCONTO')).toBe('desconto concedido')
    expect(textoDoMotivo('TARIFA')).toBe('tarifa do boleto')
  })

  it('⭐ OUTRO leva a palavra do dono; vazio não vira frase falsa', () => {
    expect(textoDoMotivo('OUTRO', 'correção de preço combinada')).toBe('correção de preço combinada')
    expect(textoDoMotivo('OUTRO', '   ')).toBe('motivo informado pelo dono')
  })

  it('⭐ sem motivo declarado, o texto NÃO inventa um (o genérico honesto de antes)', () => {
    expect(textoDoMotivo(null)).toBe('juros/tarifa de boleto')
  })

  it('⛔ e o rastro usa o dono da frase, nunca um texto cravado', () => {
    /**
     * ⚠️ **REAPONTADO em 25/09 — o alvo MUDOU DE CASA, a régua não.** A montagem do rastro
     * saiu do `reconcile.ts` pra `rastro-da-conciliacao.ts` quando o ATRASO virou o segundo
     * pedaço: enterrada numa função de 300 linhas que só roda com banco, ela **só podia ser
     * testada por menção** — e um guard desses veio verde com o rastro arrancado.
     *
     * ⭐ A pergunta segue a mesma (*o nome vem do motivo do dono, nunca cravado?*); agora
     * ela é feita a quem monta.
     */
    const rec = semComentario(ler('lib/conciliacao/rastro-da-conciliacao.ts'))
    expect(rec, 'o texto do rastro voltou a ser cravado — desconto vira juros de novo')
      .not.toMatch(/= juros\/tarifa de boleto, confirmada/)
    expect(rec).toContain('textoDoMotivo(')
    // ⛔ e o reconcile não pode voltar a montar o texto por conta própria
    expect(semComentario(ler('lib/conciliacao/reconcile.ts')))
      .not.toMatch(/= juros\/tarifa de boleto, confirmada/)
  })
})

describe('⛔⛔⛔ A EXIGÊNCIA APONTA PRO CONTROLE (a régua de 23/09)', () => {
  it('⭐⭐ a tela desenha os motivos como botões que ABREM a escolha', () => {
    expect(CAIXA, 'o controle de nomear a diferença sumiu do palpite')
      .toContain('MOTIVOS_DA_DIFERENCA.map')
    expect(CAIXA).toMatch(/setMotivoDif\(motivoDif === m\.chave \? null : m\.chave\)/)
  })

  it('⛔⛔ o botão TRAVA sem a resposta — e DIZ o que falta', () => {
    /**
     * ⚠️ **REAPONTADO em 25/09 e MAIS FORTE:** o botão passou a esperar TAMBÉM a resposta
     * do atraso (a LAMANA), então o literal `|| !difRespondida}` deixou de existir. A régua
     * não afrouxou — *ele continua travando sem a diferença nomeada*; o que mudou é que
     * agora ele trava por duas razões, e o guard exige as duas.
     */
    expect(CAIXA).toMatch(/\|\| !difRespondida \|\| !dataRespondida\}/)
    expect(CAIXA, 'desabilitado mudo é o dono adivinhando')
      .toContain('diga o que é a diferença ↑')
  })

  it('⭐⭐ e a resposta CHEGA no gesto — coletar e não enviar é o bug de 12/09', () => {
    /**
     * ⚠️ Em 12/09 o card *"coletava o nome da diferença, acendia o botão com ele e NUNCA o
     * enviava"* — o servidor recusava com razão. O que morde é olhar o corpo do gesto.
     */
    expect(CAIXA).toContain('comDiferenca(comCategoria(l.palpite!.alvo))')
    expect(CAIXA).toMatch(/diferencaAceita: vd\.diferenca, motivoDaDiferenca: motivoDif/)
  })

  it('⛔ nenhum motivo nasce PRÉ-SELECIONADO — nomear é um gesto', () => {
    expect(CAIXA).toMatch(/useState<MotivoDaDiferenca \| null>\(null\)/)
  })

  it('⭐⭐ e a régua da tela é a MESMA do servidor (REGRA 4)', () => {
    expect(CAIXA, 'a tela ganhou régua própria de diferença — ela ofereceria o que o servidor recusa')
      .toContain('avaliarDiferenca(linha, round2(linha - d.valor), motivoDif !== null)')
    const rota = semComentario(ler('app/api/conciliacao/resolver/route.ts'))
    expect(rota).toContain('motivoDaDiferenca: z.enum')
  })

  it('⭐ a lista de motivos é FECHADA — o rastro é o que o contador lê', () => {
    expect(MOTIVOS_DA_DIFERENCA.map((m) => m.chave)).toEqual(['JUROS', 'MULTA', 'TARIFA', 'DESCONTO', 'OUTRO'])
  })
})
