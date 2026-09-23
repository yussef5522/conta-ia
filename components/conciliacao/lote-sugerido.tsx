'use client'

// ⭐⭐⭐ O CARD DO PAGAMENTO EM LOTE (09/09/2026) — 1 PIX liquida N notas.
//
// **O dono:** *"fornecedor pequeno com VÁRIAS notinhas — eu pago JUNTO, num PIX só."*
//
// Segue a MESMA gramática do card 1:1 (`par-sugerido.tsx`): chão FRIO à esquerda é o
// extrato, chão QUENTE à direita é o que a gente devia, e a tira do porquê é obrigatória.
// A diferença é que o lado quente é uma LISTA com caixas de marcar.
//
// ⛔⛔ AS CAIXAS COMEÇAM TODAS MARCADAS **e a soma é recalculada a cada clique** — o botão
// só habilita quando a soma bate com a linha ao centavo. Não existe caminho em que o dono
// confirme um lote que não fecha: o servidor recusaria de todo jeito (a validação de soma
// do `/find-and-match/reconcile`), e deixar o botão vivo seria prometer o que não vai
// acontecer.

import { useEffect, useState, useMemo } from 'react'
import { Link2, Loader2, Search, Layers } from 'lucide-react'
import { ChassiDoCartao } from './chassi-do-cartao'
import { MenuDoChip } from './menu-do-chip'
import { fetchComTimeout } from '@/lib/http/fetch-com-timeout'
import { secoesDoMenu, type CategoriaDoMenu } from '@/lib/conciliacao/categorias-do-gesto'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/use-toast'
import { formatBRL } from '@/lib/format/money'

/** o que a tela precisa saber da linha do extrato pra desenhar o lado frio */
export interface LinhaDoLoteDTO {
  descricao: string
  data: string
  conta: string | null
  categoria: string | null
}

export interface NotaDoLoteDTO {
  /** ⭐ 23/09 — sem isto a tela prometia um gesto que o servidor ia recusar */
  temCategoria?: boolean
  id: string
  descricao: string
  valor: number
  vencimento: string
}

export interface LoteDTO {
  extratoId: string
  /** ⭐ a linha do extrato vem ECOADA do servidor — a tela não busca de novo */
  linha: LinhaDoLoteDTO
  fornecedorId: string
  fornecedorNome: string
  notas: NotaDoLoteDTO[]
  soma: number
  valorDaLinha: number
  diferenca: number
  porQue: string
  abertasDoFornecedor: number
}


const dia = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { timeZone: 'UTC' })
/** a mesma tolerância do endpoint que grava — tela e servidor com a mesma régua */
const TOLERANCIA = 0.02

interface Props {
  lote: LoteDTO
  linha: LinhaDoLoteDTO
  onVinculado: (extratoId: string, notasIds: string[]) => void
  onProcurar: (extratoId: string, busca: string) => void
  /** ⭐ 23/09 — pra carregar as categorias do menu (a mesma rota que o balcão usa) */
  empresaId: string
}

