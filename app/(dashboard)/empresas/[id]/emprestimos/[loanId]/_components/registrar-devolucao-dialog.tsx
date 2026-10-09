/**
 * ⭐⭐⭐ REGISTRAR DEVOLUÇÃO — a porta do mútuo flexível (09/10/2026).
 *
 * **O dono:** *"paguei 40.000 ao Arafat hoje PELO COFRE e a tela não tem porta."* Aqui ele
 * digita o valor LIVRE, confere a prévia e grava num clique — a saída e o vínculo juntos.
 *
 * ⚠️ **TODA RÉGUA MORA NO SERVIDOR.** A tela não decide referência, não escolhe categoria, não
 * procura a saída que já existe e **não monta a descrição**: tudo isso vem da prévia
 * (`previaDaDevolucao`), que é a MESMA função que a gravação executa. Regra que mora num
 * componente é regra que ninguém prova — a lição do prefill do cardápio (28/08), que quebrou
 * duas vezes antes de virar função.
 */
'use client'

import { useEffect, useState } from 'react'
import { Loader2, ArrowRight, AlertTriangle, CircleCheck, Link2, Wallet } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/use-toast'
import { formatBRL } from '@/lib/format/money'
import { fetchComTimeout } from '@/lib/http/fetch-com-timeout'
import { sanitizarDinheiro, valorDinheiro } from '@/lib/format/money-input'

interface Candidata {
  id: string
  data: string
  valor: number
  descricao: string
  origem: string
  diasDeDistancia: number
  temCategoria: boolean
  categoriaNome: string | null
}

interface Previa {
  contrato: { id: string; lender: string; contractNumber: string | null; principal: number }
  conta: { id: string; nome: string }
  referencia: { id: string; number: number; dueDate: string; payment: number }
  valor: number
  data: string
  descricao: string
  nDevolucao: number
  candidatos: Candidata[]
  acao: 'CASAR' | 'CRIAR'
  frase: string
  categoria: { id: string; nome: string } | null
  categoriasPossiveis: Array<{ id: string; nome: string }>
  pedeCategoria: boolean
  depois: { devolucoes: number; totalDevolvido: number; saldo: number }
  avisos: string[]
}

interface Props {
  empresaId: string
  loanId: string
  /** ⚠️ o "hoje" chega de fora: o relógio nunca decide dentro da régua */
  hoje: string
  onClose: () => void
  onGravado: () => void
}

const fmtData = (iso: string) => {
  const [y, m, d] = iso.slice(0, 10).split('-')
  return `${d}/${m}/${y.slice(2)}`
}

