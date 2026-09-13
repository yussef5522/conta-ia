// ⛔ O PAINEL /mes MORREU — virou a home (13/09).
//
// *"o painel /mes atual vira esse ou morre, NUNCA dois painéis"* (ordem do dono). O
// redirect fica porque link antigo não pode quebrar — mas a TELA não existe mais, e é isso
// que impede alguém de religar a segunda resposta pro mesmo mês.

import { redirect } from 'next/navigation'

export default async function MesRedirect({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  redirect(`/perfis/${id}`)
}
