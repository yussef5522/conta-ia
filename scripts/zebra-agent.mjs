#!/usr/bin/env node
// ESTOQUE FASE 2 item 2.3 — AGENTE USB DA ZEBRA (roda no computador do estoque).
// Ponte entre o navegador (HTTPS) e a impressora Zebra por USB: recebe ZPL num localhost
// HTTP e manda pra impressora RAW. Sem dependências (Node puro). O navegador pode falar
// com http://localhost mesmo estando em HTTPS (localhost é "potentially trustworthy").
//
// COMO RODAR (no PC do estoque, com a Zebra ligada por USB):
//   node scripts/zebra-agent.mjs
//   # opcional: escolher a impressora e a porta
//   ZEBRA_PRINTER="Zebra_ZD220" PORT=9100 node scripts/zebra-agent.mjs
//
// Descobrir o nome da impressora:
//   macOS/Linux:  lpstat -p            (usa CUPS; instale a Zebra como impressora RAW)
//   Windows:      use o nome exato da impressora na fila de impressão
//
// No navegador, na tela da etiqueta, clique "Imprimir na Zebra" (a 1ª vez pede pra
// confirmar o endereço do agente; padrão http://localhost:9100).

import http from 'node:http'
import { spawn } from 'node:child_process'
import os from 'node:os'

const PORT = Number(process.env.PORT || 9100)
const PRINTER = process.env.ZEBRA_PRINTER || '' // vazio = impressora padrão do sistema
const plataforma = os.platform()

// manda o ZPL cru pra impressora. macOS/Linux via `lp -o raw`; Windows via PowerShell.
function imprimir(zpl) {
  return new Promise((resolve, reject) => {
    let cmd, args
    if (plataforma === 'win32') {
      // escreve num arquivo temp e copia RAW pra impressora compartilhada/porta
      cmd = 'powershell'
      const alvo = PRINTER || '\\\\localhost\\Zebra'
      args = ['-Command', `$in=[Console]::In.ReadToEnd(); Set-Content -Path $env:TEMP\\etq.zpl -Value $in -NoNewline; cmd /c "copy /B $env:TEMP\\etq.zpl \\"${alvo}\\""`]
    } else {
      cmd = 'lp'
      args = PRINTER ? ['-d', PRINTER, '-o', 'raw'] : ['-o', 'raw']
    }
    const p = spawn(cmd, args)
    let err = ''
    p.stderr.on('data', (d) => (err += d))
    p.on('error', reject)
    p.on('close', (code) => (code === 0 ? resolve() : reject(new Error(err || `lp saiu com código ${code}`))))
    p.stdin.write(zpl)
    p.stdin.end()
  })
}

const server = http.createServer((req, res) => {
  // CORS — o app (contaia.com.br) chama daqui
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end() }

  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    return res.end(JSON.stringify({ ok: true, agente: 'zebra', plataforma, printer: PRINTER || '(padrão)' }))
  }

  if (req.method === 'POST' && req.url === '/print') {
    let body = ''
    req.on('data', (c) => (body += c))
    req.on('end', async () => {
      if (!body.includes('^XA')) { res.writeHead(400); return res.end('ZPL inválido (sem ^XA).') }
      try {
        await imprimir(body)
        console.log(`[zebra] impresso ${body.length} bytes ${new Date().toISOString()}`)
        res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ ok: true }))
      } catch (e) {
        console.error('[zebra] falha:', e.message)
        res.writeHead(500, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ ok: false, erro: e.message }))
      }
    })
    return
  }
  res.writeHead(404); res.end('não encontrado')
})

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[zebra] agente ouvindo em http://localhost:${PORT} · plataforma ${plataforma} · impressora ${PRINTER || '(padrão do sistema)'}`)
  console.log('[zebra] deixe esta janela aberta enquanto imprime. Ctrl+C encerra.')
})
