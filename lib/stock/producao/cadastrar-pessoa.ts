// ⭐⭐ CADASTRAR GENTE EM UM GESTO — A FUNÇÃO DECIDE TUDO (06/09/2026).
//
// **A régua do dono:** *"Contratei gente nova? Abro a tela, nome + função + PIN, e ela produz
// no mesmo dia."* Sem passo dois, sem tela de RBAC, sem ele montar permissão.
//
// ⭐ AS DUAS FUNÇÕES SÃO MUNDOS DIFERENTES, e é isso que a tela esconde:
//
//   COZINHA   → colaborador + PIN. **Não tem conta, não recebe e-mail, não loga.** Ela é
//               identificada pelo PIN dentro da sessão do APARELHO. Produz no mesmo dia.
//   GERENTE   → convite por e-mail, conta própria, papel `GERENTE_ESTOQUE` (estoque inteiro,
//               zero financeiro). Quem cria a senha é ela.
//
// ⛔⛔ O PAPEL NUNCA É ESCOLHIDO POR DEFAULT — ele sai da FUNÇÃO, aqui, no servidor. Foi
// exatamente o que o incidente de 06/09 cobrou: *"o aceite cria a conta DELE com a função
// escolhida, nunca mais 'tudo liberado' por default"*.

import type { PrismaClient } from '@prisma/client'
import { prisma as defaultPrisma } from '@/lib/db'
import { criarColaborador } from './cadastros'
import { definirPin, PinError } from './pin'

export class CadastroError extends Error {}

export const FUNCOES = ['COZINHA', 'GERENTE_ESTOQUE'] as const
export type FuncaoDaPessoa = (typeof FUNCOES)[number]

/**
 * ⭐ O que cada função significa, **num lugar só** — a tela ecoa isto, não reescreve.
 *
 * ⚠️ O texto é o que a pessoa que cadastra lê na hora de decidir. Se ele morar no componente,
 * a próxima tela que cadastrar gente vai descrever a mesma função com outras palavras.
 */
export const DESCRICAO_DA_FUNCAO: Record<FuncaoDaPessoa, { titulo: string; explica: string; papelRbac: string | null }> = {
  COZINHA: {
    titulo: 'Cozinha / produção',
    explica: 'Entra pelo tablet com um PIN e vê só as tarefas dela do dia. Sem e-mail, sem conta, sem senha.',
    papelRbac: null, // ⭐ não tem conta: não há papel a atribuir
  },
  GERENTE_ESTOQUE: {
    titulo: 'Gerente de estoque',
    explica: 'Recebe um convite por e-mail e cria a própria senha. Estoque inteiro; não vê o financeiro.',
    papelRbac: 'GERENTE_ESTOQUE',
  },
}

export interface CadastrarPessoaInput {
  companyId: string
  nome: string
  funcao: FuncaoDaPessoa
  /** obrigatório em COZINHA */
  pin?: string
  /** obrigatório em GERENTE_ESTOQUE */
  email?: string
  userId?: string
}

export interface PessoaCadastrada {
  funcao: FuncaoDaPessoa
  colaboradorId: string | null
  /** o papel que o convite vai carregar (só em GERENTE_ESTOQUE) */
  roleId: string | null
  email: string | null
}

/**
 * ⭐ A VALIDAÇÃO É POR FUNÇÃO — PURA, pra a tela e o servidor concordarem sempre.
 *
 * ⚠️ Devolve a MENSAGEM que a pessoa lê, não um código: aqui o erro é sempre sobre um campo
 * que ela acabou de digitar, e "informe o PIN" resolve; "VALIDATION_ERROR" não.
 */
