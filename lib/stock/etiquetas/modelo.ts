// ⭐⭐ MODELO DE ETIQUETA 60×60 — UMA FONTE, DOIS CONSUMIDORES (30/08/2026).
//
// ⚠️ "O QUE SE VÊ É O QUE SAI" É UM PROBLEMA DE VERDADE, não um slogan: o navegador não
// renderiza ZPL, então prévia e impressão são necessariamente dois renderizadores. O que
// se pode garantir — e é o que este arquivo garante — é que os dois leem **o MESMO
// layout declarativo** (posição, tamanho, ordem, quais campos entram). Uma segunda lista
// de campos, ainda que "igualzinha", divergiria na primeira mudança e a prévia passaria a
// mentir sobre o que sai da Zebra. É a REGRA 4 aplicada a desenho.
//
// A régua: 60 mm a 203 dpi ≈ **480 dots**. Todas as posições são em DOTS; a prévia
// converte pra % da caixa (`x/480`), então ela é FIEL por construção, em qualquer tamanho
// de tela — inclusive no celular do Cristian.

export const LADO_DOTS = 480

export type EstadoConservacao = 'CONGELADO' | 'RESFRIADO' | 'AMBIENTE'

export const ESTADOS: Array<{ id: EstadoConservacao; label: string; tom: string }> = [
  { id: 'CONGELADO', label: 'Congelado', tom: 'sky' },
  { id: 'RESFRIADO', label: 'Resfriado', tom: 'emerald' },
  { id: 'AMBIENTE', label: 'Ambiente', tom: 'amber' },
]

export type CampoId =
  | 'produto' | 'fabricacao' | 'validade' | 'estado'
  | 'lote' | 'quantidade' | 'colaborador' | 'empresa' | 'qr'

export interface CampoLayout {
  id: CampoId
  /** posição em dots, canto superior-esquerdo */
  x: number
  y: number
  /** altura da fonte em dots (ZPL ^A0N,h,h) — ignorado no QR */
  fonte: number
  tipo: 'texto' | 'qr'
  /** o QR usa `magnification` em vez de fonte */
  qrTamanho?: number
  /** rótulo curto antes do valor ("VAL: ") */
  rotulo?: string
  /** ⭐ campo em destaque: na Zebra sai em vídeo invertido; na prévia, em caixa preta */
  destaque?: boolean
  /** o dono pode desligar (a etiqueta é pequena — cada linha disputa espaço) */
  opcional?: boolean
}

/**
 * O MODELO PADRÃO — a ordem é a da leitura da cozinha, não a do banco de dados:
 * **o que o produto é** → **quando vence** → o resto.
 *
 * ⚠️ A VALIDADE VEM EM DESTAQUE e logo abaixo do nome. Numa câmara fria, com a mão fria e
 * pressa, ninguém lê a 5ª linha — e a validade é a única informação que, se for lida
 * errado, vira comida estragada servida. Lote e colaborador são rastro (importam DEPOIS,
 * quando alguém investiga); validade é decisão do momento.
 */
export const MODELO_PADRAO: CampoLayout[] = [
  { id: 'produto', x: 20, y: 18, fonte: 40, tipo: 'texto' },
  { id: 'validade', x: 20, y: 74, fonte: 44, tipo: 'texto', rotulo: 'VAL ', destaque: true },
  { id: 'estado', x: 20, y: 132, fonte: 24, tipo: 'texto' },
  { id: 'fabricacao', x: 20, y: 168, fonte: 24, tipo: 'texto', rotulo: 'FAB ' },
  { id: 'quantidade', x: 20, y: 204, fonte: 24, tipo: 'texto', opcional: true },
  { id: 'lote', x: 20, y: 240, fonte: 24, tipo: 'texto', rotulo: 'LOTE ' },
  { id: 'colaborador', x: 20, y: 276, fonte: 22, tipo: 'texto', opcional: true },
  { id: 'empresa', x: 20, y: 442, fonte: 20, tipo: 'texto', opcional: true },
  { id: 'qr', x: 300, y: 300, fonte: 0, tipo: 'qr', qrTamanho: 5 },
]

