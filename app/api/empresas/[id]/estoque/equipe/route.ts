// ⭐⭐ CADASTRAR GENTE EM UM GESTO (06/09/2026) — a FUNÇÃO decide tudo.
//
// COZINHA → colaborador + PIN, resolvido aqui, e ela produz no mesmo dia.
// GERENTE → delega pro fluxo de convite QUE JÁ EXISTE (`POST /empresas/[id]/usuarios`), com
// o papel GERENTE_ESTOQUE já escolhido. ⛔ REGRA 4: não existe um segundo jeito de criar
// convite — duplicar aqui faria as duas portas divergirem na primeira regra nova (expiração,
// e-mail, auditoria), e é assim que um convite volta a sair com papel errado.

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { guardStock } from '@/lib/stock/require-stock'
import { cadastrarPessoa, CadastroError, FUNCOES } from '@/lib/stock/producao/cadastrar-pessoa'
import { listColaboradores } from '@/lib/stock/producao/cadastros'
import { colaboradoresComPin } from '@/lib/stock/producao/pin'
import { POST as criarConvite } from '@/app/api/empresas/[id]/usuarios/route'

interface Params { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, { params }: Params) {
  const { id: companyId } = await params
  const a = await guardStock(request, companyId, 'stock.view')
  if (a.erro) return a.erro
  const [colaboradores, comPin] = await Promise.all([
    listColaboradores(companyId),
    colaboradoresComPin(companyId, prisma),
  ])
  return NextResponse.json({ colaboradores, comPin: [...comPin] })
}

const schema = z.object({
  nome: z.string().min(1).max(80),
  funcao: z.enum(FUNCOES),
  pin: z.string().optional(),
  email: z.string().optional(),
})

export async function POST(request: NextRequest, { params }: Params) {
  const { id: companyId } = await params
  // ⚠️ cadastrar gente é GERÊNCIA: quem define o PIN de alguém decide de quem vai ser a
  // assinatura do trabalho, e quem convida um gerente está dando acesso à empresa.
  const a = await guardStock(request, companyId, 'stock.manage')
  if (a.erro) return a.erro

  const body = await request.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ erro: 'Preencha o nome e escolha a função.' }, { status: 400 })

  let pessoa
  try {
    pessoa = await cadastrarPessoa({ ...parsed.data, companyId, userId: a.user.sub }, prisma)
  } catch (e) {
    if (e instanceof CadastroError) return NextResponse.json({ erro: e.message }, { status: 422 })
    throw e
  }

  if (pessoa.funcao === 'COZINHA') {
    return NextResponse.json({
      ok: true, funcao: 'COZINHA', colaboradorId: pessoa.colaboradorId,
      // ⭐ a frase que fecha o gesto: ela já pode trabalhar, e o dono sabe disso sem procurar
      mensagem: `${parsed.data.nome.trim()} já pode entrar no tablet da cozinha com o PIN dela.`,
    })
  }

  // ⭐ o convite pelo caminho de sempre, com o papel resolvido pela FUNÇÃO (nunca default)
  const req = new NextRequest(new URL(`/api/empresas/${companyId}/usuarios`, request.url), {
    method: 'POST',
    headers: request.headers,
    body: JSON.stringify({ email: pessoa.email, roleId: pessoa.roleId }),
  })
  const r = await criarConvite(req, { params: Promise.resolve({ id: companyId }) })
  const j = await r.json().catch(() => null)
  if (!r.ok) return NextResponse.json({ erro: j?.erro ?? 'Não consegui enviar o convite.' }, { status: r.status })

  return NextResponse.json({
    ok: true, funcao: 'GERENTE_ESTOQUE', email: pessoa.email,
    inviteUrl: j?.inviteUrl ?? null,
    emailSent: j?.emailSent ?? false,
    mensagem: j?.emailSent
      ? `Convite enviado pra ${pessoa.email}. Ele cria a senha dele e entra com estoque inteiro, sem financeiro.`
      // ⚠️ e-mail que não saiu NÃO é sucesso silencioso: o dono precisa do link pra mandar
      // por WhatsApp, senão fica achando que convidou e a pessoa nunca recebeu.
      : `Cadastrado, mas o e-mail não saiu. Copie o link e mande pra ${pessoa.email}.`,
  })
}
