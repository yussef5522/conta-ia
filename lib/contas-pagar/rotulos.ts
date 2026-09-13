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
 * ⭐ A NOTA QUE DIZ ONDE ESTÁ O RESTO — e ela é obrigatória.
 *
 * Sem a segunda metade da frase o rótulo vira só uma ressalva ("sem conciliar") que
 * levanta a pergunta sem responder: *"então cadê as outras?"*. **Rótulo honesto que não
 * diz o caminho troca uma mentira por um mistério.**
 */
export const NOTA_CONCILIADAS = 'as já conciliadas estão em Movimentações'

/** ⚠️ o link é o MESMO destino do menu (`/transacoes?empresaId=`) — não inventa rota */
export const hrefMovimentacoes = (empresaId: string) => `/transacoes?empresaId=${empresaId}`
