// ⭐⭐ AO VIVO — o motor da tela (leis R1–R8 de docs/producao-ao-vivo-referencia.html, 13/11/2026).
//
// R2: responde DUAS perguntas, nesta ordem — quem tá na mão agora (e quanto tá demorando)? · o que
// acabou de acontecer? Nenhum KPI do Painel, nenhum pódio.
// R3: o tempo de cada etapa se compara com a mediana da MESMA etapa (≥ 5 medições ≥ 30s); âmbar só
//     acima de 1,5×; a barra trava em 100%. R4: < 30s é "tempo não mediu", fora de mediana e barra.
// R5/R6 VETADAS pelo dono (13/11): nada de validade nem previsão de demanda aqui.
// R7: concluídas de hoje = linhas visuais + PULSO (conclusão índigo, conferência verde). ⚠️ RECUSAS:
//     o sistema NÃO registra recusa (a frase do servidor volta pro tablet e nada é gravado) — ficam
//     FORA até existir registro; nenhuma tabela nova foi criada pra isso (ordem do sprint).
// ⭐ O relógio é do SERVIDOR, em fuso de Brasília; "hoje" é o dia de Brasília. LEVE: só etapas
//    em andamento + finalizadas no dia; medianas só das chaves na tela.

import type { PrismaClient } from '@prisma/client'
import { prisma as defaultPrisma } from '@/lib/db'
import { diaEmSaoPaulo, janelaDoDiaSP, horaEmSaoPaulo } from '@/lib/datas/dia-sao-paulo'
import { lerEtapas, medianasDasChaves, nomesDasContas, type EtapaLida } from './tempos-das-etapas'
import { carimbosDoDia, carimbosDasConclusoes } from './conferencia'
import { conclusoesVigentes } from './conclusoes-vigentes'
import { corDoTempo, pctDaBarra, tempoDeMentira, posPulso } from './leis-r'

export interface LinhaNaMao {
  etapaId: string
  /** a ordem (tarefa → o id da tarefa): a linha abre a ordem, onde moram os gestos do gerente */
  ordemId: string
  ehTarefa: boolean
  quem: string
  oQue: string
  /** "Michele · PREPARO · com Nadine" */
  sub: string
  comecou: string
  seg: number
  medSeg: number | null
  cor: 'neutro' | 'ambar'
  pct: number | null
}

export type EventoDoDia =
  | { tipo: 'lote' | 'tarefa'; id: string; hhmm: string; quem: string; oQue: string; sub: string; seg: number | null; medSeg: number | null; cor: 'neutro' | 'ambar'; pct: number | null; mentira: boolean; aguardaConferencia: boolean; semTempo: boolean }
  | { tipo: 'conferiu'; id: string; hhmm: string; quem: string; oQue: string }

export interface AoVivo {
  agora: string
  dia: string
  naMao: LinhaNaMao[]
  /** do mais novo pro mais antigo */
  eventos: EventoDoDia[]
  concluidas: number
  pulso: { marcas: { rot: string; pos: number }[]; pontos: { tipo: 'lote' | 'tarefa' | 'conferiu'; pos: number }[] }
  /** ⚠️ R7: recusas ficam fora — o sistema não as registra */
  recusasRegistradas: false
}

const minutosDoDia = (d: Date) => { const [h, m] = horaEmSaoPaulo(d).split(':').map(Number); return h * 60 + m }

function quemDa(e: EtapaLida, nome: Map<string, string>) { return e.quemId ? nome.get(e.quemId) ?? '—' : 'equipe' }
function subDa(e: EtapaLida, quem: string) {
  return [quem, e.ehTarefa ? null : e.etapaNome, e.comQuem.length ? `com ${e.comQuem.join(' e ')}` : null].filter(Boolean).join(' · ')
}

/** o eixo do pulso: da hora cheia da 1ª à hora cheia depois da última (mínimo 1h), marcas a cada N horas */
export function eixoDoPulso(minutos: readonly number[]): { ini: number; fim: number; marcas: { rot: string; pos: number }[] } {
  if (!minutos.length) return { ini: 0, fim: 60, marcas: [] }
  const ini = Math.floor(Math.min(...minutos) / 60) * 60
  const fim = Math.max(ini + 60, Math.ceil((Math.max(...minutos) + 1) / 60) * 60)
  const horas = (fim - ini) / 60
  const passo = Math.max(1, Math.ceil(horas / 6))
  const marcas: { rot: string; pos: number }[] = []
  for (let h = ini; h <= fim; h += passo * 60) marcas.push({ rot: `${String(Math.floor(h / 60) % 24).padStart(2, '0')}h`, pos: ((h - ini) / (fim - ini)) * 100 })
  return { ini, fim, marcas }
}

