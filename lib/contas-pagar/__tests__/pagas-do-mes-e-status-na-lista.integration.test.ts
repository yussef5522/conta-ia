/**
 * ⭐⭐⭐ OS 2 ACERTOS DE 26/09/2026 — decisão do dono.
 *
 * **Pedido, ao pé da letra:** *"o cartão vira PAGAS · SETEMBRO com TODAS as contas pagas no
 * mês, não importa o meio (conciliada com o banco, paga em dinheiro, marcada na mão). (…)
 * **Guard: total do cartão = conciliadas + sem vínculo do mês (nenhuma paga fica fora, por
 * NENHUM caminho de pagamento).**"* E: *"a lista ganha o status VENCE HOJE (mesma partição
 * dos cards). **Guard: o status da linha = o cartão onde ela conta (partição nos DOIS
 * andares, mesma função — não duas réguas).**"*
 *
 * ⛔⛔ **O TAMANHO DO BURACO, MEDIDO EM PROD ANTES DE CODAR:** setembro tem **236 contas
 * pagas (R$ 292.743,50)** e o cartão mostrava **40 (R$ 25.441,86)** — **8,7%**. As outras
 * **196 (R$ 267.301,64)** eram invisíveis nesta tela. *O card respondia "quanto eu paguei
 * sem o banco", que não é a pergunta que o dono faz.*
 *
 * ⚠️⚠️ **E O GUARD 1 RODA CONTRA BANCO DE PROPÓSITO.** O que excluía as 196 era **uma linha
 * do `lifecycleScope`** (`reconciledWithId: null`), não a régua de recorte — então um teste
 * puro sobre `whereDoStatus` daria **verde com o defeito vivo**. O que morde é executar o
 * `buildPayableListWhere` (o where que a ROTA monta) contra linhas reais dos três caminhos
 * de pagamento.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { PrismaClient } from '@prisma/client'
import { buildPayableListWhere, baseDosKpisDePagas } from '../list-filters'
import { statusDaConta, whereDoStatus, type StatusDaConta } from '../escopo'
import { payableVisualStatus, payableStatusLabel } from '@/components/contas-pagar/payable-status'

const db = new PrismaClient()
/** ⚠️ CNPJ exclusivo — conferido contra os usados no repo (a cicatriz de 21/09) */
const CNPJ = '64646464000164'

let companyId = ''
let bankAccountId = ''

/** ⭐ um dia fixo de setembro: o teste não pode depender do relógio de quem roda */
const AGORA = new Date('2026-09-26T14:00:00.000Z')
const MES = '2026-09'

beforeAll(async () => {
  await db.company.deleteMany({ where: { cnpj: CNPJ } })
  const c = await db.company.create({ data: { name: 'Pagas do mês', cnpj: CNPJ } })
  companyId = c.id
  const b = await db.bankAccount.create({
    data: { companyId, name: 'stone teste', bankName: 'Stone', accountType: 'CHECKING' },
  })
  bankAccountId = b.id
})

afterAll(async () => {
  await db.company.deleteMany({ where: { cnpj: CNPJ } })
  await db.$disconnect()
})

/** uma conta PAGA, pelo caminho que o `meio` diz */
async function paga(valor: number, meio: 'BANCO' | 'DINHEIRO' | 'NA_MAO') {
  /**
   * ⚠️ A conciliada precisa de uma LINHA DE EXTRATO de verdade pra apontar — `reconciledWithId`
   * apontando pro nada não reproduz o caso que escondia as 196.
   */
  let reconciledWithId: string | null = null
  if (meio === 'BANCO') {
    const linha = await db.transaction.create({
      data: {
        bankAccountId, type: 'DEBIT', amount: valor, date: new Date('2026-09-10T12:00:00Z'),
        description: 'PAGAMENTO PIX', lifecycle: 'EFFECTED', status: 'PENDING', origin: 'OFX',
      },
    })
    reconciledWithId = linha.id
  }
  return db.transaction.create({
    data: {
      bankAccountId, type: 'DEBIT', amount: valor,
      date: new Date('2026-09-10T12:00:00Z'),
      dueDate: new Date('2026-09-10T00:00:00Z'),
      paymentDate: new Date('2026-09-10T12:00:00Z'),
      description: `conta paga via ${meio}`,
      lifecycle: 'EFFECTED', status: 'RECONCILED',
      reconciledWithId,
    },
  })
}

/** uma conta EM ABERTO com o vencimento pedido */
async function aberta(valor: number, dueDate: string) {
  return db.transaction.create({
    data: {
      bankAccountId, type: 'DEBIT', amount: valor,
      date: new Date(`${dueDate}T12:00:00Z`),
      dueDate: new Date(`${dueDate}T00:00:00Z`),
      description: `conta a pagar ${dueDate}`,
      lifecycle: 'PAYABLE', status: 'PENDING',
    },
  })
}

