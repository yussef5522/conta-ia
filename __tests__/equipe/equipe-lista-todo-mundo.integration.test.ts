// ⭐⭐ EQUIPE — UMA LISTA COM TODO MUNDO (06/09/2026).
//
// **O incidente que criou esta tela:** o cadastro de gente vivia em `/producao/cadastros`, e
// o único link até lá era a palavra **"setores"**, cinza de 11px, **dentro do formulário de
// nova ordem** — só aparecia depois de clicar em "nova ordem" E ter pelo menos uma ficha.
// Medido em prod: o `href` **não existia** no HTML da Produção. O dono, com as 37 chaves do
// OWNER, não tinha caminho nenhum. Não era permissão: era controle morto.
//
// ⛔ E O QUE ESTE ARQUIVO TRAVA é a régua do dono: **uma lista com quem loga E quem usa PIN**,
// juntando as fontes que já existem — sem tabela nova, sem migration, sem dado se mexendo.

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { prisma } from '@/lib/db'
import { listarEquipe, resumoDaEquipe, humanizarPapel } from '@/lib/equipe/listar-equipe'
import { cadastrarPessoa } from '@/lib/stock/producao/cadastrar-pessoa'
import { quemEstaComOPin } from '@/lib/stock/producao/pin'
import { randomBytes } from 'crypto'

// ⚠️ CNPJ ÚNICO NA SUÍTE: a 1ª versão repetiu o do `cadeia-2elos` e os dois arquivos, em
// PARALELO, apagavam a empresa um do outro no `beforeEach` (FK violation). Só aparece na
// suíte inteira — rodando o arquivo sozinho passa.
const CNPJ = '31415926000153'
let companyId = ''
const ids: Record<string, string> = {}

beforeEach(async () => {
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
  await prisma.user.deleteMany({ where: { email: { in: ['dono-eq@t.com', 'ger-eq@t.com', 'tablet-eq@t.com'] } } })
  companyId = (await prisma.company.create({ data: { cnpj: CNPJ, name: 'EQUIPE' } })).id

  for (const [chave, nome] of [['owner', 'OWNER'], ['gerente', 'GERENTE_ESTOQUE'], ['aparelho', 'EXECUTOR_PRODUCAO']] as const) {
    ids[`role_${chave}`] = (await prisma.role.create({ data: { companyId, name: nome } })).id
  }
  for (const [chave, email, nome] of [
    ['dono', 'dono-eq@t.com', 'Yussef'],
    ['gerente', 'ger-eq@t.com', 'Marcyelle'],
    ['tablet', 'tablet-eq@t.com', 'Tablet da cozinha'],
  ] as const) {
    ids[chave] = (await prisma.user.create({ data: { email, password: 'x', name: nome } })).id
  }
  await prisma.userCompanyRole.create({ data: { companyId, userId: ids.dono, roleId: ids.role_owner } })
  await prisma.userCompanyRole.create({ data: { companyId, userId: ids.gerente, roleId: ids.role_gerente } })
  await prisma.userCompanyRole.create({ data: { companyId, userId: ids.tablet, roleId: ids.role_aparelho } })
  // convite pendente (o Cristian)
  await prisma.companyInvite.create({
    data: {
      companyId, email: 'cristian-eq@t.com', roleId: ids.role_gerente,
      token: randomBytes(32).toString('hex'), expiresAt: new Date(Date.now() + 7 * 86400000), invitedById: ids.dono,
    },
  })
  // cozinha: uma com PIN, outra sem
  await cadastrarPessoa({ companyId, nome: 'Carlise', funcao: 'COZINHA', pin: '4726' }, prisma)
  await prisma.stockColaborador.create({ data: { companyId, nome: 'Michelle' } })
})

afterEach(async () => {
  await prisma.stockColaboradorPin.deleteMany({ where: { companyId } })
  await prisma.stockColaborador.deleteMany({ where: { companyId } })
  await prisma.companyInvite.deleteMany({ where: { companyId } })
  await prisma.userCompanyRole.deleteMany({ where: { companyId } })
  await prisma.role.deleteMany({ where: { companyId } })
  await prisma.user.deleteMany({ where: { id: { in: [ids.dono, ids.gerente, ids.tablet] } } })
  await prisma.company.deleteMany({ where: { id: companyId } })
})

