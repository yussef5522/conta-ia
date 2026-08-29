// ⭐ DIVIDIR O TOTAL ENTRE AS PARCELAS (29/08/2026) — o sistema trabalha, o dono ajusta.
//
// Pedido do dono depois de usar a tela: *"quando eu ADICIONO ou REMOVO parcela, o sistema
// redistribui o total igualmente — centavos de resto na última (como toda nota faz).
// Digitar tudo na mão só se eu quiser."*
//
// ⚠️ O RESTO VAI NA ÚLTIMA, e não é detalhe: é assim que a própria NF-e da BOX PAPER faz
// (3.466,88 + 3.466,88 + **3.466,90** = 10.400,66). Dividir 10.400,66 por 3 dá
// 3.466,8866…; espalhar o centavo em qualquer outro lugar produziria uma soma que não
// fecha, e a validação passaria a cobrar motivo por um arredondamento nosso.
//
// ⚠️ E A DIVISÃO NUNCA APAGA O QUE O DONO DIGITOU À MÃO: ela só roda quando ele ADICIONA
// ou REMOVE uma linha (a contagem mudou, os valores antigos deixaram de fazer sentido).
// Editar um valor NÃO redistribui os outros — senão o "entrada maior" que ele citou seria
// impossível de digitar: cada número corrigiria o anterior.

const round2 = (n: number) => Math.round((n + 1e-9) * 100) / 100

/** Divide `total` em `n` partes iguais, com o resto de centavos na ÚLTIMA. */
export function dividirTotal(total: number, n: number): number[] {
  if (n <= 0) return []
  const centavos = Math.round(round2(total) * 100)
  const base = Math.floor(centavos / n)
  const partes = Array.from({ length: n }, () => base)
  partes[n - 1] += centavos - base * n // o resto inteiro, na última
  return partes.map((c) => c / 100)
}

/** Soma dias a uma data 'YYYY-MM-DD' e devolve no mesmo formato. */
export function somarDias(iso: string, dias: number): string {
  const d = new Date(`${iso.slice(0, 10)}T12:00:00.000Z`) // meio-dia: imune a fuso/DST
  if (Number.isNaN(d.getTime())) return ''
  d.setUTCDate(d.getUTCDate() + dias)
  return d.toISOString().slice(0, 10)
}

export const INTERVALO_PADRAO_DIAS = 30

/**
 * Sugere a data da PRÓXIMA parcela: +30 dias da última que tem data.
 * ⚠️ Se nenhuma tem data, devolve '' — o sistema não inventa a 1ª data (essa é do boleto,
 * e chutar "hoje+30" criaria vencimento falso com cara de combinado).
 */
export function proximaData(datas: string[], dias = INTERVALO_PADRAO_DIAS): string {
  const ultima = [...datas].reverse().find((d) => !!d)
  return ultima ? somarDias(ultima, dias) : ''
}

export interface LinhaParcela {
  valor: string // texto (é o que se digita)
  dVenc: string
}

const paraTexto = (n: number) => n.toFixed(2).replace('.', ',')

/**
 * Recalcula a lista quando a QUANTIDADE de parcelas muda.
 * Mantém as datas existentes; a linha nova ganha +30 dias da anterior.
 */
export function redistribuir(linhas: LinhaParcela[], total: number): LinhaParcela[] {
  const valores = dividirTotal(total, linhas.length)
  return linhas.map((l, i) => ({ ...l, valor: paraTexto(valores[i]) }))
}

export function adicionarParcela(linhas: LinhaParcela[], total: number): LinhaParcela[] {
  const nova: LinhaParcela = { valor: '', dVenc: proximaData(linhas.map((l) => l.dVenc)) }
  return redistribuir([...linhas, nova], total)
}

export function removerParcela(linhas: LinhaParcela[], indice: number, total: number): LinhaParcela[] {
  const restantes = linhas.filter((_, i) => i !== indice)
  return restantes.length ? redistribuir(restantes, total) : []
}
