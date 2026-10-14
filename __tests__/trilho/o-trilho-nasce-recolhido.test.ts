/**
 * ⭐⭐⭐ O TRILHO — HOVER-ONLY E COM ROLAGEM (14/10/2026, substitui a lei de 14/10 manhã).
 *
 * **Ordem do dono, SPRINT TRILHO:**
 *   · *"nao ajuda em nada entao melhor tirar pq so chega com mouse la lista aparece e so sair
 *     lista fica pequena de novo"* → **o «» MORRE**. Só símbolos + cresce no mouse + recolhe ao
 *     sair. **Sem fixar.**
 *   · *"lista aparace ate relatorios so e nao consigo ir para baixou… part de estoque e bancos
 *     para baixou mas nao consigo abrir nada"* → **o trilho ROLA**, nos dois estados.
 *   · a preferência do trilho é **APOSENTADA**: ninguém lê nem grava. **A coluna dorme no banco.**
 *
 * ⚠️⚠️ **METADE DESTES TESTES É ESTRUTURAL, E ISSO ESTÁ ASSUMIDO.** O projeto roda em
 * `environment: node`, sem jsdom — não há como montar o trilho e **passar o mouse** num teste.
 * ⭐ E isso é mais forte do que parece, porque o comportamento É CSS: não existe um `useState`
 * que eu poderia estar testando errado — se as regras estiverem no arquivo, o navegador faz o
 * resto. É o oposto do caso em que o grep aprova um componente que ninguém desenha.
 *
 * ⭐ A prova de que a ÚLTIMA entrada da lista é alcançável é a **navegação em prod** (REGRA 12,
 * 2 estados × 2 viewports) — aqui ficam as quatro regras de CSS que a produzem.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { semComentarios, usosDe } from '../regras-ui/_leitura-de-fonte'

const RAIZ = process.cwd()
const ler = (p: string) => readFileSync(join(RAIZ, p), 'utf8')

const CSS = ler('app/globals.css')
const CSS_LIMPO = semComentarios(CSS)
const SIDEBAR = ler('components/sidebar/global-sidebar.tsx')
const ITEM = ler('components/sidebar/sidebar-item.tsx')
const SHELL = ler('components/layout/dashboard-shell.tsx')
const SERVIDOR = ler('lib/tema/servidor.ts')

/** ⚠️ o CSS do trilho só: evita um seletor de OUTRO bloco responder por este */
const BLOCO_DO_TRILHO = CSS_LIMPO.slice(CSS_LIMPO.indexOf('.trilho {'))

/** varre `app/` + `lib/` + `components/` fora de teste — a pergunta é sobre o APP, não a suíte */
function varrerFontes(): { caminho: string; limpo: string }[] {
  const out: { caminho: string; limpo: string }[] = []
  const anda = (dir: string) => {
    for (const e of readdirSync(join(RAIZ, dir))) {
      const p = `${dir}/${e}`
      if (statSync(join(RAIZ, p)).isDirectory()) {
        if (e === '__tests__' || e === 'node_modules') continue
        anda(p)
      } else if (/\.(ts|tsx)$/.test(e) && !p.includes('__tests__')) {
        out.push({ caminho: p, limpo: semComentarios(readFileSync(join(RAIZ, p), 'utf8')) })
      }
    }
  }
  anda('app')
  anda('lib')
  anda('components')
  return out
}
const FONTES = varrerFontes()

// ───────────────────────── 1 · NASCE RECOLHIDO (E CONTINUA) ─────────────────────────

