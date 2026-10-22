'use client'

/**
 * ⭐⭐⭐ 21/10 (fatia 1.1) — **UMA FAMÍLIA SÓ DE CARTÕES DO TEMPO.**
 *
 * **Veredito do dono, no print de 21/10 20:22:** *"bagunça total, cards repetidos, mesma
 * informação 2 vezes em 2 modelos"*.
 *
 * ⛔⛔ **O DIAGNÓSTICO, e ele é de DESENHO:** a mesma informação vivia em TRÊS formas — os 4
 * cartões antigos (PAGAS · VENCE HOJE · A PAGAR · VENCIDAS), os 5 chips de faixa e a régua
 * do rodapé. **VENCE HOJE e VENCIDAS apareciam EM DOBRO, com números IDÊNTICOS** — porque a
 * faixa e o cartão são o MESMO corte por construção (`whereDaFaixa` delega a `whereDoStatus`
 * por recursão). Duas apresentações do mesmo número, a dez centímetros uma da outra, é a
 * doença que esta casa mais paga — em tela ela se lê como erro.
 *
 * ⭐ **A CURA É SUBTRAÇÃO:** o visual FORTE dos cartões antigos (`StatCard`, o molde do
 * sistema desde 24/08) com os **rótulos ADULTOS da referência** (nome + data, medidos pelo
 * SERVIDOR). Os chips morreram — o arquivo deles foi **APAGADO**, não deixado órfão:
 * *enquanto o componente existe no arquivo, alguém religa* (a cicatriz do `GruposSugeridos`,
 * 23/09).
 *
 * ⛔⛔ **O "A PAGAR" MORREU COMO CARTÃO, e isso não perde número:** ele é exatamente
 * `SETE_DIAS + RESTO_DO_MES + DEPOIS_DO_MES + SEM_VENCIMENTO`. Mantê-lo ao lado das três
 * faixas seria **a mesma conta contada 2×** — o defeito que matou o *"a vencer (3d)"* em
 * 13/09. O total em aberto continua à vista: ele é a Σ dos cartões de faixa.
 *
 * ⭐ **PAGAS é o ÚLTIMO cartão, verde, com o detalhe das conciliadas** — e o tom distinto diz
 * o que ele é: *contexto*, não faixa de aberto. ⚠️ O detalhe é **APENSADO** à contagem, nunca
 * substituto (a régua de 26/09: a ressalva que segura a promessa não some).
 *
 * ⛔ **O RÓTULO VEM DO SERVIDOR** (`rotuloDaFaixa`, montado no MESMO instante do agregado).
 * Derivar a data aqui faria um aparelho com a hora torta imprimir *"22 a 28/10"* sobre um
 * número que o servidor contou de OUTRA janela — *um relógio só manda* (a cicatriz do
 * cronômetro do tablet, 08/09).
 *
 * ⛔ **E A TELA NÃO SOMA DINHEIRO.** Contagem e total vêm medidos pelo MESMO `whereDoStatus`
 * dos cartões; um `reduce` aqui seria a segunda derivação do mesmo número.
 */

import {
  AlertCircle,
  CalendarClock,
  CalendarDays,
  CalendarOff,
  CalendarRange,
  CheckCircle2,
  type LucideIcon,
} from 'lucide-react'
import { StatCard, type StatTone } from '@/components/ui/stat-card'
import { formatBRL } from '@/lib/format/money'
import {
  FAIXAS,
  faixasVisiveis,
  type FaixaDoTempo,
  type FaixaMedida,
} from '@/lib/contas-pagar/faixa-do-tempo'

/** o tom de cada faixa, pela AÇÃO que ela pede — nunca por gosto */
const TOM: Record<FaixaDoTempo, StatTone> = {
  // ⛔ coral é a cor do alarme e só a VENCIDA alarma: ela já passou do dia
  VENCIDAS: 'rose',
  // ⚠️ âmbar e não coral: o dia NÃO acabou — ainda dá pra pagar (a régua de 26/09)
  VENCE_HOJE: 'amber',
  SETE_DIAS: 'sky',
  RESTO_DO_MES: 'slate',
  DEPOIS_DO_MES: 'slate',
  // ⚠️ sem vencimento não é "depois": é conta que ninguém datou — e ela PEDE a data
  SEM_VENCIMENTO: 'violet',
}