/** conta o que a LISTA traria naquele escopo — o where REAL da rota */
async function contarNaLista(escopo: string) {
  const where = buildPayableListWhere(
    { empresaId: companyId, escopo: escopo as never, mes: MES, status: 'TODOS', page: 1, limit: 500, dataField: 'dueDate', vencidasOnly: false } as never,
    AGORA,
  )
  const [count, agg] = await Promise.all([
    db.transaction.count({ where }),
    db.transaction.aggregate({ where, _sum: { amount: true } }),
  ])
  return { count, total: Math.round((agg._sum.amount ?? 0) * 100) / 100 }
}

/** o input que a ROTA monta pros cards */
const kpiBaseInput = { empresaId: '', status: 'TODOS', page: 1, limit: 500, dataField: 'dueDate', vencidasOnly: false } as never

describe('⛔⛔⛔ GUARD 1 — TODAS as pagas do mês, por NENHUM caminho de fora', () => {
  beforeAll(async () => {
    // os três meios que o dono nomeou, cada um com valor próprio pra a soma ser legível
    await paga(1000, 'BANCO')
    await paga(500, 'BANCO')
    await paga(70, 'DINHEIRO')
    await paga(3, 'NA_MAO')
  })

  it('⭐⭐ o cartão conta as 4 — e o defeito de prod era EXATAMENTE isto', async () => {
    const todas = await contarNaLista('PAGA')
    expect(todas.count, 'paga escondida por causa do vínculo com o extrato').toBe(4)
    expect(todas.total).toBe(1573)
  })

  it('⛔⛔ e a Σ das PARTES é o TOTAL — nenhuma paga fica fora, nenhuma conta 2×', async () => {
    const [todas, conciliadas, semVinculo] = await Promise.all([
      contarNaLista('PAGA'),
      contarNaLista('PAGA_CONCILIADA'),
      contarNaLista('PAGA_SEM_VINCULO'),
    ])
    expect(conciliadas.count).toBe(2)
    expect(semVinculo.count).toBe(2)
    expect(conciliadas.count + semVinculo.count,
      'a divisão honesta do cartão não fecha com o total dele').toBe(todas.count)
    expect(Math.round((conciliadas.total + semVinculo.total) * 100) / 100).toBe(todas.total)
  })

  it('⭐ dinheiro e "na mão" caem no MESMO lado (sem vínculo) — o meio não cria 3º balde', async () => {
    /**
     * ⚠️ A divisão é **conciliada × sem vínculo**, não "por meio de pagamento". Um balde por
     * meio faria a linha pequena do cartão crescer sem fim, e o dono pediu a ressalva como
     * DETALHE, não como recorte.
     */
    const semVinculo = await contarNaLista('PAGA_SEM_VINCULO')
    expect(semVinculo.total).toBe(73) // 70 (dinheiro) + 3 (na mão)
  })

  it('⛔ e o mês RECORTA as pagas — paga de agosto não entra em setembro', async () => {
    const deAgosto = await db.transaction.create({
      data: {
        bankAccountId, type: 'DEBIT', amount: 9999,
        date: new Date('2026-08-10T12:00:00Z'),
        dueDate: new Date('2026-08-10T00:00:00Z'),
        paymentDate: new Date('2026-08-10T12:00:00Z'),
        description: 'paga em AGOSTO', lifecycle: 'EFFECTED', status: 'RECONCILED',
      },
    })
    const setembro = await contarNaLista('PAGA')
    expect(setembro.count, 'o recorte de fluxo vazou pro mês vizinho').toBe(4)
    await db.transaction.delete({ where: { id: deAgosto.id } })
  })

  it('⛔⛔⛔ o CARTÃO conta pela base das pagas — e a base ERRADA esconde (o defeito de prod)', async () => {
    /**
     * ⭐⭐ **Este é o teste que a REGRA 11 exigiu.** O defeito de 26/09 não vivia no recorte:
     * vivia no `where` BASE que a rota passava pro aggregate. Um teste que só exercitasse o
     * recorte ficaria **VERDE com o defeito reposto** — por isso aqui se executa a MESMA
     * função que a rota chama (`baseDosKpisDePagas`) e, ao lado, o **contrafactual** com a
     * base que escondia as 196 linhas de setembro.
     */
    const input = { ...(kpiBaseInput as object), empresaId: companyId, mes: MES } as never
    const contar = async (base: Record<string, unknown>) =>
      db.transaction.count({ where: { AND: [base, whereDoStatus('PAGA', AGORA, MES)] } })

    const certa = await contar(baseDosKpisDePagas(input, AGORA))
    const errada = await contar(buildPayableListWhere(input, AGORA)) // ⛔ a base de ABERTO

    expect(certa, 'o cartão voltou a esconder a paga conciliada').toBe(4)
    expect(errada, 'a base de aberto deixou de esconder — o contrafactual perdeu o sentido').toBe(2)
  })

  it('⛔⛔ a conciliada continua FORA dos escopos de ABERTO — a decisão de 28/05 de pé', async () => {
    /**
     * ⭐ A relaxação do `lifecycleScope` é **só sob os escopos de pagas**. Se ela vazasse pro
     * A_PAGAR, a mesma linha viveria nesta tela E em Movimentações — *"linha em duas telas é
     * duplicação"*, palavras do dono em 13/09.
     */
    for (const e of ['A_PAGAR', 'VENCIDA', 'VENCE_HOJE']) {
      const r = await contarNaLista(e)
      expect(r.count, `a conciliada apareceu no escopo ${e}`).toBe(0)
    }
  })
})

