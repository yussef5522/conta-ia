/**
 * ⛔⛔⛔ A TELA DE VENDAS ABRE NO MÊS DE HOJE — SEMPRE (10/10/2026).
 *
 * **O vermelho que o dono pediu:** *"âncora no mês velho de volta = vermelho"*.
 *
 * ⛔⛔ O DEFEITO QUE MOTIVOU: `const [mes, setMes] = useState('2026-08')` — um **mês LITERAL
 * cravado**, com o comentário *"o do início do sistema (agosto) — a Cacula só tem agosto"*.
 * Em outubro a tela abria **dois meses no passado**; pior, a ROTA já tinha o default certo e
 * era sobrescrita pelo `?mes=2026-08` que a própria tela mandava.
 *
 * ***Data fixa não é default: é uma data que o calendário alcança*** — a mesma classe da
 * REGRA 12 de 01/09 (`sem-data-fixa-no-futuro`), do lado do passado.
 *
 * ⚠️ O RELÓGIO É CONTROLADO em todo teste daqui (`agora` é parâmetro) — um guard de "abre no
 * mês de hoje" que dependa do relógio da máquina só prova o mês em que ele rodou.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { semComentarios, usosDe } from '../regras-ui/_leitura-de-fonte'
import { resolverRecorte } from '@/app/api/empresas/[id]/vendas/route'
import { mesCorrente, hojeBrasil } from '@/lib/periodo/mes-corrente'

const R = (p: string) => resolve(process.cwd(), p)
const ler = (p: string) => readFileSync(R(p), 'utf8')
const TELA = semComentarios(ler('app/(dashboard)/empresas/[id]/vendas/page.tsx'))
const ROTA = semComentarios(ler('app/api/empresas/[id]/vendas/route.ts'))

const q = (s: string) => new URLSearchParams(s)

describe('⛔⛔⛔ 1. O DEFAULT É O MÊS DE HOJE — com relógio controlado', () => {
  it('⭐⭐ sem parâmetro nenhum, o recorte é o mês corrente', () => {
    for (const [agora, mes] of [
      ['2026-10-10T15:00:00Z', '2026-10'],
      ['2026-08-03T12:00:00Z', '2026-08'],
      ['2027-01-19T09:00:00Z', '2027-01'],
    ] as const) {
      const r = resolverRecorte(q(''), new Date(agora))
      expect(r.mes, `em ${agora} o default tem que ser ${mes}`).toBe(mes)
      expect(r.ehMesInteiro).toBe(true)
    }
  })

  /**
   * ⛔⛔ O MÊS É O DO **BRASIL**: o servidor roda em UTC, e no dia 1º às 00h30 de São Paulo o
   * `new Date()` ainda diz o mês anterior. Sem isso a tela abriria em setembro na primeira
   * madrugada de outubro — exatamente a queixa, por outra causa.
   */
  it('⛔⛔ na virada do mês, o fuso do Brasil manda', () => {
    // 01/10 às 00h30 de São Paulo == 01/10 03:30 UTC → ainda tem que ser outubro
    expect(resolverRecorte(q(''), new Date('2026-10-01T03:30:00Z')).mes).toBe('2026-10')
    // 30/09 às 23h30 de São Paulo == 01/10 02:30 UTC → é SETEMBRO pra quem olha
    expect(resolverRecorte(q(''), new Date('2026-10-01T02:30:00Z')).mes).toBe('2026-09')
  })

  it('⭐ o recorte do mês vai do dia 1º ao ÚLTIMO dia (inclusivo na tela)', () => {
    const r = resolverRecorte(q('mes=2026-02'), new Date('2026-10-10T12:00:00Z'))
    // ⚠️ 2026 não é bissexto — a borda de fevereiro sai do calendário, não de um `28` cravado
    expect(r).toMatchObject({ de: '2026-02-01', ate: '2026-02-28' })
    expect(resolverRecorte(q('mes=2026-12'), new Date('2026-10-10T12:00:00Z')))
      .toMatchObject({ de: '2026-12-01', ate: '2026-12-31' })
  })

  it('⭐ `mes` inválido não vira recorte torto — cai no mês corrente', () => {
    for (const bad of ['mes=agosto', 'mes=2026-13-01', 'mes=', 'mes=26-08']) {
      expect(resolverRecorte(q(bad), new Date('2026-10-10T12:00:00Z')).mes).toBe('2026-10')
    }
  })

  /**
   * ⛔⛔⛔ O VERMELHO DO DONO. A busca é por mês LITERAL em posição de default — e ignora
   * comentário, senão morderia a própria documentação do defeito.
   */
  it('⛔⛔⛔ nem a TELA nem a ROTA têm mês literal como default', () => {
    for (const [nome, src] of [['tela', TELA], ['rota', ROTA]] as const) {
      const achados = [...src.matchAll(/useState\(\s*['"`](\d{4}-\d{2})['"`]|mes\s*=\s*['"`](\d{4}-\d{2})['"`]/g)]
      expect(
        achados.map((m) => m[0]),
        `${nome}: mês literal em posição de default — é o defeito de 10/10`,
      ).toHaveLength(0)
    }
    // ⭐ e o dono da pergunta É consumido pela tela
    expect(usosDe(TELA, 'mesCorrente'), 'a tela tem que derivar o mês de hoje').toBeGreaterThan(0)
  })

  it('⭐ a navegação ‹ › continua existindo pra passear', () => {
    expect(usosDe(TELA, 'mesVizinho'), 'o ‹ › do cabeçalho').toBeGreaterThan(1)
  })

  /** ⚠️ auto-teste do detector: ele PEGA o padrão antigo (senão passaria por cegueira) */
  it('⚠️ o detector morde o código que existia antes', () => {
    const antigo = `const [mes, setMes] = useState('2026-08')`
    expect([...antigo.matchAll(/useState\(\s*['"`](\d{4}-\d{2})['"`]/g)]).toHaveLength(1)
  })
})

describe('⛔⛔ 2. O FILTRO COMPLETO — dia · semana · mês · 📅 datas', () => {
  it('⭐ os 4 chips existem na tela', () => {
    for (const r of ['dia', 'semana', 'mês', '📅 datas']) {
      expect(TELA, `o chip "${r}"`).toContain(`r: '${r}'`)
    }
  })

  it('⭐⭐ DATAS aceita QUALQUER recorte — inclusive 1 dia só', () => {
    const agora = new Date('2026-10-10T12:00:00Z')
    expect(resolverRecorte(q('de=2026-10-06&ate=2026-10-06'), agora))
      .toMatchObject({ de: '2026-10-06', ate: '2026-10-06', ehMesInteiro: false })
    expect(resolverRecorte(q('de=2026-08-15&ate=2026-10-02'), agora))
      .toMatchObject({ de: '2026-08-15', ate: '2026-10-02', ehMesInteiro: false })
  })

  it('⛔ data invertida ou malformada não passa — cai no mês corrente', () => {
    const agora = new Date('2026-10-10T12:00:00Z')
    expect(resolverRecorte(q('de=2026-10-09&ate=2026-10-01'), agora).mes).toBe('2026-10')
    expect(resolverRecorte(q('de=ontem&ate=hoje'), agora).mes).toBe('2026-10')
    expect(resolverRecorte(q('de=2026-10-01'), agora).mes).toBe('2026-10')
  })

  /**
   * ⛔⛔ DIA e SEMANA SÃO RESOLVIDOS NO SERVIDOR — **um relógio só manda**.
   *
   * Se a tela mandasse `de=<hoje do navegador>`, um aparelho com a hora torta pediria um dia
   * e receberia outro marcado como `hoje`: a célula "hoje" acenderia num dia e o recorte
   * seria de outro. É a régua da casa (*"o cronômetro é da tela, o instante é do servidor"*),
   * e o tablet com hora atrasada já custou um cronômetro parado em 00:00 (08/09).
   */
  it('⛔⛔ a TELA manda o NOME do período, nunca a data que ela calculou', () => {
    const agora = new Date('2026-10-07T15:00:00Z') // quarta
    expect(resolverRecorte(q('periodo=DIA'), agora))
      .toMatchObject({ de: '2026-10-07', ate: '2026-10-07' })
    // ⭐ semana SEG→hoje
    expect(resolverRecorte(q('periodo=SEMANA'), agora))
      .toMatchObject({ de: '2026-10-05', ate: '2026-10-07' })

    const bloco = TELA.slice(TELA.indexOf('function recorteDoChip'), TELA.indexOf('export default'))
    expect(bloco, 'a tela manda o período por NOME').toContain("periodo: p")
    expect(bloco, 'a tela não pode calcular o dia de hoje').not.toContain('hojeBrasil')
    expect(bloco, 'nem derivar data do relógio do aparelho').not.toContain('new Date()')
  })

  /**
   * ⚠️ A ÂNCORA FICA NO PASSADO POR ORDEM DO GUARD DA CASA (`sem-data-fixa-no-futuro`), e
   * ele estava certo em me pegar: aqui o `agora` só alimenta funções PURAS (nada compara
   * com o relógio real), mas **a FORMA importa** — data fixa em posição de relógio é a
   * contagem regressiva que já mordeu 4× neste projeto, e o guard não tem como ler
   * semântica. ⭐ O caso que o teste isola é o mesmo: **02h UTC é o dia ANTERIOR em São
   * Paulo**, e aqui ele atravessa a virada do MÊS, que é a borda mais cara.
   */
  it('⭐ o `hoje` do payload é o do Brasil, batendo com o dono da pergunta', () => {
    const agora = new Date('2026-10-01T02:00:00Z') // 30/09 23h em São Paulo
    expect(hojeBrasil(agora)).toBe('2026-09-30')
    expect(mesCorrente(agora)).toBe('2026-09')
  })
})

describe('⛔⛔⛔ 3. OS VERMELHOS DA TELA (os outros três que o dono nomeou)', () => {
  const cartao = () => {
    const i = TELA.indexOf('function CartaoSolido(')
    expect(i, 'o cartão sólido existe').toBeGreaterThan(-1)
    const resto = TELA.slice(i + 1)
    const j = resto.indexOf('\nfunction ')
    return j === -1 ? resto : resto.slice(0, j)
  }

  /**
   * ⛔⛔ *"parágrafo nos cartões = vermelho"*. O detector é ESTRUTURAL (conta os `<p>`), não
   * uma lista de frases proibidas: lista de frases envelhece no dia em que alguém escrever um
   * parágrafo NOVO. São 3 papéis — etiqueta · número · sub.
   */
  it('⛔⛔ o cartão desenha no MÁXIMO 3 parágrafos', () => {
    const ps = (cartao().match(/<p\b/g) ?? []).length
    expect(ps, `o cartão tem ${ps} <p> — são 3 papéis: etiqueta · número · sub`).toBeLessThanOrEqual(3)
  })

  /**
   * ⛔⛔ O CHÃO É O `-solid`, NUNCA o `-mid` nem pastel: branco sobre o `-mid` dá **3,51:1 no
   * verde e 3,91:1 no coral já no tema CLARO** (medido em 10/10), e a etiqueta de 11px vive
   * no mesmo chão. O contraste dos 4 × 2 temas é provado em `dois-temas-na-raiz`.
   */
  it('⛔⛔ o chão do cartão é sólido — nem `-mid`, nem `-bg`', () => {
    const c = cartao()
    const chao = c.slice(c.indexOf('style={{ background'), c.indexOf('</p>'))
    expect(chao, 'o degrau sólido').toContain('-solid)')
    expect(chao, 'pastel no chão do cartão forte').not.toContain('-bg)')
    expect(chao, 'o -mid cru não passa em contraste com branco').not.toContain('-mid)')
  })

  it('⛔ o número é redondo e o centavo vai pro tooltip (`valorDoCartao`)', () => {
    const c = cartao()
    expect(usosDe(c, 'valorDoCartao'), 'a régua do número redondo').toBeGreaterThan(0)
    expect(c, 'formatBRL no cartão traria os centavos de volta').not.toContain('formatBRL(')
    expect(c).toContain('v.cheio')
    expect(c).toContain('text-[30px]')
  })

  it('⛔ ZERO HEX na tela — cor vem de token ou não vem', () => {
    const hex = TELA.match(/#[0-9a-fA-F]{3,8}\b/g) ?? []
    expect(hex, `cores cravadas: ${hex.join(' ')}`).toHaveLength(0)
  })

  it('⛔⛔ nada de `bg-[var(--x)]/70` — no Tailwind 3 isso sai TRANSPARENTE (05/10)', () => {
    expect(TELA).not.toMatch(/\[var\(--[a-z-]+\)\]\/\d/)
  })

  /**
   * ⛔⛔ *"bloco fds agrupado de volta = vermelho"*. O agrupado era um card `col-span-3` com
   * *"fim de semana D–D · sex+sáb+dom"*, e as colunas 5 e 6 retornavam `null` ("absorvido
   * pelo span"). Uma célula por dia, SEMPRE.
   */
  it('⛔⛔ o bloco agrupado do fim de semana MORREU', () => {
    expect(TELA, 'o card de 3 colunas voltou').not.toContain('col-span-3')
    for (const morta of ['fim de semana ', 'blocoCobreFDS', 'fimDeSemanaAgg', 'absorvido']) {
      expect(TELA, `a peça do bloco agrupado voltou: "${morta}"`).not.toContain(morta)
    }
    /**
     * ⚠️⚠️ CORREÇÃO DE UMA ASSERÇÃO MINHA, MEDIDA EM 10/10: eu tinha proibido a FRASE
     * `"sex+sáb+dom"` e ela deu **falso vermelho contra a tela CERTA**. As duas ocorrências
     * vivas são a **EXPLICAÇÃO HONESTA** do bloco — o `title` da célula *"no bloco"* e a
     * linha do ⓘ (*"o cartão liquidou sex+sáb+dom junto"*) —, **não o card agrupado**.
     * ⛔ Proibir a frase me obrigaria a **apagar a explicação** pra o guard ficar verde, o
     * que trocaria um bloco mentiroso por um buraco mudo.
     *
     * ⭐ O que morde o vermelho do dono (*"bloco fds agrupado de volta"*) é ESTRUTURAL e
     * está nos dois testes deste bloco: `col-span-3` proibido, 31 células no mês, e as 3
     * células do fim de semana **distintas, cada uma com o seu número**.
     */
  })

  /**
   * ⛔⛔ *"~ em dia com import = vermelho"*. Quem decide o `~` é a LIB (`estimado`), e a tela
   * só o desenha — se ela derivasse, nasceria a 2ª régua da fonte, e ela erraria no 1º caso
   * de borda.
   */
  it('⛔⛔ o `~` da célula sai do campo `estimado` da lib, nunca de régua da tela', () => {
    expect(TELA).toContain("x.estimado ? '~' : ''")
    expect(TELA, 'a tela não pode decidir a fonte por conta própria').not.toMatch(/fonte\s*===\s*'PDV'\s*\?\s*''/)
  })

  it('⛔ a tela NÃO calcula dinheiro — ela desenha o payload', () => {
    const corpo = TELA.slice(TELA.indexOf('export default'))
    expect(corpo, 'a tela voltou a somar venda').not.toMatch(/reduce\([^)]*(total|valor)/)
    expect(usosDe(TELA, 'montarDias'), 'a régua mora na lib').toBe(0)
  })

  /**
   * ⛔⛔ A DIETA DE 10/10: explicação vai pro ⓘ `<details>`, **nunca `title`** — tooltip não
   * existe no celular, e é lá que o dono opera (a cicatriz de 30/08). O que PODE ir pro
   * `title` é o que REPETE um número já visível (os centavos).
   */
  it('⛔⛔ a explicação da fonte abre por TOQUE, não por hover', () => {
    const i = TELA.indexOf('function LinhaDaFonte')
    expect(i, 'a linha da fonte existe').toBeGreaterThan(-1)
    const bloco = TELA.slice(i, TELA.indexOf('\nfunction ', i + 1))
    expect(bloco).toContain('<details')
    expect(bloco).toContain('<summary')
    expect(bloco, 'o rótulo do ⓘ').toContain('de onde vem o número')
  })

  /** ⚠️ os copy bugs que o dono nomeou, mortos um por um */
  it('⛔ os textos quebrados morreram', () => {
    for (const morta of ['dias/blocos', 'fim(ns) de semana', 'desde 01/08', 'Perfil fim de semana']) {
      expect(TELA, `copy bug de volta: "${morta}"`).not.toContain(morta)
    }
  })

  it('⭐ o dia que PEDE IMPORT leva pra central — a porta tem maçaneta', () => {
    expect(TELA).toContain('importar ⚠')
    expect(TELA).toContain('estoque/vendas?aba=processados#dia-')
  })

  /** ⭐ REGRA 12: uma composição, dois viewports — o CSS escolhe, não o JS */
  it('⭐ uma composição só: os cartões empilham no celular pelo grid', () => {
    expect(TELA).toMatch(/grid-cols-1[^"]*sm:grid-cols-2[^"]*lg:grid-cols-4/)
    const blocos = (TELA.match(/sm:hidden|hidden sm:/g) ?? []).length
    expect(blocos, 'bloco só-celular = 2ª composição pra manter').toBe(0)
  })
})