export function LoteSugerido({ lote, linha, onVinculado, onProcurar, empresaId }: Props) {
  const { toast } = useToast()
  const [ocupado, setOcupado] = useState(false)
  const [pedindoCategoria, setPedindoCategoria] = useState(false)
  const [marcadas, setMarcadas] = useState<Set<string>>(
    () => new Set(lote.notas.map((n) => n.id)),
  )

  const soma = useMemo(
    () => Math.round(lote.notas.filter((n) => marcadas.has(n.id))
      .reduce((s, n) => s + n.valor, 0) * 100) / 100,
    [lote.notas, marcadas],
  )
  const diferenca = Math.round((lote.valorDaLinha - soma) * 100) / 100
  const bate = Math.abs(diferenca) <= TOLERANCIA && marcadas.size > 0
  /**
   * ⭐⭐ A PERGUNTA VEM ANTES DO CLIQUE — *"fazer o dono clicar pra levar um não é trabalho
   * que dava pra poupar"* (a régua de 20/09, do seletor da caixa).
   * ⚠️ Só conta o que está MARCADO: desmarcar a única sem categoria resolve sozinho.
   */
  const faltamCategoria = lote.notas.filter((n) => marcadas.has(n.id) && n.temCategoria === false)

  /**
   * ⭐⭐⭐ 23/09 — O LOTE PASSOU A USAR A PORTA ÚNICA, e isso fecha um furo real.
   *
   * ⛔⛔ Ele postava em `/find-and-match/reconcile` — uma rota PRÓPRIA, **fora** do
   * `resolverLinha`, que é onde o `PEDE_CATEGORIA` mora (20/09). Resultado: as 6 notas da
   * MARIA LUIZA, **todas sem categoria**, seriam conciliadas e sairiam da caixa sem
   * classificação nenhuma — a despesa não entraria em DRE nenhum. *"N caminhos, 1
   * esquecido"*, agora na regra que existe justamente pra isso não acontecer.
   *
   * ⭐ Com a porta única, a regra vale de graça — e vale pro N inteiro, não pra 1.
   */
  async function vincular(categoryId?: string) {
    setOcupado(true)
    try {
      const res = await fetch('/api/conciliacao/resolver', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          /**
           * ⚠️⚠️ `empresaId` É OBRIGATÓRIO na rota — e a PROVA EM PROD foi quem pegou a
           * falta: HTTP 400 *"Gesto inválido"*. Os testes chamam o `resolverLinha` direto
           * e passam por cima do schema do zod. ***Testar a lib não prova o encaixe da
           * rota*** — a mesma lição do mock que escondeu o contrato em 20/09.
           */
          empresaId,
          txId: lote.extratoId, acao: 'CASAR_PAGAR',
          contaIds: [...marcadas],
          ...(categoryId ? { categoryId } : {}),
        }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        /**
         * ⭐ A RECUSA VIRA A PERGUNTA, NA PRÓPRIA TELA — e ela é UMA pra as N.
         * ⚠️ O dono não deve descobrir isto clicando: a tela já pede antes (ver
         * `faltamCategoria`). Este ramo é a rede — a régua mora no SERVIDOR, e quem só
         * escondesse o botão perderia a trava no dia em que a rota fosse chamada de outro
         * lugar (a lição do FREIO da contagem, 23/08).
         */
        if (body?.code === 'PEDE_CATEGORIA') { setPedindoCategoria(true); return }
        toast({ variant: 'destructive', title: 'Não deu pra vincular o lote', description: body?.erro ?? `HTTP ${res.status}` })
        return
      }
      toast({
        title: `${marcadas.size} notas liquidadas`,
        description: categoryId
          ? `Todas apontam pra a mesma linha do extrato — e a categoria ficou gravada nas ${marcadas.size}.`
          : `Todas apontam pra a mesma linha do extrato — o pagamento do ${lote.fornecedorNome}.`,
      })
      onVinculado(lote.extratoId, [...marcadas])
    } catch {
      toast({ variant: 'destructive', title: 'Falha de rede', description: 'Tenta de novo.' })
    } finally { setOcupado(false) }
  }

  return (
    <article className="overflow-hidden rounded-xl border border-[#534AB7]/30 bg-white shadow-sm transition-shadow hover:shadow dark:border-indigo-900 dark:bg-slate-950">
      <div className="flex items-center gap-2 border-b border-[#534AB7]/20 bg-[#534AB7]/[0.06] px-4 py-2 text-[12px] text-[#3d3688] dark:border-indigo-900 dark:bg-indigo-950/30 dark:text-indigo-200">
        <Layers className="h-3.5 w-3.5 shrink-0" />
        <span>
          <b>Um pagamento, {lote.notas.length} notas.</b> Parece o PIX que liquidou várias
          notinhas do {lote.fornecedorNome} de uma vez.
        </span>
      </div>

      <ChassiDoCartao
        moldura={false}
        painelColado
        banco={{
          conta: linha.conta, descricao: linha.descricao, data: linha.data.slice(0, 10),
          valor: lote.valorDaLinha, credito: false,
        }}
        abaixoDoValor={
          /**
           * ⭐⭐ UMA PERGUNTA PRAS N (decisão do dono). O seletor mora do lado ESQUERDO,
           * como na caixa (20/09) — e a frase diz que a resposta vale pras N e FICA.
           * ⛔ Por-nota diferente não se resolve aqui: aí é "Escolher na mão", onde cada
           * nota tem a sua linha. Oferecer N seletores aqui seria transformar o card do
           * lote no painel manual, e o lote existe justamente pra o caso "todas iguais".
           */
          faltamCategoria.length ? (
            <SeletorDoLote
              empresaId={empresaId}
              quantas={faltamCategoria.length}
              total={marcadas.size}
              aberto={pedindoCategoria}
              aoAbrir={setPedindoCategoria}
              aoEscolher={(id) => { setPedindoCategoria(false); void vincular(id) }}
            />
          ) : null
        }
      >
        {/* ── lado QUENTE: as notas ── */}
        <div className="min-w-0 bg-amber-50/40 px-4 py-3 dark:bg-amber-950/10">
          <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
            {lote.notas.length} contas a pagar em aberto · {lote.fornecedorNome}
          </span>
          <ul className="mt-1.5 space-y-1">
            {lote.notas.map((n) => (
              <li key={n.id}>
                {/* ⭐ a linha inteira é clicável — o alvo do dedo no celular é a linha,
                    não um quadradinho de 16px */}
                <label className="flex cursor-pointer items-baseline gap-2 rounded-md px-1 py-0.5 hover:bg-white/70 dark:hover:bg-slate-900/50">
                  <input
                    type="checkbox"
                    checked={marcadas.has(n.id)}
                    onChange={(e) => setMarcadas((m) => {
                      const novo = new Set(m)
                      if (e.target.checked) novo.add(n.id); else novo.delete(n.id)
                      return novo
                    })}
                    className="h-3.5 w-3.5 shrink-0 translate-y-0.5 rounded border-slate-300 accent-[#534AB7]"
                  />
                  <span className="w-[86px] shrink-0 text-right text-[12.5px] font-semibold tabular-nums text-slate-900 dark:text-slate-50">
                    {formatBRL(n.valor)}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[12px] text-slate-600 dark:text-slate-300">
                    {n.descricao}
                  </span>
                  <span className="shrink-0 text-[11px] tabular-nums text-slate-400">
                    vence {dia(n.vencimento)}
                  </span>
                </label>
              </li>
            ))}
          </ul>

          {/* ⛔ A CONTA À VISTA: o dono confere a soma contra a linha ANTES de confirmar,
              e ela muda a cada caixa desmarcada. */}
          <div className={`mt-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 rounded-lg border px-2.5 py-1.5 text-[12px] tabular-nums ${
            bate
              ? 'border-emerald-200 bg-emerald-50/70 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300'
              : 'border-rose-200 bg-rose-50/70 text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300'
          }`}>
            <span>
              {marcadas.size} marcada{marcadas.size === 1 ? '' : 's'}: <b>{formatBRL(soma)}</b>
            </span>
            <span>
              {bate
                ? '✓ bate com a linha do extrato'
                : `falta ${formatBRL(Math.abs(diferenca))} pra fechar${diferenca < 0 ? ' (passou)' : ''}`}
            </span>
          </div>
        </div>
      </ChassiDoCartao>

      {/* ⛔ A TIRA DO PORQUÊ — sem ela a sugestão não pode existir */}
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-2 border-t border-slate-200 bg-white px-4 py-2.5 dark:border-slate-800 dark:bg-slate-950">
        <span className="shrink-0 rounded-full bg-[#534AB7]/10 px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.06em] text-[#534AB7] dark:bg-indigo-950/50 dark:text-indigo-300">
          pagamento em lote
        </span>
        <span className="min-w-[180px] flex-1 text-[12px] leading-relaxed text-slate-500 dark:text-slate-400">
          {lote.porQue}
        </span>
        <span className="ml-auto flex items-center gap-1">
          {/* ⛔ SEM CATEGORIA, O VINCULAR NÃO LIBERA — e a frase DIZ por quê. Botão
              desabilitado mudo é o dono clicando e não entendendo. */}
          <Button size="sm" disabled={ocupado || !bate || faltamCategoria.length > 0}
            onClick={() => void vincular()} className="h-8 gap-1.5 px-3 text-xs">
            {ocupado ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Link2 className="h-3.5 w-3.5" />}
            Vincular {marcadas.size} nota{marcadas.size === 1 ? '' : 's'}
          </Button>
          {faltamCategoria.length > 0 && (
            <span className="text-[11px] text-amber-700 dark:text-amber-400">
              diga a categoria primeiro — ela grava nas {faltamCategoria.length}
            </span>
          )}
          <Button size="sm" variant="ghost" disabled={ocupado}
            onClick={() => onProcurar(lote.extratoId, lote.fornecedorNome)}
            className="h-8 gap-1 px-2.5 text-xs text-slate-500"
            title="escolher as notas na mão, com a soma conferida">
            <Search className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Escolher na mão</span>
          </Button>
        </span>
      </div>
    </article>
  )
}