describe('⛔⛔ o trilho NASCE RECOLHIDO — e agora é o ÚNICO estado possível', () => {
  /**
   * ⭐⭐ A CLASSE VIROU CONSTANTE, e isso é o sprint inteiro numa linha. Antes ela vinha do
   * servidor porque o «» podia ter fixado aberto; sem o «», *"recolhido"* não é mais uma
   * preferência — é o estado em que o trilho vive, e o `:hover` é o único jeito de crescer.
   *
   * ⛔ Deixar a prop viva "por compatibilidade" seria guardar o caminho de um gesto que não
   * existe mais — a cicatriz do `GruposSugeridos` (23/09): *enquanto o componente existe no
   * arquivo, alguém religa*.
   */
  it('⭐⭐ a classe `rec` é CRAVADA no componente, não vem de prop nenhuma', () => {
    const limpo = semComentarios(SIDEBAR)
    expect(limpo, 'o trilho nasce e continua `rec`').toMatch(/className=\{`trilho[^`]*\brec\b/)
    expect(usosDe(SIDEBAR, 'trilhoInicial'), 'a prop do trilho morreu').toBe(0)
    expect(usosDe(SHELL, 'trilhoInicial'), 'o shell não repassa mais nada').toBe(0)
    expect(usosDe(SIDEBAR, 'classeDoTrilho'), 'a régua da classe morreu junto').toBe(0)
  })

  it('⛔ o trilho recolhido tem 64px e o crescido 230px, como a referência manda', () => {
    expect(BLOCO_DO_TRILHO).toMatch(/\.trilho\s*\{[^}]*width:\s*230px/)
    expect(BLOCO_DO_TRILHO).toMatch(/\.trilho\.rec\s*\{[^}]*width:\s*64px/)
  })
})

// ───────────────────────── 2 · O HOVER CRESCE E VOLTA ─────────────────────────

describe('⛔⛔ parou o mouse em cima → CRESCE; tirou → VOLTA', () => {
  /**
   * ⭐ O "VOLTA" NÃO PRECISA DE REGRA PRÓPRIA — e é por isso que o CSS é o caminho certo.
   * `.trilho.rec{width:64px}` + `.trilho.rec:hover{width:230px}`: tirar o mouse remove o
   * `:hover` e a largura volta sozinha. Num `onMouseLeave` o "volta" seria código separado — e
   * código separado é código que alguém esquece (foi assim que o cronômetro do tablet ficou
   * parado em 00:00 por dois dias).
   */
  it('⭐⭐ o crescer é `:hover` no PAI — e o voltar é consequência, não uma 2ª regra', () => {
    expect(BLOCO_DO_TRILHO, 'cresce com o mouse parado em cima').toMatch(
      /\.trilho\.rec:hover\s*\{[^}]*width:\s*230px/,
    )
  })

  it('⭐ e os NOMES aparecem junto (o `:not(:hover)` é o que os esconde)', () => {
    expect(BLOCO_DO_TRILHO).toMatch(/\.trilho\.rec:not\(:hover\)\s*\.rotulo[\s\S]{0,200}display:\s*none/)
  })

  /**
   * ⛔⛔ ZERO JAVASCRIPT NO HOVER. Um `onMouseEnter`/`onMouseLeave` pareceria igual e traria de
   * volta três defeitos que esta casa já pagou: o estado que não acompanha o dedo no toque, o
   * re-render por movimento de mouse, e **a regra morando num `useState`, que é regra que
   * ninguém prova** (a cicatriz do prefill do cardápio, que quebrou 2× antes de virar função).
   */
  it('⛔⛔ nenhum listener de mouse no trilho — o hover é do CSS', () => {
    for (const [nome, src] of Object.entries({ SIDEBAR, ITEM })) {
      expect(semComentarios(src), `${nome} não escuta o mouse`).not.toMatch(
        /onMouseEnter|onMouseLeave|onMouseOver/,
      )
    }
  })

  /** ⚠️ o `transition` é o que separa "cresce" de "salta" — sem ele o menu pisca de largura */
  it('⚠️ a largura TRANSICIONA (0.18s, o número da referência)', () => {
    expect(BLOCO_DO_TRILHO).toMatch(/\.trilho\s*\{[^}]*transition:\s*width\s*0\.18s/)
  })
})

// ───────────────────────── 3 · O «» MORREU ─────────────────────────

/**
 * ⚠️⚠️ **ESTE BLOCO ESTÁ INVERTIDO, COM O MOTIVO ESCRITO — não apagado.** Até a manhã de 14/10
 * ele afirmava *"o «» FIXA aberto"* (alterna os dois estados, liga/desliga a classe, PUT que
 * falha reverte). O dono usou e decidiu o contrário: *"nao ajuda em nada entao melhor tirar pq
 * so chega com mouse"* — o botão só é alcançável depois de o trilho já ter crescido, e aí a
 * lista já está visível. **O que ele resolvia, o hover já resolve.**
 *
 * ⭐ A METADE CERTA DO BLOCO ANTIGO CONTINUA DE PÉ, no bloco 2: *o hover cresce e volta*. Era
 * ela que fazia o «» parecer redundante, e é ela que fica.
 */
