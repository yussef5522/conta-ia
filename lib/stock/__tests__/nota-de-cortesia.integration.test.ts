/**
 * ⭐⭐⭐ A NOTA DE CORTESIA/BONIFICAÇÃO — ESTOQUE ENTRA, COBRANÇA NÃO NASCE (04/11/2026)
 *
 * ⛔ **O caso real, medido em prod antes de uma linha ser escrita:** a caçula tem **10 notas
 * CFOP 5910 paradas em `AGUARDANDO_MERCADORIA` com ZERO duplicata**, a mais antiga de 23/09.
 * A mais recente é a DISTRIBUIDORA DE BEBIDAS BORTOLAZZO, `vNF` 81,80 — *FRUKI GUARANA 2L
 * PET 6UN, 2 EB × R$ 40,90*. É essa a fixture abaixo, com os números dela.
 *
 * O recebimento travava em `confirmar-conferencia.ts` exigindo *"diga como ela vai ser
 * paga"*, e a única saída era "sem data, defino depois" — que cria sugestão `A DEFINIR` e
 * acende o alarme F5. *Um alarme sobre uma dívida que não existe.*
 *
 * ⚠️ **Por que integração e não puro:** o que precisa ficar travado é o ESTADO GRAVADO — o
 * movimento de estoque existe, o custo médio subiu pelo valor da nota, e **nenhuma**
 * `StockPayableSuggestion` nasceu. Um teste puro aprovaria uma gravação que não acontece.
 *
 * ⭐ Decisão do dono (com consultor): o custo entra **pelo valor da nota**, não a zero —
 * cortesia a custo zero derrubaria o custo médio e as margens das fichas. O teste (b) mostra
 * a conta.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { prisma } from '@/lib/db'
import { confirmarConferencia } from '../confirmar-conferencia'
import { saldoItem } from '../saldo'

/** ⚠️ CNPJ MEDIDO como livre no repo (o guard `cnpj-de-teste-nao-colide` cobra isso) */
const CNPJ = '10203040000577'
const FORN = '89976179000120' // o CNPJ real da BORTOLAZZO, como dado da nota
const CHAVE = '43261189976179000120550100000000991234567891'

/** os números da nota real */
const QTD = 2
const CUSTO_UNIT = 40.9
const V_NF = 81.8

let companyId: string
let nfeId: string
let nfeItemId: string
let itemId: string

/** cria a nota de cortesia: CFOP 5910 e **nenhuma** duplicata — como a real */
async function semearNotaDeCortesia() {
  const nfe = await prisma.stockNfe.create({
    data: {
      companyId, chave: CHAVE, nsu: '000000000000991',
      status: 'AGUARDANDO_MERCADORIA', temXmlCompleto: true,
      emitCnpj: FORN, emitNome: 'DISTRIBUIDORA DE BEBIDAS BORTOLAZZO LTDA', vNF: V_NF,
    },
  })
  nfeId = nfe.id
  const it = await prisma.stockNfeItem.create({
    data: {
      companyId, nfeId, chave: CHAVE, nItem: 1, cProd: '0000000001',
      xProd: 'FRUKI GUARANA 2L PET 6UN', ncm: '22021000', cfop: '5910',
      uCom: 'EB', qCom: QTD, vUnCom: CUSTO_UNIT, vProd: V_NF,
    },
  })
  nfeItemId = it.id
}

const itensDoGesto = () => [{
  nfeItemId, cProd: '0000000001', xProd: 'FRUKI GUARANA 2L PET 6UN', uCom: 'EB',
  qtdNota: QTD, vUnCom: CUSTO_UNIT, qtdRecebida: QTD,
  mapeado: { itemId, nome: 'Fruki Guaraná 2L', unidadeControle: 'UN' as const, fatorConversao: 1, novo: false },
}]

beforeEach(async () => {
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
  const c = await prisma.company.create({ data: { cnpj: CNPJ, name: 'EMPRESA CORTESIA TESTE' } })
  companyId = c.id
  const item = await prisma.stockItem.create({
    data: { companyId, nome: 'Fruki Guaraná 2L', unidadeControle: 'UN', categoria: 'REVENDA', criadoVia: 'MANUAL' },
  })
  itemId = item.id
  await semearNotaDeCortesia()
})

afterEach(async () => {
  await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS trg_stock_movement_no_update;`).catch(() => {})
  await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS trg_stock_movement_no_delete;`).catch(() => {})
  for (const t of ['stockMovement', 'stockConferenceItem', 'stockReceiptConference', 'stockPayableSuggestion',
    'stockNfeCortesia', 'stockSupplierProduct', 'stockSaldoCache', 'stockItemCustoVigente',
    'stockNfeDup', 'stockNfeItem', 'stockNfe', 'stockItem', 'stockSupplier'] as const) {
    // @ts-expect-error acesso dinâmico
    await prisma[t].deleteMany({ where: { companyId } }).catch(() => {})
  }
  await prisma.company.deleteMany({ where: { id: companyId } })
})

