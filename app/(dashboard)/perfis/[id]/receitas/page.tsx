// Sprint Receitas-PF (02/07/2026).
//
// /perfis/[id]/receitas — irmã de /perfis/[id]/despesas. Mostra TUDO que
// entrou (retiradas PJ via ponte + rendas externas).

'use client'

import { use } from 'react'
import { ReceitasPFClient } from './receitas-pf-client'

export default function ReceitasPFPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  return <ReceitasPFClient profileId={id} />
}
