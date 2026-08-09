// Sprint Fechar-Ponte (08/08/2026) — tela de resolver retiradas órfãs EM LOTE.
// Escolhe perfil PF + conta + tipo (+ gasto, fluxo A/B) UMA vez, vê o preview
// com a lista completa (descrição/data/valor/conta/categoria), desmarca o que
// não for, confirma. NUNCA grava sem preview + confirmação.

import { LoteRetiradasClient } from './lote-client'

export default async function RetiradasLotePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return <LoteRetiradasClient empresaId={id} />
}
