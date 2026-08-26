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

import { existsSync, lstatSync, readlinkSync, readdirSync, statSync } from 'fs'
import { join } from 'path'

export interface CheckDeploy {
  invariante: 'D1' | 'D2' | 'D3'
  nivel: 'erro' | 'aviso'
  detalhe: string
}

export interface LeituraDeploy {
  ehSymlink: boolean
  alvo: string | null
  buildIdOk: boolean
  cssCount: number
  buildsGuardados: number
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

  return { ehSymlink, alvo, buildIdOk, cssCount, buildsGuardados }
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

  return out
}

/** Atalho pro cron: lê + avalia. */
export function checkDeploy(appDir?: string): { leitura: LeituraDeploy | null; checks: CheckDeploy[] } {
  const leitura = lerDeploy(appDir)
  return { leitura, checks: leitura ? avaliarDeploy(leitura) : [] }
}
