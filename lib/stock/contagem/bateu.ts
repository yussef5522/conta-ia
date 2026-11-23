// ⭐ PORTA ÚNICA DO "BATEU" (23/11/2026) — o critério do cartão "Bateram" do Revisar.
//
// A lei v3 (R40) define acuracidade como "% de itens dentro da tolerância na última contagem", e o
// brief fixou a régua: É O MESMO CRITÉRIO DO CARTÃO "Bateram". Antes ele morava inline no
// `revisao-contagem.tsx`; agora o Revisar, o posto de comando, o cartão de contar (pontos verdes)
// e o recibo leem DAQUI — duas cópias divergiriam no primeiro ajuste de tolerância.
export const TOLERANCIA_BATEU = 1e-9

/** a contagem bateu com o sistema? (|divergência| dentro da tolerância) */
export function bateu(divergencia: number): boolean {
  return Math.abs(divergencia) <= TOLERANCIA_BATEU
}
