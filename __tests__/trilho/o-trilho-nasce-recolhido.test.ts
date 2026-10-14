/**
 * ⭐⭐⭐ O TRILHO — OS VERMELHOS QUE O DONO LISTOU (14/10/2026).
 *
 * **Ordem dele, FRENTE B + a seção TESTE do brief:**
 *   · *"trilho não nasce recolhido = vermelho"*
 *   · *"hover não cresce/não volta = vermelho"*
 *   · *"«» não fixa = vermelho"*
 *   · *"preferência não persiste por usuário ou gravada fora da porta única = vermelho"*
 *   · *"badge do Contas a Pagar invisível no recolhido = vermelho"*
 *
 * ⚠️⚠️ **METADE DESTES TESTES É ESTRUTURAL, E ISSO ESTÁ ASSUMIDO.** O projeto roda em
 * `environment: node`, sem jsdom — não há como montar o trilho e **passar o mouse** num teste.
 * O que dá pra provar por EXECUÇÃO é a régua pura (`lib/trilho/preferencia.ts`) e a porta de
 * escrita; o comportamento de hover vive em CSS, e ali o teste lê o `globals.css` e exige as
 * regras que o produzem. ⭐ **E isso é mais forte do que parece, porque o comportamento É CSS:**
 * não existe um `useState` que eu poderia estar testando errado — se as 4 regras de descendente
 * estiverem no arquivo, o navegador faz o resto. É o oposto do caso em que o grep aprova um
 * componente que ninguém desenha.
 *
 * ⛔ REGRA 11 medida: `scratchpad/regra11-trilho.py` repõe cada defeito e conta o vermelho.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  TRILHOS,
  TRILHO_PADRAO,
  normalizarTrilho,
  classeDoTrilho,
  alternarTrilho,
  caraDoRecolher,
} from '@/lib/trilho/preferencia'
import { semComentarios, usosDe } from '../regras-ui/_leitura-de-fonte'

const RAIZ = process.cwd()
const ler = (p: string) => readFileSync(join(RAIZ, p), 'utf8')

const CSS = ler('app/globals.css')
const CSS_LIMPO = semComentarios(CSS)
const SIDEBAR = ler('components/sidebar/global-sidebar.tsx')
const ITEM = ler('components/sidebar/sidebar-item.tsx')
const BOTAO = ler('components/sidebar/botao-recolher.tsx')
const SHELL = ler('components/layout/dashboard-shell.tsx')
const SERVIDOR = ler('lib/tema/servidor.ts')

/** ⚠️ o CSS do trilho só: evita um seletor de OUTRO bloco responder por este */
const BLOCO_DO_TRILHO = CSS_LIMPO.slice(CSS_LIMPO.indexOf('.trilho {'))

// ───────────────────────── 1 · NASCE RECOLHIDO ─────────────────────────

