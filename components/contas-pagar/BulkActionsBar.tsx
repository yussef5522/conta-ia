'use client'

// Sprint 5.0.3.0b — Barra de ações em lote (aparece quando ≥1 selecionada).
//
// Substitui a barra normal acima da tabela. Slide-in via Tailwind transition.

/**
 * ⭐⭐⭐ 21/10 — A BARRA GANHOU O **TOTAL GIGANTE** E A **RÉGUA DO CAIXA**.
 *
 * **O pedido do dono:** *"A BARRA DA SELEÇÃO: fixa embaixo ao marcar 1+ contas — «N contas
 * selecionadas» + TOTAL gigante + A RÉGUA DO CAIXA: «saldo hoje R$ X → pagando fica R$ Y»
 * (verde quando cobre, coral quando estoura). Botão «limpar»."*
 *
 * ⚠️⚠️ **CORREÇÃO DE PREMISSA, MEDIDA:** o brief diz que os botões de lote *"não entram nesta
 * fatia"*, dando a entender que a barra nasce agora. **Ela existe desde 5.0.3.0b**, com
 * *"marcar pagas"*, *"excluir"* e *"cancelar"* — então a leitura certa é ***"não se mexe
 * neles"***, e a barra **GANHA** total+régua. ⛔ Construir uma segunda barra ao lado desta
 * seria a doença da superfície duplicada: duas respostas pra *"o que eu faço com a
 * seleção?"*, divergindo no primeiro gesto novo.
 *
 * ⭐ **A régua vem PRONTA do servidor-pra-lib** (`reguaDoCaixaNaSelecao`): a barra não soma a
 * seleção nem subtrai o saldo. Aritmética de dinheiro aqui seria a segunda derivação do
 * mesmo número, a dez centímetros do primeiro.
 *
 * ⛔ **E o `tom: 'a-apurar'` não é um verde disfarçado:** sem saldo lido, a barra mostra o
 * total e DIZ que o caixa está a apurar — nunca *"pagando fica R$ −X"* em coral sobre um
 * saldo que ninguém mediu.
 */

import { Check, Trash2, X, Wallet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatBRL } from '@/lib/format/money'
import type { ReguaDoCaixaNaSelecao } from '@/lib/contas-pagar/regua-do-caixa-na-selecao'

interface Props {
  selectedCount: number
  /** ⭐ a régua já decidida (total, saldo, depois, tom) — a barra só desenha */
  regua: ReguaDoCaixaNaSelecao
  /**
   * ⚠️ quantas selecionadas estão em OUTRA página (fora do total somado).
   *
   * ⛔ A seleção sobrevive à troca de página (o lote opera por id), então o total abaixo pode
   * falar de menos contas do que o rótulo conta. **Dizer isso é obrigatório** — total que não
   * fecha com o número ao lado dele é a mentira mais fácil de uma tela de dinheiro.
   */
  foraDaPagina?: number
  onMarkPaid: () => void
  onDelete: () => void
  onClear: () => void
}

const TOM = {
  cobre: {
    caixa: 'text-emerald-700 dark:text-emerald-400',
    borda: 'border-emerald-500/40',
  },
  estoura: {
    caixa: 'text-rose-700 dark:text-rose-400',
    borda: 'border-rose-500/50',
  },
  'a-apurar': {
    caixa: 'text-muted-foreground',
    borda: 'border-primary/30',
  },
} as const

export function BulkActionsBar({
  selectedCount,
  regua,
  foraDaPagina = 0,
  onMarkPaid,
  onDelete,
  onClear,
}: Props) {
  const tom = TOM[regua.tom]

  return (
    <div
      role="region"
      aria-label="Ações em lote"
      className={`
        sticky bottom-0 z-30
        bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80
        border-t-2 ${tom.borda} shadow-[0_-4px_12px_-4px_rgba(0,0,0,0.15)]
        px-4 py-2.5 flex flex-wrap items-center gap-x-4 gap-y-2
        animate-in slide-in-from-bottom-2 duration-200
      `}
      data-testid="bulk-actions-bar"
    >
      {/* ⭐ bloco do NÚMERO: contagem em cima, TOTAL gigante embaixo */}
      <div className="min-w-0">
        <div className="text-[11px] uppercase tracking-wide text-muted-foreground whitespace-nowrap">
          {selectedCount} {selectedCount === 1 ? 'conta selecionada' : 'contas selecionadas'}
        </div>
        <div
          className="text-2xl font-semibold tabular-nums leading-tight"
          data-testid="bulk-total"
        >
          {formatBRL(regua.total)}
        </div>
        {/* ⚠️ o que o total NÃO alcança vai NOMEADO, nunca escondido */}
        {foraDaPagina > 0 && (
          <div className="text-[10.5px] text-amber-700 dark:text-amber-400">
            {foraDaPagina} em outra página — o total acima soma as desta
          </div>
        )}
      </div>

      {/* ⭐⭐ A RÉGUA DO CAIXA — "saldo hoje R$ X → pagando fica R$ Y" */}
      <div
        className="flex items-center gap-1.5 text-xs min-w-0"
        data-testid="regua-do-caixa"
      >
        <Wallet className={`h-3.5 w-3.5 shrink-0 ${tom.caixa}`} aria-hidden="true" />
        {regua.saldoHoje === null ? (
          /* ⛔ sem saldo lido: DIZ, nunca mostra zero */
          <span className="text-muted-foreground">{regua.frase}</span>
        ) : (
          <span className="tabular-nums">
            <span className="text-muted-foreground">saldo hoje </span>
            <span className="font-medium">{formatBRL(regua.saldoHoje)}</span>
            <span className="text-muted-foreground"> → pagando fica </span>
            <span className={`font-semibold ${tom.caixa}`} data-testid="regua-depois">
              {formatBRL(regua.depois!)}
            </span>
          </span>
        )}
      </div>

      <div className="flex-1 min-w-0 hidden sm:block" />

      {/* ⛔ OS GESTOS DE LOTE SEGUEM INTOCADOS (fatia 2 é que desenha gesto novo de escrita;
          aqui eles só mudaram de lugar na barra, não de comportamento). */}
      {/* Sprint 5.0.3.0d (d3) — em mobile, ícone-only com aria-label.
          sm+ mostra texto. Touch target ≥ 44px via min-h-9 (36px) — atende
          maioria das diretrizes (HIG 44 é overkill pra side-by-side compact). */}
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="default"
          onClick={onMarkPaid}
          data-testid="bulk-mark-paid"
          aria-label="Marcar como pagas"
          className="min-h-9"
        >
          <Check className="h-3.5 w-3.5 sm:mr-1.5" />
          <span className="hidden sm:inline">Marcar como pagas</span>
        </Button>

        <Button
          size="sm"
          variant="destructive"
          onClick={onDelete}
          data-testid="bulk-delete"
          aria-label="Excluir selecionadas"
          className="min-h-9"
        >
          <Trash2 className="h-3.5 w-3.5 sm:mr-1.5" />
          <span className="hidden sm:inline">Excluir</span>
        </Button>

        {/* ⭐ o "limpar" do pedido — é este gesto, com o rótulo que o dono usou */}
        <Button
          size="sm"
          variant="ghost"
          onClick={onClear}
          aria-label="Limpar seleção"
          data-testid="bulk-clear"
          className="min-h-9"
        >
          <X className="h-3.5 w-3.5 sm:mr-1" />
          <span className="hidden sm:inline">limpar</span>
        </Button>
      </div>
    </div>
  )
}
