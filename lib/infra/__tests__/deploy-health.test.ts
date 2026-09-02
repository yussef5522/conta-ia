// REGRA 1/3 — o invariante do deploy. Cada caso aqui é um incidente REAL de prod.

import { describe, it, expect } from 'vitest'
import { avaliarDeploy, extrairProviderDatasource, MIN_BUILDS_ROLLBACK, type LeituraDeploy } from '../deploy-health'

const sao: LeituraDeploy = {
  ehSymlink: true,
  alvo: '.next-builds/20260826-163400-abc1234',
  buildIdOk: true,
  cssCount: 2,
  buildsGuardados: 3,
  providerSchema: 'postgresql',
  providerClient: 'postgresql',
}

describe('deploy são não acusa nada', () => {
  it('symlink + BUILD_ID + CSS + 3 builds guardados', () => {
    expect(avaliarDeploy(sao)).toEqual([])
  })
})

describe('D1 — os dois estados que DERRUBARAM prod', () => {
  it('⭐ 24/08: BUILD_ID ausente (build morto no meio) → ERRO', () => {
    const r = avaliarDeploy({ ...sao, buildIdOk: false })
    expect(r).toHaveLength(1)
    expect(r[0]).toMatchObject({ invariante: 'D1', nivel: 'erro' })
    expect(r[0].detalhe).toMatch(/BUILD_ID/)
    expect(r[0].detalhe).toMatch(/rollback\.sh/) // o alerta ENSINA a sair
  })

  it('⭐ 26/08: build sem CSS (página sem estilo) → ERRO', () => {
    const r = avaliarDeploy({ ...sao, cssCount: 0 })
    expect(r).toHaveLength(1)
    expect(r[0]).toMatchObject({ invariante: 'D1', nivel: 'erro' })
    expect(r[0].detalhe).toMatch(/CSS/)
  })

  it('BUILD_ID ausente NÃO empilha com "sem CSS" — uma causa, um alerta', () => {
    // mesma disciplina do N1/N3 do juiz de infra: e-mail que vira ruído não é lido
    const r = avaliarDeploy({ ...sao, buildIdOk: false, cssCount: 0 })
    expect(r).toHaveLength(1)
    expect(r[0].detalhe).toMatch(/BUILD_ID/)
  })
})

describe('D2 — o desenho voltou a apodrecer', () => {
  it('⭐ `.next` virou diretório real (alguém buildou por cima do vivo) → AVISO', () => {
    const r = avaliarDeploy({ ...sao, ehSymlink: false })
    expect(r.map((c) => c.invariante)).toEqual(['D2'])
    expect(r[0].nivel).toBe('aviso')
    expect(r[0].detalhe).toMatch(/deploy\.sh/)
  })

  it('⚠️ isso o SMOKE nunca pegaria: o site responde 200 e mesmo assim perdeu a rede', () => {
    // um diretório real serve páginas normalmente — o que se perdeu é a troca
    // atômica e o rollback em segundos. Por isso o invariante olha ESTRUTURA.
    const r = avaliarDeploy({ ...sao, ehSymlink: false })
    expect(r.some((c) => c.nivel === 'erro')).toBe(false) // não derruba nada AGORA
    expect(r).toHaveLength(1) // mas não passa em branco
  })

  it('sem symlink não cobra D3 (não faz sentido pedir histórico a quem não versiona)', () => {
    const r = avaliarDeploy({ ...sao, ehSymlink: false, buildsGuardados: 0 })
    expect(r.map((c) => c.invariante)).toEqual(['D2'])
  })
})

describe('D3 — rollback precisa de pra onde voltar', () => {
  it(`menos de ${MIN_BUILDS_ROLLBACK} builds guardados → AVISO`, () => {
    const r = avaliarDeploy({ ...sao, buildsGuardados: 1 })
    expect(r.map((c) => c.invariante)).toEqual(['D3'])
    expect(r[0].detalhe).toMatch(/rebuild/)
  })

  it(`${MIN_BUILDS_ROLLBACK} já basta`, () => {
    expect(avaliarDeploy({ ...sao, buildsGuardados: MIN_BUILDS_ROLLBACK })).toEqual([])
  })
})

