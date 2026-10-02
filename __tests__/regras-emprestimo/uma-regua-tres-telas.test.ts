/**
 * ⛔⛔⛔ UMA RÉGUA PRA TRÊS TELAS — O STATUS DA PARCELA (02/10/2026).
 *
 * **O defeito que o dono navegou:** a parcela 22 do **C41033828** tem os DOIS pagamentos
 * vinculados somando **exatamente** o devido, e as telas davam **três respostas**:
 *
 * ```
 * LISTA de empréstimos  → EM DIA      (find(status === 'OPEN') PULAVA a PARTIAL)
 * CONTRATO (cabeçalho)  → EM DIA      (mesma régua, e numa parcial de verdade
 *                                      isso ESCONDE o resto em aberto)
 * A PARCELA 22          → ATRASADA + "Marcar paga"   ⛔ dupla contagem a um clique
 * ```
 *
 * ⭐ Este guard é **ESTRUTURAL e assumido como tal**: as três superfícies são rotas Next com
 * `getAuthContext` + Prisma, e o que morde de verdade — *o veredito está certo?* — vive em
 * `lib/loans/__tests__/estado-da-parcela.test.ts`, com os números reais de prod. O que falta
 * provar AQUI é o **ENCAIXE**: as três consomem a MESMA função e nenhuma guarda régua própria.
 *
 * ⚠️ Era exatamente o encaixe que faltava — a régua `estadoDaParcela` podia estar perfeita e
 * o cabeçalho do contrato continuar respondendo por conta dele.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const raiz = process.cwd()
const ler = (p: string) => readFileSync(join(raiz, p), 'utf-8')
/** ⚠️ sem comentário: o arquivo que DOCUMENTA o defeito não pode ser o que o absolve */
const semComentario = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '')

/** quantas vezes o símbolo é USADO — a linha do `import` não conta (REGRA 11) */
function usosDe(fonte: string, simbolo: string): number {
  return semComentario(fonte)
    .split('\n')
    .filter((l) => !/^\s*import\b/.test(l) && l.includes(`${simbolo}(`)).length
}

const ROTA_LISTA = 'app/api/empresas/[id]/emprestimos/route.ts'
const ROTA_CONTRATO = 'app/api/empresas/[id]/emprestimos/[loanId]/route.ts'
const TELA_LISTA = 'app/(dashboard)/empresas/[id]/emprestimos/page.tsx'
const TELA_CONTRATO = 'app/(dashboard)/empresas/[id]/emprestimos/[loanId]/page.tsx'

