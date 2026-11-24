/**
 * ⭐⭐⭐ CARTÕES v3 — o guard TELA × LEI (24/11/2026: docs/cartoes-referencia.html, R44–R52).
 *
 * ARQUIVO DE REFERÊNCIA = LEI: o guard ABRE o HTML aprovado e
 *  (1) roda os 14 PINOS do último <script> CONTRA A LIB (as funções da lei trocadas pelas da lib —
 *      a lista de pinos é a da lei, por valor, não uma cópia minha);
 *  (2) compara os tokens por VALOR (sombra, tintas do hero, chips por banco, cores de categoria);
 *  (3) RENDERIZA as peças com dado de verdade (uso, não menção) e lê as telas SEM comentário.
 */
import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import * as ciclo from '@/lib/credit-card-pj/ciclo'
import { Hero, CartaoObjeto, MenuDoCartao, LinhaDoMes, PainelFuturo, PorCategoria, FaturaPorMes, fraseDoExcluir, eventosDoMes } from '@/components/cartoes/visual'
import type { Carteira, CartaoNaCarteira, FaturaResumo } from '@/lib/credit-card-pj/carteira'
import { alertasDaCarteira, hrefDaVigia } from '@/lib/credit-card-pj/vigia'
import { avaliarLinguaDoBalcao } from '@/lib/avisos/lingua-do-balcao'
import { semComentarios } from './_leitura-de-fonte'

const ler = (rel: string) => readFileSync(join(process.cwd(), rel), 'utf8')
const LEI = ler('docs/cartoes-referencia.html')
const CSS = ler('app/globals.css')
const PAGINA = semComentarios(ler('app/(dashboard)/empresas/[id]/cartoes/page.tsx'), 'p.tsx')
const FATURA = semComentarios(ler('app/(dashboard)/empresas/[id]/cartoes/[cardId]/page.tsx'), 'f.tsx')
const VISUAL = semComentarios(ler('components/cartoes/visual.tsx'), 'v.tsx')
const SCRIPT = LEI.slice(LEI.lastIndexOf('<script>') + 8, LEI.lastIndexOf('</script>'))

describe('a lei é a aprovada', () => {
  it('título EXATO', () => expect(LEI).toContain('<title>CARTÕES (financeiro) — referência v3 APROVADA</title>'))
})

describe('⭐⭐⭐ os 14 PINOS da lei, rodando contra a LIB', () => {
  // as amostras e a lista de pinos saem do script da lei; as funções vêm da lib
  const trecho = (de: string, ate: string) => SCRIPT.slice(SCRIPT.indexOf(de), SCRIPT.indexOf(ate))
  const amostra = trecho('const COMPRAS_SICREDI', 'const EVOLUCAO')
  const pinos = trecho('const PINOS', 'for (const [nome, ok] of PINOS)')
  const PINOS: [string, boolean][] = new Function(
    'disponivel', 'estadoCiclo', 'venceEm', 'faltamParcelas', 'somaFuturo', 'porMes', 'casar', 'brl0',
    `${amostra}\n${pinos}\nreturn PINOS`,
  )(ciclo.disponivel, ciclo.estadoCiclo, ciclo.venceEm, ciclo.faltamParcelas, ciclo.somaFuturo, ciclo.porMes, ciclo.casar, ciclo.brl0)
  it('a lei tem 14 pinos (o guard não passa por lista vazia)', () => expect(PINOS).toHaveLength(14))
  for (const [nome, ok] of PINOS) it(`pino: ${nome}`, () => expect(ok).toBe(true))
})

