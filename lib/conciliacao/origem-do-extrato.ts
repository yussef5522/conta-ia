/**
 * ⭐⭐⭐ ESTA LINHA VEIO DO EXTRATO DO BANCO? — A PERGUNTA COM UM DONO SÓ (01/10/2026).
 *
 * ⛔⛔⛔ **O DEFEITO QUE A CRIOU, medido em prod:** o dono importou o extrato do **banco
 * caixa** (um PDF — `Comprovante_2026-09-30_235031.pdf`) com 2 pagamentos de empréstimo,
 * juros, IOF, consórcio e PIX. **O import gravou as 7 linhas perfeitas** (`EFFECTED`,
 * `PENDING`, com `dedupHash`) — e na Conciliação **não apareceu NENHUMA**.
 *
 * **A causa era uma palavra:** a caixa filtrava `origin: 'OFX'`, e o import de PDF de
 * extrato grava `origin: 'PDF'`. ***O formato do arquivo decidia se a linha existia pra
 * conciliação.*** A única que o dono viu foi a transferência de R$ 10.000 — e só porque o
 * detector de par roda por outro caminho.
 *
 * ⚠️⚠️ **E ERAM DOIS LEITORES, não um** (REGRA 4): a `lerCaixa` **e** a
 * `LINHA_DISPONIVEL_WHERE` da fila. Consertar um deixaria os 2 pagamentos de empréstimo
 * (`DEBITO PRESTA SIEMP`, R$ 2.927,02 e R$ 7.526,06) visíveis na caixa e **invisíveis** pra
 * casar com a parcela — metade do conserto é pior que nenhum, porque parece resolvido.
 *
 * ⭐ **A RÉGUA, nas palavras do dono:** *"toda linha de extrato de QUALQUER conta da empresa
 * entra na caixa até ser resolvida — banco caixa incluído."* O que define *"linha de
 * extrato"* é **o banco ter registrado**, nunca o formato em que o arquivo chegou.
 *
 * ⛔ **E A LISTA É FECHADA, de propósito.** `MANUAL` (o dono digitou), `ESTOQUE_NF` (a
 * conta a pagar da nota) e `ADJUSTMENT` (ajuste de saldo) **não são linha de banco**: elas
 * não esperam *"o que é isto?"* — alguém já disse. Medido na Caçula, incluí-las jogaria
 * **369 linhas** na fila de trabalho, e *fila que cobra o que já foi decidido é como o dono
 * aprende a não olhar a fila*.
 */

/**
 * As origens que significam ***"o banco registrou esta linha"***.
 *
 * ⚠️ `PDF` é o extrato em PDF (a conta sem OFX — é o caso do banco caixa, que o banco só
 * entrega em PDF). Ela é tão extrato quanto o OFX: mesmo fato, outro formato.
 */
export const ORIGENS_DO_EXTRATO = ['OFX', 'PDF'] as const

export type OrigemDoExtrato = (typeof ORIGENS_DO_EXTRATO)[number]

/** ⭐ O FILTRO PRISMA — é ele que os leitores consomem, pra não existir uma 2ª lista. */
export const WHERE_ORIGEM_DO_EXTRATO = {
  origin: { in: ORIGENS_DO_EXTRATO as unknown as string[] },
} as const

export function ehLinhaDeExtrato(origin: string | null | undefined): boolean {
  return !!origin && (ORIGENS_DO_EXTRATO as readonly string[]).includes(origin)
}
