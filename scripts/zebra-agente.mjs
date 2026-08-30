#!/usr/bin/env node
// ⭐⭐ AGENTE DE IMPRESSÃO ZEBRA v2 (30/08/2026) — PUXA da fila, imprime por REDE ou USB.
//
// ⚠️ POR QUE ELE PUXA EM VEZ DE O SERVIDOR EMPURRAR: o servidor do Conta IA está num
// datacenter e a impressora está na LAN da cozinha — não há rota. Fazer o servidor
// alcançar o IP dela exigiria expor a porta 9100 na internet, e **9100 não pede senha**:
// qualquer um imprimiria. Aqui o agente só faz conexão de SAÍDA (HTTPS), que passa em
// qualquer rede doméstica sem abrir porta, sem IP fixo e sem VPN.
//
// ⭐ O QUE ISSO DESTRAVA: o CELULAR na cozinha imprime. O app enfileira; o agente puxa.
// E com impressora de REDE o agente roda em QUALQUER máquina da LAN (um Raspberry Pi de
// R$ 150 ligado na tomada serve) — deixa de depender do PC do estoque estar ligado.
//
// COMO RODAR:
//   CONTA_IA_URL=http://198.211.103.10 AGENTE_TOKEN=zeb_xxx node scripts/zebra-agente.mjs
//
// Opcionais:
//   INTERVALO_MS=3000     de quanto em quanto tempo pergunta por trabalho (padrão 3s)
//   ZEBRA_PRINTER=nome    fila do SO pra impressora USB (sobrepõe o que veio do servidor)
//
// TESTE FÍSICO (imprime uma etiqueta de teste sem passar pelo app):
//   node scripts/zebra-agente.mjs --teste

import net from 'node:net'
import { spawn } from 'node:child_process'
import os from 'node:os'

const URL_BASE = (process.env.CONTA_IA_URL || 'http://198.211.103.10').replace(/\/+$/, '')
const TOKEN = process.env.AGENTE_TOKEN || ''
const INTERVALO = Number(process.env.INTERVALO_MS || 3000)
const PRINTER_ENV = process.env.ZEBRA_PRINTER || ''
const TESTE = process.argv.includes('--teste')
const plataforma = os.platform()

const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a)

/** ⭐ etiqueta de teste: prova o caminho inteiro sem depender do app. */
const ZPL_TESTE = `^XA
^CI28
^PW480
^LL480
^FO30,40^A0N,34,34^FDConta IA^FS
^FO30,90^A0N,28,28^FDTeste de impressao^FS
^FO30,130^A0N,24,24^FD${new Date().toLocaleString('pt-BR')}^FS
^FO30,180^GB420,3,3^FS
^FO30,210^A0N,22,22^FDSe voce esta lendo isto,^FS
^FO30,240^A0N,22,22^FDa impressora esta pronta.^FS
^FO30,300^BQN,2,5^FDLA,conta-ia-teste^FS
^XZ`

// ---------------------------------------------------------------------------
// IMPRESSÃO
// ---------------------------------------------------------------------------

/** REDE: ZPL cru no socket TCP 9100 — o protocolo nativo da Zebra. */
function imprimirRede(zpl, host, porta) {
  return new Promise((resolve, reject) => {
    const s = net.createConnection({ host, port: porta || 9100 })
    // ⚠️ timeout curto de propósito: impressora desligada tem que FALHAR RÁPIDO pra o job
    // voltar pra fila e tentar de novo, não pendurar o agente por minutos.
    s.setTimeout(8000)
    s.on('connect', () => s.end(zpl))
    s.on('close', () => resolve())
    s.on('timeout', () => { s.destroy(); reject(new Error(`sem resposta de ${host}:${porta} (impressora desligada ou IP errado?)`)) })
    s.on('error', (e) => reject(new Error(`${e.code || e.message} em ${host}:${porta}`)))
  })
}

