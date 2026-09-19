// Sprint Fechar-Ponte (08/08/2026) — tela de resolver retiradas órfãs EM LOTE.
// Escolhe perfil PF + conta + tipo (+ gasto, fluxo A/B) UMA vez, vê o preview
// com a lista completa (descrição/data/valor/conta/categoria), desmarca o que
// não for, confirma. NUNCA grava sem preview + confirmação.

import { LoteRetiradasClient } from './lote-client'
import { RetiradasConcluidas } from '@/components/withdrawals/RetiradasConcluidas'

export default async function RetiradasLotePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return (
    <div className="space-y-6">
      <LoteRetiradasClient empresaId={id} />
      {/*
        ⭐ AS CONCLUÍDAS (19/09) — a tela só mostrava as PENDENTES, e o dono ficava sem
        saber se as que ele mandou deram certo: *"fiz 2 que teriam ido pra PF e não sei"*.
        Cada uma linka pra ponte, que mostra as DUAS pontas.
      */}
      <RetiradasConcluidas empresaId={id} />
    </div>
  )
}
