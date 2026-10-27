// INFRA — a CHAVE RESERVA vigiada (FASE 0 PASSO 4, 26/10/2026).
//
// REGRA 3: executa a decisão real. O estado vem do arquivo que os dois scripts da
// madrugada gravam; aqui a leitura e o veredito rodam de verdade.
//
// ⚠️ TODA data é DERIVADA de `Date.now()`, nunca literal: data fixa em posição de
// relógio é bomba de calendário (a REGRA 12 de 01/09), e o guard
// `sem-data-fixa-no-futuro` da casa reprova.

import { describe, it, expect } from 'vitest'
import { writeFileSync, mkdtempSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import {
  lerEstado, avaliarChaveReserva, checkChaveReserva,
  N5_IDADE_MAX_H, N6_IDADE_MAX_DIAS,
} from '../chave-reserva'

const AGORA = new Date(Date.now())
const horasAtras = (h: number) => new Date(AGORA.getTime() - h * 3_600_000)
const diasAtras = (d: number) => horasAtras(d * 24)

const DIARIO_OK = {
  status: 'OK' as const, quando: horasAtras(0.5), detalhe: 'enviado ao cofre (9,2 MB)',
}
const PROVA_OK = {
  status: 'OK' as const, quando: diasAtras(2), detalhe: 'contagens batem',
}

function pastaComEstado(arquivos: Record<string, string>) {
  const dir = mkdtempSync(join(tmpdir(), 'chave-reserva-'))
  for (const [nome, conteudo] of Object.entries(arquivos)) {
    writeFileSync(join(dir, nome), conteudo)
  }
  return dir
}

describe('lerEstado', () => {
  it('parseia a linha que os scripts gravam', () => {
    const dir = pastaComEstado({
      'x.state': `OK ${AGORA.toISOString()} enviado ao cofre (9,2 MB)\n`,
    })
    const e = lerEstado(join(dir, 'x.state'))!
    expect(e.status).toBe('OK')
    expect(e.detalhe).toBe('enviado ao cofre (9,2 MB)')
    rmSync(dir, { recursive: true, force: true })
  })

  it('lê FALHOU com o motivo, inclusive multilinha', () => {
    const dir = pastaComEstado({
      'x.state': `FALHOU ${AGORA.toISOString()} rclone: sem credencial\nsegunda linha`,
    })
    const e = lerEstado(join(dir, 'x.state'))!
    expect(e.status).toBe('FALHOU')
    expect(e.detalhe).toContain('sem credencial')
    rmSync(dir, { recursive: true, force: true })
  })

  it('arquivo que não existe devolve null (não estoura)', () => {
    expect(lerEstado('/caminho/que/nao/existe.state')).toBeNull()
  })

  // ⛔ A RÉGUA: `.state` truncado/estranho é exatamente o caso em que NÃO dá pra
  // afirmar que o backup correu bem. Devolver "OK" otimista aqui seria a mentira
  // mais cara deste arquivo.
  it('linha MALFORMADA devolve null, nunca um OK otimista', () => {
    const dir = pastaComEstado({
      'a.state': 'alguma coisa que não é o formato\n',
      'b.state': 'OK data-que-nao-e-data detalhe\n',
      'c.state': '\n',
    })
    expect(lerEstado(join(dir, 'a.state'))).toBeNull()
    expect(lerEstado(join(dir, 'b.state'))).toBeNull()
    expect(lerEstado(join(dir, 'c.state'))).toBeNull()
    rmSync(dir, { recursive: true, force: true })
  })
})

describe('avaliarChaveReserva', () => {
  it('backup de hoje + prova recente = nada a dizer', () => {
    expect(avaliarChaveReserva({ diario: DIARIO_OK, prova: PROVA_OK, agora: AGORA })).toEqual([])
  })

  // ⭐⭐ O ESTADO DE HOJE EM PROD: sem as 2 chaves do cofre o backup-diario.sh é
  // INERTE e grava FALHOU. O N5 nasce VERMELHO, e isso é a VERDADE — não existe
  // cópia do banco fora da máquina.
  it('N5 grita quando o diário FALHOU, dizendo que não há cópia fora', () => {
    const c = avaliarChaveReserva({
      diario: {
        status: 'FALHOU',
        quando: horasAtras(1),
        detalhe: 'falta /opt/conta-ia/.env.backup — o dono ainda nao deu as 2 chaves do cofre',
      },
      prova: PROVA_OK,
      agora: AGORA,
    })
    const n5 = c.find((x) => x.invariante === 'N5')!
    expect(n5.nivel).toBe('erro')
    expect(n5.detalhe).toContain('2 chaves do cofre')
    expect(n5.detalhe).toContain('NÃO EXISTE')
  })

  it('N5 grita quando o diário NUNCA gravou estado, e ensina o comando', () => {
    const c = avaliarChaveReserva({ diario: null, prova: PROVA_OK, agora: AGORA })
    const n5 = c.find((x) => x.invariante === 'N5')!
    expect(n5.nivel).toBe('erro')
    expect(n5.detalhe).toContain('backup-diario.sh')
  })

  // ⚠️ O TETO DE 36h É MEDIDO, NÃO REDONDO: o backup roda 02:30 e o juiz 03:00, então
  // a idade normal é ~30min. Teto curto daria ALARME FALSO em toda rodada manual do
  // juiz depois das 22h — e alarme falso repetido é como um alarme morre.
  it('rodada manual do juiz a qualquer hora do dia passa CALADA', () => {
    for (const h of [1, 12, 20, 30, 35]) {
      const c = avaliarChaveReserva({
        diario: { ...DIARIO_OK, quando: horasAtras(h) }, prova: PROVA_OK, agora: AGORA,
      })
      expect(c.filter((x) => x.invariante === 'N5'), `idade ${h}h`).toHaveLength(0)
    }
  })

  it('DUAS noites perdidas gritam (o cron parou), mas dizem que a cópia de ontem existe', () => {
    const c = avaliarChaveReserva({
      diario: { ...DIARIO_OK, quando: horasAtras(N5_IDADE_MAX_H + 1) },
      prova: PROVA_OK,
      agora: AGORA,
    })
    const n5 = c.find((x) => x.invariante === 'N5')!
    expect(n5.nivel).toBe('erro')
    expect(n5.detalhe).toContain('crontab -l')
    // ⭐ a frase distingue "parou de rodar" de "não existe cópia nenhuma"
    expect(n5.detalhe).toContain('O ÚLTIMO estado era OK')
  })

  // ⛔ Mais grave que o backup não ter rodado: existe arquivo que NÃO VOLTA.
  it('N6 grita quando a PROVA falhou — e diz que é pior que não ter rodado', () => {
    const c = avaliarChaveReserva({
      diario: DIARIO_OK,
      prova: { status: 'FALHOU', quando: diasAtras(1), detalhe: 'contagem de empresas difere' },
      agora: AGORA,
    })
    const n6 = c.find((x) => x.invariante === 'N6')!
    expect(n6.nivel).toBe('erro')
    expect(n6.detalhe).toContain('NÃO volta')
  })

  it('N6 grita quando a prova NUNCA rodou, com a frase do dono', () => {
    const c = avaliarChaveReserva({ diario: DIARIO_OK, prova: null, agora: AGORA })
    const n6 = c.find((x) => x.invariante === 'N6')!
    expect(n6.detalhe).toContain('esperança, não cópia')
  })

  it('o ciclo semanal normal (até ~7 dias) passa calado; UM domingo perdido grita', () => {
    const dentro = avaliarChaveReserva({
      diario: DIARIO_OK, prova: { ...PROVA_OK, quando: diasAtras(7) }, agora: AGORA,
    })
    expect(dentro.filter((x) => x.invariante === 'N6')).toHaveLength(0)

    const fora = avaliarChaveReserva({
      diario: DIARIO_OK,
      prova: { ...PROVA_OK, quando: diasAtras(N6_IDADE_MAX_DIAS + 4) },
      agora: AGORA,
    })
    const n6 = fora.find((x) => x.invariante === 'N6')!
    expect(n6.detalhe).toContain('domingo')
  })

  // ⚠️ O MODO DE FALHA COMUM (rodou e deu erro) dispara NA HORA pelo status, sem
  // depender de idade nenhuma — é isso que deixa o teto de 36h poder ser folgado.
  it('FALHOU recém-gravado grita IMEDIATAMENTE, independente da idade', () => {
    const c = avaliarChaveReserva({
      diario: { status: 'FALHOU', quando: horasAtras(0.1), detalhe: 'rclone: 403' },
      prova: PROVA_OK,
      agora: AGORA,
    })
    expect(c.find((x) => x.invariante === 'N5')!.nivel).toBe('erro')
  })

  it('os dois quebrados geram DOIS checks (são perguntas diferentes)', () => {
    const c = avaliarChaveReserva({ diario: null, prova: null, agora: AGORA })
    expect(c.map((x) => x.invariante).sort()).toEqual(['N5', 'N6'])
  })
})

describe('checkChaveReserva', () => {
  // ⚠️ O GATE: sem o diretório de estado, esta máquina não é o servidor da chave
  // reserva (dev/Mac) — cala do mesmo jeito que o lerInfra sem /proc.
  it('sem o diretório de estado, se CALA (dev/Mac)', () => {
    const r = checkChaveReserva(AGORA, '/caminho/que/nao/existe')
    expect(r.habilitado).toBe(false)
    expect(r.checks).toEqual([])
  })

  // ⛔ MAS se o diretório EXISTE e o arquivo não, é ERRO — ali o silêncio
  // significaria "o backup nunca rodou e ninguém soube".
  it('diretório EXISTE e arquivo não → acusa (o silêncio seria a falha)', () => {
    const dir = pastaComEstado({})
    const r = checkChaveReserva(AGORA, dir)
    expect(r.habilitado).toBe(true)
    expect(r.checks.map((x) => x.invariante).sort()).toEqual(['N5', 'N6'])
    rmSync(dir, { recursive: true, force: true })
  })

  it('lê os DOIS arquivos reais e devolve verde quando os dois estão OK', () => {
    const dir = pastaComEstado({
      'backup-diario.state': `OK ${horasAtras(0.5).toISOString()} enviado (9,2 MB)`,
      'backup-prova.state': `OK ${diasAtras(2).toISOString()} contagens batem`,
    })
    const r = checkChaveReserva(AGORA, dir)
    expect(r.habilitado).toBe(true)
    expect(r.diario!.status).toBe('OK')
    expect(r.prova!.status).toBe('OK')
    expect(r.checks).toEqual([])
    rmSync(dir, { recursive: true, force: true })
  })

  // ⭐ O ESTADO EXATO DE PROD HOJE, lido do arquivo que o script gravou.
  it('o estado REAL de hoje em prod (diário FALHOU, sem as chaves) acusa N5', () => {
    const dir = pastaComEstado({
      'backup-diario.state':
        `FALHOU ${horasAtras(2).toISOString()} falta /opt/conta-ia/.env.backup — ` +
        'o dono ainda nao deu as 2 chaves do cofre',
      'backup-prova.state': `OK ${diasAtras(1).toISOString()} restore conferido`,
    })
    const r = checkChaveReserva(AGORA, dir)
    expect(r.checks.map((x) => x.invariante)).toEqual(['N5'])
    expect(r.checks[0].detalhe).toContain('chaves do cofre')
    rmSync(dir, { recursive: true, force: true })
  })
})

// ⛔⛔ O GUARD DO CONSUMIDOR — a família "porta sem maçaneta" (13 voltas até hoje).
// Um N5/N6 que roda, acerta e só escreve no stdout do cron é alarme que ninguém
// ouve. `reserva.checks` precisa entrar nos DOIS lugares: a condição que decide
// avisar e o payload que vai pelo canal de alertas.
//
// ⚠️ MEDE O USO, NÃO A MENÇÃO: o import sozinho não conta — e é justamente o
// import que sobreviveria a alguém apagar as duas linhas que importam.
describe('o juiz CONSOME a chave reserva (não é motor solto)', () => {
  it('reserva.checks entra no gate do aviso E no payload', async () => {
    const { readFileSync } = await import('fs')
    const codigo = readFileSync('scripts/cron-judge.ts', 'utf-8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .split('\n')
      .filter((l) => !l.trim().startsWith('//'))
      .join('\n')

    // a condição "preciso avisar alguém?"
    const gate = codigo
      .split('\n')
      .find((l) => l.includes('if (!rep.passed') || l.includes('!stockRep.passed'))
    expect(gate, 'o gate do aviso mudou de forma — reconfira o wiring').toBeTruthy()
    expect(gate).toContain('reserva.checks')

    // e o corpo que o canal de alertas recebe
    const payload = codigo.split('\n').find((l) => l.includes('infraChecks:'))
    expect(payload, 'o payload do aviso mudou de forma').toBeTruthy()
    expect(payload).toContain('...reserva.checks')
  })
})
