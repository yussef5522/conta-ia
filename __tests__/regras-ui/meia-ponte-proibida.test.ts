// ⛔⛔⛔ MEIA-PONTE É PROIBIDA — A REGRA NOVA DA CASA (15/09/2026)
//
// **A régua, palavras do dono:**
//   ***Gesto que ESCOLHE um alvo e não EFETIVA o vínculo é meia-ponte.*** O guard clica o
//   gesto e confere o **EFEITO NO DESTINO**, nunca a etiqueta na linha.
//
// ⛔⛔ **O DEFEITO QUE A CRIOU, medido na fonte:** no `pendentes-client.tsx` o seletor
// oferecia *"Pgto cartão"* e *"Pgto empréstimo"*, e o `onChange` era:
//
//     if (k === 'TRANSFER') setVincularBase(t)
//     else if (k === 'IGNORAR') ignorarTransacao(t.id)
//
// As outras duas **caíam no vazio** — um rótulo num `useState` local que não ia a lugar
// nenhum. *Não era meia-ponte: era ponte que não começa.*
//
// ⚠️ ESTE GUARD É ESTRUTURAL (sem jsdom não dá pra clicar) e cobre a METADE DA TELA: que
// nenhum menu ofereça uma ação sem despacho. A outra metade — o **efeito no destino** — é
// a suíte das 9 linhas (`__tests__/extrato/nove-linhas-e2e`), que roda contra banco real.
// **As duas juntas são a regra**; sozinha, cada uma aprova metade do defeito.

import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { semComentarios } from './card-nao-nasce-escondido.test'
import { acoesDoSentido, sentidoDaLinha, type AcaoDoBalcao } from '@/lib/conciliacao/caixa-de-entrada'

const raiz = process.cwd()
const RESOLVER = 'lib/conciliacao/resolver-linha.ts'
const resolver = readFileSync(join(raiz, RESOLVER), 'utf-8')

/**
 * ⭐ O DETECTOR: toda ação do menu tem despacho no choke-point?
 *
 * ⚠️ "Tem despacho" = aparece como `case 'X':` no `switch` do `resolverLinha`. Ação sem
 * `case` cai no vazio — que é exatamente a forma do defeito de 15/09.
 */
/**
 * ⭐ quantas vezes o símbolo é USADO — a linha do `import` não conta.
 * ⚠️ Existe porque um guard meu passou verde contando a menção (REGRA 11, 15/09).
 */
