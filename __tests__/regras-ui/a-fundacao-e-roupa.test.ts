import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { semComentarios, usosDe } from './_leitura-de-fonte'

/**
 * ⛔⛔⛔ A FUNDAÇÃO É **ROUPA** — NENHUMA ROTA, PORTA OU CONTA MUDA (14/10/2026)
 *
 * **Os dois últimos itens de teste do sprint, nas palavras do dono:** *"regressão funcional:
 * nenhuma rota, porta ou conta muda — é roupa; qualquer diff de comportamento = vermelho"* e
 * *"ZERO escrita além da preferência do trilho"*.
 *
 * ⭐⭐ **SÃO A MESMA PERGUNTA** (*"o sprint é roupa?"*) e por isso moram num arquivo só. Dois
 * guards pra uma pergunta divergem no primeiro arquivo novo — a doença que esta casa paga desde
 * os 7 detectores de par. Este arquivo é o DONO; o describe que vivia no
 * `tinta-e-linha-da-fundacao` foi movido pra cá, com o motivo escrito lá.
 *
 * ⚠️⚠️ **O QUE ELE NÃO COBRE, declarado:** *"o diff daquele arquivo é só de classe"* não é
 * verificável sem git, e teste que lê `git status` morde o dia em que a árvore está limpa. A
 * prova do diff é o probe da REGRA 11 (o relatório carrega os 35 arquivos medidos). O que ESTE
 * guard afirma é **estrutural e imune ao git**: quem é roupa não fala com o banco, e a escrita
 * do sprint é UMA.
 */

const RAIZ = process.cwd()
const ler = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8')

/**
 * ⭐ A ROUPA DO SPRINT, declarada item a item (o padrão do congelador de faturas: a lista é
 * DADO, não suposição). Arquivo novo de fundação entra aqui — e se não entrar, a REDE 2 ainda
 * pega a escrita.
 */
const ROUPA = [
  // os primitivos que o `--radius`/`--prod-sombra` alcançam
  'components/ui/card.tsx',
  'components/ui/stat-card.tsx',
  'components/ui/totals-bar.tsx',
  // o topo (FRENTE C)
  'components/layout/top-bar.tsx',
  'components/layout/botao-tema.tsx',
  'components/layout/user-menu.tsx',
  'components/layout/workspace-switcher-dual.tsx',
  'components/layout/dashboard-shell.tsx',
  // o trilho (FRENTE B) — o visual dele
  'components/sidebar/global-sidebar.tsx',
  'components/sidebar/sidebar-item.tsx',
  'components/sidebar/botao-recolher.tsx',
]

/**
 * ⭐⭐ AS ROTAS QUE CADA PEÇA DE ROUPA PODE CHAMAR — lista FECHADA, com o motivo de cada uma.
 * Arquivo que não está aqui não pode ter `fetch` nenhum (a asserção acima).
 */
const ROTAS_PERMITIDAS: Record<string, string[]> = {
  // ⭐ a preferência de TELA — as duas irmãs, uma por botão
  'components/layout/botao-tema.tsx': ['/api/tema'],
  'components/sidebar/botao-recolher.tsx': ['/api/trilho'],
  // ⚠️ SESSÃO e ferramenta de dev — nasceram antes; não é dado de negócio
  'components/layout/user-menu.tsx': [
    '/api/auth/logout',
    '/api/dev/expire-trial',
    '/api/dev/restore-trial',
  ],
  // ⚠️ o ÚNICO que lê dado de negócio: o badge de retiradas pendentes, de antes deste sprint
  'components/sidebar/global-sidebar.tsx': ['/api/empresas/'],
}

/** ⭐ A PORTA — os três arquivos que PODEM escrever, e só a preferência. */
const A_PORTA = {
  regua: 'lib/trilho/preferencia.ts',
  servidor: 'lib/tema/servidor.ts',
  rota: 'app/api/trilho/route.ts',
}

