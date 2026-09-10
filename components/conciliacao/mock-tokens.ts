// ⭐⭐⭐ AS CORES DO MOCK, COPIADAS DO ARQUIVO (10/09/2026).
//
// **O dono:** *"o arquivo do mock está em `docs/mocks/conciliacao-mock.html` — copia o
// visual EXATAMENTE. Ele é a régua; divergência do mock = defeito. (…) Se tua versão
// 'melhorou' algo do mock, desfaz — igual primeiro, melhoria só com meu pedido depois."*
//
// ⛔ ESTES VALORES NÃO SE ESCOLHEM: são o `:root{}` do arquivo, ao caractere. O guard
// `__tests__/regras-ui/visual-bate-com-o-mock.test.ts` LÊ o HTML do mock e compara — se
// alguém "ajustar um tom", fica vermelho apontando o token e o valor que o mock manda.
//
// ⚠️ POR QUE VALOR EM TS E NÃO CLASSE DO TAILWIND: classe com valor arbitrário é string
// literal espalhada por dois componentes — a segunda cópia diverge no primeiro ajuste, e
// o guard não teria um lugar só pra conferir. Cor sai daqui; espaçamento e tamanho de
// fonte continuam em classe (e o guard confere esses contra o mock também).

export const MOCK = {
  bg: '#faf9f6',
  card: '#ffffff',
  ink: '#1f2430',
  sub: '#6b7280',
  line: '#e8e6e0',
  roxo: '#534AB7',
  roxoFraco: '#eeecfa',
  verde: '#177245',
  verdeFraco: '#e6f4ec',
  ambar: '#b45309',
  ambarFraco: '#fdf3e3',
  coral: '#b3382c',
  coralFraco: '#fdecea',
  slate: '#475569',
  slateFraco: '#eef2f6',
  frio: '#f2f6fb',
  quente: '#fdf8f0',
} as const

/** ⚠️ a borda entre notas é OUTRA linha no mock (`label.nota{border-top:1px solid #f1efe9}`) */
export const LINHA_ENTRE_NOTAS = '#f1efe9'
/** o hover da nota (`label.nota:hover{background:#fbfaf7}`) */
export const HOVER_NOTA = '#fbfaf7'

/** ⭐ o chip do mock: `font-size:11px; font-weight:600; padding:2px 9px; border-radius:99px` */
export const chip = (fundo: string, cor: string) => ({
  background: fundo, color: cor,
  fontSize: '11px', fontWeight: 600, padding: '2px 9px', borderRadius: '99px',
  display: 'inline-block', whiteSpace: 'nowrap' as const,
})