export function usosDe(src: string, simbolo: string): number {
  return src
    .split('\n')
    .filter((l) => !/^\s*import\b/.test(l) && !/^\s*\*/.test(l) && !/^\s*\/\//.test(l))
    .join('\n')
    .split(`${simbolo}(`).length - 1
}

export function acoesSemDespacho(src: string, acoes: readonly AcaoDoBalcao[]): AcaoDoBalcao[] {
  const corpo = src.slice(src.indexOf('switch (input.acao)'))
  return acoes.filter((a) => !corpo.includes(`case '${a}':`))
}

describe('⛔⛔ toda ação oferecida TEM despacho — nenhuma cai no vazio', () => {
  const todas = [...new Set([
    ...acoesDoSentido(sentidoDaLinha('DEBIT')).map((a) => a.acao),
    ...acoesDoSentido(sentidoDaLinha('CREDIT')).map((a) => a.acao),
  ])]

  it('⭐ o menu e o choke-point têm a MESMA lista', () => {
    expect(acoesSemDespacho(resolver, todas), 'ação oferecida sem despacho — meia-ponte').toEqual([])
  })

  /**
   * ⛔ AS DE VÍNCULO NÃO GRAVAM AQUI **de propósito** (a escolha do alvo tem casa própria),
   * mas **não podem calar**: elas devolvem o caminho. *Gesto mudo foi o defeito de 14/09.*
   */
  it('⭐ as ações de vínculo LEVAM ao alvo — nunca silêncio', () => {
    expect(resolver).toContain('DEEP_LINK')
    expect(resolver).toContain('export function destinoDaAcao')
    for (const a of ['CASAR_PAGAR', 'CASAR_RECEBER', 'TRANSFERENCIA_ENVIADA', 'TRANSFERENCIA_RECEBIDA']) {
      expect(resolver, `${a} sem destino`).toContain(a)
    }
  })

  /**
   * ⭐⭐ NENHUM MOTOR NOVO: cada gesto despacha pro motor já provado. Duas portas de
   * gravação do mesmo fato é a doença que o `vincularPagamentoDeParcela` (11/09) e o
   * `garantirFichaDeRevenda` (14/09) existem pra impedir.
   */
  it('⭐ os gestos chamam os motores que já existem, não versões próprias', () => {
    expect(resolver).toContain('casarPagamentoDeCartao')
    expect(resolver).toContain('vincularPagamentoDeParcela')
    expect(resolver).toContain('recomputeVendasSeVenda')
    // ⛔ e nenhum `update` de fatura/parcela escrito à mão aqui
    expect(resolver).not.toContain('loanInstallment.update')
    expect(resolver).not.toContain('paidInvoiceMonth:')
  })

  /**
   * ⚠️⚠️ ESTE GUARD FICOU VERDE COM O DEFEITO REPOSTO (REGRA 11, 15/09) — a 1ª versão
   * fazia `toContain('acaoValePraSentido')`, e **a linha do `import` já bastava**: troquei
   * a condição por `if (false)` no servidor e ele aprovou.
   *
   * ⭐ É a lição do detector de rastro (12/09) outra vez: **o que morde é contar o USO, não
   * a menção.** `usosDe` ignora a linha de import e exige a CHAMADA dentro de um `if`.
   */
  it('⛔ a lei do SENTIDO é checada no servidor, não só no menu', () => {
    expect(usosDe(resolver, 'acaoValePraSentido'), 'a lei do sentido virou enfeite no servidor').toBeGreaterThan(0)
    expect(resolver, 'a checagem do sentido saiu do caminho de guarda').toMatch(/if \(!acaoValePraSentido\(/)
    expect(resolver).toMatch(/ENTROU/)
    expect(resolver).toMatch(/SAIU/)
  })
})

describe('⛔⛔ o motor do cartão tem UMA porta — a rota é casca', () => {
  it('⭐ a gravação da fatura mora na lib, e a rota a chama', () => {
    expect(existsSync(join(raiz, 'lib/credit-card-pj/casar-pagamento.ts'))).toBe(true)
    const rota = readFileSync(join(raiz, 'app/api/empresas/[id]/cartoes/[cardId]/casar-pagamento/route.ts'), 'utf-8')
    expect(rota, 'a rota voltou a gravar por conta própria').toContain('casarPagamentoDeCartao')
  })
})

describe('⛔ o seletor morto dos Pendentes não pode voltar', () => {
  const PEND = 'app/(dashboard)/empresas/[id]/pendentes/pendentes-client.tsx'

  it('⭐ nenhuma tela oferece PAGAMENTO_CARTAO sem levar a lugar nenhum', () => {
    if (!existsSync(join(raiz, PEND))) return // a tela morreu — o melhor desfecho
    const src = semComentarios(readFileSync(join(raiz, PEND), 'utf-8'))
    const oferece = src.includes("'PAGAMENTO_CARTAO'") || src.includes('TransactionKindSelect')
    if (!oferece) return
    // se ainda oferece, TEM que despachar — o `onChange` precisa tratar os quatro
    const onChange = src.slice(src.indexOf('onChange={(k)'), src.indexOf('onChange={(k)') + 900)
    expect(onChange, 'o seletor voltou a oferecer tipo sem despacho').toMatch(/PAGAMENTO_CARTAO|resolver/)
  })
})

// ⭐⭐ REGRA 11 — o detector tem que pegar o defeito que motivou o guard.
describe('o detector morde (auto-teste)', () => {
  const SEM_DESPACHO = `switch (input.acao) { case 'IGNORAR': return x }`
  const COM_DESPACHO = `switch (input.acao) { case 'IGNORAR': case 'PGTO_CARTAO': return x }`

  it('acusa a ação oferecida sem case', () => {
    expect(acoesSemDespacho(SEM_DESPACHO, ['PGTO_CARTAO', 'IGNORAR'])).toEqual(['PGTO_CARTAO'])
  })

  it('não acusa quando todas despacham', () => {
    expect(acoesSemDespacho(COM_DESPACHO, ['PGTO_CARTAO', 'IGNORAR'])).toEqual([])
  })
})