export const ROTULO_CAMPO: Record<CampoId, string> = {
  produto: 'Nome do produto',
  validade: 'Validade',
  estado: 'Estado de conservação',
  fabricacao: 'Fabricação / manipulação',
  quantidade: 'Quantidade',
  lote: 'Lote',
  colaborador: 'Quem manipulou',
  empresa: 'Nome da empresa',
  qr: 'QR do lote',
}

// ---------------------------------------------------------------------------
// OS VALORES
// ---------------------------------------------------------------------------

export interface DadosEtiqueta {
  produto: string
  lote: string
  /** data/hora da manipulação */
  fabricacao: Date
  validadeAte: Date | null
  estado: EstadoConservacao
  quantidade?: number | null
  unidade?: string | null
  colaborador?: string | null
  empresa?: string | null
}

const dois = (n: number) => String(n).padStart(2, '0')
const dia = (d: Date) => `${dois(d.getDate())}/${dois(d.getMonth() + 1)}`
const diaAno = (d: Date) => `${dia(d)}/${d.getFullYear()}`
const hora = (d: Date) => `${dois(d.getHours())}:${dois(d.getMinutes())}`

/** quantos dias faltam (negativo = já venceu) */
export function diasAte(validade: Date | null, agora: Date): number | null {
  if (!validade) return null
  const d0 = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate()).getTime()
  const d1 = new Date(validade.getFullYear(), validade.getMonth(), validade.getDate()).getTime()
  return Math.round((d1 - d0) / 86_400_000)
}

/**
 * O texto de cada campo. **Esta função é a fonte** — prévia e ZPL chamam ELA.
 * ⚠️ Sem validade o campo diz "A DEFINIR", nunca uma data inventada: etiqueta com data
 * errada é pior que etiqueta sem data, porque a errada é obedecida.
 */
export function valoresDaEtiqueta(d: DadosEtiqueta): Record<CampoId, string> {
  return {
    produto: d.produto,
    validade: d.validadeAte ? diaAno(d.validadeAte) : 'A DEFINIR',
    estado: ESTADOS.find((e) => e.id === d.estado)?.label.toUpperCase() ?? d.estado,
    fabricacao: `${dia(d.fabricacao)} ${hora(d.fabricacao)}`,
    quantidade: d.quantidade != null ? `${Number(d.quantidade.toFixed(3))} ${d.unidade ?? ''}`.trim() : '',
    lote: d.lote,
    colaborador: d.colaborador ?? '',
    empresa: d.empresa ?? '',
    qr: d.lote,
  }
}

/** campos que realmente saem: o layout, menos os desligados, menos os sem valor */
export function camposVisiveis(
  layout: CampoLayout[], valores: Record<CampoId, string>, desligados: CampoId[] = [],
): CampoLayout[] {
  return layout.filter((c) => !desligados.includes(c.id) && (valores[c.id] ?? '').trim() !== '')
}

// ---------------------------------------------------------------------------
// CONSUMIDOR 1 — ZPL (o que sai na Zebra)
// ---------------------------------------------------------------------------

/** ⚠️ sanitiza os controles do ZPL: `^` e `~` no meio de um nome quebrariam o comando */
const zplSafe = (s: string) => s.replace(/[\^~]/g, ' ')

