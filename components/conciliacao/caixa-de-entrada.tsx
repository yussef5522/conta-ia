'use client'

// ⭐⭐⭐ A CAIXA DE ENTRADA DO BANCO — o desenho do mock v3 (16/09/2026).
//
// **A régua:** `docs/mocks/conciliacao-caixa-mock-v3.html`, lido pelo guard
// `__tests__/regras-ui/caixa-bate-com-o-mock-v3.test.ts`. *Divergência do mock = defeito.*
//
// ⛔⛔ **ROUPA NOVA, MOTOR INTACTO.** Nenhuma régua de negócio mudou aqui: os degraus, a
// contenção, o corte de época e o "uma linha, uma estação" seguem onde estavam. O botão
// verde é o **mesmo confirmar** de ontem — o que mudou é que o rótulo agora diz **o
// efeito**, e os menus do sentido viraram **chips**.
//
// ⭐ **O CARTÃO ≍ é a estrela** (padrão Xero): à esquerda **O BANCO DIZ** (o fato bruto),
// à direita **MELHOR PALPITE** (o que o matcher achou, com a diferença SEMPRE nomeada), e
// no meio o conector. Quem não tem palpite abre direto nos chips — *ausência de palpite
// não pode virar linha morta*.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2, ArrowDownLeft, ArrowUpRight, Check, RefreshCw } from 'lucide-react'
import { fetchComTimeout } from '@/lib/http/fetch-com-timeout'
import { V3, SOMBRA, CONECTOR } from './mock-v3-tokens'
import { MenuDoChip, type SecaoDoChip } from './menu-do-chip'
import { FindAndMatchPanel } from './find-and-match-panel'
import { secoesDoMenu, type CategoriaDoMenu } from '@/lib/conciliacao/categorias-do-gesto'
import { estadoDoSeletor, podeDisparar, AVISO_CATEGORIA } from '@/lib/conciliacao/categoria-antes-do-gesto'
import type { AcaoDoBalcao } from '@/lib/conciliacao/caixa-de-entrada'
import { nomeDaBusca } from '@/lib/conciliacao/nome-da-busca'
import { conviteDaPonte, type ConviteDaPonte } from '@/lib/conciliacao/convite-da-ponte'
import { VAZIO, type EstadoDaCarga } from '@/lib/conciliacao/vazio-do-menu'
import { WithdrawalPanel } from '@/components/withdrawals/WithdrawalPanel'

interface AcaoDTO { acao: string; rotulo: string; pedeAlvo: string | null }
interface PalpiteDTO {
  acao: string; familia: string; titulo: string; detalhe: string
  diferenca: string; botao: string; alvo: Record<string, unknown>
  confianca: 'ALTA' | 'MEDIA' | 'BAIXA'
}
interface LinhaDTO {
  id: string; tipo: string; valor: number; data: string; descricao: string
  contraparte: string | null; conta: string | null
  sentido: 'SAIDA' | 'ENTRADA'; estacao: 'CAIXA' | 'ARQUIVO'
  resolvidaComo: string | null; acoes: AcaoDTO[]
  palpite: PalpiteDTO | null
  /** ⭐ a categoria da conta que o palpite de CASAR aponta (o seletor DIZ, não pede) */
  categoriaDaConta: string | null
  /**
   * ⭐⭐ QUANDO O CASO MORA NO CARD (20/09) — a linha perde o botão e ganha o CAMINHO.
   * ⛔ Nunca as duas superfícies com botão pro mesmo par.
   */
  casoNoCard: { texto: string; ancora: string } | null
}
interface CaixaDTO {
  contadores: { saidas: number; entradas: number; arquivo: number; total: number }
  progresso: { pct: number; resolvidas: number; naCaixa: number; frase: string }
  corte: string | null
  linhas: LinhaDTO[]
}

/** ⭐ os ids de conta que o palpite desta linha já carrega (um lugar só) */
function idsDoPalpite(l: LinhaDTO): string[] {
  const alvo = l.palpite?.alvo ?? {}
  if (Array.isArray(alvo.contaIds)) return (alvo.contaIds as string[]).filter((x) => typeof x === 'string')
  return typeof alvo.contaId === 'string' ? [alvo.contaId] : []
}

const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const dia = (d: string) => d.split('-').reverse().join('/')

/** ⭐ o emoji de cada ação — o mock põe um em cada chip */
const ICONE: Record<string, string> = {
  CASAR_PAGAR: '🧾', PGTO_CARTAO: '💳', PARCELA_EMPRESTIMO: '🏦',
  TRANSFERENCIA_ENVIADA: '⇄', TRANSFERENCIA_RECEBIDA: '⇄',
  CASAR_RECEBER: '🧾', RECEBIMENTO_VENDA: '💰', ESTORNO: '↩',
  CATEGORIA: '🏷', IGNORAR: '⌫',
}

