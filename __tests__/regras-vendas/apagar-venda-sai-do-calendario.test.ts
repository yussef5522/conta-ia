/**
 * ⛔⛔⛔ APAGAR UMA VENDA TIRA ELA DO CALENDÁRIO (30/09/2026).
 *
 * **O defeito, medido na execução real em prod:** o dono excluiu a duplicata de
 * R$ 2.112,00 do cofre pela porta nova. O **saldo caiu certo** (47.678,63 → 45.566,63) e a
 * `VendaDiaria` do 17/09 continuou gravada em **4.994,00**, com uma origem apontando pra
 * uma transação **que não existe mais**.
 *
 * ***O dinheiro saiu do saldo e ficou no calendário de vendas.***
 *
 * ⚠️⚠️ É a classe ***"N caminhos, 1 esquecido"***, e o mais duro é que ela já tinha
 * cobrado nesta MESMA função: em 25/08 o gatilho faltava na CRIAÇÃO manual (as vendas em
 * dinheiro do cofre de 24 e 25/08 ficaram órfãs). A lição escrita naquele dia foi
 * *"listar os caminhos que CRIAM, não só os que importam"* — e a lista que nasceu dela
 * cobriu POST, PATCH, lote, import, conciliação e `createContaPendente`.
 * **APAGAR é a terceira coisa, e ficou de fora.**
 *
 * ⭐ Este guard é ESTRUTURAL e assumido como tal: o DELETE é uma rota Next com
 * `getAuthContext`/`logAudit`, e o que morde de verdade — *a `VendaDiaria` encolheu?* — é
 * o recompute, que já tem golden e invariante V1/V2 no juiz. O que falta provar aqui é o
 * **ENCAIXE**: a porta chama o gatilho, e a lista de origens a conhece.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const raiz = process.cwd()
const ler = (p: string) => readFileSync(join(raiz, p), 'utf-8')
/** ⚠️ sem comentário: o arquivo que DOCUMENTA o defeito não pode ser o que o absolve */
const semComentario = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '')

const ROTA = 'app/api/transacoes/[id]/route.ts'
const HOOK = 'lib/vendas/recompute-hook.ts'

/** quantas vezes o símbolo é USADO — a linha do `import` não conta (REGRA 11, 15/09) */
function usosDe(fonte: string, simbolo: string): number {
  return semComentario(fonte)
    .split('\n')
    .filter((l) => !/^\s*import\b/.test(l) && l.includes(`${simbolo}(`)).length
}

describe('⛔⛔⛔ apagar venda tira do calendário — o gatilho está em TODAS as portas', () => {
  it('⛔⛔ o DELETE dispara o gatilho de vendas (era ele que faltava)', () => {
    const rota = semComentario(ler(ROTA))
    /**
     * ⭐ O que morde é o USO dentro do bloco do DELETE — a rota tem PATCH logo acima, que
     * já chamava o hook, então contar no arquivo inteiro aprovaria o defeito.
     */
    const iDelete = rota.indexOf('export async function DELETE')
    expect(iDelete, 'o DELETE sumiu da rota').toBeGreaterThan(0)
    const bloco = rota.slice(iDelete)
    expect(
      usosDe(bloco, 'recomputeVendasSeVenda'),
      'o DELETE voltou a apagar venda sem mexer no calendário — o dinheiro sai do saldo e fica em VendaDiaria',
    ).toBeGreaterThan(0)
  })

  it('⛔ e ele se IDENTIFICA — "não logou" tem que significar uma coisa só', () => {
    /**
     * ⚠️ A instrumentação de 27/08 existe porque *"não logou"* era ambíguo entre quatro
     * coisas, e isso impediu de achar a porta da venda-fantasma de R$ 2.041,00. Porta nova
     * sem nome reabre a ambiguidade.
     */
    const rota = semComentario(ler(ROTA))
    expect(rota).toContain("'DELETE /api/transacoes/[id]'")
    expect(semComentario(ler(HOOK)), 'a porta não entrou na lista fechada de origens').toContain(
      "| 'DELETE /api/transacoes/[id]'",
    )
  })

  it('⭐⭐ a LISTA FECHADA é o mecanismo — porta nova sem nome NÃO COMPILA', () => {
    /**
     * ⭐ `OrigemHook` ser um union de literais é o que transforma *"lembrar de identificar
     * a porta"* em *"não dá pra não identificar"* (REGRA 5). Se ela virar `string`, a
     * próxima porta entra anônima e o log volta a ser ambíguo.
     */
    const hook = semComentario(ler(HOOK))
    expect(hook).toMatch(/export type OrigemHook\s*=\s*\n?\s*\|/)
    expect(hook, 'OrigemHook virou string — a porta nova passa a entrar anônima').not.toMatch(
      /export type OrigemHook\s*=\s*string/,
    )
  })

  it('⛔ o gatilho roda FORA da transação da exclusão (fail-soft não desfaz o gesto)', () => {
    /**
     * ⚠️ Dentro da `$transaction` uma falha do recompute **desfaria a exclusão que o dono
     * já confirmou** — e o hook é fail-soft justamente pra nunca derrubar o caller. A
     * ordem certa é: apaga, re-ancora, audita, commita; **depois** recompute.
     */
    const rota = semComentario(ler(ROTA))
    const iDelete = rota.indexOf('export async function DELETE')
    const bloco = rota.slice(iDelete)
    const iFimTransacao = bloco.indexOf('await prisma.$transaction')
    const iHook = bloco.indexOf('recomputeVendasSeVenda(')
    expect(iFimTransacao).toBeGreaterThan(0)
    expect(iHook, 'o gatilho sumiu do DELETE').toBeGreaterThan(0)
    // ⭐ o hook vem DEPOIS do fechamento da transação — e recebe o `prisma` global, não o `tx`
    expect(bloco.slice(iHook, iHook + 60), 'o gatilho entrou na transação da exclusão').toMatch(
      /recomputeVendasSeVenda\(\s*\n?\s*prisma,/,
    )
  })
})
