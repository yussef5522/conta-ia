// ⛔⛔⛔ QUEM NÃO TEM CHAVE DE DINHEIRO NÃO VÊ TELA DE DINHEIRO (06/09/2026).
//
// **INCIDENTE:** o dono logou a conta do TABLET DA COZINHA (`EXECUTOR_PRODUCAO`, uma única
// chave: `stock.executar`) e a tela inicial abriu o **dashboard completo** — saldo total
// (−R$ 80.841,46), saldo por banco, receita, despesa, resultado, fluxo de 6 meses. Medido
// navegando: **31 valores em reais no HTML, os mesmos que o dono vê.**
//
// ⚠️ A SIDEBAR ESCONDIA os itens, e as APIs devolviam 403 — mas a página do dashboard monta
// os dados por **caminho próprio** (server component consultando o banco direto). *Esconder
// o link não é negar o dado.* É "linked tem duas portas" outra vez, agora no acesso: eu tinha
// medido as APIs e dado por seguro.
//
// ⛔ E O GUARD QUE DEVIA PEGAR ISSO EXISTIA — MAL FORMADO. Ele era:
//
//     const soEstoque = !chaves.has('transaction.view') && !chaves.has('*') && chaves.has('stock.view')
//
// Uma **denylist com exigência positiva no fim**: pra ser desviado era preciso TER
// `stock.view`. O papel novo (criado ontem) tem só `stock.executar` → `soEstoque` dava
// **false** → seguia direto pro dashboard. É exatamente o defeito que eu tinha acabado de
// consertar no proxy, com o comentário *"allowlist invertida, senão a próxima nasce com o
// defeito"* — e a próxima nasceu com o defeito.
//
// ⭐ A RÉGUA AGORA É POSITIVA E PELO DADO, não pelo papel: **para ver tela de dinheiro é
// preciso ter chave de dinheiro.** Papel novo, seja qual for, nasce SEM ver — e quem precisar
// ganha a chave, que é uma decisão visível.

/**
 * Os recursos que representam DINHEIRO. Ter qualquer chave deles é o que abre uma tela
 * financeira.
 *
 * ⚠️ `category` entra: o plano de contas é a espinha do DRE, e listar categorias já revela a
 * estrutura financeira da empresa. `stock` NÃO entra — estoque tem custo, mas é o módulo de
 * quem opera, e a fronteira que o dono desenhou é "estoque inteiro, sem financeiro".
 */
export const RECURSOS_DE_DINHEIRO = [
  'transaction', 'bank_account', 'dre', 'report', 'category',
] as const

/** a chave é de dinheiro? (`transaction.view` sim, `stock.view` não) */
export function ehChaveDeDinheiro(chave: string): boolean {
  if (chave === '*') return true
  const [recurso, acao] = chave.split('.')
  // `*.view` (o VIEWER) alcança `transaction.view` — logo, é chave de dinheiro
  if (recurso === '*' && acao) return true
  return (RECURSOS_DE_DINHEIRO as readonly string[]).includes(recurso ?? '')
}

/**
 * ⭐ A PERGUNTA ÚNICA: este conjunto de chaves pode ver tela de dinheiro? PURA.
 *
 * ⚠️ Conjunto VAZIO responde `false` — quem não está em empresa nenhuma não vê números de
 * empresa nenhuma. Antes o caminho vazio caía no dashboard e só o empty state segurava.
 */
export function podeVerFinanceiro(chaves: Iterable<string>): boolean {
  for (const k of chaves) if (ehChaveDeDinheiro(k)) return true
  return false
}

/**
 * ⭐⭐ A TELA INICIAL DE QUEM NÃO VÊ DINHEIRO. `null` = pode seguir pro dashboard.
 *
 * **Decisão do dono (06/09):** *"EXECUTOR_PRODUCAO cai direto em /cozinha/<empresa> como tela
 * inicial (login → cozinha, sem passar pelo dashboard)."*
 *
 * ⚠️ A ORDEM IMPORTA e é do mais específico pro mais geral: quem só executa vai pra janela da
 * cozinha; quem enxerga o estoque vai pra Posição (era o desvio de 30/08, e continua valendo
 * pro operador e pro gerente).
 *
 * ⛔ E sem empresa nenhuma devolve `null`: aí o dashboard mostra o empty state "você não está
 * em nenhuma empresa", que é a resposta honesta — mandar pra uma cozinha que não existe seria
 * trocar um problema por uma tela quebrada.
 */
export function telaInicialDe(chaves: Iterable<string>, empresaId: string | null): string | null {
  if (podeVerFinanceiro(chaves)) return null
  if (!empresaId) return null
  const set = chaves instanceof Set ? chaves : new Set(chaves)
  if (set.has('stock.view')) return `/empresas/${empresaId}/estoque/posicao`
  if (set.has('stock.executar')) return `/cozinha/${empresaId}`
  // ⚠️ papel sem chave nenhuma que a gente reconheça: NÃO manda pro dashboard (é justamente
  // o caso que criou o incidente). A Posição é o destino mais inofensivo que existe, e ela
  // própria nega se a pessoa não puder vê-la.
  return `/empresas/${empresaId}/estoque/posicao`
}
