'use client'

import { useEffect, useMemo, useState, useCallback } from 'react'
import {
  ArrowUpRight,
  ArrowDownRight,
  Check,
  X,
  Loader2,
  Search,
  Filter,
  PartyPopper,
} from 'lucide-react'
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
}

interface Props {
  empresaId: string
  empresaNome: string
  categorias: Categoria[]
}

export function PendentesClient({ empresaId, empresaNome, categorias }: Props) {
  const { toast } = useToast()

  const [transacoes, setTransacoes] = useState<Transacao[]>([])
  const [loading, setLoading] = useState(true)

  // Estado de seleção de categoria por linha (id da transação → id da categoria escolhida)
  const [selecaoPorLinha, setSelecaoPorLinha] = useState<Record<string, string>>({})
  // Linhas com operação em andamento (salvar/ignorar)
  const [operandoIds, setOperandoIds] = useState<Set<string>>(new Set())

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
      setTransacoes(data.transacoes ?? [])
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

  async function salvarCategoria(transacaoId: string) {
    const categoriaId = selecaoPorLinha[transacaoId]
    if (!categoriaId) return

    marcarOperando(transacaoId, true)
    try {
      const res = await fetch(`/api/transacoes/${transacaoId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categoryId: categoriaId }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        toast({ variant: 'destructive', title: 'Erro ao salvar', description: data.erro ?? 'Tente novamente.' })
        return
      }
      // Remove da lista (agora tem categoria)
      setTransacoes((prev) => prev.filter((t) => t.id !== transacaoId))
      setSelecaoPorLinha((prev) => {
        const next = { ...prev }
        delete next[transacaoId]
        return next
      })
      toast({ variant: 'success', title: 'Classificada', description: 'Transação categorizada com sucesso.' })
    } catch {
      toast({ variant: 'destructive', title: 'Erro', description: 'Falha de rede ao salvar.' })
    } finally {
      marcarOperando(transacaoId, false)
    }
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
    </div>
  )
}
