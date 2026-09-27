// ⭐⭐⭐ "NENHUM RÓTULO PROMETE MAIS DO QUE ENTREGA" (13/09/2026) — a régua do dono.
//
// **O caso:** ele procurou a parcela 002 do Casper em "PAGAS" e em "TODAS" e não achou em
// estado nenhum. Ela estava PAGA — e conta paga **conciliada com o extrato** sai desta tela
// desde 28/05 (`reconciledWithId: null`), pra a mesma linha não viver em duas telas.
//
// ⭐ A decisão de 28/05 continua de pé; o que este guard trava é a **PROMESSA**.
//
// ⚠️ E ele confere os DOIS lados, porque cada um sozinho aprova um mundo errado:
//   • só o rótulo → aprovaria o dia em que a tela passasse a mostrar as conciliadas e o
//     texto continuasse dizendo "sem conciliar" (mentira ao contrário);
//   • só o escopo → aprovaria o rótulo "Pagas" seco de volta.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { buildPayableListWhere } from '../list-filters'
import { ROTULO_PAGAS, ROTULO_TODOS } from '../rotulos'

const raiz = join(__dirname, '..', '..', '..')
const ler = (p: string) => readFileSync(join(raiz, p), 'utf8')

const PAGINA = 'app/(dashboard)/contas-a-pagar/page.tsx'
const DROPDOWN = 'components/contas-pagar/PayableFilters.tsx'
const RODAPE = 'components/contas-pagar/StickyFooter.tsx'

/** o FATO que os rótulos têm que refletir: a conciliada não está aqui, em filtro nenhum */
function escopoEscondeAsConciliadas(status: 'RECONCILED' | 'TODOS') {
  const w = buildPayableListWhere({
    empresaId: 'emp-1', status, dataField: 'dueDate',
  } as Parameters<typeof buildPayableListWhere>[0])
  const and = (w.AND ?? []) as Array<Record<string, unknown>>
  const escopo = and.find((x) => Array.isArray(x.OR) && (x.OR as Array<Record<string, unknown>>).some((o) => o.lifecycle === 'EFFECTED'))
  const pagas = ((escopo?.OR ?? []) as Array<Record<string, unknown>>).find((o) => o.lifecycle === 'EFFECTED')
  return pagas?.reconciledWithId === null
}

describe('⛔ o filtro esconde as conciliadas — então o rótulo TEM que dizer isso', () => {
  it('⭐ o FATO: "pagas" e "todos" excluem a conta conciliada com o extrato (decisão 28/05)', () => {
    expect(escopoEscondeAsConciliadas('RECONCILED')).toBe(true)
    expect(escopoEscondeAsConciliadas('TODOS')).toBe(true)
  })

  it('⭐⭐ o rótulo de PAGAS ressalva — "Pagas" seco promete as conciliadas que ele esconde', () => {
    expect(ROTULO_PAGAS.toLowerCase()).toMatch(/sem conciliar|aguardando concilia/)
    // os TRÊS lugares que filtram a mesma coisa leem o MESMO rótulo
    for (const arq of [PAGINA, DROPDOWN, RODAPE]) {
      expect(ler(arq), `${arq} não usa o dono único do rótulo`).toContain('ROTULO_PAGAS')
    }
  })

  it('⛔ "Todos status" morreu — "todos" que não é todos é a família do "69 duplicatas"', () => {
    expect(ROTULO_TODOS.toLowerCase()).not.toBe('todos status')
    expect(ROTULO_TODOS.toLowerCase()).toMatch(/sem vínculo|em aberto/)
    expect(ler(DROPDOWN)).not.toContain('Todos status')
  })

  it('⚠️ nenhum dos três escreve o rótulo NA MÃO — três textos divergem no 1º ajuste', () => {
    // o que morde: alguém "melhorar" o texto num lugar e a tela passar a dizer duas coisas
    expect(ler(RODAPE)).not.toMatch(/label:\s*'Pagas'/)
    expect(ler(PAGINA)).not.toMatch(/label="Pagas"/)
  })

  it('⭐⭐ a RESSALVA continua dita — é ela que segura a promessa', () => {
    /**
     * ⚠️⚠️ **INVERTIDO em 26/09, com a TENSÃO registrada — e ela é real.** Este teste exigia
     * que a tela mostrasse *"as já conciliadas estão em Movimentações →"*, pela régua de
     * 13/09: *"rótulo honesto que não diz o caminho troca uma mentira por um mistério"*.
     *
     * ⭐ O dono pesou e decidiu o contrário: *"MORRE a frase — legenda de construção; quem
     * precisar de conciliadas acha em Movimentações sozinho"*. O que ele trocou foi **uma
     * legenda permanente na primeira dobra de uma tela de trabalho** por texto que se lê
     * uma vez e nunca mais.
     *
     * ⛔ **O que NÃO afrouxou, e é o que este teste passa a provar:** a ressalva que levanta
     * a dúvida continua nos RÓTULOS (*"Pagas (sem conciliar)"*, *"Em aberto e pagas sem
     * vínculo"*). Se ela sumisse, voltaria a MENTIRA — que é pior que o mistério.
     */
    const filtros = ler(DROPDOWN)
    expect(filtros, 'o rótulo honesto sumiu — "Pagas" seco volta a mentir').toContain('ROTULO_PAGAS')
    expect(filtros).toContain('ROTULO_TODOS')
    expect(ROTULO_PAGAS.toLowerCase()).toContain('sem conciliar')
    expect(ROTULO_TODOS.toLowerCase()).toContain('sem vínculo')
    /**
     * ⛔ e a legenda permanente não pode voltar pra primeira dobra.
     * ⚠️ Lido SEM COMENTÁRIO: *o arquivo que DOCUMENTA a remoção não pode ser o que a
     * reprova* — a frase sobrevive no comentário que explica por que ela saiu.
     */
    const semComentario = (x: string) => x.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
    expect(semComentario(ler(PAGINA)), 'a legenda de construção voltou pro topo da tela')
      .not.toContain('Esta tela mostra o que está')
  })

  it('⚠️ auto-teste do detector: ele PEGA o mundo antigo', () => {
    // sem isso o guard passaria por cegueira — a lição dos guards que nasceram verdes
    const antigo = `<SelectItem value="TODOS">Todos status</SelectItem>`
    expect(antigo).toContain('Todos status')
    const rodapeAntigo = `{ kind: 'paid', label: 'Pagas', tone: '' },`
    expect(rodapeAntigo).toMatch(/label:\s*'Pagas'/)
  })
})
