'use client'

import { useEffect, useMemo, useState, useCallback } from 'react'
import {
  ArrowUpRight,
  ArrowDownRight,
  ArrowLeftRight,
  Check,
  X,
  Loader2,
  Search,
  Filter,
  PartyPopper,
} from 'lucide-react'
import { VincularTransferenciaModal } from '@/components/pendentes/VincularTransferenciaModal'
import { AprenderEAplicarModal } from '@/components/pendentes/AprenderEAplicarModal'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Header } from '@/components/layout/header'
import { useToast } from '@/components/ui/use-toast'
import { formatBRL } from '@/lib/format/money'

interface Categoria {
  id: string
  name: string
  // INCOME | EXPENSE | TRANSFER
  type: string
  color: string
}

interface Transacao {
  id: string
  description: string
  amount: number
  type: 'CREDIT' | 'DEBIT'
  date: string
  bankAccount: {
    id: string
    name: string
    bankName: string | null
  }
  // Fase 3 Etapa 2: supplier detectado (Camada 2A keyword / 2B BrasilAPI)
  supplier?: {
    id: string
    razaoSocial: string
    nomeFantasia: string | null
    fonte: string
    category: { id: string; name: string } | null
  } | null
}

interface Props {
  empresaId: string
  empresaNome: string
  categorias: Categoria[]
  // Fase 3 Etapa 1+2: stats injetadas pelo server pra header
  stats?: {
    autoClassificadasHoje: number
    regrasAtivas: number
    fornecedoresDetectados: number
  }
}

