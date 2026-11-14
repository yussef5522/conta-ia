/**
 * ⭐⭐ LEI v9 M7.e — A TAREFA NAS LISTAS DO ESCRITÓRIO, RENDERIZADA DE VERDADE (REGRA 3).
 *
 * O print do dono: tarefa concluída com "R$ 0,00/un" na lista de Concluídas. Aqui as duas listas
 * do painel são desenhadas (`renderToStaticMarkup`, sem jsdom) com UM lote e UMA tarefa, e a
 * afirmação é sobre o MARKUP: a linha da tarefa nunca tem R$/un, %, conferência nem "UN pedidas";
 * o lote ao lado continua com tudo (o caso NEGATIVO: o lote não pode perder o que é dele).
 */
import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { ListaAbertas, ListaConcluidas, ListaTarefasConcluidas, type Conclusao } from '@/components/estoque/listas-do-painel'
import { tarefasDoPainel, linhaDaTarefaAberta, linhaDaTarefaConcluida } from '../linha-da-tarefa'
import type { TarefaDoEscritorio } from '../tarefa'

const AGORA = new Date('2026-11-12T18:14:00.000Z') // 15:14 de Brasília
const base: TarefaDoEscritorio = {
  tarefaId: 't1', etapaId: 'e1', nome: 'ABRIR MILHO', instrucao: '3 LATAS', dia: '2026-11-12', quem: ['NATHALIA'],
  liberada: false, estado: 'FEITA', iniciadoEm: '2026-11-12T17:53:00.000Z', finalizadoEm: '2026-11-12T18:05:00.000Z', minutos: 12,
  origem: 'AVULSA', limite: null, atrasada: false, progresso: null,
}
const lote: Conclusao = {
  id: 'c1', ordemId: 'o1', qtdGerada: 76, custoUnitarioReal: 0.31, custoLoteReal: 23.56, colaboradorNome: 'jessica', rendimento: 0.95,
  criadoEm: '2026-11-12T15:40:00.000Z', pct: 95, faixa: 'OK', motivo: null, selo: 'FICHA', fiscalImpossivel: false,
  conferencia: { estado: 'CONFERIDA', conferidoPorNome: 'cristian', corrigiuDe: null, motivoDaCorrecao: null },
}
/** ⭐ (emenda do dono 13/11) os DOIS blocos, como o Painel monta: lotes em cima, tarefas logo abaixo */
const blocoLotes = () => renderToStaticMarkup(
  <ListaConcluidas id="emp" periodo="hoje" mostrar={25} onMais={() => {}} itens={[lote]}
    nomePorOrdem={new Map([['o1', 'PORÇÃO MAIONESE 30g']])} unidadePorOrdem={new Map([['o1', 'UN']])}
    pedidoFeito={{ o1: { pedido: 80, origem: 'DECLARADO' } }} />,
)
const blocoTarefas = (ts: TarefaDoEscritorio[], periodo = 'hoje') =>
  renderToStaticMarkup(<ListaTarefasConcluidas periodo={periodo} tarefas={tarefasDoPainel(ts, AGORA).concluidas} />)
const concluidas = (ts: TarefaDoEscritorio[]) => blocoLotes() + blocoTarefas(ts)
const linha = (html: string, testid: string) => {
  const i = html.indexOf(`data-testid="${testid}"`)
  return html.slice(html.lastIndexOf('<', i), html.indexOf('</div>', i))
}

