'use client'

// Sprint 5.0.3.0a — Filtros da /contas-a-pagar (versão CORE).
//
// Esta sub-sprint inclui filtros essenciais:
//   - Busca textual (debounce 300ms no callsite)
//   - Período: De/Até via input[type=date] HTML
//   - Status: select (TODOS/PENDING/RECONCILED/IGNORED)
//   - Toggle "Só vencidas"
//   - Botão "Limpar filtros" (aparece quando há filtros ativos)
//
// 5.0.3.0b adiciona: dataField select, multi-select supplier/categoria, valor range.
// 5.0.3.0c adiciona: forma pagamento, banco, NFe, recorrente.

import { Search, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { DateRangeFilter } from '@/components/shared/DateRangeFilter'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ROTULO_PAGAS, ROTULO_TODOS, ROTULO_RECORTE } from '@/lib/contas-pagar/rotulos'
import { ehFluxo, type EscopoDaLista } from '@/lib/contas-pagar/escopo'
import type { FaixaDoTempo } from '@/lib/contas-pagar/faixa-do-tempo'

export interface PayableFilterState {
  q: string
  dataDe: string // YYYY-MM-DD
  dataAte: string
  status: 'TODOS' | 'PENDING' | 'RECONCILED' | 'IGNORED'
  /**
   * ⭐ o recorte dos cards — `undefined` = a tela inteira (13/09).
   *
   * ⚠️ O tipo **DERIVA** de `EscopoDaLista` em vez de reenumerar: foi a lista escrita à mão
   * que deixou os campos mortos do «a vencer (3d)» vivos no tipo por 13 dias.
   */
  escopo?: EscopoDaLista
  /**
   * ⭐ a FAIXA DO TEMPO do chip do topo — `undefined` = todas (21/10).
   *
   * ⚠️ O tipo **DERIVA** de `FaixaDoTempo`, nunca reenumerado aqui: foi a lista escrita à
   * mão que deixou os campos mortos do «a vencer (3d)» vivos no tipo por 13 dias.
   */
  faixa?: FaixaDoTempo
  vencidasOnly: boolean
}

export const EMPTY_FILTERS: PayableFilterState = {
  q: '',
  dataDe: '',
  dataAte: '',
  status: 'PENDING',
  vencidasOnly: false,
}

export function isFilterActive(f: PayableFilterState): boolean {
  return (
    !!f.q.trim() ||
    !!f.dataDe ||
    !!f.dataAte ||
    f.status !== 'PENDING' ||
    // ⚠️ a faixa conta como filtro ATIVO — senão o "limpar" não oferece saída de uma lista
    // recortada por chip, e o dono fica sem caminho de volta (a porta sem maçaneta)
    !!f.faixa ||
    f.vencidasOnly
  )
}

interface Props {
  value: PayableFilterState
  onChange: (next: PayableFilterState) => void
  onClear: () => void
  total: number
}

export function PayableFilters({ value, onChange, onClear, total }: Props) {
  const active = isFilterActive(value)

  return (
    <div className="flex flex-wrap items-center gap-2" data-testid="filters-bar">
      {/* Busca */}
      <div className="relative flex-1 min-w-[200px] max-w-md">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Buscar fornecedor, descrição, nota..."
          value={value.q}
          onChange={(e) => onChange({ ...value, q: e.target.value })}
          className="pl-7 h-9 text-sm"
          data-testid="filter-q"
          aria-label="Busca textual"
        />
      </div>

      {/* Período (Sprint Filtro de Data Parte B): DateRangeFilter compartilhado
          + dateField=dueDate (semântica de contas a pagar). Mantém state local
          dataDe/dataAte pra não quebrar consumers. */}
      <DateRangeFilter
        value={{ inicio: value.dataDe, fim: value.dataAte }}
        onChange={(r) => onChange({ ...value, dataDe: r.inicio, dataAte: r.fim })}
        dateField="dueDate"
        label="Vencimento"
      />

      {/*
        ⭐⭐ 26/09 — SOB UM ESCOPO DE PAGAS, ESTE CONTROLE PERGUNTA O **RECORTE**, não o status.
        ⛔ Deixar o de status ali faria a tela dizer *"Em aberto e pagas sem vínculo"* com as
        conciliadas na lista — a mentira que os rótulos de 13/09 existem pra não contar.
        ⭐ E é aqui que moram as duas sub-opções que o dono pediu.
      */}
      {value.escopo && ehFluxo(value.escopo) ? (
        <Select
          value={value.escopo}
          onValueChange={(v) => onChange({ ...value, escopo: v as EscopoDaLista })}
        >
          <SelectTrigger
            className="w-auto min-w-[200px] h-9 text-sm"
            data-testid="filter-recorte-pagas"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="PAGA">{ROTULO_RECORTE.PAGA}</SelectItem>
            <SelectItem value="PAGA_CONCILIADA">{ROTULO_RECORTE.PAGA_CONCILIADA}</SelectItem>
            <SelectItem value="PAGA_SEM_VINCULO">{ROTULO_RECORTE.PAGA_SEM_VINCULO}</SelectItem>
          </SelectContent>
        </Select>
      ) : (
      /* Status */
      <Select
        value={value.status}
        onValueChange={(v) =>
          onChange({ ...value, status: v as PayableFilterState['status'] })
        }
      >
        <SelectTrigger
          className="w-auto min-w-[140px] h-9 text-sm"
          data-testid="filter-status"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="PENDING">Pendentes</SelectItem>
          {/* ⛔ dizia "Conciliadas" e era o PIOR rótulo da tela: filtra `status=RECONCILED`
              (paga/categorizada) e o escopo EXCLUI justamente as conciliadas com o extrato.
              Ver `lib/contas-pagar/rotulos.ts`. */}
          <SelectItem value="RECONCILED">{ROTULO_PAGAS}</SelectItem>
          <SelectItem value="IGNORED">Ignoradas</SelectItem>
          <SelectItem value="TODOS">{ROTULO_TODOS}</SelectItem>
        </SelectContent>
      </Select>
      )}

      {/**
       * ⛔⛔ O CHECKBOX **"Só vencidas" MORREU** (21/10, item 2 do dono): *"o cartão VENCIDAS
       * já filtra o mesmo"*. Eram **dois controles pra uma pergunta** — e o pior tipo, porque
       * marcar o checkbox COM um cartão de faixa ligado recortava por duas réguas e a lista
       * mostrava menos do que o cartão prometia (a divergência de 13/09).
       *
       * ⚠️ **O CAMPO `vencidasOnly` FICA** no tipo e no backend, de propósito: link antigo com
       * `?vencidasOnly=true` (print, e-mail, histórico) continua funcionando e aparece como
       * filtro ativo com o "limpar" ao lado. *Link velho não vira 404 silencioso* — o que
       * morreu é o CONTROLE, nunca o caminho.
       */}
      <div className="flex-1" />

      {/* Total + limpar */}
      <span className="text-xs text-muted-foreground tabular-nums">
        {total} {total === 1 ? 'conta' : 'contas'}
      </span>

      {active && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onClear}
          className="h-8"
          data-testid="filters-clear"
        >
          <X className="h-3.5 w-3.5 mr-1" />
          Limpar
        </Button>
      )}
    </div>
  )
}