describe('⭐⭐ a lista junta as DUAS fontes de gente', () => {
  it('⭐⭐ todo mundo aparece: quem loga, quem usa PIN, quem foi convidado', async () => {
    const pessoas = await listarEquipe(companyId, prisma)
    const porNome = new Map(pessoas.map((p) => [p.nome, p]))
    expect([...porNome.keys()].sort()).toEqual(
      ['Carlise', 'Marcyelle', 'Michelle', 'Tablet da cozinha', 'Yussef', 'cristian-eq'].sort(),
    )
  })

  it('⭐⭐ e cada um com a FUNÇÃO e o TIPO DE ACESSO — a coluna que o dono pediu', async () => {
    const p = new Map((await listarEquipe(companyId, prisma)).map((x) => [x.nome, x]))
    expect(p.get('Yussef')).toMatchObject({ funcao: 'Dono', tipo: 'LOGIN' })
    expect(p.get('Marcyelle')).toMatchObject({ funcao: 'Gerente de estoque', tipo: 'LOGIN' })
    expect(p.get('cristian-eq')).toMatchObject({ funcao: 'Gerente de estoque', tipo: 'CONVITE_PENDENTE' })
    expect(p.get('Carlise')).toMatchObject({ funcao: 'Cozinha / produção', tipo: 'PIN' })
    expect(p.get('Tablet da cozinha')).toMatchObject({ funcao: 'Aparelho', tipo: 'APARELHO', ehAparelho: true })
  })

  it('⛔⛔ cozinha SEM PIN aparece como pendência — não some da lista', async () => {
    const michelle = (await listarEquipe(companyId, prisma)).find((p) => p.nome === 'Michelle')!
    expect(michelle.tipo).toBe('SEM_ACESSO')
    // ⚠️ é o estado que precisa de um clique: cadastrada e sem conseguir entrar no tablet.
    // Numa lista que só mostrasse "quem tem acesso", ela seria invisível.
    expect(michelle.detalhe).toMatch(/sem PIN/)
    expect(michelle.colaboradorId, 'a linha tem que oferecer definir o PIN').toBeTruthy()
  })

  it('⛔ a CONTA DE APARELHO aparece marcada — esconder deixaria uma sessão permanente invisível', async () => {
    const t = (await listarEquipe(companyId, prisma)).find((p) => p.ehAparelho)!
    expect(t.detalhe).toMatch(/conta de aparelho/)
    // ⚠️ reconhecida pelo PAPEL, não pelo e-mail: a próxima conta de aparelho terá outro
    // nome e continua sendo aparelho.
    expect(t.email).toBe('tablet-eq@t.com')
    expect(resumoDaEquipe(await listarEquipe(companyId, prisma)).total, 'aparelho não conta como pessoa').toBe(5)
  })

  it('⭐ o resumo conta o que importa e a pendência é visível', async () => {
    const r = resumoDaEquipe(await listarEquipe(companyId, prisma))
    expect(r).toMatchObject({ cozinha: 2, comLogin: 2, convitesPendentes: 1, semAcesso: 1, aparelhos: 1 })
  })

  it('⭐ ordem: gerência primeiro, cozinha depois, aparelho por último', async () => {
    const nomes = (await listarEquipe(companyId, prisma)).map((p) => p.nome)
    expect(nomes[nomes.length - 1], 'aparelho não é gente — vai por último').toBe('Tablet da cozinha')
    expect(nomes.indexOf('Marcyelle')).toBeLessThan(nomes.indexOf('Carlise'))
  })

  it('⭐ o papel é humanizado só no RÓTULO — a chave do RBAC continua a técnica', () => {
    expect(humanizarPapel('GERENTE_ESTOQUE')).toBe('Gerente de estoque')
    expect(humanizarPapel('OWNER')).toBe('Dono')
    // papel custom que ninguém mapeou aparece como está, sem inventar tradução
    expect(humanizarPapel('PAPEL_QUE_NAO_EXISTE')).toBe('PAPEL_QUE_NAO_EXISTE')
  })
})

describe('⛔ nada de dado se moveu — a limpeza é de TELA e ROTA', () => {
  it('⛔⛔ o PIN da Carlise continua funcionando depois da tela mudar de casa', async () => {
    expect((await quemEstaComOPin(companyId, '4726', prisma))?.nome).toBe('Carlise')
  })

  it('⭐ e as fontes continuam separadas por baixo: cozinha NÃO virou User', async () => {
    expect(await prisma.user.count({ where: { name: 'Carlise' } })).toBe(0)
    expect(await prisma.stockColaborador.count({ where: { companyId, ativo: true } })).toBe(2)
  })

  it('⛔ convite já aceito ou expirado NÃO polui a lista', async () => {
    await prisma.companyInvite.updateMany({ where: { companyId }, data: { acceptedAt: new Date() } })
    const pessoas = await listarEquipe(companyId, prisma)
    expect(pessoas.some((p) => p.tipo === 'CONVITE_PENDENTE'), 'convite aceito continuou pendente').toBe(false)
  })
})
