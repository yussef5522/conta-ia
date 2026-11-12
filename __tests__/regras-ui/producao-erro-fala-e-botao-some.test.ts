/**
 * ⭐ PRODUÇÃO — O ERRO FALA LÍNGUA DE GENTE E O BOTÃO QUE O PAPEL NÃO USA NÃO APARECE (12/11/2026).
 *
 * Raio-X: o tablet recebia 500 SEM CORPO na trava do estoque (D1, 09/11 20:43:14); a tela da
 * ordem engolia a recusa da grandeza como 500; o `carregar` da ordem tratava 403/500 como
 * "ordem não encontrada"; os botões apareciam pra quem leva 403. Guard ESTRUTURAL do USO (os
 * arquivos lidos sem comentário), complementar aos testes de comportamento em
 * lib/stock/producao/__tests__/conserto-d1-d2.integration.test.ts.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const ler = (rel: string) => readFileSync(join(process.cwd(), rel), 'utf8')
const semComentario = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/^[ \t]*\/\/.*$/gm, '')
const TABLET = semComentario(ler('app/api/empresas/[id]/estoque/producao/minhas-tarefas/finalizar/route.ts'))
const CONCLUIR = semComentario(ler('app/api/empresas/[id]/estoque/producao/ordens/[ordemId]/concluir/route.ts'))
const ETAPAS = semComentario(ler('app/api/empresas/[id]/estoque/producao/ordens/[ordemId]/etapas/route.ts'))
const ORDEM = semComentario(ler('app/(dashboard)/empresas/[id]/estoque/producao/[ordemId]/page.tsx'))
const PAINEL = semComentario(ler('lib/stock/producao/painel-producao.ts'))

describe('o finalizar do tablet é UM ato e a recusa tem frase', () => {
  it('o tablet chama o ato único (nunca finalizarTarefa solto seguido de concluir)', () => {
    expect(TABLET).toContain('finalizarEConcluirDoTablet(')
    expect(TABLET).not.toMatch(/await finalizarTarefa\(/)
    expect(TABLET).not.toMatch(/await concluirDoTablet\(/)
  })
  it('a trava do estoque e a grandeza voltam com FRASE; o resto volta com frase também (nunca 500 sem corpo)', () => {
    expect(TABLET).toContain('respostaDeErroDoEstoque(e')
    expect(TABLET).not.toMatch(/\n\s*throw e\n/)
    expect(TABLET).toMatch(/status: 500/)
    expect(TABLET).toMatch(/Nada foi gravado/)
  })
  it('a tela da ordem: /concluir traduz a grandeza e a trava; o gerente finaliza+conclui num ato só', () => {
    expect(CONCLUIR).toContain('respostaDeErroDoEstoque(e')
    expect(CONCLUIR).toContain('confirmouGrandeza')
    expect(ETAPAS).toMatch(/naTransacao\(prisma, async \(tx\) => \{\s*await finalizarPeloGerente/)
    expect(ETAPAS).toContain('respostaDeErroDoEstoque(e')
  })
})

describe('a tela da ordem não finge e não oferece o que o papel não pode', () => {
  it('a carga que falha tem NOME (403/500 nunca vira "ordem não encontrada")', () => {
    const carregar = ORDEM.slice(ORDEM.indexOf('const carregar = '), ORDEM.indexOf('useEffect(() => { carregar() }'))
    expect(carregar).toMatch(/if \(!r\.ok\) \{ setFalhaCarga\(/)
    expect(ORDEM).toContain('{falhaCarga ?? \'Ordem não encontrada.\'}')
  })
  it('separar/iniciar/cancelar/pedido/concluir só aparecem pra quem tem stock.operate', () => {
    expect(ORDEM).toContain("const podeOperar = !carregandoPerm && podePerm('stock.operate')")
    expect(ORDEM).toContain('{!encerrada && podeOperar && (')
    expect(ORDEM).toContain('{emProducao && podeOperar && (')
    expect(ORDEM).toContain("{porta.acao === 'CANCELAR_E_DEVOLVER' && podeOperar && (")
    expect(ORDEM).toContain('{podeOperar && <button\n              onClick={confirmarPedido}')
  })
  it('a recusa da conclusão mostra a frase do servidor e a grandeza vira PERGUNTA', () => {
    expect(ORDEM).toContain("if (j?.code === 'GRANDEZA' || j?.code === 'GRANDEZA_AVISO') setPedeConfirmar(true)")
    expect(ORDEM).toContain('onClick={() => void concluir(true)}')
  })
})

describe('"atrasada": o MESMO campo no card e no contador', () => {
  it('o contador do topo usa dataProducao (como o card), e a régua é o dia de Brasília', () => {
    expect(PAINEL).toContain('abertas.filter((o) => ehDeOntem(o.dataProducao, agora))')
    expect(PAINEL).toContain('diaEmSaoPaulo(dataProducao) < diaEmSaoPaulo(agora)')
    expect(PAINEL).not.toMatch(/getUTCDate\(\)/)
  })
})