export function PendentesClient({
  empresaId,
  empresaNome,
  categorias,
  stats,
}: Props) {
  const { toast } = useToast()

  const [transacoes, setTransacoes] = useState<Transacao[]>([])
  const [loading, setLoading] = useState(true)

  // Estado de seleção de categoria por linha (id da transação → id da categoria escolhida)
  const [selecaoPorLinha, setSelecaoPorLinha] = useState<Record<string, string>>({})
  // Linhas com operação em andamento (salvar/ignorar)
  const [operandoIds, setOperandoIds] = useState<Set<string>>(new Set())
  // Transação selecionada pra modal "Vincular como transferência" (Sprint 1.7)
  const [vincularBase, setVincularBase] = useState<Transacao | null>(null)
  // Fase 3 Etapa 1: transação + categoria pra modal "Aprender e aplicar"
  const [aprenderState, setAprenderState] = useState<
    { tx: Transacao; categoria: Categoria } | null
  >(null)

  // Filtros
  const noventaDiasAtras = useMemo(() => {
    const d = new Date()
    d.setDate(d.getDate() - 90)
    return d.toISOString().split('T')[0]
  }, [])
  const hoje = useMemo(() => new Date().toISOString().split('T')[0], [])
  const [inicio, setInicio] = useState(noventaDiasAtras)
  const [fim, setFim] = useState(hoje)
  const [tipo, setTipo] = useState<'TODOS' | 'CREDIT' | 'DEBIT'>('TODOS')
  const [busca, setBusca] = useState('')

  const fetchTransacoes = useCallback(async () => {
    setLoading(true)
    try {
      const qs = new URLSearchParams({
        empresaId,
        semCategoria: 'true',
        limit: '500',
      })
      if (inicio) qs.set('inicio', inicio)
      if (fim) qs.set('fim', fim)
      if (tipo !== 'TODOS') qs.set('tipo', tipo)
      // Excluir transações já marcadas como ignoradas
      // O endpoint aceita um único `status`, então buscamos só PENDING (default das importadas)
      qs.set('status', 'PENDING')

      const res = await fetch(`/api/transacoes?${qs}`)
      if (!res.ok) {
        toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível carregar transações.' })
        return
      }
      const data = await res.json()
      const txs: Transacao[] = data.transacoes ?? []
      setTransacoes(txs)
      // Fase 3 Etapa 2: pre-fill do dropdown quando supplier tem categoria sugerida
      setSelecaoPorLinha((prev) => {
        const next = { ...prev }
        for (const t of txs) {
          if (!next[t.id] && t.supplier?.category) {
            next[t.id] = t.supplier.category.id
          }
        }
        return next
      })
    } catch {
      toast({ variant: 'destructive', title: 'Erro', description: 'Falha de rede ao carregar transações.' })
    } finally {
      setLoading(false)
    }
  }, [empresaId, inicio, fim, tipo, toast])

  useEffect(() => { fetchTransacoes() }, [fetchTransacoes])

  // Categorias compatíveis com o tipo da transação:
  // CREDIT (entrada) → INCOME ou TRANSFER
  // DEBIT (saída) → EXPENSE ou TRANSFER
  function categoriasParaTransacao(tipoTx: 'CREDIT' | 'DEBIT'): Categoria[] {
    if (tipoTx === 'CREDIT') return categorias.filter((c) => c.type === 'INCOME' || c.type === 'TRANSFER')
    return categorias.filter((c) => c.type === 'EXPENSE' || c.type === 'TRANSFER')
  }

  // Filtro client-side por busca (descrição). Período/tipo já vêm filtrados do servidor.
  const transacoesFiltradas = useMemo(() => {
    const q = busca.trim().toLowerCase()
    if (!q) return transacoes
    return transacoes.filter((t) => t.description.toLowerCase().includes(q))
  }, [transacoes, busca])

  function marcarOperando(id: string, on: boolean) {
    setOperandoIds((prev) => {
      const next = new Set(prev)
      if (on) next.add(id); else next.delete(id)
      return next
    })
  }

  // Fase 3 Etapa 1: ao clicar ✓, em vez de PUT direto, abre modal de
  // "Aprender e aplicar" que checa transações similares + permite criar regra.
  function salvarCategoria(transacaoId: string) {
    const categoriaId = selecaoPorLinha[transacaoId]
    if (!categoriaId) return
    const tx = transacoes.find((t) => t.id === transacaoId)
    const categoria = categorias.find((c) => c.id === categoriaId)
    if (!tx || !categoria) return
    setAprenderState({ tx, categoria })
  }

  async function ignorarTransacao(transacaoId: string) {
    marcarOperando(transacaoId, true)
    try {
      const res = await fetch(`/api/transacoes/${transacaoId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'IGNORED' }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        toast({ variant: 'destructive', title: 'Erro ao ignorar', description: data.erro ?? 'Tente novamente.' })
        return
      }
      setTransacoes((prev) => prev.filter((t) => t.id !== transacaoId))
      setSelecaoPorLinha((prev) => {
        const next = { ...prev }
        delete next[transacaoId]
        return next
      })
      toast({ title: 'Transação ignorada', description: 'Removida da fila de pendentes.' })
    } catch {
      toast({ variant: 'destructive', title: 'Erro', description: 'Falha de rede ao ignorar.' })
    } finally {
      marcarOperando(transacaoId, false)
    }
  }

  return (
    <div className="space-y-6">
      <Header
        title="Pendentes de Classificação"
        description={`${transacoesFiltradas.length} transação${transacoesFiltradas.length !== 1 ? 'ões' : ''} em ${empresaNome}`}
      />

      {/* Fase 3 Etapas 1+2: stats da IA Contadora */}
      {stats &&
        (stats.autoClassificadasHoje > 0 ||
          stats.regrasAtivas > 0 ||
          stats.fornecedoresDetectados > 0) && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-md border bg-primary/5 border-primary/20 px-3 py-2 text-xs">
          {stats.autoClassificadasHoje > 0 && (
            <span className="flex items-center gap-1.5">
              <span className="text-base leading-none">🤖</span>
              <strong className="tabular-nums">{stats.autoClassificadasHoje}</strong>
              <span className="text-muted-foreground">
                {stats.autoClassificadasHoje === 1
                  ? 'transação auto-classificada hoje'
                  : 'transações auto-classificadas hoje'}
              </span>
            </span>
          )}
          {stats.regrasAtivas > 0 && (
            <span className="flex items-center gap-1.5">
              <span className="text-muted-foreground">·</span>
              <strong className="tabular-nums">{stats.regrasAtivas}</strong>
              <span className="text-muted-foreground">
                {stats.regrasAtivas === 1
                  ? 'regra aprendida'
                  : 'regras aprendidas'}
              </span>
            </span>
          )}
          {stats.fornecedoresDetectados > 0 && (
            <span className="flex items-center gap-1.5">
              <span className="text-muted-foreground">·</span>
              <span className="text-base leading-none">💼</span>
              <strong className="tabular-nums">{stats.fornecedoresDetectados}</strong>
              <span className="text-muted-foreground">
                {stats.fornecedoresDetectados === 1
                  ? 'fornecedor detectado'
                  : 'fornecedores detectados'}
              </span>
            </span>
          )}
        </div>
      )}

      {/* Filtros */}
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-wrap items-end gap-3">
            <Filter className="h-4 w-4 text-muted-foreground mt-auto mb-1 shrink-0" />

            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">De</p>
              <Input type="date" className="h-8 w-36 text-sm" value={inicio} onChange={(e) => setInicio(e.target.value)} />
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Até</p>
              <Input type="date" className="h-8 w-36 text-sm" value={fim} onChange={(e) => setFim(e.target.value)} />
            </div>

            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Tipo</p>
              <Select value={tipo} onValueChange={(v) => setTipo(v as typeof tipo)}>
                <SelectTrigger className="h-8 w-32 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="TODOS">Todos</SelectItem>
                  <SelectItem value="CREDIT">Entradas</SelectItem>
                  <SelectItem value="DEBIT">Saídas</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1 flex-1 min-w-[200px]">
              <p className="text-xs text-muted-foreground">Buscar na descrição</p>
              <div className="relative">
                <Search className="absolute left-2.5 top-2 h-4 w-4 text-muted-foreground" />
                <Input
                  className="h-8 pl-8 text-sm"
                  placeholder="Ex: PIX, STONE, ALUGUEL..."
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lista */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => <div key={i} className="h-16 rounded-lg border bg-muted animate-pulse" />)}
        </div>
      ) : transacoesFiltradas.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-center">
          <PartyPopper className="h-12 w-12 text-green-500 mb-4" />
          <h3 className="font-semibold text-lg">
            {busca || tipo !== 'TODOS'
              ? 'Nenhuma transação corresponde aos filtros'
              : 'Nenhuma transação pendente nesta empresa'}
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            {busca || tipo !== 'TODOS'
              ? 'Tente alterar os filtros acima.'
              : 'Tudo classificado por aqui.'}
          </p>
        </div>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          {transacoesFiltradas.map((t, i) => {
            const cats = categoriasParaTransacao(t.type)
            const operando = operandoIds.has(t.id)
            const selecionada = selecaoPorLinha[t.id]

            return (
              <div
                key={t.id}
                className={`flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center ${i > 0 ? 'border-t' : ''}`}
              >
                {/* Ícone + descrição + meta */}
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  <div className={`shrink-0 flex h-9 w-9 items-center justify-center rounded-full ${
                    t.type === 'CREDIT' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
                  }`}>
                    {t.type === 'CREDIT' ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{t.description}</p>
                    {/* Fase 3 Etapa 2: badge fornecedor (Camada 2A keyword / 2B BrasilAPI) */}
                    {t.supplier && (
                      <span
                        className={`inline-flex items-center gap-1 mt-0.5 text-xs rounded px-1.5 py-0.5 border ${
                          t.supplier.fonte === 'BRASILAPI'
                            ? 'border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-200'
                            : 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900 dark:bg-sky-950 dark:text-sky-200'
                        }`}
                        title={
                          t.supplier.fonte === 'BRASILAPI'
                            ? 'Detectado via consulta CNPJ na BrasilAPI'
                            : 'Detectado por palavra-chave (Conta IA)'
                        }
                      >
                        💼{' '}
                        {t.supplier.fonte === 'BRASILAPI'
                          ? 'BrasilAPI'
                          : 'Detectado'}
                        : <strong className="font-semibold">{t.supplier.razaoSocial}</strong>
                        {t.supplier.category && (
                          <span className="opacity-80">
                            → {t.supplier.category.name}
                          </span>
                        )}
                      </span>
                    )}
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {new Date(t.date).toLocaleDateString('pt-BR')}
                      {' · '}
                      <span className={t.type === 'CREDIT' ? 'text-green-600' : 'text-red-600'}>
                        {t.type === 'CREDIT' ? '+' : '−'} {formatBRL(t.amount)}
                      </span>
                      {' · '}
                      {t.bankAccount.bankName ?? 'Banco?'} / {t.bankAccount.name}
                    </p>
                  </div>
                </div>

                {/* Select de categoria */}
                <div className="flex items-center gap-2 shrink-0">
                  <Select
                    value={selecionada ?? ''}
                    onValueChange={(v) => setSelecaoPorLinha((prev) => ({ ...prev, [t.id]: v }))}
                    disabled={operando}
                  >
                    <SelectTrigger className="h-8 w-56 text-sm">
                      <SelectValue placeholder="Escolher categoria..." />
                    </SelectTrigger>
                    <SelectContent>
                      {cats.length === 0 ? (
                        <div className="px-2 py-1.5 text-xs text-muted-foreground">
                          Nenhuma categoria {t.type === 'CREDIT' ? 'de entrada' : 'de saída'} cadastrada.
                        </div>
                      ) : (
                        cats.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            <div className="flex items-center gap-2">
                              <span
                                className="inline-block h-2.5 w-2.5 rounded-full"
                                style={{ backgroundColor: c.color }}
                              />
                              {c.name}
                            </div>
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>

                  {/* Botão "✓" salvar — Enter no foco também aciona */}
                  <Button
                    size="sm"
                    variant="default"
                    onClick={() => salvarCategoria(t.id)}
                    disabled={operando || !selecionada}
                    title="Salvar categoria (Enter)"
                  >
                    {operando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                  </Button>

                  {/* Botão "↔ É transferência" — Sprint 1.7. Pareia com tx em outra conta. */}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setVincularBase(t)}
                    disabled={operando}
                    title="É parte de uma transferência entre suas contas"
                    className="gap-1.5"
                  >
                    <ArrowLeftRight className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline text-xs">É transferência</span>
                  </Button>

                  {/* Botão "Ignorar" */}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => ignorarTransacao(t.id)}
                    disabled={operando}
                    title="Ignorar transação"
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <VincularTransferenciaModal
        open={!!vincularBase}
        onOpenChange={(o) => !o && setVincularBase(null)}
        base={
          vincularBase
            ? {
                id: vincularBase.id,
                description: vincularBase.description,
                amount: vincularBase.amount,
                type: vincularBase.type,
                date: vincularBase.date,
                bankAccount: vincularBase.bankAccount,
              }
            : null
        }
        onSuccess={({ idA, idB }) => {
          // Ambas as transações foram apagadas e viraram par TRANSFER —
          // remove as 2 da lista local otimisticamente
          setTransacoes((prev) => prev.filter((t) => t.id !== idA && t.id !== idB))
          setVincularBase(null)
        }}
      />

      <AprenderEAplicarModal
        open={!!aprenderState}
        onOpenChange={(o) => !o && setAprenderState(null)}
        base={
          aprenderState
            ? {
                id: aprenderState.tx.id,
                description: aprenderState.tx.description,
              }
            : null
        }
        categoria={
          aprenderState
            ? { id: aprenderState.categoria.id, name: aprenderState.categoria.name }
            : null
        }
        onApplied={({ affectedTxIds }) => {
          // Remove tudo que foi classificado da lista local (base + similares
          // do preview). O DB tem mais (até todas as similares); o user vê
          // o preview removido imediatamente. Refetch pra puxar o resto.
          setTransacoes((prev) =>
            prev.filter((t) => !affectedTxIds.includes(t.id)),
          )
          setSelecaoPorLinha((prev) => {
            const next = { ...prev }
            affectedTxIds.forEach((id) => delete next[id])
            return next
          })
          // Refetch async — pega as similares que não estavam no preview
          fetchTransacoes()
        }}
      />
    </div>
  )
}