describe('Concluídas · a tarefa tem linha própria: selo + quem · hora + DURAÇÃO', () => {
  const html = concluidas([base])
  const t = linha(html, 'tarefa-concluida')

  it('selo TAREFA, nome, NATHALIA · 15:05 e 12min', () => {
    expect(t).toContain('>TAREFA<')
    expect(t).toContain('ABRIR MILHO')
    expect(t).toContain('NATHALIA · 15:05')
    expect(t).toContain('>12min<')
  })
  it('⛔ o defeito do print morre: nada de R$, /un, %, conferência ou pedido na linha da tarefa', () => {
    expect(t).not.toMatch(/R\$|\/un|%|confer|pedid|aguardando/i)
  })
  it('⭐ o lote ao lado continua com custo, fez/ped., % e selo (caso negativo)', () => {
    const l = html.slice(html.indexOf('href="/empresas/emp/estoque/producao/o1"'))
    expect(l).toMatch(/R\$\s?0,31<i>\/un<\/i>/)
    expect(l).toContain('76<i> / 80</i>')
    expect(l).toContain('95%')
    expect(l).toContain('✓✓ conferido · cristian')
  })
  it('⭐⭐ (emenda 13/11) DOIS blocos com contador próprio: "Lotes concluídos" e "Tarefas concluídas"', () => {
    expect(html).toContain('Lotes concluídos · hoje (1 lote)')
    expect(html).toContain('Tarefas concluídas · hoje (1 tarefa)')
    expect(html.indexOf('data-testid="concluidas"'), 'tarefas vêm LOGO ABAIXO dos lotes').toBeLessThan(html.indexOf('data-testid="tarefas-concluidas"'))
  })
  it('⛔⛔ o bloco de LOTES não carrega tarefa nenhuma — nem linha, nem selo', () => {
    const lotes = blocoLotes()
    expect(lotes).not.toContain('tarefa-concluida')
    expect(lotes).not.toContain('ABRIR MILHO')
    expect(lotes).not.toContain('>TAREFA<')
  })
  it('⛔ o bloco de TAREFAS não tem R$, fez/pedido, % nem conferência — e traz a instrução', () => {
    const tb = blocoTarefas([base])
    expect(tb).not.toMatch(/R\$|\/un|%|CUSTO|FEZ|confer|pedid/i)
    expect(tb).toContain('3 LATAS')
  })
  it('sem tarefa no período o bloco NÃO aparece; o período escolhido vai pro título', () => {
    expect(blocoTarefas([])).toBe('')
    expect(blocoTarefas([base], 'últimos 7 dias')).toContain('Tarefas concluídas · últimos 7 dias (1 tarefa)')
    expect(blocoTarefas([base, { ...base, tarefaId: 't2' }], 'semana')).toContain('Tarefas concluídas · últimos 7 dias (2 tarefas)')
  })
  it('sem duração medida diz "·", nunca 0min', () => {
    expect(linhaDaTarefaConcluida({ ...base, minutos: null }).duracao).toBe('·')
  })
})

describe('Em aberto · tarefa: nome + instrução + "para {quem}", NUNCA "UN pedidas"', () => {
  const abre = (t: TarefaDoEscritorio, podeCancelar = true) => renderToStaticMarkup(
    <ListaAbertas id="emp" ordens={[]} ctx={{}} deOntem={0} soDeOntem={false} onFiltrarOntem={() => {}}
      tarefas={tarefasDoPainel([t], AGORA).abertas} podeCancelar={podeCancelar} cancelando={null} onCancelar={() => {}} erroTarefa={null} />,
  )
  it('aguardando: "para Michele · ninguém iniciou ainda", a instrução à direita e o cancelar', () => {
    const h = abre({ ...base, nome: 'ABRIR LATAS DE ERVILHA', instrucao: '5 LATAS', quem: ['Michele'], estado: 'AGUARDANDO', iniciadoEm: null, finalizadoEm: null, minutos: null })
    const t = linha(h, 'tarefa-aberta')
    expect(t).toContain('>TAREFA<')
    expect(t).toContain('para Michele · ninguém iniciou ainda')
    expect(t).toContain('5 LATAS')
    expect(t).toContain('>cancelar<')
    expect(t).not.toMatch(/pedid|esperad|\bUN\b|R\$/)
  })
  it('fazendo: "michele · começou 15:20 · há 9min" com filete índigo', () => {
    const a = linhaDaTarefaAberta({ ...base, quem: ['michele'], estado: 'EM_ANDAMENTO', iniciadoEm: '2026-11-12T18:20:00.000Z', finalizadoEm: null, minutos: 9 }, new Date('2026-11-12T18:29:00.000Z'))
    expect(a.apoio).toBe('michele · começou 15:20 · há 9min')
    expect(a.fazendo).toBe(true)
  })
  it('liberada pra equipe diz isso; e quem não opera não vê o cancelar', () => {
    const h = abre({ ...base, quem: [], liberada: true, estado: 'AGUARDANDO', iniciadoEm: null, finalizadoEm: null, minutos: null }, false)
    expect(h).toContain('liberada pra equipe · ninguém iniciou ainda')
    expect(h).not.toContain('>cancelar<')
  })
  it('cancelada e encerrada-sem-finalizar não entram em lista nenhuma', () => {
    const p = tarefasDoPainel([{ ...base, estado: 'CANCELADA' }, { ...base, tarefaId: 't2', estado: 'ENCERRADA_SEM_FINALIZAR' }], AGORA)
    expect(p.abertas).toHaveLength(0)
    expect(p.concluidas).toHaveLength(0)
  })
})
