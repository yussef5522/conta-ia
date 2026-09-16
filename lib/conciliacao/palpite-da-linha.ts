// ⭐⭐⭐ O MELHOR PALPITE DA LINHA — a régua PURA do cartão ≍ (16/09/2026).
//
// **O mock v3 (`docs/mocks/conciliacao-caixa-mock-v3.html`) manda:** cada linha da caixa
// mostra, à direita, o **MELHOR PALPITE** — nome, detalhe, **a diferença SEMPRE NOMEADA**
// e um botão cujo rótulo diz **O EFEITO** (*"✓ Confirmar — baixa a fatura"*).
//
// ⛔⛔ **NENHUM MATCHER NASCE AQUI, e isso é o ponto.** Este arquivo **ESCOLHE e TRADUZ**
// o que os motores provados já devolveram:
//   CASAR_PAGAR ......... `sugerirVinculos` (a régua dos degraus, 12/09)
//   PARCELA_EMPRESTIMO .. `sugerirVinculoEmprestimo` (26/08)
//   PGTO_CARTAO ......... `resolvePaidInvoiceMonth` (a competência por VALOR, 17/08)
// Um matcher próprio aqui seria a **segunda régua** — a doença que custou os 7 detectores
// de par e os 3 números de agosto. *A tela não pode achar um par que o servidor recusa.*
//
// ⛔ **E O PALPITE SUGERE, NUNCA DECIDE** (a régua da casa desde 22/08): ele acende um
// botão; quem grava é o dono, pelo mesmo `resolverLinha` de sempre.

import type { AcaoDoBalcao, SentidoDaLinha } from './caixa-de-entrada'
import { acaoValePraSentido } from './caixa-de-entrada'

/** ⭐ o que a tela desenha no lado direito do cartão ≍ */
export interface PalpiteDaLinha {
  acao: AcaoDoBalcao
  /** o rótulo da faixa verde ("💳 PAGAMENTO DE FATURA") */
  familia: string
  /** o nome grande ("Fatura do cartão Sicredi") */
  titulo: string
  /** a linha fina de baixo ("fatura 2026-08 · R$ 3.194,35 · vence 15/09") */
  detalhe: string
  /**
   * ⛔ A DIFERENÇA É SEMPRE NOMEADA — é a pílula âmbar do mock, e ela existe mesmo
   * quando é ZERO (*"✓ valor exato — fecha em R$ 0,00"*). Diferença escondida foi o
   * defeito de 12/09, quando o dono viu 2.008,00 × 1.938,50 sem nada explicando.
   */
  diferenca: string
  /** ⭐ o rótulo do botão diz O EFEITO, nunca "confirmar" seco */
  botao: string
  /** o alvo que o `resolverLinha` precisa receber junto do gesto */
  alvo: Record<string, unknown>
  /** ⚠️ confiança BAIXA aparece com o aviso — o dono decide olhando, não no escuro */
  confianca: 'ALTA' | 'MEDIA' | 'BAIXA'
}

const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

/**
 * ⭐ A FRASE DA DIFERENÇA — um lugar só, porque ela aparece em todo palpite.
 *
 * ⚠️ O texto muda de TOM com o tamanho, mas **nunca some**: valor exato vira elogio
 * (*"fecha em R$ 0,00"*), diferença pequena vira explicação (*"juros/tarifa"*), e
 * diferença grande vira ALERTA — que é o que impede o clique rápido no par errado.
 */
export function frasePraDiferenca(diferenca: number, valorDaLinha: number): string {
  const d = Math.round(diferenca * 100) / 100
  if (Math.abs(d) <= 0.02) return `✓ valor exato — fecha em ${brl(0)}`
  const pct = valorDaLinha > 0 ? Math.abs(d) / valorDaLinha : 1
  const lado = d > 0 ? 'a mais' : 'a menos'
  if (pct > 0.1) return `⚠ diferença de ${brl(Math.abs(d))} ${lado} — confira antes`
  return `diferença de ${brl(Math.abs(d))} ${lado} — juros/tarifa?`
}

/**
 * ⭐⭐ O RÓTULO DO BOTÃO — **o efeito, nunca o gesto**.
 *
 * *"Confirmar"* seco não diz o que vai acontecer; *"baixa a fatura"* diz. É a mesma régua
 * que fez o `resolverLinha` devolver o efeito nomeado em vez de *"marquei"* (15/09).
 */
export function rotuloDoBotao(acao: AcaoDoBalcao, alvoNome?: string): string {
  switch (acao) {
    case 'PGTO_CARTAO': return '✓ Confirmar — baixa a fatura'
    case 'PARCELA_EMPRESTIMO': return '✓ Confirmar — marca a parcela paga'
    case 'CASAR_PAGAR': return alvoNome ? `✓ Confirmar — concilia a ${alvoNome}` : '✓ Confirmar — concilia a conta'
    case 'CASAR_RECEBER': return alvoNome ? `✓ Confirmar — baixa ${alvoNome}` : '✓ Confirmar — baixa o recebimento'
    case 'RECEBIMENTO_VENDA': return '✓ Confirmar — registra a receita do dia'
    case 'ESTORNO': return '✓ Confirmar — amarra ao estorno'
    case 'TRANSFERENCIA_ENVIADA':
    case 'TRANSFERENCIA_RECEBIDA': return '✓ Confirmar — casa a transferência'
    case 'CATEGORIA': return '✓ Confirmar — grava a categoria'
    case 'IGNORAR': return '✓ Confirmar — tira das filas'
  }
}

