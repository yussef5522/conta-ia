// Sprint Export CSV+PDF (29/05/2026) — Worker standalone Node + tsx.
//
// Roda em processo separado spawned pelo route handler.
// Recebe JSON via stdin: { type, data, ctx }
// Escreve PDF buffer (Uint8Array) via stdout (raw bytes).
//
// Por que isso é necessário:
// - Next 16 injeta React 19.3-canary no runtime do route handler
//   (descoberto via debug: console.log(React.version) imprimiu
//   "19.3.0-canary-...")
// - @react-pdf/reconciler usa React do node_modules (18.3.1)
// - 2 instâncias React no processo → $$typeof mismatch → error #31
//   (objects with keys {$$typeof, type, key, ref, props})
// - Worker isolado garante UMA SÓ instância React (a do node_modules)
//
// Invocado via: tsx lib/export/pdf-worker.ts
// (ou node se compilado)

import { renderToBuffer } from '@react-pdf/renderer'
import { renderComparativoPDFNoJSX } from './render/comparativo-no-jsx'
import { renderAnaliseVariacaoPDF } from './render/analise-variacao'
import { renderDREPDF } from './render/dre'
import { renderFluxoCaixaPDF } from './render/fluxo-caixa'
import { renderCategoriasPDF } from './render/categorias'
import { renderFornecedoresPDF } from './render/fornecedores'
import { renderFuncionariosPDF } from './render/funcionarios'
import { renderVarianciasPDF } from './render/variancias'

export type WorkerReportType =
  | 'comparativo'
  | 'analise-variacao'
  | 'dre'
  | 'fluxo-caixa'
  | 'categorias'
  | 'fornecedores'
  | 'funcionarios'
  | 'variancias'

interface WorkerRequest {
  type: WorkerReportType
  data: unknown
  ctx: unknown
}

async function readStdin(): Promise<WorkerRequest> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    process.stdin.on('data', (c: Buffer) => chunks.push(c))
    process.stdin.on('end', () => {
      try {
        const json = Buffer.concat(chunks).toString('utf8')
        resolve(JSON.parse(json) as WorkerRequest)
      } catch (e) {
        reject(e instanceof Error ? e : new Error(String(e)))
      }
    })
    process.stdin.on('error', reject)
  })
}

/* eslint-disable @typescript-eslint/no-explicit-any */
async function buildElement(req: WorkerRequest) {
  const d = req.data as any
  const c = req.ctx as any
  switch (req.type) {
    case 'comparativo':
      return renderComparativoPDFNoJSX(d, c)
    case 'analise-variacao':
      return renderAnaliseVariacaoPDF(d, c)
    case 'dre':
      return renderDREPDF(d, c)
    case 'fluxo-caixa':
      return renderFluxoCaixaPDF(d, c)
    case 'categorias':
      return renderCategoriasPDF(d, c)
    case 'fornecedores':
      return renderFornecedoresPDF(d, c)
    case 'funcionarios':
      return renderFuncionariosPDF(d, c)
    case 'variancias':
      return renderVarianciasPDF(d, c)
    default:
      throw new Error(`Builder desconhecido: ${(req as { type: string }).type}`)
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */

async function main(): Promise<void> {
  const req = await readStdin()
  const element = await buildElement(req)
  const buffer = await renderToBuffer(element)
  await new Promise<void>((resolve, reject) => {
    process.stdout.write(buffer, (err) => (err ? reject(err) : resolve()))
  })
  process.exit(0)
}

main().catch((err: unknown) => {
  const msg = err instanceof Error ? err.stack ?? err.message : String(err)
  process.stderr.write(`WORKER_ERROR: ${msg}\n`)
  process.exit(1)
})
