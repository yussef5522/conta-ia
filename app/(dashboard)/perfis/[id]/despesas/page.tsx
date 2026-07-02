// Sprint Despesas-PF (02/07/2026).
//
// /perfis/[id]/despesas — tela de despesas pessoais nível Monarch/Copilot
// + diferencial CAIXAOS (marcador "veio de retirada PJ").
//
// Wrapper que passa params. Todo o fetch acontece no client (padrão PF —
// mesma decisão do Sprint Dashboard PF que é 100% client).

'use client'

import { use } from 'react'
import { DespesasPFClient } from './despesas-pf-client'

export default function DespesasPFPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  return <DespesasPFClient profileId={id} />
}
