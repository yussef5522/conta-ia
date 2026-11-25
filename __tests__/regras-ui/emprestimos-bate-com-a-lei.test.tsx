/**
 * ⭐⭐⭐ EMPRÉSTIMOS v1 — o guard TELA × LEI (25/11/2026: docs/emprestimos-referencia.html, R54–R66 · v2: contratos em linhas compactas).
 *
 * ARQUIVO DE REFERÊNCIA = LEI: o guard ABRE o HTML aprovado e
 *  (1) roda os 19 PINOS do último <script> CONTRA A LIB (as funções da lei trocadas pelas da lib —
 *      as amostras e a lista de pinos são as da lei, por valor, não uma cópia minha);
 *  (2) compara os tokens por VALOR (fundo/tintas, sombra sem borda, tintas do hero, chips por credor,
 *      cores da montanha claro E escuro, paleta das barras e dos chips do split);
 *  (3) RENDERIZA as peças com dado (uso, não menção) e lê as telas SEM comentário.
 */
import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import * as lib from '@/lib/loans/carteira'
import * as cheque from '@/lib/loans/cheque-especial'
import * as ficha from '@/lib/loans/ficha'
import {
  HeroCarteira, Montanha, Compromisso, Podio, ChequeEspecial, LinhaContrato, DetalheDaLinha, SplitEmChips, CurvaRealAgenda,
} from '@/components/emprestimos/visual'
import { semComentarios } from './_leitura-de-fonte'

const ler = (rel: string) => readFileSync(join(process.cwd(), rel), 'utf8')
const LEI = ler('docs/emprestimos-referencia.html')
const CSS = ler('app/globals.css')
const SCRIPT = LEI.slice(LEI.lastIndexOf('<script>') + 8, LEI.lastIndexOf('</script>'))
const HEADER = LEI.slice(LEI.indexOf('<!--'), LEI.indexOf('-->'))
const sem = (rel: string) => semComentarios(ler(rel), rel)
const CARTEIRA_TELA = sem('app/(dashboard)/empresas/[id]/emprestimos/page.tsx')
const DETALHE_TELA = sem('app/(dashboard)/empresas/[id]/emprestimos/[loanId]/page.tsx')

describe('a lei é a aprovada', () => {
  it('título EXATO', () => expect(LEI).toContain('<title>EMPRÉSTIMOS (financeiro) — referência v2 APROVADA</title>'))
  it('as leis R54–R66 estão no header', () => {
    for (let r = 54; r <= 66; r++) expect(HEADER).toContain(`R${r} —`)
  })
})

describe('⭐⭐⭐ os 19 PINOS da lei, rodando contra a LIB', () => {
  const trecho = (de: string, ate: string) => {
    const a = SCRIPT.indexOf(de), b = SCRIPT.indexOf(ate)
    expect(a, `a lei perdeu o marco "${de}"`).toBeGreaterThan(-1)
    expect(b, `a lei perdeu o marco "${ate}"`).toBeGreaterThan(a)
    return SCRIPT.slice(a, b)
  }
  // ⚠️ as AMOSTRAS são da lei; as definições de FUNÇÃO da lei são retiradas (as da lib entram no lugar)
  const amostra = trecho('const CONTRATOS', '/* ── funções-lei ── */')
    .replace(/^const REGRAS_JUROS_CHEQUE.*$/m, '')
    .replace(/^function sugereJurosCheque.*$/m, '')
    .replace(/^function somaCheque.*$/m, '')
  const montanha = trecho('/* ── a montanha', '/* ── detalhe')
  const detalhe = trecho('/* ── detalhe', '/* ══════════════════════ PINOS')
  const pinos = trecho('const PINOS', 'function rodaPinos')
  const PINOS: [string, () => boolean][] = new Function(
    '__lib', '__cheque', '__ficha', 'fmt', 'fmtK', 'r2',
    `${amostra}
     const totais = __lib.totais
     const custoAno = () => __lib.custoDoDinheiro({ real: CUSTO26.real, agenda: CUSTO26.agenda }, CHEQUE.map((q) => ({ jurosAno: q.juros26 })))
     const somaCheque = () => __cheque.somaCheque(CHEQUE.map((q) => ({ jurosAno: q.juros26 })))
     const sugereJurosCheque = __cheque.sugereJurosCheque
     const pico = __lib.pico
     const livreEm = __lib.livreEm
     const compromisso = (m) => __lib.valorDoMes(COMPROMISSO, m)
     const custoRank = __lib.rankingDeCusto
     const progresso = __lib.progresso
     const rotEst = __lib.rotuloEstimado
     const encargoApurado = __lib.encargoApurado
     const somaPedacos = __lib.somaPedacos
     const destinoExclusao = __ficha.destinoExclusao
     const somaGrupo = __lib.somaGrupo
     const linhaResumo = __lib.linhaResumo
     ${montanha}
     ${detalhe}
     ${pinos}
     return PINOS`,
  )(lib, cheque, ficha, lib.fmt, lib.fmtK, lib.r2)
  it('a lei tem 19 pinos (o guard não passa por lista vazia)', () => expect(PINOS).toHaveLength(19))
  for (const [nome, fn] of PINOS) it(`pino: ${nome}`, () => expect(fn()).toBe(true))
})

