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
export const FAMILIA: Record<'caros' | 'porcoes' | 'revenda', { bg: string; cor: string }> = {
  caros: { bg: RADAR.ambarBg, cor: RADAR.ambar },
  porcoes: { bg: RADAR.azulBg, cor: RADAR.azul },
  revenda: { bg: RADAR.tealBg, cor: RADAR.teal },
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
