// ⭐⭐ O MODELO DE ETIQUETA EM BLOCOS (30/08/2026) — o dono DESENHA, não só configura.
//
// ⚠️ POR QUE TROQUEI COORDENADA FIXA POR FLUXO DE BLOCOS: "arrastar pra reordenar" e
// "adicionar linha de texto livre" são impossíveis com x/y cravados — mover um campo
// exigiria recalcular o y de todos os outros na mão, e uma linha nova empurraria tudo.
// Com FLUXO, a ordem da lista É o layout: o y de cada bloco sai do empilhamento. O dono
// arrasta; o sistema calcula.
//
// ⭐ E A FONTE CONTINUA ÚNICA: `blocosParaLayout` transforma a lista em posições, e tanto
// o ZPL quanto a prévia consomem ESSA saída. Prévia do editor == prévia da tela de
// imprimir == o que sai da Zebra, nos três lugares, porque os três chamam a mesma função.

import type { CampoId, DadosEtiqueta } from './modelo'
import { LADO_DOTS, valoresDaEtiqueta } from './modelo'

export type TipoBloco = 'campo' | 'texto' | 'qr'

export interface Bloco {
  /** identidade estável (o React precisa, e o arrastar também) */
  id: string
  tipo: TipoBloco
  /** qual campo do sistema (tipo 'campo') */
  campo?: CampoId
  /** conteúdo fixo (tipo 'texto') — "Mantenha congelado", CNPJ, telefone… */
  texto?: string
  /** rótulo que o DONO escreve: "FAB", "FABRICAÇÃO", "MANIP." ou vazio */
  rotulo: string
  /** altura da fonte em dots (a etiqueta tem 480 de lado) */
  fonte: number
  negrito?: boolean
  /** vídeo invertido — a linha que tem que ser lida de longe */
  destaque?: boolean
  ativo: boolean
  /** só QR: magnificação (1..10) */
  qrTamanho?: number
}

export const MARGEM = 18
/** respiro entre blocos, em dots */
export const ESPACO = 12

/** ⭐ o modelo que toda empresa começa — a ordem é a da leitura da cozinha:
 *  o que é → quando vence → o resto. */
export const BLOCOS_PADRAO: Bloco[] = [
  { id: 'produto', tipo: 'campo', campo: 'produto', rotulo: '', fonte: 40, negrito: true, ativo: true },
  { id: 'validade', tipo: 'campo', campo: 'validade', rotulo: 'VAL ', fonte: 44, destaque: true, ativo: true },
  { id: 'estado', tipo: 'campo', campo: 'estado', rotulo: '', fonte: 24, ativo: true },
  { id: 'fabricacao', tipo: 'campo', campo: 'fabricacao', rotulo: 'FAB ', fonte: 24, ativo: true },
  { id: 'quantidade', tipo: 'campo', campo: 'quantidade', rotulo: '', fonte: 24, ativo: true },
  { id: 'lote', tipo: 'campo', campo: 'lote', rotulo: 'LOTE ', fonte: 24, ativo: true },
  { id: 'colaborador', tipo: 'campo', campo: 'colaborador', rotulo: '', fonte: 22, ativo: true },
  { id: 'empresa', tipo: 'campo', campo: 'empresa', rotulo: '', fonte: 20, ativo: true },
  { id: 'qr', tipo: 'qr', rotulo: '', fonte: 0, qrTamanho: 5, ativo: true },
]

export const novoBlocoTexto = (texto = 'Texto novo'): Bloco => ({
  id: `texto-${Math.random().toString(36).slice(2, 9)}`,
  tipo: 'texto', texto, rotulo: '', fonte: 22, ativo: true,
})

// ---------------------------------------------------------------------------
// O LAYOUT CALCULADO — a fonte única
// ---------------------------------------------------------------------------

export interface BlocoPosicionado {
  bloco: Bloco
  /** texto final já com rótulo (vazio = não desenha) */
  valor: string
  x: number
  y: number
  /** altura ocupada em dots */
  altura: number
}

