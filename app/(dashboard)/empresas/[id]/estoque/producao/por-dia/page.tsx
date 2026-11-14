// ⛔⛔ "Por dia" MORREU (lei R1 das referências da produção, 13/11/2026): Hoje ao vivo, Por dia, Por pessoa e
// Relatórios viraram DUAS telas — AO VIVO (o agora) e DESEMPENHO (a história). A rota velha só
// redireciona, pra link salvo e favorito não caírem num 404.
import { redirect } from 'next/navigation'

interface PageProps { params: Promise<{ id: string }> }

export default async function Page({ params }: PageProps) {
  const { id } = await params
  redirect(`/empresas/${id}/estoque/producao/desempenho`)
}