export function validarCadastro(input: { nome: string; funcao: string; pin?: string; email?: string }): string | null {
  if (!input.nome.trim()) return 'Diga o nome de quem você está cadastrando.'
  if (!FUNCOES.includes(input.funcao as FuncaoDaPessoa)) return 'Escolha a função.'
  if (input.funcao === 'COZINHA') {
    if (!input.pin?.trim()) return 'A cozinha entra por PIN — escolha 4 dígitos.'
    // ⚠️ e-mail junto de COZINHA é sinal de tela confusa, não de gentileza: quem é da cozinha
    // não tem conta, e guardar um e-mail que não serve pra nada vira dado pessoal à toa.
    if (input.email?.trim()) return 'Quem é da cozinha não usa e-mail — ela entra pelo PIN no tablet.'
  }
  if (input.funcao === 'GERENTE_ESTOQUE') {
    if (!input.email?.trim()) return 'O gerente recebe um convite — informe o e-mail dele.'
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(input.email.trim())) return 'Esse e-mail não parece válido.'
    if (input.pin?.trim()) return 'Gerente entra com e-mail e senha, não com PIN.'
  }
  return null
}

/**
 * ⭐ O gesto único. Em COZINHA resolve tudo aqui (colaborador + PIN, na mesma transação).
 * Em GERENTE devolve o `roleId` pra a rota criar o convite pelo fluxo de sempre — **REGRA 4:
 * não existe um segundo jeito de criar convite**, senão as duas portas divergem na primeira
 * regra nova (expiração, e-mail, auditoria).
 */
export async function cadastrarPessoa(
  input: CadastrarPessoaInput,
  db: PrismaClient = defaultPrisma,
): Promise<PessoaCadastrada> {
  const erro = validarCadastro(input)
  if (erro) throw new CadastroError(erro)

  if (input.funcao === 'COZINHA') {
    // ⚠️ nome repetido é recusado: o relatório do fim do mês agrega por pessoa, e duas
    // "Carlise" tornam "quem produz mais" uma pergunta sem resposta.
    const jaTem = await db.stockColaborador.findFirst({
      where: { companyId: input.companyId, nome: input.nome.trim(), ativo: true },
      select: { id: true },
    })
    if (jaTem) throw new CadastroError(`Já existe alguém chamado “${input.nome.trim()}” na equipe.`)

    const colab = await criarColaborador(input.companyId, input.nome, db)
    try {
      // ⭐ colaborador e PIN entram juntos — cadastrar sem PIN deixaria ela sem entrar no
      // tablet, que é o único motivo de existir este cadastro.
      await definirPin({ companyId: input.companyId, colaboradorId: colab.id, pin: input.pin!, userId: input.userId }, db)
    } catch (e) {
      // ⛔ PIN recusado (fácil demais, repetido) desfaz o colaborador: meio-cadastro é pior
      // que cadastro nenhum — a pessoa aparece na lista e não consegue entrar.
      await db.stockColaborador.delete({ where: { id: colab.id } }).catch(() => {})
      throw new CadastroError(e instanceof PinError ? e.message : 'Não consegui gravar o PIN.')
    }
    return { funcao: 'COZINHA', colaboradorId: colab.id, roleId: null, email: null }
  }

  // GERENTE_ESTOQUE — resolve o papel de SISTEMA pelo nome
  const papel = await db.role.findFirst({
    where: { companyId: input.companyId, name: DESCRICAO_DA_FUNCAO.GERENTE_ESTOQUE.papelRbac! },
    select: { id: true },
  })
  if (!papel) {
    // ⚠️ mensagem ACIONÁVEL: papel ausente é seed não rodado, e a saída é um comando — não
    // "erro interno". É a cicatriz de 24/08 (chave nova sem re-seed dando 403 no dono).
    throw new CadastroError(
      'O papel GERENTE_ESTOQUE ainda não existe nesta empresa. Rode o seed do RBAC (scripts/seed-rbac.ts) e tente de novo.',
    )
  }
  return { funcao: 'GERENTE_ESTOQUE', colaboradorId: null, roleId: papel.id, email: input.email!.trim().toLowerCase() }
}
