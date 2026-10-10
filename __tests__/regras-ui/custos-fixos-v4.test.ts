/**
 * ⭐⭐ O GUARD DA TELA DE CUSTOS FIXOS (06/10/2026) — ESTRUTURAL, e assumido como tal.
 *
 * ⚠️ O projeto roda em `environment: node` (sem jsdom), então não dá pra renderizar e clicar.
 * O que este guard trava é o que o dono pediu e o que já voltou nesta casa: a tela não pode
 * recalcular dinheiro, não pode montar bloco de aviso inline, o selo não pode nascer aqui, e
 * o "a apurar" não pode virar R$ 0,00.
 *
 * ⛔⛔ **ELE LÊ A FONTE SEM COMENTÁRIO, de propósito.** O arquivo documenta no próprio texto os
 * defeitos que ele mata (*"a tela não calcula nada de dinheiro"*, *"nada de bloco de aviso
 * inline"*) — lendo o texto cru, **o arquivo que documenta o defeito seria o que o absolve**.
 * É a "menção, não uso" que já mordeu 8 vezes aqui.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
/** ⛔ UM detector, UM lugar — a cópia local era cega a import multilinha (REGRA 11, 07/10) */
import { semComentarios, usosDe } from './_leitura-de-fonte'

const raiz = process.cwd()
const TELA = 'app/(dashboard)/empresas/[id]/custos-fixos/page.tsx'
const LEITURA = 'lib/custos-fixos/leitura.ts'
const SIDEBAR = 'components/sidebar/global-sidebar.tsx'

const ler = (p: string) => readFileSync(join(raiz, p), 'utf-8')

describe('⛔⛔ a tela NÃO calcula dinheiro — ela desenha o que o servidor aceitou', () => {
  const src = semComentarios(ler(TELA))

  /**
   * ⚠️⚠️ **REAPONTADO EM 07/10, e ele ficou MAIS FORTE — não afrouxado.**
   *
   * Ele quebrou COM A TELA CERTA: os cartões liam `dados.casaCustaMes` e passaram a ler
   * `cartoes.conta.total`, porque a v2 recalcula ao vivo no toggle dos chips. *Grep não
   * distingue "refatorei" de "quebrei"* — é a razão de existir da REGRA 3.
   *
   * ⭐ A pergunta não mudou (*"a tela faz conta de dinheiro?"*); o que mudou é a resposta
   * honesta: **ela faz UMA conta, chamando a MESMA função pura que o servidor chamou**. Então
   * o guard passou a exigir isso explicitamente — e a proibir aritmética própria, que antes
   * ele nem olhava nos 4 cartões.
   */
  it('⭐ os 4 cartões leem a MESMA função pura do servidor, nunca uma conta local', () => {
    // a lib pura é a fonte: `cartoesDoTopo` é o que o servidor chamou pro 1º paint
    expect(usosDe(src, 'cartoesDoTopo')).toBeGreaterThan(0)
    expect(src).toContain('cartoes!.conta.total')
    expect(src).toContain('cartoes!.porDia.valor')
    expect(src).toContain('cartoes!.equilibrio.porDia')
    expect(src).toContain('cartoes!.afundar.porDia')
    // ⛔ e o rótulo do 1º cartão também sai de lá — digitá-lo aqui seria a 2ª régua
    expect(src).toContain('cartoes!.conta.rotulo')
  })

  it('⛔ nenhuma divisão de dinheiro na tela — margem e por-dia saem da lib', () => {
    // ⚠️ o que mordeu em outras telas foi a tela fazendo a conta "pra ficar mais simples"
    expect(src).not.toMatch(/casaCustaMes\s*\/\s*/)
    // ⭐ 07/10: nem o total dos chips se divide aqui — quem divide é a lib
    expect(src).not.toMatch(/conta\.total\s*\/\s*/)
    expect(src).not.toMatch(/subtotais\.[a-zA-Z]+\s*[+\-*/]/)
    expect(src).not.toMatch(/\/\s*(margem|margemPct|dados\.margem)/)
    expect(src).not.toMatch(/custoFixoDiario/)
  })

  it('⭐ o SELO vem do servidor (`situacao.texto`/`situacao.tom`) — a tela só pinta', () => {
    expect(src).toContain('linha.situacao.texto')
    expect(src).toContain('TOM[linha.situacao.tom]')
    // ⛔ e ela NÃO decide o estado: nenhuma comparação de vencimento aqui
    expect(src).not.toContain('statusDaConta')
    expect(src).not.toMatch(/dueDate/)
  })

  /**
   * ⚠️ **REAPONTADO EM 07/10:** o rodapé deixou de ser UM (da lista única) e passou a ser UM
   * POR PRATELEIRA (`prateleira.planejado`), porque a lista virou duas seções. A régua é a
   * mesma — *o subtotal vem do servidor, nunca de um `reduce` de dinheiro na tela* — e a
   * proibição do `reduce` continua mordendo, que é a metade que importa.
   */
  it('⭐ o subtotal de cada prateleira é o do payload, nunca um `reduce` local de dinheiro', () => {
    expect(src).toContain('prateleira.planejado')
    expect(src).toContain('prateleira.realizado')
    expect(src).toContain('prateleira.pctPago')
    // ⭐ e os compromissos idem: a Σ vem de `lerCompromissos`
    expect(src).toContain('c.somaParcelas')
    expect(src).toContain('c.somaFaturas')
    expect(src).toContain('c.total')
    // ⛔ nenhum `reduce` somando realizado/planejado/valor na tela
    expect(src).not.toMatch(/reduce\([^)]*realizado/)
    expect(src).not.toMatch(/reduce\([^)]*planejado/)
    expect(src).not.toMatch(/reduce\([^)]*valor/)
  })
})