describe('nota de cortesia/bonificação', () => {
  it('(a) o estoque ENTRA com qtd e custo da nota, e ZERO conta a pagar nasce', async () => {
    const r = await confirmarConferencia({
      companyId, nfeId, userId: 'u1', fornecedor: { cnpj: FORN, nome: 'BORTOLAZZO' },
      itens: itensDoGesto(), cortesia: true, cortesiaMotivo: 'bonificação de volume',
    })
    expect(r.movimentos).toBe(1)

    // ⭐ o estoque entrou pela MESMA porta, com o custo da nota
    const mov = await prisma.stockMovement.findMany({ where: { companyId, itemId } })
    expect(mov).toHaveLength(1)
    expect(mov[0]!.tipo).toBe('ENTRADA_NF')
    expect(mov[0]!.quantidade).toBe(QTD)
    expect(mov[0]!.custoUnitario, 'o custo é o da nota, NUNCA zero').toBe(CUSTO_UNIT)
    expect(mov[0]!.custoTotal).toBe(V_NF)
    expect((await saldoItem(prisma, companyId, itemId)).saldo).toBe(QTD)

    // ⛔⛔ O CORAÇÃO: nenhuma cobrança nasceu, em nenhuma forma
    expect(await prisma.stockPayableSuggestion.count({ where: { companyId, nfeId } }),
      'sugestão é o GATILHO da conta a pagar — zero sugestão, zero dívida').toBe(0)
    expect(await prisma.transaction.count({ where: { origin: 'ESTOQUE_NF', bankAccount: { companyId } } })).toBe(0)
    expect(await prisma.stockPayableLink.count({ where: { companyId } })).toBe(0)

    // ⭐ a marca, com autor e data — decisão sem autor é decisão sem dono
    const marca = await prisma.stockNfeCortesia.findFirst({ where: { companyId, nfeId } })
    expect(marca).toBeTruthy()
    expect(marca!.marcadaPorId).toBe('u1')
    expect(marca!.motivo).toBe('bonificação de volume')
    expect(marca!.chave).toBe(CHAVE)

    // ⭐ e a nota sai da fila como qualquer outra
    expect((await prisma.stockNfe.findUnique({ where: { id: nfeId } }))!.status).toBe('CONFIRMADA')
  })

  /**
   * (b) ⭐⭐ A CONTA DO CUSTO MÉDIO, escrita:
   *   antes: 10 UN a R$ 30,00  →  valor 300,00
   *   entra: 2 UN a R$ 40,90   →  valor  81,80
   *   depois: 12 UN e R$ 381,80  →  custo médio 31,8166… → **31,82**
   * ⛔ Se a cortesia entrasse a ZERO: 300,00/12 = **25,00** — o custo médio DESPENCA 21% e
   * toda ficha que usa este item passa a mentir a margem. É por isso que o dono decidiu
   * entrar pelo valor da nota.
   */
  it('(b) o custo médio é recalculado COM o valor da nota (30,00 → 31,82), não derrubado', async () => {
    await prisma.stockMovement.create({
      data: {
        companyId, itemId, tipo: 'ENTRADA_MANUAL', origem: 'MANUAL',
        quantidade: 10, custoUnitario: 30, custoTotal: 300,
        dataMovimento: new Date('2026-11-01T12:00:00Z'), criadoPorId: 'u0',
      },
    })
    const antes = await saldoItem(prisma, companyId, itemId)
    expect(antes.saldo).toBe(10)
    expect(antes.custoMedio).toBe(30)

    await confirmarConferencia({
      companyId, nfeId, userId: 'u1', fornecedor: { cnpj: FORN, nome: 'BORTOLAZZO' },
      itens: itensDoGesto(), cortesia: true,
    })

    const depois = await saldoItem(prisma, companyId, itemId)
    expect(depois.valor, 'Σ custoTotal = 300,00 + 81,80').toBe(381.8)
    expect(depois.saldo).toBe(12)
    expect(depois.custoMedio, '(300,00 + 81,80) / 12 = 31,8166… → 31,82').toBe(31.82)
    // ⛔ o contrafactual da decisão: a zero daria 25,00
    expect(Math.round((300 / 12) * 100) / 100).toBe(25)
    expect(depois.custoMedio).toBeGreaterThan(25)
  })

  /**
   * (c) ⛔⛔ O CONTRAFACTUAL — o bloqueio de hoje, reproduzido. Sem `cortesia`, a MESMA nota
   * (zero duplicata, sem parcelas) é recusada. É a tela que o dono viu.
   */
  it('(c) SEM a opção cortesia, a mesma nota segue BLOQUEADA (o defeito de hoje)', async () => {
    await expect(confirmarConferencia({
      companyId, nfeId, userId: 'u1', fornecedor: { cnpj: FORN, nome: 'BORTOLAZZO' },
      itens: itensDoGesto(),
    })).rejects.toThrow(/não traz boleto no XML/)

    // e nada ficou pela metade
    expect(await prisma.stockMovement.count({ where: { companyId } })).toBe(0)
    expect(await prisma.stockNfeCortesia.count({ where: { companyId } })).toBe(0)
  })

  /**
   * ⛔ A PORTA NÃO AFROUXOU: nota COM duplicata no XML não vira cortesia. O emitente já
   * declarou que há cobrança — aceitar as duas coisas gravaria estoque sem a dívida que o
   * próprio XML afirma. ⚠️ Medido em prod: notas 5910 desta empresa VIERAM com boleto
   * (mistas, parte brinde parte venda), então este caso é real, não hipotético.
   */
  it('⛔ nota COM duplicata no XML é RECUSADA como cortesia', async () => {
    await prisma.stockNfeDup.create({
      data: { companyId, nfeId, nDup: '001', dVenc: new Date('2026-11-15'), vDup: V_NF },
    })

    await expect(confirmarConferencia({
      companyId, nfeId, userId: 'u1', fornecedor: { cnpj: FORN, nome: 'BORTOLAZZO' },
      itens: itensDoGesto(), cortesia: true,
    })).rejects.toThrow(/traz boleto no XML/)

    expect(await prisma.stockNfeCortesia.count({ where: { companyId } })).toBe(0)
    expect(await prisma.stockMovement.count({ where: { companyId } })).toBe(0)
  })

  /**
   * (d) ⭐⭐ REGRA 14 — O IRMÃO: a nota NORMAL não mudou. Mesma fixture, mas com duplicata no
   * XML e sem cortesia: a sugestão nasce como sempre, com o valor e o vencimento da
   * duplicata, e nenhuma marca de cortesia aparece.
   */
  it('(d) nota NORMAL (com duplicata) segue intacta: sugestão nasce com valor e vencimento', async () => {
    await prisma.stockNfeDup.create({
      data: { companyId, nfeId, nDup: '001', dVenc: new Date('2026-11-15'), vDup: V_NF },
    })

    await confirmarConferencia({
      companyId, nfeId, userId: 'u1', fornecedor: { cnpj: FORN, nome: 'BORTOLAZZO' },
      itens: itensDoGesto(),
    })

    const sugs = await prisma.stockPayableSuggestion.findMany({ where: { companyId, nfeId } })
    expect(sugs, 'o caminho normal continua gerando a cobrança').toHaveLength(1)
    expect(sugs[0]!.valor).toBe(V_NF)
    expect(sugs[0]!.dVenc).not.toBeNull()
    expect(sugs[0]!.nDup).toBe('001')
    expect(await prisma.stockNfeCortesia.count({ where: { companyId } })).toBe(0)
    // ⭐ e o estoque entrou igual — a cortesia não mexeu nesta metade
    const mov = await prisma.stockMovement.findMany({ where: { companyId, itemId } })
    expect(mov).toHaveLength(1)
    expect(mov[0]!.custoUnitario).toBe(CUSTO_UNIT)
  })

  /**
   * ⭐ REGRA 14 — o outro irmão: *"sem data, defino depois"* continua produzindo a sugestão
   * `A DEFINIR`. A cortesia não roubou esse caminho; ela é uma terceira resposta, não a
   * substituição de uma existente.
   */
  it('(d2) "sem data, defino depois" segue gerando sugestão A DEFINIR', async () => {
    await confirmarConferencia({
      companyId, nfeId, userId: 'u1', fornecedor: { cnpj: FORN, nome: 'BORTOLAZZO' },
      itens: itensDoGesto(), pagamento: { semDataDefinirDepois: true },
    })

    const sugs = await prisma.stockPayableSuggestion.findMany({ where: { companyId, nfeId } })
    expect(sugs).toHaveLength(1)
    expect(sugs[0]!.dVenc, 'A DEFINIR: nunca uma data inventada').toBeNull()
    expect(sugs[0]!.valor).toBe(V_NF)
    expect(await prisma.stockNfeCortesia.count({ where: { companyId } })).toBe(0)
  })

  /** ⛔ uma marca por nota — o `@@unique` é a trava, não a boa intenção do chamador */
  it('⛔ confirmar a mesma nota 2× é impossível (e a marca não duplica)', async () => {
    const payload = {
      companyId, nfeId, userId: 'u1', fornecedor: { cnpj: FORN, nome: 'BORTOLAZZO' },
      itens: itensDoGesto(), cortesia: true,
    }
    await confirmarConferencia(payload)
    await expect(confirmarConferencia(payload)).rejects.toThrow(/já foi conferida/)
    expect(await prisma.stockNfeCortesia.count({ where: { companyId, nfeId } })).toBe(1)
  })
})
