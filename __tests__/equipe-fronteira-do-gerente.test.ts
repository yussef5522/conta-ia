// ⛔⛔⛔ O GERENTE DE ESTOQUE NÃO ABRIA A TELA DE EQUIPE (08/09/2026).
//
// *"Cristian e Marcyelle (GERENTE_ESTOQUE) passam a poder, na tela de Equipe: adicionar
// pessoa de COZINHA (nome + PIN), TROCAR/redefinir o PIN de quem esqueceu, inativar/
// reativar colaborador de cozinha. (…) A FRONTEIRA: eles gerenciam COLABORADOR (gente de
// PIN), NUNCA usuário de login."*
//
// ⭐ MEDIDO ANTES DE MEXER, e o achado mudou o tamanho do trabalho: **a fronteira já estava
// de pé no servidor**. As rotas de colaborador/PIN já exigem `stock.manage` (que o
// GERENTE_ESTOQUE tem via `stock.*`), e convite/papel/aparelho já exigem `user.invite` (que
// ele NÃO tem). O que barrava era só a PORTA: a página inteira exigia `user.invite`.
//
// ⚠️ Este teste trava a fronteira na FONTE DA VERDADE (o mapa de permissões), não no texto
// das rotas — grep em rota não distingue "refatorei" de "quebrei" (REGRA 3).

import { describe, it, expect } from 'vitest'
import { DEFAULT_ROLES, permissionMatches } from '@/lib/auth/permissions'

const doGerente = [...DEFAULT_ROLES.GERENTE_ESTOQUE.permissions]
const pode = (p: string) => permissionMatches(doGerente, p)

describe('⭐ o gerente de estoque gerencia COLABORADOR', () => {
  it('cadastrar/inativar colaborador e trocar PIN exigem stock.manage — e ele tem', () => {
    expect(pode('stock.manage')).toBe(true)
  })

  it('e continua podendo o resto do módulo', () => {
    expect(pode('stock.view')).toBe(true)
    expect(pode('stock.operate')).toBe(true)
  })
})

describe('⛔⛔ A FRONTEIRA: nunca usuário de login', () => {
  it('NÃO convida, NÃO muda papel, NÃO remove usuário', () => {
    expect(pode('user.invite')).toBe(false)
    expect(pode('user.assign_role')).toBe(false)
    expect(pode('user.remove')).toBe(false)
  })

  it('⚠️ e não vaza pro financeiro — a régua do papel continua inteira', () => {
    expect(pode('transaction.view')).toBe(false)
    expect(pode('bank_account.view')).toBe(false)
  })

  it('⛔ "marcar aparelho" é acesso ao sistema, não colaborador — fica com o dono', () => {
    // a rota /equipe/aparelho exige `user.invite`; a trava é a mesma do convite
    expect(pode('user.invite')).toBe(false)
    expect(permissionMatches([...DEFAULT_ROLES.OWNER.permissions], 'user.invite')).toBe(true)
  })

  it('⛔⛔ REPONDO O DEFEITO: se stock.* virasse "*", a fronteira inteira cairia', () => {
    // o teste que morde — é a única forma de `stock.*` passar a autorizar convite
    expect(permissionMatches(['*'], 'user.invite')).toBe(true)
    expect(doGerente).not.toContain('*')
    expect(doGerente).toEqual(['stock.*'])
  })
})

describe('⭐ a PORTA da tela abre pras duas metades', () => {
  // a página pede ['user.invite', 'stock.manage'] — QUALQUER UMA
  const exigidas = ['user.invite', 'stock.manage']
  const abre = (perms: readonly string[]) => exigidas.some((p) => permissionMatches([...perms], p))

  it('o dono abre (pela primeira) e o gerente de estoque abre (pela segunda)', () => {
    expect(abre(DEFAULT_ROLES.OWNER.permissions)).toBe(true)
    expect(abre(DEFAULT_ROLES.GERENTE_ESTOQUE.permissions)).toBe(true)
  })

  it('⛔ e quem não tem nenhuma das duas continua FORA', () => {
    expect(abre(DEFAULT_ROLES.EXECUTOR_PRODUCAO.permissions)).toBe(false)
    expect(abre(DEFAULT_ROLES.LEITURA_ESTOQUE.permissions)).toBe(false)
    expect(abre(DEFAULT_ROLES.OPERADOR_ESTOQUE.permissions)).toBe(false)
  })

  it('⚠️ abrir a porta NÃO afrouxa a ação: o gerente entra e o aparelho continua barrado', () => {
    expect(abre(DEFAULT_ROLES.GERENTE_ESTOQUE.permissions)).toBe(true)
    expect(permissionMatches([...DEFAULT_ROLES.GERENTE_ESTOQUE.permissions], 'user.invite')).toBe(false)
  })
})