describe('⛔⛔ "a apurar" NUNCA vira R$ 0,00', () => {
  const src = semComentarios(ler(TELA))

  it('⭐ o cartão testa `== null` antes de formatar — e diz "a apurar"', () => {
    expect(src).toMatch(/valor == null \?/)
    expect(src).toContain('a apurar')
  })

  it('⭐ "% pago" sem plano também é "a apurar", não 0%', () => {
    const rodape = src.slice(src.indexOf('% pago'))
    const atePonto = rodape.slice(0, rodape.indexOf('</span>'))
    expect(atePonto).toContain('pctPago == null')
    expect(atePonto, 'sem plano não existe percentual — dividir por nada daria 0%').toContain("'a apurar'")
  })

  it('⭐ Σ planejado idem (agora por prateleira)', () => {
    const i = src.indexOf('Σ planejado')
    const bloco = src.slice(i, i + 400)
    expect(bloco).toContain('prateleira.planejado == null')
    expect(bloco).toContain("'a apurar'")
  })
})

describe('⛔⛔ NADA de bloco de aviso inline (lei de 04/10)', () => {
  const src = semComentarios(ler(TELA))

  it('a tela não monta o bloco de avisos nem fala com a central', () => {
    expect(src).not.toContain('BlocoDeAvisos')
    expect(src).not.toContain('/api/avisos')
    expect(src).not.toContain('registrarAviso')
  })

  it('⭐ e o AVISO existe — no produtor do sininho, setor financeiro', () => {
    // ⚠️ guard que só afirma a ausência aprovaria o dia em que o aviso sumisse de todo lugar
    const prod = ler('lib/avisos/produtores/financeiro.ts')
    expect(prod).toContain("setor: 'financeiro'")
    expect(usosDe(prod, 'registrarAviso')).toBeGreaterThan(0)
    expect(usosDe(prod, 'reconciliarOrigem')).toBeGreaterThan(0)
    // ⛔ e ele NÃO recalcula o par plano×realizado: lê a MESMA função que a tela desenha
    expect(usosDe(prod, 'lerCustosFixos')).toBeGreaterThan(0)
    expect(prod).not.toContain('whereFluxoCaixa')
  })
})

