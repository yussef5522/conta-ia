'use client'

// Sprint 9 — Modal "Nova regra" SE → ENTÃO com preview ao vivo.
//
// SE: descrição (CONTAINS | EXACT | NORMALIZED | CNPJ) + filtro opcional
//     de TIPO (CREDIT | DEBIT)
// ENTÃO: categoria (existente da empresa)
// PREVIEW: consulta /api/empresas/[id]/regras/preview a cada keystroke
//          (debounce 300ms) e mostra "N transações seriam classificadas"
//          + 5 amostras. Se N > 50 OU > 25% da janela, banner amber:
//          "padrão amplo — confira se não vai pegar coisa demais".
// CRIAR: POST /api/empresas/[id]/rules/create-and-apply (Sprint 1).
//        regra fonte=MANUAL, confiança=1.0, isActive=true. Aplica
//        retroativamente nas pendentes que batem.

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/components/ui/use-toast'
import { AlertTriangle, ArrowRight, Loader2, Wand2 } from 'lucide-react'
import { formatBRL } from '@/lib/format/money'

interface Categoria {
  id: string
  name: string
  type: string | null
  dreGroup: string | null
  color: string | null
}

interface Sample {
  id: string
  description: string
  amount: number
  date: string
  type: string
}

interface PreviewResp {
  count: number
  janela: number
  truncado: boolean
  samples: Sample[]
}

interface Props {
  empresaId: string
  categorias: Categoria[]
  /** Pre-preencher quando vem do atalho "criar regra a partir desta tx". */
  initialPadrao?: string
  initialCategoryId?: string
  initialType?: 'CREDIT' | 'DEBIT'
  onClose: () => void
  onCreated: (resp: { ruleId: string; appliedTo: number; totalAmount: number }) => void
}

const LIMITE_PADRAO_AMPLO_ABS = 50
const LIMITE_PADRAO_AMPLO_PCT = 0.25 // 25% da janela

