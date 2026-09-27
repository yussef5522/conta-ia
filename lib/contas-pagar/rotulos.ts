// ⭐⭐⭐ NENHUM RÓTULO PROMETE MAIS DO QUE ENTREGA (13/09/2026) — a régua do dono.
//
// **O caso:** ele procurou a parcela 002 do Casper em "PAGAS" e em "TODAS" e não achou em
// lugar nenhum. Ela ESTAVA paga — e conta paga **conciliada com a linha do extrato** sai
// desta tela por decisão de **28/05**, pra a mesma linha não aparecer em duas telas
// (`lifecycleScope` tem `reconciledWithId: null`).
//
// ⭐ **A decisão de 28/05 fica de pé** (ele mesmo recusou trazer a conciliada pra cá:
// *"linha em duas telas é duplicação"*). O que muda é a PROMESSA: um filtro chamado
// **"PAGAS"** que esconde metade das pagas, e um **"TODOS"** que não traz todos, são a
// família do cabeçalho que afirmava *"69 duplicatas"* com a aba dizendo 0.
//
// ⚠️ **E os rótulos moram AQUI, num lugar só.** O chip do rodapé, o card do topo e o
// dropdown filtram a MESMA coisa; três textos escritos à mão divergiriam no primeiro que
// alguém ajustasse — é a lição do B1 aplicada a texto de tela.

/** ⭐ o que este filtro REALMENTE entrega: paga e ainda **sem** linha do extrato vinculada */
export const ROTULO_PAGAS = 'Pagas (sem conciliar)'

/** ⛔ "Todos status" mentia: a conciliada nunca esteve aqui, em filtro nenhum */
export const ROTULO_TODOS = 'Em aberto e pagas sem vínculo'

/**
 * ⚠️⚠️ **`NOTA_CONCILIADAS` e `hrefMovimentacoes` MORRERAM em 26/09**, por decisão do dono:
 * *"MORRE a frase «…as já conciliadas estão em Movimentações →» (legenda de construção;
 * quem precisar de conciliadas acha em Movimentações sozinho)"*.
 *
 * ⚠️ **E há uma tensão real com a régua de 13/09, que fica registrada:** naquele dia a nota
 * nasceu porque *"rótulo honesto que não diz o caminho troca uma mentira por um mistério"*.
 * ⭐ O que o dono pesou: a ressalva que levanta a dúvida (**"(sem conciliar)"**) continua
 * nos RÓTULOS acima — o que saiu foi a **legenda permanente** ocupando a primeira dobra de
 * uma tela de trabalho. *Texto que se lê uma vez e nunca mais vira móvel fixo.*
 *
 * ⛔ Removidas e não guardadas: constante sem chamador é o que alguém religa por descuido.
 */

/**
 * ⭐⭐ 26/09 — OS RÓTULOS DO RECORTE DAS PAGAS.
 *
 * ⛔ **E eles resolvem uma mentira NOVA que o cartão criou hoje.** O card passou a contar
 * TODAS as pagas do mês; o preset dele manda `escopo: 'PAGA'` com `status: 'TODOS'`, e o
 * dropdown de status mostraria *"Em aberto e pagas sem vínculo"* **enquanto a lista traz as
 * conciliadas**. ⭐ Sob um escopo de pagas o dropdown deixa de perguntar `status` e passa a
 * perguntar **o recorte** — *um controle por pergunta*, a régua da limpeza de hoje.
 *
 * ⚠️ O `ROTULO_PAGAS` acima continua honesto onde vive: ali a pergunta é `status=RECONCILED`,
 * e por aquele caminho o `lifecycleScope` segue excluindo a conciliada (a decisão de 28/05).
 */
export const ROTULO_RECORTE = {
  PAGA: 'Todas as pagas do mês',
  PAGA_CONCILIADA: 'Só conciliadas com o banco',
  PAGA_SEM_VINCULO: 'Só sem vínculo',
} as const
