/**
 * ⭐⭐ OS GUARDS DE TELA DA MARGEM v3 (07/10/2026).
 *
 * ⚠️ **Estrutural e assumido como tal**: o projeto roda em `environment: node`, sem jsdom —
 * não dá pra clicar nem medir pixel aqui. O que estes testes travam é a FORMA que já mordeu
 * nesta casa: hex cravado, opacidade sobre token, duas composições por viewport, e a tela
 * voltando a calcular dinheiro por conta própria.
 *
 * ⚠️ E a tela é lida **SEM COMENTÁRIO** — ela documenta no próprio texto os defeitos que
 * matou, e *"o arquivo que documenta o defeito não pode ser o que o absolve"* (a 11ª "menção,
 * não uso", 21/09).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { semComentarios, usosDe } from './_leitura-de-fonte'

const R = (p: string) => resolve(process.cwd(), p)
const TELA = R('app/(dashboard)/empresas/[id]/margem/page.tsx')
const ROTA = R('app/api/empresas/[id]/margem/route.ts')
const SIDEBAR = R('components/sidebar/global-sidebar.tsx')
const CASA = R('lib/margem/casa.ts')
const LEITURA = R('lib/margem/leitura.ts')

const ler = (p: string) => readFileSync(p, 'utf8')
const tela = semComentarios(ler(TELA))

/**
 * ⭐ fatia o bloco de UM componente da tela — a asserção morde onde a régua vive, em vez de
 * no arquivo inteiro. ⛔ Janela de distância já produziu falso vermelho E falso verde nesta
 * casa (o rastro em 12/09, o menu do PF em 13/09): o que delimita é a função SEGUINTE.
 */
function blocoDa(nome: string): string {
  const i = tela.indexOf(`function ${nome}(`)
  expect(i, `componente ${nome} não existe na tela`).toBeGreaterThan(-1)
  const resto = tela.slice(i + 1)
  const j = resto.indexOf('\nfunction ')
  return j === -1 ? resto : resto.slice(0, j)
}