describe('⛔⛔⛔ as três superfícies leem a MESMA régua', () => {
  it('⛔⛔ as duas rotas CHAMAM estadoDaParcela — menção no import não conta', () => {
    for (const rota of [ROTA_LISTA, ROTA_CONTRATO]) {
      const src = ler(rota)
      expect(src, `${rota} não importa a régua única`).toContain(
        "from '@/lib/loans/estado-da-parcela'",
      )
      expect(
        usosDe(src, 'estadoDaParcela'),
        `${rota} menciona a régua e não a USA`,
      ).toBeGreaterThanOrEqual(1)
    }
  })

  it('⛔⛔⛔ nenhuma rota acha a PRÓXIMA parcela por `status === OPEN` — era o que pulava a PARCIAL', () => {
    /**
     * ⭐ É o coração do defeito: a parcial tem dinheiro dentro e **continua devendo**.
     * Saltar pra a parcela seguinte faz o contrato dizer "em dia" com resto em aberto.
     */
    for (const rota of [ROTA_LISTA, ROTA_CONTRATO]) {
      const src = semComentario(ler(rota))
      expect(src, `${rota} voltou a procurar a próxima por status gravado`).not.toMatch(
        /\.find\(\s*\([^)]*\)\s*=>\s*\w+\.status\s*===\s*'OPEN'/,
      )
      // a forma CERTA: a próxima é a primeira que a régua não chama de PAGA
      expect(src, `${rota} não deriva a próxima do veredito`).toMatch(
        /estado\s*!==\s*'PAGA'/,
      )
    }
  })

  it('⛔⛔ nenhuma rota decide ATRASADA comparando dueDate na mão', () => {
    /**
     * ⚠️ Havia DUAS implementações — a lista comparava por DIA (com o motivo escrito) e o
     * contrato por INSTANTE. Divergiam no PRÓPRIO dia do vencimento: a cicatriz de fuso que
     * esta casa já pagou no card do cartão (09/09) e no Contas a Pagar (13/09).
     * ⭐ Agora quem compara é a régua, num lugar só.
     */
    for (const rota of [ROTA_LISTA, ROTA_CONTRATO]) {
      const src = semComentario(ler(rota))
      expect(src, `${rota} voltou a comparar vencimento na mão`).not.toMatch(
        /isAtrasada\s*=\s*[^\n]*dueDate[^\n]*[<>]/,
      )
      expect(src, `${rota} não deriva o atraso do veredito`).toMatch(
        /estado\s*===\s*'ATRASADA'/,
      )
    }
  })

  it('⛔⛔⛔ o botão "marcar paga" sai de `ofereceMarcarPaga`, nunca do status gravado', () => {
    /**
     * ⛔ Era `i.status === 'OPEN' || i.status === 'LATE'` — e com a #22 em `PARTIAL` virando
     * `LATE` no tradutor, o botão aparecia numa parcela **que já tinha os dois pagamentos
     * vinculados**. Clicar ali levaria a um TERCEIRO vínculo: dupla contagem a um clique.
     */
    const rota = semComentario(ler(ROTA_CONTRATO))
    expect(usosDe(rota, 'ofereceMarcarPaga'), 'a rota não calcula a oferta').toBeGreaterThanOrEqual(1)

    /**
     * ⚠️ POR ESTRUTURA, NUNCA POR DISTÂNCIA: a 1ª versão deste guard cortava 400 caracteres
     * depois do gate e deu **falso vermelho com a tela certa** — o rótulo mora algumas
     * linhas abaixo. *Janela de distância já produziu falso vermelho E falso verde nesta
     * casa* (o rastro em 12/09, o menu do PF em 13/09, o rodapé em 14/09).
     */
    const tela = semComentario(ler(TELA_CONTRATO))
    // (a) o GATE consulta o campo que o servidor derivou da régua
    expect(tela, 'o gate do botão voltou a olhar só o status gravado').toMatch(
      /\{\(i\.ofereceMarcarPaga\s*\?\?/,
    )
    // (b) e o RÓTULO do gesto vem da régua — "completar — faltam R$ X" ≠ "marcar paga"
    expect(tela, 'o rótulo do gesto não vem da régua').toContain('i.rotuloDoGesto')
  })

  it('⭐⭐ as DUAS telas conhecem o estado PARCIAL — senão a parcial volta a ser chamada de atrasada', () => {
    for (const tela of [TELA_LISTA, TELA_CONTRATO]) {
      expect(semComentario(ler(tela)), `${tela} não conhece PARCIAL`).toContain("'PARCIAL'")
    }
  })

  it('⛔ e o cabeçalho do contrato mostra o que FALTA numa parcial, não o nominal da agenda', () => {
    /**
     * ⚠️⚠️ DENTRO DO `value=` DO CARD, não "em algum lugar do arquivo": a 1ª versão deste
     * guard veio **VERDE** com o defeito reposto, porque as frases também aparecem no `sub=`
     * logo abaixo. ***"Menção, não uso"*** — o que decide o NÚMERO é o `value`.
     */
    const tela = semComentario(ler(TELA_CONTRATO))
    const iLabel = tela.indexOf('label="Próxima parcela"')
    expect(iLabel, 'o card da próxima parcela sumiu').toBeGreaterThan(0)
    const iValue = tela.indexOf('value=', iLabel)
    const iSub = tela.indexOf('sub=', iValue)
    const valor = tela.slice(iValue, iSub)
    expect(valor, 'o `value` do card voltou a mostrar o nominal da agenda').toMatch(
      /estado\s*===\s*'PARCIAL'/,
    )
    expect(valor, 'o `value` do card não mostra o que FALTA').toMatch(/\.falta/)
  })
})

describe('⛔⛔ a GRAVAÇÃO soma todos os vínculos, nunca só os deste gesto', () => {
  const GRAVACAO = 'lib/loans/vincular-pagamento.ts'

  it('⛔⛔⛔ o paidTotal sai da Σ de TODOS os pagamentos da parcela', () => {
    /**
     * ⛔ Era a Σ **das transações DESTE gesto**, sobrescrevendo o campo: vincular em dois
     * gestos **perdia o primeiro**. Foi assim que a #22 ficou com `paidTotal 2.665,44` tendo
     * 10.234,35 vinculados — e daí o `status PARTIAL` que fez as três telas divergirem.
     * ⚠️ A #21, com 3 mordidas num gesto só, ficou certa — é por isso que o defeito passou.
     */
    /**
     * ⚠️⚠️ A 1ª versão deste guard veio **VERDE** com o defeito reposto: ela casava
     * `loanInstallmentPayment.findMany` e o arquivo tem **DUAS** dessas (a outra busca as
     * DATAS dos pagamentos). ***O guard mordeu a chamada errada.*** O que decide é a
     * EXPRESSÃO do `paidTotal`: ela tem que somar os dois lados.
     */
    const src = semComentario(ler(GRAVACAO))
    expect(src, 'a gravação não usa o arredondamento da régua').toContain('arredondar2')
    // (a) os já-vinculados vêm do BANCO, não de uma lista vazia
    expect(src, 'a gravação parou de ler os vínculos que já existem').toMatch(
      /const jaVinculados\s*=\s*await prisma\.loanInstallmentPayment\.findMany/,
    )
    // (b) e a Σ do paidTotal inclui OS DOIS lados — os de antes e os deste gesto
    const iPaid = src.indexOf('const paidTotal')
    expect(iPaid, 'o paidTotal derivado sumiu').toBeGreaterThan(0)
    const expr = src.slice(iPaid, src.indexOf('\n\n', iPaid))
    expect(expr, 'o paidTotal voltou a ignorar os vínculos anteriores').toContain('jaVinculados')
    expect(expr, 'o paidTotal não soma as tx deste gesto').toMatch(/txs\.reduce/)
  })
})
