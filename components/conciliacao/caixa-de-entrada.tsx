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
import { V3, SOMBRA } from './mock-v3-tokens'
import { ChassiDoCartao } from './chassi-do-cartao'
import { MenuDoChip, type SecaoDoChip } from './menu-do-chip'
import { FindAndMatchPanel } from './find-and-match-panel'
import { secoesDoMenu, type CategoriaDoMenu } from '@/lib/conciliacao/categorias-do-gesto'
import { estadoDoSeletor, estadoDoSeletorDoLote, podeDisparar, AVISO_CATEGORIA } from '@/lib/conciliacao/categoria-antes-do-gesto'
import type { AcaoDoBalcao } from '@/lib/conciliacao/caixa-de-entrada'
import { nomeDaBusca } from '@/lib/conciliacao/nome-da-busca'
import { conviteDaPonte, type ConviteDaPonte } from '@/lib/conciliacao/convite-da-ponte'
import { consequenciaDeVincular } from '@/lib/conciliacao/uma-casa-por-caso'
import { venceuOuVence } from '@/lib/conciliacao/vencimento-na-tela'
import { avaliarDiferenca, MOTIVOS_DA_DIFERENCA, type MotivoDaDiferenca } from '@/lib/conciliacao/regua-da-diferenca'

/** ⚠️ o mesmo arredondamento da régua — comparar float cru daria diferença de 1e-13 */
const round2 = (n: number) => Math.round((n + 1e-9) * 100) / 100
import { VAZIO, type EstadoDaCarga } from '@/lib/conciliacao/vazio-do-menu'
import { passaNoFiltro, contadoresDaLista, type FiltroDaLista } from '@/lib/conciliacao/lista-unica'
import { WithdrawalPanel } from '@/components/withdrawals/WithdrawalPanel'
import { LoteSugerido, type LoteDTO } from './lote-sugerido'
import { EscolherNaMaoCard } from './escolher-na-mao-card'
import type { CardDeEscolha } from '@/lib/conciliacao/escolher-na-mao'
/**
 * ⚠️ O card chega **serializado**: o `Date` do servidor vira `string` no JSON. Usar o tipo
 * do servidor aqui prometeria um `Date` que nunca chega — a dívida de 01/09 ("interface
 * sobre payload é promessa, não prova") pelo avesso. O componente já lê `data` como texto.
 */
type CardDeEscolhaDTO = Omit<CardDeEscolha, 'linha'> & {
  linha: Omit<CardDeEscolha['linha'], 'data'> & { data: string }
}