export function montarZpl(
  d: DadosEtiqueta, layout: CampoLayout[] = MODELO_PADRAO, desligados: CampoId[] = [],
): string {
  const valores = valoresDaEtiqueta(d)
  const linhas = camposVisiveis(layout, valores, desligados).map((c) => {
    const texto = zplSafe(`${c.rotulo ?? ''}${valores[c.id]}`)
    if (c.tipo === 'qr') return `^FO${c.x},${c.y}^BQN,2,${c.qrTamanho ?? 5}^FDLA,${texto}^FS`
    // ⭐ destaque = vídeo invertido: caixa preta com texto branco. É o que faz a validade
    // ser lida de longe, com a mão fria, dentro da câmara.
    if (c.destaque) {
      const alturaCaixa = c.fonte + 14
      return [
        `^FO${c.x - 8},${c.y - 7}^GB${LADO_DOTS - c.x - 12},${alturaCaixa},${alturaCaixa}^FS`,
        `^FO${c.x},${c.y}^A0N,${c.fonte},${c.fonte}^FR^FD${texto}^FS`,
      ].join('\n')
    }
    return `^FO${c.x},${c.y}^A0N,${c.fonte},${c.fonte}^FD${texto}^FS`
  })
  return ['^XA', '^CI28', `^PW${LADO_DOTS}`, `^LL${LADO_DOTS}`, ...linhas, '^XZ'].join('\n')
}

// ---------------------------------------------------------------------------
// CONSUMIDOR 2 — a PRÉVIA (o que se vê na tela)
// ---------------------------------------------------------------------------

export interface CampoPrevia {
  id: CampoId
  texto: string
  /** % da caixa — a prévia é fiel em qualquer tamanho de tela */
  esquerda: number
  topo: number
  /** tamanho da fonte em % do lado da etiqueta (o CSS multiplica pelo tamanho real) */
  fontePct: number
  destaque: boolean
  tipo: 'texto' | 'qr'
  qrPct: number
}

/**
 * Os mesmos campos, em coordenadas relativas — pra a tela desenhar.
 * ⚠️ Note que ela chama `valoresDaEtiqueta` e `camposVisiveis`, as MESMAS do ZPL. É isso
 * que faz a prévia não poder divergir da impressão: campo que some de um some do outro.
 */
export function camposParaPrevia(
  d: DadosEtiqueta, layout: CampoLayout[] = MODELO_PADRAO, desligados: CampoId[] = [],
): CampoPrevia[] {
  const valores = valoresDaEtiqueta(d)
  return camposVisiveis(layout, valores, desligados).map((c) => ({
    id: c.id,
    texto: `${c.rotulo ?? ''}${valores[c.id]}`,
    esquerda: (c.x / LADO_DOTS) * 100,
    topo: (c.y / LADO_DOTS) * 100,
    fontePct: (c.fonte / LADO_DOTS) * 100,
    destaque: !!c.destaque,
    tipo: c.tipo,
    // o QR do ZPL tem ~ (magnification × 21) dots de lado nesta versão
    qrPct: (((c.qrTamanho ?? 5) * 21) / LADO_DOTS) * 100,
  }))
}

// ---------------------------------------------------------------------------
// VALIDADE POR ESTADO
// ---------------------------------------------------------------------------

/**
 * PURA. Calcula a validade a partir da fabricação e dos dias do estado escolhido.
 * ⚠️ Sem dias cadastrados devolve **null** (a etiqueta dirá "A DEFINIR") em vez de
 * chutar 7 dias — a mesma regra do "a apurar" do resto do módulo: número inventado numa
 * etiqueta de alimento é o pior lugar possível pra um palpite.
 */
export function calcularValidade(fabricacao: Date, dias: number | null | undefined): Date | null {
  if (dias == null || !(dias > 0)) return null
  const v = new Date(fabricacao)
  v.setDate(v.getDate() + dias)
  return v
}

/** dias sugeridos por estado quando o item ainda não tem os dele — SUGESTÃO, nunca gravada
 *  sozinha: a tela mostra e o dono confirma (é decisão de segurança alimentar dele). */
export const SUGESTAO_DIAS: Record<EstadoConservacao, number> = {
  CONGELADO: 90,
  RESFRIADO: 3,
  AMBIENTE: 1,
}
