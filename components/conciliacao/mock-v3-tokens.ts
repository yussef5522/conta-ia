// ⭐⭐⭐ AS CORES DO MOCK v3, COPIADAS DO ARQUIVO (16/09/2026).
//
// **O dono:** *"o mock é a RÉGUA — igual primeiro, melhoria só com meu pedido."* Estes
// valores são o `:root{}` de `docs/mocks/conciliacao-caixa-mock-v3.html`, ao caractere.
// O guard `__tests__/regras-ui/caixa-bate-com-o-mock-v3.test.ts` **LÊ o HTML** e compara:
// quem "ajustar um tom" fica vermelho com o token e o valor que o arquivo manda.
//
// ⚠️⚠️ **POR QUE UM SEGUNDO ARQUIVO DE TOKENS, e não editar o `mock-tokens.ts`:** o mock
// de 10/09 (`conciliacao-mock.html`) governa o **INTERIOR do card de escolher-na-mão** —
// as caixinhas de nota, o rodapé sticky —, e o v3 **não redesenhou aquilo**: ele mostra o
// card do fornecedor COLAPSADO. Trocar a paleta global mudaria, sem pedido, uma tela que
// o dono aprovou — e deixaria o guard de 10/09 vermelho com a tela certa.
//
// ⛔ **CONSEQUÊNCIA REGISTRADA, não escondida:** enquanto os dois mocks conviverem, o
// verde/coral do cartão ≍ (v3) e o do card aberto (10/09) são tons diferentes. É
// divergência visível, e é o preço de *"igual ao mock"* com dois mocks aprovados. O dia
// em que o dono pedir, o v3 absorve o interior do card e este arquivo vira o único.

export const V3 = {
  bg: '#f6f5fb',
  // ⚠️ o mock escreve `#fff` (3 dígitos) — o guard compara AO CARACTERE, e a régua é o arquivo
  card: '#fff',
  ink: '#171a26',
  sub: '#7b8194',
  line: '#eae9f2',
  roxo: '#534AB7',
  roxo2: '#6f63d8',
  roxoBg: '#efedfb',
  verde: '#0f9d58',
  verde2: '#12b768',
  verdeBg: '#e7f7ee',
  coral: '#e5484d',
  coralBg: '#fdecec',
  ambar: '#c47b0a',
  ambarBg: '#fdf3e0',
  azul: '#2563eb',
  azulBg: '#e8effd',
} as const

/** as sombras do mock — a de repouso e a do hover que "levanta" o card */
export const SOMBRA = '0 1px 2px rgba(23,26,38,.05),0 8px 28px rgba(83,74,183,.08)'
export const SOMBRA_UP = '0 2px 4px rgba(23,26,38,.06),0 16px 44px rgba(83,74,183,.14)'

/** ⚠️ o fundo do BODY no mock é um radial + a cor base — entra na SEÇÃO, nunca no shell */
export const FUNDO_RADIAL = 'radial-gradient(1200px 400px at 70% -100px,#eeecfa 0%,transparent 60%)'

/**
 * ⭐ AS MEDIDAS QUE O GUARD CONFERE — escritas como o mock escreve, em px literal.
 * *"gap-2.5 do Tailwind É 10px e certo, mas obriga tradução mental — e foi tradução
 * mental que produziu as duas versões erradas"* (a lição de 10/09).
 */
export const MEDIDA = {
  /** `.par{border-radius:22px}` — o cartão ≍ */
  raioCartao: 22,
  /** `.stat{border-radius:18px}` */
  raioStat: 18,
  /** `.palpite{border-radius:16px}` */
  raioPalpite: 16,
  /** `.btn-ok{border-radius:14px;padding:13px}` */
  raioBotao: 14,
  /** `.chip{border-radius:99px;padding:7px 13px}` */
  raioChip: 99,
  /** `.valor{font-size:28px}` — o valor gigante do banco */
  fonteValor: 28,
  /** `.stat .v{font-size:24px}` */
  fonteStat: 24,
  /** `.memo{font-size:14.5px}` */
  fonteMemo: 14.5,
  /** `.meio .simb{width:34px;height:34px}` — o conector ≍ */
  simbolo: 34,
  /** `.ring{width:40px;height:40px}` — o anel de progresso */
  anel: 40,
  /** `.avatar{width:42px;height:42px;border-radius:14px}` */
  avatar: 42,
  /** `@media(max-width:900px)` — onde o cartão empilha (REGRA 12) */
  breakpointEmpilha: 900,
} as const

/** ⭐ o símbolo do conector — é `≍` no mock, não `=` nem `↔` */
export const CONECTOR = '≍'