export function NovaRegraModal({
  empresaId,
  categorias,
  initialPadrao,
  initialCategoryId,
  initialType,
  onClose,
  onCreated,
}: Props) {
  const { toast } = useToast()

  // SE
  const [padrao, setPadrao] = useState(initialPadrao ?? '')
  const [tipoMatch, setTipoMatch] = useState<'CONTAINS' | 'EXACT' | 'CNPJ' | 'NORMALIZED'>('CONTAINS')
  const [tipoTx, setTipoTx] = useState<'ALL' | 'CREDIT' | 'DEBIT'>(initialType ?? 'ALL')

  // ENTÃO
  const [categoryId, setCategoryId] = useState<string>(initialCategoryId ?? '')

  // PREVIEW
  const [previewLoading, setPreviewLoading] = useState(false)
  const [preview, setPreview] = useState<PreviewResp | null>(null)
  const previewCtrlRef = useRef<AbortController | null>(null)

  const [saving, setSaving] = useState(false)

  // Debounced preview
  useEffect(() => {
    const valor = padrao.trim()
    if (valor.length < 3) {
      setPreview(null)
      setPreviewLoading(false)
      return
    }
    const t = setTimeout(async () => {
      previewCtrlRef.current?.abort()
      const ctrl = new AbortController()
      previewCtrlRef.current = ctrl
      setPreviewLoading(true)
      try {
        const res = await fetch(`/api/empresas/${empresaId}/regras/preview`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ padrao: valor, tipoMatch }),
          credentials: 'include',
          signal: ctrl.signal,
        })
        if (!res.ok) {
          setPreview(null)
          return
        }
        const data: PreviewResp = await res.json()
        // Filtra amostras por tipoTx se selecionado (a janela inteira não suporta tipo direto no endpoint atual)
        if (tipoTx !== 'ALL') {
          data.samples = data.samples.filter((s) => s.type === tipoTx)
        }
        setPreview(data)
      } catch (e) {
        // AbortError ignorado
        if ((e as Error).name !== 'AbortError') setPreview(null)
      } finally {
        if (previewCtrlRef.current === ctrl) setPreviewLoading(false)
      }
    }, 300)
    return () => clearTimeout(t)
  }, [padrao, tipoMatch, tipoTx, empresaId])

  const padraoAmplo = useMemo(() => {
    if (!preview) return false
    if (preview.count >= LIMITE_PADRAO_AMPLO_ABS) return true
    if (preview.janela > 0 && preview.count / preview.janela >= LIMITE_PADRAO_AMPLO_PCT) return true
    return false
  }, [preview])

  const podeCriar = padrao.trim().length >= 3 && categoryId.length > 0

  async function handleCriar() {
    setSaving(true)
    try {
      const res = await fetch(`/api/empresas/${empresaId}/rules/create-and-apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          padrao: padrao.trim(),
          tipoMatch: tipoMatch === 'NORMALIZED' ? 'CONTAINS' : tipoMatch, // backend só aceita EXACT/CONTAINS/CNPJ
          categoryId,
          type: tipoTx === 'ALL' ? undefined : tipoTx,
          applyToExisting: true,
        }),
        credentials: 'include',
      })
      const json = await res.json()
      if (!res.ok) {
        toast({
          variant: 'destructive',
          title: 'Erro',
          description: json.erro ?? 'Falha ao criar regra.',
        })
        return
      }
      toast({
        title: 'Regra criada',
        description:
          json.appliedTo > 0
            ? `Classificou ${json.appliedTo} transação${json.appliedTo === 1 ? '' : 'es'} (${formatBRL(json.totalAmount ?? 0)}).`
            : 'Regra ativa. Aplicará nas próximas transações que baterem.',
      })
      onCreated(json)
    } finally {
      setSaving(false)
    }
  }

  const categoriaSelecionada = categorias.find((c) => c.id === categoryId)

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wand2 className="h-4 w-4" />
            Nova regra
          </DialogTitle>
          <DialogDescription>
            Defina o padrão (SE) e a categoria (ENTÃO). A regra aplica
            automaticamente nas transações que batem.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* ─── SE ─── */}
          <section className="rounded-md border border-dashed bg-muted/30 p-3 space-y-3">
            <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              SE — Quando a transação...
            </div>

            <div className="grid grid-cols-3 gap-2 items-end">
              <div className="space-y-1">
                <Label className="text-xs">Campo</Label>
                <Select value="descricao" onValueChange={() => {}} disabled>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="descricao">Descrição</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Operador</Label>
                <Select
                  value={tipoMatch}
                  onValueChange={(v) => setTipoMatch(v as typeof tipoMatch)}
                >
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CONTAINS">contém</SelectItem>
                    <SelectItem value="EXACT">é exatamente</SelectItem>
                    <SelectItem value="CNPJ">CNPJ é</SelectItem>
                    <SelectItem value="NORMALIZED">normalizado contém</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Valor</Label>
                <Input
                  value={padrao}
                  onChange={(e) => setPadrao(e.target.value)}
                  placeholder="ex: FRIGORIFICO"
                  className="h-9 text-sm font-mono"
                  maxLength={120}
                  autoFocus
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 items-end">
              <div className="space-y-1">
                <Label className="text-xs">E o tipo for</Label>
                <Select value={tipoTx} onValueChange={(v) => setTipoTx(v as typeof tipoTx)}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Qualquer (entrada ou saída)</SelectItem>
                    <SelectItem value="DEBIT">Saída (despesa)</SelectItem>
                    <SelectItem value="CREDIT">Entrada (receita)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="text-xs text-muted-foreground pb-2">
                + adicionar condição{' '}
                <span className="italic text-muted-foreground/60">(v2)</span>
              </div>
            </div>
          </section>

          {/* ─── ENTÃO ─── */}
          <section className="rounded-md border border-dashed bg-muted/30 p-3 space-y-3">
            <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              ENTÃO — Classificar como...
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Categoria</Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="Escolha uma categoria" />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {categorias.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      <span className="flex items-center gap-2">
                        {c.color && (
                          <span
                            className="h-2 w-2 rounded-full"
                            style={{ background: c.color }}
                          />
                        )}
                        {c.name}
                        {c.dreGroup && (
                          <span className="text-[10px] text-muted-foreground ml-1">
                            {c.dreGroup}
                          </span>
                        )}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {categoriaSelecionada?.dreGroup && (
                <p className="text-[10px] text-muted-foreground">
                  Grupo DRE: {categoriaSelecionada.dreGroup}
                </p>
              )}
            </div>
          </section>

          {/* ─── PREVIEW ─── */}
          <section className="rounded-md border bg-card px-3 py-2.5 text-xs">
            {padrao.trim().length < 3 ? (
              <p className="text-muted-foreground">
                Digite pelo menos 3 caracteres pra ver o preview.
              </p>
            ) : previewLoading ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />
                Calculando preview…
              </div>
            ) : !preview ? (
              <p className="text-muted-foreground">
                Sem dados de preview.
              </p>
            ) : preview.count === 0 ? (
              <p className="text-muted-foreground">
                <strong className="text-foreground">Nenhuma</strong> transação
                pendente bate com esse padrão. A regra ficará ativa pra
                classificar futuras.
              </p>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                  <p className="font-medium text-foreground">
                    Vai classificar{' '}
                    <span className="tabular-nums">{preview.count}</span>{' '}
                    transação{preview.count === 1 ? '' : 'ões'} pendente
                    {preview.count === 1 ? '' : 's'} agora
                    {preview.truncado && ' (janela: 5000 mais recentes)'}.
                  </p>
                </div>
                {padraoAmplo && (
                  <div className="rounded border border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-900/20 px-2.5 py-1.5 flex items-start gap-2">
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                    <p className="text-[11px] text-amber-900 dark:text-amber-200">
                      <strong>Padrão amplo</strong> — confira se não vai pegar
                      coisa demais. Considere usar &quot;é exatamente&quot; ou
                      torná-lo mais específico.
                    </p>
                  </div>
                )}
                <ul className="space-y-0.5 pl-4 text-muted-foreground">
                  {preview.samples.slice(0, 5).map((s) => (
                    <li key={s.id} className="truncate">
                      • {s.description}{' '}
                      <span className="tabular-nums text-muted-foreground/70">
                        ({formatBRL(s.amount)})
                      </span>
                    </li>
                  ))}
                  {preview.count > 5 && (
                    <li className="italic text-muted-foreground/70">
                      + {preview.count - 5} outras…
                    </li>
                  )}
                </ul>
              </div>
            )}
          </section>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button
            onClick={() => void handleCriar()}
            disabled={!podeCriar || saving}
            className="gap-1.5"
          >
            {saving ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Criando…
              </>
            ) : (
              <>
                Criar regra
                {preview && preview.count > 0 && (
                  <span className="text-xs opacity-75">
                    e classificar {preview.count}
                  </span>
                )}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
