// Uma trava de arquivo (O_EXCL) entre o laço do sync e a guarda rodada na mão: os dois escrevem
// o espelho dos MESMOS pedidos — juntos, disputariam o upsert. Trava velha (> 30 min) é de
// processo morto e é tomada.
import { openSync, closeSync, unlinkSync, statSync, writeSync } from 'node:fs'

export const TRAVA_VELHA_MS = 30 * 60_000

export function tentarTravar(caminho: string, agora = Date.now()): boolean {
  try {
    const fd = openSync(caminho, 'wx')
    writeSync(fd, String(process.pid))
    closeSync(fd)
    return true
  } catch {
    try {
      if (agora - statSync(caminho).mtimeMs > TRAVA_VELHA_MS) { unlinkSync(caminho); return tentarTravar(caminho, agora) }
    } catch { /* sumiu entre o open e o stat: tenta de novo no próximo ciclo */ }
    return false
  }
}

export function soltar(caminho: string): void {
  try { unlinkSync(caminho) } catch { /* já solta */ }
}
