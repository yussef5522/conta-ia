// ⭐⭐ OS TOKENS DO RADAR — COPIADOS DO MOCK (`docs/mocks/radar-do-estoque-mock.html`).
//
// **A régua do dono:** *"o mock é a RÉGUA — igual primeiro, melhoria só com meu pedido."*
// O guard `__tests__/regras-ui/radar-bate-com-o-mock.test.ts` LÊ o `:root{}` do arquivo e
// compara AO CARACTERE: quem ajustar um tom "no olho" fica vermelho com o valor que o
// arquivo manda.
//
// ⚠️ **A PALETA É A MESMA DO MOCK v3 DA CONCILIAÇÃO — de propósito.** A casa tem UMA
// paleta; um terceiro arquivo de tokens com tons "quase iguais" é como o verde do cartão ≍
// e o do card de 10/09 acabaram diferentes.
//
// ⛔ **O TEMA ESCURO NÃO ENTRA AQUI** (decisão do dono, 20/09): o Radar nasce CLARO como o
// resto do app. O mock guarda os dois temas versionados; ligar o dark global é sprint
// próprio — e ele tem que conferir os 107 arquivos que já têm `dark:` e nunca renderizaram.

// ⚠️ só o TIPO entra (o `FAROL` abaixo é indexado por ele) — a régua do farol é PURA e
// continua morando em `lib/stock/radar/farol-da-variancia.ts`, nunca aqui.
import type { PapelDoFarol } from '@/lib/stock/radar/farol-da-variancia'
// ⚠️ idem: só o TIPO do tom da agenda (o `TOM_DA_AGENDA` lá embaixo é indexado por ele). A
// régua de QUANDO contar é pura e mora em `lib/stock/radar/agenda-da-contagem.ts`.
import type { TomDaAgenda } from '@/lib/stock/radar/agenda-da-contagem'

export const RADAR = {
  bg: '#f6f5fb',
  card: '#fff',
  ink: '#171a26',
  sub: '#7b8194',
  line: '#eae9f2',
  roxo: '#534AB7',
  roxoBg: '#efedfb',
  verde: '#0f9d58',
  verdeBg: '#e7f7ee',
  coral: '#e5484d',
  coralBg: '#fdecec',
  ambar: '#c47b0a',
  ambarBg: '#fdf3e0',
  /** ⭐ o cinza do "falta contar" — estado PRÓPRIO, nunca um verde pálido */
  mudo: '#94a0b8',
  mudoBg: '#f1f3f8',
  /**
   * ⭐⭐ AS CORES DE FAMÍLIA DA MESA (v2, 29/09/2026) — *"faixa colorida de verdade por
   * família"*. `azul` já existia no `:root{}` dos mocks e faltava aqui; o **teal** é a
   * terceira, e ela nasceu porque as três seções precisavam de cores DISTINTAS e o roxo já
   * é a cor da marca (período, links, seleção).
   *
   * ⛔ Vieram pro arquivo de tokens, não pra a tela: a casa tem UMA paleta, e um tom
   * "quase igual" escrito direto no componente é como o verde do cartão ≍ e o do card de
   * 10/09 acabaram diferentes.
   */
  azul: '#2563eb',
  azulBg: '#e8effd',
  teal: '#0d7c74',
  tealBg: '#e4f5f2',
  sombra: '0 1px 2px rgba(23,26,38,.05),0 8px 28px rgba(83,74,183,.08)',
} as const

/** ⭐ o semáforo semântico: um veredito, uma cor — decidido no servidor, pintado aqui */
export const TOM: Record<string, { bg: string; cor: string }> = {
  FALTOU_GRANDE: { bg: RADAR.coralBg, cor: RADAR.coral },
  FALTOU_PEQUENO: { bg: RADAR.ambarBg, cor: RADAR.ambar },
  SOBROU: { bg: RADAR.verdeBg, cor: RADAR.verde },
  BATEU: { bg: RADAR.verdeBg, cor: RADAR.verde },
  SEM_CONTAGEM: { bg: RADAR.mudoBg, cor: RADAR.mudo },
}


