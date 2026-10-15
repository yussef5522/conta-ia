/**
 * ⛔⛔⛔ A MESA DA COZINHA ② NÃO INVENTA NÚMERO, NÃO ESCREVE E NÃO DIVERGE (15/10/2026)
 *
 * As quatro travas que o dono pediu de propósito, cada uma com o defeito que ela existe pra
 * impedir escrito ao lado:
 *
 *   1. **ZERO ESCRITA EM TUDO** — *"o dashboard só LÊ"*. A mesa ② mostra o dia da cozinha num
 *      olhar; se um caminho dela gravasse, abrir a tela mexeria no estoque.
 *   2. **O % E O R$ TÊM DONO ÚNICO** — `pctBR`/`pctInteiroBR` e `formatBRL`. A 4ª cópia de
 *      `(pct * 100)` nasceu AQUI e foi pega por este guard; a doença já tinha custado um
 *      **`47.7%` de PONTO** num ⓘ de dinheiro em 10/10.
 *   3. **A MESA ② NÃO DIVERGE DO «HOJE AO VIVO»** — uma leitura, um instante. Duas requisições
 *      trariam os dois números de instantes diferentes, e a mesa poderia dizer *"18
 *      concluídas"* com a lista mostrando 19.
 *   4. **O RADAR NÃO DIVERGE DOS JUÍZES** — o contador é DERIVADO das linhas, pela MESMA
 *      `placarDoRadar` da mesa ①; e cada linha nasce de uma PORTA que já existe, nunca de uma
 *      régua nova escrita no tradutor.
 *
 * ⚠️ ESTRUTURAL E ASSUMIDO COMO TAL: sem jsdom não dá pra renderizar. O que morde é provar a
 * FORMA — quem chama quem, e o que não pode aparecer no arquivo.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { semComentarios, usosDe } from './_leitura-de-fonte'

const raiz = process.cwd()
const R = (p: string) => join(raiz, p)
const ler = (p: string) => readFileSync(R(p), 'utf-8')

/** ⭐ A CADEIA INTEIRA da mesa ②, declarada — rota, orquestrador, tradutores, chassi e corpo. */
const ROTA = 'app/api/empresas/[id]/estoque/producao/mesa/route.ts'
const ORQUESTRADOR = 'lib/stock/producao/mesa-da-cozinha.ts'
const RADAR = 'lib/stock/producao/radar-da-cozinha.ts'
const FITA = 'lib/stock/producao/fita-da-cozinha.ts'
const CORPO = 'components/estoque/mesa-da-cozinha.tsx'
const CHASSI = 'components/mesa/chassi.tsx'
const TELA = 'app/(dashboard)/empresas/[id]/estoque/producao/hoje/page.tsx'

const CADEIA = [ROTA, ORQUESTRADOR, RADAR, FITA, CORPO, CHASSI]

describe('⭐⭐ a cadeia da mesa ② existe inteira', () => {
  it('os 6 arquivos declarados estão no repo — é isso que faz as travas abaixo valerem algo', () => {
    for (const p of CADEIA) {
      expect(existsSync(R(p)), `arquivo da cadeia não existe: ${p}`).toBe(true)
      expect(ler(p).length, p).toBeGreaterThan(300)
    }
  })
})

