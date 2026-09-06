// ⭐⭐ EQUIPE — UMA LISTA COM TODO MUNDO (06/09/2026).
//
// **O pedido do dono:** *"UMA lista com TODO MUNDO — quem loga e quem usa PIN — nome, função
// e tipo de acesso."* É o padrão de quem faz isso bem (Toast, Square, 7shifts): a tela de
// equipe mostra **pessoas**, e o mecanismo de acesso é uma COLUNA, não uma tela separada.
//
// ⛔⛔ E O INCIDENTE QUE ISTO FECHA: o cadastro de gente vivia em `/producao/cadastros`, e o
// único link pra lá era a palavra **"setores"**, em cinza de 11px, **dentro do formulário de
// nova ordem** — só aparecia depois de clicar em "nova ordem" E ter pelo menos uma ficha.
// Medido: o `href` **não existe** no HTML da tela de Produção. O dono, com as 37 chaves do
// OWNER, não tinha caminho nenhum. *Controle que ninguém reconhece como controle é controle
// morto* — a lição de 30/08, agora agravada por estar escondido atrás de outro gesto.
//
// ⭐ POR BAIXO NADA MUDA, e isso é decisão: **cozinha = colaborador + PIN (sem `User`, sem
// e-mail)**, como Toast e Square fazem com *team member*; **gerência = `User` com papel**.
// Esta lib só **junta o que já existe** — zero migration, zero tabela nova. O dado não se
// move; a TELA é que passa a ser uma só.

import type { PrismaClient } from '@prisma/client'
import { prisma as defaultPrisma } from '@/lib/db'
import { colaboradoresComPin } from '@/lib/stock/producao/pin'

/** como a pessoa entra no sistema — é a COLUNA da lista, não uma tela separada */
export type TipoDeAcesso = 'LOGIN' | 'PIN' | 'CONVITE_PENDENTE' | 'APARELHO' | 'SEM_ACESSO'

export interface PessoaDaEquipe {
  /** id da fonte de origem (User, StockColaborador ou CompanyInvite) */
  id: string
  nome: string
  /** o papel do RBAC, ou a função de produção */
  funcao: string
  tipo: TipoDeAcesso
  email: string | null
  /** ⚠️ o detalhe que a tela mostra: "login (email)", "PIN", "convite pendente"… */
  detalhe: string
  /** dá pra editar o PIN daqui? (só quem é colaborador de produção) */
  colaboradorId: string | null
  /** é a conta do próprio aparelho? (não é uma pessoa) */
  ehAparelho: boolean
}

/**
 * ⭐ CONTA DE APARELHO NÃO É PESSOA — e a lista diz isso.
 *
 * ⚠️ Reconhecida pelo PAPEL (`EXECUTOR_PRODUCAO` num `User`), não pelo e-mail: amarrar a um
 * nome de e-mail faria a próxima conta de aparelho, com outro nome, aparecer como gente. O
 * papel é o fato; o e-mail é o rótulo.
 *
 * ⛔ E ela aparece na lista de propósito, marcada — esconder deixaria o dono sem saber que
 * existe uma sessão permanente na loja, que é exatamente o que ele precisa vigiar.
 */
const PAPEL_DE_APARELHO = 'EXECUTOR_PRODUCAO'

