// ⭐⭐ FILA DE IMPRESSÃO — o celular da cozinha imprime (30/08/2026).
//
// ⚠️ O DESENHO: o servidor está num datacenter e NÃO alcança a impressora da cozinha.
// Então: celular → app → FILA → agente PUXA (conexão de saída) → impressora. A fila é o
// que faz a etiqueta não se perder quando a impressora está ocupada, sem papel ou
// desligada.

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { prisma } from '@/lib/db'
import {
  cadastrarImpressora, impressoraPorToken, enfileirar, proximoJob,
  registrarResultado, verFila, reenfileirar, hashToken, MAX_TENTATIVAS, ImpressaoError,
} from '../fila'

const CNPJ = '55555555000155'
let companyId: string, impressoraId: string, token: string

beforeEach(async () => {
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
  companyId = (await prisma.company.create({ data: { cnpj: CNPJ, name: 'IMPRESSAO TESTE' } })).id
  const r = await cadastrarImpressora({ companyId, nome: 'Zebra da cozinha', tipo: 'REDE', host: '192.168.0.50' }, prisma)
  impressoraId = r.impressora.id
  token = r.token
})

afterEach(async () => {
  await prisma.stockImpressaoJob.deleteMany({ where: { companyId } })
  await prisma.stockImpressora.deleteMany({ where: { companyId } })
  await prisma.company.deleteMany({ where: { id: companyId } })
})

describe('⭐ o token do agente', () => {
  it('⭐⭐ é guardado como HASH — o segredo não fica em texto no banco', async () => {
    const imp = await prisma.stockImpressora.findFirstOrThrow({ where: { id: impressoraId } })
    expect(imp.tokenHash).not.toBe(token)
    expect(imp.tokenHash).toBe(hashToken(token))
    expect(imp.tokenHash).toHaveLength(64) // sha256 hex
  })

  it('⭐ resolve a impressora certa', async () => {
    const imp = await impressoraPorToken(token, prisma)
    expect(imp?.id).toBe(impressoraId)
  })

  it('⛔ token errado ou vazio não resolve nada', async () => {
    expect(await impressoraPorToken('zeb_qualquer', prisma)).toBeNull()
    expect(await impressoraPorToken('', prisma)).toBeNull()
  })

  it('⛔ impressora desativada para de aceitar o token', async () => {
    await prisma.stockImpressora.update({ where: { id: impressoraId }, data: { ativa: false } })
    expect(await impressoraPorToken(token, prisma)).toBeNull()
  })
})

describe('⭐⭐ a fila: nada se perde', () => {
  it('⭐ enfileirar → o agente puxa → marca impressa', async () => {
    await enfileirar({ companyId, zpl: '^XA^FDlote^FS^XZ', descricao: 'etiqueta do lote 42' }, prisma)
    const job = await proximoJob(companyId, impressoraId, prisma)
    expect(job?.descricao).toBe('etiqueta do lote 42')
    expect(job?.status).toBe('IMPRIMINDO')

    await registrarResultado({ companyId, jobId: job!.id, ok: true }, prisma)
    const f = await verFila(companyId, prisma)
    expect(f.jobs[0].status).toBe('IMPRESSA')
    expect(f.pendentes).toBe(0)
  })

  it('⭐⭐ impressora sem papel: o job VOLTA pra fila e sai depois', async () => {
    await enfileirar({ companyId, zpl: '^XA^XZ', descricao: 'etiqueta' }, prisma)
    const j1 = await proximoJob(companyId, impressoraId, prisma)
    await registrarResultado({ companyId, jobId: j1!.id, ok: false, erro: 'sem papel' }, prisma)

    // ⭐ o ponto: continua PENDENTE, com o erro anotado — a etiqueta não sumiu
    const f = await verFila(companyId, prisma)
    expect(f.jobs[0].status).toBe('PENDENTE')
    expect(f.jobs[0].ultimoErro).toBe('sem papel')

    const j2 = await proximoJob(companyId, impressoraId, prisma)
    expect(j2?.id).toBe(j1!.id) // o MESMO job volta
    await registrarResultado({ companyId, jobId: j2!.id, ok: true }, prisma)
    expect((await verFila(companyId, prisma)).jobs[0].status).toBe('IMPRESSA')
  })

  it(`⚠️ depois de ${MAX_TENTATIVAS} tentativas para e pede olho humano (não fica em loop)`, async () => {
    await enfileirar({ companyId, zpl: '^XA^XZ', descricao: 'etiqueta teimosa' }, prisma)
    for (let i = 0; i < MAX_TENTATIVAS; i++) {
      const j = await proximoJob(companyId, impressoraId, prisma)
      expect(j, `tentativa ${i + 1} devia entregar o job`).not.toBeNull()
      await registrarResultado({ companyId, jobId: j!.id, ok: false, erro: 'impressora desligada' }, prisma)
    }
    const f = await verFila(companyId, prisma)
    expect(f.jobs[0].status).toBe('ERRO')
    expect(f.comErro).toBe(1)
    // e não é mais entregue — senão o agente ficaria martelando pra sempre
    expect(await proximoJob(companyId, impressoraId, prisma)).toBeNull()
  })

  it('⭐ o dono manda tentar de novo e o job volta do zero', async () => {
    await enfileirar({ companyId, zpl: '^XA^XZ', descricao: 'etiqueta' }, prisma)
    for (let i = 0; i < MAX_TENTATIVAS; i++) {
      const j = await proximoJob(companyId, impressoraId, prisma)
      await registrarResultado({ companyId, jobId: j!.id, ok: false }, prisma)
    }
    const erro = (await verFila(companyId, prisma)).jobs[0]
    await reenfileirar(companyId, erro.id, prisma)
    const j = await proximoJob(companyId, impressoraId, prisma)
    expect(j?.id).toBe(erro.id)
  })
})

