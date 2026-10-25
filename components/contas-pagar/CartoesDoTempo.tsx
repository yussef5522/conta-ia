'use client'

/**
 * ⭐⭐⭐ 23/10 (1.2, item 2) — **QUATRO CARTÕES FIXOS: VENCIDAS · VENCE HOJE · A VENCER · PAGAS.**
 *
 * **O dono, no print de 23/10 01:56:** *"morrem «PRÓXIMOS 7 DIAS» e «RESTO DO MÊS» (janelas
 * deslizantes que o dono não entende). Volta o card único A VENCER com as datas do período no
 * rótulo. A fileira fica: VENCIDAS · VENCE HOJE · A VENCER · PAGAS — os 3 que ele entende,
 * intocados."*
 *
 * ⭐⭐⭐ **E ISSO APAGOU UM VOCABULÁRIO INTEIRO, não só dois cartões.** As faixas de data eram
 * a ÚNICA razão de `FaixaDoTempo` existir ao lado de `EscopoEmAberto` — tanto que
 * `whereDaFaixa('VENCIDAS')` era **cópia literal** de `whereDoStatus('VENCIDA')`. Com elas
 * aposentadas, os 3 cartões de aberto **são** os 3 estados, e a fileira fala a língua que o
 * resto do sistema já falava (`escopo`). ⛔ Duas palavras pro mesmo corte é como o card dizia
 * 34 e a tabela pintava 9 (13/09).
 *
 * ⛔⛔ **OS TRÊS SÃO FIXOS — zerado NÃO desaparece.** Eles PARTICIONAM o que está em aberto
 * (a régua de 26/09), então esconder o vazio faria a Σ visível não fechar com o total à
 * vista. E *"nada vencido"* é **notícia**: é o número que o dono quer ver zerado.
 *
 * ⛔ **O RÓTULO VEM DO SERVIDOR** (`rotuloDoEscopo`, montado no MESMO instante do agregado).
 * Derivar a data aqui faria um aparelho com a hora torta imprimir *"24 a 31/10"* sobre um
 * número que o servidor contou de OUTRA janela — *um relógio só manda* (a cicatriz do
 * cronômetro do tablet, 08/09).
 *
 * ⭐ **PAGAS é o ÚLTIMO cartão, verde, com o detalhe das conciliadas** — e o tom distinto diz
 * o que ele é: *contexto de FLUXO* (o mês), não faixa de aberto. ⚠️ O detalhe é **APENSADO** à
 * contagem, nunca substituto (a régua de 26/09: a ressalva que segura a promessa não some).
 *
 * ⛔ **E A TELA NÃO SOMA DINHEIRO.** Contagem e total vêm medidos pelo MESMO `whereDoStatus`
 * dos cartões; um `reduce` aqui seria a segunda derivação do mesmo número.
 */

import {
  AlertCircle,
  CalendarClock,
  CalendarRange,
  CheckCircle2,
  type LucideIcon,
} from 'lucide-react'
import { StatCard, type StatTone } from '@/components/ui/stat-card'
import { formatBRL } from '@/lib/format/money'
import type { EscopoDaLista } from '@/lib/contas-pagar/escopo'
import {
  ESCOPOS_EM_ABERTO,
  type EscopoEmAberto,
  type MedidaDoTempo,
} from '@/lib/contas-pagar/rotulo-do-tempo'

/** o tom de cada estado, pela AÇÃO que ele pede — nunca por gosto */
const TOM: Record<EscopoEmAberto, StatTone> = {
  // ⛔ coral é a cor do alarme e só a VENCIDA alarma: ela já passou do dia
  VENCIDA: 'rose',
  // ⚠️ âmbar e não coral: o dia NÃO acabou — ainda dá pra pagar (a régua de 26/09)
  VENCE_HOJE: 'amber',
  A_PAGAR: 'sky',
}

const ICONE: Record<EscopoEmAberto, LucideIcon> = {
  VENCIDA: AlertCircle,
  VENCE_HOJE: CalendarClock,
  A_PAGAR: CalendarRange,
}

/** o cartão de contexto — o único que NÃO é estado de aberto */
export interface CartaoDasPagas {
  /** já com o recorte no rótulo: *"Pagas · outubro"* */
  label: string
  total: number
  contagem: number
  /** *"N conciliadas com o banco · M sem vínculo"* */
  detalhe: string
  ativo: boolean
  onEscolher: () => void
}