const ICONE: Record<FaixaDoTempo, LucideIcon> = {
  VENCIDAS: AlertCircle,
  VENCE_HOJE: CalendarClock,
  SETE_DIAS: CalendarDays,
  RESTO_DO_MES: CalendarDays,
  DEPOIS_DO_MES: CalendarRange,
  SEM_VENCIMENTO: CalendarOff,
}

/** o cartão de contexto — o único que NÃO é faixa de aberto */
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
  medidas: Partial<Record<FaixaDoTempo, FaixaMedida>>
  faixaAtiva?: FaixaDoTempo
  onEscolherFaixa: (faixa: FaixaDoTempo | undefined) => void
  /** o total em aberto medido pelo servidor (Σ dos três cartões de aberto) */
  totalEmAberto: number
  pagas: CartaoDasPagas
}

export function CartoesDoTempo({
  medidas,
  faixaAtiva,
  onEscolherFaixa,
  totalEmAberto,
  pagas,
}: Props) {
  const visiveis = faixasVisiveis(medidas, faixaAtiva)

  const somaDasFaixas = FAIXAS.reduce((acc, f) => acc + (medidas[f]?.total ?? 0), 0)
  const fecha = Math.abs(somaDasFaixas - totalEmAberto) < 0.02

  return (
    <div className="space-y-1.5" data-testid="cartoes-do-tempo">
      {/**
       * ⚠️ **DIVERGÊNCIA DECLARADA do `StatCardGrid`, e o motivo é a referência.** O molde do
       * sistema é `grid-cols-2 lg:grid-cols-4`; com 6 cartões isso deixa uma fileira
       * quebrada. `docs/contas-a-pagar-referencia.html` declara, pra ESTA família,
       * `repeat(auto-fit, minmax(170px, 1fr))` com `gap:9px` — e é a lei desta tela
       * (hierarquia: a referência de TELA manda na estrutura dela). As medidas vão
       * LITERAIS, do arquivo, nunca traduzidas no olho.
       */}
      <div className="grid gap-[9px] [grid-template-columns:repeat(auto-fit,minmax(170px,1fr))]">
        {visiveis.map((f) => {
          const m = medidas[f]!
          const ativa = faixaAtiva === f
          return (
            <StatCard
              key={f}
              tone={TOM[f]}
              label={m.rotulo}
              /* ⚠️ zero vai ESCRITO, nunca escondido: "nada" é notícia */
              value={m.contagem === 0 ? 'nada' : formatBRL(m.total)}
              sub={
                m.contagem === 0
                  ? undefined
                  : `${m.contagem} ${m.contagem === 1 ? 'conta' : 'contas'}`
              }
              icon={ICONE[f]}
              active={ativa}
              /* ⭐ o cartão É o filtro, e clicar de novo volta pra lista inteira */
              onClick={() => onEscolherFaixa(ativa ? undefined : f)}
              testId={`cartao-faixa-${f}`}
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
       * ⭐⭐ A LINHA *"Σ das faixas = o total em aberto"* SAIU DA TELA (item 5 do dono):
       * *"o invariante mora no TESTE, não precisa morar na frente do dono"* — móvel que
       * mostra sempre a mesma coisa ocupa a dobra.
       *
       * ⛔⛔ **O GRITO FICA.** O que morreu é a legenda permanente, nunca o alarme: esconder
       * uma Σ que NÃO fecha trocaria a legenda por uma **mentira** — e número de dinheiro em
       * tela sem régua é pior que ausência. É a mesma divisão de 26/09 (a legenda sai, a
       * ressalva que segura a promessa fica).
       */}
      {!fecha && (
        <div className="text-[10.5px] font-semibold tabular-nums text-rose-700 dark:text-rose-400">
          ⛔ a Σ das faixas ({formatBRL(somaDasFaixas)}) não fecha com o total em aberto (
          {formatBRL(totalEmAberto)}) — me avise
        </div>
      )}
    </div>
  )
}
