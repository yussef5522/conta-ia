// ⛔⛔⛔ IMPORT PF NUNCA TOCA A PJ, E VICE-VERSA (13/09/2026)
//
// **Exigência do dono:** *"a PJ intocada (guard de isolamento entre perfis: import PF nunca
// toca conta PJ e vice-versa)"*.
//
// ⭐ É o irmão do guard do estoque (`snapshotClosedModules`, 21/08), e existe pelo mesmo
// motivo: a fronteira PJ/PF é do contador, e uma linha que atravesse ela em silêncio é o
// tipo de coisa que só aparece no fechamento do ano.

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { prisma } from '@/lib/db'
import { previewDoExtratoPF } from '../orquestrador'
import { gravarExtratoPF } from '../gravar'
import { carregarContexto } from '../contexto'

const marca = `iso-${Date.now()}`
let profileId = '', contaPFId = '', userId = '', companyId = '', contaPJId = ''

const OFX = (linhas: string) => `OFXHEADER:100
<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS>
<BANKACCTFROM><BANKID>041</BANKID><ACCTID>12345678</ACCTID></BANKACCTFROM>
<BANKTRANLIST><DTSTART>20260901</DTSTART><DTEND>20260930</DTEND>
${linhas}
</BANKTRANLIST>
<LEDGERBAL><BALAMT>1500.00</BALAMT><DTASOF>20260930</DTASOF></LEDGERBAL>
</STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>`

const tx = (fitid: string, data: string, valor: number, memo: string) =>
  `<STMTTRN><TRNTYPE>${valor >= 0 ? 'CREDIT' : 'DEBIT'}</TRNTYPE><DTPOSTED>${data}</DTPOSTED>` +
  `<TRNAMT>${valor.toFixed(2)}</TRNAMT><FITID>${fitid}</FITID><MEMO>${memo}</MEMO></STMTTRN>`

beforeAll(async () => {
  const u = await prisma.user.create({ data: { email: `${marca}@t.com`, password: 'x', name: 'T', role: 'USER' }, select: { id: true } })
  userId = u.id
  const p = await prisma.personalProfile.create({ data: { name: `perfil ${marca}` }, select: { id: true } })
  profileId = p.id
  await prisma.userPersonalProfile.create({ data: { userId, profileId, role: 'OWNER' } })
  const c = await prisma.personalBankAccount.create({ data: { profileId, name: 'banrisul pf', bankName: 'banrisul', balance: 1000 }, select: { id: true } })
  contaPFId = c.id
  const co = await prisma.company.create({ data: { name: `empresa ${marca}`, cnpj: `${Date.now()}`.slice(0, 14) }, select: { id: true } })
  companyId = co.id
  const cpj = await prisma.bankAccount.create({ data: { companyId, name: 'banrisul pj', bankCode: '041', balance: 99999 }, select: { id: true } })
  contaPJId = cpj.id
})

afterAll(async () => {
  await prisma.personalTransaction.deleteMany({ where: { profileId } })
  await prisma.personalOfxImport.deleteMany({ where: { profileId } })
  await prisma.personalBankAccount.deleteMany({ where: { profileId } })
  await prisma.userPersonalProfile.deleteMany({ where: { profileId } })
  await prisma.personalProfile.deleteMany({ where: { id: profileId } })
  await prisma.transaction.deleteMany({ where: { bankAccountId: contaPJId } })
  await prisma.bankAccount.deleteMany({ where: { companyId } })
  await prisma.company.deleteMany({ where: { id: companyId } })
  await prisma.user.deleteMany({ where: { id: userId } })
})

/** o retrato do mundo PJ — o que NÃO pode mudar */
async function fotoDaPJ() {
  return {
    transactions: await prisma.transaction.count(),
    bankAccounts: await prisma.bankAccount.count(),
    saldoDaConta: (await prisma.bankAccount.findUniqueOrThrow({ where: { id: contaPJId }, select: { balance: true } })).balance,
    categories: await prisma.category.count(),
    suppliers: await prisma.supplier.count(),
  }
}

describe('⛔⛔ o import do extrato PF não atravessa a fronteira', () => {
  it('⭐ grava no PF e a PJ fica IDÊNTICA — contagem e saldo', async () => {
    const antes = await fotoDaPJ()

    const ctx = await carregarContexto(profileId, contaPFId, prisma)
    const preview = previewDoExtratoPF({
      raw: OFX([tx('a1', '20260905', 300, 'SALARIO'), tx('a2', '20260906', -100, 'MERCADO')].join('\n')),
      ...ctx!,
    })
    expect(preview.bloqueio).toBeNull()
    expect(preview.novas).toHaveLength(2)

    const r = await gravarExtratoPF({
      profileId, contaId: contaPFId, userId, fileName: 'x.ofx', preview,
      ledgerBal: { amount: 1500, asOfDate: new Date('2026-09-30') },
      aprender: preview.aprender, categorias: {},
    }, prisma)
    expect(r.criadas).toBe(2)

    const depois = await fotoDaPJ()
    expect(depois, '⛔ o import PF mexeu em alguma coisa da PJ').toEqual(antes)
  })

  it('⭐ e o dinheiro foi pro lado certo: saldo e transações no PF', async () => {
    const conta = await prisma.personalBankAccount.findUniqueOrThrow({ where: { id: contaPFId }, select: { balance: true, ledgerBal: true, bankCode: true, accountNumber: true } })
    expect(conta.balance).toBe(1200)      // 1000 + 300 − 100
    expect(conta.ledgerBal).toBe(1500)
    // ⭐ o 1º import ENSINOU quem é a conta — é o que faz a trava morder no próximo
    // ⚠️ guarda o que o ARQUIVO diz ('041'), não uma forma normalizada: é a convenção da PJ
    // ('041' · '748' · '197') e quem normaliza pra comparar é a própria trava
    expect(conta.bankCode).toBe('041')
    expect(conta.accountNumber).toBe('12345678')
    expect(await prisma.personalTransaction.count({ where: { profileId } })).toBe(2)
  })

  it('⛔⛔ a TRAVA DA CONTA ERRADA morde agora que a conta tem identidade', async () => {
    // é o caso real de 12/08 do outro lado: OFX do Sicredi na conta do Banrisul
    const ctx = await carregarContexto(profileId, contaPFId, prisma)
    const p = previewDoExtratoPF({
      raw: OFX(tx('b1', '20260907', 50, 'X')).replace('<BANKID>041</BANKID>', '<BANKID>748</BANKID>'),
      ...ctx!,
    })
    expect(p.bloqueio, '⛔ aceitou OFX de outro banco na conta').not.toBeNull()
    expect(p.bloqueio!.code).toBe('OFX_BANK_MISMATCH')
    expect(p.novas).toHaveLength(0)
  })

  it('⭐ re-importar o MESMO arquivo não cria nada e não mexe no saldo', async () => {
    const ctx = await carregarContexto(profileId, contaPFId, prisma)
    const p = previewDoExtratoPF({
      raw: OFX([tx('a1', '20260905', 300, 'SALARIO'), tx('a2', '20260906', -100, 'MERCADO')].join('\n')),
      ...ctx!,
    })
    expect(p.jaImportadas).toBe(2)
    expect(p.novas).toHaveLength(0)
    expect(p.conferencia.estado).toBe('SEM_DECLARADO')   // Banrisul: ledgerBal não é régua
  })
})