describe('⛔⛔⛔ GUARD 2 — o status da LINHA é o cartão onde ela CONTA', () => {
  /**
   * ⭐ A prova é **EXECUTAR as duas funções sobre a MESMA conta** e exigir que o andar de
   * baixo (a linha) e o de cima (o card) digam a mesma coisa. Comparar strings escritas à
   * mão nos dois arquivos aprovaria o dia em que uma delas ganhasse régua própria — foi
   * assim que o `payableVisualStatus` colapsou `VENCE_HOJE` em `pending` ontem.
   */
  const PAR: Record<StatusDaConta, { visual: string; rotulo: string }> = {
    PAGA: { visual: 'paid', rotulo: 'Paga' },
    VENCIDA: { visual: 'overdue', rotulo: 'Vencida' },
    VENCE_HOJE: { visual: 'today', rotulo: 'Vence hoje' },
    A_PAGAR: { visual: 'pending', rotulo: 'A pagar' },
  }

  it('⭐⭐ os DOIS andares concordam em toda conta — inclusive na que vence HOJE', () => {
    const contas = [
      { status: 'PENDING', dueDate: '2026-09-25', paymentDate: null }, // ontem
      { status: 'PENDING', dueDate: '2026-09-26', paymentDate: null }, // ⭐ HOJE
      { status: 'PENDING', dueDate: '2026-09-27', paymentDate: null }, // amanhã
      { status: 'PENDING', dueDate: null, paymentDate: null },         // sem prazo
      { status: 'RECONCILED', dueDate: '2026-09-10', paymentDate: '2026-09-10' },
    ]
    for (const c of contas) {
      const doCard = statusDaConta(c, AGORA)
      const naLinha = payableVisualStatus(c, AGORA)
      expect(naLinha, `a linha de ${c.dueDate} discorda do cartão (${doCard})`)
        .toBe(PAR[doCard].visual)
      expect(payableStatusLabel(naLinha)).toBe(PAR[doCard].rotulo)
    }
  })

  it('⛔ a de HOJE aparece VENCE HOJE na lista — não "a pagar", nem "vencida"', () => {
    const hoje = { status: 'PENDING', dueDate: '2026-09-26', paymentDate: null }
    expect(payableVisualStatus(hoje, AGORA)).toBe('today')
    expect(payableStatusLabel(payableVisualStatus(hoje, AGORA))).toBe('Vence hoje')
  })

  it('⛔⛔ e a fronteira é o dia do BRASIL, nos DOIS andares', () => {
    /**
     * ⚠️ 23h de São Paulo do dia 26 — o servidor em UTC já diz 27. Sem a fronteira do
     * Brasil a conta de hoje ficaria **vermelha com o dia inteiro ainda pra pagar**, e a
     * linha e o card poderiam até discordar se um deles usasse o relógio cru.
     */
    const NOITE = new Date('2026-09-27T02:00:00.000Z')
    const hoje = { status: 'PENDING', dueDate: '2026-09-26', paymentDate: null }
    expect(statusDaConta(hoje, NOITE)).toBe('VENCE_HOJE')
    expect(payableVisualStatus(hoje, NOITE)).toBe('today')
  })

  it('⭐ e a partição da LISTA bate com a dos CARDS, linha por linha (contra banco)', async () => {
    /**
     * ⭐⭐ Este é o fecho do guard: as contas abertas são lidas pelo `where` de CADA card e a
     * cada uma se pergunta o status da LINHA. Uma linha que caia no card X e se pinte de Y é
     * exatamente a discordância que o dono viu.
     */
    await Promise.all([aberta(11, '2026-09-25'), aberta(22, '2026-09-26'), aberta(33, '2026-10-05')])
    for (const e of ['VENCIDA', 'VENCE_HOJE', 'A_PAGAR'] as StatusDaConta[]) {
      const rows = await db.transaction.findMany({
        where: { AND: [{ bankAccount: { companyId } }, { lifecycle: 'PAYABLE' }, whereDoStatus(e, AGORA)] },
        select: { status: true, dueDate: true, paymentDate: true, description: true },
      })
      expect(rows.length, `o card ${e} não pegou a conta dele`).toBeGreaterThan(0)
      for (const r of rows) {
        expect(payableVisualStatus(r, AGORA), `${r.description} conta em ${e} e se pinta de outro`)
          .toBe(PAR[e].visual)
      }
    }
  })
})

