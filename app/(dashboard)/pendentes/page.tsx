// ⭐ ROTA LEGADA, REDIRECT PERMANENTE (15/09/2026).
//
// A tela dos Pendentes morreu — virou a CAIXA DE ENTRADA. Esta rota **fica**: link
// velho em e-mail, no histórico do navegador ou num print não pode virar 404.
// ⚠️ Redirect de uma linha não é lixo, é cortesia — e o guard da faxina garante que
// ela **não volte a ter item de menu** (rota morta que renasce em menu = vermelho).
// ⛔⛔⛔ PENDENTES DE CLASSIFICAÇÃO MORREU COMO TELA (15/09/2026).
//
// **A ordem do dono, no desenho das 3 estações:** *"PENDENTES DE CLASSIFICAÇÃO MORRE COMO
// TELA, no MESMO deploy, com realocação completa"* — e a régua da casa desde 14/09: *quando
// a tela nova assume, a velha morre no mesmo deploy; conviver "por enquanto" é como nasce a
// página com duas verdades.*
//
// ⛔ **POR QUE ELA PRECISAVA MORRER, e não só encolher:** ela era a SEGUNDA fila sobre o
// mesmo extrato. A linha aparecia lá (sem categoria) **e** na Conciliação (sem vínculo) — a
// mesma linha em duas filas, que é o invariante *"uma linha, uma estação"* sendo violado
// pela própria arquitetura das telas.
//
// ⭐ **REALOCAÇÃO COMPLETA — nada se perdeu** (o guard de mudança de casa):
//   · categorizar .................. o menu do sentido, na CAIXA DE ENTRADA
//   · casar com conta a pagar ...... o mesmo deep-link, agora como ação de SAÍDA
//   · transferência ................ ação de saída/entrada, levando ao `/parear`
//   · ignorar ...................... ação dos dois sentidos
//   · pgto de cartão / empréstimo .. **passaram a EFETIVAR** (eram opções mortas: o
//     `onChange` só tratava TRANSFER e IGNORAR — medido em 15/09)
//   · sugestão da IA e regra aprendida ... seguem no import (estação 1), que é onde o
//     automático mora; o que sobra pro balcão é só o que pede decisão.
//
// ⚠️ **REDIRECT, e não uma placa:** aqui não há dois papéis chegando (foi o que salvou a
// `/estoque/fichas` de virar redirect em 03/09). Quem vinha pra cá queria resolver linha de
// extrato — e é exatamente isso que a caixa faz, melhor.

import { redirect } from 'next/navigation'
import { resolveEmpresaAccess } from '@/lib/auth/resolve-empresa-access'
import { NoEmpresaSelectedState, NoAccessState } from '@/components/empresa/empty-empresa-state'

export default async function PendentesPage() {
  const access = await resolveEmpresaAccess()
  if (access.kind === 'no-empresa-selected') return <NoEmpresaSelectedState />
  if (access.kind === 'no-access' || access.kind === 'forbidden') return <NoAccessState />
  redirect(`/conciliacao?empresaId=${access.empresaId}`)
}
