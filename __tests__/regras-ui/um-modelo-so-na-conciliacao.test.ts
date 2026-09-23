/**
 * ⭐⭐⭐ UM MODELO SÓ, E O PALPITE MOSTRA A CONTA INTEIRA (23/09/2026).
 *
 * Três regras do dono, no mesmo arquivo porque são a mesma tela:
 *
 * **1. UM MODELO SÓ** — *"nenhuma decisão fora do chassi ≍"*. O card do lote (PRONTOS PRA
 * CONFIRMAR) era a última superfície com visual próprio; o N:M já tinha entrado em 20/09.
 *
 * **3. O PALPITE MOSTRA A CONTA INTEIRA** — *"eu confiro valor e data ANTES de confirmar,
 * não depois"*. Mostrar só o nome da empresa é pedir assinatura no escuro.
 *
 * **4. "NÃO É ESSA"** — quando o palpite erra, trocar a conta não podia exigir abandonar o
 * palpite. É a porta que os cards de CASO têm desde 07/09 e o 1↔1 nunca ganhou.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { venceuOuVence } from '@/lib/conciliacao/vencimento-na-tela'

const raiz = process.cwd()
const ler = (p: string) => readFileSync(join(raiz, p), 'utf-8')
/** ⚠️ sem comentário: o arquivo que DOCUMENTA a regra não pode ser o que a cumpre */
const semComentario = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

const LOTE = ler('components/conciliacao/lote-sugerido.tsx')
const CAIXA = ler('components/conciliacao/caixa-de-entrada.tsx')
const PAGINA = ler('app/(dashboard)/conciliacao/page.tsx')

describe('⛔⛔ 1. UM MODELO SÓ — nenhuma decisão fora do chassi ≍', () => {
  it('⭐ o card do LOTE veste o chassi', () => {
    const l = semComentario(LOTE)
    expect(l, 'o lote voltou a ter visual próprio').toContain('<ChassiDoCartao')
    // ⛔ moldura=false: ele mora DENTRO do card, e caixa dentro de caixa é ruído (20/09)
    expect(l).toMatch(/moldura=\{false\}/)
    expect(l).toContain('painelColado')
  })

  it('⛔⛔ e o grid PRÓPRIO morreu — senão são dois modelos convivendo', () => {
    // ⚠️ era este o desenho antigo: uma grid de 3 colunas montada à mão no card do lote
    expect(semComentario(LOTE), 'o grid antigo voltou ao lado do chassi')
      .not.toContain('grid md:grid-cols-[1fr_36px_1.4fr]')
  })

  it('⭐ TODA superfície de decisão da página passa pelo chassi', () => {
    /**
     * ⚠️ O guard é sobre os COMPONENTES que a página desenha, não sobre o texto dela: a
     * página compõe, os cards decidem. Cada um destes desenha um gesto que grava.
     */
    const decisores = [
      'components/conciliacao/caixa-de-entrada.tsx',
      'components/conciliacao/escolher-na-mao-card.tsx',
      'components/conciliacao/lote-sugerido.tsx',
    ]
    for (const d of decisores) {
      expect(semComentario(ler(d)), `${d} decide fora do chassi ≍`).toContain('ChassiDoCartao')
    }
    // ⛔ e a página não pode desenhar um card de decisão por conta própria
    expect(PAGINA).toContain('<LoteSugerido')
  })
})

describe('⭐⭐ 3. O PALPITE MOSTRA A CONTA INTEIRA', () => {
  const c = semComentario(CAIXA)

  it('⛔ o retrato traz VALOR, VENCIMENTO e a descrição com NF/parcela', () => {
    expect(c, 'o palpite voltou a mostrar só o nome da empresa').toContain('alvoDetalhe')
    expect(c).toContain('A CONTA A PAGAR')
    expect(c).toContain('alvoDetalhe.valor')
    expect(c).toContain('alvoDetalhe.vencimento')
    expect(c).toContain('alvoDetalhe.descricao')
  })

  it('⭐ e o dado sai da MESMA conta que o matcher escolheu — nunca de 2ª leitura', () => {
    const p = semComentario(ler('lib/conciliacao/palpites-da-caixa.ts'))
    // ⚠️ `conta` é o objeto que o `sugerirVinculos` apontou; reconsultar poderia mostrar
    // um valor e conciliar outro
    expect(p).toMatch(/alvoDetalhe: conta \? \{/)
    expect(p, 'o vencimento virou a data de emissão').toContain('conta.dueDate ?? conta.date')
  })

  it('⛔⛔ o vencimento é comparado com o dia do BRASIL, nunca com UTC', () => {
    // ⚠️ o servidor roda em UTC: das 21h à meia-noite toda conta que vence HOJE apareceria
    // como "venceu" (a cicatriz do card do cartão, 09/09, e do Contas a Pagar, 13/09)
    expect(venceuOuVence('2026-09-22', '2026-09-23')).toBe('venceu 22/09')
    expect(venceuOuVence('2026-09-23', '2026-09-23')).toBe('vence HOJE (23/09)')
    expect(venceuOuVence('2026-09-24', '2026-09-23')).toBe('vence 24/09')
    // ⛔ e nunca diz só "venceu": a data vem junto, senão o dono vai procurar qual dia era
    expect(venceuOuVence('2026-09-01', '2026-09-23')).toContain('01/09')
    // ⚠️ mas o ANO aparece quando é outro — "venceu 22/09" numa conta de 2025 se lê como
    // deste mês, e aí a data que existe pra informar passa a enganar
    expect(venceuOuVence('2025-09-22', '2026-09-23')).toBe('venceu 22/09/2025')
  })
})

describe('⭐⭐ 4. "NÃO É ESSA — ESCOLHER OUTRA"', () => {
  const c = semComentario(CAIXA)

  it('⭐ o botão existe ao lado do ✓ Confirmar, nas duas ações de casar', () => {
    expect(CAIXA, 'o palpite não tem porta de troca — errar exige abandonar o palpite')
      .toContain('não é essa — escolher outra')
    expect(c).toMatch(/l\.palpite\.acao === 'CASAR_PAGAR' \|\| l\.palpite\.acao === 'CASAR_RECEBER'/)
    expect(c).toContain('onTrocarConta(l)')
  })

  it('⛔⛔ e ele abre o painel SEM a sugerida pré-marcada', () => {
    /**
     * ⛔ Marcar a errada de novo é fazer o dono desmarcar antes de escolher — e desmarcar
     * é o gesto que ninguém lembra de fazer.
     */
    expect(c).toContain('preSelecionados={trocandoConta ? [] : idsDoPalpite(l)}')
    // ⚠️ e o estado zera ao fechar e ao conciliar, senão o PRÓXIMO palpite abriria sem marca
    expect(c).toContain('setProcurando(null); setTrocandoConta(false)')
  })

  it('⭐ e ele NÃO é uma segunda porta de gravação — quem efetiva é o painel de sempre', () => {
    // ⚠️ o botão só ABRE o Find & Match; a conciliação continua saindo do `onReconciled`
    const bloco = CAIXA.slice(CAIXA.indexOf('não é essa'), CAIXA.indexOf('não é essa') + 600)
    expect(bloco).not.toContain('fetch(')
    expect(bloco).not.toContain('onGesto(')
  })
})
