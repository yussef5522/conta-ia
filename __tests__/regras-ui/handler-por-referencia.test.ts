import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  aridadeDasProps,
  handlersPorReferenciaComParametro,
  semComentarios,
  telasDoApp,
  usosDe,
} from './_leitura-de-fonte'
import type { AcaoSemArgumento } from '@/lib/ui/acao-sem-argumento'

/**
 * ⛔⛔⛔ HANDLER COM PARÂMETRO PENDURADO POR REFERÊNCIA = VERMELHO (18/10/2026).
 *
 * **O defeito que parou o import de 16 e 17/10:** o Sprint 2.1 deu um parâmetro ao
 * `abrirPreview` (`confirmouDia?: string`) e o botão da revisão continuou com
 * `acao: abrirPreview`. React chamou `abrirPreview(syntheticEvent)`, o `JSON.stringify`
 * estourou **`Converting circular structure to JSON` ANTES do fetch**, e o catch traduziu como
 * *"Falha de conexão ao processar."* — **o nginx não registrou UMA requisição em dois dias**.
 *
 * ⚠️ **O `tsc` ficou verde porque a prop era `() => void`** e TypeScript aceita função com
 * parâmetro ali (variância). A cura de TIPO está em `lib/ui/acao-sem-argumento.ts`; este guard
 * é a outra metade — ele varre o app e **pega a forma onde ela ainda for possível**.
 */
describe('handler passado por referência não pode esperar argumento', () => {
  const fontes = telasDoApp().map((a) => ({ arq: a, src: readFileSync(a, 'utf8') }))
  const aridade = aridadeDasProps(fontes.map((f) => f.src))

  it('⛔ o app inteiro: nenhuma prop zero-arg recebe função que declara parâmetro', () => {
    const achados = fontes.flatMap((f) =>
      handlersPorReferenciaComParametro(f.src, aridade).map((h) => `${f.arq}:~${h.linha} ${h.prop}={${h.funcao}} → (${h.params}) [${h.componente}]`),
    )
    expect(achados, achados.join('\n')).toEqual([])
  })

  /**
   * ⚠️⚠️ REGRA 11 — **o detector tem auto-teste nos DOIS sentidos**, senão ele passaria por
   * cegueira (já aconteceu 3× nesta casa). E o 4º caso é **o erro que EU cometi no mapa da
   * caça**: a tela tem três `confirmar` e eu casei o nome com a declaração errada, reportando
   * 2 defeitos onde havia 1.
   */
  describe('auto-teste do detector', () => {
    const ar = new Map([
      ['acao', new Set([0])],
      ['onEscolher', new Set([1])],
    ])

    it('MORDE a forma do defeito (função com parâmetro na prop zero-arg)', () => {
      const src = `
export function Tela() {
  const abrirPreview = async (confirmouDia?: string) => { void confirmouDia }
  return <Revisao confirmar={{ acao: abrirPreview, habilitado: true }} />
}`
      const r = handlersPorReferenciaComParametro(src, ar)
      expect(r).toHaveLength(1)
      expect(r[0]).toMatchObject({ prop: 'acao', funcao: 'abrirPreview', componente: 'Tela' })
    })

    it('NÃO morde a cura (seta chamando sem argumento)', () => {
      const src = `
export function Tela() {
  const abrirPreview = async (confirmouDia?: string) => { void confirmouDia }
  return <Revisao confirmar={{ acao: () => abrirPreview(), habilitado: true }} />
}`
      expect(handlersPorReferenciaComParametro(src, ar)).toEqual([])
    })

    it('NÃO morde contrato que DECLARA parâmetro — o filho chama com o argumento certo', () => {
      const src = `
export function Editor() {
  const addComp = (it: ItemBusca) => { void it }
  return <BuscaItem onEscolher={addComp} />
}`
      expect(handlersPorReferenciaComParametro(src, ar)).toEqual([])
    })

    it('⭐ ESCOPO: dois `confirmar` no arquivo — só morde o do componente que tem parâmetro', () => {
      const src = `
export function ComParametro() {
  const confirmar = async (confirmouSanidade = false) => { void confirmouSanidade }
  return <Revisao confirmar={{ acao: confirmar, habilitado: true }} />
}
export function SemParametro() {
  const confirmar = async () => {}
  return <Revisao confirmar={{ acao: confirmar, habilitado: true }} />
}`
      const r = handlersPorReferenciaComParametro(src, ar)
      expect(r).toHaveLength(1)
      expect(r[0].componente).toBe('ComParametro')
    })

    it('NÃO morde prop de evento do DOM — ali o `tsc` já cobra pela contravariância', () => {
      const src = `
export function Tela() {
  const confirmar = async (confirmouSanidade = false) => { void confirmouSanidade }
  return <button onClick={confirmar} />
}`
      expect(handlersPorReferenciaComParametro(src, new Map([['onClick', new Set([1])]]))).toEqual([])
    })

    it('NÃO morde prop de dono AMBÍGUO — chutar o contrato do vizinho inventaria defeito', () => {
      const src = `
export function Tela() {
  const f = (x: string) => { void x }
  return <A onAlgo={f} />
}`
      // duas declarações no repo: uma zero-arg e uma com parâmetro → fora
      expect(handlersPorReferenciaComParametro(src, new Map([['onAlgo', new Set([0, 1])]]))).toEqual([])
    })
  })
})

