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
   * ⚠️⚠️ TESTE REAPONTADO, COM O MOTIVO ESCRITO (07/10, v2). Ele travava a pilha de tijolos
   * contra a sobreposição do telhado — e **os tijolos SVG morreram**. A régua que sobreviveu é
   * a mesma pergunta num desenho mais simples: *"o que foi pago não pode passar do total da
   * barra"* — e ela agora mora em `montarPlacar`, PURA e testada (`pago + transbordo = 1`).
   *
   * ⛔ O que o guard de TELA afirma é que ela **não tem clamp próprio**: se ela normalizasse
   * por conta, nasceria a 2ª régua do desenho, que é exatamente como a pilha estourou.
   */
  it('⛔⛔ a BARRA vem da lib — a tela não normaliza nem clampa por conta própria', () => {
    const bloco = blocoDa('PlacarDaCasa')
    expect(bloco).toContain('p.barra.pago')
    expect(bloco).toContain('p.barra.transbordo')
    expect(bloco).toContain('p.barra.bandeira')
    // ⛔ nenhum Math.min/max sobre a largura da barra na tela
    expect(bloco).not.toMatch(/Math\.min\([^)]*barra/)
    // ⚠️ e nada de `* H` (o jeito antigo, que fazia a pilha passar do telhado)
    expect(bloco).not.toMatch(/pctDaSobra \* H/)
  })

  /**
   * ⚠️ REAPONTADO (v2): era o rótulo dentro do TIJOLO; agora é o custo dentro da FATIA. A
   * pergunta é a mesma — *"só escreve quando cabe"* — e com 6 fatias o valor viraria rabisco,
   * então ali ele cede o lugar pro número da fatia e o custo fica na lista ao lado.
   */
  it('⭐ o custo só é escrito dentro da fatia quando CABE', () => {
    const bloco = blocoDa('PizzaEmFatias')
    expect(bloco).toMatch(/n <= 4/)
    expect(bloco).toMatch(/n > 4/)
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
    // ⚠️ REAPONTADO (v2): a ressalva mudou de casa — ela viaja no `montarPlacar` e é desenhada
    // pelo cartão de resultado. A régua é a MESMA: a tela não pode mostrar "pagou" seco.
    expect(usosDe(tela, 'montarPlacar')).toBeGreaterThan(0)
    expect(tela).toContain('ressalva={p.resultado.ressalva}')
    expect(blocoDa('CartaoDoPlacar')).toContain('{ressalva}')
    // ⛔ comparar sobra com custo fixo aqui seria a 2ª régua do "pagou"
    expect(tela).not.toMatch(/sobraLiquida\s*>=?\s*/)
  })

  it('⭐ REGRA 4: o logo deriva do NOME pela mesma `caraDaReceita`, sem 2ª derivação', () => {
    expect(tela).toContain('<LogoDaReceita nome={x.nome}')
    // ⛔ `forcar` aqui seria a 2ª tradução de nome → cor/ícone
    expect(tela).not.toMatch(/LogoDaReceita[^/]*forcar=/)
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

  it('⛔⛔ o custo do complemento aparece NOMEADO na conta da casa', () => {
    expect(tela).toContain('complementos')
    expect(tela).toContain('ocorrenciasComCusto')
    // ⚠️ e o PISO é dito: o custo é o mínimo, não o total
    expect(tela).toContain('ocorrenciasSemCusto')
    // ⚠️ a frase quebra em duas linhas no JSX — a âncora é o pedaço contíguo
    expect(tela).toContain('custo acima é o mínimo, não o total')
  })

  it('⭐ a cobertura e o placar aparecem — o dia D nunca sozinho', () => {
    expect(tela).toContain('cobertura')
    expect(tela).toContain('{c.placar.porque}')
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

  it('⭐ "GRANDE" é tamanho vazado e a lista é FECHADA', () => {
    const l = semComentarios(ler(LEITURA))
    expect(l).toContain('NAO_SAO_SABOR')
    expect(l).toMatch(/'GRANDE'/)
    expect(usosDe(l, 'ehSaborDeVerdade')).toBeGreaterThan(1)
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

  it('⭐ no lugar dele: 3 cartões + a barra, e os três cartões vêm da MESMA lib', () => {
    const bloco = blocoDa('PlacarDaCasa')
    expect(bloco).toContain('montarPlacar')
    expect(bloco).toContain('c={p.sobra}')
    expect(bloco).toContain('c={p.casa}')
    expect(bloco).toContain('c={p.resultado}')
    // ⚠️ no celular os cartões EMPILHAM (REGRA 12) — uma composição só, o CSS escolhe
    expect(bloco).toMatch(/grid-cols-1[^"]*sm:grid-cols-3/)
  })

  it('⭐ a barra tem a bandeira e o verde do transbordo', () => {
    const bloco = blocoDa('PlacarDaCasa')
    expect(bloco).toContain('🏁')
    expect(bloco).toContain('--fam-verde-mid')
    expect(bloco).toContain('rotuloTransbordo')
  })

  it('⛔⛔ "a apurar" NUNCA vira R$ 0,00 no cartão', () => {
    const bloco = blocoDa('CartaoDoPlacar')
    expect(bloco).toMatch(/c\.valor == null \? 'a apurar'/)
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
    // ⛔ rodapé que cobra sem dar o caminho é aviso, não ferramenta
    expect(bloco).toContain('ir pra fila das fichas')
  })

  it('⭐ REGRA 4: o logo deriva do NOME pela mesma `caraDaReceita`', () => {
    expect(blocoDa('QuemCarregouACasa')).toContain('<LogoDaReceita nome={x.nome}')
  })
})

describe('⛔⛔⛔ O MONTADOR É SÓ SIMULAÇÃO — nada grava, nada baixa', () => {
  it('⛔⛔ o único POST da seção é o da CONFIG, e ele manda uma ação de config', () => {
    const bloco = blocoDa('MontadorDePizza')
    const posts = [...bloco.matchAll(/method: 'POST'/g)]
    expect(posts, 'um POST a mais aqui é uma gravação de pizza').toHaveLength(1)
    expect(bloco).toContain("acao: 'SEMEAR'")
    expect(bloco).toContain('margem/config')
    // ⛔ nenhuma rota de baixa/venda/movimento é tocada pela bancada
    expect(bloco).not.toMatch(/vendas|baixa|movimento|processar/)
  })

  it('⭐ a conta é a lib `montarPizza` — a tela não multiplica dose nem divide por fatia', () => {
    const bloco = blocoDa('MontadorDePizza')
    expect(bloco).toContain('montarPizza')
    // ⛔⛔ dividir pelo nº de fatias seria ressuscitar o FATOR por tamanho (morto em 07/10)
    expect(bloco).not.toMatch(/\/ (n|fatias\.length|pizza\.fatias\.length)/)
    expect(bloco).not.toMatch(/custo \* /)
  })

  it('⛔ o custo PARCIAL é apresentado como PISO, nunca como o custo', () => {
    const bloco = blocoDa('MontadorDePizza')
    expect(bloco).toMatch(/pizza\.custoTotal == null/)
    expect(bloco).toContain('pelo menos')
  })

  it('⭐⭐ o sabor SEM FICHA aparece com selo âmbar e leva pra criar a ficha', () => {
    const bloco = blocoDa('MontadorDePizza')
    // ⛔ esconder faria a bancada mentir sobre o cardápio e tirar da frente do dono a fila
    // que ele precisa atacar pra subir a cobertura
    expect(bloco).toContain('sem ficha — criar')
    expect(bloco).toContain('estoque/cardapio?sabor=')
    // ⚠️ e ele NÃO é escolhível como sabor: tocar abre a criação, não soma custo nenhum
    expect(bloco).toMatch(/s\.temFicha \? \(/)
  })

  it('⭐ a busca de sabores usa a régua da casa (acento e ordem das palavras)', () => {
    // ⛔ `includes` cru acha ZERO pra "calabresa" quando o nome está em maiúscula (08/09)
    expect(blocoDa('MontadorDePizza')).toContain('filtrarPorBusca')
    expect(tela).not.toMatch(/\.toLowerCase\(\)\.includes\(/)
  })

  it('⭐ trocar o tamanho RESETA as fatias — fatia órfã somaria um sabor que a tela não desenha', () => {
    expect(blocoDa('MontadorDePizza')).toMatch(/function trocarTamanho[\s\S]*setEscolhas\(/)
  })

  it('⛔ o campo de preço usa o sanitizador da casa — digitar vírgula não pode zerar o número', () => {
    const bloco = blocoDa('MontadorDePizza')
    expect(bloco).toContain('sanitizarQtd')
    expect(bloco).toContain('valorQtd')
    expect(bloco).toContain('inputMode="decimal"')
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