interface Props {
  medidas: Partial<Record<EscopoEmAberto, MedidaDoTempo>>
  /** o recorte ligado hoje — pode ser `PAGA*`, que não é estado de aberto */
  escopoAtivo?: EscopoDaLista
  onEscolherEscopo: (escopo: EscopoEmAberto | undefined) => void
  /** o total em aberto medido pelo servidor (Σ dos três cartões de aberto) */
  totalEmAberto: number
  pagas: CartaoDasPagas
}

export function CartoesDoTempo({
  medidas,
  escopoAtivo,
  onEscolherEscopo,
  totalEmAberto,
  pagas,
}: Props) {
  const somaDosEstados = ESCOPOS_EM_ABERTO.reduce(
    (acc, e) => acc + (medidas[e]?.total ?? 0),
    0,
  )
  const fecha = Math.abs(somaDosEstados - totalEmAberto) < 0.02

  return (
    <div className="space-y-1.5" data-testid="cartoes-do-tempo">
      {/**
       * ⚠️ **DIVERGÊNCIA DECLARADA do `StatCardGrid`, e o motivo é a referência.** O molde do
       * sistema é `grid-cols-2 lg:grid-cols-4`; `docs/contas-a-pagar-referencia.html` declara,
       * pra ESTA família, `repeat(auto-fit, minmax(170px, 1fr))` com `gap:9px` — e é a lei
       * desta tela (hierarquia: a referência de TELA manda na estrutura dela). As medidas vão
       * LITERAIS, do arquivo, nunca traduzidas no olho.
       *
       * ⭐ Com 4 cartões o `auto-fit` dá a fileira única que o dono pediu no notebook e empilha
       * sozinho no celular — uma composição, dois viewports (REGRA 12).
       */}
      <div className="grid gap-[9px] [grid-template-columns:repeat(auto-fit,minmax(170px,1fr))]">
        {ESCOPOS_EM_ABERTO.map((e) => {
          const m = medidas[e]
          const ativa = escopoAtivo === e
          return (
            <StatCard
              key={e}
              tone={TOM[e]}
              /**
               * ⚠️ sem medida o rótulo é vazio — e aí o cartão **não existe ainda**, não
               * inventa nome: a carga falhou ou o payload é antigo. ⭐ O rótulo é do SERVIDOR.
               */
              label={m?.rotulo ?? ''}
              /* ⚠️ zero vai ESCRITO, nunca escondido: "nada" é notícia */
              value={!m || m.contagem === 0 ? 'nada' : formatBRL(m.total)}
              sub={
                !m || m.contagem === 0
                  ? undefined
                  : `${m.contagem} ${m.contagem === 1 ? 'conta' : 'contas'}`
              }
              icon={ICONE[e]}
              active={ativa}
              /* ⭐ o cartão É o filtro, e clicar de novo volta pra lista inteira */
              onClick={() => onEscolherEscopo(ativa ? undefined : e)}
              testId={`cartao-escopo-${e}`}
            />
          )
        })}

        <StatCard
          tone="emerald"
          label={pagas.label}
          value={formatBRL(pagas.total)}
          sub={`${pagas.contagem} ${pagas.contagem === 1 ? 'conta' : 'contas'} · ${pagas.detalhe}`}
          icon={CheckCircle2}
          active={pagas.ativo}
          onClick={pagas.onEscolher}
          testId="cartao-pagas"
        />
      </div>

      {/**
       * ⭐⭐ A LINHA *"Σ dos estados = o total em aberto"* NÃO MORA NA TELA (item 5 de 21/10):
       * *"o invariante mora no TESTE, não precisa morar na frente do dono"* — móvel que
       * mostra sempre a mesma coisa ocupa a dobra.
       *
       * ⛔⛔ **O GRITO FICA.** O que não existe é a legenda permanente, nunca o alarme:
       * esconder uma Σ que NÃO fecha trocaria a legenda por uma **mentira** — e número de
       * dinheiro em tela sem régua é pior que ausência.
       */}
      {!fecha && (
        <div className="text-[10.5px] font-semibold tabular-nums text-rose-700 dark:text-rose-400">
          ⛔ a Σ dos estados ({formatBRL(somaDosEstados)}) não fecha com o total em aberto (
          {formatBRL(totalEmAberto)}) — me avise
        </div>
      )}
    </div>
  )
}