// ⭐⭐ REGRA 1 — O LOGIN FICOU 500 POR 8 HORAS E O TRIO ESTAVA VERDE (28/08).
//
// O que aconteceu: um `prisma generate` rodou com o schema revertido pra `sqlite` (o
// `git reset --hard` do deploy desfaz o swap-postgres, que é passo MANUAL do runbook).
// O `node_modules` é COMPARTILHADO por hard link com o workspace de build → o client
// gerado virou SQLite, o app subiu com ele, e toda query morria com "the URL must start
// with the protocol file:".
//
// ⚠️ E O TRIO NÃO VIU NADA: BUILD_ID ok, pm2 online sem loop, CSS servindo. O gate
// provava que o site era SERVIDO, nunca que ele FALAVA COM O BANCO — a home é estática
// e devolvia 200 enquanto o login dava 500.
describe('D4 — o client do Prisma fala o mesmo banco que o schema?', () => {
  it('⭐⭐ client sqlite com schema postgres → ERRO (o estado exato do incidente)', () => {
    const r = avaliarDeploy({ ...sao, providerClient: 'sqlite' })
    expect(r).toHaveLength(1)
    expect(r[0].invariante).toBe('D4')
    expect(r[0].nivel).toBe('erro')
    expect(r[0].detalhe).toContain('sqlite')
    expect(r[0].detalhe).toContain('postgresql')
  })

  it('⚠️ diz que ROLLBACK não resolve — o client é compartilhado por todos os builds', () => {
    const r = avaliarDeploy({ ...sao, providerClient: 'sqlite' })
    expect(r[0].detalhe).toMatch(/rollback NÃO resolve/i)
    expect(r[0].detalhe).toContain('prisma generate') // e diz o que RESOLVE
  })

  it('iguais → silêncio (dev com sqlite dos dois lados é legítimo)', () => {
    expect(avaliarDeploy({ ...sao, providerSchema: 'sqlite', providerClient: 'sqlite' })).toEqual([])
  })

  it('não dá palpite quando não consegue ler um dos lados', () => {
    expect(avaliarDeploy({ ...sao, providerClient: null })).toEqual([])
    expect(avaliarDeploy({ ...sao, providerSchema: null })).toEqual([])
  })

  it('D4 não some no meio de outro problema (empilha com o D1)', () => {
    const r = avaliarDeploy({ ...sao, buildIdOk: false, providerClient: 'sqlite' })
    expect(r.map((x) => x.invariante).sort()).toEqual(['D1', 'D4'])
  })
})

describe('extrairProviderDatasource — lê o DATASOURCE, não o generator', () => {
  const schema = `
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
`
  it('⭐ pega o do datasource mesmo com o generator antes (a pegadinha)', () => {
    // ⚠️ um grep ingênuo por `provider =` devolveria "prisma-client-js" — foi o que me
    // enganou na primeira leitura do incidente.
    expect(extrairProviderDatasource(schema)).toBe('postgresql')
  })

  it('lê sqlite igual', () => {
    expect(extrairProviderDatasource(schema.replace('postgresql', 'sqlite'))).toBe('sqlite')
  })

  it('schema sem datasource → null (não inventa)', () => {
    expect(extrairProviderDatasource('generator client { provider = "prisma-client-js" }')).toBeNull()
  })
})

describe('⛔⛔ D5 — migration pendente com o trio VERDE (incidente de 02/09)', () => {
  it('⛔⛔ o deploy passou 4/4 e o app lia tabela que não existia → ERRO', () => {
    const r = avaliarDeploy({ ...sao, migrationsPendentes: ['20260902050000_stock_venda_complemento_grupo'] })
    expect(r).toHaveLength(1)
    expect(r[0]).toMatchObject({ invariante: 'D5', nivel: 'erro' })
    // o alerta NOMEIA a migration e ENSINA a saída
    expect(r[0].detalhe).toMatch(/20260902050000/)
    expect(r[0].detalhe).toMatch(/migrate deploy/)
    // ⚠️ e avisa que rollback NÃO resolve — foi o erro de leitura do incidente de 28/08
    expect(r[0].detalhe).toMatch(/rollback.*NÃO resolve/)
  })

  it('⭐ banco em dia não acusa nada', () => {
    expect(avaliarDeploy({ ...sao, migrationsPendentes: [] })).toEqual([])
  })

  it('⚠️ NÃO MEDIDO (undefined) não vira alarme — ausência de medição ≠ problema', () => {
    // sem banco na mão o juiz cala sobre schema, em vez de chutar que está quebrado
    expect(avaliarDeploy({ ...sao, migrationsPendentes: undefined })).toEqual([])
  })

  it('⭐ empilha com o D1: são causas diferentes, dois alertas', () => {
    const r = avaliarDeploy({ ...sao, buildIdOk: false, migrationsPendentes: ['20260902050000_x'] })
    expect(r.map((x) => x.invariante).sort()).toEqual(['D1', 'D5'])
  })
})
