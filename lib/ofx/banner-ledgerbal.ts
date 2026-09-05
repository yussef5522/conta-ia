// ⛔⛔⛔ "EXTRATO NÃO TRAZ SALDO FINAL (LEDGERBAL AUSENTE)" ERA MENTIRA (04/09/2026).
//
// **O arquivo TEM o LEDGERBAL.** Medido nos 4 blobs de setembro do Banrisul, com o parser
// de hoje: `<BALAMT>-8347.67` no `Extrato_20260904.ofx`, e o parser lê os quatro sem falhar
// (−8.347,67 · −9.960,26 · −6.419,60 · −4.925,96). **O parser NÃO regrediu.**
//
// ⛔ O MECANISMO ERA O OUTRO DA HIPÓTESE DO DONO — a família "N caminhos": a rota, ao aplicar
// o selo novo, mandava `{ ...check, available: false }` pra *esconder* a caixa nos bancos em
// que o LEDGERBAL não é régua (Banrisul). Só que `available:false` já tinha DONO e SIGNIFICADO
// no componente antigo: *"o arquivo não trouxe saldo"*. **Uma flag, dois significados** — e
// quem renderiza escolheu o significado errado, afirmando na cara do dono uma coisa que o
// arquivo desmente.
//
// ⭐ A CURA É SEPARAR AS DUAS PERGUNTAS, que nunca foram a mesma:
//     1. o ARQUIVO trouxe o saldo?           → `temNoArquivo`
//     2. esse saldo é RÉGUA neste banco?     → `ehReguaNesteBanco` (a ficha do banco)
//
// **No Banrisul a única mensagem sobre saldo é a faixa cinza do PDF** (o selo por dia).
// "LEDGERBAL ausente" volta a significar uma coisa só: *o arquivo não trouxe* — em qualquer
// banco.

export type EstadoDoBanner = 'OCULTO' | 'AUSENTE' | 'BATE' | 'NAO_BATE'

export interface SinaisDoBanner {
  /** o `<LEDGERBAL>` veio no arquivo? (fato do arquivo, nunca decisão de tela) */
  temNoArquivo: boolean
  /** a ficha do banco diz que esse saldo serve de régua? (Banrisul: não) */
  ehReguaNesteBanco: boolean
  /** o saldo declarado fecha com o nosso? (só faz sentido quando é régua) */
  bate: boolean
}

/**
 * O QUE a faixa de saldo diz. PURA — e é a decisão ÚNICA (o componente só ecoa).
 *
 * ⚠️ A ordem importa: **"não é régua aqui" vence "não veio no arquivo"**. Num banco onde o
 * saldo declarado mente, nem a ausência dele é notícia — o dono já foi instruído a anexar o
 * PDF pela faixa cinza, e uma segunda caixa sobre saldo na mesma tela é ruído que ensina a
 * ignorar as duas.
 */
export function estadoDoBanner(s: SinaisDoBanner): EstadoDoBanner {
  if (!s.ehReguaNesteBanco) return 'OCULTO'
  if (!s.temNoArquivo) return 'AUSENTE'
  return s.bate ? 'BATE' : 'NAO_BATE'
}