describe('⭐ o realizado tem uma PORTA só', () => {
  const src = semComentarios(ler(LEITURA))

  it('⛔ a leitura do realizado passa pelo `whereFluxoCaixa` — nunca um where próprio', () => {
    expect(usosDe(src, 'whereFluxoCaixa')).toBeGreaterThan(0)
    // ⚠️ o groupBy do realizado não pode montar o recorte na mão
    const i = src.indexOf('groupBy')
    const bloco = src.slice(i, i + 400)
    expect(bloco).toContain('whereFluxoCaixa')
  })

  it('⛔ nenhuma coluna de realizado no schema — decisão se grava, fato se deriva', () => {
    const schema = ler('prisma/schema.prisma')
    const modelo = schema.slice(schema.indexOf('model CustoFixoPlanejado'))
    const corpo = modelo.slice(0, modelo.indexOf('}'))
    expect(corpo).not.toMatch(/realizado/i)
    expect(corpo).toContain('valor')
  })

  it('⭐ o selo reusa o dono de "vencida/vence hoje" do Contas a Pagar (REGRA 4)', () => {
    const sit = ler('lib/custos-fixos/situacao.ts')
    expect(sit).toContain("from '@/lib/contas-pagar/escopo'")
    expect(usosDe(sit, 'statusDaConta')).toBeGreaterThan(0)
    // ⛔ e NÃO existe comparação de data própria aqui
    expect(semComentarios(sit)).not.toMatch(/new Date\(\)\s*[<>]/)
    expect(semComentarios(sit)).not.toContain('inicioDoDiaBrasil(')
  })
})

describe('⛔ formatBRL em TODA moeda — ordem do dono', () => {
  it('⭐ a tela formata com o formatador da casa, nunca com toFixed local', () => {
    const src = semComentarios(ler(TELA))
    expect(usosDe(src, 'formatBRL')).toBeGreaterThan(5)
    expect(src, 'toFixed num valor de dinheiro vira "1751,36" sem o ponto de milhar').not.toMatch(/toFixed\(2\)/)
  })

  it('⭐⭐ e o AVISO também — ele foi pego com `R$ 1751,36` na prova em prod', () => {
    const prod = semComentarios(ler('lib/avisos/produtores/financeiro.ts'))
    expect(usosDe(prod, 'formatBRL')).toBeGreaterThan(0)
    expect(prod).not.toMatch(/toFixed\(2\)/)
  })

  it('⚠️ e a lib de leitura não formata nada — formatar é da TELA', () => {
    const leitura = semComentarios(ler(LEITURA))
    expect(leitura).not.toContain('formatBRL')
  })
})

describe('⭐ a roupa é v4: token, dois temas, zero hex', () => {
  const src = ler(TELA)

  it('⛔ nenhuma cor cravada em hex', () => {
    const hex = semComentarios(src).match(/#[0-9a-fA-F]{6}\b/g) ?? []
    expect(hex, `cor cravada: ${hex.join(', ')}`).toEqual([])
  })

  /**
   * ⚠️ REAPONTADO em 10/10: os cartões viraram SÓLIDOS (opção A do dono — *"cor sólida cheia,
   * número branco"*), então o par mudou de `-bg`/`-ink` pra `-solid`/`-on`/`-on-soft`.
   * A pergunta é a mesma: *a cor vem do TOKEN DA FAMÍLIA, nunca de hex*.
   */
  it('⭐ os cartões de dono pintam pelo par SÓLIDO da família', () => {
    expect(src).toContain('var(--fam-${fam}-solid)')
    expect(src).toContain('var(--fam-${fam}-on)')
    expect(src).toContain('var(--fam-${fam}-on-soft)')
  })

  it('⛔ nenhuma opacidade sobre valor arbitrário — no Tailwind 3 isso sai TRANSPARENTE', () => {
    // ⚠️ a armadilha de 05/10: `bg-[var(--x)]/70` não gera cor nenhuma
    expect(semComentarios(src)).not.toMatch(/\[var\(--[^)]+\)\]\/\d/)
  })

  it('⭐ a sublinha dos cartões é SERIFADA EM ITÁLICO (o padrão v4 do dono)', () => {
    expect(src).toContain('font-serif')
    expect(src).toContain('italic')
  })
})