/** ⚠️ as ações de VÍNCULO não gravam no balcão — elas LEVAM ao alvo (o desenho de 15/09) */
const LEVAM_AO_ALVO: readonly AcaoDoBalcao[] = ['CASAR_PAGAR', 'CASAR_RECEBER', 'TRANSFERENCIA_ENVIADA', 'TRANSFERENCIA_RECEBIDA']

/** o candidato bruto que cada matcher produz, já traduzido pela camada de IO */
export interface CandidatoBruto {
  acao: AcaoDoBalcao
  familia: string
  titulo: string
  detalhe: string
  diferenca: number
  confianca: 'ALTA' | 'MEDIA' | 'BAIXA'
  alvo: Record<string, unknown>
  /** nome curto do alvo, pro rótulo do botão ("NF 1240679") */
  alvoNome?: string
}

const PESO = { ALTA: 3, MEDIA: 2, BAIXA: 1 } as const

/**
 * ⭐⭐⭐ A ESCOLHA. Entre os candidatos que os motores devolveram, **um** vira o palpite.
 *
 * **A ordem:** confiança primeiro, **diferença depois** — porque o dono confirma olhando
 * o nome, e um par "quase exato" de um fornecedor que ninguém reconheceu vale menos que
 * um par exato com nome batendo (a lição do falso-amigo, 11/09).
 *
 * ⛔ **E O EMPATE NÃO ESCOLHE NO ESCURO:** dois candidatos igualmente bons devolvem
 * `null` — *"não sei qual é"* é resposta, e é a trava do PAO DE MEL (09/09) e do
 * subset-sum (09/09). Melhor nenhum palpite que o palpite errado com botão gigante.
 */
export function escolherPalpite(
  candidatos: readonly CandidatoBruto[],
  sentido: SentidoDaLinha,
  valorDaLinha: number,
): PalpiteDaLinha | null {
  // ⛔ a lei do sentido vale aqui também: a tela não oferece o que o servidor recusaria
  const validos = candidatos.filter((c) => acaoValePraSentido(c.acao, sentido))
  if (validos.length === 0) return null

  const ordenados = [...validos].sort((a, b) => {
    if (PESO[a.confianca] !== PESO[b.confianca]) return PESO[b.confianca] - PESO[a.confianca]
    return Math.abs(a.diferenca) - Math.abs(b.diferenca)
  })

  const melhor = ordenados[0]!
  const vice = ordenados[1]
  if (vice && PESO[vice.confianca] === PESO[melhor.confianca] && Math.abs(Math.abs(vice.diferenca) - Math.abs(melhor.diferenca)) <= 0.02) {
    return null // empate técnico → "não sei qual é"
  }

  return {
    acao: melhor.acao,
    familia: melhor.familia,
    titulo: melhor.titulo,
    detalhe: melhor.detalhe,
    diferenca: frasePraDiferenca(melhor.diferenca, valorDaLinha),
    botao: rotuloDoBotao(melhor.acao, melhor.alvoNome),
    alvo: melhor.alvo,
    confianca: melhor.confianca,
  }
}

/** ⭐ a ação do palpite grava aqui mesmo, ou leva ao alvo? (a tela precisa saber) */
export function palpiteLevaAoAlvo(p: PalpiteDaLinha): boolean {
  return LEVAM_AO_ALVO.includes(p.acao)
}

// ═══════════════════════════════════════════════════════════════════════════════
// ⭐⭐ O ANEL DE PROGRESSO DO MÊS — deriva dos MESMOS contadores que a tela desenha
// ═══════════════════════════════════════════════════════════════════════════════

export interface ProgressoDoMes {
  pct: number
  resolvidas: number
  naCaixa: number
  /** a frase do mock: "190 resolvidas · 1 na caixa" */
  frase: string
}

/**
 * ⛔ **UMA LEITURA SÓ.** O anel sai de `contarEstacoes` — o MESMO objeto do badge do menu
 * e dos contadores das abas. Uma consulta própria pro anel seria a terceira derivação da
 * mesma pergunta, e ela divergiria no primeiro caso de borda (a lição do B1).
 *
 * ⚠️ **Caixa vazia com arquivo vazio não é 100%** — é *"nada importado ainda"*. Anel cheio
 * sobre o nada seria a tela se parabenizando por trabalho que não existe.
 */
export function progressoDoMes(c: { arquivo: number; saidas: number; entradas: number; total: number }): ProgressoDoMes {
  const naCaixa = c.saidas + c.entradas
  const pct = c.total > 0 ? Math.round((c.arquivo / c.total) * 100) : 0
  return {
    pct,
    resolvidas: c.arquivo,
    naCaixa,
    frase: c.total === 0 ? 'nada importado neste período' : `${c.arquivo} resolvidas · ${naCaixa} na caixa`,
  }
}
