// ⭐ ETIQUETA 60×60 — OS VALORES E AS REGRAS DE VALIDADE.
//
// ⚠️⚠️ ESTE ARQUIVO NÃO DESENHA MAIS NADA (31/08/2026). Ele teve um layout por
// COORDENADA FIXA (`MODELO_PADRAO`) com o seu próprio ZPL (`montarZpl`) e a sua própria
// prévia (`camposParaPrevia`). O `blocos.ts` substituiu os três em 30/08 — e eles ficaram
// aqui, **sem um único chamador em `app/`, `components/` ou `scripts/`**, vivos só nos
// próprios testes.
//
// ⛔ POR QUE APAGAR EM VEZ DE CONSERTAR: os dois carregavam a MESMA concatenação
// `${rotulo}${valor}` que produziu o "queijoPorção de carne 100g" em prod. Corrigir só o
// caminho vivo deixaria duas cópias da régua errada esperando alguém religar — é
// exatamente o padrão que já custou 7 detectores de transferência discordando entre si.
// **Uma decisão, uma função.** Quem desenha é `blocos.ts`.
//
// O que ficou aqui é o que não é desenho: o TEXTO de cada campo (`valoresDaEtiqueta`) e a
// regra de VALIDADE por estado de conservação.
//
// A régua: 60 mm a 203 dpi ≈ **480 dots**.

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
