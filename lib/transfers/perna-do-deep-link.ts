// ⭐ O `?abrir=` DO PAREAR — QUAL PERNA JÁ VEM ESCOLHIDA (17/09/2026).
//
// O chip *"transferência enviada/recebida"* da caixa de entrada leva pra `/parear?abrir=<tx>`.
// ⛔ Até hoje a tela **ignorava o parâmetro**: abria a lista genérica e o dono tinha que
// achar, numa lista de órfãs, a mesma linha que ele acabou de tocar. *Deep-link que abre a
// tela sem o alvo é porta pintada na parede* — a régua de 13/09, que este arquivo fecha.
//
// ⚠️ A regra mora aqui, FORA do componente, porque o projeto roda em `environment: node`:
// *regra que mora num `useState` é regra que ninguém prova* (a lição do prefill do cardápio).

export interface PernaCandidata { id: string }

export interface PernaEscolhida {
  debitId: string
  creditId: string
  /** ⭐ achou a linha? a tela precisa saber pra DIZER que já marcou (ou que não achou) */
  achou: 'DEBITO' | 'CREDITO' | null
}

/**
 * ⭐ Marca a perna que veio no deep-link, do lado a que ela pertence.
 *
 * ⛔ **Não inventa a outra perna.** Adivinhar o par é justamente o trabalho do detector
 * (que sugere e o dono confirma); pré-marcar os dois lados faria a tela propor um par que
 * ninguém avaliou — e casar transferência errada move dinheiro entre contas na conta errada.
 *
 * ⚠️ Linha que não está em nenhuma das listas devolve `achou: null` **sem marcar nada**:
 * ela pode já ter sido pareada, ou não ser órfã. A tela diz isso em vez de fingir.
 */
export function pernaDoDeepLink(
  abrirId: string | null | undefined,
  debitos: readonly PernaCandidata[],
  creditos: readonly PernaCandidata[],
): PernaEscolhida {
  if (!abrirId) return { debitId: '', creditId: '', achou: null }
  if (debitos.some((d) => d.id === abrirId)) return { debitId: abrirId, creditId: '', achou: 'DEBITO' }
  if (creditos.some((c) => c.id === abrirId)) return { debitId: '', creditId: abrirId, achou: 'CREDITO' }
  return { debitId: '', creditId: '', achou: null }
}