interface AcaoDTO { acao: string; rotulo: string; pedeAlvo: string | null }
interface PalpiteDTO {
  acao: string; familia: string; titulo: string; detalhe: string
  /** ⭐ 23/09 — o retrato da conta sugerida (valor · vencimento · NF/parcela) */
  alvoDetalhe?: { descricao: string; valor: number; vencimento: string | null; fornecedor: string | null }
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
   * ⭐⭐⭐ O CASO — e ele mora **DENTRO do cartão ≍** (20/09), no lugar do palpite.
   *
   * ⛔ Era seção separada embaixo, com visual próprio: o dono via *"a mesma coisa duas
   * vezes, em dois MODELOS visuais diferentes"*. ***Uma decisão, uma aparição, um modelo.***
   *
   * ⚠️ `hospeda: false` é a 2ª linha do mesmo caso: ela APONTA pra quem hospeda, nunca
   * redesenha o painel — senão a duplicação volta, agora dentro do modelo certo.
   */
  caso:
    | { tipo: string; hospeda: false; ancora: string; nome: string }
    | {
        tipo: string; hospeda: true; ancora?: string; nome?: string
        conta?: { id: string; descricao: string; valor: number; vencimento: string }
        candidatas?: { id: string; descricao: string; valor: number; data: string; categoria: string | null; diferenca: number }[]
      }
    | null
  /**
   * ⭐⭐ 23/09 — UMA LISTA SÓ: o painel do LOTE e o da ESCOLHA viajam com a linha, porque
   * eles deixaram de ser seções e viraram o CASO dela.
   */
  lote?: LoteDTO | null
  escolha?: CardDeEscolhaDTO | null
  /**
   * ⚠️ a linha entrou na lista **só** por ter caso aberto (a estação dela é ARQUIVO,
   * porque ela já está categorizada). ⛔ Sem dizer isso, uma linha já classificada
   * aparecendo do nada parece defeito — e *categoria não quita conta* (07/09).
   */
  soPeloCaso?: boolean
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
  /**
   * ⭐⭐ 23/09 — OS CONTADORES DO TOPO VIRARAM FILTROS DA MESMA LISTA (decisão do dono).
   *
   * ⛔ *"O contador e a lista LEEM DA MESMA FONTE"* — a régua é `passaNoFiltro`, a mesma
   * que o servidor usa pra contar. Um contador com consulta própria é como o badge do
   * menu passou meses dizendo um número e a tela outro (10/09).
   */
  const [filtro, setFiltro] = useState<FiltroDaLista>('TUDO')
  /**
   * ⭐ O DEEP-LINK VIAJA COM A CARGA (23/09) — `?abrir=` / `?conta=` vindos dos Pendentes
   * ou do Contas a Pagar. ⛔ Sem repassar, a linha que o dono APONTOU não entra na lista:
   * a porta abriria numa tela sem o alvo (a lição de 13/09).
   */
  const deepLink = () => {
    if (typeof window === 'undefined') return ''
    const q = new URLSearchParams(window.location.search)
    return ['abrir', 'conta'].map((k) => (q.get(k) ? `&${k}=${encodeURIComponent(q.get(k)!)}` : '')).join('')
  }
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
   * ⭐⭐ 23/09 — "NÃO É ESSA": o painel abre SEM a sugerida marcada.
   *
   * ⛔ Quando o palpite erra a conta, marcar a errada de novo é fazer o dono desmarcar
   * antes de escolher — e desmarcar é o gesto que ninguém lembra de fazer. É a porta
   * *"Não é isso / Procurar outra"* que os cards de CASO já têm desde 07/09; o palpite
   * 1↔1 nunca ganhou a dele.
   */
  const [trocandoConta, setTrocandoConta] = useState(false)
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
    const r = await fetchComTimeout<CaixaDTO>(`/api/conciliacao/caixa?empresaId=${empresaId}${deepLink()}`)
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

  /**
   * ⭐⭐ RESOLVER O CASO DENTRO DO CARTÃO — e pela **porta de sempre**.
   *
   * ⛔ Nenhum caminho novo de gravação nasceu: é o MESMO `CASAR_PAGAR` do balcão, com a
   * candidata escolhida como `txId`. *Uma tela nova não pode significar um motor novo.*
   */
  const resolverCaso = useCallback(async (candidataId: string, contaId: string) => {
    const linha = (caixa?.linhas ?? []).find((x) => x.id === candidataId)
      // ⚠️ a candidata pode NÃO estar na caixa (já categorizada, como a Tiele) — aí a linha
      // que o gesto usa é ela mesma, montada do caso; o servidor resolve pelo id.
      ?? { id: candidataId, descricao: '', valor: 0 } as unknown as LinhaDTO
    await gesto(linha, 'CASAR_PAGAR', { contaIds: [contaId] })
  }, [caixa, gesto])