/**
 * ⭐⭐ A CURA DE TIPO, PROVADA NO PRÓPRIO `tsc` — e é red-then-green de verdade: se alguém
 * alargar `AcaoSemArgumento` de volta pra `() => void`, o erro esperado **deixa de existir** e
 * o `@ts-expect-error` passa a ser ele próprio um erro de compilação. ⚠️ É a única forma de
 * travar variância: asserção de tipo não roda em runtime.
 */
describe('o tipo AcaoSemArgumento recusa função que espera dado', () => {
  it('⛔ função com parâmetro NÃO compila como AcaoSemArgumento', () => {
    const comParametro = async (confirmouDia?: string) => { void confirmouDia }
    // @ts-expect-error — é exatamente o defeito de 16/10: o parâmetro espera dado e o botão não manda nada
    const errado: AcaoSemArgumento = comParametro
    expect(typeof errado).toBe('function')
  })

  it('⭐ função de ZERO argumento compila, e é chamável sem nada', () => {
    let chamou = false
    const certo: AcaoSemArgumento = () => { chamou = true }
    certo()
    expect(chamou).toBe(true)
  })
})

/** ⛔ o contrato não pode ser alargado de volta, e a tela não pode voltar à referência nua */
describe('a cura fica nos dois lugares', () => {
  const REVISAO = 'components/estoque/revisao-do-import.tsx'
  const VENDAS = 'app/(dashboard)/empresas/[id]/estoque/vendas/page.tsx'

  it('ConfirmarDelegado.acao usa AcaoSemArgumento, nunca `() => void`', () => {
    const src = semComentarios(readFileSync(REVISAO, 'utf8'))
    expect(src).toMatch(/acao:\s*AcaoSemArgumento/)
    expect(src).not.toMatch(/acao:\s*\(\s*\)\s*=>\s*void/)
    expect(usosDe(readFileSync(REVISAO, 'utf8'), 'AcaoSemArgumento')).toBeGreaterThan(0)
  })

  it('o botão da revisão chama a ação, nunca a entrega ao React', () => {
    const src = semComentarios(readFileSync(REVISAO, 'utf8'))
    expect(src).toMatch(/onClick=\{\(\)\s*=>\s*\(?confirmar\s*\?\s*confirmar\.acao\(\)/)
    expect(src).not.toMatch(/onClick=\{confirmar\s*\?\s*confirmar\.acao\s*:/)
  })

  it('a tela de vendas passa a ação com argumento explícito', () => {
    const src = semComentarios(readFileSync(VENDAS, 'utf8'))
    expect(src).toMatch(/acao:\s*\(\)\s*=>\s*abrirPreview\(\)/)
    expect(src).not.toMatch(/acao:\s*abrirPreview\s*,/)
  })

  /**
   * ⚠️⚠️ **SEM ISTO O SPRINT SERIA "GUARD QUE TESTA A LIB E APROVA A TELA QUE A IGNORA"** — a
   * cicatriz de 14/09 e de 16/09. Os testes do `fraseDoErro` provam a LIB; quem tem que provar
   * que a TELA a consome é esta asserção, porque repor `catch { setErroProc('Falha de
   * conexão…') }` passaria verde em todos os outros.
   */
  it('⛔ nenhum catch da tela crava a frase de conexão — todos passam pelo fraseDoErro', () => {
    const bruto = readFileSync(VENDAS, 'utf8')
    const src = semComentarios(bruto)
    // ⚠️ o token temperado `(?!fraseDoErro)` é o que separa a frase CRAVADA da frase que é
    // argumento legítimo do tradutor — sem ele o guard acusaria a própria cura (medido).
    const cravadas = [...src.matchAll(/catch(?:(?!fraseDoErro)[\s\S]){0,60}?['"`]Falha de conex[^'"`]*['"`]/g)].map((m) => m[0].replace(/\s+/g, ' '))
    expect(cravadas, cravadas.join('\n')).toEqual([])
    // ⛔ e a chamada tem que EXISTIR em cada catch: ausência de frase cravada também seria
    // verdade num catch vazio, que é silêncio — o defeito irmão.
    const catches = (src.match(/\}\s*catch\s*\(e\)\s*\{/g) ?? []).length
    expect(catches).toBeGreaterThanOrEqual(6)
    expect(usosDe(bruto, 'fraseDoErro')).toBeGreaterThanOrEqual(catches)
  })
})
