// ⭐⭐⭐ UMA ESCOLHA, DUAS TELAS (14/09/2026) — o mês do PF é compartilhado.
//
// **O dono:** *"PF → Lançamentos abre no mês (27, não 499), navegando JUNTO com o
// dashboard — mesmo mês selecionado nas duas."*
//
// ⚠️ O teste roda a DECISÃO (a janela e o mês corrente), não o React: o projeto roda em
// `environment: node`. O que ele trava é o que quebrou de verdade — o recorte e o fuso.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { mesCorrente, janelaDoMes } from '@/lib/periodo/mes-corrente'

describe('⭐⭐ os Lançamentos do PF abrem no mês', () => {
  it('⭐⭐ a janela de setembro pega o 1º e o último dia INTEIROS', () => {
    const { de, ate } = janelaDoMes('2026-09')
    const fimQueAListaManda = new Date(ate.getTime() - 1)
    // ⚠️ a rota compara com `lte`, então o fim tem que ser o ÚLTIMO INSTANTE — mandar
    // `ate` cru incluiria 1º de outubro; mandar o dia 30 às 00h perderia o dia todo
    expect(de.toISOString()).toBe('2026-09-01T00:00:00.000Z')
    expect(fimQueAListaManda.toISOString()).toBe('2026-09-30T23:59:59.999Z')
  })

  it('⛔⛔ o dashboard abria no mês do UTC — no dia 1º às 00h30 de SP, o ANTERIOR', () => {
    // era `new Date().toISOString().slice(0,7)`: às 02h UTC do dia 1º (23h de SP do dia
    // 30) ele já dizia o mês novo, e às 00h30 de SP o mês velho seguia certo por acaso
    const meiaNoiteMeiaEmSP = new Date('2026-10-01T03:30:00Z')
    expect(mesCorrente(meiaNoiteMeiaEmSP)).toBe('2026-10')
    const vinteETresEmSP = new Date('2026-10-01T02:00:00Z') // 23h de 30/09 em SP
    expect(mesCorrente(vinteETresEmSP), 'o UTC diria outubro').toBe('2026-09')
    // ⛔ o contrafactual: a régua velha erra justamente aí
    expect(vinteETresEmSP.toISOString().slice(0, 7)).toBe('2026-10')
  })

  it('⭐ a chave do storage é POR PERFIL — o mês de um não é o do outro', () => {
    // ⚠️ hoje há um perfil só; a chave já nasce separada pra não virar migração depois
    const chave = (p: string) => `pf:mes:${p}`
    expect(chave('a')).not.toBe(chave('b'))
  })
})

// ⚠️⚠️ A REGRA 11 ME PEGOU: os testes acima provam a DECISÃO pura (janela, fuso) e ficaram
// VERDES quando eu repus os defeitos NAS TELAS — tirei o recorte do fetch dos Lançamentos
// e devolvi o mês UTC ao hook, e nada acusou. *Guard que testa a régua e não o uso dela
// aprova a tela que ignora a régua.* O bloco abaixo pergunta pras TELAS.
describe('⛔⛔ e as TELAS usam a régua — não só a lib', () => {
  const ler = (p: string) => readFileSync(join(__dirname, '..', '..', p), 'utf8')
  const LANCAMENTOS = 'app/(dashboard)/perfis/[id]/transacoes/page.tsx'
  const DASHBOARD = 'components/perfis/dashboard-pf.tsx'

  it('⭐⭐ os Lançamentos MANDAM o período no fetch — senão voltam às 499', () => {
    const src = ler(LANCAMENTOS)
    expect(src, 'o fetch dos lançamentos perdeu o recorte de mês').toMatch(/transacoes\?[^`]*startDate=/)
    expect(src).toMatch(/endDate=/)
  })

  it('⭐⭐ as DUAS telas leem o MESMO hook — é o que faz "uma escolha, duas telas"', () => {
    for (const p of [LANCAMENTOS, DASHBOARD]) {
      expect(ler(p), `${p} não usa o mês compartilhado`).toContain('useMesDoPerfil')
    }
  })

  it('⛔ e nenhuma delas volta a calcular o mês pelo UTC', () => {
    // ⚠️ `new Date().toISOString().slice(0,7)` é o mês do SERVIDOR — no dia 1º às 00h30 de
    // São Paulo ele diz o mês anterior. Foi assim que o dashboard nasceu.
    for (const p of [LANCAMENTOS, DASHBOARD]) {
      const sem = ler(p).replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '').replace(/\/\/[^\n]*/g, '')
      expect(sem, `${p} voltou a usar o mês do UTC`).not.toMatch(/new Date\(\)\.toISOString\(\)\.slice\(0,\s*7\)/)
    }
  })
})
