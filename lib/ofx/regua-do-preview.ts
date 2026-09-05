// ⭐⭐ O PDF PODE CHEGAR DEPOIS DO OFX — e o gesto continua sendo UM (04/09/2026).
//
// ⛔ O BUG: anexar o PDF fazia `setPreview(null)` e a tela voltava pro começo. O dono lia
// como "perdi o OFX" e recomeçava — **o gesto único virou dois**.
//
// ⚠️ E o defeito seguinte era invisível: reconferir lendo `pdfDaRegua` do ESTADO pegaria o
// valor ANTERIOR ao `setPdfDaRegua` que acabou de rodar (React agenda, não aplica na hora).
// O preview voltaria **sem** o PDF, o selo não apareceria, e o dono concluiria que o arquivo
// não serviu. Por isso o arquivo recém-escolhido é passado por PARÂMETRO.
//
// ⭐ A decisão mora aqui, em função pura, e não dentro de um `useState` — a lição do prefill
// do cardápio: *regra que mora num `useState` é regra que ninguém prova* (o projeto roda em
// `environment: node`, sem jsdom).

/**
 * Qual PDF acompanha ESTE preview.
 *
 * @param recemEscolhido o arquivo que acabou de sair do input (`undefined` = ninguém escolheu
 *   agora; `null` = escolheu REMOVER — e remover tem que valer, senão o PDF errado gruda)
 * @param doEstado o que já estava anexado
 */
export function pdfDaConferencia(
  recemEscolhido: File | null | undefined, doEstado: File | null,
): File | null {
  return recemEscolhido !== undefined ? recemEscolhido : doEstado
}

/**
 * Dá pra reconferir INLINE, sem pedir o OFX de novo?
 *
 * ⚠️ Só quando o OFX ainda está na mão. Sem ele não há o que reconferir — e aí a tela pede
 * o arquivo, que é honesto; o que não pode é **jogar fora** um OFX que ela tem.
 */
export function podeReconferirInline(ofx: File | null): boolean {
  return ofx != null
}