export interface LayoutCalculado {
  blocos: BlocoPosicionado[]
  /** altura usada pelo fluxo de texto */
  alturaUsada: number
  /** ⚠️ passou dos 480 dots — não cabe na etiqueta */
  estourou: boolean
  qr: BlocoPosicionado | null
}

/**
 * Empilha os blocos ATIVOS de cima pra baixo e devolve as posições.
 *
 * ⚠️ O QR NÃO ENTRA NO FLUXO: ele é ancorado no canto inferior direito. Se entrasse,
 * comeria ~105 dots de altura (de 480) e empurraria o resto pra fora — a etiqueta é
 * pequena e o QR é quadrado. A tela diz isso pro dono, pra ele não achar que arrastar o
 * QR muda a posição dele.
 */
export function blocosParaLayout(blocos: Bloco[], dados: DadosEtiqueta): LayoutCalculado {
  const valores = valoresDaEtiqueta(dados)
  const out: BlocoPosicionado[] = []
  let y = MARGEM
  let qr: BlocoPosicionado | null = null

  for (const b of blocos) {
    if (!b.ativo) continue
    if (b.tipo === 'qr') {
      const lado = (b.qrTamanho ?? 5) * 21
      qr = { bloco: b, valor: valores.qr, x: LADO_DOTS - lado - MARGEM, y: LADO_DOTS - lado - MARGEM, altura: lado }
      continue
    }
    const bruto = b.tipo === 'texto' ? (b.texto ?? '') : (valores[b.campo as CampoId] ?? '')
    // ⚠️ campo sem valor não ocupa linha — senão a etiqueta ganharia buracos quando o
    // produto não tem colaborador ou quantidade.
    if (!bruto.trim()) continue
    const valor = `${b.rotulo ?? ''}${bruto}`
    const altura = b.destaque ? b.fonte + 14 : b.fonte
    out.push({ bloco: b, valor, x: MARGEM, y, altura })
    y += altura + ESPACO
  }

  return { blocos: out, alturaUsada: y - ESPACO - MARGEM, estourou: y > LADO_DOTS, qr }
}

// ---------------------------------------------------------------------------
// CONSUMIDOR 1 — ZPL
// ---------------------------------------------------------------------------

const zplSafe = (s: string) => s.replace(/[\^~]/g, ' ')

export function zplDosBlocos(blocos: Bloco[], dados: DadosEtiqueta): string {
  const l = blocosParaLayout(blocos, dados)
  const linhas: string[] = []
  for (const p of l.blocos) {
    const texto = zplSafe(p.valor)
    if (p.bloco.destaque) {
      linhas.push(`^FO${p.x - 8},${p.y - 7}^GB${LADO_DOTS - p.x - 12},${p.altura},${p.altura}^FS`)
      linhas.push(`^FO${p.x},${p.y}^A0N,${p.bloco.fonte},${p.bloco.fonte}^FR^FD${texto}^FS`)
    } else {
      // ⚠️ "negrito" em ZPL não é uma flag: engrossa-se imprimindo o texto 2× com 1 dot
      // de deslocamento. É o truque padrão da Zebra pra fonte escalável.
      linhas.push(`^FO${p.x},${p.y}^A0N,${p.bloco.fonte},${p.bloco.fonte}^FD${texto}^FS`)
      if (p.bloco.negrito) linhas.push(`^FO${p.x + 1},${p.y}^A0N,${p.bloco.fonte},${p.bloco.fonte}^FD${texto}^FS`)
    }
  }
  if (l.qr) linhas.push(`^FO${l.qr.x},${l.qr.y}^BQN,2,${l.qr.bloco.qrTamanho ?? 5}^FDLA,${zplSafe(l.qr.valor)}^FS`)
  return ['^XA', '^CI28', `^PW${LADO_DOTS}`, `^LL${LADO_DOTS}`, ...linhas, '^XZ'].join('\n')
}

// ---------------------------------------------------------------------------
// CONSUMIDOR 2 — a PRÉVIA (mesma função de layout)
// ---------------------------------------------------------------------------