describe('⭐ o menu e a porta guardada', () => {
  const side = semComentarios(ler(SIDEBAR))

  it('⭐ "Custos fixos" ocupou o lugar de "Recorrentes"', () => {
    expect(side).toContain('label="Custos fixos"')
    expect(side).toContain('custos-fixos')
    expect(side, 'o item do menu saiu').not.toContain('label="Recorrentes"')
  })

  it('⛔ a CAPACIDADE do Recorrentes não morreu — a tela ainda tem porta', () => {
    // ⚠️ remoção sem realocação é perda (10/09): o motor roda, e o link vive no pé da tela
    expect(semComentarios(ler(TELA))).toContain('/recorrentes')
  })
})

describe('⛔⛔ semear SUGERE, nunca decide — "o plano é MEU número"', () => {
  const src = semComentarios(ler(TELA))

  it('⭐⭐ o botão da LINHA só PREENCHE o campo — ele nunca salva', () => {
    // ⚠️ a mesma disciplina do mínimo sugerido do estoque: `setMin(...)`, nunca `salvar()`
    const i = src.indexOf('usar o realizado de')
    const bloco = src.slice(Math.max(0, i - 400), i + 200)
    expect(bloco, 'o botão preenche o estado do campo').toContain('setTxt(')
    expect(bloco, 'e NÃO chama a gravação').not.toContain('aoSalvar(')
  })

  it('⛔ ele só aparece onde FALTA plano e onde há número pra semear', () => {
    expect(src).toContain('valor == null && semente > 0')
  })

  it('⭐ o lote abre a PRÉVIA — o clique nunca grava direto', () => {
    const i = src.indexOf('preencher todos com o realizado')
    const bloco = src.slice(Math.max(0, i - 700), i + 120)
    expect(bloco).toContain("acao: 'SEMEAR'")
    expect(bloco, 'o 1º clique é prévia').toContain('confirmar: false')
  })

  it('⭐⭐ a prévia que a tela desenha vem do SERVIDOR, não de um cálculo local', () => {
    expect(src).toContain('r.data.previa')
    /**
     * ⛔ O PAINEL DESENHA `previa.linhas` — a lista que a GRAVAÇÃO vai executar. Se ele
     * montasse a lista a partir de `dados.linhas`, a tela mostraria um conjunto e o servidor
     * gravaria outro: a cicatriz do preview × confirm do import de OFX (17/08).
     */
    const i = src.indexOf('function PainelDaSemente')
    const painel = src.slice(i)
    expect(painel).toContain('previa.linhas.filter((l) => l.vai)')
    expect(painel, 'o painel não conhece a lista da tela').not.toContain('dados.linhas')
    expect(painel, 'nem o quanto — a soma é a do servidor').toContain('previa.soma')
  })

  /**
   * ⚠️⚠️ **ESTE GUARD VEIO VERDE NA 1ª VERSÃO — "menção, não uso" pela 9ª vez nesta casa.**
   * Ele fazia `toContain('useState(false)')`, e o arquivo tem OUTROS três (`todas`,
   * `abrindoSeletor`, `erro`): repondo o defeito (`useState(true)` no toggle) ele **passava**,
   * porque achava o `useState(false)` do vizinho. O que morde é ancorar na VARIÁVEL.
   */
  it('⛔ o toggle "substituir os que já têm plano" NASCE DESMARCADO', () => {
    expect(src, 'o estado DESTE toggle, não o do vizinho')
      .toContain('const [incluirComPlano, setIncluirComPlano] = useState(false)')
    const i = src.indexOf('substituir também os que já têm plano')
    const bloco = src.slice(Math.max(0, i - 400), i + 80)
    expect(bloco).toContain('checked={incluirComPlano}')
  })

  it('⛔⛔ e o DEFAULT do servidor também é "não substituir" — chamada sem o campo não apaga plano', () => {
    const rota = semComentarios(ler('app/api/empresas/[id]/custos-fixos/route.ts'))
    expect(rota).toContain('incluirComPlano: z.boolean().default(false)')
    expect(rota, 'e a prévia é o default: confirmar precisa ser pedido').toContain('confirmar: z.boolean().default(false)')
  })

  it('⚠️ a referência PARCIAL é dita nas duas pontas (barra e prévia)', () => {
    expect(src).toContain('dados.referenciaEhParcial')
    expect(src).toContain('previa.referenciaEhParcial')
  })

  it('⭐ e quem fica DE FORA aparece com o porquê', () => {
    expect(src).toContain('l.porque')
  })
})

