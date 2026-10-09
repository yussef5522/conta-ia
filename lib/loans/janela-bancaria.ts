/**
 * ⛔⛔⛔ A JANELA BANCÁRIA NÃO ALCANÇA O MÚTUO FLEXÍVEL — a recusa num lugar só (09/10/2026).
 *
 * **O dono, com a devolução de R$ 40.000 na mão:** *"o «Marcar paga» só concilia débito de
 * extrato com valor ±R$ 1 e janela ±7d do vencimento — régua de BANCO que não serve pra mútuo
 * de cofre com valor livre. No FLEXIBLE ele sai da tela; o botão novo é a porta."*
 *
 * ⚠️ **E A RECUSA É DO SERVIDOR, nunca do botão escondido.** Esconder na tela é combinado: a
 * rota pode ser chamada por script, por cliente copiado ou por tela em cache — é a régua do
 * FREIO da contagem (23/08) e a da trava do retalho (09/10).
 *
 * ⭐ **Por que a janela não pode valer aqui, e isso é estrutural:** ela casa valor CONHECIDO
 * perto do VENCIMENTO. No mútuo o valor é livre (40k · 50k · 50k nas três devoluções reais) e
 * a data é a do CAIXA — então a lista sai **vazia por construção**, e o dono fica achando que
 * o pagamento dele não importou. A porta do flexível é `devolucao-flexivel.ts`, e **duas
 * portas pro mesmo fato é a doença que esta casa mais paga.**
 */
export class JanelaBancariaNoFlexivelError extends Error {
  readonly code = 'JANELA_BANCARIA_NO_FLEXIVEL'
  constructor() {
    super(
      'Mútuo flexível não casa por janela bancária: o valor da devolução é livre e a data é a ' +
        'do caixa, não a do vencimento. Use «Registrar devolução» — ela cria a saída e o vínculo ' +
        'no mesmo gesto, ou casa com a saída que você já lançou.',
    )
    this.name = 'JanelaBancariaNoFlexivelError'
  }
}

/** ⚠️ um só lugar decide — os dois ramos (candidatos e o POST da parcela) chamam ESTA */
export function ehJanelaBancaria(scheduleSource: string | null | undefined): boolean {
  return scheduleSource !== 'FLEXIBLE'
}
