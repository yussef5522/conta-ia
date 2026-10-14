/**
 * ⭐⭐⭐ A VARREDURA L7 DO **CSS** — O DETECTOR COM DONO (14/10/2026).
 *
 * **A lei (L7, palavras do dono):** *"VARREDURA WCAG automatizada nos 2 temas: texto branco
 * sobre tom médio = vermelho"*.
 *
 * ⛔⛔ **POR QUE ELA EXISTE SEPARADA DA VARREDURA DE TELA:** a de tela lê **TSX**
 * (`telasDoApp()`), e um par pintado por CLASSE no `globals.css` é **invisível** pra ela. Foi
 * esse flanco que escondeu o badge do Contas a Pagar e o contador do sininho pintando branco
 * sobre o coral vivo — **3,75:1 no claro e 2,78:1 no escuro**, num número de 10,5px. *Guard que
 * lê a vitrine não enxerga a prateleira.*
 *
 * ⛔⛔ **E POR QUE ELA MORA NUMA LIB, e não dentro do arquivo de teste:** a REGRA 11 mostrou que
 * **arrancar a varredura do teste (`it.skip`) não produz vermelho nenhum** — nenhum teste pega o
 * próprio desligamento (é a mesma classe do `void X` que contava como uso, 13/10). Com o
 * detector numa lib, ele é **executado em DOIS lugares**: o guard da suíte e a **prova em prod**,
 * que o roda contra o CSS que o servidor SERVE. Desligar um não esconde o outro.
 *
 * ⚠️ A régua aqui é **mais larga** que a de TSX de propósito: no CSS o chão pode ser qualquer
 * token (foi um `--prod-coral`, não um `-mid`, que escapou), e quem decide o par é o BLOCO.
 */
import { PISO_TEXTO_NORMAL, razao } from './contraste'

export type ParDeCor = { seletor: string; ink: string; bg: string }
export type ViolacaoL7 = { seletor: string; ink: string; bg: string; tema: string; razao: number }

/** ⚠️ o arquivo que DOCUMENTA o defeito não pode ser o que o absolve (21/09) */
function semComentario(s: string): string {
  return s.replace(/\/\*[\s\S]*?\*\//g, '')
}

/**
 * Os pares `(color, background)` declarados no MESMO bloco, com os dois vindo de token.
 *
 * ⚠️⚠️ **O DELIMITADOR NÃO PODE SER CONSUMIDO.** A 1ª versão era
 * `(?:^|[}{])\s*([^{}@]+)\{([^}]*)\}` — ela come o `}` do bloco anterior, então o bloco seguinte
 * fica sem delimitador e o regex **pula de dois em dois**: medido, achava **62 blocos de ~600** e
 * o badge do trilho ficava de fora. Excluir a chave da classe, em vez de exigir um prefixo, é a
 * forma que a prova em prod já valida (2.671 regras).
 */
export function paresDeCor(css: string): ParDeCor[] {
  const limpo = semComentario(css)
  const out: ParDeCor[] = []
  const re = /([^{}]+)\{([^{}]*)\}/g
  let m: RegExpExecArray | null
  while ((m = re.exec(limpo))) {
    const corpo = m[2]
    const ink = (corpo.match(/(?:^|;)\s*color\s*:\s*var\((--[a-z0-9-]+)\)/i) ?? [])[1]
    const bg = (corpo.match(/(?:^|;)\s*background(?:-color)?\s*:\s*var\((--[a-z0-9-]+)\)/i) ?? [])[1]
    if (ink && bg) out.push({ seletor: m[1].trim(), ink, bg })
  }
  return out
}

/**
 * Mede todo par contra os dois mapas e devolve o que REPROVA.
 *
 * ⚠️ Token que o tema escuro não redefine **herda o claro** — é a cascata, e ignorá-la daria
 * falso vermelho em metade da paleta. Token que não existe em mapa nenhum não se mede (seria
 * afirmar sobre o que não está declarado).
 */
export function violacoesL7NoCss(
  css: string,
  mapas: { claro: Record<string, string>; escuro: Record<string, string> },
  piso = PISO_TEXTO_NORMAL,
): ViolacaoL7[] {
  const fora: ViolacaoL7[] = []
  for (const { seletor, ink, bg } of paresDeCor(css)) {
    for (const tema of ['claro', 'escuro'] as const) {
      const mapa = mapas[tema]
      const a = mapa[ink] ?? mapas.claro[ink]
      const b = mapa[bg] ?? mapas.claro[bg]
      if (!a || !b) continue
      const r = razao(a, b)
      if (r < piso) fora.push({ seletor, ink, bg, tema, razao: r })
    }
  }
  return fora
}

/** junta as declarações de TODOS os blocos cujo seletor é exatamente `sel` */
export function declaracoesDe(css: string, sel: string): Record<string, string> {
  const limpo = semComentario(css)
  const out: Record<string, string> = {}
  /** ⚠️ o `[}{]` é obrigatório: o bloco do shadcn vive DENTRO de `@layer base {` */
  const re = new RegExp(`(?:^|[}{])\\s*${sel.replace('.', '\\.')}\\s*\\{([^}]*)\\}`, 'g')
  let m: RegExpExecArray | null
  while ((m = re.exec(limpo))) {
    for (const linha of m[1].split(';')) {
      const [k, ...v] = linha.split(':')
      if (!k || !v.length) continue
      const nome = k.trim()
      if (nome.startsWith('--')) out[nome] = v.join(':').trim()
    }
  }
  return out
}

/** a frase pronta pra tela/relatório — o número vem com vírgula, como o resto da casa */
export function descreverViolacao(v: ViolacaoL7): string {
  return `${v.seletor} · ${v.ink} sobre ${v.bg} · ${v.tema} ${v.razao.toFixed(2).replace('.', ',')}:1`
}
