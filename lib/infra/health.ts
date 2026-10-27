// INFRA — invariantes de máquina (25/08). "Infra também merece invariante" (decisão do dono).
//
// Nasceu do episódio de 24-25/08: o `next build` foi morto pelo OOM killer três vezes, o
// `.next` ficou sem BUILD_ID e o pm2 entrou em loop — e NADA no sistema avisou. O juiz
// noturno olhava dinheiro e estoque; a máquina embaixo deles era ponto cego.
//
// ⚠️ O QUE ESTE CHECK SIGNIFICA: ele roda às 3h, quando NÃO há build. Swap em uso nesse
// momento não é o build respirando — é a operação normal já não cabendo na RAM. É
// exatamente o gatilho (b) do upgrade 4→8 GB registrado no CLAUDE.md.

import { readFileSync, statfsSync } from 'fs'

export interface LeituraInfra {
  memTotalMb: number
  memDisponivelMb: number
  swapTotalMb: number
  swapUsadoMb: number
  /**
   * ⚠️ `null` = NÃO MEDIDO, nunca "disco vazio" — a mesma régua do "sem contagem" do
   * estoque. Sem leitura o N4 se cala em vez de afirmar 0%.
   */
  discoUsadoPct: number | null
  discoUsadoGb: number | null
  discoTotalGb: number | null
}

export interface CheckInfra {
  invariante: 'N1' | 'N2' | 'N3' | 'N4'
  nivel: 'erro' | 'aviso'
  detalhe: string
}

/** Swap em uso acima disso, FORA de build, é pressão real de memória (gatilho do upgrade). */
export const N1_SWAP_MB = 256
/** Memória disponível abaixo desta fração do total = aperto. */
export const N2_DISPONIVEL_PCT = 0.15
/** Sem swap nenhum a máquina não tem folga pro build (foi o que derrubou prod em 24/08). */
export const N3_SWAP_MINIMO_MB = 1024
/**
 * Disco acima disso = alarme (FASE 0 PASSO 4, pedido do dono: "alarme de disco >80%").
 *
 * ⚠️ O gate do `deploy.sh` exige ≥ 2000 MB livres pra buildar; num disco de 116 GB, 80%
 * usado ainda deixa ~23 GB, então o alarme chega MUITO antes de o deploy travar. É o
 * desenho certo: avisar enquanto dá pra agir, não quando o build já morreu.
 *
 * ⭐ MEDIDO EM 26/10, depois da faxina: 11 de 116 GB = 9% usado. O alarme não dispara
 * hoje — ele existe pro dia em que o journal (ou um build órfão) crescer de novo.
 */
export const N4_DISCO_USADO_PCT = 80

const mb = (kb: number) => Math.round(kb / 1024)

/**
 * Lê o disco do caminho dado, pela MESMA aritmética do `df`: usado = total − livre, e o
 * denominador é `usado + disponível-pra-não-root` (NÃO o total), senão a conta discorda
 * do número que o dono lê no terminal.
 *
 * ⚠️ Em QUALQUER falha devolve nulos e segue — leitura de disco não pode derrubar o N1/N2/N3,
 * que são a razão de este arquivo existir.
 */
function lerDisco(caminho: string): Pick<LeituraInfra, 'discoUsadoPct' | 'discoUsadoGb' | 'discoTotalGb'> {
  const vazio = { discoUsadoPct: null, discoUsadoGb: null, discoTotalGb: null }
  try {
    const s = statfsSync(caminho)
    const bsize = Number(s.bsize)
    const blocks = Number(s.blocks)
    const bfree = Number(s.bfree)
    const bavail = Number(s.bavail)
    if (!bsize || !blocks) return vazio
    const usado = blocks - bfree
    const base = usado + bavail
    if (base <= 0) return vazio
    const gb = (b: number) => Math.round((b * bsize) / 1024 ** 3)
    return {
      discoUsadoPct: Math.round((usado / base) * 100),
      discoUsadoGb: gb(usado),
      discoTotalGb: gb(blocks),
    }
  } catch {
    return vazio
  }
}

