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
import { CheckCircle2, FileText, Loader2, AlertTriangle, History, Layers, ChevronDown, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
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
import { LoteSugerido, type LoteDTO } from '@/components/conciliacao/lote-sugerido'
import { useToast } from '@/components/ui/use-toast'
import { fetchJson } from '@/lib/http/fetch-json'

interface TransferenciaDTO {
  id: string; descricao: string; valor: number; data: string; tipo: string; conta: string
}
interface DuplicataDTO {
  chave: string
  linhas: { id: string; descricao: string; valor: number; data: string; conta: string; fitid: string | null; criadaEm: string }[]
}
interface LoteQueNaoFechaDTO {
  extratoId: string; descricao: string; valorDaLinha: number; data: string
  contaBancaria: string | null; fornecedorNome: string
  abertasDoFornecedor: number; somaDasAbertas: number
  motivo: 'NAO_FECHA' | 'AMBIGUO'; combinacoes: number
}
interface FilaDTO {
  contas: ContaDaFilaDTO[]
  lotes: LoteDTO[]
  lotesQueNaoFecham: LoteQueNaoFechaDTO[]
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
  /** ⭐ o Find & Match aberto a partir de um LOTE — leva o nome do fornecedor na busca */
  const [procurandoLote, setProcurandoLote] = useState<
    { ofx: { id: string; description: string; amount: number; date: string; type: string }; busca: string } | null
  >(null)
  const [naoFechamAberto, setNaoFechamAberto] = useState(false)

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

  /**
   * ⭐ LOTE VINCULADO: some o card e somem as N notas.
   *
   * ⛔ E a LINHA foi GASTA: ela sai de toda outra sugestão na hora — a mesma regra que
   * evitou, em 08/09, que o card concorrente do Cancian continuasse clicável até o F5.
   */
  const removerLote = useCallback((extratoId: string, notasIds: string[]) => {
    const ids = new Set(notasIds)
    setFila((f) => {
      if (!f) return f
      const lotes = f.lotes.filter((l) => l.extratoId !== extratoId)
      const contas = f.contas
        .filter((c) => !ids.has(c.conta.id))
        .map((c) => ({ ...c, sugestoes: c.sugestoes.filter((s) => s.extratoId !== extratoId) }))
      return { ...f, lotes, contas,
        lotesQueNaoFecham: f.lotesQueNaoFecham.filter((x) => x.extratoId !== extratoId),
        totais: { ...f.totais, lotes: lotes.length,
          notasEmLote: lotes.reduce((n, l) => n + l.notas.length, 0),
          comSugestao: contas.filter((c) => c.sugestoes.length > 0).length } }
    })
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
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
          {/* ── ABAS + saídas laterais ─────────────────────────────────── */}
          <div className="flex items-center gap-1 overflow-x-auto border-b border-slate-200 px-2 dark:border-slate-800">
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

          <div className="space-y-2.5 bg-slate-50/60 p-3 dark:bg-slate-900/40">
            {carregando ? (
              <div className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white py-10 text-[13px] text-slate-400 dark:border-slate-800 dark:bg-slate-950">
                <Loader2 className="h-4 w-4 animate-spin" /> procurando os pares…
              </div>
            ) : aba === 'contas' ? (
              <>
                {/* ⭐⭐⭐ A ORDEM DO FLUXO, ESCRITA NA TELA (padrão Xero/QuickBooks):
                    CASAR ANTES DE CATEGORIZAR. A categoria da conta a pagar vem junto
                    quando o vínculo é feito; só o que não casou precisa de categoria. */}
                <p className="px-1 text-[11.5px] leading-relaxed text-slate-400">
                  <b className="font-semibold text-slate-500 dark:text-slate-300">Passo 2 de 2.</b>{' '}
                  Importou o extrato → o óbvio já casou no import → aqui fica o que precisa da sua
                  decisão. <b>Casar vem antes de categorizar</b>: ao vincular, a conta a pagar leva
                  a categoria dela junto. Linha que você já categorizou como despesa{' '}
                  <b>continua casável</b> — ter categoria não quita conta nenhuma.
                </p>

                {/* ⭐ OS LOTES PRIMEIRO: um PIX que liquida N notas resolve mais trabalho
                    por decisão do que qualquer card 1:1, e as notas dele sumiriam da lista
                    de baixo de qualquer jeito. */}
                {(fila?.lotes ?? []).map((l) => (
                  <LoteSugerido
                    key={l.extratoId}
                    lote={l}
                    linha={{
                      descricao: l.linha.descricao, data: l.linha.data,
                      conta: l.linha.conta, categoria: l.linha.categoria,
                    }}
                    onVinculado={removerLote}
                    onProcurar={(extratoId, busca) => setProcurandoLote({
                      ofx: { id: extratoId, description: l.linha.descricao,
                        amount: l.valorDaLinha, date: l.linha.data, type: 'DEBIT' },
                      busca,
                    })}
                  />
                ))}

                {duplaContagem > 0 && (
                  <div className="flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-[12.5px] leading-relaxed text-rose-900 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" />
                    <span>
                      <b>{duplaContagem} conta{duplaContagem > 1 ? 's' : ''} em dupla contagem.</b>{' '}
                      Já {duplaContagem > 1 ? 'foram marcadas' : 'foi marcada'} como paga
                      {duplaContagem > 1 ? 's' : ''}, mas ficou sem vínculo — o mesmo dinheiro está
                      em duas linhas, e o saldo mente até alguém costurar.
                    </span>
                  </div>
                )}

                {(fila?.lotesQueNaoFecham.length ?? 0) > 0 && (
                  <div className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
                    <button type="button" onClick={() => setNaoFechamAberto((v) => !v)}
                      aria-expanded={naoFechamAberto}
                      className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-[12.5px] text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-900/50">
                      <Layers className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                      <span>
                        <b>{fila!.lotesQueNaoFecham.length} pagamentos</b> nomeiam um fornecedor
                        que tem notas abertas, mas <b>nenhuma combinação fecha</b> na soma.
                      </span>
                      <ChevronDown className={`ml-auto h-4 w-4 shrink-0 text-slate-400 transition-transform ${naoFechamAberto ? 'rotate-180' : ''}`} />
                    </button>
                    {naoFechamAberto && (
                      <div className="border-t border-slate-100 dark:border-slate-800">
                        {/* ⚠️ o motivo fica escrito: quase sempre é pagamento parcial, ou
                            cobre uma nota que nunca entrou no sistema. Some da tela seria o
                            "erro disfarçado de vazio" que esta casa já pagou caro. */}
                        <p className="px-4 py-2 text-[11.5px] leading-relaxed text-slate-400">
                          Isso costuma ser <b>pagamento parcial</b> ou pagamento de uma nota que
                          não está no sistema. O sistema não escolhe quais notas foram —
                          &quot;escolher na mão&quot; abre a busca já no nome do fornecedor, com a
                          soma conferida contra a linha antes de gravar.
                        </p>
                        {fila!.lotesQueNaoFecham.map((x) => (
                          <div key={x.extratoId} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-t border-slate-50 px-4 py-2 dark:border-slate-900">
                            <span className="text-[12.5px] font-semibold tabular-nums text-slate-800 dark:text-slate-100">
                              {formatBRL(x.valorDaLinha)}
                            </span>
                            <span className="text-[12px] text-slate-600 dark:text-slate-300">{x.fornecedorNome}</span>
                            <span className="text-[11px] tabular-nums text-slate-400">
                              {dia(x.data)}{x.contaBancaria ? ` · ${x.contaBancaria}` : ''} ·{' '}
                              {x.motivo === 'AMBIGUO'
                                ? `${x.combinacoes}+ combinações fechariam — o sistema não sabe qual foi`
                                : `${x.abertasDoFornecedor} notas abertas somam ${formatBRL(x.somaDasAbertas)}`}
                            </span>
                            <Button size="sm" variant="ghost"
                              onClick={() => setProcurandoLote({
                                ofx: { id: x.extratoId, description: x.descricao,
                                  amount: x.valorDaLinha, date: x.data, type: 'DEBIT' },
                                busca: x.fornecedorNome,
                              })}
                              className="ml-auto h-7 gap-1 px-2 text-[11.5px] text-slate-500">
                              <Search className="h-3.5 w-3.5" /> escolher na mão
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {comSugestao.length === 0 && (fila?.lotes.length ?? 0) === 0 ? (
                  <Vazio
                    titulo="Tudo conciliado ✓"
                    texto="Nenhum vínculo esperando decisão. O próximo extrato traz os novos pares — com o motivo escrito, pra você só confirmar."
                  />
                ) : (
                  comSugestao.map((c) => (
                    <div key={c.conta.id} className="space-y-2.5">
                      {/* ⚠️ dupla contagem SEM par: não há gesto honesto a oferecer
                          (o Find & Match parte de uma linha do extrato, e aqui não
                          existe candidata). Então ela aparece dizendo exatamente o
                          que é — sumir seria pior. */}
                      {c.sugestoes.length === 0 && (
                        <div className="rounded-xl border border-rose-200 bg-white px-4 py-3 dark:border-rose-900 dark:bg-slate-950">
                          <div className="flex flex-wrap items-baseline gap-x-2.5">
                            <span className="text-[17px] font-semibold tabular-nums text-slate-900 dark:text-slate-50">
                              {formatBRL(Math.abs(c.conta.valor))}
                            </span>
                            <span className="text-[12.5px] text-slate-600 dark:text-slate-300">{c.conta.descricao}</span>
                            <span className="text-[11px] tabular-nums text-slate-400">vence {dia(c.conta.data)}</span>
                          </div>
                          <p className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-700 dark:bg-rose-950/50 dark:text-rose-300">
                            marcada como paga e sem vínculo — o mesmo dinheiro em duas linhas
                          </p>
                          <p className="mt-1.5 text-[11.5px] leading-relaxed text-slate-400">
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
                        <p className="px-1 text-[11.5px] leading-relaxed text-slate-400">
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
                <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-950">
                  {fila.transferencias.map((tr) => (
                    <div key={tr.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-4 py-2.5">
                      <span className="text-[12.5px] font-medium text-slate-800 dark:text-slate-100">{tr.descricao}</span>
                      <span className="text-[11.5px] tabular-nums text-slate-400">
                        {formatBRL(Math.abs(tr.valor))} · {dia(tr.data)} · {tr.conta}
                      </span>
                      <Link href={`/transferencias?empresaId=${empresaId}`} className="ml-auto text-[11.5px] font-medium text-[#534AB7] hover:underline dark:text-indigo-400">
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
                    <div key={d.chave} className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 dark:border-slate-800 dark:bg-slate-950">
                      <p className="text-[12.5px] font-semibold tabular-nums text-slate-800 dark:text-slate-100">
                        {formatBRL(Math.abs(d.linhas[0].valor))} · {dia(d.linhas[0].data)} · {d.linhas[0].conta} · {d.linhas.length}×
                      </p>
                      {d.linhas.map((l) => (
                        <p key={l.id} className="text-[11.5px] text-slate-400">
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
                  <p className="px-1 text-[11.5px] leading-relaxed text-slate-400">
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

      {/* ⭐ o Find & Match em MODO LOTE: ele já seleciona N contas e confere a soma
          contra a linha antes de gravar — o que faltava era CHEGAR aqui com o
          fornecedor na busca em vez de procurá-lo de novo numa lista de 100. */}
      {procurandoLote && empresaId && (
        <div className="rounded-xl border border-[#534AB7]/30 bg-white p-3 dark:border-indigo-900 dark:bg-slate-950">
          <p className="px-1 pb-2 text-[12px] leading-relaxed text-slate-500 dark:text-slate-400">
            <b className="text-slate-700 dark:text-slate-200">Escolha as notas deste pagamento.</b>{' '}
            Marque quantas quiser — o rodapé soma e só libera quando bater com a linha do
            extrato. Se sobrar diferença de juros/tarifa, dá pra lançar como ajuste.
          </p>
          <FindAndMatchPanel
            empresaId={empresaId}
            ofx={procurandoLote.ofx}
            buscaInicial={procurandoLote.busca}
            onCancel={() => setProcurandoLote(null)}
            onReconciled={() => { setProcurandoLote(null); void carregar() }}
          />
        </div>
      )}

      {/* a saída do Xero pro caso difícil — busca manual pela linha do extrato */}
      {procurando && empresaId && (
        <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950">
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
/**
 * ⭐ ABA no padrão do resto do sistema (`-mb-px border-b-2`, o mesmo da Vendas),
 * com o primário ROXO da casa e o contador em pill.
 *
 * ⛔ CONTADOR HONESTO: zero mostra zero, apagado — nunca lista fantasma pra
 * parecer ocupada. Enquanto carrega mostra "…", não um número chutado.
 */
function Tab({ ativa, onClick, rotulo, n }: {
  ativa: boolean; onClick: () => void; rotulo: string; n: number | null
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={ativa}
      onClick={onClick}
      className={`-mb-px inline-flex shrink-0 items-center gap-2 whitespace-nowrap border-b-2 px-3 py-2.5 text-[13px] transition-colors ${
        ativa
          ? 'border-[#534AB7] font-semibold text-[#534AB7] dark:border-indigo-400 dark:text-indigo-300'
          : 'border-transparent font-medium text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
      }`}
    >
      {rotulo}
      <span className={`min-w-[20px] rounded-full px-1.5 py-px text-center text-[11px] font-semibold tabular-nums ${
        ativa
          ? 'bg-[#534AB7] text-white dark:bg-indigo-500'
          : n === 0
            ? 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500'
            : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-200'
      }`}>
        {n === null ? '…' : n}
      </span>
    </button>
  )
}

/**
 * ⭐ O ESTADO VAZIO É O ESTADO NORMAL DESTA TELA, daqui pra frente — então ele
 * não pode parecer "não carregou". Ele afirma o que está certo e diz o que vem
 * a seguir, sem pedir ação nenhuma.
 */
function Vazio({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <div className="flex flex-col items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-6 py-10 text-center dark:border-slate-800 dark:bg-slate-950">
      <span className="mb-1 flex h-11 w-11 items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-950/50">
        <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
      </span>
      <span className="text-[15px] font-semibold text-slate-800 dark:text-slate-100">{titulo}</span>
      <span className="max-w-[52ch] text-[12.5px] leading-relaxed text-slate-400">{texto}</span>
    </div>
  )
}