describe('⛔⛔ dois agentes NÃO imprimem a mesma etiqueta', () => {
  it('⛔⛔ quem perde a corrida do updateMany pega o próximo, não o mesmo', async () => {
    // ⚠️ É O RISCO REAL: o dono deixa o agente rodando no PC do estoque E num Raspberry.
    // Sem a trava, cada etiqueta sairia DUAS vezes — e ninguém descobriria até faltar
    // bobina. A trava é o `updateMany` com `status: 'PENDENTE'` no WHERE.
    const outra = await cadastrarImpressora({ companyId, nome: 'Zebra 2', tipo: 'USB' }, prisma)
    await enfileirar({ companyId, zpl: '^XA^XZ', descricao: 'etiqueta única' }, prisma)

    const [a, b] = await Promise.all([
      proximoJob(companyId, impressoraId, prisma),
      proximoJob(companyId, outra.impressora.id, prisma),
    ])
    const pegaram = [a, b].filter(Boolean)
    expect(pegaram).toHaveLength(1) // ⭐ só UM agente leva a etiqueta
  })

  it('⭐ job direcionado a uma impressora não é puxado pela outra', async () => {
    const outra = await cadastrarImpressora({ companyId, nome: 'Zebra 2', tipo: 'USB' }, prisma)
    await enfileirar({ companyId, zpl: '^XA^XZ', descricao: 'só na 1', impressoraId }, prisma)
    expect(await proximoJob(companyId, outra.impressora.id, prisma)).toBeNull()
    expect(await proximoJob(companyId, impressoraId, prisma)).not.toBeNull()
  })
})

describe('⚠️ o que o cadastro RECUSA', () => {
  it('impressora de REDE sem IP não existe — não teria pra onde mandar', async () => {
    await expect(cadastrarImpressora({ companyId, nome: 'X', tipo: 'REDE' }, prisma)).rejects.toThrow(ImpressaoError)
  })
  it('sem nome também não', async () => {
    await expect(cadastrarImpressora({ companyId, nome: '  ', tipo: 'USB' }, prisma)).rejects.toThrow(ImpressaoError)
  })
  it('ZPL vazio não entra na fila', async () => {
    await expect(enfileirar({ companyId, zpl: '   ', descricao: 'x' }, prisma)).rejects.toThrow(ImpressaoError)
  })
  it('cópias fora do razoável não entram', async () => {
    await expect(enfileirar({ companyId, zpl: '^XA^XZ', descricao: 'x', copias: 0 }, prisma)).rejects.toThrow(ImpressaoError)
    await expect(enfileirar({ companyId, zpl: '^XA^XZ', descricao: 'x', copias: 500 }, prisma)).rejects.toThrow(ImpressaoError)
  })
})

describe('⭐ a tela sabe se o agente está vivo', () => {
  it('sem ping = "nunca conectou"; com ping recente = online', async () => {
    let f = await verFila(companyId, prisma)
    expect(f.impressoras[0].online).toBe(false)
    expect(f.impressoras[0].ultimoPing).toBeNull()

    await prisma.stockImpressora.update({ where: { id: impressoraId }, data: { ultimoPing: new Date() } })
    f = await verFila(companyId, prisma)
    expect(f.impressoras[0].online).toBe(true)
  })

  it('⚠️ ping velho não conta como online (agente morto não engana a tela)', async () => {
    await prisma.stockImpressora.update({
      where: { id: impressoraId }, data: { ultimoPing: new Date(Date.now() - 10 * 60_000) },
    })
    const f = await verFila(companyId, prisma)
    expect(f.impressoras[0].online).toBe(false)
    expect(f.impressoras[0].ultimoPing).not.toBeNull() // mas mostra QUANDO foi visto
  })
})
