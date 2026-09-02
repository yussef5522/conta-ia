// INFRA — o DEPLOY também merece invariante (26/08).
//
// Nasceu do 3º incidente de deploy: o build escreveu por cima do `.next` que o pm2
// servia e, durante a troca, a página saiu sem CSS (404 às 16:35:00, 200 às 16:36:56).
// O desenho novo (`scripts/deploy.sh`) faz o build num diretório à parte e troca um
// SYMLINK atômico — mas desenho bom sem vigia volta a apodrecer.
//
// ⚠️ O QUE ISTO PEGA que o smoke não pega: o smoke olha se o site responde AGORA. Este
// invariante olha se a ESTRUTURA está sã — `.next` é symlink? aponta pra um build que
// existe? esse build tem BUILD_ID e CSS? Um `.next` que virou diretório real de novo
// (alguém rodou `npm run build` na mão) responde 200 e mesmo assim jogou fora a rede
// de rollback. Isso o smoke nunca veria.

import { existsSync, lstatSync, readlinkSync, readdirSync, statSync, readFileSync } from 'fs'
import { join } from 'path'

export interface CheckDeploy {
  invariante: 'D1' | 'D2' | 'D3' | 'D4' | 'D5'
  nivel: 'erro' | 'aviso'
  detalhe: string
}

export interface LeituraDeploy {
  ehSymlink: boolean
  alvo: string | null
  buildIdOk: boolean
  cssCount: number
  buildsGuardados: number
  /** datasource do schema do repo (o que o app DEVERIA falar) */
  providerSchema: string | null
  /** datasource embutido no client GERADO em node_modules (o que ele REALMENTE fala) */
  providerClient: string | null
  /**
   * ⭐ D5 (02/09) — migrations do repo que o BANCO ainda não aplicou.
   * `undefined` = não deu pra medir (sem banco na mão); lista vazia = em dia.
   */
  migrationsPendentes?: string[]
}

/** Lê `datasource db { provider = "..." }` — o do DATASOURCE, não o do generator. */
export function extrairProviderDatasource(schema: string): string | null {
  const bloco = schema.match(/datasource\s+\w+\s*\{[\s\S]*?\}/)
  if (!bloco) return null
  const m = bloco[0].match(/provider\s*=\s*"([^"]+)"/)
  return m ? m[1] : null
}

/** Mínimo de builds guardados pra existir rollback de verdade. */
export const MIN_BUILDS_ROLLBACK = 2

/**
 * Lê o estado do deploy. Fora do servidor (dev, CI) devolve null — não há o que checar.
 */
export function lerDeploy(appDir = '/opt/conta-ia'): LeituraDeploy | null {
  const next = join(appDir, '.next')
  if (!existsSync(next)) return null

  let ehSymlink = false
  let alvo: string | null = null
  try {
    ehSymlink = lstatSync(next).isSymbolicLink()
    if (ehSymlink) alvo = readlinkSync(next)
  } catch {
    return null
  }

  const buildIdOk = existsSync(join(next, 'BUILD_ID'))
  let cssCount = 0
  try {
    const dir = join(next, 'static', 'chunks')
    if (existsSync(dir)) cssCount = readdirSync(dir).filter((f) => f.endsWith('.css')).length
  } catch { /* ignora */ }

  // ⚠️ os builds ficam com nome PLANO na raiz (`.next-build-<stamp>-<sha>`), não
  // aninhados: o Next gera os arquivos de tipo com caminho relativo de 3 níveis e
  // assume que o `distDir` tem profundidade 1. Aninhar quebrava o build.
  let buildsGuardados = 0
  try {
    buildsGuardados = readdirSync(appDir).filter((f) => {
      if (!f.startsWith('.next-build-')) return false
      try { return statSync(join(appDir, f)).isDirectory() } catch { return false }
    }).length
  } catch { /* ignora */ }

  // ⭐ D4 (28/08) — o provider do client GERADO vs o do schema do repo.
  // O `node_modules` é COMPARTILHADO com o workspace de build (hard link), então um
  // `prisma generate` rodado com o schema errado contamina o que o app carrega.
  const ler = (caminho: string): string | null => {
    try { return existsSync(caminho) ? extrairProviderDatasource(readFileSync(caminho, 'utf-8')) : null } catch { return null }
  }
  const providerSchema = ler(join(appDir, 'prisma', 'schema.prisma'))
  const providerClient = ler(join(appDir, 'node_modules', '.prisma', 'client', 'schema.prisma'))

  return { ehSymlink, alvo, buildIdOk, cssCount, buildsGuardados, providerSchema, providerClient }
}