/**
 * ⭐⭐⭐ O FAROL HONESTO DA VARIÂNCIA — RT5 (22/10/2026)
 *
 * **A lei da referência:** `faltou` = **CORAL** (é PERDA) · `sobrou` = **ÂMBAR** (é dado torto
 * pra conferir, não boa notícia) · `bateu` = **VERDE** · `falta contar` = **neutro com a AÇÃO**.
 *
 * ⚠️⚠️ **DIVERGÊNCIA DECLARADA do `TOM` logo acima, e ela é de propósito.** No Radar o
 * semáforo é por TAMANHO (`FALTOU_PEQUENO` em âmbar, `FALTOU_GRANDE` em coral) — a pergunta
 * dele é *"onde está vazando MAIS dinheiro?"*. A pergunta desta tela é outra: **faltou é
 * faltou**. Pintar falta pequena de âmbar aqui faria o olho do dono aprender que âmbar
 * significa duas coisas (*"faltou um pouco"* e *"sobrou"*), e aí nenhuma das duas se lê.
 *
 * ⛔ Por isso `TOM` **não foi tocado**: o Radar continua com a régua dele. São duas telas, duas
 * perguntas — e cada uma com o seu mapa, nomeado.
 *
 * ⭐ A chave é o `PapelDoFarol` da régua PURA (`farol-da-variancia.ts`), importado como TIPO
 * (ver o topo do arquivo): papel novo lá **não compila** aqui até ganhar cor — em vez de cair
 * num `undefined` que a tela pintaria de transparente.
 */
export const FAROL: Record<PapelDoFarol, { bg: string; cor: string }> = {
  falta: { bg: RADAR.coralBg, cor: RADAR.coral },
  sobra: { bg: RADAR.ambarBg, cor: RADAR.ambar },
  ok: { bg: RADAR.verdeBg, cor: RADAR.verde },
  neutro: { bg: RADAR.mudoBg, cor: RADAR.mudo },
}

/**
 * ⭐⭐ O TOM DO SELO DA AGENDA — RT3 (22/10/2026)
 *
 * **CONTAR HOJE** = âmbar · **atrasada** = coral · *"contado hoje"* = verde · *"próxima SEX"* =
 * neutro. ⛔ O `tom` vem **DECIDIDO do servidor** (`seloDaAgenda`, régua pura, com o `hoje`
 * resolvido na rota) — a tela só pinta.
 *
 * ⛔⛔ Derivar o tom aqui a partir do `estado` seria a **2ª resposta** pra *"isto é urgente?"*, e
 * ela divergiria da régua no primeiro estado novo — a doença do B1 em forma de cor.
 *
 * ⭐ A chave é o `TomDaAgenda` da régua, importado como TIPO (ver o topo): tom novo lá **não
 * compila** aqui até ganhar cor, em vez de cair num `undefined` que a tela pintaria de
 * transparente.
 */
export const TOM_DA_AGENDA: Record<TomDaAgenda, { bg: string; cor: string }> = {
  VERDE: { bg: RADAR.verdeBg, cor: RADAR.verde },
  AMBAR: { bg: RADAR.ambarBg, cor: RADAR.ambar },
  CORAL: { bg: RADAR.coralBg, cor: RADAR.coral },
  NEUTRO: { bg: RADAR.mudoBg, cor: RADAR.mudo },
}

/**
 * ⭐⭐⭐ UMA FAMÍLIA, UMA COR — e a faixa da seção e o SUBTOTAL dela leem daqui (29/09/2026).
 *
 * **A ordem do dono:** *"cabeçalho de seção com cor de verdade por família — os caros =
 * âmbar · porções = azul · revenda = teal — com ícone e texto no tom escuro da mesma
 * família; o SUBTOTAL da seção repete o fundo da faixa dela."*
 *
 * ⛔ Por isso é UM mapa, não duas escolhas: se a faixa e o subtotal pegassem a cor em
 * lugares diferentes, divergiriam no primeiro ajuste de tom e a seção deixaria de se ler
 * como um bloco só. É a régua do mock (`docs/mocks/real-vs-teorico-mock.html`), onde os
 * dois seletores CSS compartilham a mesma declaração.
 */
