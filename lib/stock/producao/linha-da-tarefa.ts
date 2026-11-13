// ⭐⭐ A LINHA DA TAREFA NO PAINEL DO ESCRITÓRIO (lei v9 M7.e, docs/producao-referencia.html).
//
// "TAREFA TEM LINHA PRÓPRIA nas listas do escritório: selo TAREFA + nome + instrução + quem +
// duração. NUNCA mostra R$/un, % do pedido, UN pedidas, nem entra na Conferência (tarefa não
// tem número a conferir) — o print do dono pegou tarefa concluída com 'R$ 0,00/un', isso morre."
//
// ⛔ O TIPO não tem campo de custo, pedido, percentual nem conferência: a tela que desenha a
// tarefa a partir daqui NÃO TEM o que pôr nessas colunas (REGRA 5 — impossível, não lembrado).
// PURA: `agora` é parâmetro (o relógio nunca decide num teste).

import { formatarDuracao } from '@/lib/format/duracao'
import type { TarefaDoEscritorio } from './tarefa'

export interface LinhaDaTarefa {
  tarefaId: string
  selo: 'TAREFA'
  nome: string
  instrucao: string | null
  /** "para Michele · ninguém iniciou ainda" · "michele · começou 15:20 · há 9min" · "NATHALIA · 15:05" */
  apoio: string
  /** só na concluída: "12min" (medido) ou "·" quando ninguém mediu */
  duracao: string | null
  fazendo: boolean
  podeCancelar: boolean
}

const hhmm = (iso: string) => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })
const quemDe = (t: TarefaDoEscritorio) => (t.quem.length ? t.quem.join(' e ') : t.liberada ? 'equipe' : null)

const VIVAS = new Set<TarefaDoEscritorio['estado']>(['AGUARDANDO', 'EM_ANDAMENTO'])
const ENCERRADAS_COM_TRABALHO = new Set<TarefaDoEscritorio['estado']>(['FEITA', 'FINALIZADA_PELO_GERENTE'])

/** ⭐ a tarefa ABERTA (Em aberto): nome + instrução + "para {quem}" — nunca "UN pedidas". */
export function linhaDaTarefaAberta(t: TarefaDoEscritorio, agora: Date): LinhaDaTarefa {
  const quem = quemDe(t)
  const fazendo = t.estado === 'EM_ANDAMENTO' && !!t.iniciadoEm
  const apoio = fazendo
    ? `${quem ?? '—'} · começou ${hhmm(t.iniciadoEm!)} · há ${formatarDuracao(Math.max(0, (agora.getTime() - new Date(t.iniciadoEm!).getTime()) / 60000))}`
    : `${t.quem.length ? `para ${t.quem.join(' e ')}` : t.liberada ? 'liberada pra equipe' : 'sem ninguém'} · ninguém iniciou ainda`
  return { tarefaId: t.tarefaId, selo: 'TAREFA', nome: t.nome, instrucao: t.instrucao, apoio, duracao: null, fazendo, podeCancelar: true }
}

/** ⭐ a tarefa CONCLUÍDA: quem · hora · DURAÇÃO — sem R$/un, sem %, sem conferência. */
export function linhaDaTarefaConcluida(t: TarefaDoEscritorio): LinhaDaTarefa {
  const quem = quemDe(t) ?? 'sem responsável'
  const apoio = t.finalizadoEm ? `${quem} · ${hhmm(t.finalizadoEm)}` : quem
  return {
    tarefaId: t.tarefaId, selo: 'TAREFA', nome: t.nome, instrucao: t.instrucao, apoio,
    duracao: t.minutos != null ? formatarDuracao(t.minutos) : '·',
    fazendo: false, podeCancelar: false,
  }
}

/** ⭐ separa as tarefas do escritório entre as duas listas; cancelada e encerrada-sem-finalizar não entram. */
export function tarefasDoPainel(ts: readonly TarefaDoEscritorio[], agora: Date): { abertas: LinhaDaTarefa[]; concluidas: (LinhaDaTarefa & { em: string })[] } {
  return {
    abertas: ts.filter((t) => VIVAS.has(t.estado)).map((t) => linhaDaTarefaAberta(t, agora)),
    concluidas: ts.filter((t) => ENCERRADAS_COM_TRABALHO.has(t.estado))
      .map((t) => ({ ...linhaDaTarefaConcluida(t), em: t.finalizadoEm ?? `${t.dia}T23:59:59.000Z` })),
  }
}
