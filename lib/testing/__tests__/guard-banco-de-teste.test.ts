// REGRA 1/3 — a trava que impede a suíte de tocar banco real.
// O caso: `npx vitest` rodado DENTRO do servidor em 08/08/2026 criou 30 perfis PF e
// 18 cartões no banco de PRODUÇÃO. Este teste prova que o mesmo comando agora RECUSA.

import { describe, it, expect } from 'vitest'
import {
  assertBancoDeTeste, ehBancoDeTeste, descreverAlvo, BancoDeProducaoError,
} from '../guard-banco-de-teste'

// As duas URLs REAIS deste projeto (sem credencial — só a forma).
const PROD = 'postgresql://usuario:senha@localhost:5432/conta_ia_prod?schema=public'
const DEV = 'file:./dev.db'

describe('a URL de produção deste projeto', () => {
  it('⭐ é RECUSADA — foi ela que criou 30 perfis de teste em prod', () => {
    expect(ehBancoDeTeste(PROD)).toBe(false)
    expect(() => assertBancoDeTeste(PROD)).toThrow(BancoDeProducaoError)
  })

  it('⚠️ e o host NÃO serve pra distinguir: prod também é localhost', () => {
    // o Postgres de produção roda na mesma máquina — barrar "host remoto" não pegaria
    expect(descreverAlvo(PROD)).toEqual({ protocolo: 'postgresql:', nomeDoBanco: 'conta_ia_prod' })
  })

  it('a mensagem ENSINA a sair — alerta que não diz o que fazer vira ruído', () => {
    try {
      assertBancoDeTeste(PROD)
      throw new Error('devia ter lançado')
    } catch (e) {
      const m = (e as Error).message
      expect(m).toMatch(/conta_ia_prod/)
      expect(m).toMatch(/não rode a suíte aqui/i)
      expect(m).not.toMatch(/senha/) // NUNCA a credencial na mensagem
    }
  })
})

describe('o que PASSA', () => {
  it('o SQLite de dev deste projeto', () => {
    expect(ehBancoDeTeste(DEV)).toBe(true)
    expect(() => assertBancoDeTeste(DEV)).not.toThrow()
  })

  it('Postgres com "test" no nome do banco', () => {
    for (const u of [
      'postgresql://u:p@localhost:5432/conta_ia_test',
      'postgresql://u:p@localhost:5432/test_conta_ia',
      'postgresql://u:p@db:5432/conta-ia-test?schema=public',
      'postgresql://u:p@localhost:5432/scratch',
    ]) expect(ehBancoDeTeste(u)).toBe(true)
  })

  it('sem DATABASE_URL não trava (CI limpo, testes puros)', () => {
    expect(() => assertBancoDeTeste(undefined)).not.toThrow()
    expect(() => assertBancoDeTeste('')).not.toThrow()
  })
})

describe('é ALLOWLIST, não denylist', () => {
  it('⭐ banco Postgres com nome DESCONHECIDO é recusado (não só o que tem "prod")', () => {
    // o dia em que o banco se chamar assim, a trava tem que continuar valendo
    for (const nome of ['conta_ia', 'caixaos', 'principal', 'app', 'conta_ia_2027']) {
      expect(ehBancoDeTeste(`postgresql://u:p@localhost:5432/${nome}`)).toBe(false)
    }
  })

  it('"testemunha" não vira senha-passe por conter "test" no meio da palavra', () => {
    expect(ehBancoDeTeste('postgresql://u:p@localhost:5432/testemunha')).toBe(false)
  })

  it('protocolo desconhecido é recusado', () => {
    expect(ehBancoDeTeste('mysql://u:p@localhost:3306/qualquer_test')).toBe(false)
    expect(ehBancoDeTeste('lixo-que-nao-e-url')).toBe(false)
  })
})
