// ⭐⭐⭐ R1/R2 — A LENTIDÃO PASSA A FICAR GRAVADA E VIGIADA (28/09/2026)
//
// **O dono, no check-up:** *"a lentidão passa a ficar GRAVADA e vigiada; nunca mais check-up
// às cegas."*
//
// ⛔⛔ **O BURACO QUE ISTO FECHA:** o log do nginx usava o formato `combined` padrão, **sem
// `$request_time`** — ou seja, *"as páginas às vezes demoram"* **não estava registrado em lugar
// nenhum**. Pra medir o check-up de hoje eu tive que **simular** requisições, e simulação mede
// o que eu escolho medir, na hora em que eu escolho. ***O que o dono sentiu no dedo não tinha
// onde ser conferido.***
//
// ⚠️ E isso importa mais do que parece: na medição de hoje apareceram **outliers de ~40 s** que
// só acontecem com requisições em **paralelo** (0 em 25 sequenciais) — e o servidor **não** tem
// rate limit, fail2ban nem falta de conexão. Sem o tempo no log, um evento desses é invisível:
// ele acontece, o dono espera, e no dia seguinte não há uma linha que prove que aconteceu.
//
// ⭐ **O motor é PURO** (recebe as linhas, devolve o veredito) — quem lê arquivo é o `checkRotas`
// lá embaixo. É o que permite testar contra linhas reais sem servidor.

/** uma linha do access.log já interpretada */
export interface Acesso {
  rota: string
  status: number
  /** segundos que o cliente esperou — o `$request_time` do nginx */
  tempo: number
}

export interface CheckRotas {
  invariante: 'R1' | 'R2'
  nivel: 'erro' | 'aviso'
  detalhe: string
}

/**
 * ⭐ O teto do R1, em segundos. **2 s é o limiar que o dono pediu** — e ele é generoso de
 * propósito: a medição de hoje mostrou as rotas entre 48 ms e 760 ms, então 2 s só acende
 * quando algo saiu da curva de verdade. *Alarme que dispara no dia normal é alarme que se
 * aprende a ignorar* (os 111 falsos do juiz de vendas).
 */
export const R1_P95_SEGUNDOS = 2

/** ⚠️ abaixo disso o p95 é estatística de nada — 3 chamadas não fazem percentil */
export const R1_MINIMO_DE_CHAMADAS = 20

/** ⭐ o teto do R2: acima de 5% de 4xx a rota está sendo chamada por quem não pode */
export const R2_PCT_4XX = 0.05
export const R2_MINIMO_DE_CHAMADAS = 50

/**
 * ⚠️ **A ROTA É NORMALIZADA, senão cada id vira uma "rota" própria** e nenhum percentil junta
 * chamadas suficientes pra significar algo. `/empresas/cmq17.../estoque/radar` e
 * `/empresas/cmu8.../estoque/radar` são **a mesma tela**.
 */
export function normalizarRota(caminho: string): string {
  return caminho
    .split('?')[0]
    // cuid (c + 24 alfanuméricos) e uuid viram <id>
    .replace(/\/c[a-z0-9]{24,}/g, '/<id>')
    .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '/<id>')
    // números longos (nº de nota, chave de NF-e) também
    .replace(/\/\d{6,}/g, '/<n>')
}

/**
 * ⭐ Lê uma linha do access.log no formato **combined + `rt=<segundos>`**.
 *
 * ⚠️ **Linha sem `rt=` é IGNORADA, nunca contada como zero.** Log antigo (anterior ao formato
 * novo) e log de outro vhost convivem no mesmo arquivo; tratá-los como 0 s faria o p95
 * despencar e o guard dar verde por diluição — *o silêncio virando "está tudo bem"*, que é a
 * doença que este projeto mais combate.
 */
export function lerLinha(linha: string): Acesso | null {
  const rt = / rt=([0-9.]+)/.exec(linha)
  if (!rt) return null
  const req = /"(?:GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS) ([^ "]+)[^"]*" (\d{3})/.exec(linha)
  if (!req) return null
  const tempo = Number(rt[1])
  if (!Number.isFinite(tempo)) return null
  return { rota: normalizarRota(req[1]), status: Number(req[2]), tempo }
}

/** ⚠️ percentil por posição (nearest-rank): com N pequeno é o único honesto */
export function p95(valores: number[]): number {
  if (valores.length === 0) return 0
  const ord = [...valores].sort((a, b) => a - b)
  const i = Math.min(ord.length - 1, Math.ceil(0.95 * ord.length) - 1)
  return ord[Math.max(0, i)]
}

