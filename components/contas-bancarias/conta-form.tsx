'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Wallet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { useToast } from '@/components/ui/use-toast'
import { TIPOS_CONTA } from '@/lib/validations/conta-bancaria'
import { BANCOS_BR } from '@/lib/bancos'

const TIPO_LABELS: Record<string, string> = {
  CHECKING: 'Conta Corrente',
  SAVINGS: 'Conta Poupança',
  INVESTMENT: 'Conta Investimento',
  CASH: 'Caixa (dinheiro físico)',
}

// Código sentinela para "Outro" — usado só na UI, não pertence à lista canônica.
const CODIGO_OUTRO = '000'

interface ContaFormProps {
  empresaId: string
  conta?: {
    id: string
    name: string
    bankName: string | null
    bankCode: string | null
    agency: string | null
    accountNumber: string | null
    accountType: string
    balance: number
    allowNegativeBalance?: boolean
    creditLimit?: number
    lowBalanceThreshold?: number | null
    accountKind?: string
  }
}

export function ContaForm({ empresaId, conta }: ContaFormProps) {
  const router = useRouter()
  const { toast } = useToast()
  const isEditing = !!conta

  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [form, setForm] = useState({
    name: conta?.name ?? '',
    bankName: conta?.bankName ?? '',
    bankCode: conta?.bankCode ?? '',
    agency: conta?.agency ?? '',
    accountNumber: conta?.accountNumber ?? '',
    accountType: conta?.accountType ?? 'CHECKING',
    accountKind: conta?.accountKind ?? 'PJ',
    balance: conta?.balance?.toString() ?? '0',
    allowNegativeBalance: conta?.allowNegativeBalance ?? true,
    creditLimit: conta?.creditLimit?.toString() ?? '0',
    lowBalanceThreshold:
      conta?.lowBalanceThreshold !== null && conta?.lowBalanceThreshold !== undefined
        ? conta.lowBalanceThreshold.toString()
        : '',
  })

  function set(field: string, value: string | boolean) {
    setForm((p) => ({ ...p, [field]: value }))
    if (errors[field]) setErrors((p) => ({ ...p, [field]: '' }))
  }

  // Sprint Caixa — quando vira CASH, força travas no client (server também
  // valida via normalizeAndValidateCashAccount).
  const isCash = form.accountType === 'CASH'
  function selectAccountType(v: string) {
    setForm((p) => ({
      ...p,
      accountType: v,
      // Caixa: zera campos bancários + força allowNegativeBalance=false +
      // creditLimit=0. UI fica espelhando o backend.
      ...(v === 'CASH'
        ? {
            bankCode: '',
            bankName: '',
            agency: '',
            accountNumber: '',
            allowNegativeBalance: false,
            creditLimit: '0',
          }
        : {}),
    }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setErrors({})

    try {
      const url = isEditing ? `/api/contas-bancarias/${conta.id}` : '/api/contas-bancarias'
      const method = isEditing ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          balance: parseFloat(form.balance) || 0,
          creditLimit: parseFloat(form.creditLimit) || 0,
          lowBalanceThreshold:
            form.lowBalanceThreshold.trim() === ''
              ? null
              : parseFloat(form.lowBalanceThreshold) || 0,
          empresaId,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        if (data.campos) { setErrors(data.campos); return }
        toast({ variant: 'destructive', title: 'Erro', description: data.erro })
        return
      }

      toast({ variant: 'success', title: 'Sucesso', description: isEditing ? 'Conta atualizada!' : 'Conta cadastrada!' })
      router.push(`/empresas/${empresaId}/contas`)
      router.refresh()
    } catch {
      toast({ variant: 'destructive', title: 'Erro', description: 'Erro interno. Tente novamente.' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card className={isCash ? 'border-amber-200 bg-amber-50/40' : undefined}>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            {isCash && <Wallet className="h-4 w-4 text-amber-700" />}
            Identificação
          </CardTitle>
          {isCash && (
            <p className="text-xs text-amber-800">
              💰 <strong>Conta Caixa</strong> — dinheiro físico (cofre / gaveta).
              Sem banco, sem cheque especial, sem importação de OFX.
            </p>
          )}
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="name">Nome da Conta <span className="text-destructive">*</span></Label>
            <Input
              id="name"
              placeholder={isCash ? 'Ex: Caixa Loja / Cofre' : 'Ex: Conta Principal Itaú'}
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
            />
            {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="accountType">Tipo de Conta <span className="text-destructive">*</span></Label>
            <Select value={form.accountType} onValueChange={selectAccountType}>
              <SelectTrigger id="accountType"><SelectValue /></SelectTrigger>
              <SelectContent>
                {TIPOS_CONTA.map((t) => (
                  <SelectItem key={t} value={t}>{TIPO_LABELS[t]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.accountType && <p className="text-xs text-destructive">{errors.accountType}</p>}
          </div>

          {/* Sprint Account Kind PJ/PF (27/06/2026) — seletor empresa vs dono */}
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="accountKind">
              Esta conta é da empresa ou pessoal do dono?{' '}
              <span className="text-destructive">*</span>
            </Label>
            <Select
              value={form.accountKind}
              onValueChange={(v) => set('accountKind', v)}
            >
              <SelectTrigger id="accountKind"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="PJ">PJ — Conta da empresa (operacional)</SelectItem>
                <SelectItem value="PF">PF — Conta pessoal do dono (privada)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground leading-snug">
              Pares <strong>PJ ↔ PJ</strong> são transferências internas (fora do DRE).
              Pares <strong>PJ ↔ PF</strong> viram Aporte (entra na PJ) ou Retirada / Pró-labore
              (sai da PJ) — vão pro patrimônio, não pro resultado.
            </p>
          </div>

          {/* Campos bancários: esconde em CASH (não tem banco) */}
          {!isCash && (
            <>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="bankCode">Banco</Label>
                <Select value={form.bankCode} onValueChange={(v) => {
                  const banco = BANCOS_BR.find((b) => b.codigo === v)
                  set('bankCode', v)
                  if (banco) set('bankName', banco.nome)
                  else if (v === CODIGO_OUTRO) set('bankName', '')
                }}>
                  <SelectTrigger id="bankCode"><SelectValue placeholder="Selecione o banco" /></SelectTrigger>
                  <SelectContent>
                    {BANCOS_BR.map((b) => (
                      <SelectItem key={b.codigo} value={b.codigo}>{b.nome}</SelectItem>
                    ))}
                    <SelectItem value={CODIGO_OUTRO}>Outro</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="agency">Agência</Label>
                <Input id="agency" placeholder="0001" value={form.agency} onChange={(e) => set('agency', e.target.value)} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="accountNumber">Número da Conta</Label>
                <Input id="accountNumber" placeholder="12345-6" value={form.accountNumber} onChange={(e) => set('accountNumber', e.target.value)} />
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Saldo Inicial</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-2 max-w-xs">
            <Label htmlFor="balance">
              {isCash ? 'Dinheiro na gaveta agora (R$)' : 'Saldo atual (R$)'}
            </Label>
            <Input
              id="balance"
              type="number"
              step="0.01"
              min={isCash ? '0' : undefined}
              placeholder="0,00"
              value={form.balance}
              onChange={(e) => set('balance', e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              {isCash
                ? 'Quanto tem fisicamente no caixa/cofre nesse momento. Caixa nunca fica negativo.'
                : 'Saldo atual da conta no banco. Pode ser negativo se estiver usando cheque especial (ex: -5000). Se errar, dá pra corrigir depois pela opção "Ajustar saldo".'}
            </p>
            {errors.balance && <p className="text-xs text-destructive">{errors.balance}</p>}
          </div>
        </CardContent>
      </Card>

      {/* Cheque Especial: NÃO aparece em CASH (Caixa não tem cheque especial) */}
      {!isCash && (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Cheque Especial</CardTitle>
          <p className="text-xs text-muted-foreground">
            Configure o limite real do cheque especial e alerta de saldo baixo (opcional).
          </p>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-start gap-3">
            <Checkbox
              id="allowNegativeBalance"
              checked={form.allowNegativeBalance}
              onCheckedChange={(v) => set('allowNegativeBalance', v === true)}
            />
            <div className="grid gap-1">
              <Label
                htmlFor="allowNegativeBalance"
                className="cursor-pointer leading-tight"
              >
                Permitir saldo negativo (cheque especial)
              </Label>
              <p className="text-xs text-muted-foreground">
                Desabilite para contas tipo poupança ou que não usam cheque especial.
              </p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="creditLimit">Limite de cheque especial (R$)</Label>
              <Input
                id="creditLimit"
                type="number"
                step="0.01"
                min="0"
                placeholder="600000,00"
                value={form.creditLimit}
                onChange={(e) => set('creditLimit', e.target.value)}
                disabled={!form.allowNegativeBalance}
              />
              <p className="text-xs text-muted-foreground">
                Valor real do limite contratado (ex: Banrisul R$ 600k, Sicredi R$ 80k).
              </p>
              {errors.creditLimit && (
                <p className="text-xs text-destructive">{errors.creditLimit}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="lowBalanceThreshold">
                Alerta de saldo baixo (R$){' '}
                <span className="text-muted-foreground font-normal">— opcional</span>
              </Label>
              <Input
                id="lowBalanceThreshold"
                type="number"
                step="0.01"
                min="0"
                placeholder="5000,00"
                value={form.lowBalanceThreshold}
                onChange={(e) => set('lowBalanceThreshold', e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Badge amarelo &quot;Atenção&quot; quando saldo cair abaixo deste valor.
              </p>
              {errors.lowBalanceThreshold && (
                <p className="text-xs text-destructive">{errors.lowBalanceThreshold}</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
      )}

      <div className="flex items-center gap-3 justify-end">
        <Button type="button" variant="outline" onClick={() => router.back()} disabled={loading}>Cancelar</Button>
        <Button type="submit" disabled={loading}>
          {loading ? 'Salvando...' : isEditing ? 'Atualizar conta' : 'Cadastrar conta'}
        </Button>
      </div>
    </form>
  )
}
