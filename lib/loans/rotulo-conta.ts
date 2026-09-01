// ⭐ COMO A TELA CHAMA A CONTA DE UM EMPRÉSTIMO — inclusive quando não há conta (01/09/2026).
//
// ⛔ INCIDENTE que criou este arquivo: depois de `loans.bankAccountId` virar nullable, a
// carteira (`/emprestimos`) quebrou com "This page couldn't load". A rota devolvia **200** e
// o `pm2 logs` ficava **limpo** — crash de CLIENTE, a classe que este projeto já conhece.
// O componente fazia `{l.bankAccount.name}` sobre um `bankAccount` que agora vem `null`.
//
// ⚠️⚠️ POR QUE A AUDITORIA DAS 33 REFERÊNCIAS NÃO PEGOU: ela varreu **`bankAccountId`**, o
// ESCALAR. Estes pontos usam **`bankAccount`**, a RELAÇÃO — outro identificador. E o
// TypeScript não reclamou porque as páginas declaram a forma do payload em **interface
// escrita à mão** (`bankAccount: { id, name, bankName }`, sem `| null`), que não tem vínculo
// de tipo com o `select` do Prisma. Tipo escrito à mão sobre resposta de API é uma promessa,
// não uma prova.
//
// ⭐ E POR QUE ISTO É FUNÇÃO PURA e não um `?.` espalhado nas telas: `?? ''` em cada lugar
// faria a tela dizer "· Mútuo sem prazo" com um ponto solto no começo, e cada tela
// inventaria seu próprio texto. A frase é UMA, e tem teste.

export interface ContaDoEmprestimo {
  bankAccount?: { name: string } | null
}

/** ⭐ O nome da conta, ou a frase que explica a AUSÊNCIA — nunca vazio, nunca "null". */
export function rotuloDaConta(loan: ContaDoEmprestimo): string {
  return loan.bankAccount?.name ?? 'sem trânsito por conta'
}

/** `true` quando o mútuo não passou por conta nenhuma (pago direto pelo mutuante). */
export function semTransitoPorConta(loan: ContaDoEmprestimo): boolean {
  return !loan.bankAccount
}