/**
 * ⭐⭐ O SELETOR DO LOTE — UMA pergunta pras N.
 *
 * ⛔ Ele **não inventa uma segunda régua de categoria**: as seções vêm do mesmo
 * `secoesDoMenu` que a caixa usa (`CASAR_PAGAR`), então o que o lote oferece é exatamente
 * o que o balcão oferece. Um menu próprio aqui divergiria no primeiro grupo novo.
 */
function SeletorDoLote({ empresaId, quantas, total, aberto, aoAbrir, aoEscolher }: {
  empresaId: string
  quantas: number; total: number; aberto: boolean
  aoAbrir: (v: boolean) => void
  aoEscolher: (categoryId: string) => void
}) {
  const [categorias, setCategorias] = useState<CategoriaDoMenu[]>([])
  const [carga, setCarga] = useState<'CARREGANDO' | 'OK' | 'FALHOU'>('CARREGANDO')

  // ⚠️ `soAtivas=true`: a rota devolve o catálogo INTEIRO (263, das quais 60 ativas) e
  // oferecer inativa é oferecer o que a gravação recusa (a prova em prod de 18/09).
  useEffect(() => {
    let vivo = true
    fetchComTimeout<{ categorias?: CategoriaDoMenu[] }>(`/api/empresas/${empresaId}/categorias?soAtivas=true`)
      .then((r) => {
        if (!vivo) return
        if (r.ok && r.data?.categorias) { setCategorias(r.data.categorias); setCarga('OK') } else setCarga('FALHOU')
      })
    return () => { vivo = false }
  }, [empresaId])

  return (
    <div className="mt-2">
      <button
        onClick={() => aoAbrir(!aberto)}
        aria-expanded={aberto}
        className="w-full rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-1.5 text-left text-[11.5px] leading-snug text-amber-900 hover:bg-amber-100 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200"
      >
        {quantas === total
          ? <>as <b>{total}</b> estão sem categoria — são da mesma?</>
          : <><b>{quantas}</b> de {total} estão sem categoria — são da mesma?</>}
        <span className="mt-0.5 block text-amber-700/80 dark:text-amber-300/70">
          a resposta grava em CADA conta — a próxima nota do fornecedor já vem com ela
        </span>
      </button>
      {aberto && (
        <div className="mt-1.5">
          <MenuDoChip
            rotulo={carga === 'CARREGANDO' ? 'carregando…' : `aplicar nas ${quantas}`}
            icone="🏷️"
            className="inline-flex items-center gap-1.5 rounded-full border-[1.5px] border-amber-400 bg-white px-3 py-[7px] text-[12.5px] font-bold"
            /* ⛔ SAIDA: lote de conta a PAGAR. O menu é o MESMO do balcão (`secoesDoMenu`)
               — um menu próprio aqui divergiria no primeiro grupo novo. */
            secoes={secoesDoMenu(categorias, 'SAIDA').map((sec) => ({
              titulo: sec.titulo, ajuda: sec.ajuda,
              itens: sec.itens.map((c) => ({ id: c.id, nome: c.name })),
            }))}
            /* ⚠️ vazio que DIZ: "nenhuma categoria" com a carga falha seria uma afirmação
               sobre a empresa feita a partir de um erro de rede (18/09). */
            vazio={carga === 'FALHOU' ? 'não consegui carregar as categorias — tenta de novo' : 'nenhuma categoria ativa'}
            onEscolher={(id) => aoEscolher(id)}
          />
        </div>
      )}
    </div>
  )
}
