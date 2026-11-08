/**
 * ⭐ 08/11/2026 — quem ainda usa uma ficha FORA do grupo de grafias em conflito, e a frase
 * do aviso. Módulo PURO (sem prisma) porque a tela e a porta usam a MESMA régua: o
 * comparador mostra o aviso, a porta recusa inativar sem o "mesmo assim".
 */
export interface ConsumidoresDeFora {
  /** grafias do PDV de OUTRO produto que apontam pra ela */
  outrasGrafias: string[]
  /** sabores/complementos mapeados pra ela */
  complementos: string[]
  /** tamanhos de pizza que a usam como base */
  basesDeTamanho: string[]
  /** fichas ATIVAS cuja versão atual a usa como ingrediente */
  emOutrasFichas: string[]
  /** ordens de produção ainda abertas */
  ordensAbertas: number
}

/** frases do aviso (vazio = nada de fora usa a ficha → inativar pode vir marcado) */
export function avisoDosConsumidores(c: ConsumidoresDeFora): string[] {
  const out: string[] = []
  if (c.outrasGrafias.length) out.push(`grafias de outro produto: ${c.outrasGrafias.join(', ')}`)
  if (c.complementos.length) out.push(`complementos: ${c.complementos.join(', ')}`)
  if (c.basesDeTamanho.length) out.push(`base dos tamanhos: ${c.basesDeTamanho.join(', ')}`)
  if (c.emOutrasFichas.length) out.push(`ingrediente de: ${c.emOutrasFichas.join(', ')}`)
  if (c.ordensAbertas) out.push(`${c.ordensAbertas} ordem(ns) de produção aberta(s)`)
  return out
}
