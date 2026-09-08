'use client'

// ⭐⭐⭐ O CARD DO PAR (07/09/2026) — o desenho aprovado pelo dono.
//
// ⛔ Os DOIS LADOS TÊM CHÃO DE COR DIFERENTE, e isso é ESTRUTURA, não enfeite:
// frio é o extrato (o que o banco fez), quente é a conta (o que a gente devia).
// Quem lê nunca precisa procurar um rótulo pra saber de que lado está.
//
// ⛔ A TIRA DO PORQUÊ É OBRIGATÓRIA. A régua do dono: *"sugestão SEMPRE com motivo
// visível; nunca vincula sozinha"*. Por isso são DOIS botões e nenhum deles é
// automático — nem o de alta confiança.
//
// ⚠️ "Não é isso" ENSINA: grava o par recusado e ele não volta em tela nenhuma.
// E a recusa é do PAR, não da linha — o mesmo extrato continua podendo casar com
// outra nota do mesmo fornecedor (as duas notas do Cancian são o caso real).

import { useState } from 'react'
import { Link2, X, Loader2, Search, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/use-toast'
import { formatBRL } from '@/lib/format/money'

export interface LadoDoParDTO {
  id: string
  descricao: string
  valor: number
  data: string
  tipo: 'CREDIT' | 'DEBIT'
}

export interface SugestaoDTO {
  extratoId: string
  contaId: string
  score: number
  confianca: 'alta' | 'media' | 'baixa'
  porQue: string
  diferenca: number
  fornecedorPeloNome: string | null
  extrato: LadoDoParDTO
  extratoConta: string | null
  extratoCategoria: string | null
}

export interface ContaDaFilaDTO {
  conta: LadoDoParDTO
  situacao: 'EM_ABERTO' | 'DUPLA_CONTAGEM'
  fornecedor: string | null
  sugestoes: SugestaoDTO[]
}

const GRAU: Record<SugestaoDTO['confianca'], string> = {
  alta: 'muito provável', media: 'provável', baixa: 'possível',
}
const CORES: Record<SugestaoDTO['confianca'], string> = {
  alta: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400',
  media: 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400',
  baixa: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300',
}

const dia = (iso: string) =>
  new Date(iso).toLocaleDateString('pt-BR', { timeZone: 'UTC' })

interface Props {
  empresaId: string
  item: ContaDaFilaDTO
  sugestao: SugestaoDTO
  /**
   * ⛔⛔ QUANTAS CONTAS ESTÃO DISPUTANDO ESTA MESMA LINHA DO EXTRATO.
   *
   * Nasceu de um erro real em 08/09/2026: o Cancian tinha DUAS notas de R$ 230,81
   * (NF 834771 venc 29/08 e NF 835271 venc 05/09) disputando o mesmo débito de
   * R$ 232,81. Os dois cards ficavam quase idênticos — mesma linha à esquerda,
   * mesmo valor à direita — e o que os separava (**o número da NF e o
   * vencimento**) estava em texto pequeno. **A nota errada foi vinculada.**
   *
   * Mostrar as duas continua certo (esconder uma seria a régua decidindo qual foi
   * paga). O que faltava era dizer, alto, que **só uma pode ser**.
   */
  disputadaPor?: number
  onVinculado: (contaId: string, extratoId: string) => void
  onRecusado: (extratoId: string, contaId: string) => void
  onProcurar: (s: SugestaoDTO) => void
}

export function ParSugerido({
  empresaId, item, sugestao: s, disputadaPor = 1, onVinculado, onRecusado, onProcurar,
}: Props) {
  const { toast } = useToast()
  const [ocupado, setOcupado] = useState(false)
  const temDiferenca = Math.abs(s.diferenca) >= 0.01

  async function vincular() {
    setOcupado(true)
    try {
      const res = await fetch('/api/conciliacao/confirmar', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ofxTransactionId: s.extratoId,
          candidateId: s.contaId,
          // ⛔ vai o NÚMERO EXATO que esta tela mostrou. O servidor recusa se não
          // bater ao centavo — é confirmação do que ele viu, não um "force".
          ...(temDiferenca ? { diferencaAceita: s.diferenca } : {}),
        }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast({ variant: 'destructive', title: 'Não deu pra vincular', description: body?.erro ?? `HTTP ${res.status}` })
        return
      }
      toast({ title: 'Vinculado', description: 'O pagamento e a conta viraram uma linha só.' })
      onVinculado(s.contaId, s.extratoId)
    } catch {
      toast({ variant: 'destructive', title: 'Falha de rede', description: 'Tenta de novo.' })
    } finally { setOcupado(false) }
  }

  async function recusar() {
    setOcupado(true)
    try {
      const res = await fetch('/api/conciliacao/recusar', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ empresaId, extratoId: s.extratoId, contaId: s.contaId }),
      })
      if (!res.ok) {
        toast({ variant: 'destructive', title: 'Não deu pra registrar a recusa' })
        return
      }
      onRecusado(s.extratoId, s.contaId)
    } finally { setOcupado(false) }
  }

  return (
    <article className={`overflow-hidden rounded-xl border bg-white shadow-sm transition-shadow hover:shadow dark:bg-slate-950 ${
      disputadaPor > 1
        ? 'border-amber-300 dark:border-amber-800'
        : 'border-slate-200 dark:border-slate-800'
    }`}>
      {/* ⛔ o aviso vem ANTES do par: quem lê precisa saber que está escolhendo
          ENTRE notas, não confirmando uma sozinha. */}
      {disputadaPor > 1 && (
        <div className="flex items-start gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2 text-[12px] leading-relaxed text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
          <span>
            <b>{disputadaPor} notas disputam este mesmo débito</b> — só uma pode ser.
            Confira o <b>número da NF</b> e o <b>vencimento</b> à direita antes de vincular.
          </span>
        </div>
      )}
      <div className="grid md:grid-cols-[1fr_36px_1fr]">
        {/* ── lado FRIO: o extrato ── */}
        <div className="flex min-w-0 flex-col gap-1 bg-slate-50 px-4 py-3 dark:bg-slate-900/60">
          <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
            linha do extrato{s.extratoConta ? ` · ${s.extratoConta}` : ''}
          </span>
          {/* ⚠️ o VALOR vem primeiro e grande: é o que o olho procura pra decidir */}
          <span className="text-[19px] font-semibold leading-none tabular-nums text-slate-900 dark:text-slate-50">
            {s.extrato.tipo === 'DEBIT' ? '− ' : '+ '}{formatBRL(Math.abs(s.extrato.valor))}
          </span>
          <span className="break-words text-[12.5px] leading-snug text-slate-600 dark:text-slate-300">
            {s.extrato.descricao}
          </span>
          <span className="text-[11px] tabular-nums text-slate-400">
            {dia(s.extrato.data)}
            {s.extratoCategoria ? ` · ${s.extratoCategoria}` : ' · sem categoria'}
          </span>
        </div>

        <div className="flex h-7 items-center justify-center border-y border-slate-200 bg-white text-slate-300 dark:border-slate-800 dark:bg-slate-950 md:h-auto md:flex-col md:border-x md:border-y-0">
          <Link2 className="h-3.5 w-3.5" />
        </div>

        {/* ── lado QUENTE: a conta ── */}
        <div className="flex min-w-0 flex-col gap-1 bg-amber-50/40 px-4 py-3 dark:bg-amber-950/10">
          <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
            conta a pagar · {item.situacao === 'DUPLA_CONTAGEM' ? 'já marcada como paga' : 'em aberto'}
          </span>
          <span className="text-[19px] font-semibold leading-none tabular-nums text-slate-900 dark:text-slate-50">
            {formatBRL(Math.abs(item.conta.valor))}
          </span>
          {/* ⚠️ na DISPUTA, a NF é o que decide — então ela ganha o peso, e o
              vencimento vem em âmbar logo abaixo. Fora da disputa, tom normal. */}
          <span className={`break-words leading-snug ${
            disputadaPor > 1
              ? 'text-[13px] font-semibold text-slate-900 dark:text-slate-50'
              : 'text-[12.5px] text-slate-600 dark:text-slate-300'
          }`}>{item.conta.descricao}</span>
          <span className={`tabular-nums ${
            disputadaPor > 1
              ? 'text-[12px] font-semibold text-amber-700 dark:text-amber-400'
              : 'text-[11px] text-slate-400'
          }`}>
            vence {dia(item.conta.data)}
            {item.situacao === 'DUPLA_CONTAGEM' && ' · sem vínculo desde então'}
          </span>
        </div>
      </div>

      {/* ⛔ A TIRA DO PORQUÊ — sem ela a sugestão não pode existir */}
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-2 border-t border-slate-200 bg-white px-4 py-2.5 dark:border-slate-800 dark:bg-slate-950">
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.06em] ${CORES[s.confianca]}`}>
          {GRAU[s.confianca]}
        </span>
        <span className="min-w-[180px] flex-1 text-[12px] leading-relaxed text-slate-500 dark:text-slate-400">
          {s.porQue}
          {temDiferenca && (
            <> · a diferença de <b className="font-semibold text-slate-700 dark:text-slate-200">{formatBRL(Math.abs(s.diferenca))}</b> entra como juros/tarifa de boleto</>
          )}
        </span>
        {/* ⛔ UM primário só. "Vincular" é o roxo da casa; os outros dois são
            ghost — porque nenhum deles é a ação padrão, e dois botões coloridos
            lado a lado empatariam a decisão. */}
        <span className="ml-auto flex items-center gap-1">
          <Button size="sm" disabled={ocupado} onClick={vincular} className="h-8 gap-1.5 px-3 text-xs">
            {ocupado ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Link2 className="h-3.5 w-3.5" />}
            Vincular
          </Button>
          {/* a saída do Xero pro caso difícil: o botão não some, ele muda de modo */}
          <Button size="sm" variant="ghost" disabled={ocupado} onClick={() => onProcurar(s)}
            className="h-8 gap-1 px-2.5 text-xs text-slate-500" title="procurar outra conta pra esta linha">
            <Search className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Procurar outra</span>
          </Button>
          <Button size="sm" variant="ghost" disabled={ocupado} onClick={recusar}
            className="h-8 gap-1 px-2.5 text-xs text-slate-500 hover:text-rose-600"
            title="não sugere mais este par, em tela nenhuma">
            <X className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Não é isso</span>
          </Button>
        </span>
      </div>
    </article>
  )
}