describe('⛔⛔ o «» MORREU — e morreu do ARQUIVO, não de um `if`', () => {
  it('⛔⛔ o componente do «» não existe mais', () => {
    expect(
      existsSync(join(RAIZ, 'components/sidebar/botao-recolher.tsx')),
      'botão desligado continua sendo botão que alguém religa (a cicatriz do GruposSugeridos)',
    ).toBe(false)
  })

  it('⛔ nenhuma tela desenha o «» nem importa a régua dele', () => {
    const culpados = FONTES.filter(
      (f) => /BotaoRecolher|botao-recolher|alternarTrilho|caraDoRecolher|classeDoTrilho/.test(f.limpo),
    )
    expect(culpados.map((c) => c.caminho), 'o «» não voltou por nenhuma porta').toEqual([])
  })

  it('⛔ e o CSS dele saiu junto — regra órfã é o convite pra redesenhar o botão', () => {
    expect(BLOCO_DO_TRILHO, 'o `.recolhe` não existe mais').not.toMatch(/\.recolhe\b/)
  })
})

// ───────────────────────── 4 · A PREFERÊNCIA DO TRILHO FOI APOSENTADA ─────────────────────────

/**
 * ⚠️⚠️ **INVERTIDO COM O MOTIVO ESCRITO.** O bloco antigo exigia que a preferência do trilho
 * *persistisse por usuário pela porta única*. Sem o «», **não há escolha a persistir** — e
 * preferência que ninguém decide é coluna que só envelhece.
 *
 * ⭐⭐ A METADE QUE FICA É A PORTA: `user_tema_preferencia` continua com **UM escritor só**, e
 * agora ele é o do TEMA. O guard é o mesmo; o que mudou é o que passa por ele.
 *
 * ⛔⛔ **E A COLUNA DORME NO BANCO — ordem do dono (*"NADA de ALTER, o guard manda"*).** Ela
 * segue com `NOT NULL DEFAULT 'recolhido'` e com o CHECK de forma; o que acabou foi o
 * LEITOR e o ESCRITOR. Apagar a coluna exigiria um ALTER numa tabela com dado real, e migration
 * aplicada não se reescreve.
 */
