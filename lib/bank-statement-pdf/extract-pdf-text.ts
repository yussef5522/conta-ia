// Sprint Tela Contraparte (31/07/2026) — ÚNICA interface de extração de texto de
// PDF. Hoje: poppler (pdftotext -layout). Trocar de estratégia depois não deve
// exigir mexer no parser nem no fluxo — todo mundo chama extractPdfText().
//
// 🔒 Segurança (PDF é de terceiro, não confiável):
//  - execFile com ARRAY de args (NUNCA shell/string) → sem command injection.
//  - nome de arquivo tempo = uuid do servidor, nunca o nome do upload.
//  - dir temp dedicado, fora de caminho público.
//  - timeout 30s + maxBuffer → PDF malicioso morre sozinho.
//  - magic bytes %PDF antes de invocar o poppler.
//  - limite de tamanho antes de tocar o disco.
// 🔒 LGPD (contém nomes de PF):
//  - apaga PDF + .txt SEMPRE (finally), mesmo em erro.
//  - nunca persiste, nunca loga conteúdo/nome (só metadados).
//  - sweep de sobras antigas (caso um processo morra antes do finally).

import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { writeFile, readFile, unlink, mkdir, readdir, stat } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const execFileAsync = promisify(execFile)

const MAX_PDF_BYTES = 10 * 1024 * 1024
const TIMEOUT_MS = 30_000
const MAX_OUTPUT_BYTES = 20 * 1024 * 1024
const STALE_MS = 60 * 60 * 1000 // 1h
const TMP_DIR = join(tmpdir(), 'contaia-pdf-extract')

export class PdfExtractError extends Error {
  constructor(
    public code: 'NOT_A_PDF' | 'FILE_TOO_LARGE' | 'NO_TEXT_LAYER' | 'EXTRACT_FAILED',
    message: string,
  ) {
    super(message)
    this.name = 'PdfExtractError'
  }
}

/** Remove sobras antigas do dir temp (best-effort, não bloqueia). */
async function sweepStale(): Promise<void> {
  try {
    const now = Date.now()
    for (const f of await readdir(TMP_DIR)) {
      const full = join(TMP_DIR, f)
      const s = await stat(full).catch(() => null)
      if (s && now - s.mtimeMs > STALE_MS) await unlink(full).catch(() => {})
    }
  } catch {
    // dir ainda não existe — ok
  }
}

export async function extractPdfText(pdfBytes: Uint8Array): Promise<string> {
  if (pdfBytes.length > MAX_PDF_BYTES) {
    throw new PdfExtractError('FILE_TOO_LARGE', 'PDF maior que 10 MB.')
  }
  const head = Buffer.from(pdfBytes.slice(0, 5)).toString('latin1')
  if (!head.startsWith('%PDF-')) {
    throw new PdfExtractError('NOT_A_PDF', 'Arquivo não parece ser um PDF válido.')
  }

  await mkdir(TMP_DIR, { recursive: true, mode: 0o700 })
  void sweepStale()

  const id = randomUUID()
  const pdfPath = join(TMP_DIR, `${id}.pdf`)
  const txtPath = join(TMP_DIR, `${id}.txt`)
  try {
    await writeFile(pdfPath, pdfBytes, { mode: 0o600 })
    // pdftotext -layout preserva as colunas de largura fixa que o parser espera.
    await execFileAsync('pdftotext', ['-layout', '-enc', 'UTF-8', pdfPath, txtPath], {
      timeout: TIMEOUT_MS,
      maxBuffer: MAX_OUTPUT_BYTES,
    })
    const text = await readFile(txtPath, 'utf8')
    if (text.replace(/\s/g, '').length < 20) {
      throw new PdfExtractError(
        'NO_TEXT_LAYER',
        'PDF sem camada de texto (parece escaneado). Use o extrato digital do banco.',
      )
    }
    return text
  } catch (err) {
    if (err instanceof PdfExtractError) throw err
    // timeout, poppler ausente, PDF corrompido — mensagem genérica, sem stack pro client.
    throw new PdfExtractError('EXTRACT_FAILED', 'Não foi possível ler o PDF.')
  } finally {
    await unlink(pdfPath).catch(() => {})
    await unlink(txtPath).catch(() => {})
  }
}