describe('⛔⛔ ZERO HEX CRAVADO — a tela pinta por TOKEN, nos dois temas', () => {
  it('⛔ nenhuma cor literal no arquivo da tela', () => {
    // ⚠️ `#` de âncora/hash não conta — o que morde é cor hexadecimal de 3 ou 6 dígitos
    const hex = tela.match(/#[0-9a-fA-F]{3,8}\b/g) ?? []
    expect(hex, `cores cravadas: ${hex.join(' ')}`).toHaveLength(0)
  })

  it('⛔⛔ nada de `bg-[var(--x)]/70` — no Tailwind 3 isso sai TRANSPARENTE (05/10)', () => {
    expect(tela).not.toMatch(/\[var\(--[a-z-]+\)\]\/\d/)
  })

  it('⭐ os tokens que a tela usa existem nos DOIS mapas do CSS', () => {
    const css = ler(R('app/globals.css'))
    /**
     * ⭐ Os dois mapas da casa são `:root` (claro) e `.dark` (escuro) — e a régua é a CONTAGEM
     * de declarações, não um fatiamento do arquivo: o `globals.css` tem **dois** blocos
     * `.dark` e vários `:root`, então cortar no primeiro `.dark {` acusa token que está lá
     * (foi o falso vermelho da 1ª versão deste guard).
     *
     * ⛔ Conferir só a EXISTÊNCIA aprovaria um token declarado apenas no claro — e a tela
     * ficaria com o texto de um tema sobre o fundo do outro. Medido no CSS que prod serve:
     * cada token aparece exatamente 2×.
     */
    const vezes = (t: string) => css.split(`${t}:`).length - 1
    const usados = [...new Set((tela.match(/var\((--[a-z0-9-]+)\)/g) ?? []).map((m) => m.slice(4, -1)))]
    expect(usados.length).toBeGreaterThan(8)
    for (const t of usados) {
      // ⚠️ `--fam-${x}-mid` é montado por template na tela: a família vem do payload
      if (t.startsWith('--fam-') && !/^--fam-[a-z]+-(bg|mid|ink)$/.test(t)) continue
      expect(vezes(t), `token ${t} precisa dos DOIS mapas (claro e escuro)`).toBeGreaterThanOrEqual(2)
    }
    // ⭐ os tokens de família montados por template têm que existir pra TODA família do mapa
    const familias = [
      ...new Set(
        [...ler(R('lib/stock/producao/cara-da-receita.ts')).matchAll(/familia: '([a-z]+)'/g)].map(
          (m) => m[1],
        ),
      ),
    ]
    expect(familias.length).toBeGreaterThan(4)
    for (const f of familias) {
      expect(vezes(`--fam-${f}-mid`), `--fam-${f}-mid nos dois mapas`).toBeGreaterThanOrEqual(2)
    }
  })
})

describe('⛔ UMA COMPOSIÇÃO, DOIS VIEWPORTS (REGRA 12)', () => {
  it('⛔ nenhum bloco só-celular: não existe par `sm:hidden` × `hidden sm:`', () => {
    const soCel = (tela.match(/className="[^"]*\bsm:hidden\b/g) ?? []).length
    const soDesk = (tela.match(/className="[^"]*\bhidden sm:/g) ?? []).length
    expect(soCel + soDesk, 'duas composições do mesmo dado divergem no 1º selo novo').toBe(0)
  })

  /**
   * ⚠️ REAPONTADO EM 07/10 (v2) — ele olhava o SVG da CASA DE TIJOLOS, que **morreu** (o dono
   * reprovou por ilegibilidade). A pergunta não mudou — *"o desenho encolhe no celular sem
   * cortar?"* — e o único SVG que sobrou é a PIZZA do montador. ⛔ É a razão de existir da
   * REGRA 3: grep não distingue "refatorei" de "quebrei".
   */
  it('⭐ a pizza é SVG com viewBox + largura 100% — é o que a faz legível em 390px', () => {
    const bloco = blocoDa('PizzaEmFatias')
    expect(bloco).toContain('viewBox=')
    expect(bloco).toMatch(/className="w-full"/)
    // ⛔ largura fixa em px no SVG quebraria no celular
    expect(bloco).not.toMatch(/<svg[^>]*width="\d/)
  })

  /**
   * ⚠️⚠️ REAPONTADO TRÊS VEZES, COM O MOTIVO ESCRITO EM CADA — e a PERGUNTA nunca mudou:
   * *"a tela não normaliza nem clampa a barra por conta própria"*.
   *  · v1: travava a pilha de tijolos contra a sobreposição do telhado (os tijolos morreram)
   *  · v2: virou a barra da casa (`pago + transbordo = 1`, em `montarPlacar`)
   *  · 10/10: virou a BARRA DE COMPOSIÇÃO (`cmv + casa + lucro = 1`, em `montarCascata`) —
   *    o placar de 3 cartões foi aposentado por ordem escrita do dono.
   *
   * ⛔ Régua própria na tela nasceria como a 2ª régua do desenho, que é exatamente como a
   * pilha de tijolos estourou em 07/10.
   */
  it('⛔⛔ a BARRA vem da lib — a tela não normaliza nem clampa por conta própria', () => {
    const bloco = blocoDa('CascataDoMes')
    expect(bloco).toContain('casc.composicao.cmv')
    expect(bloco).toContain('casc.composicao.casa')
    expect(bloco).toContain('casc.composicao.lucro')
    // ⛔ nenhum clamp/normalização própria sobre os pedaços
    expect(bloco).not.toMatch(/Math\.min\([^)]*composicao/)
    expect(bloco).not.toMatch(/composicao\.\w+\s*\/\s*/)
    // ⚠️ e nada de `* H` (o jeito antigo, que fazia a pilha passar do telhado)
    expect(bloco).not.toMatch(/pctDaSobra \* H/)
  })

  /**
   * ⚠️ REAPONTADO (v2): era o rótulo dentro do TIJOLO; agora é o custo dentro da FATIA. A
   * pergunta é a mesma — *"só escreve quando cabe"* — e com 6 fatias o valor viraria rabisco,
   * então ali ele cede o lugar pro número da fatia e o custo fica na lista ao lado.
   */
  it('⭐ o custo só é escrito dentro da fatia quando CABE', () => {
    // ⚠️ REAPONTADO (v3): a régua é a MESMA (*"só escreve quando cabe"*); o que mudou é a
    // FORMA — virou ternário `n <= 4 ? (custo+nome) : (número da fatia)`, como a referência
    // desenha. Procurar `n > 4` era procurar a escrita antiga, não a decisão.
    const bloco = blocoDa('PizzaEmFatias')
    expect(bloco).toMatch(/n <= 4 \? \(/)
    expect(bloco).toMatch(/f\.indice \+ 1/)
  })
})

describe('⛔⛔ A TELA NÃO CALCULA DINHEIRO — ela desenha o payload', () => {
  it('⛔ nenhuma aritmética de dinheiro na tela', () => {
    // ⚠️ o que se permite é GEOMETRIA (as frações do SVG e a largura da barra), nunca somar
    // ou subtrair valor — a Σ e a subtração moram em `casa.ts`/`sobra.ts`
    expect(usosDe(tela, 'sobraTotal')).toBeGreaterThan(0)
    // ⛔ a tela não pode somar os tijolos nem subtrair o complemento
    expect(tela).not.toMatch(/reduce\([^)]*sobra/)
    expect(tela).not.toMatch(/sobraTotal\s*-\s*/)
    expect(tela).not.toMatch(/custoFixo\s*-\s*/)
  })

  it('⭐ a tela usa o VEREDITO e a RESSALVA do servidor, nunca compara por conta própria', () => {
    /**
     * ⚠️ REAPONTADO (10/10): a ressalva mudou de casa — do cartão de resultado do placar pro
     * cartão do LUCRO (o herói da cascata). A régua é a MESMA e é a de v1: **a tela não pode
     * mostrar "pagou" seco** sobre dado parcial.
     */
    expect(usosDe(tela, 'montarCascata')).toBeGreaterThan(0)
    expect(tela).toContain('c.veredito.ressalva')
    expect(blocoDa('CartaoDaCascataNaTela')).toContain('{ressalva}')
    // ⛔ comparar sobra com custo fixo aqui seria a 2ª régua do "pagou"
    expect(tela).not.toMatch(/sobraLiquida\s*>=?\s*/)
  })

  it('⭐ REGRA 4: a COR vem do payload, sem 2ª derivação de nome → cor', () => {
    /**
     * ⚠️⚠️ REAPONTADO (v3, com o motivo escrito): a referência visual desenha a **BOLINHA de
     * 10px da família**, não o logo da receita — e o `LogoDaReceita` saiu da tela. A pergunta
     * da REGRA 4 não mudou: *"quem traduz nome → cor?"*. A resposta continua sendo o
     * SERVIDOR (`caraDaReceita` → `familia` no payload), e a tela só lê o campo.
     *
     * ⛔ Importar `caraDaReceita` aqui seria a 2ª tradução, e as duas divergiriam no 1º grupo
     * novo do mapa — exatamente o que o guard antigo protegia por outro caminho.
     */
    expect(tela).toContain('var(--fam-${familia}-mid)')
    expect(usosDe(tela, 'caraDaReceita')).toBe(0)
  })
})

describe('⛔⛔ NADA DE AVISO INLINE (a lei de 04/10) — o que pede AÇÃO vai pro sininho', () => {
  it('⛔ a tela não monta o bloco de avisos', () => {
    expect(tela).not.toContain('BlocoDeAvisos')
    expect(usosDe(tela, 'registrarAviso')).toBe(0)
  })

  it('⭐ e o produtor do sininho EXISTE e está ligado na rodada', () => {
    const prod = semComentarios(ler(R('lib/avisos/produtores/margem.ts')))
    expect(usosDe(prod, 'registrarAviso')).toBeGreaterThan(0)
    const rodar = semComentarios(ler(R('lib/avisos/produtores/rodar.ts')))
    expect(usosDe(rodar, 'produzirAvisosDeMargem'), 'produtor sem chamador é promessa').toBeGreaterThan(0)
  })

  it('⛔⛔ o produtor NÃO decide nada — ele lê, chama a régua pura e grava', () => {
    const prod = semComentarios(ler(R('lib/avisos/produtores/margem.ts')))
    // ⭐ a régua mora em lib pura e é EXECUTADA em teste; aqui só se prova o encaixe
    expect(usosDe(prod, 'reguaDosAvisosDaMargem')).toBeGreaterThan(0)
    // ⛔ nenhuma frase de aviso pode voltar a nascer no produtor
    expect(prod).not.toContain('titulo:')
    expect(prod).not.toContain('severidade:')
    expect(prod).not.toContain('oQueFazer:')
    // ⚠️ o gate do mês parcial vem da constante, nunca de um número digitado aqui
    expect(usosDe(prod, 'DIA_QUE_ABRE_A_COMPARACAO')).toBeGreaterThan(0)
    expect(prod).not.toMatch(/diaDoMes >= \d/)
  })
})

describe('⭐ A TELA DIZ A COMPOSIÇÃO DOS CHIPS, e o veredito nunca vem seco', () => {
  it('⛔ a frase da composição é desenhada', () => {
    expect(tela).toContain('{c.composicao.texto}')
  })

  it('⛔⛔ o custo do complemento aparece NOMEADO — agora na SUBLINHA do cartão 1', () => {
    /**
     * ⚠️⚠️ REAPONTADO (v3): a referência NÃO tem a "conta aberta" (sobra − complementos = …)
     * embaixo dos cartões; ela põe o abatimento **na sublinha do cartão que ele afeta**
     * (*"sobra medida em 55% das vendas · já abatidos R$ 9.256 de complementos"*). A régua é a
     * mesma — *o complemento nunca é um abatimento mudo* — e quem escreve a frase virou a lib,
     * que é onde ela dá pra EXECUTAR em teste.
     */
    /**
     * ⚠️⚠️ REAPONTADO (10/10): a `sublinhaDaSobra` do placar MORREU com ele. A régua é a
     * mesma — *o complemento nunca é um abatimento mudo* — e a frase migrou pro ⓘ da cascata,
     * que é onde ela faz sentido agora: **o complemento É parte do CMV**, então a ressalva
     * fica no número que ele compõe, não na sobra. Executada em `cascata.test.ts`.
     */
    const cs = semComentarios(ler(R('lib/margem/cascata.ts')))
    expect(cs).toContain('entram no CMV')
    expect(cs).toContain('complementos')
    // ⚠️ e o PISO é dito: o CMV é o mínimo, não o total
    expect(cs).toContain('ocorrenciasSemCusto')
    expect(cs).toContain('é o MÍNIMO, não o total')
  })

  it('⭐ a cobertura e o placar aparecem — o dia D nunca sozinho', () => {
    /**
     * ⚠️ REAPONTADO (v3): a referência junta as duas coisas numa LINHA só no pé do placar
     * (`.cobertura-line`), e quem a escreve é `linhaDaCobertura` — PURA e executada em teste.
     * A pergunta é a mesma: *o dia D nunca aparece sem a cobertura ao lado, e a ausência dele
     * é EXPLICADA.*
     */
    expect(usosDe(tela, 'linhaDaCobertura')).toBeGreaterThan(0)
    const pl = semComentarios(ler(R('lib/margem/placar.ts')))
    expect(pl).toContain('COBERTURA_MINIMA')
    expect(pl).toContain('o dia em que a casa se pagou')
    expect(pl).toContain('casa.placar.porque')
  })
})

describe('⭐ A FRONTEIRA DE PAPEL — isto é DINHEIRO, não operação de estoque', () => {
  it('⛔ a rota exige `transaction.view`, nunca `stock.view`', () => {
    const rota = semComentarios(ler(ROTA))
    expect(rota).toContain("requirePermission('transaction.view')")
    expect(rota).not.toContain('stock.view')
  })

  it('⛔ o item do menu exige a MESMA permissão da página (a porta acompanha a sala)', () => {
    const sb = semComentarios(ler(SIDEBAR))
    const i = sb.indexOf('/margem`')
    expect(i).toBeGreaterThan(-1)
    const bloco = sb.slice(Math.max(0, i - 400), i + 200)
    expect(bloco).toContain('perm="transaction.view"')
  })
})

describe('⛔⛔ O MOTOR NÃO PODE VOLTAR A ESCONDER O COMPLEMENTO NEM A CRAVAR O FATOR', () => {
  it('⛔ a casa decide "pagou" pela sobra LÍQUIDA', () => {
    const casa = semComentarios(ler(CASA))
    expect(casa).toMatch(/pagou\s*=.*sobraLiquida/)
    expect(casa).toMatch(/sobraLiquida\s*=\s*round2\(sobraTotal - complementos\.custo\)/)
  })

  it('⛔⛔ NENHUM fator por tamanho no motor da margem (o fator morreu em 07/10)', () => {
    for (const f of ['casa.ts', 'sobra.ts', 'liga.ts', 'leitura.ts', 'por-dia.ts', 'ficha-de-margem.ts']) {
      const src = semComentarios(ler(R(`lib/margem/${f}`)))
      expect(src, `${f} não pode multiplicar por fator de tamanho`).not.toMatch(/fator/i)
    }
  })

  /**
   * ⚠️ REAPONTADO EM 08/10, NÃO AFROUXADO: a lista fechada **mudou de casa** pra
   * `lib/stock/vendas/razao-sabor-pizza.ts` quando a central de import passou a precisar da
   * MESMA régua (REGRA 4 — duas listas de "o que não é sabor" divergiriam no primeiro nome
   * novo). O `leitura.ts` **reexporta**, então os leitores antigos seguem iguais.
   *
   * ⛔ A PERGUNTA NÃO MUDOU (*a lista é FECHADA e o GRANDE está nela*); o que mudou é quem
   * responde. ***Grep não distingue "refatorei" de "quebrei"*** — é a razão de existir da
   * REGRA 3, e por isso o alvo se move em vez de a asserção morrer.
   */
  it('⭐ "GRANDE" é tamanho vazado, a lista é FECHADA e tem UM dono', () => {
    const dono = semComentarios(ler(R('lib/stock/vendas/razao-sabor-pizza.ts')))
    expect(dono, 'o dono da régua perdeu a lista fechada').toContain('NAO_SAO_SABOR')
    expect(dono, 'GRANDE saiu da lista de tamanhos vazados').toMatch(/'GRANDE'/)
    const l = semComentarios(ler(LEITURA))
    expect(l, 'a margem parou de consumir o dono da régua — voltou a ter régua própria').toContain(
      'razao-sabor-pizza',
    )
    expect(usosDe(l, 'ehSaborDeVerdade')).toBeGreaterThan(0)
  })
})

/* ═══════════════════════════ OS GUARDS DO v2 (07/10/2026) ═══════════════════════════ */

describe('⛔⛔⛔ A CASA DE TIJOLOS SVG MORREU — e não pode ressuscitar', () => {
  /**
   * ⛔ O dono reprovou por ILEGIBILIDADE. E ela não volta "porque já estava pronta" — é a
   * mesma razão por que o `GruposSugeridos` foi APAGADO em 23/09 em vez de escondido:
   * enquanto o componente existe no arquivo, alguém religa.
   */
  it('⛔ nenhum telhado, nenhuma parede, nenhum tijolo empilhado na tela', () => {
    expect(tela).not.toContain('function CasaDeTijolos')
    expect(tela).not.toContain('TELHADO')
    expect(tela).not.toContain('polygon')
    // ⚠️ e o empilhamento (o `y -= h` que clampava em 0) não existe mais
    expect(tela).not.toMatch(/y -= h/)
  })

  /**
   * ⚠️ REAPONTADO (10/10): eram 3 cartões + a barra da casa; agora são **5 cartões + a barra
   * de composição**, por ordem escrita do dono (*"é ele crescido"*). A pergunta não mudou:
   * *"os cartões vêm da MESMA lib"* — régua própria na tela seria a 2ª resposta do mês.
   */
  it('⭐ no lugar dele: a CASCATA de 5 cartões, todos da MESMA lib', () => {
    const bloco = blocoDa('CascataDoMes')
    expect(usosDe(bloco, 'montarCascata')).toBeGreaterThan(0)
    expect(bloco).toContain('casc.cartoes.map')
    // ⚠️ no celular os cartões EMPILHAM (REGRA 12) — uma composição só, o CSS escolhe
    expect(bloco).toMatch(/grid-cols-1[^"]*min-\[900px\]:grid-cols-5/)
  })

  it('⭐ a barra de composição tem os 3 pedaços e o selo coral do prejuízo', () => {
    const bloco = blocoDa('CascataDoMes')
    expect(bloco).toContain('--fam-ambar-mid')
    expect(bloco).toContain('--fam-indigo-mid')
    expect(bloco).toContain('--fam-verde-mid')
    expect(bloco).toContain('faltam')
  })

  it('⛔⛔ "a apurar" NUNCA vira R$ 0,00 no cartão', () => {
    const bloco = blocoDa('CartaoDaCascataNaTela')
    expect(bloco).toMatch(/'a apurar'/)
  })
})

describe('⛔⛔ QUEM CARREGOU A CASA — a lista vem da lib, com o rodapé que destrava a cobertura', () => {
  it('⭐ a tela chama `montarCarregadores` e não ordena nem soma por conta', () => {
    const bloco = blocoDa('QuemCarregouACasa')
    expect(bloco).toContain('montarCarregadores')
    expect(bloco).not.toMatch(/\.sort\(/)
    expect(bloco).not.toMatch(/\.reduce\(/)
  })

  it('⭐ o "+N produtos · ver todos" EXPANDE — nada some atrás dele', () => {
    const bloco = blocoDa('QuemCarregouACasa')
    expect(bloco).toContain('ver todos')
    expect(bloco).toMatch(/abrirResto \? \[\.\.\.l\.visiveis, \.\.\.l\.resto\]/)
  })

  it('⛔ o rodapé âmbar diz a cobertura, a meta, e LEVA pra fila das fichas', () => {
    const bloco = blocoDa('QuemCarregouACasa')
    expect(bloco).toContain('fora da obra')
    expect(bloco).toContain('sabores sem ficha')
    expect(bloco).toContain('COBERTURA_MINIMA')
    /**
     * ⛔ RODAPÉ QUE COBRA SEM DAR O CAMINHO É AVISO, NÃO FERRAMENTA — e o caminho mudou de
     * endereço (reapontado em v3): a referência manda pra a **FILA DESTA PÁGINA** (`#fila`,
     * o 6º cartão), que é onde o sabor sem ficha está listado por volume. O atalho pro
     * cardápio continua logo abaixo, porque é lá que a ficha nasce.
     */
    expect(bloco).toContain('href="#fila"')
    expect(bloco).toContain('estoque/cardapio')
  })

  it('⭐ REGRA 4: a linha usa a BOLINHA da família que veio do payload', () => {
    // ⚠️ REAPONTADO (v3): a referência desenha `.dot` de 10px, não o logo — ver o bloco acima
    expect(blocoDa('LinhaDaCarga')).toContain('<Bolinha familia={x.familia} />')
    expect(blocoDa('Bolinha')).toContain('var(--fam-${familia}-mid)')
  })
})

describe('⛔⛔⛔ O MONTADOR É SÓ SIMULAÇÃO — nada grava, nada baixa', () => {
  it('⛔⛔ o único POST da seção é o da CONFIG, e ele manda uma ação de config', () => {
    const bloco = blocoDa('MontadorDePizza')
    const posts = [...bloco.matchAll(/method: 'POST'/g)]
    expect(posts, 'um POST a mais aqui é uma gravação de pizza').toHaveLength(1)
    expect(bloco).toContain("acao: 'SEMEAR'")
    expect(bloco).toContain('margem/config')
    /**
     * ⛔ NENHUMA ROTA de baixa/venda/movimento é tocada pela bancada.
     *
     * ⚠️ REAPONTADO (v3): a régua passou a ser o CAMINHO DE ROTA, não a palavra — a própria
     * dica do cartão diz *"nada grava, nada **baixa**"* (texto da referência), e o regex por
     * palavra reprovava a frase honesta.
     */
    expect(bloco).not.toMatch(/\/(vendas|baixa|baixar|movimentos|processar)\b/)
  })

  it('⭐ a conta é a lib `montarPizza` — a tela não multiplica dose nem divide por fatia', () => {
    const bloco = blocoDa('MontadorDePizza')
    expect(bloco).toContain('montarPizza')
    // ⛔⛔ dividir pelo nº de fatias seria ressuscitar o FATOR por tamanho (morto em 07/10)
    expect(bloco).not.toMatch(/\/ (n|fatias\.length|pizza\.fatias\.length)/)
    expect(bloco).not.toMatch(/custo \* /)
  })

  it('⛔ o custo PARCIAL é apresentado como PISO, nunca como o custo', () => {
    /**
     * ⚠️ REAPONTADO (v3): a referência diz o piso com o SUFIXO — *"R$ 17,42 **+ 1 fatia(s)**"*
     * no total e *"~R$ 63,02 **− fatias**"* na sobra. A régua é a mesma (*o parcial nunca se
     * passa pelo custo*); o que mudou é a forma que o dono aprovou.
     */
    const bloco = blocoDa('MontadorDePizza')
    expect(bloco).toMatch(/pizza\.custoTotal == null/)
    expect(bloco).toContain('fatia(s)')
    expect(bloco).toContain('− fatias')
  })

  it('⭐⭐ o sabor SEM FICHA aparece com selo âmbar e leva pra criar a ficha', () => {
    const bloco = blocoDa('MontadorDePizza')
    // ⛔ esconder faria a bancada mentir sobre o cardápio e tirar da frente do dono a fila
    // que ele precisa atacar pra subir a cobertura
    // ⚠️ REAPONTADO (v3): o selo da referência é o chip TRACEJADO ÂMBAR com `sem ficha ⚠`
    expect(bloco).toContain('sem ficha ⚠')
    expect(bloco).toContain('border-dashed')
    expect(bloco).toContain('estoque/cardapio?sabor=')
    // ⚠️ e ele NÃO é escolhível como sabor: tocar abre a criação, não soma custo nenhum
    expect(bloco).toMatch(/s\.temFicha \? \(/)
  })

  it('⚠️ INVERTIDO COM O MOTIVO: a referência lista os sabores em CHIPS, sem campo de busca', () => {
    /**
     * ⚠️⚠️ TESTE INVERTIDO, NÃO APAGADO. A versão de v2 exigia `filtrarPorBusca` no montador.
     * A **referência aprovada pelo dono** lista os sabores como chips inline, **com ficha
     * primeiro**, sem campo de busca — e a ordem dele foi explícita desde 10/09: *"se tua
     * versão 'melhorou' algo do mock, desfaz — igual primeiro, melhoria só com meu pedido"*.
     *
     * ⭐ A METADE CERTA DO TESTE ANTIGO CONTINUA MORDENDO: se um dia a busca voltar (com o
     * pedido dele), ela **não pode** ser `includes` cru — foi o `contains` case-sensitive que
     * fez *"calabresa"* achar ZERO em 08/09.
     */
    const bloco = blocoDa('MontadorDePizza')
    expect(bloco).not.toContain('filtrarPorBusca')
    expect(tela).not.toMatch(/\.toLowerCase\(\)\.includes\(/)
    // ⭐ e a ORDEM (com ficha primeiro) continua sendo decisão da lib, nunca da tela
    expect(bloco).not.toMatch(/\.sort\(/)
    expect(usosDe(semComentarios(ler(R('lib/margem/montador.ts'))), 'ordenarSabores')).toBeGreaterThan(0)
  })

  it('⭐ trocar o tamanho RESETA as fatias — fatia órfã somaria um sabor que a tela não desenha', () => {
    expect(blocoDa('MontadorDePizza')).toMatch(/function trocarTamanho[\s\S]*setEscolhas\(/)
  })

  it('⛔ o campo de preço usa o sanitizador da casa — digitar vírgula não pode zerar o número', () => {
    // ⚠️ REAPONTADO (v3): o campo virou `CampoDePreco` (a referência o repete em cada linha de
    // canal, e duas cópias do input divergiriam no 1º ajuste). A régua é a mesma.
    const campo = blocoDa('CampoDePreco')
    expect(campo).toContain('sanitizarQtd')
    expect(campo).toContain('inputMode="decimal"')
    expect(campo).toContain('w-[92px]')
    expect(blocoDa('MontadorDePizza')).toContain('valorQtd')
  })

  it('⛔⛔ o GET do montador não semeia — ler não escreve (a régua de 08/09)', () => {
    const rota = semComentarios(ler(R('app/api/empresas/[id]/margem/montador/route.ts')))
    expect(rota).toContain("requirePermission('transaction.view')")
    expect(rota).not.toMatch(/create|upsert|update|delete/)
  })

  it('⛔ escrever config exige `stock.manage`, ler a bancada exige `transaction.view`', () => {
    const cfg = semComentarios(ler(R('app/api/empresas/[id]/margem/config/route.ts')))
    expect(cfg).toContain("requirePermission('stock.manage')")
    // ⛔ a recusa de domínio vira 422 com `code`, nunca 500 mudo (a cicatriz de 20/09)
    expect(cfg).toContain('ConfigDaMargemError')
    expect(cfg).toContain('status: 422')
    expect(cfg).toContain('code: e.code')
  })
})

describe('⛔⛔ A LEITURA DO MONTADOR — o buraco que a minha própria reposição expôs', () => {
  /**
   * ⚠️⚠️ ESTE BLOCO NASCEU DE UM FURO DO GUARD, achado na REGRA 11 (07/10): eu repus o defeito
   * *"o sabor sem ficha não entra na lista"* **na LEITURA** e a suíte ficou VERDE — porque os
   * guards de cima olham a TELA, e a tela continuava com o ramo âmbar pronto pra desenhar uma
   * lista que nunca chegaria. ***Guard que testa a vitrine aprova a prateleira vazia.***
   */
  const leitura = semComentarios(ler(R('lib/margem/leitura-montador.ts')))

  it('⭐⭐ o sabor do PDV SEM FICHA é empurrado pra lista, com `temFicha: false`', () => {
    expect(usosDe(leitura, 'mapComp')).toBeGreaterThan(1)
    expect(leitura).toContain('temFicha: false')
    // ⛔ nenhum `continue` incondicional no laço — foi exatamente a forma do defeito reposto
    expect(leitura).not.toMatch(/\n\s{4}continue\n/)
    // ⭐ e quem decide o que é sabor é a régua única, nunca um filtro próprio
    expect(usosDe(leitura, 'ehSaborDeVerdade')).toBeGreaterThan(0)
  })

  it('⛔⛔ o custo sai da porta única `explodir` + `custoMedioPorItem` — zero conta nova', () => {
    expect(usosDe(leitura, 'explodir')).toBeGreaterThan(0)
    expect(usosDe(leitura, 'custoMedioPorItem')).toBeGreaterThan(0)
    // ⛔ nenhuma dose multiplicada aqui: a multiplicação mora dentro de `explodirReceita`
    expect(leitura).not.toMatch(/qtdPlanejada/)
  })

  it('⛔ custo PARCIAL nunca vira o custo da ficha — falta uma folha, devolve `null`', () => {
    const bloco = leitura.slice(leitura.indexOf('export function custoDeUmaFicha'))
    expect(bloco).toMatch(/if \(c == null\) return null/)
  })

  it('⚠️ ficha apontada como base e depois arquivada: o custo vem `null`, não 0', () => {
    expect(leitura).toMatch(/fichas\.some\(\(f\) => f\.id === b\.fichaId\) \? custoDeUmaFicha/)
  })

  it('⭐ e a escrita de config tem CHOKE-POINT único, com rastro em todo gesto', () => {
    const cfg = semComentarios(ler(R('lib/margem/config.ts')))
    expect(cfg).toContain('export async function aplicarConfigDaMargem')
    // ⛔ todo ramo grava o autor: número de dinheiro sem autor é o que ninguém explica depois
    const gestos = ['CANAL_TAXA', 'CANAL_NOVO', 'REGRA_SABORES', 'BASE_TAMANHO']
    for (const g of gestos) expect(cfg, `o gesto ${g} precisa existir`).toContain(`case '${g}'`)
    expect((cfg.match(/criadoPorId/g) ?? []).length).toBeGreaterThanOrEqual(gestos.length)
    // ⚠️ REGRA 8: canal e ficha resolvidos por ID **dentro da empresa**
    expect(cfg).toMatch(/findFirst\(\{ where: \{ id: gesto\.canalId, companyId \} \}\)/)
    expect(cfg).toMatch(/findFirst\(\{ where: \{ id: gesto\.fichaId, companyId \} \}\)/)
  })

  it('⛔⛔ o SEED só roda quando está VAZIO — nunca sobrescreve a edição do dono', () => {
    const cfg = semComentarios(ler(R('lib/margem/config.ts')))
    expect(cfg).toMatch(/if \(canais === 0\)/)
    expect(cfg).toMatch(/if \(regras === 0\)/)
    // ⚠️ e a BASE não é semeada: em prod o tamanho GRANDE tem 4 candidatos com fichas
    // diferentes, e a diferença entre elas é a massa
    const s = cfg.slice(cfg.indexOf('async function semear'), cfg.indexOf('export async function aplicarConfig'))
    expect(s).not.toContain('stockBaseDoTamanho')
  })
})
