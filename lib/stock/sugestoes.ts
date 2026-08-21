// ESTOQUE FASE 1 item 2 — sugestões pro cadastro nota-a-nota (o dono confirma, ~til).
// Categoria por palavra-chave + NCM; unidade de controle pelo uCom da nota. Puro.

export type CategoriaEstoque = 'MATERIA_PRIMA' | 'REVENDA' | 'EMBALAGEM' | 'LIMPEZA' | 'USO_INTERNO'
export type UnidadeControle = 'KG' | 'UN' | 'LT'

const norm = (s: string) =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, "").toUpperCase()

// Palavras que apontam categoria (ordem = prioridade).
const KEYWORDS: { cat: CategoriaEstoque; termos: string[] }[] = [
  { cat: 'LIMPEZA', termos: ['DETERGENTE', 'SABAO', 'DESINFETANTE', 'ALCOOL', 'CLORO', 'AGUA SANITARIA', 'LIMPA', 'AMACIANTE', 'MULTIUSO', 'LUSTRA'] },
  { cat: 'EMBALAGEM', termos: ['SACO', 'SACOLA', 'EMBALAGEM', 'COPO', 'GUARDANAPO', 'MARMITA', 'BOBINA', 'POTE', 'BANDEJA', 'PAPEL TOALHA', 'FILME PVC', 'CANUDO'] },
  { cat: 'REVENDA', termos: ['REFRIGERANTE', 'REFRI', 'CERVEJA', 'SUCO', 'AGUA MINERAL', 'BEBIDA', 'COLA', 'GUARANA', 'ENERGETICO', 'CHA GELADO', 'ISOTONICO'] },
  { cat: 'MATERIA_PRIMA', termos: ['CARNE', 'FRANGO', 'BOI', 'QUEIJO', 'MUSSARELA', 'OLEO', 'FARINHA', 'ACUCAR', 'TOMATE', 'BATATA', 'PAO', 'PRESUNTO', 'BACON', 'LEITE', 'OVO', 'MOLHO', 'MAIONESE', 'CATCHUP', 'ALFACE', 'CEBOLA', 'BACALHAU'] },
]

// Capítulo NCM (2 primeiros díg) → categoria.
const NCM_CAP: Record<string, CategoriaEstoque> = {
  '02': 'MATERIA_PRIMA', '03': 'MATERIA_PRIMA', '04': 'MATERIA_PRIMA', '07': 'MATERIA_PRIMA', '08': 'MATERIA_PRIMA',
  '10': 'MATERIA_PRIMA', '11': 'MATERIA_PRIMA', '15': 'MATERIA_PRIMA', '16': 'MATERIA_PRIMA', '17': 'MATERIA_PRIMA',
  '19': 'MATERIA_PRIMA', '20': 'MATERIA_PRIMA', '21': 'MATERIA_PRIMA',
  '22': 'REVENDA',
  '34': 'LIMPEZA',
  '39': 'EMBALAGEM', '48': 'EMBALAGEM',
}

/** Sugere a categoria (palavra-chave manda; NCM desempata; default USO_INTERNO). */
export function sugerirCategoria(xProd: string, ncm?: string | null): CategoriaEstoque {
  const t = norm(xProd)
  for (const { cat, termos } of KEYWORDS) if (termos.some((k) => t.includes(k))) return cat
  const cap = (ncm ?? '').replace(/\D/g, '').slice(0, 2)
  if (cap && NCM_CAP[cap]) return NCM_CAP[cap]
  return 'USO_INTERNO'
}

/** Sugere a unidade de controle pelo uCom da nota. null = "a definir" (o dono escolhe). */
export function sugerirUnidade(uCom?: string | null): UnidadeControle | null {
  const u = norm(uCom ?? '').replace(/[^A-Z]/g, '')
  if (['KG', 'KILO', 'QUILO', 'K'].includes(u)) return 'KG'
  if (['UN', 'UND', 'UNID', 'PC', 'PCT', 'CX', 'FD', 'DZ', 'PAR', 'PC'].includes(u)) return 'UN'
  if (['LT', 'L', 'LITRO', 'LTS', 'ML'].includes(u)) return 'LT'
  return null
}

/** Nome sugerido: limpa o xProd. Tira o PREFIXO NUMÉRICO do código do fornecedor
 *  ("5 COXAO MOLE..." → "COXAO MOLE...") — o número da linha/código não é nome. O dono
 *  encurta pro nome final ("Coxão Mole") no renomear inline. Colapsa espaços. */
export function sugerirNome(xProd: string): string {
  return xProd
    .replace(/^\s*\d{1,3}\s+(?=[A-Za-zÀ-ÿ])/, '') // prefixo numérico (só se sobrar letra)
    .replace(/\s{2,}/g, ' ')
    .trim()
}
