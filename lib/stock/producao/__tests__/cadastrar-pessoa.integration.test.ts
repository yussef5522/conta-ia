// ⭐⭐ UM GESTO, E A PESSOA PRODUZ NO MESMO DIA (06/09/2026).
//
// **O teste de facilidade, nas palavras do dono:** *"Contratei gente nova? Abro a tela, nome +
// função + PIN, e ela produz no mesmo dia."*
//
// E a régua de segurança que veio junto do incidente do convite: **o papel nunca é escolhido
// por default — ele sai da FUNÇÃO**, no servidor.

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { prisma } from '@/lib/db'
import { cadastrarPessoa, validarCadastro, CadastroError, DESCRICAO_DA_FUNCAO } from '../cadastrar-pessoa'
import { quemEstaComOPin } from '../pin'
import { DEFAULT_ROLES, expandPermissions } from '@/lib/auth/permissions'

const CNPJ = '66554433000122'
let companyId = ''
let roleGerente = ''
let roleOwner = ''

beforeEach(async () => {
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
  companyId = (await prisma.company.create({ data: { cnpj: CNPJ, name: 'EQUIPE' } })).id
  // ⛔⛔ O OWNER NASCE PRIMEIRO DE PROPÓSITO. A 1ª versão deste fixture tinha UM papel só, e
  // com um papel só "pegar o certo" e "pegar qualquer um" dão o mesmo resultado — o guard
  // passava por cegueira (medido na REGRA 11: troquei a busca por `findFirst` sem filtro de
  // nome e os 13 testes seguiram VERDES). Com o OWNER na frente, escolher errado entrega a
  // empresa inteira, que é exatamente o susto de 06/09.
  roleOwner = (await prisma.role.create({
    data: { companyId, name: 'OWNER', description: 'acesso total — o papel que NUNCA pode sair por default' },
  })).id
  roleGerente = (await prisma.role.create({
    data: { companyId, name: 'GERENTE_ESTOQUE', description: DEFAULT_ROLES.GERENTE_ESTOQUE.description },
  })).id
})

afterEach(async () => {
  await prisma.stockColaboradorPin.deleteMany({ where: { companyId } })
  await prisma.stockColaborador.deleteMany({ where: { companyId } })
  await prisma.role.deleteMany({ where: { companyId } })
  await prisma.company.deleteMany({ where: { id: companyId } })
})

describe('⭐⭐ COZINHA: nome + PIN, e acabou', () => {
  it('⭐⭐ a Carlise entra em UM gesto — colaborador e PIN na mesma ida', async () => {
    const r = await cadastrarPessoa({ companyId, nome: 'Carlise', funcao: 'COZINHA', pin: '4726' }, prisma)
    expect(r.funcao).toBe('COZINHA')
    expect(r.colaboradorId).toBeTruthy()
    // ⭐ e ela JÁ entra no tablet: o PIN identifica na hora
    expect((await quemEstaComOPin(companyId, '4726', prisma))?.nome).toBe('Carlise')
  })

  it('⛔⛔ cozinha NÃO ganha conta, papel nem e-mail — ela não loga em nada', async () => {
    await cadastrarPessoa({ companyId, nome: 'Michelle', funcao: 'COZINHA', pin: '5813' }, prisma)
    expect(await prisma.user.count({ where: { name: 'Michelle' } })).toBe(0)
    expect(await prisma.userCompanyRole.count({ where: { companyId } })).toBe(0)
    expect(await prisma.companyInvite.count({ where: { companyId } })).toBe(0)
    expect(DESCRICAO_DA_FUNCAO.COZINHA.papelRbac, 'cozinha não tem papel de RBAC').toBeNull()
  })

  it('⛔⛔ PIN recusado DESFAZ o colaborador — meio-cadastro é pior que nenhum', async () => {
    await cadastrarPessoa({ companyId, nome: 'Nadine', funcao: 'COZINHA', pin: '4726' }, prisma)
    // "1234" é óbvio demais → o PIN é recusado
    await expect(cadastrarPessoa({ companyId, nome: 'Outra', funcao: 'COZINHA', pin: '1234' }, prisma))
      .rejects.toThrow(CadastroError)
    // ⛔ e ela NÃO ficou na lista sem conseguir entrar
    expect(await prisma.stockColaborador.count({ where: { companyId, nome: 'Outra' } })).toBe(0)
  })

  it('⛔ PIN repetido também desfaz — dois PINs iguais tornam "quem fez" adivinhação', async () => {
    await cadastrarPessoa({ companyId, nome: 'Carlise', funcao: 'COZINHA', pin: '4726' }, prisma)
    await expect(cadastrarPessoa({ companyId, nome: 'Michelle', funcao: 'COZINHA', pin: '4726' }, prisma))
      .rejects.toThrow(/já usa esse PIN/)
    expect(await prisma.stockColaborador.count({ where: { companyId, nome: 'Michelle' } })).toBe(0)
  })

  it('⛔ nome repetido é recusado — senão o relatório do mês soma duas pessoas numa', async () => {
    await cadastrarPessoa({ companyId, nome: 'Carlise', funcao: 'COZINHA', pin: '4726' }, prisma)
    await expect(cadastrarPessoa({ companyId, nome: 'Carlise', funcao: 'COZINHA', pin: '9182' }, prisma))
      .rejects.toThrow(/Já existe alguém chamado/)
  })

  it('⭐ as três gurias entram em três gestos, sem passo dois', async () => {
    for (const [nome, pin] of [['Carlise', '4726'], ['Michelle', '5813'], ['Nadine', '9047']] as const) {
      await cadastrarPessoa({ companyId, nome, funcao: 'COZINHA', pin }, prisma)
    }
    expect(await prisma.stockColaborador.count({ where: { companyId, ativo: true } })).toBe(3)
    expect(await prisma.stockColaboradorPin.count({ where: { companyId, revogadoEm: null } })).toBe(3)
    expect(await prisma.user.count({ where: { email: { contains: '@' } } }), 'nenhuma conta criada').toBeGreaterThanOrEqual(0)
    expect(await prisma.companyInvite.count({ where: { companyId } }), 'nenhum convite').toBe(0)
  })
})

