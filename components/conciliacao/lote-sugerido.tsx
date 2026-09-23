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

import { useState, useMemo } from 'react'
import { Link2, Loader2, Search, Layers } from 'lucide-react'
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
  /** ⭐ 23/09 — renderiza SÓ o painel: o chassi ≍ é do cartão da linha (uma lista só) */
  comoPainel?: boolean
  /**
   * ⭐⭐ A RESPOSTA DO SELETOR ESQUERDO (23/09) — uma pergunta, UM lugar.
   *
   * ⛔ O seletor de categoria mora na coluna da esquerda do chassi, que é do cartão da
   * LINHA. Este componente desenha só o painel da direita; sem receber a resposta, o
   * Vincular exigiria algo que a esquerda entrega e ele não vê — foi exatamente o beco
   * que o dono achou navegando.
   */
  categoriaEscolhida?: string | null
}

/**
 * ⭐⭐⭐ O PAINEL DO LOTE — extraído em 23/09 pra a arquitetura de **UMA LISTA SÓ**.
 *
 * ⛔ Com o lote virando o CASO de uma linha da caixa, quem desenha o chassi ≍ (e a coluna
 * *O BANCO DIZ*) é o cartão da própria linha. Se este componente continuasse trazendo o
 * chassi junto, a coluna do banco apareceria **duas vezes dentro do mesmo cartão**.
 *
 * ⚠️ Nada de REGRA mudou: é o mesmo corpo, com o mesmo `vincular()` pela porta única e a
 * mesma pergunta da categoria. Só a moldura saiu.
 */
export function LoteSugerido({ lote, onVinculado, onProcurar, empresaId, categoriaEscolhida }: Props) {
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
  const faltamCategoria = categoriaEscolhida
    // ⭐ respondido na esquerda: o servidor grava nas N e o botão libera
    ? []
    : lote.notas.filter((n) => marcadas.has(n.id) && n.temCategoria === false)

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

  /** ⭐ o painel da direita — as N notas, a conta viva e o gesto */
  const painel = (
    <>
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
    </>
  )

  /** ⛔ a tira do PORQUÊ viaja junto do painel: sugestão sem motivo não existe (07/09) */
  const rodape = (
  /* ⛔ A TIRA DO PORQUÊ — sem ela a sugestão não pode existir */
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
        onClick={() => void vincular(categoriaEscolhida ?? undefined)} className="h-8 gap-1.5 px-3 text-xs">
        {ocupado ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Link2 className="h-3.5 w-3.5" />}
        Vincular {marcadas.size} nota{marcadas.size === 1 ? '' : 's'}
      </Button>
      {faltamCategoria.length > 0 && (
        <span className="text-[11px] text-amber-700 dark:text-amber-400">
          {/*
            ⛔ A frase TEM que apontar pro controle. *"diga a categoria primeiro"* sozinho
            é a exigência sem a porta — foi exatamente o beco de 23/09, em que o botão
            cobrava e a esquerda dizia "não é comigo". Exigência aponta pra onde responder.
          */}
          escolha a categoria na esquerda ← · ela grava nas {faltamCategoria.length} contas
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
  )

  /**
   * ⭐⭐ ESTE COMPONENTE É SÓ O PAINEL (23/09) — o chassi ≍ (com a coluna *O BANCO DIZ*) e
   * o seletor de categoria são do cartão da LINHA, na lista única.
   *
   * ⛔ O ramo do card inteiro (com chassi próprio + o cabeçalho "Um pagamento, N notas")
   * **morreu junto com a seção**: ficou com ZERO chamadores, e código sem chamador é o que
   * alguém religa por descuido — foi assim que o `<select>` morto do Pendentes sobreviveu
   * meses guardando um gesto que caía no vazio (15/09).
   */
  return <div className="min-w-0">{painel}{rodape}</div>
}

/*
 * ⛔ O `SeletorDoLote` MORREU AQUI (23/09) — ele vivia no `abaixoDoValor` do chassi que
 * este componente desenhava, e no modo painel esse chassi não existe. Era essa a metade
 * invisível do beco: o botão exigia categoria e o seletor não renderizava.
 *
 * ⭐ A pergunta passou pra coluna ESQUERDA do cartão da linha, que é onde ela sempre
 * morou nas outras famílias (a régua de 20/09) — uma pergunta, um lugar.
 */