describe('⛔⛔⛔ UM NOME, UM NÚMERO — a saved view «Pagas no mês» e o cartão', () => {
  /**
   * ⛔⛔ **Achada na PROVA EM PROD, não no código:** o bundle trazia `"Pagas no mês"` (a
   * saved view) ao lado de `"Pagas · setembro"` (o cartão), e os dois davam números
   * diferentes — a view usava `status: 'RECONCILED'` **sem escopo**, então o `lifecycleScope`
   * seguia excluindo a conciliada: **33** contra **229**, com o mesmo nome.
   *
   * ⭐ É a doença que este sprint conserta, aparecendo num terceiro lugar. *Duas definições
   * da mesma pergunta divergem no primeiro ajuste* — e aqui já tinham divergido.
   */
  it('⭐ a view manda o ESCOPO, e devolve o MESMO conjunto do cartão', async () => {
    const { SAVED_VIEWS } = await import('../saved-views')
    const view = SAVED_VIEWS.find((v) => v.id === 'pagas-mes')!
    const f = view.buildFilters(AGORA)
    expect(f.escopo, 'a view voltou a montar régua própria em vez de usar o escopo')
      .toBe('PAGA')

    const where = buildPayableListWhere(
      { ...(kpiBaseInput as object), empresaId: companyId, mes: MES, escopo: f.escopo, status: f.status } as never,
      AGORA,
    )
    const naView = await db.transaction.count({ where })
    const noCartao = (await contarNaLista('PAGA')).count
    expect(naView, '«Pagas no mês» e o cartão PAGAS discordam — um nome, dois números')
      .toBe(noCartao)
  })
})

describe('⛔⛔ E A ROTA USA A PORTA — os KPIs de pagas não montam base própria', () => {
  /**
   * ⚠️⚠️ **Sem este bloco a REGRA 11 reprovava o arquivo inteiro:** repondo o defeito **na
   * rota** (voltar o aggregate de pagas pra base de ABERTO), os 10 testes acima ficam
   * **VERDES** — eles executam a lib, e a lib continua certa. O que morde é perguntar quem
   * a rota chama.
   *
   * ⭐ E conta o **USO**, nunca a menção: a linha do `import` já bastaria pro `toContain`
   * ("menção, não uso", a armadilha que esta casa já pagou 7 vezes).
   */
  const rota = readFileSync(join(process.cwd(), 'app/api/contas-a-pagar/route.ts'), 'utf-8')
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

  it('⭐ os três aggregates de pagas usam a base DAS PAGAS', () => {
    const usos = (rota.match(/whereBasePagas/g) ?? []).length
    // 1 declaração + os 3 aggregates (total, conciliadas, sem vínculo)
    expect(usos, 'um dos KPIs de pagas voltou pra base de aberto e esconde as conciliadas')
      .toBeGreaterThanOrEqual(4)
    for (const e of ['PAGA', 'PAGA_CONCILIADA', 'PAGA_SEM_VINCULO']) {
      const i = rota.indexOf(`whereDoStatus('${e}'`)
      expect(i, `o KPI de ${e} não existe na rota`).toBeGreaterThan(-1)
      // ⭐ a base tem que estar no MESMO `AND` — é o que o aggregate realmente executa
      const linha = rota.slice(rota.lastIndexOf('where:', i), i)
      expect(linha, `o KPI de ${e} está montado sobre a base de ABERTO`).toContain('whereBasePagas')
    }
  })

  it('⛔ e a base das pagas vem da PORTA, não montada à mão na rota', () => {
    expect(rota, 'a rota voltou a montar o escopo na mão — a 2ª definição de "base das pagas"')
      .toContain('baseDosKpisDePagas(kpiBaseInput')
  })
})
