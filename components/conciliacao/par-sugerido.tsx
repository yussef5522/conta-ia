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
  alta: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
  media: 'bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
  baixa: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
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
    <article className={`rounded-lg border overflow-hidden bg-card ${
      disputadaPor > 1 ? 'border-amber-500 dark:border-amber-600' : 'border-slate-300 dark:border-slate-700'
    }`}>
      {/* ⛔ o aviso vem ANTES do par: quem lê precisa saber que está escolhendo
          ENTRE notas, não confirmando uma sozinha. */}
      {disputadaPor > 1 && (
        <div className="flex items-start gap-2 px-3.5 py-1.5 bg-amber-50 dark:bg-amber-950/40 border-b border-amber-300 dark:border-amber-800 text-[12px]">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5 text-amber-700 dark:text-amber-400" />
          <span>
            <b>{disputadaPor} notas disputam este mesmo débito</b> — só uma pode ser.
            Confira o <b>número da NF</b> e o <b>vencimento</b> à direita antes de vincular.
          </span>
        </div>
      )}
      <div className="grid md:grid-cols-[1fr_34px_1fr]">
        {/* ── lado FRIO: o extrato ── */}
        <div className="px-3.5 py-2.5 bg-slate-100/70 dark:bg-slate-900/60 min-w-0 flex flex-col gap-0.5">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            linha do extrato{s.extratoConta ? ` · ${s.extratoConta}` : ''}
          </span>
          <span className="text-[13px] font-semibold leading-snug break-words">{s.extrato.descricao}</span>
          <span className="text-[15px] font-semibold tabular-nums">
            {s.extrato.tipo === 'DEBIT' ? '− ' : '+ '}{formatBRL(Math.abs(s.extrato.valor))}
          </span>
          <span className="text-[11px] text-muted-foreground tabular-nums">
            {dia(s.extrato.data)}
            {s.extratoCategoria ? ` · categoria ${s.extratoCategoria}` : ' · sem categoria'}
          </span>
        </div>

        <div className="flex md:flex-col items-center justify-center border-y md:border-y-0 md:border-x h-7 md:h-auto text-muted-foreground">
          <Link2 className="h-3.5 w-3.5" />
        </div>

        {/* ── lado QUENTE: a conta ── */}
        <div className="px-3.5 py-2.5 bg-amber-50/50 dark:bg-amber-950/20 min-w-0 flex flex-col gap-0.5">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            conta a pagar · {item.situacao === 'DUPLA_CONTAGEM' ? 'já marcada como paga' : 'em aberto'}
          </span>
          <span className={`leading-snug break-words ${
            disputadaPor > 1 ? 'text-[14px] font-bold' : 'text-[13px] font-semibold'
          }`}>{item.conta.descricao}</span>
          <span className="text-[15px] font-semibold tabular-nums">{formatBRL(Math.abs(item.conta.valor))}</span>
          <span className={`tabular-nums ${
            disputadaPor > 1
              ? 'text-[12.5px] font-semibold text-amber-800 dark:text-amber-300'
              : 'text-[11px] text-muted-foreground'
          }`}>
            vence {dia(item.conta.data)}
            {item.situacao === 'DUPLA_CONTAGEM' && ' · sem vínculo desde então'}
          </span>
        </div>
      </div>

      {/* ⛔ A TIRA DO PORQUÊ — sem ela a sugestão não pode existir */}
      <div className="flex flex-wrap items-center gap-2.5 px-3.5 py-2 border-t">
        <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${CORES[s.confianca]}`}>
          {GRAU[s.confianca]}
        </span>
        <span className="text-xs text-muted-foreground flex-1 min-w-[180px]">
          {s.porQue}
          {temDiferenca && (
            <> · a diferença de <b className="text-foreground">{formatBRL(Math.abs(s.diferenca))}</b> entra como juros/tarifa de boleto</>
          )}
        </span>
        <span className="flex items-center gap-1.5 ml-auto">
          <Button size="sm" variant="outline" disabled={ocupado} onClick={vincular}
            className="h-7 gap-1.5 text-xs border-emerald-600 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950 dark:text-emerald-300 dark:hover:bg-emerald-900">
            {ocupado ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Link2 className="h-3.5 w-3.5" />}
            Vincular
          </Button>
          {/* a saída do Xero pro caso difícil: o botão não some, ele muda de modo */}
          <Button size="sm" variant="ghost" disabled={ocupado} onClick={() => onProcurar(s)}
            className="h-7 gap-1 text-xs text-muted-foreground" title="procurar outra conta pra esta linha">
            <Search className="h-3.5 w-3.5" />
            Procurar outra
          </Button>
          <Button size="sm" variant="ghost" disabled={ocupado} onClick={recusar}
            className="h-7 gap-1 text-xs text-muted-foreground hover:text-destructive"
            title="não sugere mais este par, em tela nenhuma">
            <X className="h-3.5 w-3.5" />
            Não é isso
          </Button>
        </span>
      </div>
    </article>
  )
}