describe('⛔⛔ a preferência do TRILHO foi APOSENTADA (a do TEMA segue intacta)', () => {
  /**
   * ⚠️ `lerPreferenciaDeTela` NÃO entra nesta lista: ela sobreviveu como a leitora do TEMA (o
   * nome é histórico, e renomear por estética é como link antigo vira 404 — a disciplina do
   * redirect de `/pendentes`). O que o guard persegue é quem toca a preferência do TRILHO.
   */
  it('⛔⛔ ninguém no app LÊ nem GRAVA o trilho — nem a régua, nem a rota, nem a porta', () => {
    const leitores = FONTES.filter((f) =>
      /salvarTrilho|normalizarTrilho|classeDoTrilho|TRILHO_PADRAO|TRILHOS\b|\/api\/trilho|trilho:\s*(true|normalizar)/.test(
        f.limpo,
      ),
    )
    expect(leitores.map((l) => l.caminho), 'a preferência do trilho não tem leitor nem escritor').toEqual([])
  })

  it('⛔ a régua pura e a rota deixaram de existir', () => {
    expect(existsSync(join(RAIZ, 'lib/trilho/preferencia.ts')), 'a régua do trilho morreu').toBe(false)
    expect(existsSync(join(RAIZ, 'app/api/trilho/route.ts')), 'a rota do trilho morreu').toBe(false)
  })

  /**
   * ⛔⛔⛔ A PORTA É UMA, E ESTE É O TESTE QUE TORNA ISSO VERDADE. Um segundo `upsert` em
   * qualquer rota seria a 2ª porta pro mesmo fato — a doença dos 7 detectores de par.
   */
  it('⛔⛔ EXATAMENTE UM arquivo escreve em `user_tema_preferencia`', () => {
    const escritores = FONTES.filter((f) =>
      /userTemaPreferencia\.(upsert|update|create|updateMany|createMany|delete)/.test(f.limpo),
    ).map((f) => f.caminho)
    expect(escritores, `a escrita é de UM lugar só: ${escritores.join(', ')}`).toEqual([
      'lib/tema/servidor.ts',
    ])
  })

  it('⭐ a rota do TEMA segue CASCA sobre a porta — não toca o Prisma', () => {
    const limpo = semComentarios(ler('app/api/tema/route.ts'))
    expect(limpo, 'não fala com o banco').not.toMatch(/prisma\./)
    expect(limpo, 'delega pra porta').toMatch(/from '@\/lib\/tema\/servidor'/)
  })

  /**
   * ⛔ A COLUNA DORME — e o guard afirma isso em vez de prometer. A migration que a criou fica
   * de pé (nada de ALTER) e o CHECK corrigido em 14/10 segue mordendo; o que não existe mais é
   * alguém escrevendo nela.
   */
  it('⛔ a coluna `trilho` continua no banco, dormindo (ZERO ALTER neste sprint)', () => {
    const sql = ler('prisma/migrations/20261014140000_user_trilho_preferencia/migration.sql')
      .replace(/^\s*--.*$/gm, '')
    expect(sql, 'a coluna segue como nasceu').toMatch(
      /ADD COLUMN "trilho" TEXT NOT NULL DEFAULT 'recolhido'/,
    )
    const novas = readdirSync(join(RAIZ, 'prisma/migrations')).filter((d) => /trilho/i.test(d))
    expect(novas, 'nenhuma migration nova de trilho — a coluna dorme').toEqual([
      '20261014140000_user_trilho_preferencia',
    ])
  })

  /** ⚠️ `userId` é a PK: duas preferências pro mesmo usuário é IMPOSSÍVEL, não checado (REGRA 5) */
  it('⭐ é POR USUÁRIO por construção — `userId` é a chave primária', () => {
    const schema = ler('prisma/schema.prisma')
    const bloco = schema.slice(schema.indexOf('model UserTemaPreferencia'))
    expect(bloco.slice(0, bloco.indexOf('}'))).toMatch(/userId\s+String\s+@id/)
    expect(semComentarios(SERVIDOR)).toMatch(/upsert\(\{\s*where:\s*\{\s*userId\s*\}/)
  })

  /**
   * ⛔ NUNCA localStorage — a régua de 04/10, e o motivo é medido: o dono confere no celular E no
   * notebook, e localStorage é por NAVEGADOR. A escolha feita num aparelho sumiria no outro.
   */
  it('⛔ a escolha do TEMA NUNCA vai pro navegador', () => {
    for (const [nome, src] of Object.entries({ SIDEBAR, SHELL })) {
      expect(semComentarios(src), `${nome} não guarda preferência no navegador`).not.toMatch(
        /localStorage|sessionStorage/,
      )
    }
  })
})

// ───────────────────────── 5 · O BADGE NO RECOLHIDO ─────────────────────────

describe('⛔⛔ o badge do Contas a Pagar é VISÍVEL no recolhido', () => {
  /**
   * ⛔⛔ Sem a regra, o badge é o último filho de um item de 64px com `justify-content:center` e
   * **sai do campo visível**: o número que existe pra ser visto desapareceria justamente no
   * estado em que o trilho vive.
   */
  it('⛔⛔ no recolhido o badge vira MINI SOBRE O ÍCONE (absoluto no canto)', () => {
    const regra = BLOCO_DO_TRILHO.match(/\.trilho\.rec:not\(:hover\)\s*\.badge\s*\{([^}]*)\}/)
    expect(regra, 'a regra do badge mini existe').toBeTruthy()
    const corpo = regra![1]
    expect(corpo, 'posicionado sobre o ícone').toMatch(/position:\s*absolute/)
    expect(corpo, 'no canto de cima').toMatch(/top:/)
    expect(corpo, 'à direita').toMatch(/right:/)
    expect(corpo, 'menor, pra caber em 64px').toMatch(/font-size:\s*9px/)
  })

  /** ⚠️ `position:absolute` só ancora se o item for `relative` — sem isto o badge iria pro canto da PÁGINA */
  it('⚠️ e o item vira a âncora (`position:relative`) — senão o mini vai pro canto da tela', () => {
    const regra = BLOCO_DO_TRILHO.match(/\.trilho\.rec:not\(:hover\)\s*\.item\s*\{([^}]*)\}/)
    expect(regra).toBeTruthy()
    expect(regra![1]).toMatch(/position:\s*relative/)
  })

  /**
   * ⛔ O BADGE NÃO PODE SER `.rotulo`. Se ele fosse, o `display:none` dos nomes o levaria junto
   * — o badge sumiria no recolhido e a regra acima nunca teria chance de valer.
   */
  it('⛔ o badge é `.badge`, fora do `.rotulo` que some', () => {
    const limpo = semComentarios(ITEM)
    expect(limpo).toMatch(/className="badge"/)
    const linhaBadge = limpo.slice(limpo.indexOf('className="badge"') - 200, limpo.indexOf('className="badge"'))
    expect(linhaBadge, 'o badge não está dentro de um `.rotulo`').not.toMatch(/className="rotulo[^"]*"[^<]*$/)
  })

  /** ⚠️ no recolhido o badge é um número de 9px sem rótulo — sem o `title`, `22` não diz 22 DE QUÊ */
  it('⚠️ e ele DIZ de que é, porque no recolhido não há nome do lado', () => {
    expect(semComentarios(ITEM)).toMatch(/title=\{`\$\{label\}: \$\{badge\}`\}/)
  })

  it('⭐ o badge usa o CORAL de token (vermelho vivo), nunca hex', () => {
    const regra = BLOCO_DO_TRILHO.match(/\.trilho\s*\.item\s*\.badge\s*\{([^}]*)\}/)
    expect(regra).toBeTruthy()
    expect(regra![1]).toMatch(/background:\s*var\(--prod-coral\)/)
  })
})