/** PURA — a decisão, testável sem servidor. Lista vazia = deploy são. */
export function avaliarDeploy(l: LeituraDeploy): CheckDeploy[] {
  const out: CheckDeploy[] = []

  // D1 (erro) — o artefato servido tem que estar completo. É o estado que derrubou
  // prod em 24/08 (BUILD_ID ausente → pm2 em loop) e em 26/08 (CSS faltando).
  if (!l.buildIdOk) {
    out.push({
      invariante: 'D1', nivel: 'erro',
      detalhe: '`.next` sem BUILD_ID — o build está incompleto ou foi morto no meio. O pm2 entra em loop no próximo restart. Rollback: `bash scripts/rollback.sh`.',
    })
  } else if (l.cssCount === 0) {
    out.push({
      invariante: 'D1', nivel: 'erro',
      detalhe: '`.next` sem nenhum CSS — a página vai renderizar sem estilo (foi o incidente de 26/08). Rollback: `bash scripts/rollback.sh`.',
    })
  }

  // D2 (aviso) — sem symlink não há troca atômica NEM rollback rápido.
  if (!l.ehSymlink) {
    out.push({
      invariante: 'D2', nivel: 'aviso',
      detalhe: '`.next` é diretório real, não symlink — alguém buildou por cima do diretório vivo. Volta o risco de servir build parcial durante a troca. Use `bash scripts/deploy.sh`.',
    })
  }

  // D3 (aviso) — rollback só existe se houver pra onde voltar.
  if (l.ehSymlink && l.buildsGuardados < MIN_BUILDS_ROLLBACK) {
    out.push({
      invariante: 'D3', nivel: 'aviso',
      detalhe: `só ${l.buildsGuardados} build guardado — sem um anterior no disco, o rollback exigiria rebuild (minutos em vez de segundos).`,
    })
  }

  // ⭐⭐ D4 (erro) — O CLIENT DO PRISMA FALA O MESMO BANCO QUE O SCHEMA?
  //
  // ⚠️ O INCIDENTE QUE PEDIU ISTO (28/08, login 500 por 8 HORAS): um `prisma generate`
  // rodou com o schema revertido pra `sqlite` (o `git reset --hard` do deploy desfaz o
  // swap-postgres, que é passo MANUAL do runbook). Como o `node_modules` é compartilhado
  // por hard link com o workspace de build, o client gerado virou SQLite, o app subiu com
  // ele e todo acesso ao banco morria com *"the URL must start with the protocol file:"*.
  //
  // ⚠️⚠️ E O TRIO FICOU VERDE O TEMPO TODO: BUILD_ID ok, pm2 online sem loop, CSS
  // servindo. **O gate provava que o site era SERVIDO, nunca que ele FALAVA COM O
  // BANCO.** Home é estática e respondia 200 enquanto o login dava 500. Um gate que não
  // enxerga banco fora do ar não é gate de saúde — é gate de presença.
  if (l.providerSchema && l.providerClient && l.providerSchema !== l.providerClient) {
    out.push({
      invariante: 'D4', nivel: 'erro',
      detalhe: `o Prisma Client gerado fala "${l.providerClient}" mas o schema do repo é "${l.providerSchema}" — TODA query ao banco falha (login, tudo). Rode \`bash scripts/swap-prisma-to-postgres.sh && npx prisma generate\` e \`pm2 restart conta-ia\`. ⚠️ rollback NÃO resolve: o client é compartilhado por todos os builds.`,
    })
  }

  // ⛔⛔ D5 (erro) — MIGRATION PENDENTE É DEPLOY QUEBRADO COM GATE VERDE.
  //
  // Caso real (02/09): subiu código que lê `stock_venda_complemento_grupo` sem a tabela
  // existir. O trio deu **4/4 VERDE** — ele prova que o site é SERVIDO, não que o schema
  // do banco combina com o código. Mesma família do login 500 de 28/08.
  //
  // ⚠️ O detalhe NOMEIA a migration e o comando: alerta que não diz o que fazer vira ruído.
  if (l.migrationsPendentes && l.migrationsPendentes.length > 0) {
    out.push({
      invariante: 'D5', nivel: 'erro',
      detalhe: `${l.migrationsPendentes.length} migration(s) do repo NÃO aplicada(s) no banco: ${l.migrationsPendentes.join(', ')}. `
        + 'O código no ar pode estar lendo tabela/coluna que não existe. Rodar `npx prisma migrate deploy` em /opt/conta-ia. '
        + '⚠️ rollback de build NÃO resolve: o que falta é schema, não artefato.',
    })
  }

  return out
}

/**
 * Quais migrations do repo o banco ainda não aplicou.
 *
 * ⚠️ Lê `_prisma_migrations` (a tabela do próprio Prisma) em vez de rodar o CLI: o juiz roda
 * no cron, e disparar um processo que pode ESCREVER no banco a partir de um alerta noturno
 * seria trocar diagnóstico por cirurgia automática.
 */
export async function migrationsPendentes(
  db: { $queryRawUnsafe: (q: string) => Promise<unknown> },
  appDir = '/opt/conta-ia',
): Promise<string[] | undefined> {
  let noRepo: string[]
  try {
    noRepo = readdirSync(join(appDir, 'prisma', 'migrations'))
      .filter((f) => /^\d{14}_/.test(f))
      .sort()
  } catch { return undefined }
  try {
    const rows = (await db.$queryRawUnsafe(
      'SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NOT NULL',
    )) as { migration_name: string }[]
    const aplicadas = new Set(rows.map((r) => r.migration_name))
    return noRepo.filter((m) => !aplicadas.has(m))
  } catch { return undefined }
}

/** Atalho pro cron: lê + avalia. */
export function checkDeploy(appDir?: string): { leitura: LeituraDeploy | null; checks: CheckDeploy[] } {
  const leitura = lerDeploy(appDir)
  return { leitura, checks: leitura ? avaliarDeploy(leitura) : [] }
}
