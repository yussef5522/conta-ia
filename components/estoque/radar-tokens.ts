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