describe('⛔ o seletor mostra o ✓ e busca pela régua da casa', () => {
  const src = semComentarios(ler(TELA))

  it('⭐ ele usa a `casaBusca` — com `includes` cru, "agua" não acha "Água e Esgoto"', () => {
    expect(usosDe(src, 'filtrarPorBusca')).toBeGreaterThan(0)
    expect(src, 'nenhum filtro de busca na mão').not.toMatch(/toLowerCase\(\)\.includes\(/)
  })

  /**
   * ⚠️ **REAPONTADO EM 07/10:** o chip da já-fixa deixou de ser um TOGGLE (um botão que
   * alternava MARCAR/TIRAR) e virou um selo com DOIS gestos — mover de prateleira e tirar —,
   * porque agora existe a pergunta *"em qual prateleira?"*. Um toggle não tem como responder
   * três coisas com um clique.
   *
   * ⭐ A régua que continua mordendo, e é a que importa: **uma porta só de gravação.** Marcar,
   * mover e tirar caem no MESMO `POST` (`MARCAR`/`TIRAR`) que o X da linha usa.
   */
  it('⭐ o ✓ diz ONDE a categoria está, e marcar/mover/tirar caem na MESMA porta', () => {
    expect(src).toContain('c.jaFixa')
    // ⭐ o ✓ carrega a prateleira: sem isso ele esconderia em qual das duas a linha caiu
    expect(src).toContain("c.prateleira === 'BANCO' ? '🏦' : '🏠'")
    const i = src.indexOf('aoMarcar={(c, prateleira)')
    expect(i, 'o seletor marca pela porta única').toBeGreaterThan(-1)
    const bloco = src.slice(i, i + 220)
    expect(bloco, 'marcar passa pelo MESMO POST').toContain("acao: 'MARCAR'")
    expect(bloco, 'e leva a prateleira escolhida').toContain('prateleira')
    const j = src.indexOf('aoTirar={(c)')
    expect(j).toBeGreaterThan(-1)
    expect(src.slice(j, j + 160), 'tirar idem').toContain("acao: 'TIRAR'")
  })

  it('⚠️ o vazio da busca DIZ o recorte, nunca "não encontrado" seco', () => {
    const i = src.indexOf('Nada com «')
    expect(i).toBeGreaterThan(-1)
    expect(src.slice(i, i + 160)).toContain('disponiveis.length')
  })
})

describe('⭐ a tela diz o que não alcança', () => {
  const src = semComentarios(ler(TELA))

  it('⚠️ a lacuna do CARTÃO de crédito aparece quando existe compra no mês', () => {
    expect(src).toContain('dados.comprasNoCartao')
    expect(src).toContain('pagamento de fatura')
  })

  it('⭐ o navegador de mês é o da casa, com a frase OBRIGATÓRIA do recorte', () => {
    expect(src).toContain('<NavegadorDeMes')
    expect(src).toMatch(/frase="[^"]+"/)
  })

  it('⛔ o estado de falha tem NOME e tem botão — spinner eterno não existe', () => {
    expect(src).toContain("'FALHOU'")
    expect(src).toContain('tentar de novo')
    expect(src).toContain('fetchComTimeout')
  })
})
