// ⛔⛔⛔ A TELA COLETAVA A RESPOSTA DO DIA E NÃO A MANDAVA NO CONFIRMAR (19/10/2026)
//
// O dono respondeu *"17/10 (dias diferentes mesmo)"*, o preview montou (200), ele clicou
// "Confirmar e baixar 17/10/2026" — e o corpo do confirmar **não levava `confirmouDia`**. O
// servidor re-avaliou a lei da data (é o FREIO), devolveu 409, e a linha do 409 fechava o
// modal e **reabria a MESMA pergunta**: laço, nada gravava nunca. nginx de 17/10:
// `409 · 409 · 200 · 409 · 409 · 200` e o dono desistiu.
//
// ⚠️ É a FAMÍLIA de 12/09 (*"o card perguntava a natureza da diferença e postava só os
// candidateIds"*): **o que a tela COLETA, a tela MANDA** — e por isso este guard olha o CORPO
// DO GESTO, nunca a menção do símbolo no arquivo.
//
// ⚠️ ESTE GUARD É ESTRUTURAL E ASSUMIDO COMO TAL: o projeto roda em `environment: node`, sem
// jsdom, então não dá pra clicar e inspecionar o `fetch`. Ele trava o que quebrou de fato (o
// campo sumir do corpo) e tem AUTO-TESTE do detector nos dois sentidos — senão passaria verde
// por cegueira, que é como três guards desta casa nasceram mentindo.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { semComentarios, telasDoApp, usosDe } from './_leitura-de-fonte'

const raiz = join(__dirname, '..', '..')
const ler = (p: string) => readFileSync(join(raiz, p), 'utf8')

const TELA = 'app/(dashboard)/empresas/[id]/estoque/vendas/page.tsx'
const tela = ler(TELA)

/**
 * ⭐⭐ AS DUAS ROTAS QUE RODAM A LEI DA DATA — medido, não suposto: são as únicas que chamam
 * `exigirDiaDecidido` (`app/api/.../vendas/processar` e `.../vendas/complementos`).
 *
 * ⚠️ O backtick no fim do padrão NÃO é enfeite: `vendas/complementos/baixa` é outra rota (a da
 * prateleira) e **não** roda a lei — sem o fecha-template ela entraria aqui e o guard cobraria
 * um campo que aquele gesto não tem o que fazer com.
 */
const ROTAS_DA_LEI = [/vendas\/processar`/, /vendas\/complementos`/]
const falaComALei = (s: string) => ROTAS_DA_LEI.some((r) => r.test(s))