describe('⛔⛔ o trilho NASCE RECOLHIDO', () => {
  it('⭐ o default da régua é `recolhido` — e vale pra ausência E pra lixo', () => {
    expect(TRILHO_PADRAO).toBe('recolhido')
    expect(normalizarTrilho(undefined)).toBe('recolhido')
    expect(normalizarTrilho(null)).toBe('recolhido')
    expect(normalizarTrilho('')).toBe('recolhido')
    expect(normalizarTrilho('gaveta')).toBe('recolhido')
    expect(normalizarTrilho(42)).toBe('recolhido')
  })

  it('⭐ e aceita o que o banco grava, em qualquer caixa/espaço', () => {
    expect(normalizarTrilho('aberto')).toBe('aberto')
    expect(normalizarTrilho(' ABERTO ')).toBe('aberto')
    expect(normalizarTrilho('Recolhido')).toBe('recolhido')
  })

  /**
   * ⛔ O DEFAULT DO BANCO TEM QUE CONCORDAR COM O DA RÉGUA. Se a coluna nascesse `'aberto'`, o
   * usuário que já tinha linha (quem escolheu tema antes de hoje) veria o trilho ABERTO e o
   * usuário novo veria RECOLHIDO — **dois defaults pro mesmo estado**, e a diferença só
   * apareceria pra metade das pessoas.
   */
  it('⛔ o DEFAULT da coluna no banco é o MESMO da régua', () => {
    const sql = ler('prisma/migrations/20261014140000_user_trilho_preferencia/migration.sql')
      .replace(/^\s*--.*$/gm, '')
    expect(sql).toMatch(/ADD COLUMN "trilho" TEXT NOT NULL DEFAULT 'recolhido'/)
    const schema = ler('prisma/schema.prisma')
    expect(schema).toMatch(/trilho\s+String\s+@default\("recolhido"\)/)
  })

  it('⭐ a classe do recolhido é `rec` (a da referência), e o aberto não tem classe', () => {
    expect(classeDoTrilho('recolhido')).toBe('rec')
    expect(classeDoTrilho('aberto')).toBe('')
  })

  /** ⛔ sem isto o menu nasceria em 230px e encolheria pra 64px na frente do dono */
  it('⛔⛔ a classe vem do SERVIDOR (prop), nunca de um `useState` com default', () => {
    expect(usosDe(SIDEBAR, 'trilhoInicial'), 'a prop é recebida e usada').toBeGreaterThanOrEqual(2)
    expect(semComentarios(SIDEBAR)).toMatch(/classeDoTrilho\(trilhoInicial\)/)
    expect(usosDe(SHELL, 'trilhoInicial'), 'o shell repassa o que veio do layout').toBeGreaterThanOrEqual(1)
    const layout = semComentarios(ler('app/(dashboard)/layout.tsx'))
    expect(layout, 'o layout resolve o trilho no servidor').toMatch(/trilho/)
  })

  it('⛔ o trilho recolhido tem 64px e o aberto 230px, como a referência manda', () => {
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
    const fontes = { SIDEBAR, ITEM, BOTAO }
    for (const [nome, src] of Object.entries(fontes)) {
      const limpo = semComentarios(src)
      expect(limpo, `${nome} não escuta o mouse`).not.toMatch(/onMouseEnter|onMouseLeave|onMouseOver/)
    }
  })

  /** ⚠️ o `transition` é o que separa "cresce" de "salta" — sem ele o menu pisca de largura */
  it('⚠️ a largura TRANSICIONA (0.18s, o número da referência)', () => {
    expect(BLOCO_DO_TRILHO).toMatch(/\.trilho\s*\{[^}]*transition:\s*width\s*0\.18s/)
  })
})

// ───────────────────────── 3 · O «» FIXA ─────────────────────────

