// ⭐⭐ O RESUMO DA FILA DE ENVIO (30/08/2026) — a régua do card, PURA e testável.
//
// ⛔ POR QUE ISTO EXISTE, com número: em 30/08 a conferência tinha 8 boletos parados
// (R$ 21.968,02) que nunca chegaram ao Contas a Pagar — R$ 6.237,26 já VENCIDOS e mais
// R$ 2.537,29 vencendo no dia. O juiz F3 avisava por e-mail desde sempre; ninguém viu.
// O card existe pra isso aparecer na tela que o dono abre todo dia — e o que decide o
// vermelho dele é esta função.
//
// ⚠️ MORA AQUI, e não dentro do componente, pela lição do prefill do cardápio: regra que
// vive num `useState` é regra que ninguém consegue provar (o projeto roda em
// `environment: node`, sem jsdom). Aqui ela roda contra os 8 boletos reais.
//
// ⚠️ E O RELÓGIO SÓ EXIBE: `hoje` é PARÂMETRO, nunca `new Date()` lá dentro. Nada nesta
// função filtra, descarta ou classifica — ela só rotula pra tela. O dia em que alguém
// quiser usar isto pra DECIDIR alguma coisa, tem que sair daqui (o princípio do módulo:
// "o relógio serve pra exibir 'hoje' na tela, nunca pra decidir").

export interface ParcelaNaFila {
  valor: number
  /** ISO da data de vencimento — pode faltar, e falta não é urgência */
  dVenc: string | null
}

export interface ResumoDaFila {
  n: number
  total: number
  /** venceu ANTES de hoje */
  vencidos: number
  /** vence HOJE */
  hoje: number
  /** soma de vencidos + hoje — é o número que justifica o vermelho */
  valorUrgente: number
  /** o card fica vermelho? */
  alerta: boolean
}

/** dias entre o vencimento e `hoje`, ambos lidos como DIA (sem hora) */
export function diasAteVencer(dVenc: string | null, hoje: Date): number | null {
  if (!dVenc) return null
  const d = new Date(dVenc)
  if (Number.isNaN(d.getTime())) return null
  // ⚠️ compara DIA com DIA em UTC: `dVenc` vem do banco em UTC e comparar instantes
  // faria um boleto de hoje virar "vencido" dependendo da hora em que o dono abre a tela.
  const venc = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
  const ref = Date.UTC(hoje.getFullYear(), hoje.getMonth(), hoje.getDate())
  return Math.round((venc - ref) / 86_400_000)
}

export function resumoDaFila(parcelas: ParcelaNaFila[], hoje: Date): ResumoDaFila {
  let total = 0
  let vencidos = 0
  let hojeN = 0
  let valorUrgente = 0

  for (const p of parcelas) {
    total += p.valor
    const d = diasAteVencer(p.dVenc, hoje)
    if (d === null) continue // ⚠️ sem vencimento não é urgente — é dado faltando, e
    //                          inventar urgência a partir de ausência treina o dono a
    //                          ignorar o vermelho (a lição dos 111 alarmes falsos).
    if (d < 0) { vencidos++; valorUrgente += p.valor }
    else if (d === 0) { hojeN++; valorUrgente += p.valor }
  }

  return {
    n: parcelas.length,
    total: Math.round(total * 100) / 100,
    vencidos,
    hoje: hojeN,
    valorUrgente: Math.round(valorUrgente * 100) / 100,
    alerta: vencidos + hojeN > 0,
  }
}