export async function aoVivo(companyId: string, agora: Date = new Date(), db: PrismaClient = defaultPrisma): Promise<AoVivo> {
  const dia = diaEmSaoPaulo(agora)
  const janela = janelaDoDiaSP(dia)
  const [emCurso, feitasHoje, carimbos] = await Promise.all([
    lerEtapas(companyId, { emAndamento: true }, db).then((es) => es.filter((e) => e.estado === 'EM_ANDAMENTO')),
    lerEtapas(companyId, { finalizadasEntre: janela }, db).then((es) => es.filter((e) => e.estado === 'FEITA' || e.estado === 'FINALIZADA_PELO_GERENTE')),
    carimbosDoDia(companyId, janela, db),
  ])
  const chaves = [...new Set([...emCurso, ...feitasHoje].map((e) => e.chave))]
  const ids = [...new Set([...emCurso, ...feitasHoje].map((e) => e.quemId).filter((x): x is string => !!x))]
  const ordensDoDia = [...new Set(feitasHoje.filter((e) => !e.ehTarefa).map((e) => e.ordemId))]
  const [med, nome, conclusoes] = await Promise.all([
    medianasDasChaves(companyId, chaves, db),
    nomesDasContas(companyId, ids, db),
    ordensDoDia.length ? conclusoesVigentes(companyId, { ordemIds: ordensDoDia }, db) : Promise.resolve([]),
  ])
  const carimboDe = await carimbosDasConclusoes(companyId, conclusoes.map((c) => c.id), db)
  const aguardando = new Set(conclusoes.filter((c) => carimboDe.get(c.id)?.estado === 'AGUARDANDO_CONFERENCIA').map((c) => c.ordemId))

  const naMao: LinhaNaMao[] = emCurso
    .sort((a, b) => a.iniciadoEm!.getTime() - b.iniciadoEm!.getTime())
    .map((e) => {
      const quem = quemDa(e, nome)
      const seg = Math.max(0, (agora.getTime() - e.iniciadoEm!.getTime()) / 1000)
      const medSeg = med.get(e.chave) ?? null
      return {
        etapaId: e.etapaId, ordemId: e.ordemId, ehTarefa: e.ehTarefa, quem, oQue: e.oQue, sub: subDa(e, quem),
        comecou: horaEmSaoPaulo(e.iniciadoEm!), seg, medSeg, cor: corDoTempo(seg, medSeg), pct: pctDaBarra(seg, medSeg),
      }
    })

  // ⭐ a ÚLTIMA etapa feita de cada ordem é a que leva o chip "aguarda conferência"
  const ultimaDaOrdem = new Map<string, string>()
  for (const e of feitasHoje) {
    if (e.ehTarefa) continue
    const atual = feitasHoje.find((x) => x.etapaId === ultimaDaOrdem.get(e.ordemId))
    if (!atual || e.finalizadoEm! > atual.finalizadoEm!) ultimaDaOrdem.set(e.ordemId, e.etapaId)
  }

  const comHora: { quando: Date; ev: EventoDoDia }[] = []
  for (const e of feitasHoje) {
    const quem = quemDa(e, nome)
    const medSeg = med.get(e.chave) ?? null
    const semTempo = e.seg == null
    const mentira = e.seg != null && tempoDeMentira(e.seg)
    const valeTempo = e.seg != null && !mentira
    comHora.push({
      quando: e.finalizadoEm!,
      ev: {
        tipo: e.ehTarefa ? 'tarefa' : 'lote', id: e.etapaId, hhmm: horaEmSaoPaulo(e.finalizadoEm!), quem, oQue: e.oQue, sub: subDa(e, quem),
        seg: e.seg, medSeg, mentira, semTempo,
        cor: valeTempo ? corDoTempo(e.seg!, medSeg) : 'neutro',
        pct: valeTempo ? pctDaBarra(e.seg!, medSeg) : null,
        aguardaConferencia: !e.ehTarefa && aguardando.has(e.ordemId) && ultimaDaOrdem.get(e.ordemId) === e.etapaId,
      },
    })
  }
  for (const c of carimbos) comHora.push({ quando: c.quando, ev: { tipo: 'conferiu', id: c.id, hhmm: horaEmSaoPaulo(c.quando), quem: c.quem, oQue: c.produto } })
  comHora.sort((a, b) => b.quando.getTime() - a.quando.getTime())

  const eixo = eixoDoPulso(comHora.map((x) => minutosDoDia(x.quando)))
  return {
    agora: agora.toISOString(), dia, naMao,
    eventos: comHora.map((x) => x.ev),
    concluidas: feitasHoje.length,
    pulso: {
      marcas: eixo.marcas,
      pontos: comHora.map((x) => ({ tipo: x.ev.tipo, pos: posPulso(horaEmSaoPaulo(x.quando), eixo.ini, eixo.fim) })),
    },
    recusasRegistradas: false,
  }
}