export async function listarEquipe(
  companyId: string,
  db: PrismaClient = defaultPrisma,
): Promise<PessoaDaEquipe[]> {
  const [comPapel, convites, colaboradores, comPin] = await Promise.all([
    db.userCompanyRole.findMany({
      where: { companyId },
      include: { user: { select: { id: true, name: true, email: true } }, role: { select: { name: true } } },
    }),
    db.companyInvite.findMany({
      where: { companyId, acceptedAt: null, expiresAt: { gt: new Date() } },
      include: { role: { select: { name: true } } },
    }),
    db.stockColaborador.findMany({ where: { companyId, ativo: true }, select: { id: true, nome: true } }),
    colaboradoresComPin(companyId, db),
  ])

  const out: PessoaDaEquipe[] = []

  // 1. QUEM LOGA (User com papel) — inclui o dono e a conta do aparelho
  for (const m of comPapel) {
    const ehAparelho = m.role.name === PAPEL_DE_APARELHO
    out.push({
      id: m.user.id,
      nome: ehAparelho ? m.user.name : m.user.name,
      funcao: ehAparelho ? 'Aparelho' : humanizarPapel(m.role.name),
      tipo: ehAparelho ? 'APARELHO' : 'LOGIN',
      email: m.user.email,
      detalhe: ehAparelho ? 'conta de aparelho (fica logada no tablet)' : `login (${m.user.email})`,
      colaboradorId: null,
      ehAparelho,
    })
  }

  // 2. CONVIDADO QUE AINDA NÃO ENTROU — aparece porque já é compromisso: o acesso está
  // prometido e o dono precisa ver que está pendente (senão ele reconvida, como já houve).
  for (const c of convites) {
    out.push({
      id: c.id,
      nome: c.email.split('@')[0],
      funcao: humanizarPapel(c.role.name),
      tipo: 'CONVITE_PENDENTE',
      email: c.email,
      detalhe: `convite pendente · ${c.email}`,
      colaboradorId: null,
      ehAparelho: false,
    })
  }

  // 3. QUEM USA PIN (colaborador de produção, sem conta)
  //
  // ⚠️ COLABORADOR SEM PIN aparece como SEM_ACESSO, não some: é justamente quem está
  // cadastrada e **não consegue entrar no tablet** — o estado que precisa de um clique, e o
  // que ficaria invisível numa lista que só mostrasse quem tem acesso.
  for (const c of colaboradores) {
    const tem = comPin.has(c.id)
    out.push({
      id: c.id,
      nome: c.nome,
      funcao: 'Cozinha / produção',
      tipo: tem ? 'PIN' : 'SEM_ACESSO',
      email: null,
      detalhe: tem ? 'PIN (entra pelo tablet)' : 'sem PIN — não consegue entrar no tablet',
      colaboradorId: c.id,
      ehAparelho: false,
    })
  }

  // ⭐ ordem: quem gerencia primeiro, cozinha depois, aparelho por último (não é gente).
  // ⚠️ pendências sobem dentro do grupo: convite parado e "sem PIN" são trabalho a fazer.
  const peso = (p: PessoaDaEquipe) =>
    p.ehAparelho ? 40
      : p.tipo === 'CONVITE_PENDENTE' ? 11
      : p.tipo === 'SEM_ACESSO' ? 21
      : p.tipo === 'PIN' ? 22 : 10
  return out.sort((a, b) => peso(a) - peso(b) || a.nome.localeCompare(b.nome, 'pt-BR'))
}

/**
 * O nome do papel como o dono fala. ⚠️ Só troca o RÓTULO — a chave do RBAC continua sendo o
 * nome técnico, e o que decide acesso é ela.
 */
export function humanizarPapel(nome: string): string {
  const mapa: Record<string, string> = {
    OWNER: 'Dono',
    ADMIN: 'Administrador',
    ACCOUNTANT: 'Contador',
    FINANCIAL: 'Financeiro',
    VIEWER: 'Consulta',
    GERENTE_ESTOQUE: 'Gerente de estoque',
    OPERADOR_ESTOQUE: 'Operador de estoque',
    LEITURA_ESTOQUE: 'Consulta do estoque',
    EXECUTOR_PRODUCAO: 'Aparelho',
  }
  return mapa[nome] ?? nome
}

/** ⭐ o resumo que o topo da tela mostra — contagem por tipo, sem repetir a régua na tela */
export function resumoDaEquipe(pessoas: PessoaDaEquipe[]) {
  return {
    total: pessoas.filter((p) => !p.ehAparelho).length,
    cozinha: pessoas.filter((p) => p.funcao === 'Cozinha / produção').length,
    comLogin: pessoas.filter((p) => p.tipo === 'LOGIN').length,
    convitesPendentes: pessoas.filter((p) => p.tipo === 'CONVITE_PENDENTE').length,
    semAcesso: pessoas.filter((p) => p.tipo === 'SEM_ACESSO').length,
    aparelhos: pessoas.filter((p) => p.ehAparelho).length,
  }
}
