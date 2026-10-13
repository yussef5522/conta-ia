/**
 * ⛔⛔⛔ O GUARD DO DONO (13/10/2026): *"conta de veredito duplicada em tela = vermelho"*.
 *
 * Farol, charme, gross-up, teto e alvo moram em `lib/margem/veredito-de-preco.ts` — e é só
 * de lá que a tela pode ler. Este guard existe porque o risco aqui é maior que o de costume:
 * **o montador de pizza e o cartão "escolha um produto" ficam LADO A LADO, na mesma dobra**.
 * Duas contas divergindo a dez centímetros uma da outra é a doença do B1 com as duas
 * respostas visíveis ao mesmo tempo.
 *
 * ⚠️ **Estrutural e assumido como tal:** o projeto roda em `environment: node`, sem jsdom —
 * não dá pra renderizar e conferir o número na tela. O que dá pra travar é a PROCEDÊNCIA:
 * quem desenha o veredito tem que ter recebido o veredito de quem decide.
 *
 * ⚠️ E ele lê a fonte **SEM COMENTÁRIO** — senão morderia a própria documentação dos defeitos
 * (*"o arquivo que documenta o defeito não pode ser o que o absolve"*, 21/09).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { semComentarios, usosDe } from './_leitura-de-fonte'

const RAIZ = process.cwd()
const PORTA = 'lib/margem/veredito-de-preco.ts'
const TELA = 'app/(dashboard)/empresas/[id]/margem/page.tsx'

const fonte = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8')
const limpa = (rel: string) => semComentarios(fonte(rel))

/** ⭐ os arquivos que PODEM falar de veredito: a porta e quem a consome por delegação */
const DONOS_LEGITIMOS = new Set([
  PORTA,
  'lib/margem/produto-do-veredito.ts', // consome `reguaDaSecao`, não recalcula nada
])

function varrer(dir: string, acc: string[] = []): string[] {
  for (const n of readdirSync(join(RAIZ, dir))) {
    if (n === 'node_modules' || n === '.next' || n.startsWith('.')) continue
    const rel = `${dir}/${n}`
    if (statSync(join(RAIZ, rel)).isDirectory()) varrer(rel, acc)
    else if (/\.(ts|tsx)$/.test(n) && !rel.includes('__tests__')) acc.push(rel)
  }
  return acc
}

describe('⛔ A TELA NÃO CALCULA VEREDITO — ela ECOA', () => {
  /**
   * ⚠️⚠️ A 1ª VERSÃO DESTE TESTE VEIO VERDE COM O DEFEITO REPOSTO — e o furo é o mais
   * instrutivo do sprint. Eu procurava `custo\w* / preco\w*` (ADJACENTE), e `custoTotal` e
   * `precoVenda` são **nullable**: quem escrevesse a conta à mão escreveria exatamente
   * `(pizza?.custoTotal ?? 0) / (pizza?.precoVenda ?? 1)` — com o `??` no meio, o regex não
   * casa. ***O guard nascia cego justamente na forma que o código real teria.***
   *
   * ⭐ O que morde é a FORMA: uma divisão cujo lado de cima fala de custo e o de baixo fala de
   * preço, com qualquer coisa entre eles.
   */
  function divisoesDeCmv(src: string): string[] {
    const achadas: string[] = []
    for (const linha of src.split('\n')) {
      const i = linha.indexOf('/')
      if (i < 0) continue
      const antes = linha.slice(0, i)
      const depois = linha.slice(i + 1)
      // ⛔ `//` é comentário e `/>` é JSX — nem um nem outro é divisão
      if (depois.startsWith('/') || depois.startsWith('>')) continue
      if (/custo/i.test(antes) && /preco/i.test(depois)) achadas.push(linha.trim())
    }
    return achadas
  }

  it('⛔ VERMELHO DO DONO: a tela não divide custo por preço (CMV é da porta)', () => {
    const achadas = divisoesDeCmv(limpa(TELA))
    expect(
      achadas,
      `o CMV tem um dono só — recalcular aqui é a 2ª régua do mesmo número: ${achadas.join(' | ')}`,
    ).toEqual([])
  })

  it('⭐ AUTO-TESTE do detector de CMV — ele pega a forma NULLABLE, que é a real', () => {
    expect(divisoesDeCmv('const cmv = (pizza?.custoTotal ?? 0) / (pizza?.precoVenda ?? 1)')).toHaveLength(1)
    expect(divisoesDeCmv('const cmv = custoTotal / precoVenda')).toHaveLength(1)
    expect(divisoesDeCmv('const x = p.custo! / preco')).toHaveLength(1)
    // ⚠️ e NÃO morde o legítimo: comentário, JSX e divisão que não é CMV
    expect(divisoesDeCmv('// custo / preco é da porta')).toHaveLength(0)
    expect(divisoesDeCmv('<PilulaDoFarol farol={x.custo} />')).toHaveLength(0)
    expect(divisoesDeCmv('const barra = valor / topo')).toHaveLength(0)
  })

  it('⛔ VERMELHO DO DONO: a tela não faz GROSS-UP (nenhum `/ (1 - taxa)`)', () => {
    const t = limpa(TELA)
    expect(t, 'gross-up na tela é o preço do iFood nascendo de duas contas').not.toMatch(
      /\/\s*\(\s*1\s*-\s*/,
    )
  })

  it('⛔ VERMELHO DO DONO: a tela não aplica CHARME (nenhum `+ 0.9` / `+ 1.9`)', () => {
    const t = limpa(TELA)
    expect(t, 'o ,90 tem dono — na tela ele divergiria do que o teste trava').not.toMatch(
      /\+\s*0\.9\b|\+\s*1\.9\b/,
    )
    expect(t).not.toMatch(/Math\.floor\s*\([^)]*\)\s*\+\s*0?\.9/)
  })

  it('⛔ a tela não DIGITA teto nem alvo — eles vêm do mapa', () => {
    const t = limpa(TELA)
    // os números do dono (33/35/40/45) não podem aparecer como limiar na tela
    expect(t, 'número solto em tela é a 2ª régua no dia em que o teto mudar').not.toMatch(
      /(teto|alvo)\w*\s*[=:]\s*(28|30|33|35|40|45)\b/i,
    )
  })

  it('⭐ e ela CONSOME a porta — guard que só proíbe aprovaria a tela que não mostra nada', () => {
    // ⚠️⚠️ A 1ª VERSÃO DESTE TESTE PASSOU COM A TELA SEM CONSUMIR NADA: eu somava
    // `usosDe(t,'veredito')`, e `SeloDoVeredito` (da liga, outra coisa) casava. *"Menção, não
    // uso"* pela 14ª vez nesta casa — e cometida dentro do guard que existe pra isso.
    // O que morde é o nome EXATO do que a porta assina.
    const t = fonte(TELA)
    expect(
      usosDe(t, 'blocoDoVeredito'),
      'a tela tem que DESENHAR o bloco que a porta assinou',
    ).toBeGreaterThan(0)
    expect(t, 'e o farol tem que chegar pronto, não ser derivado aqui').toMatch(
      /blocoDoVeredito[\w.]*\.farol|\.farol\.(tom|rotulo)/,
    )
  })
})

