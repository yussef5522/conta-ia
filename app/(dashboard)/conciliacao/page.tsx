'use client'

// ⭐⭐⭐ A FILA DE CONCILIAÇÃO (07/09/2026) — desenho aprovado pelo dono no mock.
//
// ⛔⛔ A TELA ANTERIOR ERRAVA DOS DOIS LADOS, e pelo MESMO motivo: ela listava
// `origin=OFX` + `categoryId IS NULL` + `cashCoded=false` — a fila de
// CLASSIFICAÇÃO com o nome trocado. Daí ela mostrava **o que não é dela**
// (qualquer linha sem categoria, tendo par ou não) e **não mostrava o que é dela**
// (a linha que ganha categoria some pra sempre, mesmo com a conta aberta).
// Medido na Caçula em 07/09: **0 linhas na tela** com **108 contas na fila real**
// e R$ 230,81 em dupla contagem.
//
// ⭐ A PERGUNTA DA TELA MUDOU: não é "o que falta categorizar" (isso é /pendentes)
// — é **"estes dois registros são o mesmo dinheiro?"**.
//
// ⚠️ O QUE SUMIU DAQUI E ONDE ESTÁ: categorizar linha de extrato é a fila de
// /pendentes, que cobre o MESMO universo (a query velha era um subconjunto dela).
// O Find & Match continua vivo, agora pendurado no card do par ("Procurar outra").

import { useEffect, useState, useCallback, useMemo, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { CheckCircle2, FileText, Loader2, AlertTriangle, History } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Header } from '@/components/layout/header'
import { useEmpresa } from '@/lib/contexts/empresa-context'
import { formatBRL } from '@/lib/format/money'
import { HistoricoTable } from '@/components/conciliacao/historico-table'
import { FindAndMatchPanel } from '@/components/conciliacao/find-and-match-panel'
import {
  ParSugerido, type ContaDaFilaDTO, type SugestaoDTO,
} from '@/components/conciliacao/par-sugerido'
import {
  CabecalhoDaFila, type SaldosDTO, type TotaisDTO, type SemParDTO,
} from '@/components/conciliacao/cabecalho-da-fila'
import { useToast } from '@/components/ui/use-toast'
import { fetchJson } from '@/lib/http/fetch-json'

interface TransferenciaDTO {
  id: string; descricao: string; valor: number; data: string; tipo: string; conta: string
}
interface DuplicataDTO {
  chave: string
  linhas: { id: string; descricao: string; valor: number; data: string; conta: string; fitid: string | null; criadaEm: string }[]
}
interface FilaDTO {
  contas: ContaDaFilaDTO[]
  semPar: SemParDTO
  transferencias: TransferenciaDTO[]
  duplicatas: DuplicataDTO[]
  saldos: SaldosDTO
  totais: TotaisDTO
}

type Aba = 'contas' | 'transferencias' | 'duplicatas' | 'historico'

const dia = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { timeZone: 'UTC' })

export default function ConciliacaoPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Carregando…</div>}>
      <ConciliacaoInner />
    </Suspense>
  )
}

