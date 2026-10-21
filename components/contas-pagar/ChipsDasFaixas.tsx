'use client'

/**
 * ⭐⭐⭐ 21/10 — AS FAIXAS DO TEMPO NO TOPO (item 3 do brief do dono).
 *
 * **O pedido:** *"FAIXAS DO TEMPO no topo, SEMPRE com a data no rótulo (lei: rótulo adulto =
 * nome + data): VENCIDAS (até ontem) · VENCE HOJE · PRÓXIMOS 7 DIAS (datas) · RESTO DO MÊS
 * (datas). Clicável = filtro."*
 *
 * ⛔⛔ **O RÓTULO VEM DO SERVIDOR, não daqui.** Ele é montado no mesmo instante em que o
 * agregado é contado (`rotuloDaFaixa(faixa, now)` na rota). Derivar a data no cliente faria
 * um aparelho com a hora torta imprimir *"22 a 28/10"* sobre um número que o servidor contou
 * de **outra** janela — e ninguém teria como saber qual dos dois está certo. *Um relógio só
 * manda* (a cicatriz do cronômetro do tablet, 08/09).
 *
 * ⛔ **A TELA NÃO SOMA NADA.** Contagem e total vêm medidos pelo MESMO `whereDoStatus` dos
 * cartões; um `reduce` aqui seria a segunda derivação do mesmo dinheiro a dez centímetros do
 * cartão (a doença que esta casa mais paga).
 *
 * ⚠️ **A LEI DA Σ fica À VISTA:** `Σ das faixas == total em aberto` é invariante do servidor
 * (travado em teste), e o rodapé dos chips imprime a soma — *número de dinheiro em tela sem
 * régua é pior que ausência*.
 */

import { cn } from '@/lib/utils'
import { formatBRL } from '@/lib/format/money'
import {
  FAIXAS,
  FAIXAS_SEMPRE_VISIVEIS,
  type FaixaDoTempo,
  type FaixaMedida,
} from '@/lib/contas-pagar/faixa-do-tempo'

/** o tom de cada faixa, pela ação que ela pede — nunca por gosto */
const TOM: Record<FaixaDoTempo, { chao: string; tinta: string; borda: string }> = {
  // ⛔ coral é a cor do alarme e só a VENCIDA alarma: ela já passou do dia
  VENCIDAS: {
    chao: 'bg-rose-50 dark:bg-rose-950/40',
    tinta: 'text-rose-800 dark:text-rose-300',
    borda: 'border-rose-300 dark:border-rose-800',
  },
  // ⚠️ âmbar e não coral: o dia NÃO acabou — ainda dá pra pagar (a régua de 26/09)
  VENCE_HOJE: {
    chao: 'bg-amber-50 dark:bg-amber-950/40',
    tinta: 'text-amber-800 dark:text-amber-300',
    borda: 'border-amber-300 dark:border-amber-800',
  },
  SETE_DIAS: {
    chao: 'bg-sky-50 dark:bg-sky-950/40',
    tinta: 'text-sky-800 dark:text-sky-300',
    borda: 'border-sky-300 dark:border-sky-800',
  },
  RESTO_DO_MES: {
    chao: 'bg-slate-50 dark:bg-slate-900',
    tinta: 'text-slate-700 dark:text-slate-300',
    borda: 'border-slate-300 dark:border-slate-700',
  },
  DEPOIS_DO_MES: {
    chao: 'bg-slate-50 dark:bg-slate-900',
    tinta: 'text-slate-700 dark:text-slate-300',
    borda: 'border-slate-300 dark:border-slate-700',
  },
  // ⚠️ sem vencimento não é "depois": é conta que ninguém datou — e ela PEDE a data
  SEM_VENCIMENTO: {
    chao: 'bg-violet-50 dark:bg-violet-950/40',
    tinta: 'text-violet-800 dark:text-violet-300',
    borda: 'border-violet-300 dark:border-violet-800',
  },
}