describe('⛔⛔ REDE 1 — quem é ROUPA não fala com o banco nem busca dado de negócio', () => {
  for (const arq of ROUPA) {
    it(`⛔ ${arq} não ganhou lógica`, () => {
      const src = semComentarios(ler(arq))

      expect(src, `${arq}: roupa não fala com o banco`).not.toMatch(/\bprisma\b/)
      expect(src, `${arq}: roupa não importa a porta de escrita`).not.toMatch(
        /lib\/tema\/servidor/,
      )
    })
  }

  /**
   * ⛔⛔ **OS PRIMITIVOS E O TOPO NÃO BUSCAM NADA.** Medido: card, stat-card, totals-bar,
   * `top-bar`, o `sidebar-item`, o seletor de empresa e o shell têm **ZERO** `fetch` hoje. É
   * aqui que a régua tem que morder: no dia em que um `<Card>` passar a buscar dado, ele deixa
   * de ser primitivo e a fundação deixa de ser roupa.
   */
  it('⛔⛔ nenhum primitivo nem o topo passou a buscar dado', () => {
    const SEM_FETCH = ROUPA.filter((a) => !(a in ROTAS_PERMITIDAS))
    for (const arq of SEM_FETCH) {
      const src = semComentarios(ler(arq))
      expect(usosDe(src, 'fetch'), `${arq}: roupa não busca dado`).toBe(0)
    }
  })

  /**
   * ⭐⭐ **E QUEM BUSCA TEM A LISTA FECHADA — isto é MAIS FORTE que "zero fetch".** Três dos
   * arquivos de roupa já falavam com rota antes do sprint, cada um por um motivo escrito
   * abaixo; proibir o `fetch` neles seria afrouxar pra zero. Com a lista, **rota nova aparece
   * como vermelho** — inclusive uma rota de dinheiro no botão do tema.
   *
   * ⚠️ O `global-sidebar` é o único que lê dado de NEGÓCIO (o badge de retiradas, de antes
   * deste sprint). Ele fica nomeado em vez de escondido: *exclusão silenciosa é pior que
   * exclusão nenhuma.*
   */
  it('⛔⛔ quem fala com rota só fala com a sua — lista fechada', () => {
    for (const [arq, esperadas] of Object.entries(ROTAS_PERMITIDAS)) {
      const src = semComentarios(ler(arq))
      const rotas = [...new Set([...src.matchAll(/['"`](\/api\/[^'"`${]*)/g)].map((m) => m[1]))]
      expect(rotas.length, `${arq}: devia falar com alguma rota`).toBeGreaterThan(0)
      expect(rotas.sort(), `${arq}: rota NOVA na roupa`).toEqual([...esperadas].sort())
    }
  })
})

describe('⛔⛔⛔ REDE 2 — a ESCRITA do sprint é UMA SÓ', () => {
  const VERBOS = /\.(create|createMany|update|updateMany|upsert|delete|deleteMany)\s*\(/

  /**
   * ⭐ Varredura do app inteiro: quem escreve na tabela da preferência. **Um arquivo.** Uma 2ª
   * porta faria tema e trilho divergirem no primeiro campo novo (é o motivo escrito no
   * `lib/tema/servidor.ts` desde 04/10).
   */
  it('⛔⛔ exatamente UM arquivo escreve a preferência de tela', () => {
    const escritores: string[] = []
    for (const arq of varrerFontes(['app', 'lib', 'components'])) {
      const src = semComentarios(readFileSync(arq, 'utf8'))
      if (!src.includes('userTemaPreferencia')) continue
      if (VERBOS.test(src)) escritores.push(arq.replace(`${RAIZ}/`, ''))
    }
    expect(escritores, 'a porta da preferência tem um dono só').toEqual([A_PORTA.servidor])
  })

  /** ⭐ E a rota é CASCA — quem conhece o Prisma é a porta, nunca o handler. */
  it('⭐ a rota do trilho é casca sobre a porta', () => {
    const src = semComentarios(ler(A_PORTA.rota))
    expect(src, 'a rota não toca o Prisma').not.toMatch(/\bprisma\b/)
    expect(src, 'a rota delega pra porta').toMatch(/lib\/tema\/servidor/)
  })

  /**
   * ⛔⛔ **E A RÉGUA NÃO ESCREVE NADA** — ela normaliza. Régua que grava viraria a 2ª porta
   * por dentro, sem precisar tocar na tabela com o nome do model.
   */
  it('⛔ a régua do trilho é PURA', () => {
    const src = semComentarios(ler(A_PORTA.regua))
    expect(src, 'a régua não conhece o banco').not.toMatch(/\bprisma\b/)
    expect(VERBOS.test(src), 'a régua não grava').toBe(false)
  })
})

describe('⛔⛔ REDE 3 — a MIGRATION do sprint só acrescenta a coluna da preferência', () => {
  const DIR = 'prisma/migrations/20261014140000_user_trilho_preferencia'
  const sql = () => ler(`${DIR}/migration.sql`)

  /** ⚠️ Lê só os comandos — o cabeçalho do arquivo explica a decisão e cita outras tabelas. */
  const comandos = () =>
    sql()
      .split('\n')
      .filter((l) => !l.trim().startsWith('--'))
      .join('\n')

  it('⭐ ela mexe numa tabela só, e é a da preferência', () => {
    const tabelas = [...comandos().matchAll(/ALTER TABLE\s+"([^"]+)"/gi)].map((m) => m[1])
    expect([...new Set(tabelas)], 'uma tabela, a do tema').toEqual(['user_tema_preferencia'])
  })

  /**
   * ⛔⛔ **NENHUMA TABELA DE DINHEIRO NEM DE ESTOQUE É CITADA.** É o que separa "roupa" de
   * "mexeu na conta": a fundação não encosta em `transactions`, `loans`, `stock_*` nem nas
   * tabelas de cartão/venda. Lista fechada das que doem.
   */
  it('⛔⛔ não encosta em NENHUMA tabela de dinheiro ou de estoque', () => {
    const cmd = comandos().toLowerCase()
    const PROIBIDAS = [
      'transactions',
      'bank_accounts',
      'categories',
      'loans',
      'loan_installments',
      'credit_card',
      'business_credit_card',
      'accounts_payable',
      'suppliers',
      'venda',
      'stock_',
      'custo_fixo',
      'subscriptions',
    ]
    const tocadas = PROIBIDAS.filter((t) => cmd.includes(t))
    expect(tocadas, 'a fundação não mexe em conta').toEqual([])
  })

  /** ⭐ E é ADITIVA: nada é apagado nem renomeado. */
  it('⛔ é aditiva pura — zero DROP, zero RENAME, zero UPDATE de dado', () => {
    const cmd = comandos().toUpperCase()
    expect(/\bDROP\s+(TABLE|COLUMN)\b/.test(cmd), 'nada é apagado').toBe(false)
    expect(/\bRENAME\b/.test(cmd), 'nada é renomeado').toBe(false)
    expect(/\bUPDATE\b/.test(cmd), 'nenhum dado é reescrito').toBe(false)
    expect(/\bDELETE\b/.test(cmd), 'nenhuma linha é apagada').toBe(false)
  })

  /**
   * ⭐⭐ **E ELA É A ÚNICA MIGRATION DO SPRINT.** Duas migrations numa fundação de UI seria o
   * sinal de que alguma coisa além da preferência foi gravada.
   */
  it('⭐ o sprint trouxe UMA migration', () => {
    const dias = readdirSync(join(RAIZ, 'prisma/migrations')).filter((d) =>
      d.startsWith('20261014'),
    )
    expect(dias, 'uma migration no dia da fundação').toEqual([
      '20261014140000_user_trilho_preferencia',
    ])
  })
})

/** varre `.ts`/`.tsx` das raízes dadas, pulando testes e fixtures */
function varrerFontes(raizes: string[]): string[] {
  const achados: string[] = []
  const anda = (dir: string) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name)
      if (e.isDirectory()) {
        if (e.name === 'node_modules' || e.name === '__tests__' || e.name.startsWith('.')) continue
        anda(p)
      } else if (/\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name)) {
        achados.push(p)
      }
    }
  }
  for (const r of raizes) anda(join(RAIZ, r))
  return achados
}
