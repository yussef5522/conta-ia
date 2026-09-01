// ⭐⭐ MÚTUO SEM TRÂNSITO POR CONTA — o guard que impede `null` de virar filtro (01/09/2026).
//
// ⛔ A CLASSE DE BUG QUE ISTO EXISTE PRA MATAR, nomeada pelo dono ao autorizar a migration:
// *"null não pode virar filtro que casa com tudo — é a mesma classe do `includes('')`."*
//
// Quando `loans.bankAccountId` virou nullable, **8 pontos** do módulo passaram a poder
// receber `null` num lugar onde antes havia garantia de string:
//   · 5 filtros Prisma `where: { bankAccountId: loan.bankAccountId }` → viram `IS NULL` e
//     passam a casar com **transações órfãs de conta** (as PAYABLE/RECEIVABLE sem conta
//     definida, que existem aos montes) — oferecendo pra vincular à parcela um lançamento
//     que não tem nada a ver com o contrato;
//   · 1 `where: { bankAccountId: { in: [...] } }` com `null` na lista — mesma coisa;
//   · 2 comparações `if (tx.bankAccountId !== loan.bankAccountId)`, que com os dois `null`
//     dão **false** e **APROVAM** o vínculo em vez de recusar. Esta é a pior: o guard que
//     existia pra proteger vira porta aberta, em silêncio.
//
// ⚠️ E o pior caso é o `?? undefined`: em Prisma, `undefined` num `where` **remove o
// filtro**, e aí a query casa com o banco inteiro. Nenhum dos 8 fazia isso hoje, mas é o
// próximo passo natural de quem for "consertar o null" sem entender — por isso o teste
// cobre essa forma também.
//
// ⭐ A RÉGUA, e ela é conceitual antes de ser técnica: **um mútuo que não transita por conta
// NÃO TEM transação bancária pra casar.** Não existe resposta certa pra "quais lançamentos
// do extrato são deste contrato" — a resposta é "nenhum, por construção". Então o caminho
// certo é RECUSAR CEDO, com a frase que explica, e nunca rodar uma query que finge procurar.

export class MutuoSemContaError extends Error {
  constructor(public readonly acao: string) {
    super(
      `Este mútuo não transita por conta bancária (foi pago direto pelo mutuante), ` +
      `então não há lançamento de extrato pra ${acao}. ` +
      `As devoluções, quando saírem de uma conta sua, se vinculam normalmente.`,
    )
    this.name = 'MutuoSemContaError'
  }
}

/**
 * Garante que o contrato TEM conta antes de qualquer caminho que procure transação dela.
 * Devolve o id já estreitado pra `string` — então o call-site não consegue passar `null`
 * adiante nem sem querer (o TypeScript recusa).
 */
export function exigeContaDoEmprestimo(
  loan: { bankAccountId: string | null },
  acao: string,
): string {
  if (!loan.bankAccountId) throw new MutuoSemContaError(acao)
  return loan.bankAccountId
}

/** Versão que não lança — pra listagens que devem PULAR o contrato em vez de quebrar. */
export function temContaBancaria(loan: { bankAccountId: string | null }): boolean {
  return loan.bankAccountId != null
}