function ConciliacaoInner() {
  const { toast } = useToast()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { currentEmpresaId: ctxEmpresaId } = useEmpresa()

  const [empresaId, setEmpresaId] = useState<string>(
    searchParams.get('empresaId') ?? ctxEmpresaId ?? '',
  )
  useEffect(() => {
    const urlEmpresaId = searchParams.get('empresaId') ?? ''
    if (urlEmpresaId) { if (urlEmpresaId !== empresaId) setEmpresaId(urlEmpresaId) }
    else if (ctxEmpresaId && ctxEmpresaId !== empresaId) setEmpresaId(ctxEmpresaId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, ctxEmpresaId])

  const [fila, setFila] = useState<FilaDTO | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [aba, setAba] = useState<Aba>('contas')
  // Find & Match aberto pra UMA linha do extrato (a saída do caso difícil)
  const [procurando, setProcurando] = useState<SugestaoDTO | null>(null)

  const carregar = useCallback(async () => {
    if (!empresaId) { setCarregando(false); return }
    setCarregando(true)
    try {
      const { ok, data, message } = await fetchJson<FilaDTO>(
        `/api/conciliacao/fila?empresaId=${empresaId}`,
      )
      if (!ok) {
        toast({ variant: 'destructive', title: 'Erro ao carregar a fila', description: message ?? 'Tenta de novo.' })
        return
      }
      setFila(data!)
    } finally { setCarregando(false) }
  }, [empresaId, toast])

  useEffect(() => { carregar() }, [carregar])

  /**
   * ⭐ Depois de vincular, a LISTA se atualiza local (sem refetch, o scroll fica
   * onde estava) mas o SALDO não: o número novo depende do recálculo da conta no
   * servidor. Então releio só ele em vez de estimar aqui — estimar seria criar a
   * segunda derivação de novo, agora no cliente.
   */
  const recarregarSaldos = useCallback(async () => {
    if (!empresaId) return
    const { ok, data } = await fetchJson<FilaDTO>(`/api/conciliacao/fila?empresaId=${empresaId}`)
    if (ok && data) setFila((f) => (f ? { ...f, saldos: data.saldos } : f))
  }, [empresaId])

  useEffect(() => {
    if (!empresaId) return
    router.replace(`?empresaId=${empresaId}`, { scroll: false })
  }, [empresaId, router])

  // ⭐ CONCILIADO SOME DA FILA NA HORA (régua do dono): remoção local, sem refetch
  // — a lista não desmonta e o scroll fica onde estava. O saldo do topo refetcha.
  const removerConta = useCallback((contaId: string, extratoId: string) => {
    setFila((f) => {
      if (!f) return f
      const contas = f.contas
        .filter((c) => c.conta.id !== contaId)
        // ⛔⛔ A LINHA DO EXTRATO FOI GASTA: ela não pode continuar sendo oferecida
        // como pagamento de OUTRA conta. Sem isto, o card concorrente ficava na
        // tela clicável — e foi assim que a NF errada do Cancian foi vinculada
        // em 08/09. O servidor já não a devolveria; a tela é que mentia até o F5.
        .map((c) => ({ ...c, sugestoes: c.sugestoes.filter((s) => s.extratoId !== extratoId) }))
      const dc = contas.filter((c) => c.situacao === 'DUPLA_CONTAGEM')
      return { ...f, contas, totais: {
        ...f.totais,
        contas: contas.length,
        comSugestao: contas.filter((c) => c.sugestoes.length > 0).length,
        duplaContagem: dc.length,
        // ⚠️ a MESMA aritmética do servidor: soma a LISTA, cada conta uma vez.
        valorEmDuplaContagem: Math.round(dc.reduce((s, c) => s + c.conta.valor, 0) * 100) / 100,
      } }
    })
    // ⭐ o saldo do topo é conferência de banco: só o servidor sabe o novo número,
    // então recarrega em vez de eu chutar localmente.
    void recarregarSaldos()
  }, [recarregarSaldos])

  // ⚠️ a recusa tira só ESTE par — a conta continua na fila com as outras
  // sugestões, porque recusar um par não é recusar a conta.
  const removerPar = useCallback((extratoId: string, contaId: string) => {
    setFila((f) => {
      if (!f) return f
      const contas = f.contas.map((c) =>
        c.conta.id !== contaId ? c
          : { ...c, sugestoes: c.sugestoes.filter((s) => s.extratoId !== extratoId) })
      return { ...f, contas, totais: {
        ...f.totais, comSugestao: contas.filter((c) => c.sugestoes.length > 0).length,
      } }
    })
  }, [])

  // ⚠️ o servidor já manda SÓ as com sugestão; o filtro fica como defesa barata
  // (e some sozinho se um par for recusado sem recarregar).
  const comSugestao = useMemo(() => fila?.contas ?? [], [fila])
  // ⛔ do SERVIDOR: a dupla contagem existe tenha ou não par sugerido, e o banner
  // tem que dizer o mesmo número do bloco do topo (uma fonte, não duas).
  const duplaContagem = fila?.totais.duplaContagem ?? 0

  /**
   * ⛔ Quantas contas disputam CADA linha do extrato. Duas notas do mesmo
   * fornecedor com o mesmo valor viram dois cards quase idênticos — e só uma pode
   * ser. Mostrar as duas continua certo; o que faltava era dizer isso alto.
   */
  const disputaPorExtrato = useMemo(() => {
    const m = new Map<string, number>()
    for (const c of comSugestao) for (const s of c.sugestoes) {
      m.set(s.extratoId, (m.get(s.extratoId) ?? 0) + 1)
    }
    return m
  }, [comSugestao])

  const t = fila?.totais

  return (
    <div className="space-y-6">
      <Header
        title="Conciliação"
        description={
          empresaId
            ? t
              ? `${t.comSugestao} vínculo${t.comSugestao === 1 ? '' : 's'} esperando decisão`
              : 'Carregando…'
            : 'Selecione uma empresa'
        }
      />

      {/* ⛔ O CABEÇALHO SAI DA MESMA FONTE DAS ABAS. O anterior tinha régua
          própria e contradizia a aba de duplicatas na mesma tela (69 × 0), com o
          dinheiro errado até sob a própria régua. */}
      {empresaId && fila && (
        <CabecalhoDaFila
          empresaId={empresaId}
          totais={fila.totais}
          saldos={fila.saldos}
          semPar={fila.semPar}
        />
      )}

      {empresaId && (
        <div className="rounded-lg border bg-card overflow-hidden">
          {/* ── ABAS + saídas laterais ─────────────────────────────────── */}
          <div className="flex flex-wrap items-center gap-1 border-b px-2">
            <Tab ativa={aba === 'contas'} onClick={() => setAba('contas')}
              rotulo="Contas a pagar" n={carregando ? null : (t?.comSugestao ?? 0)} />
            <Tab ativa={aba === 'transferencias'} onClick={() => setAba('transferencias')}
              rotulo="Transferências aguardando par" n={carregando ? null : (t?.transferencias ?? 0)} />
            <Tab ativa={aba === 'duplicatas'} onClick={() => setAba('duplicatas')}
              rotulo="Possíveis duplicatas" n={carregando ? null : (t?.duplicatas ?? 0)} />
            <div className="ml-auto flex items-center gap-1 py-1">
              <Button variant={aba === 'historico' ? 'secondary' : 'ghost'} size="sm"
                className="h-7 text-xs gap-1.5" onClick={() => setAba('historico')}>
                <History className="h-3.5 w-3.5" />
                Já conciliadas
              </Button>
              <Link href={`/empresas/${empresaId}/imports`}>
                <Button variant="ghost" size="sm" className="h-7 text-xs gap-1.5">
                  <FileText className="h-3.5 w-3.5" />
                  Importações OFX
                </Button>
              </Link>
            </div>
          </div>

          <div className="p-3 space-y-2.5 bg-muted/30">
            {carregando ? (
              <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">
                <Loader2 className="h-5 w-5 mx-auto mb-2 animate-spin" />
                Procurando os pares…
              </CardContent></Card>
            ) : aba === 'contas' ? (
              <>
                {duplaContagem > 0 && (
                  <div className="flex gap-2.5 items-start rounded-md border border-amber-400 bg-amber-50 dark:bg-amber-950/40 px-3 py-2 text-[13px]">
                    <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-700 dark:text-amber-400" />
                    <span>
                      <b>{duplaContagem} conta{duplaContagem > 1 ? 's' : ''} em dupla contagem.</b>{' '}
                      Já {duplaContagem > 1 ? 'foram marcadas' : 'foi marcada'} como paga
                      {duplaContagem > 1 ? 's' : ''}, mas ficou sem vínculo — o mesmo dinheiro está
                      em duas linhas, e o saldo mente até alguém costurar.
                    </span>
                  </div>
                )}

                {comSugestao.length === 0 ? (
                  <Vazio
                    titulo="Nenhum vínculo esperando decisão"
                    texto="Quando um extrato novo entrar, os pagamentos que casarem com contas em aberto aparecem aqui com o motivo escrito."
                  />
                ) : (
                  comSugestao.map((c) => (
                    <div key={c.conta.id} className="space-y-2.5">
                      {/* ⚠️ dupla contagem SEM par: não há gesto honesto a oferecer
                          (o Find & Match parte de uma linha do extrato, e aqui não
                          existe candidata). Então ela aparece dizendo exatamente o
                          que é — sumir seria pior. */}
                      {c.sugestoes.length === 0 && (
                        <div className="rounded-lg border border-red-300 dark:border-red-800 bg-card px-3.5 py-2.5">
                          <p className="text-[13px] font-semibold">{c.conta.descricao}</p>
                          <p className="text-[11.5px] text-muted-foreground tabular-nums mt-0.5">
                            {formatBRL(Math.abs(c.conta.valor))} · vence {dia(c.conta.data)} ·{' '}
                            <b className="text-red-700 dark:text-red-400">
                              marcada como paga e sem vínculo — o mesmo dinheiro está em duas linhas
                            </b>
                          </p>
                          <p className="text-[11.5px] text-muted-foreground mt-0.5">
                            Nenhum pagamento parecido no extrato importado. Quando o extrato que
                            contém esse pagamento entrar, o par aparece aqui.
                          </p>
                        </div>
                      )}
                      {c.sugestoes.map((s) => (
                        <ParSugerido
                          key={`${s.extratoId}|${s.contaId}`}
                          empresaId={empresaId}
                          item={c}
                          sugestao={s}
                          disputadaPor={disputaPorExtrato.get(s.extratoId) ?? 1}
                          onVinculado={removerConta}
                          onRecusado={removerPar}
                          onProcurar={setProcurando}
                        />
                      ))}
                      {c.sugestoes.length > 1 && (
                        <p className="text-[11px] text-muted-foreground px-1">
                          ⚠️ <b>Mais de um pagamento parecido no extrato pra esta conta.</b> Esconder
                          um seria a régua decidindo qual foi — a escolha é sua.
                        </p>
                      )}
                    </div>
                  ))
                )}

              </>
            ) : aba === 'transferencias' ? (
              fila?.transferencias.length ? (
                <div className="rounded-md border bg-card divide-y">
                  {fila.transferencias.map((tr) => (
                    <div key={tr.id} className="flex flex-wrap items-baseline gap-x-3 px-3 py-2">
                      <span className="text-[12.5px] font-medium">{tr.descricao}</span>
                      <span className="text-[11.5px] text-muted-foreground tabular-nums">
                        {formatBRL(Math.abs(tr.valor))} · {dia(tr.data)} · {tr.conta}
                      </span>
                      <Link href={`/transferencias?empresaId=${empresaId}`} className="ml-auto text-[11px] underline">
                        parear
                      </Link>
                    </div>
                  ))}
                </div>
              ) : (
                <Vazio
                  titulo="Nenhuma transferência aguardando par"
                  texto="Toda saída de uma conta própria achou a entrada correspondente na outra. Zero aqui é zero — a aba não lista nada só pra parecer ocupada."
                />
              )
            ) : aba === 'duplicatas' ? (
              fila?.duplicatas.length ? (
                <div className="space-y-2">
                  {fila.duplicatas.map((d) => (
                    <div key={d.chave} className="rounded-md border bg-card px-3 py-2">
                      <p className="text-[12px] font-semibold tabular-nums">
                        {formatBRL(Math.abs(d.linhas[0].valor))} · {dia(d.linhas[0].data)} · {d.linhas[0].conta} · {d.linhas.length}×
                      </p>
                      {d.linhas.map((l) => (
                        <p key={l.id} className="text-[11.5px] text-muted-foreground">
                          FITID {l.fitid ?? '—'} · &quot;{l.descricao}&quot; · entrou {new Date(l.criadaEm).toLocaleString('pt-BR')}
                        </p>
                      ))}
                    </div>
                  ))}
                </div>
              ) : (
                <>
                  <Vazio
                    titulo="Nenhuma duplicata suspeita"
                    texto="Mesma conta, mesmo FITID, mesmo dia, mesmo valor e mesma descrição — nenhum grupo. O dedup do import está segurando."
                  />
                  {/* ⛔ a régua está escrita na tela porque ela é a decisão difícil aqui */}
                  <p className="text-[11.5px] text-muted-foreground px-1">
                    A régua ingênua (mesmo dia + mesmo valor) acusaria <b>84 grupos</b>, quase todos
                    Pix de pessoas diferentes com o mesmo valor. Alarme falso repetido mata o alarme.
                  </p>
                </>
              )
            ) : (
              <HistoricoTable empresaId={empresaId} onAfterUndo={carregar} />
            )}
          </div>
        </div>
      )}

      {/* a saída do Xero pro caso difícil — busca manual pela linha do extrato */}
      {procurando && empresaId && (
        <div className="rounded-lg border bg-card p-3">
          <FindAndMatchPanel
            empresaId={empresaId}
            ofx={{
              id: procurando.extrato.id,
              description: procurando.extrato.descricao,
              amount: procurando.extrato.valor,
              date: procurando.extrato.data,
              type: procurando.extrato.tipo,
            }}
            onCancel={() => setProcurando(null)}
            onReconciled={() => { setProcurando(null); void carregar() }}
          />
        </div>
      )}
    </div>
  )
}

/** ⭐ CONTADOR HONESTO: zero mostra zero, apagado — nunca lista fantasma pra
 *  parecer ocupada. Enquanto carrega mostra "…", não um número chutado. */
function Tab({ ativa, onClick, rotulo, n }: {
  ativa: boolean; onClick: () => void; rotulo: string; n: number | null
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={ativa}
      onClick={onClick}
      className={`inline-flex items-center gap-2 px-3 py-2.5 text-[12.5px] border-b-2 -mb-px transition-colors ${
        ativa
          ? 'border-emerald-600 text-foreground font-semibold'
          : 'border-transparent text-muted-foreground hover:text-foreground'
      }`}
    >
      {rotulo}
      <span className={`text-[11px] font-semibold tabular-nums rounded-full border px-1.5 min-w-[20px] text-center ${
        ativa ? 'border-emerald-600 text-emerald-700 bg-emerald-50 dark:bg-emerald-950 dark:text-emerald-300'
          : n === 0 ? 'text-muted-foreground' : ''
      }`}>
        {n === null ? '…' : n}
      </span>
    </button>
  )
}

function Vazio({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <div className="rounded-lg border border-dashed bg-card py-8 px-4 text-center flex flex-col items-center gap-1">
      <CheckCircle2 className="h-5 w-5 text-emerald-600 mb-1" />
      <span className="text-sm font-semibold">{titulo}</span>
      <span className="text-xs text-muted-foreground max-w-[46ch]">{texto}</span>
    </div>
  )
}