// ───────────────────────── 6 · O TRILHO ROLA ─────────────────────────

/**
 * ⭐⭐⭐ O DEFEITO, nas palavras do dono: *"lista aparace ate relatorios so e nao consigo ir
 * para baixou… part de estoque e bancos para baixou mas nao consigo abrir nada"*.
 *
 * ⛔⛔ **A CAUSA MEDIDA, e ela é de ALTURA, não de `overflow`:** o `.trilho` já tinha
 * `overflow-y:auto`, e **com altura `auto` isso não faz nada**. O wrapper do shell
 * (`hidden md:block shrink-0`) não dava altura definida, então o nav crescia com os 51 itens
 * ALÉM da viewport e o estouro era cortado pelo `overflow-hidden` do pai. *Scroll só existe
 * quando há altura pra estourar.*
 *
 * ⚠️ **E ESTA REGRA ENTRA NA REFERÊNCIA (o buraco era meu):** `docs/cara-do-sistema-referencia.html`
 * descrevia o trilho sem dizer que a lista rola — o teste da referência confere isso.
 */
describe('⛔⛔ o trilho ROLA na vertical, nos DOIS estados', () => {
  const regraDo = (sel: string) => {
    const m = BLOCO_DO_TRILHO.match(new RegExp(`${sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\{([^}]*)\\}`))
    return m?.[1] ?? null
  }

  /**
   * ⛔ O NAV NÃO ROLA: ele é a MOLDURA de altura fixa. Se o `overflow-y:auto` ficasse nele, a
   * LOGOMARCA rolaria junto e o dono perderia a âncora que diz *"esta coluna de 64px é o menu"*.
   */
  it('⛔⛔ o `.trilho` tem ALTURA (é o que faz o scroll existir) e NÃO rola ele mesmo', () => {
    const corpo = regraDo('.trilho')
    expect(corpo, 'o bloco do trilho existe').toBeTruthy()
    expect(corpo, 'altura definida — sem ela o nav cresce além da tela e o estouro é cortado')
      .toMatch(/height:\s*100%/)
    expect(corpo, 'a moldura não rola; quem rola é a lista').toMatch(/overflow:\s*hidden/)
    expect(corpo, 'e o `overflow-y:auto` do nav MORREU — era ele que não fazia nada')
      .not.toMatch(/overflow-y:\s*auto/)
  })

  it('⭐ o WRAPPER do desktop dá a altura (flex, pra o nav esticar)', () => {
    expect(semComentarios(SHELL), 'o wrapper vira flex pro trilho esticar nele').toMatch(
      /hidden md:flex shrink-0/,
    )
  })

  it('⭐ a LOGOMARCA fica fixa no topo (`flex:none`) e a lista rola embaixo dela', () => {
    expect(regraDo('.trilho .logo'), 'o logo não encolhe nem rola').toMatch(/flex:\s*none/)
  })

  it('⛔⛔ a LISTA é quem rola — `flex:1` + `min-height:0` + `overflow-y:auto`', () => {
    const corpo = regraDo('.trilho .lista')
    expect(corpo, 'a lista tem regra própria').toBeTruthy()
    expect(corpo, 'ocupa o que sobra').toMatch(/flex:\s*1/)
    /**
     * ⛔⛔ O `min-height:0` É O QUE FAZ O SCROLL EXISTIR num filho de flex: sem ele o
     * `min-height:auto` do flex item impede o encolhimento, a lista fica do tamanho do
     * conteúdo e o `overflow-y:auto` **volta a não fazer nada** — o defeito de hoje, um nível
     * abaixo.
     */
    expect(corpo, 'e pode encolher — senão o overflow não ativa').toMatch(/min-height:\s*0/)
    expect(corpo, 'rola na vertical').toMatch(/overflow-y:\s*auto/)
    expect(corpo, 'e nunca na horizontal — o rótulo escondido não vira barra lateral')
      .toMatch(/overflow-x:\s*hidden/)
  })

  it('⭐ a TELA aplica a classe na lista, dentro do nav (é o que mantém o hover do pai)', () => {
    const limpo = semComentarios(SIDEBAR)
    expect(limpo, 'o container da lista ganhou a classe').toMatch(/className="lista/)
    const nav = limpo.indexOf('className={`trilho')
    const lista = limpo.indexOf('className="lista')
    expect(nav, 'o nav existe').toBeGreaterThan(-1)
    expect(lista, 'a lista vem DEPOIS do nav — ela é filha, e o `:hover` é no PAI')
      .toBeGreaterThan(nav)
  })

  /**
   * ⛔⛔ A ROLAGEM NÃO PODE QUEBRAR O CRESCE-NO-MOUSE — é o vermelho que o dono nomeou. Quem
   * rola é a LISTA (filha); o `:hover` que cresce é no `.trilho` (pai). Pôr o scroll no pai
   * faria a barra aparecer na borda da coluna de 64px e, pior, o ponteiro sobre a barra
   * continuaria dentro do pai — mas a moldura passaria a rolar junto da lista, levando o logo.
   */
  it('⛔⛔ a rolagem NÃO quebra o hover: quem cresce é o PAI, quem rola é a FILHA', () => {
    expect(BLOCO_DO_TRILHO, 'o hover que cresce segue no pai').toMatch(
      /\.trilho\.rec:hover\s*\{[^}]*width:\s*230px/,
    )
    /**
     * ⚠️ O `(?<![-\w])` NÃO É PRECIOSISMO: a 1ª versão proibia `/width:/` solto e deu **FALSO
     * VERMELHO contra o CSS CERTO** — mordeu o `scrollbar-width: thin`, que é a ESPESSURA DA
     * BARRA e é literalmente o pedido do dono (*"barra discreta"*). O defeito que mata o hover
     * tem forma própria: a largura DO ELEMENTO.
     */
    const corpoLista = regraDo('.trilho .lista') ?? ''
    expect(corpoLista, 'a lista não mexe na largura DELA — largura é decisão do pai').not.toMatch(
      /(?<![-\w])width:/,
    )
  })

  /**
   * ⭐ A BARRA É DISCRETA E DE TOKEN (estilo da casa). Hex cravado aqui ficaria claro demais no
   * tema escuro do trilho, que é escuro NOS DOIS temas.
   */
  it('⭐ a barra de rolagem é fina e pintada por TOKEN, nunca hex', () => {
    const webkit = BLOCO_DO_TRILHO.match(/\.trilho \.lista::-webkit-scrollbar\s*\{([^}]*)\}/)
    expect(webkit, 'a barra webkit tem regra').toBeTruthy()
    expect(webkit![1], 'fina').toMatch(/width:\s*6px/)
    const thumb = BLOCO_DO_TRILHO.match(/\.trilho \.lista::-webkit-scrollbar-thumb\s*\{([^}]*)\}/)
    expect(thumb, 'o polegar tem regra').toBeTruthy()
    expect(thumb![1], 'pintado por token').toMatch(/var\(--prod-trilho-borda\)/)
    expect(thumb![1], 'nenhum hex cravado').not.toMatch(/#[0-9a-f]{3,8}\b/i)
    const corpoLista = regraDo('.trilho .lista') ?? ''
    expect(corpoLista, 'e o Firefox também — `scrollbar-width` é o caminho dele').toMatch(
      /scrollbar-width:\s*thin/,
    )
  })

  /**
   * ⛔ A GAVETA ROLA PELA MESMA REGRA — uma composição, não duas. Se a gaveta tivesse o próprio
   * `overflow`, ela divergiria no 1º ajuste, e o celular é justamente onde a lista não cabe.
   */
  /**
   * ⚠️ **A ASSERÇÃO É DO CORPO DA REGRA DA GAVETA, não de uma fatia do arquivo — e a 1ª versão
   * deu FALSO VERMELHO contra o CSS CERTO.** Ela varria tudo a partir de `.trilho.gaveta` e
   * mordeu o `height: auto` do `.trilho.gaveta.rec:not(:hover) .kicker`, que é o KICKER virando
   * rótulo de texto na gaveta — descendente, legítimo, nada a ver com a altura do nav. *Janela
   * de distância já produziu falso vermelho nesta casa 8 vezes.*
   */
  it('⛔ a gaveta do celular rola pela MESMA regra (nenhum override de altura/overflow)', () => {
    const corpo = BLOCO_DO_TRILHO.match(/\.trilho\.gaveta,\s*\n?\.trilho\.gaveta\.rec\s*\{([^}]*)\}/)
    expect(corpo, 'a regra da gaveta existe').toBeTruthy()
    expect(corpo![1], 'a gaveta não desliga a altura do nav').not.toMatch(/height:/)
    expect(corpo![1], 'nem o overflow').not.toMatch(/overflow/)
  })
})