describe('tokens por VALOR', () => {
  const raizDaLei = (nome: string) => {
    const bloco = LEI.slice(LEI.indexOf(':root{'), LEI.indexOf('}', LEI.indexOf(':root{')))
    const m = new RegExp(`--${nome}:([^;]+);`).exec(bloco)
    return m ? m[1].trim().replace(/\s+/g, '') : null
  }
  const raizDoApp = (nome: string) => {
    const a = CSS.indexOf('--emp-bg')
    const bloco = CSS.slice(CSS.lastIndexOf(':root {', a), CSS.indexOf('}', a))
    const m = new RegExp(`--emp-${nome}:\\s*([^;]+);`).exec(bloco)
    return m ? m[1].trim().replace(/\s+/g, '') : null
  }
  const css = (sel: string, prop: string) => {
    const m = new RegExp(`${sel.replace(/\./g, '\\.')}\\{[^}]*?${prop}:([^;}]+)`).exec(LEI)
    return m ? m[1].trim().replace(/\s+/g, '') : null
  }
  it('o fundo, as tintas e a sombra dupla da lei (claro)', () => {
    for (const t of ['bg', 'card', 'ink', 'ink2', 'ink3', 'line', 'ind', 'rox', 'amb', 'ambbg', 'ver', 'verbg', 'ros', 'rosbg', 'sh']) {
      expect(raizDoApp(t), `--emp-${t}`).toBe(raizDaLei(t))
    }
  })
  it('cards e linhas SEM borda (sombra dupla) — e a linha do contrato tem raio 16 (R66)', () => {
    expect(css('.hk', 'box-shadow')).toBe('var(--sh)')
    expect(css('.lrow', 'box-shadow')).toBe('var(--sh)')
    expect(css('.lrow', 'border-radius')).toBe('16px')
  })
  it('as 4 tintas do hero em 135°', () => {
    for (const t of ['ind', 'amb', 'rox', 'ver']) expect(raizDoApp(`t-${t}`), t).toBe(css(`.hk.t-${t}`, 'background'))
  })
  it('chip do credor em GRADIENTE — os 4 da lei', () => {
    const par = (b: string) => (css(`.chip.b-${b}`, 'background') ?? '').match(/#[0-9A-Fa-f]{6}/g)
    for (const [b, k] of [['sicredi', 'sicredi'], ['banrisul', 'banrisul'], ['caixa', 'caixa'], ['mutuo', 'mutuo']] as const) {
      expect(par(b), b).toEqual([...lib.GRADIENTE_DO_CHIP[k]])
    }
  })
  it('R57 — as cores da montanha por credor, CLARO e ESCURO, na ordem validada', () => {
    const linha = HEADER.slice(HEADER.indexOf('R57'), HEADER.indexOf('R58'))
    const claro = linha.slice(linha.indexOf('claro:'), linha.indexOf('escuro:')).match(/#[0-9A-F]{6}/g)
    const escuro = linha.slice(linha.indexOf('escuro:')).match(/#[0-9A-F]{6}/g)
    const ordem = ['sicredi', 'banrisul', 'caixa', 'mutuo'] as const
    expect(ordem.map((k) => lib.COR_DO_CREDOR[k].claro)).toEqual(claro)
    expect(ordem.map((k) => lib.COR_DO_CREDOR[k].escuro)).toEqual(escuro)
    expect(lib.ORDEM_DO_CREDOR.slice(0, 4)).toEqual([...ordem])
    // e os gradientes das ÁREAS (GRADS do script)
    const grads = /const GRADS = \{([^}]+)\}/.exec(SCRIPT)![1]
    for (const [chave, k] of [['sic', 'sicredi'], ['ban', 'banrisul'], ['cax', 'caixa'], ['mut', 'mutuo']] as const) {
      expect(new RegExp(`${chave}:\\['(#[0-9A-F]{6})','(#[0-9A-F]{6})'\\]`).exec(grads)!.slice(1)).toEqual([...lib.GRADIENTE_DA_SERIE[k]])
    }
  })
  it('a paleta das barras, do pódio e dos chips do split', () => {
    const P = lib.PALETA
    const tira = (s: string) => s.replace(/\s+/g, '')
    expect(tira(P.progresso)).toBe(css('.pb i', 'background'))
    expect(tira(P.progressoVerde)).toBe(css('.pb.verde i', 'background'))
    expect(tira(P.barraCusto)).toBe(css('.rk .bar i', 'background'))
    expect(tira(P.trilhoCusto)).toBe(css('.rk .bar', 'background'))
    expect(tira(P.ouro)).toBe(css('.pos.ouro', 'background'))
    expect(tira(P.topoDoPodio)).toBe(css('.rk .rw.top', 'background'))
    expect(tira(P.primario)).toBe(css('.btn.pri', 'background'))
    for (const [t, ico] of [['ind', P.icoInd], ['amb', P.ouro], ['rox', P.icoRox], ['ver', P.icoVer]] as const) expect(tira(ico)).toBe(css(`.ic-${t}`, 'background'))
    expect([P.indSuave, P.capTinta]).toEqual([css('.sp.cap', 'background'), css('.sp.cap', 'color')])
    expect([P.jurSuave, P.jurTinta]).toEqual([css('.sp.jur', 'background'), css('.sp.jur', 'color')])
    expect([P.corSuave, P.corTinta]).toEqual([css('.sp.cor', 'background'), css('.sp.cor', 'color')])
    expect([P.okSuave, P.okTinta]).toEqual([css('.sp.okk', 'background'), css('.sp.okk', 'color')])
  })
})

// ── dado (os números da amostra da lei) ──
const k = (o: Partial<lib.ContratoNaCarteira> = {}): lib.ContratoNaCarteira => ({
  id: 'c1', banco: 'sicredi', rot: 'Sicredi', num: 'C41022570', lender: 'Sicredi', taxa: 'PÓS · SELIC + 0,49% a.m.',
  saldo: 83333.36, pagas: 16, total: 36, prox: { n: 17, d: '15/dez', v: 4166.66, est: false, enc: true, estado: 'A_VENCER' },
  ef: 1.71, juros26: 16943, pendencias: [], flexible: false, principal: 150000, devolvido: 0, href: '/e/c1', ...o,
})
const meses = ['2026-11', '2026-12', '2027-01', '2027-02', '2027-03', '2027-04']
const carteira = (): lib.CarteiraDeEmprestimos => ({
  hoje: '2026-11-25', ano: 2026, mes: '2026-11',
  contratos: [
    k(),
    k({ id: 'c2', num: 'C41022227-1', saldo: 140351, ef: 1.52, pendencias: [{ campo: 'indexer', rotulo: 'indexador em branco' }], prox: { n: 15, d: '15/dez', v: 4890, est: true, enc: true, estado: 'A_VENCER' } }),
    k({ id: 'c3', banco: 'caixa', rot: 'Caixa', num: '•• 1837311', saldo: 5975.14, ef: 3.21 }),
    k({ id: 'm1', banco: 'mutuo', rot: 'Mútuo PF', num: '1ª tranche', saldo: 160000, ef: null, flexible: true, principal: 200000, devolvido: 40000, prox: null }),
  ],
  totais: { total: 389659.5, bancos: 229659.5, mutuo: 160000 },
  custo: lib.custoDoDinheiro({ real: 92938.95, agenda: 65433.70 }, [{ jurosAno: 27236.93 }]),
  custoPorCredor: [{ banco: 'sicredi', rot: 'Sicredi', v: 67709.93 }],
  cheque: [
    { bankAccountId: 'b1', conta: 'sicredi', banco: 'Sicredi', jurosAno: 27236.93, jurosMes: 1200, linhasAno: 20, usado: 79253.12, limite: 80000 },
    { bankAccountId: 'b2', conta: 'banco caixa', banco: 'Caixa Econômica Federal', jurosAno: 4278.74, jurosMes: 0, linhasAno: 6, usado: 7417.19, limite: null },
  ],
  chequeMes: 1200,
  compromisso: meses.map((m, i) => ({ m, v: [22606.28, 27755.52, 25084.66, 59123.43, 59064.32, 33311.14][i], est: i > 0 })),
  atrasado: { v: 0, n: 0 },
  montanha: {
    meses,
    series: {
      sicredi: [321542.09, 300000, 280000, 260000, 240000, 220000, 200000], banrisul: [66340.87, 60000, 54000, 48000, 42000, 36000, 30000],
      caixa: [27652.14, 20000, 12000, 5000, 0, 0, 0], mutuo: [270000, 270000, 270000, 244000, 218000, 0, 0], outro: [0, 0, 0, 0, 0, 0, 0],
    },
  },
})

describe('R56 — dívida na cara (renderizado)', () => {
  const h = renderToStaticMarkup(<HeroCarteira c={carteira()} />)
  it('os 4 do topo: dívida (bancos × mútuo), custo (contratos + cheque, agenda ao lado), compromisso, livre em', () => {
    for (const t of ['DÍVIDA TOTAL', 'CUSTO DO DINHEIRO · 2026', 'COMPROMISSO · nov/26', 'LIVRE DA DÍVIDA EM', 'R$ 389.659,50', 'R$ 120.175,88', 'agenda previa 65,4k', 'R$ 22.606,28', 'abr/2027']) expect(h).toContain(t)
    expect(h).toContain('var(--emp-t-amb)')
    expect(h).toContain('var(--emp-sh)')
  })
  it('R62 — o mês com estimativa herda o "~"', () => expect(h).toContain('~ R$ 27.755,52'))
})

describe('R57/R58 — a montanha e o compromisso (renderizado)', () => {
  const m = renderToStaticMarkup(<Montanha c={carteira()} />)
  it('uma área por credor PRESENTE, na ordem validada, com o gradiente da lei', () => {
    const series = [...m.matchAll(/data-serie="(\w+)"/g)].map((x) => x[1])
    expect(series).toEqual(['sicredi', 'banrisul', 'caixa', 'mutuo'])
    expect(m).toContain('stop-color="#23A574"')
  })
  const c = renderToStaticMarkup(<Compromisso serie={carteira().compromisso} />)
  it('o PICO destacado: fev e mar (colados) em âmbar, e o celular vira LISTA', () => {
    expect([...c.matchAll(/data-mes="([\d-]+)" data-pico="1"/g)].map((x) => x[1])).toEqual(['2027-02', '2027-03'])
    expect(c).toContain('O PICO · fev–mar/27')
    expect(c).toContain('data-compromisso-lista')
  })
})

describe('R59/R61/R64 — pódio, cheque e cards (renderizado)', () => {
  it('o pódio é por custo real desc e deixa o MÚTUO de fora', () => {
    const p = renderToStaticMarkup(<Podio contratos={carteira().contratos} />)
    expect(p).not.toContain('1ª tranche')
    expect(p.indexOf('1837311')).toBeLessThan(p.indexOf('C41022570'))
    expect(p).toContain('3,21% a.m.')
  })
  it('cheque especial: usado × limite quando cadastrado; sem limite, só o usado (nunca inventa)', () => {
    const q = renderToStaticMarkup(<ChequeEspecial c={carteira()} />)
    expect(q).toContain('usado 79,3k de 80,0k · 99%')
    expect(q).toContain('usado R$ 7.417,19')
    expect(q).toContain('R$ 27.236,93')
  })
  // ⭐ R66 — a lista respira: LINHA compacta, detalhe sob clique
  const linha = (i: number) => renderToStaticMarkup(<LinhaContrato k={carteira().contratos[i]} ano={2026} />)
  const detalhe = (i: number) => renderToStaticMarkup(<DetalheDaLinha k={carteira().contratos[i]} ano={2026} />)
  it('R66 — a linha FECHADA mostra chip, nº, estado, progresso, próxima e o SALDO inteiro (nenhuma nasce aberta)', () => {
    const s = linha(0)
    expect(s).toContain('data-aberta="0"')
    expect(s).not.toContain('data-detalhe')
    // ⚠️ cada viewport se mede no SEU trecho (o saldo do celular não absolve a linha larga sem saldo)
    const larga = s.slice(s.indexOf('data-linha="larga"'), s.indexOf('data-linha="minima"'))
    for (const t of ['data-chip="sicredi"', 'C41022570', 'em dia', '16 de 36 · 44%', 'R$ 4.166,66', '+ enc.', 'próxima · 15/dez', 'data-saldo', 'R$ 83.333,36']) expect(larga, t).toContain(t)
    // S18 — o celular tem a linha mínima com o MESMO saldo inteiro
    const min = s.slice(s.indexOf('data-linha="minima"'))
    for (const t of ['data-chip="sicredi"', 'C41022570', 'data-saldo', 'R$ 83.333,36']) expect(min, t).toContain(t)
    expect(s).not.toMatch(/R\$ [\d.]*,?\d*\.\.\./)
  })
  it('R60/R62 — o pós sem indexador é COBRADO na linha ("indexador em branco →"), e a estimada leva "~"', () => {
    const s = linha(1)
    expect(s).toContain('indexador em branco →')
    expect(s).toContain('href="/e/c1?editar=1"')
    expect(s).toContain('~ estimada')
    expect(s).toContain('~ R$ 4.890,00')
    expect(s).toContain('linear-gradient(135deg,#0A3D2C,#1E8F63)')
  })
  it('R61 — o mútuo: "registrar devolução →" no lugar da próxima, progresso do devolvido', () => {
    const s = linha(3)
    expect(s).toContain('registrar devolução →')
    expect(s).toContain('devolvido 40,0k de 200,0k · 20%')
  })
  it('R66 — o detalhe aberto: barra, fatos e as 4 AÇÕES (marcar paga cai na porta única do detalhe)', () => {
    const d = detalhe(0)
    for (const t of ['taxa <b>', 'custo pago em 2026 <b>R$ 16.943,00</b>', 'agenda do banco <b>✓</b>', 'próxima <b>R$ 4.166,66 · 15/dez</b>']) expect(d).toContain(t)
    expect([...d.matchAll(/data-acao="(\w+)"/g)].map((x) => x[1])).toEqual(['abrir', 'pagar', 'editar', 'excluir'])
    expect(d).toContain('href="/e/c1?pagar=17"')
    const m = detalhe(3)
    expect([...m.matchAll(/data-acao="(\w+)"/g)].map((x) => x[1])).toEqual(['abrir', 'pagar', 'editar', 'excluir'])
    expect(m).toContain('registrar devolução')
  })
  it('R66 — a linha abre o MESMO detalhe (uso, não menção) e o detalhe pede a porta pela URL', () => {
    const v = sem('components/emprestimos/visual.tsx')
    const corpo = v.slice(v.indexOf('export function LinhaContrato'), v.indexOf('export function GrupoDoCredor'))
    expect(corpo).toMatch(/\{aberta && <DetalheDaLinha k=\{k\} ano=\{ano\} \/>\}/)
    expect(corpo).toMatch(/useState\(false\)/)
    expect(v).not.toMatch(/export function CardContrato/)
    expect(DETALHE_TELA).toMatch(/q\.get\('pagar'\)/)
    expect(DETALHE_TELA).toMatch(/setOpenCandidatos\(n\)/)
  })
  it('detalhe: split em chips e curva real × agenda', () => {
    const sp = renderToStaticMarkup(<SplitEmChips capital={4166.66} juros={425.95} correcao={970.37} mora={0} />)
    for (const t of ['capital <b>4.166,66</b>', 'juros <b>425,95</b>', 'correção <b>970,37</b>', 'encargo apurado no pagamento ✓']) expect(sp).toContain(t)
    const cv = renderToStaticMarkup(<CurvaRealAgenda pontos={[{ n: 14, mes: '2026-09', agenda: 91666.72, real: 91666.72 }, { n: 15, mes: '2026-10', agenda: 87500.02, real: 87500.02 }, { n: 16, mes: '2026-11', agenda: 83333.36, real: null }]} />)
    expect(cv).toContain('data-serie="agenda"')
    expect(cv).toContain('data-serie="real"')
  })
})

describe('as telas (lidas SEM comentário)', () => {
  it('⛔ S24 — a carteira não tem max-w próprio; tela larga ganha COLUNAS', () => {
    expect(CARTEIRA_TELA).not.toMatch(/max-w-/)
    expect(CARTEIRA_TELA).toMatch(/xl:grid-cols-\[7fr_5fr\]/)
  })
  it('a carteira lê a leitura em lote e desenha as peças da lei', () => {
    expect(CARTEIRA_TELA).toMatch(/\/emprestimos\/carteira/)
    for (const p of ['HeroCarteira', 'Montanha', 'Compromisso', 'Podio', 'CustoPorCredor', 'ChequeEspecial', 'GrupoDoCredor']) expect(CARTEIRA_TELA).toMatch(new RegExp(`<${p}\\b`))
    // ⛔ R61 — o mútuo é um grupo à parte
    expect(CARTEIRA_TELA).toMatch(/<GrupoDoCredor banco="mutuo"/)
  })
  it('o detalhe: marcar paga (porta única), editar, excluir com os números, curva real × agenda', () => {
    for (const p of ['<CandidatosDialog', '<EditarContrato', '<CurvaRealAgenda', 'fraseDoExcluir', 'custoPago.desdeInicio']) expect(DETALHE_TELA).toContain(p)
    // ⛔ o bug do card: a mesma variável duas vezes não volta
    expect(DETALHE_TELA).not.toMatch(/label="Juros do contrato"/)
  })
  it('⛔ S15 — nenhum número de lei na tela', () => {
    for (const t of [CARTEIRA_TELA, DETALHE_TELA, sem('components/emprestimos/visual.tsx')]) expect(t).not.toMatch(/\bR(5[4-9]|6[0-6])\b/)
  })
})

describe('⛔ PORTA ÚNICA — um número só, um filtro só', () => {
  it('R58 — o valor da parcela no mês vem de UMA função: Mesa/Custos Fixos e a carteira chamam avaliarParcela', () => {
    for (const f of ['lib/custos-fixos/compromissos.ts', 'lib/loans/carteira.ts']) {
      const s = sem(f)
      expect(s, f).toMatch(/avaliarParcela\(/)
      expect(s, `${f} reimplementou a valoração`).not.toMatch(/referenciaFlexivelDoMes\(|forecastProxima\(/)
    }
  })
  it('R60 — todo leitor de TELA filtra o contrato excluído pelo MESMO predicado', () => {
    for (const f of [
      'lib/loans/carteira.ts', 'lib/custos-fixos/compromissos.ts', 'lib/conciliacao/palpites-da-caixa.ts',
      'app/api/empresas/[id]/emprestimos/route.ts', 'app/api/empresas/[id]/emprestimos/parcelas-do-mes/route.ts',
      'app/api/empresas/[id]/emprestimos/deteccao-pendentes/route.ts', 'lib/loans/auto-conciliacao.ts',
    ]) expect(sem(f), f).toMatch(/CONTRATO_VISIVEL|archivedAt:\s*null/)
  })
})