export function CaixaDeEntrada({ empresaId }: { empresaId: string }) {
  const [caixa, setCaixa] = useState<CaixaDTO | null>(null)
  const [aba, setAba] = useState<'SAIDA' | 'ENTRADA'>('SAIDA')
  const [erro, setErro] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState<string | null>(null)
  const [feito, setFeito] = useState<{ id: string; titulo: string; selo: string } | null>(null)
  /**
   * ⭐⭐ O PAINEL DE CASAR, ABERTO **NA PRÓPRIA CAIXA** (17/09).
   *
   * ⛔⛔ Antes o chip *"casar com conta a pagar"* mandava o navegador pra `window.location`
   * — **um reload da MESMA tela**. Medido em prod com a linha do BAMBERG: o deep-link está
   * certo, o card existe no destino e a fila até abre o grupo — mas o reload **fecha o
   * cartão ≍, joga o scroll pro topo e deixa o painel abaixo da dobra**. No celular o dono
   * nunca chega a vê-lo: *"não abre painel nenhum — pior: a tela SAI/fecha o cartão"*.
   *
   * ⭐ Agora o alvo se escolhe **onde o gesto nasceu**. Não é um segundo card: é o MESMO
   * `FindAndMatchPanel` que o lote e a sugestão já abrem por props — e ele cobre PAYABLE
   * **e** RECEIVABLE, então o "casar com conta a receber" (cujo deep-link apontava pra uma
   * rota que **não existe**) passa a ter destino de verdade.
   */
  const [procurando, setProcurando] = useState<LinhaDTO | null>(null)
  /**
   * ⭐⭐ O CONVITE DA PONTE — o passo 2 da retirada (18/09).
   *
   * ⛔ Categorizar como Distribuição de Lucros gravava **só a categoria**: o dinheiro saía
   * da PJ e não entrava em lugar nenhum da PF. **Meia-ponte.** O convite vive FORA da lista
   * de linhas de propósito — a linha sai da caixa assim que é categorizada, e se o convite
   * morasse nela sumiria junto, no instante exato em que ele precisa aparecer.
   */
  const [ponte, setPonte] = useState<{ linha: LinhaDTO; convite: ConviteDaPonte } | null>(null)
  /**
   * ⛔⛔ **O ERRO DO GESTO MORA NA LINHA, NÃO NO TOPO DA TELA** (19/09).
   *
   * O dono clicou *"parcela de empréstimo"* e concluiu que *"nada aconteceu"* — o servidor
   * tinha RECUSADO, e a recusa foi parar num bloco no **topo da caixa**. No celular, com o
   * dedo num cartão no meio da lista, aquilo está fora da tela. ***Mensagem que o dono não
   * vê é silêncio*** — é a REGRA 2 de novo, agora na mensagem de erro.
   */
  const [erroDaLinha, setErroDaLinha] = useState<
    { id: string; texto: string; acao: string; alvo: Record<string, unknown> } | null
  >(null)
  /**
   * ⭐⭐⭐ **NADA SAI DA CAIXA SEM CATEGORIA** (20/09) — e a pergunta vem JUNTO DO GESTO.
   *
   * A régua do dono: *"casar com conta a pagar → HERDA da conta; ⛔ se a conta casada NÃO
   * TEM categoria, o confirmar pede ali e grava NA CONTA (aprende pra próxima)"*.
   *
   * ⛔ O servidor recusa com `code: 'PEDE_CATEGORIA'` e a tela reabre **o mesmo gesto**,
   * agora com o chip de categoria. ***Não é um segundo caminho*** — é o gesto esperando a
   * resposta que falta, na linha onde ele nasceu. Pedir depois seria pedir nunca: a linha
   * já teria saído da caixa.
   */
  const [pedeCategoria, setPedeCategoria] = useState<
    { linha: LinhaDTO; acao: string; alvo: Record<string, unknown>; texto: string } | null
  >(null)
  const [categorias, setCategorias] = useState<CategoriaDoMenu[]>([])
  const [contratos, setContratos] = useState<{ id: string; nome: string; detalhe: string; parcela: number }[]>([])
  /**
   * ⛔⛔ **VAZIO NÃO PODE AFIRMAR O QUE NÃO SABE.** As três listas carregam com falha MACIA:
   * se a chamada morre, o estado fica `[]` e o menu dizia *"nenhum contrato com parcela em
   * aberto"* — uma **afirmação** sobre a empresa, feita a partir de uma falha de rede. É o
   * *erro disfarçado de vazio*, a doença que esta casa mais paga. Agora cada lista sabe se
   * está CARREGANDO, se FALHOU ou se está de fato vazia, e a frase muda com isso.
   */
  const [cargas, setCargas] = useState<Record<'categorias' | 'cartoes' | 'contratos', 'CARREGANDO' | 'OK' | 'FALHOU'>>(
    { categorias: 'CARREGANDO', cartoes: 'CARREGANDO', contratos: 'CARREGANDO' },
  )
  const [cartoes, setCartoes] = useState<{ id: string; name: string }[]>([])

  const carregar = useCallback(async () => {
    // ⛔ COM TIMEOUT: spinner eterno é a ausência fingindo progresso (14/09)
    const r = await fetchComTimeout<CaixaDTO>(`/api/conciliacao/caixa?empresaId=${empresaId}`)
    if (!r.ok || !r.data) { setErro(r.erro ?? 'Não consegui carregar a caixa de entrada.'); return }
    setErro(null); setCaixa(r.data)
  }, [empresaId])

  useEffect(() => { void carregar() }, [carregar])
  /**
   * ⛔⛔⛔ **A PORTA DO MENU DE CATEGORIA NÃO EXISTIA** (achado em prod, 17/09). A caixa
   * pedia `/api/categorias?empresaId=…` — **rota que não existe em lugar nenhum do app**
   * (a real é `/api/empresas/[id]/categorias`, e devolve `{ categorias }`, não
   * `{ categories }`). O 404 devolvia HTML, o `fetchComTimeout` falhava macio, e o seletor
   * nascia **VAZIO**: o dono abria *"é despesa: categoria"* e não achava a Distribuição de
   * Lucros porque **não havia opção nenhuma ali**.
   *
   * ⚠️ *Falha macia sem ninguém olhando é falha silenciosa* — o menu ficou mudo desde que
   * nasceu e a tela nunca disse por quê. Agora o vazio **fala** (ver `vazio` no chip).
   */
  useEffect(() => {
    void (async () => {
      const [c, k, e] = await Promise.all([
        // ⛔ `soAtivas=true` — a rota devolve o catálogo inteiro (263 na Caçula, 60 ativas)
        fetchComTimeout<{ categorias?: CategoriaDoMenu[] }>(`/api/empresas/${empresaId}/categorias?soAtivas=true`),
        fetchComTimeout<{ cards?: { id: string; name: string }[] }>(`/api/empresas/${empresaId}/cartoes`),
        fetchComTimeout<{ loans?: { id: string; lender: string; contractNumber: string | null; proximaParcelaNumero: number | null; proximaParcelaDate: string | null; proximaParcelaValor: number | null }[] }>(`/api/empresas/${empresaId}/emprestimos`),
      ])
      setCargas({
        categorias: c.ok && c.data?.categorias ? 'OK' : 'FALHOU',
        cartoes: k.ok && k.data?.cards ? 'OK' : 'FALHOU',
        contratos: e.ok && e.data?.loans ? 'OK' : 'FALHOU',
      })
      if (c.ok && c.data?.categorias) setCategorias(c.data.categorias)
      if (k.ok && k.data?.cards) setCartoes(k.data.cards)
      if (e.ok && e.data?.loans) {
        // ⭐ o menu do contrato já leva A PARCELA — o servidor exige as duas coisas, e
        // pedir contrato num toque e parcela noutro seria o gesto pela metade de novo.
        setContratos(e.data.loans
          .filter((l) => l.proximaParcelaNumero != null)
          .map((l) => ({
            id: l.id,
            parcela: l.proximaParcelaNumero!,
            nome: `${l.lender}${l.contractNumber ? ` · ${l.contractNumber}` : ''}`,
            detalhe: `parcela ${l.proximaParcelaNumero}${l.proximaParcelaDate ? ` · vence ${dia(l.proximaParcelaDate.slice(0, 10))}` : ''}${l.proximaParcelaValor != null ? ` · ${brl(l.proximaParcelaValor)}` : ''}`,
          })))
      }
    })()
  }, [empresaId])

  // ⚠️ a faixa some sozinha — feedback que fica vira móvel fixo e se aprende a ignorar
  useEffect(() => {
    if (!feito) return
    const t = setTimeout(() => setFeito(null), 6000)
    return () => clearTimeout(t)
  }, [feito])

  /**
   * ⭐⭐ O GESTO — **o mesmo de ontem**. ⛔ Ele não termina em "marquei": ou o servidor
   * devolve o EFEITO no destino, ou devolve o CAMINHO onde o alvo se escolhe.
   * **Silêncio não é desfecho** (14/09).
   */
  const gesto = useCallback(async (linha: LinhaDTO, acao: string, alvo: Record<string, unknown> = {}) => {
    /**
     * ⭐⭐ CASAR ABRE O PAINEL **AQUI**, sem sair da tela — mas só quando ainda não há alvo.
     *
     * ⛔⛔ **O BUG DA ELIANE (20/09):** o palpite acendia com o candidato **POR ID** e este
     * ramo o **descartava**, abrindo o painel — que re-busca **POR NOME** do extrato e
     * devolvia *"nenhuma conta bate com ELIANE GARCIA"* (medido: não existe fornecedor nem
     * conta com esse nome). ***Palpite aceso e painel dizendo "não achei" eram duas réguas
     * discordando sobre a mesma linha.***
     *
     * ⭐ Com id, o gesto segue pro servidor e EFETIVA pela porta de sempre
     * (`reconcileTransactions`). Sem id, o painel abre — ele é o caminho MANUAL.
     */
    const idsDoAlvo = Array.isArray(alvo.contaIds)
      ? (alvo.contaIds as string[])
      : typeof alvo.contaId === 'string' ? [alvo.contaId] : []
    if ((acao === 'CASAR_PAGAR' || acao === 'CASAR_RECEBER') && !idsDoAlvo.length) { setProcurando(linha); return }
    // ⭐ o servidor recebe SEMPRE a lista — `contaId` sozinho seria um 2º formato pro mesmo alvo
    if (idsDoAlvo.length) alvo = { ...alvo, contaIds: idsDoAlvo, contaId: undefined }
    setOcupado(linha.id); setErro(null); setErroDaLinha(null)
    try {
      const r = await fetchComTimeout<{ efeito?: string; deepLink?: string }>(`/api/conciliacao/resolver`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ empresaId, txId: linha.id, acao, ...alvo }), timeoutMs: 30_000,
      })
      if (!r.ok || !r.data) {
        /**
         * ⭐⭐ A RECUSA QUE PEDE CATEGORIA NÃO É ERRO — É O GESTO PERGUNTANDO.
         *
         * ⛔ Mostrá-la só como texto vermelho deixaria o dono lendo *"diga qual é"* sem
         * ter onde dizer — a porta sem maçaneta, dentro de uma mensagem de erro.
         */
        const code = (r.corpo as { code?: string } | null)?.code
        if (code === 'PEDE_CATEGORIA') {
          setPedeCategoria({ linha, acao, alvo, texto: r.erro ?? 'Essa conta não tem categoria — qual é?' })
          return
        }
        /**
         * ⛔⛔ **A FRASE DIZ O QUE FALHOU E SEMPRE TEM SAÍDA** (20/09). O dono via só
         * *"Não consegui carregar."* — o fallback do `fetchComTimeout` quando a resposta
         * **não traz `{erro}`** (era um 500 com corpo VAZIO). Sem motivo, sem saber se
         * gravou, e sem [tentar de novo]. ***Erro sem saída é beco.***
         */
        setErroDaLinha({
          id: linha.id, acao, alvo,
          texto: r.erro && r.erro !== 'Não consegui carregar.'
            ? r.erro
            : r.timeout
              ? 'O servidor demorou demais pra responder. Nada foi gravado.'
              : 'A conciliação não gravou — não consegui falar com o servidor. Nada foi alterado.',
        }); return
      }
      setPedeCategoria(null)
      if (r.data.deepLink) { window.location.href = r.data.deepLink; return }
      // ⭐ a faixa verde carrega O SELO DO COMO — a linha nunca sai em silêncio
      setFeito({
        id: linha.id,
        titulo: `${linha.descricao || '(sem descrição)'} ${brl(linha.valor)}`,
        selo: `${r.data.efeito ?? 'resolvida'} · no arquivo`,
      })
      /**
       * ⭐⭐ RETIRADA GRAVADA → O PASSO 2 ABRE **NA LINHA**, e a linha FICA até ele responder.
       *
       * ⛔⛔ A 1ª versão (18/09) mostrava o convite numa faixa acima da lista e recarregava
       * na hora — a linha saía da caixa e a faixa ficava solta no topo. O dono: *"aparece
       * uma mensagem em cima e ela DESAPARECE sozinha — depois eu não sei onde achar as
       * retiradas"*. ***Nada que some sozinho carrega decisão.***
       *
       * ⭐ Agora o gesto **não termina** na categoria: enquanto a ponte não for respondida
       * (mandar ou pular, explícito), a linha continua na caixa com o painel aberto nela.
       */
      const cat = categorias.find((x) => x.id === alvo.categoryId)
      const convite = conviteDaPonte(cat)
      if (convite) { setPonte({ linha, convite }); return }
      await carregar()   // ⭐ a linha sai da caixa NA HORA
    } finally { setOcupado(null) }
  }, [empresaId, carregar, categorias])

  const visiveis = useMemo(() => (caixa?.linhas ?? []).filter((l) => l.sentido === aba), [caixa, aba])

  if (erro && !caixa) {
    return (
      <div className="rounded-xl border px-3.5 py-2.5 text-[13px]"
        style={{ borderColor: V3.ambar, background: V3.ambarBg, color: V3.ambar }}>
        {erro}
        <button type="button" onClick={() => { setErro(null); void carregar() }} className="ml-1.5 font-semibold underline">tentar de novo</button>
      </div>
    )
  }
  if (!caixa) {
    return <div className="flex items-center gap-2 p-4 text-sm" style={{ color: V3.sub }}><Loader2 className="h-4 w-4 animate-spin" /> abrindo a caixa de entrada…</div>
  }

  const c = caixa.contadores
  const fecha = c.saidas + c.entradas + c.arquivo === c.total
  const p = caixa.progresso

  return (
    <div className="space-y-3">
      {/* ══════════ 1. CABEÇALHO — título, fluxo em pílulas, anel do mês ══════════ */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-[22px] font-bold tracking-[-0.01em]" style={{ color: V3.ink }}>Caixa de entrada do banco</h2>
          <p className="mt-0.5 text-[13px]" style={{ color: V3.sub }}>o banco diz o que aconteceu · você diz o que cada linha é</p>
        </div>

        {/* ⭐ o fluxo com a estação ACESA — o dono sempre sabe onde está */}
        <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-semibold" style={{ color: V3.sub }}>
          {(['BANCO', 'IMPORT', 'CAIXA', 'ARQUIVO'] as const).map((e, i) => (
            <span key={e} className="flex items-center gap-1.5">
              {i > 0 && <span className="opacity-55">→</span>}
              <b className="rounded-full px-2.5 py-[3px] font-extrabold"
                style={e === 'CAIXA' ? { background: V3.roxo, color: '#fff' } : { background: V3.roxoBg, color: V3.roxo }}>
                {e}
              </b>
            </span>
          ))}
        </div>

        {/*
          ⭐⭐ O ANEL DO MÊS — derivado dos MESMOS contadores das abas e do badge do menu.
          ⛔ Consulta própria pro anel seria a terceira derivação da mesma pergunta (o B1).
        */}
        <div className="flex items-center gap-2.5 rounded-2xl border px-3.5 py-2"
          style={{ background: V3.card, borderColor: V3.line, boxShadow: SOMBRA }}>
          <div className="flex h-10 w-10 items-center justify-center rounded-full"
            style={{ background: `conic-gradient(${V3.verde2} 0 ${p.pct}%, #e8e7f1 ${p.pct}% 100%)` }}>
            <i className="flex h-[30px] w-[30px] items-center justify-center rounded-full text-[10px] font-extrabold not-italic"
              style={{ background: V3.card, color: V3.verde }}>{p.pct}%</i>
          </div>
          <div>
            <div className="text-[11px] font-semibold" style={{ color: V3.sub }}>no período</div>
            <div className="text-[13.5px] font-extrabold" style={{ color: V3.ink }}>{p.frase}</div>
          </div>
        </div>
      </div>

      {/* ══════════ 3. ABAS — segmented control com badge ══════════ */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex gap-1 rounded-2xl p-1" style={{ background: '#e9e8f3' }}>
          {([['SAIDA', 'Saídas', c.saidas, ArrowUpRight], ['ENTRADA', 'Entradas', c.entradas, ArrowDownLeft]] as const).map(([k, rot, n, Icone]) => {
            const on = aba === k
            return (
              <button key={k} type="button" onClick={() => setAba(k)}
                className="flex items-center gap-2 rounded-[11px] px-4 py-2 text-[13.5px] font-bold"
                style={on ? { background: V3.card, color: V3.ink, boxShadow: '0 2px 8px rgba(23,26,38,.10)' } : { color: V3.sub }}>
                <Icone className="h-4 w-4" /> {rot}
                {/* ⚠️ badge CINZA quando zero — coral em zero seria alarme sem causa */}
                <span className="rounded-full px-2 py-[1px] text-[11px] font-extrabold text-white"
                  style={{ background: n === 0 ? '#d6d5e3' : on ? V3.roxo : V3.coral }}>{n}</span>
              </button>
            )
          })}
        </div>
        <div className="text-[12px]" style={{ color: V3.sub }}>
          {caixa.corte && <>conciliando a partir de <b>{dia(caixa.corte)}</b> · </>}
          <span>{c.arquivo} no arquivo · {c.total} no período</span>
          {/* ⛔ o invariante VISÍVEL: número que fecha por fora é promessa */}
          {!fecha && <b className="ml-1.5" style={{ color: V3.coral }}>⛔ a soma não fecha</b>}
        </div>
      </div>

      {erro && (
        <div className="rounded-xl border px-3 py-2 text-xs"
          style={{ borderColor: V3.ambar, background: V3.ambarBg, color: V3.ambar }}>
          {erro}
          <button type="button" onClick={() => { setErro(null); void carregar() }} className="ml-1.5 font-semibold underline">tentar de novo</button>
        </div>
      )}

      {/* ══════════ 5. FEEDBACK — a linha nunca sai em silêncio ══════════ */}
      {feito && (
        <div className="flex items-center gap-3 rounded-2xl border px-4 py-2.5 text-[13px] duration-300 animate-in fade-in slide-in-from-top-2"
          style={{ background: V3.verdeBg, borderColor: '#cdebd9', color: V3.ink }}>
          <span className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full text-white" style={{ background: V3.verde }}>
            <Check className="h-4 w-4" />
          </span>
          <div><b className="font-extrabold">{feito.titulo}</b> resolvida agora</div>
          <span className="ml-auto whitespace-nowrap rounded-full px-2.5 py-[3px] text-[11px] font-extrabold"
            style={{ background: '#fff', color: V3.verde }}>{feito.selo}</span>
        </div>
      )}

      {/* ══════════ 4. OS CARTÕES ≍ ══════════ */}
      {visiveis.map((l) => (
        <div key={l.id} className="flex flex-col gap-2">
          <CartaoDaLinha linha={l} ocupado={ocupado === l.id}
            categorias={categorias} cartoes={cartoes} contratos={contratos} cargas={cargas}
            erro={erroDaLinha?.id === l.id ? erroDaLinha.texto : null}
            onTentarDeNovo={erroDaLinha?.id === l.id
              ? () => { const e = erroDaLinha; void gesto(l, e.acao, e.alvo) }
              : undefined}
            onGesto={gesto} />

          {/*
            ⭐⭐⭐ O PAINEL ABRE **DEBAIXO DA PRÓPRIA LINHA** — nunca noutra tela, nunca
            abaixo da dobra. É o gesto terminando onde começou.

            ⛔ E ele só existe pra ESTA linha (`procurando.id === l.id`): um painel solto no
            rodapé faria o dono procurar de novo qual linha ele estava casando — que é
            exatamente o defeito que este conserto mata.
          */}
          {/*
            ⭐⭐⭐ O PASSO 2 DA RETIRADA — **ancorado na linha**, como o Find & Match.
            ⛔ Era uma faixa no topo que sumia sozinha; *nada que some sozinho carrega
            decisão*. A linha SÓ sai da caixa quando ele responde: mandar ou pular.
          */}
          {ponte?.linha.id === l.id && (
            <div className="rounded-[22px] border-[1.5px] bg-white p-3 dark:bg-slate-950" style={{ borderColor: V3.roxo }}>
              <div className="mb-2 flex flex-wrap items-center gap-2 px-1">
                <span className="text-[13px] leading-relaxed" style={{ color: V3.ink }}>
                  <b className="font-extrabold">{ponte.convite.titulo}</b>{' '}
                  a saída virou retirada na empresa — falta a ENTRADA no perfil pessoal, com
                  as duas pontas vinculadas.
                </span>
                {/* ⛔ pular é legítimo — e DIZ onde o gesto continua existindo */}
                <button type="button"
                  onClick={() => {
                    setFeito({
                      id: l.id,
                      titulo: `${l.descricao || '(sem descrição)'} ${brl(l.valor)}`,
                      selo: 'retirada gravada · ponte pendente em Retiradas',
                    })
                    setPonte(null); void carregar()
                  }}
                  className="ml-auto rounded-full border px-3 py-[6px] text-[12px] font-bold"
                  style={{ borderColor: V3.line, color: V3.sub }}>
                  pular — fica em Retiradas
                </button>
              </div>
              <WithdrawalPanel
                empresaId={empresaId}
                pjTransactionId={l.id}
                pjAmount={l.valor}
                pjDescription={l.descricao}
                /* ⭐ SUGESTÃO, não decisão: o painel pergunta sócio, conta e tipo */
                initialKind={ponte.convite.tipo ?? undefined}
                onCancel={() => { setPonte(null); void carregar() }}
                onConfirmed={() => {
                  setFeito({
                    id: l.id,
                    titulo: `${l.descricao || '(sem descrição)'} ${brl(l.valor)}`,
                    selo: 'retirada na empresa + entrada no perfil PF · pontas vinculadas',
                  })
                  setPonte(null); void carregar()
                }}
              />
            </div>
          )}

          {/*
            ⭐⭐⭐ «ESSA CONTA NÃO TEM CATEGORIA — QUAL É?» — a pergunta do servidor com o
            gesto de responder ao lado.

            ⚠️ A resposta **grava NA CONTA A PAGAR**, não só nesta linha: a próxima nota do
            mesmo fornecedor já vem com ela. *O sistema aprende com o gesto, em vez de
            repetir a mesma pergunta todo mês.*
          */}
          {pedeCategoria?.linha.id === l.id && (
            <div className="rounded-[22px] border-[1.5px] bg-white p-3 dark:bg-slate-950" style={{ borderColor: V3.ambar }}>
              <p className="px-1 pb-2 text-[12.5px] leading-relaxed" style={{ color: V3.ink }}>
                {pedeCategoria.texto}
              </p>
              <div className="flex flex-wrap items-center gap-2 px-1">
                <MenuDoChip
                  rotulo="escolher a categoria" icone="🏷️" ocupado={ocupado === l.id}
                  className="inline-flex items-center gap-1.5 rounded-full border-[1.5px] px-3 py-[7px] text-[12.5px] font-bold disabled:opacity-40"
                  style={{ background: V3.card, borderColor: V3.ambar, color: V3.ink }}
                  secoes={secoesDoMenu(categorias, l.sentido).map((s) => ({
                    titulo: s.titulo, ajuda: s.ajuda,
                    itens: s.itens.map((c2) => ({ id: c2.id, nome: c2.name })),
                  }))}
                  vazio={VAZIO.categorias(cargas.categorias).texto}
                  /* ⭐ o MESMO gesto, com a resposta que faltava — nenhum caminho novo */
                  onEscolher={(id) => { void gesto(l, pedeCategoria.acao, { ...pedeCategoria.alvo, categoryId: id }) }} />
                <button type="button" onClick={() => setPedeCategoria(null)}
                  className="rounded-full border px-3 py-[6px] text-[12px] font-bold"
                  style={{ borderColor: V3.line, color: V3.sub }}>
                  agora não
                </button>
              </div>
            </div>
          )}

          {procurando?.id === l.id && (
            <div className="rounded-[22px] border-[1.5px] bg-white p-3 dark:bg-slate-950"
              style={{ borderColor: V3.roxo }}>
              <p className="px-1 pb-2 text-[12px] leading-relaxed" style={{ color: V3.sub }}>
                <b style={{ color: V3.ink }}>
                  Escolha {l.sentido === 'SAIDA' ? 'a(s) conta(s) que este pagamento quita' : 'a(s) conta(s) a receber que esta entrada liquida'}.
                </b>{' '}
                O rodapé soma e só libera quando bater com a linha do banco — sobrando
                juros/tarifa, dá pra lançar como ajuste.
              </p>
              <FindAndMatchPanel
                empresaId={empresaId}
                ofx={{ id: l.id, description: l.descricao, amount: l.valor, date: l.data, type: l.tipo }}
                /* ⭐ chega com o nome que a LINHA traz na busca — o dono não procura o
                   fornecedor de novo numa lista de 100 (a lição do lote, 13/09) */
                buscaInicial={nomeDaBusca(l.descricao)}
                /* ⭐ se o palpite já resolveu o alvo, o painel abre COM ele marcado —
                   o dono confere em vez de procurar de novo (o bug da ELIANE) */
                preSelecionados={idsDoPalpite(l)}
                onCancel={() => setProcurando(null)}
                onReconciled={() => {
                  setProcurando(null)
                  setFeito({ id: l.id, titulo: `${l.descricao || '(sem descrição)'} ${brl(l.valor)}`, selo: 'conciliada · no arquivo' })
                  // ⭐ a linha SAI DA CAIXA na hora — o efeito fecha o gesto
                  void carregar()
                }}
              />
            </div>
          )}
        </div>
      ))}

      {/* ══════════ 7. INBOX ZERO ══════════ */}
      {visiveis.length === 0 && (
        <div className="rounded-[22px] border-[1.5px] border-dashed p-8 text-center" style={{ background: V3.card, borderColor: '#d9d7ea' }}>
          <div className="text-[34px]">🎉</div>
          <b className="mb-1 mt-2 block text-[16px]" style={{ color: V3.ink }}>É assim que a caixa fica quando você termina</b>
          <span className="text-[13px]" style={{ color: V3.sub }}>
            tudo resolvido e no arquivo, com o selo de como · amanhã o banco traz mais
          </span>
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// ⭐⭐⭐ O CARTÃO ≍ — banco à esquerda, palpite à direita, chips embaixo
// ═══════════════════════════════════════════════════════════════════════════════

function CartaoDaLinha({ linha: l, ocupado, categorias, cartoes, contratos, cargas, erro, onTentarDeNovo, onGesto }: {
  linha: LinhaDTO; ocupado: boolean
  categorias: CategoriaDoMenu[]
  cartoes: { id: string; name: string }[]
  contratos: { id: string; nome: string; detalhe: string; parcela: number }[]
  cargas: Record<'categorias' | 'cartoes' | 'contratos', EstadoDaCarga>
  /** ⛔ a recusa do gesto aparece AQUI, ao lado do dedo — no topo da tela ela é silêncio */
  erro: string | null
  /** ⭐ e ela SEMPRE carrega a saída: repetir o MESMO gesto, com o mesmo alvo */
  onTentarDeNovo?: () => void
  onGesto: (l: LinhaDTO, acao: string, alvo?: Record<string, unknown>) => void
}) {
  const credito = l.sentido === 'ENTRADA'
  const chip = 'inline-flex items-center gap-1.5 rounded-full border-[1.5px] px-3 py-[7px] text-[12.5px] font-bold disabled:opacity-40'

  /**
   * ⭐⭐⭐ A CATEGORIA VEM ANTES DO GESTO (20/09) — régua do dono.
   *
   * ⛔ E quem decide **se** ela é pedida é a lib (`origemDaCategoria`), nunca esta tela: o
   * pagamento de fatura, a parcela e a transferência são **estruturais** (o gesto já É a
   * classificação) e o casar **herda da conta**. *Exigir escolha ali seria cobrar duas vezes
   * pelo mesmo fato — e parede é como o dono aprende a contornar o sistema por fora.*
   */
  const [categoriaEscolhida, setCategoriaEscolhida] = useState<{ id: string; nome: string } | null>(null)
  const sel = estadoDoSeletor((l.palpite?.acao ?? null) as AcaoDoBalcao | null, l.categoriaDaConta ?? null)
  const temCategoria = !!categoriaEscolhida || sel.modo === 'HERDA'
  /** ⭐ o alvo que TODO gesto leva junto — a escolha da esquerda, quando houver */
  const comCategoria = (alvo: Record<string, unknown> = {}) =>
    categoriaEscolhida ? { ...alvo, categoryId: categoriaEscolhida.id } : alvo

  return (
    <div className="overflow-hidden rounded-[22px] border" style={{ background: V3.card, borderColor: V3.line, boxShadow: SOMBRA }}>
      {/*
        ⭐ REGRA 12 — o mock manda: desktop lado a lado (1fr 64px 1fr), celular EMPILHA.
        A media query do mock é 900px; aqui é a variante arbitrária do Tailwind, pra a
        medida sair do MESMO número que o guard lê no arquivo.
      */}
      <div className="grid grid-cols-1 min-[900px]:grid-cols-[1fr_64px_1fr]">
        {/* ── O BANCO DIZ ─────────────────────────────────────────────── */}
        <div className="px-5 py-[18px]">
          <div className="mb-2.5 flex flex-wrap items-center gap-1.5 text-[10px] font-extrabold tracking-[0.07em]" style={{ color: V3.sub }}>
            O BANCO DIZ
            {l.conta && (
              <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-[3px] text-[11.5px] font-bold"
                style={{ background: '#f2f1f8', color: V3.ink }}>
                <i className="h-4 w-4 rounded-full not-italic" style={{ background: 'linear-gradient(135deg,#7ac142,#4a8f2a)' }} />
                {l.conta}
              </span>
            )}
          </div>
          <div className="text-[14.5px] font-bold leading-[1.35]" style={{ color: V3.ink }}>
            {l.descricao || '(sem descrição)'}
            <small className="mt-0.5 block text-[12px] font-medium" style={{ color: V3.sub }}>
              {dia(l.data)}{l.contraparte ? ` · ${l.contraparte}` : ''}
            </small>
          </div>
          {/* ⭐ o valor GIGANTE — coral débito, verde crédito */}
          <div className="mt-2 text-[28px] font-extrabold tracking-[-0.01em] tabular-nums"
            style={{ color: credito ? V3.verde : V3.coral }}>
            {credito ? '+' : '−'} {brl(l.valor)}
          </div>

          {/*
            ⭐⭐⭐ O SELETOR DE CATEGORIA MORA AQUI (20/09) — decisão do dono: *"o lado
            esquerdo tem menos conteúdo e sobra espaço; assim a categoria não fica espremida
            na fileira de chips da direita, e o cartão equilibra visualmente."*

            ⚠️ **REGRA 12 de graça:** como ele é o último bloco da coluna da esquerda, no
            celular (que empilha) ele cai exatamente ENTRE o valor e o palpite — sem uma
            segunda composição pra manter.
          */}
          <div className="mt-3">
            <div className="mb-1 text-[10px] font-extrabold tracking-[0.07em]" style={{ color: V3.sub }}>
              CATEGORIA
            </div>
            {sel.modo === 'PEDE' ? (
              <MenuDoChip
                rotulo={categoriaEscolhida?.nome ?? sel.texto}
                icone={categoriaEscolhida ? '✓' : '🏷'} ocupado={ocupado}
                className={`${chip} w-full justify-start`}
                style={categoriaEscolhida
                  ? { background: V3.verdeBg, borderColor: '#cdebd9', color: V3.ink }
                  : { background: V3.card, borderColor: V3.roxo, color: V3.roxo }}
                secoes={secoesDoMenu(categorias, l.sentido).map((x) => ({
                  titulo: x.titulo, ajuda: x.ajuda,
                  itens: x.itens.map((c2) => ({ id: c2.id, nome: c2.name })),
                }))}
                vazio={VAZIO.categorias(cargas.categorias).texto}
                onEscolher={(id) => {
                  const c2 = categorias.find((x) => x.id === id)
                  setCategoriaEscolhida(c2 ? { id, nome: c2.name } : null)
                }} />
            ) : (
              /* ⛔ HERDA / ESTRUTURAL não PEDEM — eles DIZEM de onde a categoria vem */
              <div className="rounded-full border px-3 py-[7px] text-[12.5px] font-bold"
                style={{ background: '#f7f7fb', borderColor: V3.line, color: V3.sub }}>
                {sel.modo === 'HERDA' ? '↳ ' : '⚙ '}{sel.texto}
              </div>
            )}
          </div>
        </div>

        {/* ── O CONECTOR ──────────────────────────────────────────────── */}
        <div className="flex flex-row items-center justify-center gap-1.5 px-4 pb-1 min-[900px]:flex-col min-[900px]:px-0 min-[900px]:py-3">
          <div className="h-[2px] w-full flex-1 rounded-sm min-[900px]:h-auto min-[900px]:min-h-[34px] min-[900px]:w-[2px]"
            style={{ background: `linear-gradient(${V3.line},${V3.roxoBg},${V3.line})` }} />
          <div className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full text-[15px] font-extrabold"
            style={{ background: V3.roxoBg, color: V3.roxo }}>{CONECTOR}</div>
          <div className="h-[2px] w-full flex-1 rounded-sm min-[900px]:h-auto min-[900px]:min-h-[34px] min-[900px]:w-[2px]"
            style={{ background: `linear-gradient(${V3.line},${V3.roxoBg},${V3.line})` }} />
        </div>

        {/* ── MELHOR PALPITE (ou direto nos chips) ────────────────────── */}
        <div className="px-5 py-[18px]">
          <div className="mb-2.5 text-[10px] font-extrabold tracking-[0.07em]" style={{ color: V3.sub }}>
            {l.casoNoCard ? 'ESTA LINHA FAZ PARTE DE UM CASO' : l.palpite ? 'MELHOR PALPITE' : 'O QUE ESTA LINHA É?'}
          </div>

          {/*
            ⭐⭐⭐ O CASO MORA NO CARD → a linha APONTA, não decide (20/09).
            ⛔ Com botão nos dois lugares, o dono resolve num e o outro fica lá — foi assim
            que a nota errada do Cancian entrou. *Uma pergunta, uma casa.*
          */}
          {l.casoNoCard && (
            <a href={`#${l.casoNoCard.ancora}`}
              className="mb-2 block rounded-2xl border-[1.5px] px-4 py-3 text-[13px] font-bold leading-relaxed"
              style={{ background: V3.ambarBg, borderColor: V3.ambar, color: V3.ambar }}>
              {l.casoNoCard.texto}
            </a>
          )}

          {l.palpite && !l.casoNoCard && (
            <div className="rounded-2xl border-[1.5px] px-4 py-3.5"
              style={{ background: `linear-gradient(160deg,#fbfbff,${V3.verdeBg})`, borderColor: '#cdebd9' }}>
              <div className="text-[10px] font-extrabold tracking-[0.06em]" style={{ color: V3.verde }}>{l.palpite.familia}</div>
              <div className="mb-[1px] mt-1.5 text-[14.5px] font-extrabold" style={{ color: V3.ink }}>{l.palpite.titulo}</div>
              <div className="text-[12px]" style={{ color: V3.sub }}>{l.palpite.detalhe}</div>
              {/* ⛔ A DIFERENÇA SEMPRE NOMEADA — mesmo quando é zero */}
              <div className="mt-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-[3px] text-[11.5px] font-extrabold"
                style={{ background: V3.ambarBg, color: V3.ambar }}>{l.palpite.diferenca}</div>
              {/*
                ⭐ o botão diz O EFEITO — e é o MESMO confirmar de ontem.
                ⛔ Só que agora ele **espera a categoria** quando o gesto é dos que pedem
                escolha; nos estruturais e no casar ele segue livre (a régua está na lib).
              */}
              <button type="button"
                disabled={ocupado || !podeDisparar(l.palpite.acao as AcaoDoBalcao, temCategoria)}
                onClick={() => onGesto(l, l.palpite!.acao, comCategoria(l.palpite!.alvo))}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl py-[13px] text-[15px] font-extrabold text-white disabled:opacity-50"
                style={{ background: `linear-gradient(135deg,${V3.verde},${V3.verde2})`, boxShadow: '0 6px 18px rgba(15,157,88,.35)' }}>
                {ocupado ? <Loader2 className="h-4 w-4 animate-spin" /> : l.palpite.botao}
              </button>
              {!podeDisparar(l.palpite.acao as AcaoDoBalcao, temCategoria) && (
                <div className="mt-1.5 text-center text-[11.5px] font-bold" style={{ color: V3.roxo }}>
                  {AVISO_CATEGORIA}
                </div>
              )}
            </div>
          )}

          {l.palpite && !l.casoNoCard && (
            <div className="my-2 text-center text-[10.5px] font-bold tracking-[0.05em]" style={{ color: V3.sub }}>
              OU ESCOLHA OUTRO CAMINHO
            </div>
          )}

          {/*
            ⛔⛔ A RECUSA APARECE AQUI, COLADA NO DEDO. O dono clicou "parcela de
            empréstimo", o servidor recusou, e a mensagem foi parar no topo da tela — fora
            da vista no celular. Ele concluiu "nada aconteceu". *Mensagem que ele não vê é
            silêncio.*
          */}
          {erro && (
            <div className="mb-2 rounded-xl border px-3 py-2 text-[12.5px] leading-relaxed"
              style={{ borderColor: V3.coral, background: '#fdecea', color: '#8a2018' }}>
              {erro}
              {onTentarDeNovo && (
                <button type="button" onClick={onTentarDeNovo} disabled={ocupado}
                  className="ml-1.5 inline-flex items-center gap-1 font-bold underline disabled:opacity-40">
                  <RefreshCw className="h-3 w-3" /> tentar de novo
                </button>
              )}
            </div>
          )}

          {/* ⭐ OS CHIPS — são os MENUS DO SENTIDO que já existiam, com outra roupa */}
          <div className="flex flex-wrap gap-[7px]">
            {l.acoes.filter((a) => a.acao !== l.palpite?.acao).map((a) => {
              const cor = { background: V3.card, borderColor: V3.line, color: a.acao === 'IGNORAR' ? V3.sub : V3.ink }

              /**
               * ⭐⭐⭐ TODO CHIP QUE PEDE ALVO ABRE UM MENU — nenhum é botão mudo.
               *
               * ⛔⛔ Era aqui que 10 dos 12 chips morriam. `CATEGORIA` e `CARTAO` eram
               * `<select>` NATIVO (o widget do sistema, não a pílula do mock — e no celular
               * ele cobre a tela, que foi o que o dono viu nos 4 cartões da fatura); e
               * `CONTRATO` e `SAIDA_ORIGINAL` eram **botão sem seletor nenhum**: clicar
               * mandava a ação sem alvo e o servidor devolvia 422 *"Escolha o contrato…"*
               * — um erro no lugar de um painel.
               *
               * ⭐ Agora `pedeAlvo` é a ÚNICA declaração de "este gesto precisa de alvo", e
               * a tela é obrigada a desenhar o menu daquele tipo. O guard de família cobra
               * exatamente isto, chip a chip, nos dois sentidos.
               */
              /**
               * ⭐⭐⭐ O CHIP DE CATEGORIA NÃO ABRE MAIS MENU PRÓPRIO (20/09) — ele DISPARA
               * com a escolha do seletor da esquerda.
               *
               * ⛔ Dois menus pra mesma pergunta seriam **duas réguas na mesma tela**: o dono
               * escolheria num, clicaria no outro, e a linha sairia com a categoria errada.
               * *Uma pergunta, um lugar* — e o lugar é onde sobra espaço pra ela.
               */
              if (a.pedeAlvo === 'CATEGORIA') {
                const livre = podeDisparar(a.acao as AcaoDoBalcao, temCategoria)
                return (
                  <button key={a.acao} type="button" disabled={ocupado || !livre}
                    onClick={() => onGesto(l, a.acao, comCategoria())}
                    title={livre ? undefined : AVISO_CATEGORIA}
                    className={chip} style={cor}>
                    {ocupado ? <Loader2 className="h-3 w-3 animate-spin" /> : <>{ICONE[a.acao] ?? ''} {a.rotulo}</>}
                  </button>
                )
              }
              if (a.pedeAlvo === 'CARTAO') {
                return (
                  <MenuDoChip key={a.acao} rotulo={a.rotulo} icone={ICONE[a.acao]} ocupado={ocupado}
                    className={chip} style={cor}
                    secoes={[{ titulo: '💳 qual cartão esta linha quita?', itens: cartoes.map((k) => ({ id: k.id, nome: k.name })) }]}
                    vazio={VAZIO.cartoes(cargas.cartoes).texto}
                    onEscolher={(id) => onGesto(l, a.acao, { cardId: id })} />
                )
              }
              if (a.pedeAlvo === 'CONTRATO') {
                return (
                  <MenuDoChip key={a.acao} rotulo={a.rotulo} icone={ICONE[a.acao]} ocupado={ocupado}
                    className={chip} style={cor}
                    secoes={[{ titulo: '🏦 qual parcela esta linha paga?', ajuda: 'a próxima em aberto de cada contrato', itens: contratos.map((k) => ({ id: k.id, nome: k.nome, detalhe: k.detalhe })) }]}
                    vazio={VAZIO.contratos(cargas.contratos).texto}
                    onEscolher={(id) => {
                      const c2 = contratos.find((x) => x.id === id)
                      if (c2) onGesto(l, a.acao, { loanId: c2.id, installmentNumber: c2.parcela })
                    }} />
                )
              }
              return (
                <button key={a.acao} type="button" disabled={ocupado} onClick={() => onGesto(l, a.acao)} className={chip} style={cor}>
                  {ocupado ? <Loader2 className="h-3 w-3 animate-spin" /> : <>{ICONE[a.acao] ?? ''} {a.rotulo}</>}
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
