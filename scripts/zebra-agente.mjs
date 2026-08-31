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
//
// VER AS IMPRESSORAS QUE O WINDOWS ENXERGA (e se estão compartilhadas):
//   node scripts/zebra-agente.mjs --impressoras

import net from 'node:net'
import fs from 'node:fs'
import path from 'node:path'
import { spawn, execFileSync } from 'node:child_process'
import os from 'node:os'

const URL_BASE = (process.env.CONTA_IA_URL || 'http://198.211.103.10').replace(/\/+$/, '')
const TOKEN = process.env.AGENTE_TOKEN || ''
const INTERVALO = Number(process.env.INTERVALO_MS || 3000)
const PRINTER_ENV = process.env.ZEBRA_PRINTER || ''
const TESTE = process.argv.includes('--teste')
const LISTAR = process.argv.includes('--impressoras')
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

// ---------------------------------------------------------------------------
// WINDOWS — achar a impressora e mandar RAW
// ---------------------------------------------------------------------------
//
// ⚠️ NO WINDOWS NÃO DÁ PRA FALAR COM O USB DIRETO. Quem conversa com a Zebra é o SPOOLER
// do Windows; o agente entrega o ZPL pra ele. O único caminho que passa o ZPL **cru**
// (sem o driver "desenhar" a etiqueta como se fosse texto) é copiar os bytes pra um
// COMPARTILHAMENTO da impressora — `copy /B arquivo \\localhost\Zebra`. Por isso a
// impressora precisa estar **compartilhada**; é o `compartilhar-impressora.bat` do pacote.
//
// ⚠️ E O ARQUIVO TEMPORÁRIO É ESCRITO PELO NODE, não pelo PowerShell. A versão anterior
// mandava o ZPL pelo stdin do PowerShell e gravava com `Set-Content`, que **escolhe a
// codificação sozinho** (ANSI no PowerShell 5.1, UTF-8 no 7) — e o ZPL declara `^CI28`
// (UTF-8). Numa etiqueta com "MANIPULAÇÃO" ou "VALIDADE" acentuada, isso sai como lixo na
// bobina. Escrevendo os bytes aqui, a codificação é nossa e não do shell de quem rodou.

let destinoCache = null

/** o que o Windows enxerga: nome, se está compartilhada e com que nome */
function impressorasWindows() {
  try {
    const out = execFileSync('powershell', [
      '-NoProfile', '-Command',
      'Get-Printer | Select-Object Name,ShareName,Shared | ConvertTo-Json -Compress',
    ], { encoding: 'utf8', timeout: 15000 })
    const j = JSON.parse(out || 'null')
    return (Array.isArray(j) ? j : j ? [j] : []).map((p) => ({
      nome: p.Name, share: p.ShareName || null, compartilhada: !!p.Shared,
    }))
  } catch {
    return [] // sem PowerShell / sem permissão: cai no palpite padrão, com mensagem clara
  }
}

const PARECE_ZEBRA = /zebra|zdesigner|zpl|\bzd\d|gk\d|gc\d|tlp/i

/**
 * Pra onde mandar os bytes no Windows.
 * Ordem: o que o dono configurou → a Zebra compartilhada que o Windows tem → erro que ENSINA.
 */
function destinoWindows(fila) {
  const escolhido = PRINTER_ENV || fila || ''
  // já veio um caminho de rede pronto (\\PC\FILA)
  if (escolhido.startsWith('\\\\')) return escolhido
  if (escolhido) return `\\\\localhost\\${escolhido}`
  if (destinoCache) return destinoCache

  const ims = impressorasWindows()
  const zebras = ims.filter((i) => PARECE_ZEBRA.test(i.nome))
  const pronta = zebras.find((i) => i.compartilhada && i.share)
  if (pronta) {
    destinoCache = `\\\\localhost\\${pronta.share}`
    log(`impressora: "${pronta.nome}" → ${destinoCache}`)
    return destinoCache
  }
  // ⚠️ NUNCA falhar com "erro genérico": a mensagem diz exatamente o que fazer.
  if (zebras.length) {
    throw new Error(
      `achei a impressora "${zebras[0].nome}" mas ela NÃO está compartilhada — ` +
      'rode o "compartilhar-impressora.bat" como administrador (ou compartilhe à mão com o nome Zebra)',
    )
  }
  throw new Error(
    ims.length
      ? `nenhuma Zebra entre as impressoras do Windows (${ims.map((i) => i.nome).join(', ')}) — instale o driver ZDesigner`
      : 'não consegui listar as impressoras do Windows — rode "listar-impressoras.bat" pra ver o erro',
  )
}

/** USB: pela fila do sistema operacional, em modo RAW. */
function imprimirUsb(zpl, fila) {
  if (plataforma === 'win32') {
    return new Promise((resolve, reject) => {
      let destino
      try { destino = destinoWindows(fila) } catch (e) { return reject(e) }
      const tmp = path.join(os.tmpdir(), `conta-ia-etq-${Date.now()}.zpl`)
      try { fs.writeFileSync(tmp, zpl, 'utf8') } catch (e) { return reject(new Error(`não consegui gravar o arquivo temporário: ${e.message}`)) }
      const p = spawn('cmd', ['/c', 'copy', '/B', tmp, destino], { windowsVerbatimArguments: false })
      let err = ''
      p.stderr.on('data', (d) => { err += d })
      p.stdout.on('data', (d) => { err += d }) // o `copy` fala pelo stdout mesmo quando falha
      p.on('error', (e) => { fs.unlinkSync(tmp); reject(new Error(`não consegui chamar o copy: ${e.message}`)) })
      p.on('close', (code) => {
        try { fs.unlinkSync(tmp) } catch { /* temp fica pra trás, não é motivo pra falhar */ }
        if (code === 0) return resolve()
        destinoCache = null // ⚠️ zera o palpite: se o share sumiu, procura de novo no próximo job
        reject(new Error(`copy pra ${destino} falhou: ${err.trim() || `código ${code}`}`))
      })
    })
  }

  return new Promise((resolve, reject) => {
    const alvo = PRINTER_ENV || fila || ''
    const args = alvo ? ['-d', alvo, '-o', 'raw'] : ['-o', 'raw']
    const p = spawn('lp', args)
    let err = ''
    p.stderr.on('data', (d) => { err += d })
    p.on('error', (e) => reject(new Error(`não consegui chamar "lp": ${e.message}`)))
    p.on('close', (code) => (code === 0 ? resolve() : reject(new Error(err.trim() || `lp saiu com código ${code}`))))
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
  if (LISTAR) {
    if (plataforma !== 'win32') { console.log('--impressoras é do Windows. No Mac/Linux use: lpstat -p'); return }
    const ims = impressorasWindows()
    if (!ims.length) { console.log('Não consegui listar as impressoras (PowerShell bloqueado?).'); return }
    console.log('\nImpressoras que o Windows enxerga:\n')
    for (const i of ims) {
      const zebra = PARECE_ZEBRA.test(i.nome) ? '  << parece a Zebra' : ''
      console.log(`  ${i.nome}`)
      console.log(`     compartilhada: ${i.compartilhada ? `SIM (nome: ${i.share})` : 'NÃO'}${zebra}`)
    }
    console.log('\nO agente precisa da Zebra COMPARTILHADA — é o compartilhar-impressora.bat.\n')
    return
  }

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