/**
 * ⭐ QUAIS CHIPS APARECEM — função pura, pra a régua ser testável.
 *
 * As três primeiras (`FAIXAS_SEMPRE_VISIVEIS`) ficam **mesmo zeradas**: *"vencidas · nada"* é
 * uma notícia boa e o dono precisa vê-la (a régua do `NADA_A_PEDIR` de 18/10 — zero medido é
 * FATO, não ausência). As outras só aparecem com conta dentro — chip permanente em zero
 * ocupa a dobra e treina o dono a não olhar.
 *
 * ⚠️ E a faixa com **intervalo vazio** não aparece nem com a trava de sempre-visível: *"PRÓXIMOS
 * 7 DIAS"* sem nenhum dia dentro seria um recorte que não existe.
 */
export function faixasVisiveis(
  medidas: Partial<Record<FaixaDoTempo, FaixaMedida>>,
  faixaAtiva?: FaixaDoTempo,
): FaixaDoTempo[] {
  return FAIXAS.filter((f) => {
    const m = medidas[f]
    if (!m) return false
    // ⭐ a faixa FILTRADA nunca desaparece — senão o dono perde o caminho de volta
    if (f === faixaAtiva) return true
    if (m.intervaloVazio) return false
    if ((FAIXAS_SEMPRE_VISIVEIS as readonly string[]).includes(f)) return true
    return m.contagem > 0
  })
}

interface Props {
  medidas: Partial<Record<FaixaDoTempo, FaixaMedida>>
  faixaAtiva?: FaixaDoTempo
  onEscolher: (faixa: FaixaDoTempo | undefined) => void
  /** o total em aberto medido pelo servidor (Σ dos três cartões de aberto) */
  totalEmAberto: number
}

export function ChipsDasFaixas({ medidas, faixaAtiva, onEscolher, totalEmAberto }: Props) {
  const visiveis = faixasVisiveis(medidas, faixaAtiva)
  if (visiveis.length === 0) return null

  const somaDasFaixas = FAIXAS.reduce((acc, f) => acc + (medidas[f]?.total ?? 0), 0)
  const fecha = Math.abs(somaDasFaixas - totalEmAberto) < 0.02

  return (
    <div className="space-y-1.5" data-testid="chips-das-faixas">
      <div className="flex flex-wrap items-stretch gap-2">
        {visiveis.map((f) => {
          const m = medidas[f]!
          const tom = TOM[f]
          const ativa = faixaAtiva === f
          return (
            <button
              key={f}
              type="button"
              // ⭐ `<button>` e não `<div>`: chip clicável que não é botão perde teclado e
              // leitor de tela (a régua de 20/09)
              onClick={() => onEscolher(ativa ? undefined : f)}
              aria-pressed={ativa}
              className={cn(
                'rounded-lg border px-3 py-1.5 text-left transition-colors',
                tom.chao,
                tom.borda,
                ativa
                  ? 'ring-2 ring-offset-1 ring-slate-400 dark:ring-slate-500 dark:ring-offset-slate-950'
                  : 'hover:brightness-[0.97] dark:hover:brightness-125',
              )}
              data-testid={`chip-faixa-${f}`}
            >
              <div className={cn('text-[10.5px] font-bold uppercase tracking-wide', tom.tinta)}>
                {m.rotulo}
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className={cn('text-sm font-semibold tabular-nums', tom.tinta)}>
                  {/* ⚠️ zero vai escrito, nunca escondido: "nada" é notícia */}
                  {m.contagem === 0 ? 'nada' : formatBRL(m.total)}
                </span>
                {m.contagem > 0 && (
                  <span className="text-[10.5px] text-slate-500 dark:text-slate-400 tabular-nums">
                    {m.contagem} {m.contagem === 1 ? 'conta' : 'contas'}
                  </span>
                )}
              </div>
            </button>
          )
        })}
      </div>

      {/* ⭐ a Σ à vista — e quando ela NÃO fecha, a tela GRITA em vez de calar */}
      <div className="text-[10.5px] text-slate-500 dark:text-slate-400 tabular-nums">
        {fecha ? (
          <>
            Σ das faixas {formatBRL(somaDasFaixas)} = o total em aberto
            {faixaAtiva && ' · clique de novo no chip pra ver tudo'}
          </>
        ) : (
          <span className="font-semibold text-rose-700 dark:text-rose-400">
            ⛔ a Σ das faixas ({formatBRL(somaDasFaixas)}) não fecha com o total em aberto (
            {formatBRL(totalEmAberto)}) — me avise
          </span>
        )}
      </div>
    </div>
  )
}