export function RegistrarDevolucaoDialog({ empresaId, loanId, hoje, onClose, onGravado }: Props) {
  const { toast } = useToast()
  // ⚠️ REGRA 9 — todos os hooks no TOPO, antes de qualquer early return
  const [valorTxt, setValorTxt] = useState('')
  const [data, setData] = useState(hoje)
  const [descricao, setDescricao] = useState('')
  const [categoryId, setCategoryId] = useState<string | null>(null)
  const [casarCom, setCasarCom] = useState<string | null>(null)
  const [criarMesmo, setCriarMesmo] = useState(false)
  const [previa, setPrevia] = useState<Previa | null>(null)
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [gravando, setGravando] = useState(false)

  const valor = valorDinheiro(valorTxt)

  /**
   * ⚠️ A PRÉVIA É DEBOUNCED E DEPENDE SÓ DE PRIMITIVOS.
   *
   * ⛔ Nenhuma função vinda de prop entra nas dependências: a identidade dela muda a cada
   * render do pai **por construção**, e isso é o laço de 20 requisições/segundo de 14/09 —
   * que pendurou a tela de vendas inteira e saturou o limite de conexões do browser.
   */
  useEffect(() => {
    if (!valor || valor <= 0) {
      setPrevia(null)
      setErro(null)
      return
    }
    const ctrl = new AbortController()
    const t = setTimeout(async () => {
      setCarregando(true)
      const r = await fetchComTimeout<{ previa: Previa }>(
        `/api/empresas/${empresaId}/emprestimos/${loanId}/devolucao`,
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          signal: ctrl.signal,
          body: JSON.stringify({
            valor,
            data,
            ...(descricao.trim() ? { descricao: descricao.trim() } : {}),
            ...(categoryId ? { categoryId } : {}),
            ...(casarCom ? { casarComTransactionId: casarCom } : {}),
            confirmar: false,
          }),
        },
      )
      setCarregando(false)
      if (!r.ok) {
        setPrevia(null)
        setErro(r.erro)
        return
      }
      setErro(null)
      setPrevia(r.data?.previa ?? null)
    }, 450)
    return () => {
      clearTimeout(t)
      ctrl.abort()
    }
  }, [empresaId, loanId, valor, data, descricao, categoryId, casarCom])

  async function gravar() {
    if (!previa || !valor) return
    setGravando(true)
    const r = await fetchComTimeout<{ gravado: { valor: number; referencia: number; criouSaida: boolean; saldo: number } }>(
      `/api/empresas/${empresaId}/emprestimos/${loanId}/devolucao`,
      {
        /** ⚠️ 60 s na GRAVAÇÃO: desistir cedo de uma escrita que está acontecendo é pior que esperar */
        timeoutMs: 60_000,
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          valor,
          data,
          ...(descricao.trim() ? { descricao: descricao.trim() } : {}),
          ...(categoryId ? { categoryId } : {}),
          ...(casarCom ? { casarComTransactionId: casarCom } : {}),
          ...(criarMesmo ? { criarMesmoComCandidata: true } : {}),
          confirmar: true,
        }),
      },
    )
    setGravando(false)
    if (!r.ok) {
      toast({ variant: 'destructive', title: 'Não deu pra registrar', description: r.erro ?? undefined })
      return
    }
    const g = r.data?.gravado
    toast({
      variant: 'success',
      title: `Devolução de ${formatBRL(g?.valor ?? valor)} registrada`,
      description: g
        ? `${g.criouSaida ? 'saída criada' : 'saída existente vinculada'} · referência #${g.referencia} · saldo ${formatBRL(g.saldo)}`
        : undefined,
    })
    onGravado()
  }

  const categoriaEscolhida = categoryId ?? previa?.categoria?.id ?? ''
  const travado = !previa || gravando || carregando || previa.pedeCategoria

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Registrar devolução</DialogTitle>
          <p className="text-xs text-muted-foreground">
            Mútuo sem prazo fixo · a devolução é conforme o caixa, com valor livre
          </p>
        </DialogHeader>

        <div className="space-y-3">
          {/* ⭐ O VALOR É O PROTAGONISTA — é a pergunta da tela */}
          <div>
            <label htmlFor="dev-valor" className="block text-[11px] font-medium text-muted-foreground mb-1">
              Quanto você devolveu?
            </label>
            <div className="flex items-baseline gap-2">
              <span className="text-sm text-muted-foreground">R$</span>
              <input
                id="dev-valor"
                inputMode="decimal"
                autoFocus
                value={valorTxt}
                onChange={(e) => setValorTxt(sanitizarDinheiro(e.target.value))}
                placeholder="40.000,00"
                className="w-40 rounded-md border bg-background px-2 py-1 text-[22px] font-semibold tabular-nums outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="dev-data" className="block text-[11px] font-medium text-muted-foreground mb-1">
                Quando saiu
              </label>
              <input
                id="dev-data"
                type="date"
                value={data}
                onChange={(e) => setData(e.target.value)}
                className="w-full rounded-md border bg-background px-2 py-1.5 text-sm"
              />
            </div>
            <div>
              <span className="block text-[11px] font-medium text-muted-foreground mb-1">De onde saiu</span>
              {/*
                ⚠️ A CONTA É A DO CONTRATO e NÃO é um seletor — de propósito.
                O vínculo de parcela exige a conta do contrato (`vincularPagamentoDeParcela`
                recusa transação de outra conta), então oferecer um seletor seria oferecer um
                caminho que o servidor recusa depois do clique.
              */}
              <div className="flex items-center gap-1.5 rounded-md border bg-muted/30 px-2 py-1.5 text-sm">
                <Wallet className="h-3.5 w-3.5 text-muted-foreground" />
                {previa?.conta.nome ?? '—'}
                <span className="ml-auto text-[10px] text-muted-foreground">a conta do contrato</span>
              </div>
            </div>
          </div>

          {carregando && (
            <p className="flex items-center text-xs text-muted-foreground">
              <Loader2 className="mr-1.5 h-3 w-3 animate-spin" /> conferindo…
            </p>
          )}
          {erro && (
            <p className="rounded-md border border-red-200 bg-red-50/60 px-3 py-2 text-xs text-red-800 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-300">
              {erro}
            </p>
          )}

          {previa && (
            <>
              {/* ⭐⭐ A SAÍDA QUE JÁ EXISTE — "nunca duas saídas pro mesmo pagamento" */}
              {previa.candidatos.length > 0 && (
                <div className="rounded-md border border-amber-200/70 bg-amber-50/40 p-3 dark:border-amber-900/40 dark:bg-amber-950/20">
                  <p className="flex items-center gap-1.5 text-xs font-medium text-amber-900 dark:text-amber-100">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    {previa.candidatos.length === 1
                      ? 'esta saída já está lançada — vincule ela em vez de criar outra'
                      : `${previa.candidatos.length} saídas desse valor nesta janela — qual é esta devolução?`}
                  </p>
                  <div className="mt-2 space-y-1">
                    {previa.candidatos.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          setCasarCom(casarCom === c.id ? null : c.id)
                          setCriarMesmo(false)
                        }}
                        className={`flex w-full items-center gap-2 rounded border px-2 py-1.5 text-left text-xs transition ${
                          casarCom === c.id
                            ? 'border-emerald-400 bg-emerald-50/70 dark:border-emerald-800 dark:bg-emerald-950/30'
                            : 'border-transparent bg-background hover:border-amber-300'
                        }`}
                      >
                        {casarCom === c.id ? (
                          <CircleCheck className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                        ) : (
                          <Link2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        )}
                        <span className="tabular-nums text-muted-foreground">{fmtData(c.data)}</span>
                        <span className="font-medium tabular-nums">{formatBRL(c.valor)}</span>
                        <span className="truncate text-muted-foreground">{c.descricao}</span>
                        {c.categoriaNome && (
                          <span className="ml-auto shrink-0 text-[10px] text-muted-foreground">
                            {c.categoriaNome}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                  {!casarCom && (
                    <label className="mt-2 flex items-start gap-1.5 text-[11px] text-amber-900 dark:text-amber-200">
                      <input
                        type="checkbox"
                        checked={criarMesmo}
                        onChange={(e) => setCriarMesmo(e.target.checked)}
                        className="mt-0.5"
                      />
                      {/* ⛔ o escape NASCE DESMARCADO: criar a 2ª saída tem que ser um gesto */}
                      <span>é uma saída diferente — criar outra assim mesmo</span>
                    </label>
                  )}
                </div>
              )}

              {/* ⭐ A CATEGORIA — devolução é baixa de passivo, não despesa */}
              <div>
                <label htmlFor="dev-cat" className="block text-[11px] font-medium text-muted-foreground mb-1">
                  Categoria {previa.pedeCategoria && <span className="text-red-600">· escolha uma</span>}
                </label>
                <select
                  id="dev-cat"
                  value={categoriaEscolhida}
                  onChange={(e) => setCategoryId(e.target.value || null)}
                  className="w-full rounded-md border bg-background px-2 py-1.5 text-sm"
                >
                  <option value="">— escolher —</option>
                  {previa.categoriasPossiveis.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-[10px] text-muted-foreground">
                  a lista é de transferência: devolução de mútuo abate dívida, não é despesa do DRE
                </p>
              </div>

              <div>
                <label htmlFor="dev-desc" className="block text-[11px] font-medium text-muted-foreground mb-1">
                  Descrição
                </label>
                <input
                  id="dev-desc"
                  value={descricao || previa.descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  className="w-full rounded-md border bg-background px-2 py-1.5 text-sm"
                />
              </div>

              {/* ⭐⭐ O QUE VAI ACONTECER, antes do clique */}
              <div className="rounded-md border bg-card p-3 text-xs">
                <p className="font-medium">{previa.frase}</p>
                <p className="mt-1 text-muted-foreground">
                  entra na referência <strong>#{previa.referencia.number}</strong> (vence{' '}
                  {fmtData(previa.referencia.dueDate)}) — a próxima aberta por ordem
                </p>
                <div className="mt-2 flex items-center gap-2 border-t pt-2">
                  <span className="text-muted-foreground">saldo</span>
                  <span className="tabular-nums">{formatBRL(previa.contrato.principal - previa.depois.totalDevolvido + previa.valor)}</span>
                  <ArrowRight className="h-3 w-3 text-muted-foreground" />
                  <span className="font-semibold tabular-nums">{formatBRL(previa.depois.saldo)}</span>
                  <span className="ml-auto text-muted-foreground">
                    {previa.depois.devolucoes}ª devolução · {formatBRL(previa.depois.totalDevolvido)} devolvidos
                  </span>
                </div>
              </div>

              {previa.avisos.map((a) => (
                <p key={a} className="text-[11px] text-amber-800 dark:text-amber-300">
                  ⚠️ {a}
                </p>
              ))}
            </>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 pt-1">
          <Button variant="ghost" onClick={onClose} disabled={gravando}>
            voltar
          </Button>
          <Button onClick={gravar} disabled={travado}>
            {gravando ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <CircleCheck className="mr-1.5 h-3.5 w-3.5" />
            )}
            {previa?.acao === 'CASAR' ? 'Vincular esta saída' : 'Registrar devolução'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
