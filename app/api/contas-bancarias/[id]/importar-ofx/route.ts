import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { parseOFX } from '@/lib/ofx/parser'
import { detectarBanco, bateComPerfilDaConta } from '@/lib/ofx/bancos'
import { dedupHashOFX, filtrarNovasOFX } from '@/lib/ofx/dedup'

interface Params { params: Promise<{ id: string }> }

async function verificarAcesso(userId: string, contaId: string) {
  return prisma.bankAccount.findFirst({
    where: { id: contaId, company: { users: { some: { userId } } } },
  })
}

// POST /api/contas-bancarias/[id]/importar-ofx
// Body: multipart/form-data com campo "file" (arquivo .ofx ou .qfx)
// Query: ?preview=true retorna preview sem inserir; sem ?preview insere as transações
export async function POST(request: NextRequest, { params }: Params) {
  const { id: contaId } = await params
  const user = await getAuthUser(request)
  if (!user) return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })

  const conta = await verificarAcesso(user.sub, contaId)
  if (!conta) return NextResponse.json({ erro: 'Conta não encontrada' }, { status: 404 })

  const isPreview = request.nextUrl.searchParams.get('preview') === 'true'

  let rawContent: string
  try {
    const formData = await request.formData()
    const file = formData.get('file')
    if (!file || typeof file === 'string') {
      return NextResponse.json({ erro: 'Arquivo OFX não enviado' }, { status: 400 })
    }
    rawContent = await (file as File).text()
  } catch {
    return NextResponse.json({ erro: 'Erro ao ler arquivo' }, { status: 400 })
  }

  const { transactions, errors, bankId } = parseOFX(rawContent)

  if (transactions.length === 0) {
    return NextResponse.json({
      erro: 'Nenhuma transação encontrada no arquivo',
      errosParser: errors,
    }, { status: 400 })
  }

  // Detecção de banco a partir do BANKID do OFX (FEBRABAN)
  const bancoDetectado = detectarBanco(bankId)
  const banco = bancoDetectado
    ? {
        codigo: bancoDetectado.codigo,
        nome: bancoDetectado.nome,
        batePerfilConta: bateComPerfilDaConta(
          { bankName: conta.bankName, bankCode: conta.bankCode },
          bancoDetectado,
        ),
      }
    : null

  // Deduplicação por hash composto (ver lib/ofx/dedup.ts).
  // Lookup contra DB usa os hashes que vamos calcular agora — evita pegar
  // toda a tabela e reduz o IN(...) ao tamanho do arquivo.
  const todosHashes = transactions.map((t) => dedupHashOFX(t))
  const existentes = await prisma.transaction.findMany({
    where: { bankAccountId: contaId, dedupHash: { in: todosHashes } },
    select: { dedupHash: true },
  })
  const hashesExistentes = new Set(
    existentes.map((e) => e.dedupHash).filter((h): h is string => h !== null),
  )

  const { novas, duplicadasNoArquivo, duplicadasNoBanco } = filtrarNovasOFX(transactions, hashesExistentes)
  const duplicadas = duplicadasNoArquivo + duplicadasNoBanco

  if (isPreview) {
    return NextResponse.json({
      preview: novas.map((t) => ({
        fitid: t.fitid,
        dedupHash: t.dedupHash,
        date: t.datePosted,
        amount: t.amount,
        type: t.type,
        memo: t.memo,
      })),
      total: transactions.length,
      novas: novas.length,
      duplicadas,
      errosParser: errors,
      banco,
    })
  }

  // Inserção em lote das transações novas + recalcula saldo
  if (novas.length === 0) {
    return NextResponse.json({
      mensagem: 'Todas as transações já foram importadas anteriormente.',
      inseridas: 0,
      duplicadas,
    })
  }

  const ajusteSaldo = novas.reduce((acc, t) => {
    return acc + (t.type === 'CREDIT' ? t.amount : -t.amount)
  }, 0)

  await prisma.$transaction([
    prisma.transaction.createMany({
      data: novas.map((t) => ({
        bankAccountId: contaId,
        date: t.datePosted,
        description: t.memo,
        amount: t.amount,
        type: t.type,
        status: 'PENDING',
        origin: 'OFX',
        externalId: t.fitid,
        dedupHash: t.dedupHash,
      })),
    }),
    prisma.bankAccount.update({
      where: { id: contaId },
      data: { balance: { increment: ajusteSaldo } },
    }),
  ])

  return NextResponse.json({
    mensagem: `${novas.length} transaç${novas.length !== 1 ? 'ões importadas' : 'ão importada'} com sucesso.`,
    inseridas: novas.length,
    duplicadas,
    errosParser: errors,
  })
}
