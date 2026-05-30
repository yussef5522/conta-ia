// Sprint Export CSV+PDF (29/05/2026) — Cliente do worker (chamado do route handler).
//
// Spawn `tsx lib/export/pdf-worker.ts` como child process, manda
// payload via stdin (JSON), recebe PDF buffer via stdout.

import { spawn } from 'node:child_process'
import path from 'node:path'
import process from 'node:process'

const WORKER_TIMEOUT_MS = 30_000 // 30s — gera bem rápido pra qualquer relatório

export type WorkerReportType =
  | 'comparativo'
  | 'analise-variacao'
  | 'dre'
  | 'fluxo-caixa'
  | 'categorias'
  | 'fornecedores'
  | 'funcionarios'
  | 'variancias'

export async function renderPdfInWorker<TData, TCtx>(
  type: WorkerReportType,
  data: TData,
  ctx: TCtx,
): Promise<Buffer> {
  const workerPath = path.join(process.cwd(), 'lib/export/pdf-worker.ts')
  const tsxBin = path.join(process.cwd(), 'node_modules/.bin/tsx')

  return new Promise((resolve, reject) => {
    const child = spawn(tsxBin, [workerPath], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        // Garante NODE_PATH consistente (worker usa node_modules da raiz)
        NODE_PATH: path.join(process.cwd(), 'node_modules'),
      },
    })

    const stdoutChunks: Buffer[] = []
    const stderrChunks: Buffer[] = []

    child.stdout.on('data', (c: Buffer) => stdoutChunks.push(c))
    child.stderr.on('data', (c: Buffer) => stderrChunks.push(c))

    const timer = setTimeout(() => {
      child.kill('SIGKILL')
      reject(new Error(`PDF worker timeout (>${WORKER_TIMEOUT_MS}ms)`))
    }, WORKER_TIMEOUT_MS)

    child.on('error', (err) => {
      clearTimeout(timer)
      reject(err)
    })

    child.on('exit', (code, signal) => {
      clearTimeout(timer)
      if (code === 0) {
        const buffer = Buffer.concat(stdoutChunks)
        resolve(buffer)
      } else {
        const stderr = Buffer.concat(stderrChunks).toString('utf8')
        reject(
          new Error(
            `PDF worker exit code=${code} signal=${signal}\n${stderr}`,
          ),
        )
      }
    })

    // Envia payload via stdin
    const payload = JSON.stringify({ type, data, ctx })
    child.stdin.write(payload, 'utf8', (err) => {
      if (err) {
        clearTimeout(timer)
        reject(err)
        return
      }
      child.stdin.end()
    })
  })
}
