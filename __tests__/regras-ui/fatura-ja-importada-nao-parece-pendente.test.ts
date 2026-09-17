// ⛔⛔⛔ FATURA JÁ IMPORTADA NÃO PODE TER CARA DE IMPORT PENDENTE (17/09/2026)
//
// **O dono:** *"quando TODAS as linhas são duplicata, a tela continua parecendo um import
// pendente (tabela inteira, checkboxes, 'Confirmar e importar 0', nota pequena no rodapé) —
// eu quase confirmei duas vezes achando que faltava algo."*
//
// ⭐ A informação **existia** (cada linha vinha com selo "duplicata"), e mesmo assim a tela
// mentia: **ninguém lê 33 selos pra concluir "não há nada a fazer aqui"**. Quem conclui é a
// tela. É a família do *"erro disfarçado de vazio"* de cabeça pra baixo — aqui é **estado
// resolvido disfarçado de trabalho pendente**.
//
// ⚠️ Guard ESTRUTURAL e assumido como tal: o projeto roda em `environment: node`, sem jsdom,
// então não dá pra renderizar e clicar. Ele trava o que quebrou de fato — o gate do banner,
// o do botão e o do checkbox — e tem **auto-teste do detector**, senão passaria por cegueira
// (já aconteceu três vezes nesta casa).

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const TELA = join(process.cwd(), 'app/(dashboard)/empresas/[id]/cartoes/[cardId]/importar-fatura/page.tsx')
const ROTA = join(process.cwd(), 'app/api/empresas/[id]/cartoes/[cardId]/importar-fatura/preview/route.ts')

/** ⚠️ sem comentário: senão o guard morde a própria documentação do defeito */
function semComentario(caminho: string): string {
  return readFileSync(caminho, 'utf-8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/^\s*\/\/.*$/gm, '')
}

describe('⛔⛔ a tela DIZ que a fatura já está importada', () => {
  it('⭐ o banner existe e é governado por `todasDuplicatas`', () => {
    const t = semComentario(TELA)
    expect(t, 'sumiu o banner de "já está importada"').toMatch(/já está importada/i)
    expect(t, 'o banner tem que depender do estado, não de um booleano solto')
      .toMatch(/jaNoSistema\.todasDuplicatas\s*&&/)
  })

  it('⭐ e ele leva pra fatura no cartão — banner sem saída é só um aviso', () => {
    expect(semComentario(TELA)).toMatch(/Ver a fatura no cartão/i)
  })

  /**
   * ⛔ O servidor é quem sabe. Se a tela deduzir "todas são duplicata" varrendo as linhas,
   * nasce a segunda régua — e ela diverge do `isDuplicate` no primeiro caso de borda.
   */
  it('⭐ quem resolve o estado é a ROTA, e ela manda o resumo pronto', () => {
    const r = semComentario(ROTA)
    expect(r).toMatch(/jaNoSistema:\s*\{/)
    expect(r).toMatch(/todasDuplicatas:/)
    expect(r).toMatch(/importadaEm:/)
  })
})

describe('⛔ nenhum gesto que não faz nada', () => {
  /**
   * ⛔⛔ `disabled` NÃO BASTA: botão desabilitado continua dizendo *"é aqui que se conclui"*,
   * e foi lendo "Confirmar e importar 0" que o dono quase confirmou de novo. Ele **some**.
   */
  it('⭐ o botão de confirmar só existe quando há linha marcada', () => {
    const t = semComentario(TELA)
    expect(t, 'o botão voltou a ser renderizado sempre (com disabled)')
      .toMatch(/selectedLines\.length\s*>\s*0\s*&&[\s\S]{0,200}Confirmar e importar/)
    expect(
      /disabled=\{selectedLines\.length === 0\}/.test(t),
      'voltou o `disabled` no lugar de sumir com o botão',
    ).toBe(false)
  })

  /** ⭐ e linha que não vai entrar não oferece checkbox */
  it('⭐ o checkbox só aparece em linha que NÃO está no sistema', () => {
    const t = semComentario(TELA)
    expect(t, 'o modo leitura sumiu').toMatch(/const soLeitura = line\.isDuplicate/)
    expect(t, 'o checkbox voltou a ser incondicional')
      .toMatch(/soLeitura \?[\s\S]{0,300}<input type="checkbox"/)
  })

  it('⭐ a linha já-no-sistema se chama pelo que ela é', () => {
    expect(semComentario(TELA)).toMatch(/já no sistema/i)
  })
})

describe('⭐ o caso MISTO: o que pede decisão fica em cima', () => {
  it('⭐ as linhas são ordenadas com as novas primeiro', () => {
    expect(semComentario(TELA)).toMatch(/sort\(\(a, b\) => Number\(a\.isDuplicate\) - Number\(b\.isDuplicate\)\)/)
  })

  it('⭐ e o contador diz as duas metades', () => {
    expect(semComentario(TELA)).toMatch(/nova\(s\)[\s\S]{0,60}já no sistema/)
  })
})

describe('⭐ auto-teste do detector — ele reprova o mundo ANTIGO', () => {
  /**
   * ⚠️ Sem isto o guard pode estar passando por cegueira (regex que nunca casa nada).
   * Aqui eu monto a tela do jeito que ela era e exijo que cada checagem reprove.
   */
  const TELA_ANTIGA = `
    <Button onClick={handleConfirm} disabled={selectedLines.length === 0}>
      Confirmar e importar {selectedLines.length}
    </Button>
    <input type="checkbox" checked={line.selected} onChange={onToggleSelect} />
    {line.isDuplicate && <Badge>duplicata</Badge>}
  `
  it('⛔ a tela antiga não tem banner, nem modo leitura, nem botão que some', () => {
    expect(/já está importada/i.test(TELA_ANTIGA)).toBe(false)
    expect(/const soLeitura = line\.isDuplicate/.test(TELA_ANTIGA)).toBe(false)
    expect(/selectedLines\.length\s*>\s*0\s*&&/.test(TELA_ANTIGA)).toBe(false)
    expect(/disabled=\{selectedLines\.length === 0\}/.test(TELA_ANTIGA)).toBe(true)
  })
})