/**
 * ⚠️⚠️ A CHAVE AGORA É O **SLUG** DO GRUPO, e os três de origem ficam **PINADOS** nas cores
 * que o dono aprovou em 29/09. ⛔ Elas não se "melhoram": o olho dele já aprendeu
 * âmbar=caros, azul=porções, teal=revenda, e trocar isso reeducaria a leitura da tela à
 * força.
 */
export const FAMILIA_DO_SLUG: Record<string, { bg: string; cor: string }> = {
  CAROS: { bg: RADAR.ambarBg, cor: RADAR.ambar },
  PORCOES: { bg: RADAR.azulBg, cor: RADAR.azul },
  REVENDA: { bg: RADAR.tealBg, cor: RADAR.teal },
}

/**
 * ⭐⭐ As famílias que um grupo NOVO pode receber (RT2: o dono cria grupo).
 *
 * ⛔⛔ **O CORAL FICA DE FORA, e isto é regra, não gosto:** coral é a cor do **alarme**
 * nesta tela (`faltou`, a lei RT5). Dar coral a um grupo pintaria a faixa dele de "problema"
 * todo dia, e aí o dono para de reconhecer o coral como alarme — a mesma razão que tirou o
 * coral da paleta das receitas em 05/10. Pelo mesmo motivo, **verde também não**: verde é
 * "bateu".
 */
const FAMILIAS_DISPONIVEIS: { bg: string; cor: string }[] = [
  { bg: RADAR.ambarBg, cor: RADAR.ambar },
  { bg: RADAR.azulBg, cor: RADAR.azul },
  { bg: RADAR.tealBg, cor: RADAR.teal },
]

/**
 * ⭐⭐ A COR DA FAIXA DE UM GRUPO — **dono único** (a faixa e o subtotal leem daqui).
 *
 * ⛔ Se a faixa e o subtotal pegassem a cor em lugares diferentes, divergiriam no primeiro
 * ajuste de tom e a seção deixaria de se ler como um bloco só. É a régua do mock
 * (`docs/mocks/real-vs-teorico-mock.html`), onde os dois seletores CSS compartilham a mesma
 * declaração.
 *
 * ⚠️ Grupo novo deriva do **SLUG**, nunca do NOME nem da ORDEM: o nome é do dono e muda
 * (RT2), e a ordem muda quando ele reordena — nos dois casos a faixa trocaria de cor sozinha
 * e o dono acharia que o sistema perdeu o grupo. Slug é identidade e não muda (é a lição do
 * `systemSlug='BRIDGE_ENTRY'`, 13/08).
 */
export function familiaDoGrupo(slug: string): { bg: string; cor: string } {
  const pinada = FAMILIA_DO_SLUG[slug]
  if (pinada) return pinada
  let h = 0
  for (let i = 0; i < slug.length; i++) h = (h * 31 + slug.charCodeAt(i)) % 100_003
  return FAMILIAS_DISPONIVEIS[h % FAMILIAS_DISPONIVEIS.length]
}

/**
 * ⭐ AS MEDIDAS DA MESA v2, copiadas do mock — *"cada produto vira uma faixa própria"*.
 *
 * ⚠️ `divisoria` é mais escura que a `line` de antes de propósito: com a `line` (#eae9f2) a
 * separação existia no CSS e **não se via**, que é o mesmo que não existir.
 */
export const MESA = {
  /** a divisória INTEIRA de cada produto (1px, em cima e embaixo) */
  divisoria: '#dcdae8',
  /** o zebrado: linha alternada com fundo suave (surface-1) */
  zebra: '#faf9fd',
  linhaPy: '13px',
  pilulaPy: '4px',
  pilulaPx: '10px',
  pilulaFs: '12.5px',
  itemFs: '13.5px',
  /** ⭐ nome do item, TEÓRICO e REAL — o que decide */
  pesoForte: 500,
  /** início/entrou/produzido/vendeu — contexto */
  pesoContexto: 400,
} as const