describe('⛔⛔ o «» FIXA aberto', () => {
  it('⭐ ele alterna entre os DOIS estados — e "crescido por hover" não é um deles', () => {
    expect(alternarTrilho('recolhido')).toBe('aberto')
    expect(alternarTrilho('aberto')).toBe('recolhido')
    expect([...TRILHOS], 'dois estados, nunca três').toEqual(['recolhido', 'aberto'])
  })

  /**
   * ⛔⛔ ELE MEXE NA CLASSE, NUNCA NA LARGURA. Guardar a largura num estado e aplicá-la por
   * inline style pareceria igual e **mataria o hover de graça**: `:hover` não vence inline
   * style, e o *"parou o mouse em cima → cresce"* — que é o pedido central — deixaria de
   * funcionar sem nada quebrar nem aparecer em teste de página.
   */
  it('⛔⛔ o «» liga/desliga a CLASSE `rec`, nunca escreve largura', () => {
    const limpo = semComentarios(BOTAO)
    expect(limpo).toMatch(/classList\.(add|remove)\('rec'\)/)
    /**
     * ⚠️ A ASSERÇÃO É ESTREITA DE PROPÓSITO — a 1ª versão proibia `/width\s*[:=]/` no arquivo e
     * deu **FALSO VERMELHO contra o código CERTO**: ela mordeu o `width="15"` do `<svg>`, que é
     * o tamanho do ÍCONE. O defeito que importa tem forma própria — escrever largura por STYLE
     * ou mexer em `style.width` —, e é só isso que mata o `:hover`.
     */
    expect(limpo, 'nenhum style inline de largura').not.toMatch(/style=\{\{[^}]*width/)
    expect(limpo, 'ninguém mexe em style.width').not.toMatch(/style\.width/)
    expect(limpo, 'nenhuma largura em CSS-in-JS').not.toMatch(/width:\s*['"`]?\d+(px|rem|%)/)
  })

  it('⭐ o botão anuncia PRA ONDE o toque leva, e por escrito', () => {
    expect(caraDoRecolher('recolhido').titulo).toMatch(/fixar aberto/i)
    expect(caraDoRecolher('recolhido').gira).toBe(true)
    expect(caraDoRecolher('aberto').titulo).toMatch(/recolher/i)
    expect(caraDoRecolher('aberto').gira).toBe(false)
    const limpo = semComentarios(BOTAO)
    expect(limpo, 'o título vai pro title E pro aria-label — ícone sozinho ensina pela metade')
      .toMatch(/title=\{cara\.titulo\}/)
    expect(limpo).toMatch(/aria-label=\{cara\.titulo\}/)
  })

  /**
   * ⚠️ O TRILHO É DESENHADO DUAS VEZES (barra do desktop + gaveta do celular, uma escondida por
   * CSS). Sem o anúncio, fixar aberto no desktop deixaria o «» da gaveta com a seta girada pro
   * lado ERRADO — invisível hoje, visível no instante em que a janela for redimensionada. É a
   * mesma cura do `tema:mudou`.
   */
  it('⚠️ a troca ANUNCIA, pras duas instâncias nunca divergirem', () => {
    const limpo = semComentarios(BOTAO)
    expect(limpo).toMatch(/dispatchEvent\(new CustomEvent<Trilho>\('trilho:mudou'/)
    expect(limpo).toMatch(/addEventListener\('trilho:mudou'/)
  })

  /** ⛔ gravação que falha em silêncio é o *"salvo que mentia"* — o estado VOLTA, com o motivo */
  it('⛔⛔ PUT que falha REVERTE a largura e DIZ o motivo', () => {
    const limpo = semComentarios(BOTAO)
    expect(limpo, 'reverte pro estado anterior').toMatch(/aplicarTrilho\(anterior\)/)
    expect(limpo, 'e mostra o motivo na tela').toMatch(/setErro\(/)
    expect(limpo, 'a frase do erro é renderizada').toMatch(/\{erro\}/)
  })
})

// ───────────────────────── 4 · A PREFERÊNCIA E A PORTA ÚNICA ─────────────────────────

describe('⛔⛔ a preferência persiste POR USUÁRIO, por UMA porta', () => {
  /**
   * ⛔⛔⛔ A PORTA É UMA, E ESTE É O TESTE QUE TORNA ISSO VERDADE. Um segundo `upsert` em
   * qualquer rota seria a 2ª porta pro mesmo fato — e aí tema e trilho divergiriam no primeiro
   * campo novo, exatamente como os 7 detectores de par e as 2 cópias do FITID.
   */
  it('⛔⛔ EXATAMENTE UM arquivo escreve em `user_tema_preferencia`', () => {
    const escritores: string[] = []
    const varrer = (dir: string) => {
      for (const e of require('node:fs').readdirSync(join(RAIZ, dir))) {
        const p = `${dir}/${e}`
        if (require('node:fs').statSync(join(RAIZ, p)).isDirectory()) varrer(p)
        else if (/\.(ts|tsx)$/.test(e) && !p.includes('__tests__')) {
          const src = semComentarios(readFileSync(join(RAIZ, p), 'utf8'))
          if (/userTemaPreferencia\.(upsert|update|create|updateMany|createMany|delete)/.test(src)) {
            escritores.push(p)
          }
        }
      }
    }
    varrer('app')
    varrer('lib')
    expect(escritores, `a escrita é de UM lugar só: ${escritores.join(', ')}`).toEqual([
      'lib/tema/servidor.ts',
    ])
  })

  it('⭐ e as duas rotas são CASCA sobre a porta — nenhuma toca o Prisma', () => {
    for (const p of ['app/api/tema/route.ts', 'app/api/trilho/route.ts']) {
      const limpo = semComentarios(ler(p))
      expect(limpo, `${p} não fala com o banco`).not.toMatch(/prisma\./)
      expect(limpo, `${p} delega pra porta`).toMatch(/from '@\/lib\/tema\/servidor'/)
    }
  })

  /**
   * ⛔⛔ PARCIAL DE PROPÓSITO — e este é o ponto mais fino da porta. Se o `update` mandasse os
   * dois campos sempre, o «» gravaria o tema que o CLIENTE acha que está valendo — e numa aba
   * velha isso é o tema ANTIGO: o dono recolheria o menu e o app voltaria pro claro sozinho.
   */
  it('⛔⛔ gravar o trilho NÃO sobrescreve o tema (e vice-versa)', () => {
    const limpo = semComentarios(SERVIDOR)
    expect(limpo, 'o tema só entra no update se foi decidido').toMatch(
      /if \(escolha\.tema !== undefined\)/,
    )
    expect(limpo, 'o trilho também').toMatch(/if \(escolha\.trilho !== undefined\)/)
    expect(limpo, 'gesto que não decide nada não escreve nada').toMatch(
      /Object\.keys\(update\)\.length === 0/,
    )
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
  it('⛔ a escolha NUNCA vai pro navegador', () => {
    for (const [nome, src] of Object.entries({ BOTAO, SIDEBAR, SHELL })) {
      expect(semComentarios(src), `${nome} não guarda preferência no navegador`).not.toMatch(
        /localStorage|sessionStorage/,
      )
    }
  })

  /** ⚠️ a rota RECUSA o desconhecido em vez de normalizar em silêncio (o *"salvo que mentia"*) */
  it('⚠️ a rota recusa estado inválido em vez de gravar o default calado', () => {
    const limpo = semComentarios(ler('app/api/trilho/route.ts'))
    expect(limpo).toMatch(/TRILHOS as readonly string\[\]\)\.includes/)
    expect(limpo).toMatch(/status: 400/)
    expect(limpo, 'o vocabulário da rota DERIVA da régua, nunca é digitado de novo').toMatch(
      /from '@\/lib\/trilho\/preferencia'/,
    )
  })
})

// ───────────────────────── 5 · O BADGE NO RECOLHIDO ─────────────────────────

describe('⛔⛔ o badge do Contas a Pagar é VISÍVEL no recolhido', () => {
  /**
   * ⛔⛔ ESTE É O VERMELHO Nº 2 DA LISTA DO DONO. Sem a regra, o badge é o último filho de um
   * item de 64px com `justify-content:center` e **sai do campo visível**: o número que existe
   * pra ser visto desapareceria justamente no estado em que o trilho NASCE.
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

// ───────────────────────── 6 · A GAVETA E A MARCA ─────────────────────────

describe('⭐ a gaveta do celular e a logomarca', () => {
  /**
   * ⛔⛔ NA GAVETA O TRILHO É SEMPRE ABERTO — e não é a preferência sendo ignorada, é o `:hover`
   * NÃO EXISTIR no toque. Recolhido num celular seriam 64px de ícones sem rótulo e **sem gesto
   * nenhum que mostrasse os nomes** — a "porta sem maçaneta" em forma de menu.
   */
  it('⛔⛔ a gaveta nasce ABERTA — no toque não existe hover', () => {
    expect(usosDe(SHELL, 'naGaveta'), 'o shell marca a gaveta').toBeGreaterThanOrEqual(1)
    expect(semComentarios(SIDEBAR), 'e o trilho vira `.gaveta`').toMatch(/naGaveta \? ' gaveta'/)
    expect(BLOCO_DO_TRILHO, 'a gaveta ocupa a largura toda, mesmo com `rec`').toMatch(
      /\.trilho\.gaveta,\s*\.trilho\.gaveta\.rec\s*\{[^}]*width:\s*100%/,
    )
    expect(BLOCO_DO_TRILHO, 'e os nomes voltam').toMatch(
      /\.trilho\.gaveta\.rec:not\(:hover\)\s*\.rotulo[\s\S]{0,200}display:\s*revert/,
    )
  })

  /** ⛔ botão morto é clique errado esperando (a lição de 09/10) */
  it('⛔ e a gaveta NÃO tem «» — ali ele não faria nada', () => {
    expect(semComentarios(SIDEBAR)).toMatch(/\{!naGaveta && <BotaoRecolher/)
  })

  it('⭐ a logomarca em GRADIENTE, com os dois tons de token', () => {
    const regra = BLOCO_DO_TRILHO.match(/\.trilho\s*\.logo\s*\.marca\s*\{([^}]*)\}/)
    expect(regra).toBeTruthy()
    expect(regra![1]).toMatch(/linear-gradient\(135deg,\s*var\(--prod-trilho-pilula\),\s*var\(--prod-acao-quente\)\)/)
  })

  /** ⚠️ o "C" fica visível no recolhido — é a âncora que diz que a coluna de 64px é o MENU */
  it('⚠️ no recolhido o nome some e a MARCA fica', () => {
    expect(BLOCO_DO_TRILHO).toMatch(
      /\.trilho\.rec:not\(:hover\)\s*\.logo\s*\.nome[\s\S]{0,200}display:\s*none/,
    )
    expect(BLOCO_DO_TRILHO, 'a marca não entra no que some').not.toMatch(
      /\.trilho\.rec:not\(:hover\)[^{]*\.marca[^{]*\{[^}]*display:\s*none/,
    )
  })

  it('⭐ a PÍLULA cheia no item ativo (L1)', () => {
    const regra = BLOCO_DO_TRILHO.match(/\.trilho\s*\.item\.on\s*\{([^}]*)\}/)
    expect(regra).toBeTruthy()
    expect(regra![1]).toMatch(/background:\s*var\(--prod-trilho-pilula\)/)
    expect(regra![1], 'o fio interno separa a pílula do chão escuro').toMatch(/inset 0 0 0 1px/)
    expect(semComentarios(ITEM), 'e a tela liga a classe pelo `isActive`').toMatch(
      /`item\$\{isActive \? ' on' : ''\}`/,
    )
  })
})

// ───────────────────────── 7 · NENHUMA LÓGICA MUDOU ─────────────────────────

/**
 * ⭐⭐ *"É troca de roupa global — nenhuma lógica, rota ou porta muda"* (ordem do dono).
 *
 * ⚠️ 17 arquivos de teste leem o `global-sidebar.tsx` POR REGEX (permissão por papel, PF não
 * ver menu de empresa, rota aposentada não voltar ao menu, badge só pra quem pode). Este bloco
 * é o cinto: ele afirma que a espinha do menu e o contrato do item seguem de pé, pra ninguém
 * "simplificar" a lista num passe de pintura futuro.
 */
describe('⭐⭐ é ROUPA: a lógica do menu segue intacta', () => {
  it('⭐ o item continua exigindo `perm`, e esconde quem não tem', () => {
    const limpo = semComentarios(ITEM)
    expect(limpo).toMatch(/perm: string/)
    expect(limpo).toMatch(/usePermissaoMenu\(perm\)/)
    expect(limpo).toMatch(/if \(!permitido\) return null/)
  })

  it('⭐ o choke-point que esconde o menu da empresa no PF segue de pé', () => {
    expect(semComentarios(SIDEBAR)).toMatch(/const empresaAtiva = workspaceType === 'pf' \? null :/)
  })

  it('⭐ e o `isComingSoon` continua sendo item SEM destino (não virou link)', () => {
    const limpo = semComentarios(ITEM)
    const bloco = limpo.slice(limpo.indexOf('if (isComingSoon)'), limpo.indexOf('return (', limpo.indexOf('if (isComingSoon)')) + 400)
    expect(bloco, 'não é <Link>').not.toMatch(/<Link/)
    expect(bloco).toMatch(/item breve/)
  })
})