export interface PreviaBloco {
  id: string
  texto: string
  esquerda: number
  topo: number
  fontePct: number
  alturaPct: number
  destaque: boolean
  negrito: boolean
  tipo: TipoBloco
}

export function previaDosBlocos(blocos: Bloco[], dados: DadosEtiqueta): { campos: PreviaBloco[]; estourou: boolean } {
  const l = blocosParaLayout(blocos, dados)
  const pct = (n: number) => (n / LADO_DOTS) * 100
  const campos: PreviaBloco[] = l.blocos.map((p) => ({
    id: p.bloco.id, texto: p.valor,
    esquerda: pct(p.x), topo: pct(p.y),
    fontePct: pct(p.bloco.fonte), alturaPct: pct(p.altura),
    destaque: !!p.bloco.destaque, negrito: !!p.bloco.negrito, tipo: p.bloco.tipo,
  }))
  if (l.qr) {
    campos.push({
      id: 'qr', texto: l.qr.valor, esquerda: pct(l.qr.x), topo: pct(l.qr.y),
      fontePct: 0, alturaPct: pct(l.qr.altura), destaque: false, negrito: false, tipo: 'qr',
    })
  }
  return { campos, estourou: l.estourou }
}

// ---------------------------------------------------------------------------
// ⚠️ O MÍNIMO SANITÁRIO — AVISA, NÃO TRAVA
// ---------------------------------------------------------------------------

/**
 * ⚠️ Regra do módulo aplicada de novo: **avisa, nunca trava**. Etiqueta sem validade não
 * atende a Vigilância — mas quem responde pela cozinha é o dono, e travar aqui só o
 * empurraria pra escrever a validade à mão numa fita crepe (que é pior: sai do sistema).
 */
export function avisosDoModelo(blocos: Bloco[]): string[] {
  const ativo = (campo: CampoId) => blocos.some((b) => b.ativo && b.tipo === 'campo' && b.campo === campo)
  const avisos: string[] = []
  if (!ativo('validade')) {
    avisos.push('Sem a VALIDADE, a etiqueta não atende a Vigilância Sanitária — e é a informação que evita servir comida vencida.')
  }
  if (!ativo('fabricacao')) {
    avisos.push('Sem a data de FABRICAÇÃO/manipulação não dá pra provar quando o produto foi feito.')
  }
  if (!ativo('produto')) {
    avisos.push('Sem o NOME do produto a etiqueta não identifica o que está no pacote.')
  }
  if (!ativo('lote') && !blocos.some((b) => b.ativo && b.tipo === 'qr')) {
    avisos.push('Sem LOTE nem QR não há rastro: se houver um problema, não dá pra saber de qual produção veio.')
  }
  return avisos
}

// ---------------------------------------------------------------------------
// SERIALIZAÇÃO (o que vai pro banco)
// ---------------------------------------------------------------------------

const CAMPOS_VALIDOS: CampoId[] = ['produto', 'fabricacao', 'validade', 'estado', 'lote', 'quantidade', 'colaborador', 'empresa', 'qr']

/**
 * Lê os blocos do banco com desconfiança: JSON é texto, e texto pode vir torto (edição
 * manual, versão antiga, bug). Bloco inválido é DESCARTADO, não derruba a etiqueta —
 * imprimir sem uma linha é melhor que não imprimir.
 */
export function lerBlocos(json: string | null | undefined): Bloco[] {
  if (!json) return BLOCOS_PADRAO
  try {
    const bruto = JSON.parse(json)
    if (!Array.isArray(bruto)) return BLOCOS_PADRAO
    const ok = bruto.filter((b: Partial<Bloco>) =>
      typeof b?.id === 'string' &&
      (b.tipo === 'texto' || b.tipo === 'qr' || (b.tipo === 'campo' && CAMPOS_VALIDOS.includes(b.campo as CampoId))) &&
      typeof b.fonte === 'number' && b.fonte >= 0 && b.fonte <= 120,
    ) as Bloco[]
    return ok.length ? ok : BLOCOS_PADRAO
  } catch {
    return BLOCOS_PADRAO
  }
}

export const gravarBlocos = (blocos: Bloco[]) => JSON.stringify(blocos)