/** Lê o /proc/meminfo (Linux). Em outro SO devolve null — o caller simplesmente pula. */
export function lerInfra(caminho = '/proc/meminfo', caminhoDisco = '/'): LeituraInfra | null {
  let txt: string
  try {
    txt = readFileSync(caminho, 'utf-8')
  } catch {
    return null // macOS/dev — sem /proc, não há o que checar
  }
  const campo = (nome: string): number | null => {
    const m = txt.match(new RegExp(`^${nome}:\\s+(\\d+) kB`, 'm'))
    return m ? Number(m[1]) : null
  }
  const memTotal = campo('MemTotal')
  const memDisp = campo('MemAvailable')
  const swapTotal = campo('SwapTotal')
  const swapFree = campo('SwapFree')
  if (memTotal == null || memDisp == null || swapTotal == null || swapFree == null) return null
  return {
    memTotalMb: mb(memTotal),
    memDisponivelMb: mb(memDisp),
    swapTotalMb: mb(swapTotal),
    swapUsadoMb: mb(swapTotal - swapFree),
    ...lerDisco(caminhoDisco),
  }
}

/**
 * PURA — a decisão, testável sem máquina. Devolve só o que está FORA do esperado;
 * lista vazia = máquina saudável.
 */
export function avaliarInfra(l: LeituraInfra): CheckInfra[] {
  const out: CheckInfra[] = []

  // N3 primeiro: sem swap, o build morre por OOM e derruba o site (aconteceu).
  if (l.swapTotalMb < N3_SWAP_MINIMO_MB) {
    out.push({
      invariante: 'N3', nivel: 'erro',
      detalhe: `servidor com ${l.swapTotalMb} MB de swap (mínimo ${N3_SWAP_MINIMO_MB} MB). Sem folga, o type-check do build é morto pelo OOM killer e o .next fica sem BUILD_ID — o site cai no próximo restart.`,
    })
  } else if (l.swapUsadoMb > N1_SWAP_MB) {
    // N1 só faz sentido quando HÁ swap; senão o N3 já disse o que importa.
    out.push({
      invariante: 'N1', nivel: 'erro',
      detalhe: `${l.swapUsadoMb} MB de swap em uso às 3h da manhã, FORA de build — a operação normal já não cabe na RAM (${l.memTotalMb} MB). É o gatilho (b) do upgrade 4→8 GB combinado em 25/08.`,
    })
  }

  const pct = l.memTotalMb > 0 ? l.memDisponivelMb / l.memTotalMb : 1
  if (pct < N2_DISPONIVEL_PCT) {
    out.push({
      invariante: 'N2', nivel: 'aviso',
      detalhe: `só ${l.memDisponivelMb} MB disponíveis de ${l.memTotalMb} MB (${Math.round(pct * 100)}%) — abaixo de ${Math.round(N2_DISPONIVEL_PCT * 100)}%. O próximo build pode não caber.`,
    })
  }

  // N4 — disco. ⛔ Só opina quando MEDIU: `null` é "não sei", nunca 0%.
  if (l.discoUsadoPct != null && l.discoUsadoPct > N4_DISCO_USADO_PCT) {
    out.push({
      invariante: 'N4', nivel: 'erro',
      detalhe: `disco em ${l.discoUsadoPct}% usado (${l.discoUsadoGb} de ${l.discoTotalGb} GB) — acima de ${N4_DISCO_USADO_PCT}%. O gate do deploy exige 2 GB livres; sem espaço o build morre pela metade. Começar pela faxina: \`journalctl --vacuum-size=200M\` (em 26/10 isso liberou 3,8 GB) e \`bash /opt/conta-ia/scripts/faxina-builds.sh\`. Se depois disso seguir apertado, é o resize do droplet — e o clique é do dono.`,
    })
  }

  return out
}

/** Atalho pro cron: lê + avalia. Fora do Linux devolve lista vazia (nada a checar). */
export function checkInfra(
  caminho?: string,
  caminhoDisco?: string,
): { leitura: LeituraInfra | null; checks: CheckInfra[] } {
  const leitura = lerInfra(caminho, caminhoDisco)
  return { leitura, checks: leitura ? avaliarInfra(leitura) : [] }
}