describe('tokens por VALOR', () => {
  const css = (sel: string, prop: string) => {
    const m = new RegExp(`${sel.replace(/\./g, '\\.')}\\{[^}]*?${prop}:([^;}]+)`).exec(LEI)
    return m ? m[1].trim().replace(/\s+/g, '') : null
  }
  const raiz = (nome: string) => {
    const m = new RegExp(`:root \\{[^}]*?${nome}:\\s*([^;]+);`).exec(CSS)
    return m ? m[1].trim().replace(/\s+/g, '') : null
  }
  it('sombra SEM borda dos cartões e dos cards-objeto', () => {
    expect(raiz('--cart-sombra')).toBe(css('.hk', 'box-shadow'))
    expect(raiz('--cart-sombra-cc')).toBe(css('.cc', 'box-shadow'))
    expect(css('.hk', 'border')).toBe('0')
    expect(css('.cc', 'border')).toBe('0')
  })
  it('as 4 tintas do hero', () => {
    for (const t of ['amb', 'ind', 'rox', 'ver']) expect(raiz(`--cart-t-${t}`)).toBe(css(`.hk.t-${t}`, 'background'))
  })
  it('chip por banco em GRADIENTE (sem logo) — os 4 da lei', () => {
    const par = (b: string) => (css(`.chip.b-${b}`, 'background') ?? '').match(/#[0-9A-Fa-f]{6}/g)
    expect(par('sicredi')).toEqual([...ciclo.GRADIENTE_DO_BANCO.sicredi])
    expect(par('banrisul')).toEqual([...ciclo.GRADIENTE_DO_BANCO.banrisul])
    expect(par('caixa')).toEqual([...ciclo.GRADIENTE_DO_BANCO.caixa])
    expect(par('mp')).toEqual([...ciclo.GRADIENTE_DO_BANCO.mp])
  })
  it('as 6 cores de categoria (escala única R50)', () => {
    const lei = ['mercado', 'servicos', 'saude', 'educacao', 'roupas', 'outros'].map((c) => new RegExp(`--cat-${c}:(#[0-9A-F]{6})`).exec(LEI)![1])
    expect([1, 2, 3, 4, 5, 6].map((i) => raiz(`--cart-cat${i}`))).toEqual(lei)
  })
})

// ── dado de verdade (os números da amostra da lei) ──
const fat = (o: Partial<FaturaResumo> = {}): FaturaResumo => ({
  mes: '2026-11', total: 4810.69, pago: 0, estado: 'fechada', fechamento: '2026-10-27', vencimento: '2026-11-26', linhas: 42, pagamentos: [], ...o,
})
const cartao = (o: Partial<CartaoNaCarteira> = {}): CartaoNaCarteira => ({
  id: 'c1', name: 'Sicredi', bankName: 'Sicredi', brand: 'Visa', lastDigits: '0115', creditLimit: 25000, closingDay: 27, dueDay: 26,
  closingDayRule: 'ATUAL', defaultPaymentBankAccountId: null, defaultTreatment: 'OPERACIONAL', socioPFId: null,
  atual: fat(), faturas: [fat()], aberta: { mes: '2026-12', total: 10843, fechamento: '2026-11-27', vencimento: '2026-12-26' },
  fechadasNaoPagas: 0, disponivel: 14157, usoPct: 0.43, parcelasFuturas: 6032.69,
  futurasPorMes: [{ mes: '2026-12', valor: 1828 }], historia: { lancamentos: 42, faturas: 6 }, ...o,
})
const carteira = (cs: CartaoNaCarteira[]): Carteira => ({
  hoje: '2026-11-23', cartoes: cs, arquivados: [],
  hero: {
    aPagar: { valor: 4810.69, cartaoId: 'c1', banco: 'Sicredi', dias: 3, mes: '2026-11' },
    abertas: { valor: 11801.8, cartoes: 2 },
    comprometido: { valor: 62810, porMes: ['2026-12', '2027-01', '2027-02', '2027-03', '2027-04', '2027-05'].map((mes, i) => ({ mes, valor: [8390, 7820, 6150, 5080, 4420, 3910][i] })) },
    limite: { total: 80200, disponivel: 61361, usoPct: 0.23 },
  },
})

describe('R44 — o dinheiro na cara (renderizado)', () => {
  const h = renderToStaticMarkup(<Hero carteira={carteira([cartao(), cartao({ id: 'c2' }), cartao({ id: 'c3' }), cartao({ id: 'c4' })])} hrefAPagar="/x" />)
  it('os 4 cartões do topo, com as cifras e a régua da lei', () => {
    for (const t of ['A pagar agora', 'Faturas abertas', 'Comprometido em parcelas', 'Limite dos 4 cartões', 'livres de R$ 80.200', '23% usado', 'vence em 3 dias']) expect(h).toContain(t)
    expect(h).toContain('R$ 62.810')
    expect(h).toContain('var(--cart-t-amb)')
    expect(h).toContain('var(--cart-sombra)')
  })
  it('as mini-barras do comprometido, uma por mês (6)', () => {
    expect(h.match(/<span class="num text-\[8px\][^>]*>[a-z]{3}<\/span>/g)).toHaveLength(6)
  })
})

describe('R45 — cartão é objeto completo (renderizado)', () => {
  const html = (k: CartaoNaCarteira) => renderToStaticMarkup(<CartaoObjeto k={k} hoje="2026-11-23" hrefFatura="/f" menu={null} onMenu={() => {}} />)
  it('chip do banco em gradiente, bandeira em texto, final, selo do ciclo, valor, UMA régua do disponível', () => {
    const s = html(cartao())
    expect(s).toContain('data-chip="sicredi"')
    expect(s).toContain('linear-gradient(135deg,#0A3D2C,#1E8F63)')
    expect(s).toContain('•••• 0115')
    expect(s).toContain('data-selo="fechada"')
    expect(s).toContain('● Fechada')
    expect(s).toContain('R$ 10.843</b> na próxima fatura')
    expect(s).toContain('R$ 14.157</b> disponíveis de R$ 25.000')
    expect(s).toContain('parcelas futuras:')
    expect(s).toContain('abrir fatura →')
  })
  it('⭐ "vence em N dias" com PULSO âmbar quando sem pagamento casado', () => {
    const s = html(cartao())
    expect(s).toContain('vence em 3 dias · sem pagamento casado')
    expect(s).toContain('cart-pulso')
    const paga = html(cartao({ atual: fat({ estado: 'paga', pago: 4810.69, pagamentos: [{ id: 'p', data: '2026-11-12', valor: 4810.69, conta: 'Sicredi' }] }) }))
    expect(paga).toContain('paga em 12/nov')
    expect(paga).not.toContain('cart-pulso')
    const parcial = html(cartao({ atual: fat({ estado: 'parcial', total: 912.41, pago: 500 }) }))
    expect(parcial).toContain('◐ Parcial')
    expect(parcial).toMatch(/pagos R\$\s500,00 · restam R\$\s412,41/)
  })
  it('o menu ⋯: editar · arquivar · excluir', () => {
    const m = renderToStaticMarkup(<MenuDoCartao onEditar={() => {}} onArquivar={() => {}} onExcluir={() => {}} />)
    expect(m.match(/>(editar cartão|arquivar|excluir)</g)).toEqual(['>editar cartão<', '>arquivar<', '>excluir<'])
  })
  it('R23 — a confirmação do excluir diz os NÚMEROS (com história some; sem história apaga)', () => {
    expect(fraseDoExcluir(cartao())).toBe('Excluir Sicredi? Ele tem 42 lançamentos em 6 faturas: o cartão some das telas e a história fica intacta.')
    expect(fraseDoExcluir(cartao({ historia: { lancamentos: 0, faturas: 0 } }))).toBe('Excluir Sicredi? Ele não tem nenhum lançamento — é apagado de vez.')
  })
  it('a linha do mês: fechamentos, vencimentos e "hoje"', () => {
    const c = carteira([cartao()])
    const ev = eventosDoMes(c).eventos.map((e) => e.tx)
    expect(ev).toEqual(expect.arrayContaining(['hoje', 'sicredi vence', 'sicredi fecha']))
    expect(renderToStaticMarkup(<LinhaDoMes carteira={c} />)).toContain('Novembro · fechamentos e vencimentos')
  })
})

describe('R47/R50 — o futuro e os gráficos (renderizados)', () => {
  const compras = [{ descricao: 'Mp Lojabrazil', valor: 221.9, faltam: 9, ate: '2027-08' }, { descricao: 'Panvel', valor: 420.64, faltam: 1, ate: '2026-12' }]
  it('"faltam N · até mês/ano" e a SOMA batendo com o total (pino somaFuturo)', () => {
    const total = ciclo.somaFuturo([{ sel: '01/10', vmes: 221.9 }, { sel: '01/02', vmes: 420.64 }])
    const s = renderToStaticMarkup(<PainelFuturo futuras={{ total, porMes: [{ mes: '2026-12', valor: 642.54 }], compras }} verTodas={false} onVerTodas={() => {}} />)
    expect(s).toContain('faltam 9 · até ago/27')
    expect(s).toContain('falta 1 · dez')
    expect(s).toMatch(/R\$\s221,90\/mês/)
    expect(s).toMatch(/soma do que já está comprometido<\/span><span>R\$\s2\.417,74/)
  })
  it('por categoria em barras de escala única (a maior = 100%), cores da lei', () => {
    const s = renderToStaticMarkup(<PorCategoria itens={[{ nome: 'Mercado', valor: 1894 }, { nome: 'Serviços', valor: 812 }]} />)
    expect(s).toContain('width:100%;background:var(--cart-cat1)')
    expect(s).toContain('width:43%;background:var(--cart-cat2)')
  })
  it('fatura por mês: curva SUAVE (bézier) com área', () => {
    const s = renderToStaticMarkup(<FaturaPorMes evolucao={[3120, 2840, 4210, 5660, 6667, 4811].map((total, i) => ({ mes: `2026-0${i + 4}`, total }))} />)
    expect(s).toMatch(/d="M [\d.]+ [\d.]+ C /)
    expect(s).toContain('fill="url(#evg)"')
  })
})

describe('R51 — o sininho vigia o cartão (executado)', () => {
  const c = carteira([
    cartao({ id: 'vence' }),
    cartao({ id: 'semimport', atual: fat({ mes: '2026-10', estado: 'paga', pago: 4810.69 }), aberta: { mes: '2026-11', total: 0, fechamento: '2026-11-08', vencimento: '2026-11-18' } }),
    cartao({ id: 'limite', atual: fat({ estado: 'paga', pago: 4810.69 }), usoPct: 0.85, disponivel: 3750 }),
  ])
  const a = alertasDaCarteira('emp', c)
  it('os três alarmes da lei, cada um no seu cartão', () => {
    expect(a.map((x) => `${x.tipo}:${x.cartaoId}`)).toEqual(['VENCENDO_SEM_PAGAMENTO:vence', 'FATURA_NAO_IMPORTADA:semimport', 'LIMITE_ALTO:limite'])
  })
  it('todos passam na língua do balcão e pousam na página com âncora', () => {
    for (const x of a) expect(avaliarLinguaDoBalcao({ companyId: 'emp', setor: 'financeiro', severidade: x.severidade, titulo: x.titulo, corpo: x.corpo, oQueFazer: x.oQueFazer, acaoRotulo: 'ver', acaoHref: hrefDaVigia('emp'), origem: 'CARTAO_VIGIA', alvo: x.alvo })).toEqual({ ok: true })
    expect(hrefDaVigia('emp')).toBe('/empresas/emp/cartoes#pergunta-cartao-vigia')
    const prod = semComentarios(ler('lib/avisos/produtores/cartoes.ts'), 'c.ts')
    expect(prod).toContain('alertasDaCarteira(companyId, carteira)')
    expect(prod).toContain('acaoHref: hrefDaVigia(companyId)')
    expect(semComentarios(ler('lib/avisos/produtores/rodar.ts'), 'r.ts')).toContain('await produzirAvisosDeCartoes(e.id, agora)')
  })
  it('a página mostra OS MESMOS alertas no topo (a porta é uma)', () => {
    expect(PAGINA).toContain('alertasDaCarteira(params.id, c)')
    expect(PAGINA.indexOf('<PerguntaNoTopo id={ANCORAS.CARTAO_VIGIA}')).toBeLessThan(PAGINA.indexOf('<Hero carteira'))
  })
})

describe('TELA × LEI — as telas (lidas sem comentário)', () => {
  it('a página lê a carteira em LOTE e não monta conta própria do disponível', () => {
    expect(PAGINA).toContain('/cartoes/carteira')
    expect(PAGINA).not.toMatch(/creditLimit\s*-/)
    expect(FATURA).not.toMatch(/creditLimit\s*-/)
  })
  it('o menu ⋯ está LIGADO na API: PATCH isActive (arquivar/reativar), DELETE (excluir), PATCH (editar)', () => {
    expect(PAGINA).toContain("patch(k, { isActive: false }")
    expect(PAGINA).toContain("{ method: 'DELETE', credentials: 'include' }")
    expect(PAGINA).toContain('<EditarCartao')
    expect(PAGINA).toContain('JSON.stringify({ isActive: true })')
  })
  it('a fatura: setas de mês, ciclo, filtros com contador, busca, abas no celular, lembrar pra próxima', () => {
    for (const t of ['aria-label="fatura anterior"', 'aria-label="próxima fatura"', 'id="trilho-fat"', "'Parceladas'", "'Estornos'", "'Sem categoria'", '⌕ buscar',
      "'Lançamentos'", "'Parcelas'", "'Gráfico'", 'lg:hidden', 'lembrar “', 'pra próxima vez que vier', '/rules/create-and-apply']) expect(FATURA).toContain(t)
  })
  it('as frases da lei', () => {
    for (const f of ['Já comprometido · próximos meses', 'Por categoria', 'Fatura por mês', 'Total da fatura']) {
      expect(LEI).toContain(f)
      expect(FATURA).toContain(f)
    }
    for (const f of ['Cartões de crédito', '+ Novo cartão']) { expect(LEI).toContain(f); expect(PAGINA).toContain(f) }
    expect(LEI).toContain('fechamentos e vencimentos')
    expect(VISUAL).toContain('fechamentos e vencimentos')
  })
  it('R52 — NADA rola de lado: nenhuma rolagem horizontal nas telas e peças', () => {
    for (const s of [PAGINA, FATURA, VISUAL]) expect(s).not.toMatch(/overflow-x-(auto|scroll)/)
    expect(PAGINA).toContain('lg:grid-cols-2')
    expect(VISUAL).toContain('grid-cols-2 gap-3 lg:grid-cols-4')
  })
})