export interface ResumoDaRota {
  rota: string
  chamadas: number
  p95: number
  pior: number
  pct4xx: number
}

/** ⭐ agrupa por rota normalizada — a base dos dois invariantes */
export function resumirPorRota(acessos: Acesso[]): ResumoDaRota[] {
  const m = new Map<string, { tempos: number[]; n4xx: number }>()
  for (const a of acessos) {
    const g = m.get(a.rota) ?? { tempos: [], n4xx: 0 }
    g.tempos.push(a.tempo)
    if (a.status >= 400 && a.status < 500) g.n4xx++
    m.set(a.rota, g)
  }
  return [...m.entries()]
    .map(([rota, g]) => ({
      rota,
      chamadas: g.tempos.length,
      p95: Math.round(p95(g.tempos) * 1000) / 1000,
      pior: Math.round(Math.max(...g.tempos) * 1000) / 1000,
      pct4xx: g.tempos.length ? g.n4xx / g.tempos.length : 0,
    }))
    .sort((a, b) => b.p95 - a.p95)
}

/**
 * ⭐⭐ **R1 (erro):** rota com p95 acima do teto. **R2 (aviso):** rota com mais de 5% de 4xx.
 *
 * ⚠️ **O R2 é AVISO, não erro, de propósito:** 4xx pode ser o sistema funcionando (a trava de
 * permissão recusando quem não pode é *o desenho*). O que ele diz é *"alguém está batendo numa
 * porta que não abre, repetidamente"* — e foi exatamente isso que o check-up de hoje achou
 * (1.391 chamadas/dia ao badge levando 403 da máquina do estoque). **Erro faria o e-mail ficar
 * vermelho por um comportamento correto**, e aí o dono para de ler.
 */
export function avaliarRotas(acessos: Acesso[]): CheckRotas[] {
  const out: CheckRotas[] = []
  const resumo = resumirPorRota(acessos)

  for (const r of resumo) {
    if (r.chamadas >= R1_MINIMO_DE_CHAMADAS && r.p95 > R1_P95_SEGUNDOS) {
      out.push({
        invariante: 'R1',
        nivel: 'erro',
        detalhe: `${r.rota}: p95 de ${r.p95.toFixed(1)}s em ${r.chamadas} chamadas (pior: ${r.pior.toFixed(1)}s). O teto é ${R1_P95_SEGUNDOS}s — 1 em cada 20 acessos a essa tela demorou isso.`,
      })
    }
  }
  for (const r of resumo) {
    if (r.chamadas >= R2_MINIMO_DE_CHAMADAS && r.pct4xx > R2_PCT_4XX) {
      out.push({
        invariante: 'R2',
        nivel: 'aviso',
        detalhe: `${r.rota}: ${Math.round(r.pct4xx * 100)}% das ${r.chamadas} chamadas voltaram 4xx. Ou alguém sem permissão está chamando em laço, ou a tela pede uma rota que não existe mais.`,
      })
    }
  }
  return out
}

/**
 * ⭐ Lê o access.log e avalia. Fail-soft por desenho: **log ausente ou ilegível não derruba o
 * juiz** — ele só não tem o que dizer sobre rota. ⚠️ E devolve `linhasComTempo: 0` quando o
 * formato novo ainda não está no ar, pra o relatório dizer *"não tenho dado"* em vez de
 * *"está tudo bem"*.
 */
export function checkRotas(
  caminho = '/var/log/nginx/access.log',
  lerArquivo?: (p: string) => string,
): { checks: CheckRotas[]; linhasComTempo: number; topLentas: ResumoDaRota[] } {
  let conteudo = ''
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = lerArquivo ? null : (require('node:fs') as typeof import('node:fs'))
    conteudo = lerArquivo ? lerArquivo(caminho) : fs!.readFileSync(caminho, 'utf-8')
  } catch {
    return { checks: [], linhasComTempo: 0, topLentas: [] }
  }
  const acessos: Acesso[] = []
  for (const l of conteudo.split('\n')) {
    const a = lerLinha(l)
    if (a) acessos.push(a)
  }
  return {
    checks: avaliarRotas(acessos),
    linhasComTempo: acessos.length,
    topLentas: resumirPorRota(acessos).slice(0, 5),
  }
}
