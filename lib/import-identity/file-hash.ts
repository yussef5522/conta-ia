// Sprint Import Idempotente (18/06/2026) — fileHash do arquivo cru.
//
// Hash sha256 do conteúdo binário literal do upload. Usado pelo
// ImportBatch pra detectar "voce ja importou ESTE arquivo" antes mesmo
// de parsear (idempotência de arquivo).

import { createHash } from 'crypto'

/**
 * sha256 hex do buffer/Uint8Array do arquivo upload.
 */
export function computeFileHash(buf: Uint8Array | Buffer | ArrayBuffer): string {
  const view =
    buf instanceof ArrayBuffer ? new Uint8Array(buf) : (buf as Uint8Array)
  return createHash('sha256').update(view).digest('hex')
}