// ───────────────── 6b · A REFERÊNCIA DIZ A MESMA LEI ─────────────────

/**
 * ⭐⭐ **A REFERÊNCIA É A LEI VISUAL, ENTÃO ELA TEM QUE DIZER A LEI — e o buraco era MEU.**
 * `docs/cara-do-sistema-referencia.html` descrevia o trilho sem uma palavra sobre a lista rolar,
 * e foi por isso que o defeito nasceu "dentro da lei": eu copiei o arquivo 1:1 e o arquivo não
 * previa altura de tela nenhuma. ⚠️ Agora a regra está escrita LÁ (L1b), e este guard é de
 * **dois lados** — se a referência perder a regra, ou se a tela divergir dela, fica vermelho.
 */
describe('⛔ a REFERÊNCIA carrega a lei nova (o «» fora, a rolagem dentro)', () => {
  const REF = ler('docs/cara-do-sistema-referencia.html')

  it('⛔ o «» não existe mais na referência — nem no CSS, nem no HTML, nem na lei L1', () => {
    expect(REF, 'o botão e o CSS dele saíram').not.toMatch(/\brecolhe\b/)
    expect(REF, 'e a lei L1 não promete mais fixar').not.toMatch(/«»\s*FIXA|FIXA aberto/)
  })

  /**
   * ⚠️⚠️ **A ASSERÇÃO LÊ O BLOCO DAS LEIS, NÃO O ARQUIVO — e a 1ª versão veio VERDE com a lei
   * arrancada.** Ela fazia `toMatch(/L1b/)` no arquivo inteiro, e o rótulo `L1b` também aparece
   * em **três comentários de CSS/HTML** que eu mesmo escrevi apontando pra a regra. *"Menção, não
   * uso"* pela 17ª vez nesta casa — e aqui a menção era a MINHA documentação absolvendo a
   * ausência da lei. O que morde é ler o bloco `AS 7 LEIS DA CARA`, que é onde a LEI mora.
   */
  it('⭐⭐ a REGRA DA ROLAGEM está escrita na referência (L1b)', () => {
    const leis = REF.slice(REF.indexOf('AS 7 LEIS DA CARA'), REF.indexOf('L2.'))
    expect(leis, 'a LEI nomeia a rolagem (não só um comentário de CSS)').toMatch(/L1b\./)
    expect(leis, 'e diz que o logo fica e a lista rola').toMatch(/LOGOMARCA fica FIXA/i)
    expect(leis, 'e que TODOS os grupos são alcançáveis').toMatch(/alcançáveis em qualquer altura/i)
    expect(leis, 'e que a rolagem não quebra o cresce-no-mouse').toMatch(
      /quem cresce é o PAI, quem rola é\s+a FILHA/i,
    )
    expect(REF, 'a referência declara a regra da lista').toMatch(
      /\.lista\s*\{[^}]*overflow-y:\s*auto/,
    )
    expect(REF, 'inclusive o min-height, que é o que faz o overflow existir').toMatch(
      /\.lista\s*\{[^}]*min-height:\s*0/,
    )
  })

  /**
   * ⛔⛔ **A REFERÊNCIA PRECISA DE LISTA MAIS ALTA QUE A TELA, senão ela não demonstra o que
   * declara.** Antes ela tinha 2 grupos; o trilho de prod tem 3+ e 51 itens. Uma referência que
   * cabe na tela "prova" a rolagem por ausência de conteúdo — é o invariante circular de 28/08
   * em forma de mock.
   */
  it('⛔ e a referência DEMONSTRA: a lista dela tem BANCOS, o grupo que o dono não alcançava', () => {
    expect(REF, 'o 3º grupo existe no mock').toMatch(/BANCOS/)
    const kickers = [...REF.matchAll(/class="kicker">([^<]+)</g)].map((m) => m[1])
    expect(kickers.length, `grupos no trilho da referência: ${kickers.join(' · ')}`)
      .toBeGreaterThanOrEqual(3)
  })
})