  const visiveis = useMemo(
    () => (caixa?.linhas ?? []).filter((l) => l.sentido === aba && passaNoFiltro(l as never, filtro)),
    [caixa, aba, filtro],
  )
  /**
   * ⭐ os números dos chips saem da MESMA lista que a tela desenha, já recortada pelo
   * sentido — assim o "⭐ 24" nunca promete trabalho que a aba não mostra.
   */
  const doSentido = useMemo(() => (caixa?.linhas ?? []).filter((l) => l.sentido === aba), [caixa, aba])
  const contagens = useMemo(() => contadoresDaLista(doSentido as never), [doSentido])

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
          {/* ⛔ o lema "o banco diz o que aconteceu · você diz o que cada linha é" SAIU
              (20/09, ordem do dono) — a tela já se explica, e ele comia a dobra do celular. */}
          <h2 className="text-[22px] font-bold tracking-[-0.01em]" style={{ color: V3.ink }}>Caixa de entrada do banco</h2>
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
      {/*
        ⭐⭐⭐ OS FILTROS — os contadores do topo viraram recorte da MESMA lista (23/09).
        ⛔ Eles NÃO consultam nada: `contadoresDaLista` roda sobre o que a tela tem em
        mãos, então contador e lista não têm COMO divergir. Era isso que o dono pediu
        ("contador ≠ lista no primeiro dessinc = vermelho").
      */}
      {contagens.tudo > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {([
            ['TUDO', `tudo ${contagens.tudo}`],
            ['PRONTOS', `⭐ prontos ${contagens.prontos}`],
            ['MAO', `🖐 na mão ${contagens.mao}`],
          ] as const).map(([f, rotulo]) => (
            <button key={f} type="button" onClick={() => setFiltro(f)}
              aria-pressed={filtro === f}
              className="rounded-full border-[1.5px] px-3 py-[6px] text-[12px] font-bold disabled:opacity-40"
              /* ⚠️ o filtro vazio fica DESABILITADO em vez de sumir: um chip que aparece e
                 some conforme o dado é um chip que o dono aprende a não procurar. */
              disabled={f !== 'TUDO' && (f === 'PRONTOS' ? contagens.prontos : contagens.mao) === 0}
              style={filtro === f
                ? { background: V3.roxo, borderColor: V3.roxo, color: '#fff' }
                : { background: V3.card, borderColor: V3.line, color: V3.sub }}>
              {rotulo}
            </button>
          ))}
        </div>
      )}

      {visiveis.map((l) => (
        <div key={l.id} className="flex flex-col gap-2">
          <CartaoDaLinha linha={l} ocupado={ocupado === l.id}
            categorias={categorias} cartoes={cartoes} contratos={contratos} cargas={cargas}
            erro={erroDaLinha?.id === l.id ? erroDaLinha.texto : null}
            onResolvido={resolverCaso}
            onTrocarConta={(linha) => { setTrocandoConta(true); setProcurando(linha) }}
            empresaId={empresaId}
            onRecarregar={() => void carregar()}
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
                /* ⛔ aberto por "não é essa" → NADA pré-marcado (ver `trocandoConta`) */
                preSelecionados={trocandoConta ? [] : idsDoPalpite(l)}
                onCancel={() => { setProcurando(null); setTrocandoConta(false) }}
                onReconciled={() => {
                  setProcurando(null)
                  setTrocandoConta(false)
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
      {/*
        ⛔⛔ O VAZIO DO FILTRO NÃO É O VAZIO DA CAIXA (23/09) — e este guard pegou o bug
        que EU acabei de criar: com `⭐ prontos` ligado e zero prontos, a tela dizia
        *"tudo resolvido"* com **35 linhas esperando decisão**.

        ⭐ É a mesma família do *"Tudo conciliado ✓ em cima de 16 pagamentos"* (10/09) e do
        *"erro disfarçado de vazio"*: ***ausência de resultado NESTE recorte não é ausência
        de trabalho***. O vazio de festa só sai quando a lista inteira está vazia.
      */}
      {visiveis.length === 0 && filtro !== 'TUDO' && (
        <div className="rounded-[22px] border-[1.5px] border-dashed p-6 text-center" style={{ background: V3.card, borderColor: '#d9d7ea' }}>
          <b className="block text-[14px]" style={{ color: V3.ink }}>
            nada neste filtro — e ainda há {contagens.tudo} linha{contagens.tudo === 1 ? '' : 's'} na lista
          </b>
          <button type="button" onClick={() => setFiltro('TUDO')}
            className="mt-1.5 text-[12.5px] font-bold underline" style={{ color: V3.roxo }}>
            ver tudo →
          </button>
        </div>
      )}
      {visiveis.length === 0 && filtro === 'TUDO' && (
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
// ⭐⭐⭐ O PAINEL DO CASO — dentro do cartão ≍, no lugar do palpite (20/09)
// ═══════════════════════════════════════════════════════════════════════════════
//
// **A régua do dono:** *"o caso ambíguo/N:M renderiza DENTRO do cartão ≍ da própria linha
// (o lado direito vira o painel do caso — as 2+ candidatas com Vincular/Não é isso, o
// aviso), no lugar do palpite. UM modelo, UMA aparição."*
//
// ⛔ Antes isto era uma **seção separada embaixo**, com visual próprio: o dono via a mesma
// decisão duas vezes, em dois modelos. ***Uma decisão aparece uma vez, sempre no mesmo
// desenho.***

interface CasoHospedado {
  tipo: string; hospeda: true; ancora: string; nome: string
  conta: { id: string; descricao: string; valor: number; vencimento: string }
  candidatas: { id: string; descricao: string; valor: number; data: string; categoria: string | null; diferenca: number }[]
}

function PainelDoCaso({ caso, linhaAtual, ocupado, onResolvido }: {
  caso: CasoHospedado
  linhaAtual: string
  ocupado: boolean
  onResolvido: (candidataId: string, contaId: string) => void
}) {
  return (
    <div id={caso.ancora} className="scroll-mt-4 rounded-2xl border-[1.5px] px-4 py-3.5"
      style={{ background: V3.ambarBg, borderColor: V3.ambar }}>
      <div className="text-[10px] font-extrabold tracking-[0.06em]" style={{ color: V3.ambar }}>
        ⚠️ {caso.candidatas.length} LINHAS PODEM SER ESTE PAGAMENTO
      </div>
      <div className="mb-[1px] mt-1.5 text-[14.5px] font-extrabold" style={{ color: V3.ink }}>
        {caso.conta.descricao} · {brl(caso.conta.valor)}
      </div>
      <div className="mb-2.5 text-[12px]" style={{ color: V3.sub }}>
        vence {dia(caso.conta.vencimento)} · <b>só uma pode ser</b> — escolha qual pagou
      </div>

      {caso.candidatas.map((c) => (
        <div key={c.id} className="mb-1.5 rounded-xl border bg-white px-3 py-2 dark:bg-slate-950"
          style={{ borderColor: c.id === linhaAtual ? V3.roxo : V3.line }}>
          <div className="flex flex-wrap items-baseline gap-x-2 text-[13px]" style={{ color: V3.ink }}>
            <b className="font-extrabold tabular-nums">{brl(c.valor)}</b>
            <span>{dia(c.data)}</span>
            {c.id === linhaAtual && (
              <span className="rounded-full px-2 py-[1px] text-[10px] font-extrabold"
                style={{ background: V3.roxoBg, color: V3.roxo }}>esta linha</span>
            )}
          </div>
          <div className="truncate text-[11.5px]" style={{ color: V3.sub }}>{c.descricao}</div>
          {/*
            ⭐⭐ A CONSEQUÊNCIA ESCRITA (a pergunta do dono sobre a Tiele): a candidata já
            categorizada CONTINUA sendo oferecida (a régua de 07/09 — *ter categoria não
            quita conta nenhuma*), e o texto diz o efeito MEDIDO: a categoria dela **fica**.
          */}
          {c.categoria && (
            <div className="mt-1 text-[11.5px] font-semibold" style={{ color: V3.ambar }}>
              ⚠️ {consequenciaDeVincular(c.categoria, caso.conta.descricao).texto}
            </div>
          )}
          {Math.abs(c.diferenca) >= 0.01 && (
            <div className="mt-0.5 text-[11.5px]" style={{ color: V3.sub }}>
              diferença de {brl(Math.abs(c.diferenca))}
            </div>
          )}
          <button type="button" disabled={ocupado} onClick={() => onResolvido(c.id, caso.conta.id)}
            className="mt-1.5 w-full rounded-xl py-2 text-[13px] font-extrabold text-white disabled:opacity-50"
            style={{ background: `linear-gradient(135deg,${V3.verde},${V3.verde2})` }}>
            {ocupado ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : 'foi esta — vincular'}
          </button>
        </div>
      ))}
      {/* ⛔ "nenhuma" é resposta: sem ela o dono fica preso num caso que não é dele */}
      <div className="pt-0.5 text-center text-[11.5px]" style={{ color: V3.sub }}>
        nenhuma delas? deixe o caso aberto e resolva a linha pelos caminhos abaixo
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// ⭐⭐⭐ O CARTÃO ≍ — banco à esquerda, palpite à direita, chips embaixo
// ═══════════════════════════════════════════════════════════════════════════════

function CartaoDaLinha({ linha: l, ocupado, categorias, cartoes, contratos, cargas, erro, onTentarDeNovo, onResolvido, onGesto, onTrocarConta, empresaId, onRecarregar }: {
  linha: LinhaDTO; ocupado: boolean
  categorias: CategoriaDoMenu[]
  cartoes: { id: string; name: string }[]
  contratos: { id: string; nome: string; detalhe: string; parcela: number }[]
  cargas: Record<'categorias' | 'cartoes' | 'contratos', EstadoDaCarga>
  /** ⛔ a recusa do gesto aparece AQUI, ao lado do dedo — no topo da tela ela é silêncio */
  erro: string | null
  /** ⭐ e ela SEMPRE carrega a saída: repetir o MESMO gesto, com o mesmo alvo */
  onTentarDeNovo?: () => void
  /** ⭐ o caso resolvido DENTRO do cartão: a candidata escolhida vira o pagamento da conta */
  onResolvido: (candidataId: string, contaId: string) => void
  onGesto: (l: LinhaDTO, acao: string, alvo?: Record<string, unknown>) => void
  /** ⭐ 23/09 — "não é essa": abre o Find & Match SEM a sugerida marcada */
  onTrocarConta: (l: LinhaDTO) => void
  /** ⭐ 23/09 — os painéis de LOTE/ESCOLHA precisam da empresa e de recarregar a lista */
  empresaId: string
  onRecarregar: () => void
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
  /**
   * ⭐⭐⭐ 24/09 — O CONTROLE QUE NOMEIA A DIFERENÇA.
   *
   * **O caso do dono:** o palpite do BORTOLAZZO mostrava *"diferença de R$ 2,00 — dá pra
   * fechar como juros/tarifa"* e **não havia como responder**. O servidor (corretamente)
   * só fecha com a diferença NOMEADA (`podeFechar: nomeada`), então o ✓ Confirmar levaria
   * um não — ou, pior, ficava mudo. ***Exigência sem controle que abre é beco***, a régua
   * de 23/09 no segundo caso.
   *
   * ⚠️ Nasce `null` de propósito: nomear é um GESTO. Pré-selecionar "juros" faria o dono
   * confirmar sem ler — e a diferença pode ser DESCONTO, que é o oposto.
   */
  const [motivoDif, setMotivoDif] = useState<MotivoDaDiferenca | null>(null)
  const [motivoLivre, setMotivoLivre] = useState('')

  /**
   * ⭐⭐ O VEREDICTO DA DIFERENÇA — da MESMA função que o servidor usa (REGRA 4).
   *
   * ⚠️ Só existe pro palpite que traz o retrato da conta: sem `alvoDetalhe` não há o que
   * comparar, e inventar uma diferença a partir do nada seria pior que não mostrar.
   */
  const vd = useMemo(() => {
    const d = l.palpite?.alvoDetalhe
    if (!d || typeof d.valor !== 'number') return null
    const linha = Math.abs(l.valor)
    return avaliarDiferenca(linha, round2(linha - d.valor), motivoDif !== null)
  }, [l.palpite?.alvoDetalhe, l.valor, motivoDif])

  /** ⛔ o degrau que EXIGE nome só libera nomeado; FECHA e RECUSA não dependem disto */
  const difRespondida = !vd || vd.degrau === 'FECHA' || vd.degrau === 'RECUSA' || vd.podeFechar

  /**
   * ⭐ o que vai no corpo do gesto — **o número EXATO que esta tela mostrou**, com o motivo.
   * ⛔ O servidor recusa se o número não bater ao centavo: é confirmação do que o dono viu,
   * nunca um `force` (a régua de 07/09).
   */
  const comDiferenca = (alvo: Record<string, unknown>) =>
    vd && motivoDif && (vd.degrau === 'OFERECE' || vd.degrau === 'PERGUNTA')
      ? { ...alvo, diferencaAceita: vd.diferenca, motivoDaDiferenca: motivoDif, ...(motivoDif === 'OUTRO' ? { motivoLivre } : {}) }
      : alvo
  /**
   * ⭐⭐⭐ QUEM MANDA É O CASO, NÃO O PALPITE (23/09) — o beco da MARIA LUIZA.
   *
   * ⛔ A linha do lote tinha palpite de *pagamento de fatura* (ESTRUTURAL), e o seletor
   * dizia *"⚙ categoria vem do gesto"* enquanto o botão exigia categoria. **As duas
   * metades se contradiziam e não havia onde responder.** Lote é **CASAR** — herda das
   * contas, e pede quando elas não têm.
   */
  const semCatNoLote = (l.lote?.notas ?? []).filter((n) => n.temCategoria === false).length
  const sel = l.caso?.tipo === 'LOTE' && l.lote
    ? estadoDoSeletorDoLote(semCatNoLote, l.lote.notas.length)
    : estadoDoSeletor((l.palpite?.acao ?? null) as AcaoDoBalcao | null, l.categoriaDaConta ?? null)
  const temCategoria = !!categoriaEscolhida || sel.modo === 'HERDA'
  /** ⭐ o alvo que TODO gesto leva junto — a escolha da esquerda, quando houver */
  const comCategoria = (alvo: Record<string, unknown> = {}) =>
    categoriaEscolhida ? { ...alvo, categoryId: categoriaEscolhida.id } : alvo

  return (
    /**
     * ⭐⭐⭐ O CHASSI É COMPARTILHADO (20/09) — o mesmo do "pra tua mão".
     *
     * ⛔ O lado esquerdo e o conector moravam AQUI, escritos à mão, e o card do N:M tinha o
     * desenho dele: o dono via *"a mesma coisa em dois MODELOS visuais diferentes"*.
     * ***Quando N telas precisam do MESMO desenho, o desenho vira componente.***
     */
    <ChassiDoCartao
      banco={{ conta: l.conta, descricao: l.descricao, data: l.data, contraparte: l.contraparte, valor: l.valor, credito }}
      abaixoDoValor={<>
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
            {/*
              ⭐⭐ A PROMESSA DE ONTEM, DITA NO LUGAR DA RESPOSTA: uma pergunta pras N, e
              ela grava em CADA conta — a próxima nota do fornecedor já vem classificada.
              ⛔ Sem esta linha o dono não sabe que responder aqui resolve as 6.
            */}
            {sel.modo === 'PEDE' && sel.gravaEm != null && (
              <p className="mt-1 text-[11px] leading-snug" style={{ color: V3.sub }}>
                a resposta grava nas {sel.gravaEm} contas — a próxima nota do fornecedor já vem com ela
              </p>
            )}
          </div>
      </>}
    >
      {/* ── O PAINEL DESTA CASA: palpite, caso, ou direto nos chips ──── */}
      <>
          <div className="mb-2.5 text-[10px] font-extrabold tracking-[0.07em]" style={{ color: V3.sub }}>
            {/* ⚠️ o rótulo segue a FAMÍLIA: "mais de uma candidata" é falso num lote, que
                tem UMA combinação fechada — rótulo que mente é como a tela perde crédito */}
            {l.caso?.tipo === 'LOTE' ? 'QUAIS NOTAS ESTE PAGAMENTO COBRIU'
              : l.caso ? 'ESTE CASO TEM MAIS DE UMA CANDIDATA'
                : l.palpite ? 'MELHOR PALPITE' : 'O QUE ESTA LINHA É?'}
          </div>

          {/*
            ⭐⭐⭐ O PAINEL DO CASO — no lugar do palpite, no MESMO cartão ≍.
            ⛔ A 2ª linha do caso não redesenha nada: ela aponta pra quem hospeda.
          */}
          {l.caso?.hospeda === false && (
            <a href={`#${l.caso.ancora}`}
              className="mb-2 block rounded-2xl border-[1.5px] px-4 py-3 text-[13px] font-bold leading-relaxed"
              style={{ background: V3.ambarBg, borderColor: V3.ambar, color: V3.ambar }}>
              parte do caso «{l.caso.nome}» acima ↑
            </a>
          )}
          {/*
            ⭐⭐⭐ UMA LISTA SÓ (23/09) — o caso da linha renderiza AQUI, qualquer que seja
            a família. As seções "PRONTOS PRA CONFIRMAR" e "PRA TUA MÃO" deixaram de
            existir: era a mesma pergunta (*"o que esta linha do banco é?"*) em duas
            listas, e o dono via **dois modelos**.

            ⛔ Cada painel é o MESMO componente de antes, em `comoPainel` — o chassi ≍ (e a
            coluna *O BANCO DIZ*) é deste cartão. Trazer o chassi deles mostraria a linha
            do banco duas vezes no mesmo cartão.
          */}
          {l.caso?.hospeda === true && l.caso.tipo === 'LOTE' && l.lote && (
            <LoteSugerido
              comoPainel
              empresaId={empresaId}
              lote={l.lote}
              /* ⭐ a resposta do seletor ESQUERDO é a que o Vincular usa — uma pergunta,
                 um lugar. Sem isto o botão exigiria algo que a esquerda não entrega. */
              categoriaEscolhida={categoriaEscolhida?.id ?? null}
              linha={{ descricao: l.descricao, data: l.data, conta: l.conta, categoria: null }}
              onVinculado={onRecarregar}
              onProcurar={() => onTrocarConta(l)}
            />
          )}
          {l.caso?.hospeda === true && l.caso.tipo === 'ESCOLHA' && l.escolha && (
            <EscolherNaMaoCard
              comoPainel
              empresaId={empresaId}
              card={l.escolha as never}
              onConciliado={onRecarregar}
              /* ⚠️ no modo painel não há "fechar": o cartão é a linha, e ela some da
                 lista quando é resolvida — fechar seria esconder trabalho pendente */
              onFechar={() => {}}
            />
          )}
          {l.caso?.hospeda === true && l.caso.tipo === 'AMBIGUO' && (
            <PainelDoCaso caso={l.caso as never} linhaAtual={l.id} ocupado={ocupado} onResolvido={onResolvido} />
          )}

          {l.palpite && !l.caso && (
            <div className="rounded-2xl border-[1.5px] px-4 py-3.5"
              style={{ background: `linear-gradient(160deg,#fbfbff,${V3.verdeBg})`, borderColor: '#cdebd9' }}>
              <div className="text-[10px] font-extrabold tracking-[0.06em]" style={{ color: V3.verde }}>{l.palpite.familia}</div>
              <div className="mb-[1px] mt-1.5 text-[14.5px] font-extrabold" style={{ color: V3.ink }}>{l.palpite.titulo}</div>
              {/*
                ⭐⭐⭐ O RETRATO DA CONTA SUGERIDA (23/09) — decisão do dono: *"eu confiro
                valor e data ANTES de confirmar, não depois"*.

                ⛔ E ele ESPELHA a coluna da esquerda: lá a linha do banco mostra valor ·
                data · descrição; aqui a conta a pagar mostra as MESMAS três coisas, na
                mesma ordem. É a anatomia que os cards de CASO já usam (LINHA DO EXTRATO ×
                CONTA A PAGAR) — o palpite 1↔1 é que tinha ficado só com o nome da empresa.
              */}
              {l.palpite.alvoDetalhe && (
                <div className="mt-1.5 rounded-xl border px-2.5 py-2"
                  style={{ background: V3.card, borderColor: V3.line }}>
                  <div className="text-[9.5px] font-extrabold tracking-[0.07em]" style={{ color: V3.sub }}>
                    A CONTA A PAGAR
                  </div>
                  <div className="mt-1 flex items-baseline gap-2">
                    <span className="text-[15px] font-extrabold tabular-nums" style={{ color: V3.ink }}>
                      {brl(l.palpite.alvoDetalhe.valor)}
                    </span>
                    {l.palpite.alvoDetalhe.vencimento && (
                      <span className="text-[11.5px] tabular-nums" style={{ color: V3.sub }}>
                        {venceuOuVence(l.palpite.alvoDetalhe.vencimento)}
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 break-words text-[12px] leading-snug" style={{ color: V3.sub }}>
                    {l.palpite.alvoDetalhe.descricao}
                  </div>
                </div>
              )}
              <div className="mt-1.5 text-[12px]" style={{ color: V3.sub }}>{l.palpite.detalhe}</div>
              {/* ⛔ A DIFERENÇA SEMPRE NOMEADA — mesmo quando é zero */}
              <div className="mt-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-[3px] text-[11.5px] font-extrabold"
                style={{ background: V3.ambarBg, color: V3.ambar }}>{l.palpite.diferenca}</div>
              {/*
                ⭐⭐⭐ O CONTROLE QUE RESPONDE A DIFERENÇA (24/09).
                ⛔ A régua é a MESMA dos 4 chamadores (`avaliarDiferenca`) — uma segunda aqui
                faria a tela oferecer o que o servidor recusa, que é o defeito de 12/09
                (*"o card coletava o nome da diferença, acendia o botão com ele e NUNCA o
                enviava"*) com outra roupa.
              */}
              {vd && vd.degrau !== 'FECHA' && vd.degrau !== 'RECUSA' && (
                <div className="mt-2 rounded-xl border-[1.5px] p-2.5" style={{ borderColor: V3.ambar, background: V3.ambarBg }}>
                  <p className="text-[12px] font-bold" style={{ color: V3.ambar }}>
                    {vd.diferenca > 0 ? 'os' : 'a menos:'} {brl(Math.abs(vd.diferenca))} {vd.diferenca > 0 ? 'a mais são' : 'são'}:
                  </p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {MOTIVOS_DA_DIFERENCA.map((m) => (
                      <button key={m.chave} type="button" disabled={ocupado}
                        onClick={() => setMotivoDif(motivoDif === m.chave ? null : m.chave)}
                        className="rounded-full border-[1.5px] px-2.5 py-[5px] text-[11.5px] font-bold disabled:opacity-40"
                        style={motivoDif === m.chave
                          ? { borderColor: V3.ambar, background: V3.ambar, color: '#fff' }
                          : { borderColor: V3.ambar, background: '#fff', color: V3.ambar }}>
                        {m.rotulo}
                      </button>
                    ))}
                  </div>
                  {/* ⭐ OUTRO é o único que pede a palavra do dono — e ela vai pro rastro */}
                  {motivoDif === 'OUTRO' && (
                    <input value={motivoLivre} onChange={(e) => setMotivoLivre(e.target.value)}
                      aria-label="qual é o motivo da diferença?" placeholder="ex.: correção de preço combinada"
                      maxLength={80}
                      className="mt-1.5 w-full rounded-lg border-[1.5px] px-2.5 py-1.5 text-[12px]"
                      style={{ borderColor: V3.ambar }} />
                  )}
                  <p className="mt-1.5 text-[11px]" style={{ color: V3.sub }}>
                    fica escrito no histórico da conta — é o que o contador lê depois
                  </p>
                </div>
              )}
              {/*
                ⭐ o botão diz O EFEITO — e é o MESMO confirmar de ontem.
                ⛔ Só que agora ele **espera a categoria** quando o gesto é dos que pedem
                escolha; nos estruturais e no casar ele segue livre (a régua está na lib).
              */}
              <button type="button"
                disabled={ocupado || !podeDisparar(l.palpite.acao as AcaoDoBalcao, temCategoria) || !difRespondida}
                onClick={() => onGesto(l, l.palpite!.acao, comDiferenca(comCategoria(l.palpite!.alvo)))}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl py-[13px] text-[15px] font-extrabold text-white disabled:opacity-50"
                style={{ background: `linear-gradient(135deg,${V3.verde},${V3.verde2})`, boxShadow: '0 6px 18px rgba(15,157,88,.35)' }}>
                {ocupado ? <Loader2 className="h-4 w-4 animate-spin" /> : l.palpite.botao}
              </button>
              {!podeDisparar(l.palpite.acao as AcaoDoBalcao, temCategoria) && (
                <div className="mt-1.5 text-center text-[11.5px] font-bold" style={{ color: V3.roxo }}>
                  {AVISO_CATEGORIA}
                </div>
              )}
              {/* ⛔ e o botão travado DIZ o que falta — desabilitado mudo é o dono adivinhando */}
              {podeDisparar(l.palpite.acao as AcaoDoBalcao, temCategoria) && !difRespondida && (
                <div className="mt-1.5 text-center text-[11.5px] font-bold" style={{ color: V3.ambar }}>
                  diga o que é a diferença ↑ — ela vai pro histórico da conta
                </div>
              )}
              {/*
                ⭐⭐ "NÃO É ESSA" (23/09) — a porta de troca que o palpite 1↔1 não tinha.
                ⛔ Sem ela, palpite errado só se resolve ABANDONANDO o palpite (fechar o
                card e procurar por fora). É a mesma porta do *"Não é isso / Procurar
                outra"* dos cards de caso, e ela ENSINA: o painel abre com as candidatas do
                fornecedor e a busca, SEM a sugerida marcada.
              */}
              {(l.palpite.acao === 'CASAR_PAGAR' || l.palpite.acao === 'CASAR_RECEBER') && (
                <button type="button" disabled={ocupado}
                  onClick={() => onTrocarConta(l)}
                  className="mt-2 w-full rounded-xl border-[1.5px] py-[9px] text-[12.5px] font-bold disabled:opacity-50"
                  style={{ background: V3.card, borderColor: V3.line, color: V3.sub }}>
                  não é essa — escolher outra →
                </button>
              )}
            </div>
          )}

          {l.palpite && !l.caso && (
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
      </>
    </ChassiDoCartao>
  )
}