describe('⛔⛔ NENHUMA SEGUNDA IMPLEMENTAÇÃO NO PROJETO', () => {
  const arquivos = [...varrer('lib'), ...varrer('app')]

  it('⛔ só a porta define o CHARME', () => {
    const fora = arquivos.filter(
      (f) => !DONOS_LEGITIMOS.has(f) && /function\s+charme|const\s+charme\s*=/.test(limpa(f)),
    )
    expect(fora, `o charme nasceu de novo em: ${fora.join(', ')}`).toEqual([])
  })

  it('⛔ só a porta define o FAROL do CMV', () => {
    const fora = arquivos.filter(
      (f) =>
        !DONOS_LEGITIMOS.has(f) &&
        /function\s+farol\w*|const\s+farol\w*\s*=\s*\(/.test(limpa(f)),
    )
    expect(fora, `o farol nasceu de novo em: ${fora.join(', ')}`).toEqual([])
  })

  it('⛔ só a porta tem o mapa de teto por categoria', () => {
    const fora = arquivos.filter(
      (f) => !DONOS_LEGITIMOS.has(f) && /REGUA_POR_SECAO\s*[:=]/.test(limpa(f)),
    )
    expect(fora, `um 2º mapa de teto nasceu em: ${fora.join(', ')}`).toEqual([])
  })

  it('⭐ AUTO-TESTE DO DETECTOR — ele pega a forma do defeito', () => {
    const defeito = `
      const charme = (v: number) => Math.floor(v) + 0.9
      function farolLocal(c: number, p: number) { return c / p }
      const teto = 33
    `
    expect(/const\s+charme\s*=/.test(defeito)).toBe(true)
    expect(/function\s+farol\w*/.test(defeito)).toBe(true)
    expect(/custo\w*\s*\/\s*preco\w*/i.test('const cmv = custoTotal / precoVenda')).toBe(true)
    expect(/\/\s*\(\s*1\s*-\s*/.test('const p = (c + s) / (1 - taxa)')).toBe(true)
    // ⚠️ e NÃO morde a forma legítima (delegação)
    expect(/const\s+charme\s*=/.test('const { charme } = veredito')).toBe(false)
  })

  it('⚠️ a exceção da lista é NOMEADA e delega de verdade', () => {
    const p = fonte('lib/margem/produto-do-veredito.ts')
    expect(usosDe(p, 'reguaDaSecao'), 'ela consome o mapa, não escreve um').toBeGreaterThan(0)
    expect(limpa('lib/margem/produto-do-veredito.ts')).not.toMatch(/REGUA_POR_SECAO\s*[:=]/)
  })
})

describe('⭐ A TAXA DO iFOOD VEM DA PORTA DE CANAIS — zero 0.20 novo', () => {
  it('⛔ a porta do veredito não crava taxa nenhuma', () => {
    const l = limpa(PORTA)
    expect(l, 'a taxa é config do dono, com rastro — cravar 0.20 aqui é a 2ª fonte').not.toMatch(
      /TAXA_IFOOD|0\.2\b|taxaPct\s*=\s*0\.2/,
    )
  })

  it('⛔ a tela não crava a taxa', () => {
    expect(limpa(TELA)).not.toMatch(/TAXA_IFOOD|=\s*0\.20?\s*[;,)]/)
  })

  it('⭐ e a taxa entra por PARÂMETRO — é o que faz a config do dono valer', () => {
    const l = fonte(PORTA)
    expect(l).toMatch(/taxaPct:\s*number\s*\|\s*null/)
  })
})