describe('⛔⛔⛔ 1. ZERO ESCRITA — o dashboard só LÊ', () => {
  it('⛔ a rota da mesa só tem GET — a ausência de POST/PATCH/DELETE é ESTRUTURAL', () => {
    /**
     * ⭐ Não é *"o POST não grava"*: é **não existir POST**. Verbo que existe é verbo que
     * alguém implementa depois; a trava que vale é a porta não estar na parede.
     */
    const verbos = [...ler(ROTA).matchAll(/export async function (GET|POST|PATCH|PUT|DELETE)/g)]
      .map((m) => m[1])
      .sort()
    expect(verbos, 'a mesa é leitura: um GET e mais nada').toEqual(['GET'])
  })

  it('⛔⛔ nenhum arquivo da cadeia escreve no banco', () => {
    const errados: string[] = []
    for (const p of CADEIA) {
      const src = semComentarios(ler(p))
      for (const m of src.matchAll(
        /\.(create|createMany|update|updateMany|upsert|delete|deleteMany|executeRaw|executeRawUnsafe)\(/g,
      )) {
        errados.push(`${p} → ${m[1]}`)
      }
    }
    expect(errados, 'abrir a mesa não pode mexer em estoque nem em dinheiro').toEqual([])
  })

  it('⚠️ e o `agora` entra UMA vez, pela rota — relógio no motor é decisão pelo relógio', () => {
    /**
     * ⚠️ A régua da casa desde 13/08: *o RELÓGIO só serve pra exibir "hoje" na TELA — nunca
     * entra em decisão*. Na mesa ② o instante é PARÂMETRO (a rota o carimba uma vez), então os
     * 7 portos recebem o MESMO instante e os números não podem vir de momentos diferentes.
     */
    for (const p of [ORQUESTRADOR, RADAR, FITA]) {
      const src = semComentarios(ler(p))
      expect(src, `${p} não pode ler o relógio — o instante vem por parâmetro`).not.toMatch(
        /new Date\(\s*\)|Date\.now\(\)/,
      )
    }
    expect(semComentarios(ler(ROTA)), 'a rota é quem carimba o instante').toMatch(/new Date\(\s*\)/)
  })
})

describe('⭐⭐ 2. O % E O R$ TÊM DONO ÚNICO', () => {
  it('⛔ nenhum R$ montado à mão — só `formatBRL`', () => {
    for (const p of [ORQUESTRADOR, CORPO, CHASSI, RADAR]) {
      const src = semComentarios(ler(p))
      expect(src, `${p} monta R$ na mão`).not.toMatch(/'R\$ '\s*\+|`R\$ \$\{(?!Math\.round)/)
    }
    expect(usosDe(semComentarios(ler(CORPO)), 'formatBRL'), 'o corpo da mesa precisa do dono do R$')
      .toBeGreaterThan(0)
  })

  it('⛔⛔ nenhum percentual de DADO formatado na mão — e a exceção do LAYOUT fica nomeada', () => {
    /**
     * ⚠️⚠️ **ESTE GUARD ACHOU A 4ª CÓPIA, nos dois lados:** o selo de RENDIMENTO fazia
     * `${Math.round(p.rendimentoPeriodo * 100)}%` no corpo da mesa e o radar fazia
     * `${n1(pior.pct * 100)}%` no tradutor. Os dois passaram pro dono único.
     *
     * ⛔ **A EXCEÇÃO É A ALTURA DA BARRA** da semana (`height: ${...* 100}%`): aquele é
     * percentual de **LAYOUT**, lido pelo browser, não um número que o dono lê. `pctInteiroBR`
     * ali produziria `48%` com vírgula em CSS — e barra sem altura se lê como *"não produziu"*,
     * que é a mentira que a régua de altura mínima existe pra impedir.
     */
    const errados: string[] = []
    for (const p of [ORQUESTRADOR, RADAR, FITA, CORPO, CHASSI]) {
      const linhas = semComentarios(ler(p)).split('\n')
      linhas.forEach((l, i) => {
        if (!/\*\s*100/.test(l)) return
        if (/height|width|translate|proporcao \* 100/.test(l)) return // ⭐ layout, não dado
        errados.push(`${p}:${i + 1} ${l.trim().slice(0, 80)}`)
      })
    }
    expect(errados, 'percentual de dado vem de pctBR/pctInteiroBR').toEqual([])
    expect(
      usosDe(semComentarios(ler(CORPO)), 'pctInteiroBR'),
      'o selo de rendimento precisa do dono do %',
    ).toBeGreaterThan(0)
    expect(usosDe(semComentarios(ler(RADAR)), 'pctBR'), 'o radar precisa do dono do %')
      .toBeGreaterThan(0)
  })

  it('⛔ "a apurar" NUNCA vira 0% — zero é uma afirmação', () => {
    const src = semComentarios(ler(CORPO))
    expect(src, 'rendimento sem régua tem que dizer "a apurar"').toContain('a apurar')
    expect(src, 'o selo só mostra % quando há número').toMatch(
      /rendimentoPeriodo == null \? 'a apurar'/,
    )
  })
})

describe('⭐⭐⭐ 3. A MESA ② NÃO DIVERGE DO «HOJE AO VIVO»', () => {
  it('⛔⛔ a tela faz UMA leitura: o dia ao vivo vem NO MESMO payload da mesa', () => {
    /**
     * ⛔ Duas requisições (uma pra mesa, outra pro dia) trariam números de INSTANTES
     * diferentes — e aí a mesa diria *"18 concluídas"* com a lista mostrando 19. Duas verdades
     * na mesma tela é a doença que esta casa mais paga.
     */
    const tela = semComentarios(ler(TELA))
    expect(tela, 'a tela tem que buscar a rota da mesa').toContain('producao/mesa?dia=')
    expect(tela, 'o fetch antigo do dia ao vivo não pode conviver com o da mesa').not.toContain(
      'producao/dia-ao-vivo',
    )
    const fetches = [...tela.matchAll(/fetch\(/g)].length
    expect(fetches, 'a tela do HOJE busca a mesa e a equipe — nada de uma 3ª leitura do dia')
      .toBeLessThanOrEqual(2)
  })

  it('⭐ e o orquestrador DEVOLVE o dia ao vivo — não é a tela que o remonta', () => {
    const orq = semComentarios(ler(ORQUESTRADOR))
    expect(usosDe(orq, 'diaAoVivo'), 'o dia ao vivo tem que viajar no payload da mesa')
      .toBeGreaterThan(0)
    const tela = semComentarios(ler(TELA))
    expect(tela, 'a lista do dia lê o que a mesa trouxe').toContain('mesa.diaAoVivo')
  })

  it('⛔ a lista do dia CONTINUA na tela — a mesa é o topo, não a substituta', () => {
    const tela = semComentarios(ler(TELA))
    for (const peca of ['Agora</h2>', 'linhaDoTempo', 'PlacarDaEquipe']) {
      expect(tela, `a mesa ② não pode ter levado "${peca}" embora`).toContain(peca)
    }
  })
})

describe('⭐⭐ 4. O RADAR NÃO DIVERGE DOS JUÍZES', () => {
  it('⛔⛔ o contador é DERIVADO das linhas, pela MESMA função da mesa ①', () => {
    /**
     * ⭐ `placarDoRadar` conta as linhas que o radar devolveu. Um contador próprio aqui
     * divergiria do que a tela desenha no primeiro degrau novo — e o dono veria *"2 pedem
     * hoje"* com 3 linhas corais na cara dele.
     */
    /**
     * ⚠️⚠️ **E ESTE GUARD VEIO VERDE NA 1ª VERSÃO** — ele proibia `coral: <dígito>`, e a
     * reposição real (`const coral: number = 0`) **não casa com essa forma**. ***Guard que
     * proíbe uma forma aprova a próxima*** (a lição de 11/10, no mesmo mês).
     *
     * ⭐ O que morde é ESTRUTURAL e independe de como o identificador é escrito: **contar
     * gravidade aqui é proibido** (é o que `placarDoRadar` faz, lendo as linhas que este
     * tradutor devolveu) e o **dono tem que estar reexportado**, senão a tela acharia um
     * segundo lugar de onde tirar o número.
     */
    const radar = semComentarios(ler(RADAR))
    expect(radar, 'o radar da cozinha reusa o placar da mesa ①').toContain(
      "from '@/lib/balance/radar-da-mesa'",
    )
    expect(usosDe(radar, 'placarDoRadar'), 'o dono do contador tem que ser consumido daqui')
      .toBeGreaterThan(0)
    for (const forma of [/\.filter\([^)]*gravidade/, /\.reduce\(/, /gravidade === '(CORAL|AMBAR|VERDE)'/]) {
      expect(radar, `contar gravidade aqui é a segunda régua do placar: ${forma}`).not.toMatch(forma)
    }
  })

  it('⛔ o tradutor do radar é PURO — ele traduz portas, não consulta banco', () => {
    const radar = semComentarios(ler(RADAR))
    for (const proibido of ['prisma', 'findMany', 'aggregate', 'groupBy']) {
      expect(radar, `o radar não pode consultar o banco (${proibido})`).not.toContain(proibido)
    }
  })

  it('⭐ toda linha do radar tem GRAVIDADE e PORTA — alarme sem caminho é só aviso', () => {
    const radar = semComentarios(ler(RADAR))
    const ids = [...radar.matchAll(/id: '(coz-[a-z-]+)'/g)].map((m) => m[1])
    expect(ids.length, 'o radar da cozinha tem as 5 linhas declaradas').toBe(5)
    expect(new Set(ids).size, 'id repetido faz duas linhas disputarem a mesma chave').toBe(
      ids.length,
    )
    const gravidades = [...radar.matchAll(/gravidade: /g)].length
    const hrefs = [...radar.matchAll(/href: /g)].length
    expect(gravidades, 'cada linha diz a própria gravidade').toBe(ids.length)
    expect(hrefs, 'cada linha carrega o caminho que resolve').toBe(ids.length)
  })
})
