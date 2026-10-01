'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { CategoryCombobox } from '@/components/transacoes/category-combobox'
import { useToast } from '@/components/ui/use-toast'

interface Category { id: string; name: string; color: string; type: string; dreGroup?: string | null }
interface Conta { id: string; name: string; bankName?: string | null; accountType?: string | null }

interface TransacaoFormProps {
  contaId: string
  empresaId: string
  categories: Category[]
  /** ⭐ 30/09: as contas da empresa, pra consertar conta errada sem apagar o lançamento */
  contas?: Conta[]
  /**
   * ⭐ o veredito vem do SERVIDOR (`podeMoverDeConta`), nunca de régua da tela — senão a
   * tela habilitaria o campo num caso que o PUT recusa, e o dono clicaria pra levar um "não".
   */
  podeTrocarConta?: boolean
  motivoContaTravada?: string | null
  /** ⭐ 30/09: o veredito do EXCLUIR, do MESMO servidor que a rota consulta */
  podeExcluir?: boolean
  motivoExcluirTravado?: string | null
  transacao?: {
    id: string
    description: string
    amount: number
    type: string
    date: string
    categoryId?: string | null
    notes?: string | null
    status: string
    bankAccountId?: string
  }
}

export function TransacaoForm({
  contaId,
  empresaId,
  categories,
  contas = [],
  podeTrocarConta = false,
  motivoContaTravada = null,
  podeExcluir = false,
  motivoExcluirTravado = null,
  transacao,
}: TransacaoFormProps) {
  const router = useRouter()
  const { toast } = useToast()
  const isEditing = !!transacao

  const today = new Date().toISOString().split('T')[0]

  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [form, setForm] = useState({
    description: transacao?.description ?? '',
    amount: transacao?.amount?.toString() ?? '',
    type: transacao?.type ?? 'DEBIT',
    date: transacao?.date ? transacao.date.split('T')[0] : today,
    categoryId: transacao?.categoryId ?? '',
    notes: transacao?.notes ?? '',
    status: transacao?.status ?? 'PENDING',
    bankAccountId: transacao?.bankAccountId ?? contaId,
  })
  /**
   * ⭐ o que o SERVIDOR devolveu sobre a mudança de conta. A competência de venda é POR
   * CONTA (dinheiro no cofre é D+1 corrido, PIX na Stone é D+0), então a mesma venda pode
   * valer por outro dia. Mexer no calendário em silêncio seria a família do "gravou e não
   * disse" — aqui a tela DIZ, depois de gravar, com os dois dias na frente.
   */
  const [mudouDeConta, setMudouDeConta] = useState<{
    rastro: string
    competencia: { antes: { inicio: string | null }; depois: { inicio: string | null }; mudou: boolean }
  } | null>(null)
  /**
   * ⭐⭐ A CONFIRMAÇÃO DO EXCLUIR — LEVE, e o peso é proporcional ao estrago.
   *
   * ⛔ Não é `confirm()` nativo: ele **falhou em silêncio no Safari** em fluxo async (a
   * cicatriz de 22/08, e de novo em 23/09 no reprocessar do dia). É um estado nosso.
   *
   * ⚠️ Leve porque a alternativa (digitar o valor, digitar o nome) afasta de um gesto que o
   * dono vai fazer com frequência — errar a conta e errar o lançamento são rotina. O que
   * segura é a frase dizer **o efeito** e o motivo ir pro rastro, não a cerimônia.
   */
  const [confirmandoExcluir, setConfirmandoExcluir] = useState(false)
  const [motivoExcluir, setMotivoExcluir] = useState('')
  const [excluindo, setExcluindo] = useState(false)

  function set(field: string, value: string) {
    setForm((p) => ({ ...p, [field]: value }))
    if (errors[field]) setErrors((p) => ({ ...p, [field]: '' }))
  }

  const catsFiltradas = categories.filter((c) => {
    if (form.type === 'CREDIT') return c.type === 'INCOME' || c.type === 'TRANSFER'
    if (form.type === 'DEBIT') return c.type === 'EXPENSE' || c.type === 'TRANSFER'
    return true
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setErrors({})

    try {
      const url = isEditing ? `/api/transacoes/${transacao.id}` : '/api/transacoes'
      const method = isEditing ? 'PUT' : 'POST'

      const body = {
        // ⭐ 30/09: na EDIÇÃO a conta vai no corpo quando ela pode mudar — quem valida é o
        // servidor. Quando não pode, o campo nem é enviado (nada a pedir).
        ...(!isEditing
          ? { bankAccountId: contaId }
          : podeTrocarConta && form.bankAccountId !== transacao?.bankAccountId
            ? { bankAccountId: form.bankAccountId }
            : {}),
        description: form.description,
        amount: parseFloat(form.amount) || 0,
        type: form.type,
        date: new Date(form.date).toISOString(),
        categoryId: form.categoryId || null,
        notes: form.notes || null,
        status: form.status,
      }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      const data = await res.json()

      if (!res.ok) {
        if (data.campos) { setErrors(data.campos); return }
        toast({ variant: 'destructive', title: 'Erro', description: data.erro })
        return
      }

      /**
       * ⭐⭐ A MUDANÇA DE CONTA NÃO NAVEGA EMBORA EM SILÊNCIO.
       *
       * ⚠️ Ela mexe em DUAS contas e pode mexer no dia da venda no calendário. Sair da tela
       * com um "Sucesso!" genérico esconderia os dois efeitos — e o dono descobriria o dia
       * mudado semanas depois, no relatório. Fica na tela, dizendo o que aconteceu, e o
       * "voltar pra lista" é dele.
       */
      if (data.mudancaDeConta) {
        setMudouDeConta({
          rastro: data.mudancaDeConta.rastro,
          competencia: data.mudancaDeConta.competencia,
        })
        toast({ variant: 'success', title: 'Conta trocada', description: data.mudancaDeConta.rastro })
        router.refresh()
        return
      }

      toast({ variant: 'success', title: 'Sucesso', description: isEditing ? 'Transação atualizada!' : 'Transação lançada!' })
      router.push(`/empresas/${empresaId}/contas/${contaId}/transacoes`)
      router.refresh()
    } catch {
      toast({ variant: 'destructive', title: 'Erro', description: 'Erro interno. Tente novamente.' })
    } finally {
      setLoading(false)
    }
  }

  async function excluir() {
    setExcluindo(true)
    try {
      const qs = motivoExcluir.trim() ? `?motivo=${encodeURIComponent(motivoExcluir.trim())}` : ''
      const res = await fetch(`/api/transacoes/${transacao!.id}${qs}`, { method: 'DELETE' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        // ⚠️ a recusa do servidor é MOSTRADA com o motivo dele — nunca um "erro" genérico
        toast({ variant: 'destructive', title: 'Não excluí', description: data.erro ?? 'Falha ao excluir.' })
        return
      }
      toast({ variant: 'success', title: 'Excluído', description: 'o saldo da conta foi recalculado pela régua' })
      router.push(`/empresas/${empresaId}/contas/${contaId}/transacoes`)
      router.refresh()
    } catch {
      toast({ variant: 'destructive', title: 'Erro', description: 'Não consegui falar com o servidor. Nada foi excluído.' })
    } finally {
      setExcluindo(false)
      setConfirmandoExcluir(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardHeader><CardTitle className="text-base">Dados do Lançamento</CardTitle></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          {/* Tipo */}
          <div className="space-y-2">
            <Label>Tipo <span className="text-destructive">*</span></Label>
            <div className="flex gap-2">
              {(['CREDIT', 'DEBIT'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => { set('type', t); set('categoryId', '') }}
                  className={`flex-1 rounded-lg border py-2 text-sm font-medium transition-colors ${
                    form.type === t
                      ? t === 'CREDIT'
                        ? 'bg-green-100 border-green-500 text-green-800 dark:bg-green-900/30 dark:border-green-600 dark:text-green-300'
                        : 'bg-red-100 border-red-500 text-red-800 dark:bg-red-900/30 dark:border-red-600 dark:text-red-300'
                      : 'border-input bg-background hover:bg-muted'
                  }`}
                >
                  {t === 'CREDIT' ? '+ Entrada' : '− Saída'}
                </button>
              ))}
            </div>
          </div>

          {/* ⭐ CONTA (30/09/2026) — só na edição; no lançamento novo a conta é a da tela. */}
          {isEditing && contas.length > 0 && (
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="bankAccountId">Conta</Label>
              {podeTrocarConta ? (
                <>
                  <Select value={form.bankAccountId} onValueChange={(v) => set('bankAccountId', v)}>
                    <SelectTrigger id="bankAccountId"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {contas.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}{c.bankName ? ` · ${c.bankName}` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {form.bankAccountId !== transacao?.bankAccountId && (
                    <p className="text-xs text-amber-700 dark:text-amber-400">
                      ao salvar, o saldo das duas contas é recalculado e a troca fica registrada no histórico
                    </p>
                  )}
                </>
              ) : (
                /* ⛔ TRAVADO COM O MOTIVO ESCRITO, nunca escondido: esconder o campo tira a
                   explicação junto, e o dono fica sem saber por que não dá — foi a lição
                   do "desativar" que não oferecia "sumir" no Catálogo. */
                <div className="rounded-lg border border-input bg-muted/40 px-3 py-2">
                  <p className="text-sm font-medium">
                    {contas.find((c) => c.id === (transacao?.bankAccountId ?? contaId))?.name ?? '—'}
                  </p>
                  {motivoContaTravada && (
                    <p className="text-xs text-muted-foreground mt-1">🔒 {motivoContaTravada}</p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Data */}
          <div className="space-y-2">
            <Label htmlFor="date">Data <span className="text-destructive">*</span></Label>
            <Input id="date" type="date" value={form.date} onChange={(e) => set('date', e.target.value)} />
            {errors.date && <p className="text-xs text-destructive">{errors.date}</p>}
          </div>

          {/* Descrição */}
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="description">Descrição <span className="text-destructive">*</span></Label>
            <Input id="description" placeholder="Ex: Pagamento de fornecedor" value={form.description} onChange={(e) => set('description', e.target.value)} />
            {errors.description && <p className="text-xs text-destructive">{errors.description}</p>}
          </div>

          {/* Valor */}
          <div className="space-y-2">
            <Label htmlFor="amount">Valor (R$) <span className="text-destructive">*</span></Label>
            <Input id="amount" type="number" step="0.01" min="0.01" placeholder="0,00" value={form.amount} onChange={(e) => set('amount', e.target.value)} />
            {errors.amount && <p className="text-xs text-destructive">{errors.amount}</p>}
          </div>

          {/* Categoria — Sprint Category-Combobox (29/06/2026):
              CategoryCombobox único. Busca sem acento, agrupado dreGroup, teclado. */}
          <div className="space-y-2">
            <Label htmlFor="categoryId">Categoria</Label>
            <CategoryCombobox
              value={form.categoryId || null}
              categorias={catsFiltradas.map((c) => ({
                id: c.id,
                name: c.name,
                color: c.color,
                dreGroup: c.dreGroup ?? null,
              }))}
              onChange={(v) => set('categoryId', v ?? '')}
              placeholder="Sem categoria"
              ariaLabel="Categoria da transação"
              className="h-9 w-full justify-between border-input"
            />
          </div>

          {/* Status */}
          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <Select value={form.status} onValueChange={(v) => set('status', v)}>
              <SelectTrigger id="status"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="PENDING">Pendente</SelectItem>
                <SelectItem value="RECONCILED">Conciliado</SelectItem>
                <SelectItem value="IGNORED">Ignorado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Observações */}
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="notes">Observações</Label>
            <Textarea id="notes" placeholder="Informações adicionais..." rows={2} value={form.notes} onChange={(e) => set('notes', e.target.value)} />
          </div>
        </CardContent>
      </Card>

      {mudouDeConta && (
        <Card className="border-emerald-400 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-950/30">
          <CardContent className="py-4 space-y-1">
            <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-200">
              ✓ {mudouDeConta.rastro}
            </p>
            <p className="text-xs text-emerald-800 dark:text-emerald-300">
              o saldo das duas contas foi recalculado pela régua do banco (não somado) e a troca
              está no histórico do lançamento.
            </p>
            {/* ⭐ O DIA DA VENDA ANDOU? É a pergunta que a troca de conta levanta, e ela só
                tem resposta do servidor (a régua de recebimento é por conta). */}
            {mudouDeConta.competencia.mudou ? (
              <p className="text-xs font-medium text-amber-800 dark:text-amber-300">
                ⚠️ no calendário de vendas, esta entrada mudou de dia:{' '}
                {mudouDeConta.competencia.antes.inicio ?? '—'} → {mudouDeConta.competencia.depois.inicio ?? '—'}{' '}
                (a régua de recebimento é por conta)
              </p>
            ) : (
              <p className="text-xs text-emerald-800/80 dark:text-emerald-300/80">
                o dia no calendário de vendas não mudou.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* ⭐ EXCLUIR (30/09) — só na edição, e travado com o motivo quando não pode */}
      {isEditing && (
        <Card className="border-rose-200 dark:border-rose-900/60">
          <CardContent className="py-4">
            {!podeExcluir ? (
              <div>
                <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Excluir lançamento</p>
                {/* ⛔ TRAVADO COM O MOTIVO, nunca escondido: esconder tira a explicação junto */}
                <p className="text-xs text-muted-foreground mt-1">🔒 {motivoExcluirTravado}</p>
              </div>
            ) : !confirmandoExcluir ? (
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-rose-700 dark:text-rose-300">Excluir lançamento</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    o saldo da conta é recalculado pela régua e a exclusão fica no histórico
                  </p>
                </div>
                <Button type="button" variant="outline" size="sm"
                  className="border-rose-300 text-rose-700 hover:bg-rose-50 dark:border-rose-800 dark:text-rose-300"
                  onClick={() => setConfirmandoExcluir(true)} disabled={loading || excluindo}>
                  Excluir
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm font-semibold text-rose-800 dark:text-rose-200">
                  Excluir este lançamento?
                </p>
                <p className="text-xs text-muted-foreground">
                  {form.description || '(sem descrição)'} · {form.type === 'CREDIT' ? '+' : '−'} R$ {form.amount}
                  {' '}· o saldo da conta é recalculado na hora
                </p>
                <div className="space-y-1.5">
                  <Label htmlFor="motivoExcluir" className="text-xs">Motivo (vai pro histórico)</Label>
                  <Input id="motivoExcluir" placeholder="ex: duplicata — o dia já está completo noutro lançamento"
                    value={motivoExcluir} onChange={(e) => setMotivoExcluir(e.target.value)} />
                </div>
                <div className="flex items-center gap-2">
                  <Button type="button" size="sm" variant="destructive" onClick={excluir} disabled={excluindo}>
                    {excluindo ? 'Excluindo…' : 'confirmar'}
                  </Button>
                  <Button type="button" size="sm" variant="ghost"
                    onClick={() => setConfirmandoExcluir(false)} disabled={excluindo}>
                    cancelar
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="flex items-center gap-3 justify-end">
        <Button type="button" variant="outline" onClick={() => router.back()} disabled={loading}>Cancelar</Button>
        <Button type="submit" disabled={loading}>
          {loading ? 'Salvando...' : isEditing ? 'Atualizar' : 'Lançar transação'}
        </Button>
      </div>
    </form>
  )
}