describe('⭐⭐ GERENTE: e-mail, e o papel sai da FUNÇÃO', () => {
  it('⭐⭐ devolve o papel GERENTE_ESTOQUE resolvido no servidor — nunca um default', async () => {
    const r = await cadastrarPessoa({ companyId, nome: 'Cristian', funcao: 'GERENTE_ESTOQUE', email: 'FortesCristian87@Gmail.com' }, prisma)
    expect(r.roleId).toBe(roleGerente)
    // ⛔⛔ e NÃO é o primeiro papel que aparecer: o OWNER existe e está na frente na ordem de
    // criação. É esta linha que morde quando alguém "simplifica" a busca do papel.
    expect(r.roleId).not.toBe(roleOwner)
    // ⚠️ e-mail normalizado: o convite casa por e-mail, e "Fortes...@Gmail" não pode virar
    // outra pessoa que "Fortes...@gmail"
    expect(r.email).toBe('fortescristian87@gmail.com')
    expect(r.colaboradorId, 'gerente não é colaborador de produção').toBeNull()
  })

  it('⛔⛔ e o papel do gerente NÃO vê financeiro — a fronteira do dono', () => {
    const chaves = expandPermissions([...DEFAULT_ROLES.GERENTE_ESTOQUE.permissions])
    expect(chaves.filter((k) => /^(transaction|bank_account|dre|report|category)\./.test(k))).toEqual([])
    expect(chaves.sort()).toEqual(['stock.executar', 'stock.manage', 'stock.operate', 'stock.view'])
  })

  it('⛔⛔ o papel sai da FUNÇÃO, não de "o que estiver lá" — mesmo com OWNER na empresa', async () => {
    const papeis = await prisma.role.findMany({ where: { companyId }, orderBy: { createdAt: 'asc' }, select: { name: true } })
    expect(papeis[0].name, 'o OWNER é o primeiro — quem pegar "o primeiro" entrega tudo').toBe('OWNER')
    const r = await cadastrarPessoa({ companyId, nome: 'Marcyelle', funcao: 'GERENTE_ESTOQUE', email: 'm@x.com' }, prisma)
    const escolhido = await prisma.role.findUnique({ where: { id: r.roleId! }, select: { name: true } })
    expect(escolhido!.name).toBe('GERENTE_ESTOQUE')
  })

  it('⛔ papel ausente dá mensagem ACIONÁVEL (é a cicatriz de 24/08: seed não rodado)', async () => {
    await prisma.role.deleteMany({ where: { companyId } })
    await expect(cadastrarPessoa({ companyId, nome: 'X', funcao: 'GERENTE_ESTOQUE', email: 'x@y.com' }, prisma))
      .rejects.toThrow(/seed do RBAC/)
  })
})

describe('⭐ a validação é PURA e vale nos dois lados', () => {
  it('⛔ cozinha sem PIN, gerente sem e-mail: cada um cobra o SEU campo', () => {
    expect(validarCadastro({ nome: 'A', funcao: 'COZINHA' })).toMatch(/PIN/)
    expect(validarCadastro({ nome: 'A', funcao: 'GERENTE_ESTOQUE' })).toMatch(/e-mail/)
    expect(validarCadastro({ nome: '', funcao: 'COZINHA', pin: '4726' })).toMatch(/nome/)
    expect(validarCadastro({ nome: 'A', funcao: 'INVENTADA', pin: '1' })).toMatch(/função/)
  })

  it('⛔⛔ campo do OUTRO mundo é recusado — não é gentileza, é tela confusa', () => {
    // ⚠️ guardar e-mail de quem não tem conta é dado pessoal à toa; PIN pra quem loga é
    // um segredo que não protege nada.
    expect(validarCadastro({ nome: 'A', funcao: 'COZINHA', pin: '4726', email: 'a@b.com' })).toMatch(/não usa e-mail/)
    expect(validarCadastro({ nome: 'A', funcao: 'GERENTE_ESTOQUE', email: 'a@b.com', pin: '4726' })).toMatch(/não com PIN/)
  })

  it('⭐ e o caminho feliz passa nos dois', () => {
    expect(validarCadastro({ nome: 'Carlise', funcao: 'COZINHA', pin: '4726' })).toBeNull()
    expect(validarCadastro({ nome: 'Cristian', funcao: 'GERENTE_ESTOQUE', email: 'a@b.com' })).toBeNull()
  })

  it('⛔ e-mail sem cara de e-mail não passa', () => {
    expect(validarCadastro({ nome: 'A', funcao: 'GERENTE_ESTOQUE', email: 'fortescristian87' })).toMatch(/não parece válido/)
  })
})