/** início de cada função declarada no corpo de um componente — o bloco é daí até a próxima */
const INICIO_DE_FUNCAO = /(?:const|function)\s+([A-Za-z_$][\w$]*)\s*(?::[^=\n]*)?=?\s*(?:async\s*)?\(/g

interface Gesto {
  arquivo: string
  funcao: string
  /** o literal do corpo, exatamente como ele vai pro `JSON.stringify` */
  corpo: string
}

/**
 * ⭐ Os CORPOS que chegam às rotas da lei, por FUNÇÃO — é o recorte que mantém o guard
 * route-aware **e** literal-a-literal.
 *
 * ⛔ Route-aware porque o `/vendas/manual` mora na MESMA tela, manda `confirmar: true` e **não**
 * roda a lei: cobrar o campo dele seria alarme falso no dia 1.
 * ⛔ Literal-a-literal porque o `confirmar` tem DOIS ramos (reprocesso × import) e só um deles
 * passa pela lei — um recorte por função trataria os dois como um.
 */
export function corposQueVaoProGestoDaLei(fonte: string, arquivo: string): Gesto[] {
  const limpo = semComentarios(fonte)

  const blocos: { nome: string; ini: number; fim: number }[] = []
  for (const m of limpo.matchAll(INICIO_DE_FUNCAO)) {
    const b = corpoDaFuncao(limpo, m.index!)
    if (b) blocos.push({ nome: m[1], ini: b.ini, fim: b.fim })
  }

  const out: Gesto[] = []
  /**
   * ⚠️⚠️ `fetch*` COM GENÉRICO ENTRE O NOME E O PARÊNTESE — a cicatriz de 20/09, repetida aqui:
   * o padrão da casa é `fetchComTimeout<{ recibo: Recibo }>(…)`, e um detector que procura
   * `fetch(` literal nasce **cego justamente nas telas que seguem a régua**. Com `fetch(` seco
   * esta versão achou 3 corpos e perdeu os DOIS gestos que gravam — os do defeito.
   */
  for (const f of limpo.matchAll(/\bfetch\w*\s*(?:<[^>]*>)?\s*\(/g)) {
    /**
     * ⛔⛔ O DETECTOR PARTE DO **FETCH**, não de "literal que fala `confirmar`" (19/10/2026).
     *
     * As duas versões anteriores davam FALSO VERMELHO na tela CERTA: `onConfirmar={confirmar}`
     * é um literal que contém `confirmar` e não é corpo de POST nenhum. ⭐ Partindo do fetch, o
     * recorte é **o corpo que vai pra aquela URL** — que é exatamente a pergunta do guard.
     */
    const chamada = entreParenteses(limpo, f.index! + f[0].length - 1)
    if (!falaComALei(chamada)) continue

    const dono = blocos
      .filter((b) => b.ini <= f.index! && f.index! <= b.fim)
      .sort((a, b) => a.fim - a.ini - (b.fim - b.ini))[0]

    const st = /body:\s*JSON\.stringify\s*\(/.exec(chamada)
    if (!st) continue
    const arg = entreParenteses(chamada, st.index! + st[0].length - 1).trim()

    // ⭐ corpo inline (`JSON.stringify({ … })`) ou por variável (`const body = cond ? {A} : {B}`)
    const literais = arg.startsWith('{')
      ? [arg]
      : literaisDaVariavel(dono ? limpo.slice(dono.ini, f.index!) : '', arg)

    for (const corpo of literais.filter((l) => /\bconfirmar\b/.test(l))) {
      out.push({ arquivo, funcao: dono?.nome ?? '(módulo)', corpo })
    }
  }
  return out
}

/** os literais da atribuição mais recente de `nome` antes do fetch — cobre o corpo em ternário */
function literaisDaVariavel(trecho: string, nome: string): string[] {
  const i = trecho.lastIndexOf(`const ${nome} =`)
  if (i < 0) return []
  return [...trecho.slice(i).matchAll(/\{[^{}]*\}/g)].map((m) => m[0])
}

/** o conteúdo entre o parêntese que abre em `abre` e o que o fecha */
function entreParenteses(s: string, abre: number): string {
  let n = 0
  for (let i = abre; i < s.length; i++) {
    if (s[i] === '(') n++
    else if (s[i] === ')' && --n === 0) return s.slice(abre + 1, i)
  }
  return s.slice(abre + 1)
}

/**
 * ⛔⛔ O BLOCO FECHA NA CHAVE QUE O FECHA — **nunca "até a próxima função"** (19/10/2026).
 *
 * ⚠️ A 1ª versão recortava até o início da função seguinte e deu **FALSO VERMELHO numa tela
 * CERTA**: o bloco do `baixarSemOsBarrados` seguia pelo JSX adiante e o recorte casou o
 * `onConfirmar={confirmar}` do modal como se fosse um corpo de POST. ***Janela por distância já
 * produziu falso vermelho E falso verde nesta casa*** — o que delimita um bloco é a chave dele.
 */
function corpoDaFuncao(limpo: string, pos: number): { ini: number; fim: number } | null {
  const fimParams = limpo.indexOf(')', pos)
  if (fimParams < 0) return null
  // ⚠️ seta de corpo-expressão (`=> x ?? y`) não tem bloco: devolve nada em vez de engolir
  // o `{` da função vizinha — era por aí que o recorte vazava.
  const m = /^(?:\s*:[^={]*)?\s*(?:=>)?\s*\{/.exec(limpo.slice(fimParams + 1))
  if (!m) return null
  const abre = fimParams + m[0].length
  let n = 0
  for (let i = abre; i < limpo.length; i++) {
    if (limpo[i] === '{') n++
    else if (limpo[i] === '}' && --n === 0) return { ini: abre, fim: i + 1 }
  }
  return { ini: abre, fim: limpo.length }
}

/** ⭐ o ramo do REPROCESSO é isento: lá a rota usa `data` direto, não há dia a decidir */
const ehReprocesso = (corpo: string) => /\breprocessar\b/.test(corpo)
const levaAResposta = (corpo: string) => /\bconfirmouDia\b/.test(corpo)

describe('⛔⛔⛔ a resposta da pergunta do dia VIAJA no corpo de todo gesto da lei', () => {
  it('⛔⛔ nenhum gesto da tela de vendas manda `confirmar` sem `confirmouDia`', () => {
    const gestos = corposQueVaoProGestoDaLei(tela, TELA)
    // ⚠️ trava a própria coleta: corpo que deixe de casar o recorte sumiria daqui em silêncio
    expect(gestos.length, 'o detector deixou de achar os corpos dos gestos').toBeGreaterThanOrEqual(5)

    const furados = gestos.filter((g) => !ehReprocesso(g.corpo) && !levaAResposta(g.corpo))
    expect(
      furados.map((g) => `${g.funcao}: ${g.corpo.slice(0, 120)}`),
      'gesto que manda confirmar sem a resposta do dia — é o defeito de 17/10',
    ).toEqual([])
  })

  it('⛔⛔ e vale pro APP INTEIRO: gesto novo pra essas rotas nasce com o campo ou fica vermelho', () => {
    const furados = telasDoApp(raiz)
      .flatMap((f) => corposQueVaoProGestoDaLei(ler(f), f))
      .filter((g) => !ehReprocesso(g.corpo) && !levaAResposta(g.corpo))
    expect(furados.map((g) => `${g.arquivo} · ${g.funcao}`)).toEqual([])
  })

  it('⭐ os TRÊS gestos de produtos estão cobertos — preview, confirmar e reenvio-sem-os-barrados', () => {
    const porFuncao = new Map<string, Gesto[]>()
    for (const g of corposQueVaoProGestoDaLei(tela, TELA)) {
      porFuncao.set(g.funcao, [...(porFuncao.get(g.funcao) ?? []), g])
    }
    for (const nome of ['abrirPreview', 'confirmar', 'baixarSemOsBarrados']) {
      const gestos = porFuncao.get(nome)
      expect(gestos, `o gesto ${nome} deixou de falar com a rota da lei`).toBeTruthy()
      // ⭐ cada função tem que ter AO MENOS um corpo que leva a resposta (o do import);
      // o do reprocesso, quando existe, é o isento.
      expect(gestos!.some((g) => levaAResposta(g.corpo)), `${nome} não leva a resposta`).toBe(true)
    }
  })

  it('⭐ e as DUAS rotas ACEITAM o campo — as duas pontas do mesmo fio', () => {
    for (const rota of [
      'app/api/empresas/[id]/estoque/vendas/processar/route.ts',
      'app/api/empresas/[id]/estoque/vendas/complementos/route.ts',
    ]) {
      const src = ler(rota)
      expect(src, `${rota} parou de declarar o campo no zod`).toContain('confirmouDia')
      expect(src, `${rota} parou de consultar a lei`).toContain('exigirDiaDecidido')
    }
  })
})

describe('⛔⛔ a RESPOSTA é estado, e o 409 no confirmar deixou de ser pergunta', () => {
  it('⭐ a resposta mora em ESTADO, não só num argumento que evapora', () => {
    expect(tela).toContain('const [diaConfirmado, setDiaConfirmado] = useState<string | null>(null)')
    // ⛔ e os gestos leem a MESMA função — três montagens à mão divergiriam, e foi uma delas
    // que esqueceu o campo.
    expect(usosDe(tela, 'respostaDoDia')).toBeGreaterThanOrEqual(4)
    expect(tela).toContain('explicito ?? diaConfirmado ?? undefined')
  })

  it('⛔⛔ o 409 COM resposta aceita é defeito nosso: diz a frase e NÃO reabre a pergunta', () => {
    const ramo = ramoDoNoveCentoENove(tela)
    expect(ramo, 'o ramo do CONFIRME_O_DIA sumiu do confirmar').not.toBe('')
    expect(ramo, 'o 409 voltou a ignorar a resposta já aceita').toContain('diaConfirmado')
    expect(ramo, 'o 409 deixou de dizer o que aconteceu').toContain('setErroModal')
    // ⛔ o caminho que fecha o modal e devolve a pergunta só pode existir ATRÁS do gate —
    // incondicional ele é o laço de 17/10 de volta.
    const antesDoGate = ramo.slice(0, ramo.indexOf('diaConfirmado'))
    expect(antesDoGate, 'o setPerguntaDia voltou a rodar antes de olhar a resposta').not.toContain('setPerguntaDia')
  })

  it('⭐ a resposta só é guardada depois que o SERVIDOR a aceitou', () => {
    // ⚠️ guardar no clique faria a tela afirmar uma aceitação que pode não ter acontecido —
    // e aí um 409 legítimo sairia com a frase de "defeito nosso".
    expect(tela).toContain('if (confirmouDia) { setDiaConfirmado(confirmouDia); setData(confirmouDia) }')
  })

  it('⭐ e trocar o dia na mão apaga a resposta — ela é de um PAR de dias, não um passe livre', () => {
    expect(tela).toContain('const escolherData = (dia: string) => { setData(dia); setDiaConfirmado(null) }')
    expect(usosDe(tela, 'escolherData')).toBeGreaterThanOrEqual(4)
  })
})

/** o ramo do 409 dentro do `confirmar`, do `if` até o fallback genérico que vem depois */
function ramoDoNoveCentoENove(fonte: string): string {
  const limpo = semComentarios(fonte)
  const i = limpo.indexOf("if (c?.code === 'CONFIRME_O_DIA'")
  if (i < 0) return ''
  const j = limpo.indexOf('setErroModal(rr.erro', i)
  return limpo.slice(i, j > i ? j : limpo.length)
}

describe('⚠️ AUTO-TESTE DO DETECTOR — ele morde o defeito e não morde o legítimo', () => {
  const fetchFalso = (corpo: string) => `
    const confirmar = async () => {
      const r = await fetch(\`/api/empresas/\${id}/estoque/vendas/processar\`, {
        method: 'POST', body: JSON.stringify(${corpo}),
      })
    }
    const outra = () => {}
  `

  it('⛔ acusa o corpo SEM o campo (o defeito de 17/10)', () => {
    const g = corposQueVaoProGestoDaLei(fetchFalso('{ html, data, confirmar: true, incluir: null }'), 'falso.tsx')
    expect(g).toHaveLength(1)
    expect(levaAResposta(g[0].corpo)).toBe(false)
  })

  it('⭐ aprova o corpo COM o campo', () => {
    const g = corposQueVaoProGestoDaLei(fetchFalso('{ data, confirmar: true, confirmouDia: respostaDoDia() }'), 'falso.tsx')
    expect(g).toHaveLength(1)
    expect(levaAResposta(g[0].corpo)).toBe(true)
  })

  it('⭐ isenta o REPROCESSO — lá a rota usa `data` direto, não há dia a decidir', () => {
    const g = corposQueVaoProGestoDaLei(fetchFalso('{ data: dia, reprocessar: true, confirmar: true }'), 'falso.tsx')
    expect(g).toHaveLength(1)
    expect(ehReprocesso(g[0].corpo)).toBe(true)
  })

  it('⛔⛔ NÃO morde rota que não roda a lei — o /vendas/manual manda confirmar e está certo', () => {
    const manual = `
      const confirmarManual = async () => {
        await fetch(\`/api/empresas/\${id}/estoque/vendas/manual\`, {
          method: 'POST', body: JSON.stringify({ data, confirmar: true, confirmouSanidade }),
        })
      }
      const outra = () => {}
    `
    expect(corposQueVaoProGestoDaLei(manual, 'falso.tsx')).toEqual([])
  })

  it('⛔ e NÃO morde a prateleira de complementos (/complementos/baixa é outra rota)', () => {
    const baixa = `
      const confirmar = async () => {
        await fetch(\`/api/empresas/\${id}/estoque/vendas/complementos/baixa\`, {
          method: 'POST', body: JSON.stringify({ data, confirmar: true }),
        })
      }
      const outra = () => {}
    `
    expect(corposQueVaoProGestoDaLei(baixa, 'falso.tsx')).toEqual([])
  })

  it('⚠️ e o detector lê SEM comentário — o arquivo que documenta o defeito não pode ser o que o absolve', () => {
    const comentado = `
      const confirmar = async () => {
        /* body: JSON.stringify({ html, data, confirmar: true }) — a forma ANTIGA, que morreu */
        await fetch(\`/api/empresas/\${id}/estoque/vendas/processar\`, {
          method: 'POST', body: JSON.stringify({ data, confirmar: true, confirmouDia: respostaDoDia() }),
        })
      }
      const outra = () => {}
    `
    const g = corposQueVaoProGestoDaLei(comentado, 'falso.tsx')
    expect(g).toHaveLength(1)
    expect(levaAResposta(g[0].corpo)).toBe(true)
  })
})