// ───────────────────────── 7 · A GAVETA E A MARCA ─────────────────────────

describe('⭐ a gaveta do celular e a logomarca', () => {
  /**
   * ⛔⛔ NA GAVETA O TRILHO É SEMPRE ABERTO — e não é preferência ignorada, é o `:hover` NÃO
   * EXISTIR no toque. Recolhido num celular seriam 64px de ícones sem rótulo e **sem gesto
   * nenhum que mostrasse os nomes** — a "porta sem maçaneta" em forma de menu.
   */
  it('⛔⛔ a gaveta nasce ABERTA — no toque não existe hover', () => {
    expect(usosDe(SHELL, 'naGaveta'), 'o shell marca a gaveta').toBeGreaterThanOrEqual(1)
    expect(semComentarios(SIDEBAR), 'e o trilho vira `.gaveta`').toMatch(/naGaveta \? ' gaveta'/)
    const gaveta = BLOCO_DO_TRILHO.slice(BLOCO_DO_TRILHO.indexOf('.trilho.gaveta'))
    expect(gaveta, 'largura cheia mesmo com `rec`').toMatch(/width:\s*100%/)
    expect(gaveta, 'e os nomes voltam').toMatch(/display:\s*revert/)
  })

  it('⭐ a logomarca em GRADIENTE, com os dois tons de token', () => {
    const marca = BLOCO_DO_TRILHO.match(/\.trilho \.logo \.marca\s*\{([^}]*)\}/)
    expect(marca).toBeTruthy()
    expect(marca![1]).toMatch(/linear-gradient\(135deg,\s*var\(--prod-trilho-pilula\),\s*var\(--prod-acao-quente\)\)/)
  })

  it('⚠️ no recolhido o nome some e a MARCA fica', () => {
    expect(BLOCO_DO_TRILHO).toMatch(
      /\.trilho\.rec:not\(:hover\)\s*\.logo\s*\.nome[\s\S]{0,200}display:\s*none/,
    )
    expect(semComentarios(SIDEBAR), 'a marca não é `.rotulo` nem `.nome`').toMatch(
      /className="marca"/,
    )
  })

  /** ⚠️ a classe é `.on` — eu havia escrito `.ativo` de cabeça e o teste nasceu vermelho contra o CSS certo */
  it('⭐ a PÍLULA cheia no item ativo (L1)', () => {
    const ativo = BLOCO_DO_TRILHO.match(/\.trilho \.item\.on\s*\{([^}]*)\}/)
    expect(ativo).toBeTruthy()
    expect(ativo![1]).toMatch(/background:\s*var\(--prod-trilho-pilula\)/)
  })
})

// ───────────────────────── 8 · É ROUPA ─────────────────────────

describe('⭐⭐ é ROUPA: a lógica do menu segue intacta', () => {
  it('⭐ o item continua exigindo `perm`, e esconde quem não tem', () => {
    const limpo = semComentarios(ITEM)
    expect(limpo).toMatch(/perm:\s*string/)
    expect(limpo).toMatch(/podeVer|permissoes/)
  })

  it('⭐ o choke-point que esconde o menu da empresa no PF segue de pé', () => {
    expect(semComentarios(SIDEBAR)).toMatch(/workspaceType === 'pf' \? null : currentEmpresaId/)
  })

  it('⭐ e o `isComingSoon` continua sendo item SEM destino (não virou link)', () => {
    expect(semComentarios(ITEM)).toMatch(/isComingSoon/)
  })
})