/** USB: pela fila do sistema operacional, em modo RAW. */
function imprimirUsb(zpl, fila) {
  return new Promise((resolve, reject) => {
    const alvo = PRINTER_ENV || fila || ''
    let cmd, args
    if (plataforma === 'win32') {
      cmd = 'powershell'
      const destino = alvo || '\\\\localhost\\Zebra'
      args = ['-Command', `$in=[Console]::In.ReadToEnd(); Set-Content -Path $env:TEMP\\etq.zpl -Value $in -NoNewline; cmd /c "copy /B $env:TEMP\\etq.zpl \\"${destino}\\""`]
    } else {
      cmd = 'lp'
      args = alvo ? ['-d', alvo, '-o', 'raw'] : ['-o', 'raw']
    }
    const p = spawn(cmd, args)
    let err = ''
    p.stderr.on('data', (d) => { err += d })
    p.on('error', (e) => reject(new Error(`não consegui chamar "${cmd}": ${e.message}`)))
    p.on('close', (code) => (code === 0 ? resolve() : reject(new Error(err.trim() || `${cmd} saiu com código ${code}`))))
    p.stdin.end(zpl)
  })
}

async function imprimir(zpl, imp) {
  if (imp?.tipo === 'REDE') return imprimirRede(zpl, imp.host, imp.porta)
  return imprimirUsb(zpl, imp?.filaUsb)
}

// ---------------------------------------------------------------------------
// O LOOP
// ---------------------------------------------------------------------------

async function puxar() {
  const r = await fetch(`${URL_BASE}/api/estoque/agente-impressao`, {
    headers: { authorization: `Bearer ${TOKEN}` },
  })
  if (r.status === 401) throw new Error('token inválido — confira o AGENTE_TOKEN')
  if (!r.ok) throw new Error(`servidor devolveu ${r.status}`)
  return r.json()
}

async function avisar(jobId, ok, erro) {
  await fetch(`${URL_BASE}/api/estoque/agente-impressao`, {
    method: 'POST',
    headers: { authorization: `Bearer ${TOKEN}`, 'content-type': 'application/json' },
    body: JSON.stringify({ jobId, ok, erro: erro ?? null }),
  }).catch(() => {}) // ⚠️ se o aviso falhar, o job volta sozinho pelo timeout da fila
}

async function main() {
  if (TESTE) {
    // teste físico direto: usa as variáveis de ambiente, sem servidor
    const host = process.env.ZEBRA_HOST
    log(host ? `imprimindo teste em ${host}:${process.env.ZEBRA_PORT || 9100}…` : 'imprimindo teste na impressora USB…')
    try {
      await (host ? imprimirRede(ZPL_TESTE, host, Number(process.env.ZEBRA_PORT || 9100)) : imprimirUsb(ZPL_TESTE, PRINTER_ENV))
      log('✅ etiqueta de teste enviada')
    } catch (e) {
      log('❌', e.message)
      process.exit(1)
    }
    return
  }

  if (!TOKEN) {
    console.error('Falta AGENTE_TOKEN. Cadastre a impressora em Estoque → Impressão e copie o token.')
    process.exit(1)
  }
  log(`agente ligado · servidor ${URL_BASE} · pergunta a cada ${INTERVALO}ms`)

  let falhasSeguidas = 0
  for (;;) {
    try {
      const { impressora, job } = await puxar()
      falhasSeguidas = 0
      if (job) {
        log(`↓ ${job.descricao}${job.copias > 1 ? ` (${job.copias}×)` : ''}`)
        try {
          for (let i = 0; i < (job.copias || 1); i++) await imprimir(job.zpl, impressora)
          await avisar(job.id, true)
          log('  ✅ impressa')
        } catch (e) {
          await avisar(job.id, false, e.message)
          log('  ❌', e.message, '— volta pra fila')
        }
        continue // sem esperar: pode ter mais na fila
      }
    } catch (e) {
      falhasSeguidas++
      // ⚠️ recuo progressivo: internet caiu não é motivo pra martelar o servidor
      log('⚠️', e.message)
      await new Promise((r) => setTimeout(r, Math.min(60_000, INTERVALO * 2 ** Math.min(falhasSeguidas, 5))))
      continue
    }
    await new Promise((r) => setTimeout(r, INTERVALO))
  }
}

main().catch((e) => { console.error(e); process.exit(1) })
