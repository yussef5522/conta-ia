'use client'

/**
 * ⭐⭐⭐ CUSTOS FIXOS — "A CASA NUM OLHAR" (06/10/2026). Visual v4, por TOKEN (dois temas).
 *
 * **Ordem do dono:** *"os 3 números de dono em cartões coloridos no topo · a lista PLANEJADO ×
 * REALIZADO por categoria · clique na linha abre as transações daquele mês naquela categoria."*
 *
 * ⛔⛔ **A TELA NÃO CALCULA NADA DE DINHEIRO.** Cartões, selos, percentuais e totais vêm do
 * payload (`lerCustosFixos`). Derivar aqui seria a 2ª resposta pra *"a casa custa quanto?"* —
 * e ela divergiria do aviso do sininho, que lê a MESMA função. A tela formata e desenha.
 *
 * ⛔ **NADA DE BLOCO DE AVISO INLINE** (lei de 04/10): o estouro do plano vive no SELO da linha
 * (que é o estado daquela linha) e no SININHO. Bloco de aviso aqui seria a 2ª vitrine do mesmo
 * dado — a doença que matou o `BlocoDeAvisos` da home da produção.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { use } from 'react'
import {
  AlertTriangle, ArrowRight, Check, ChevronDown, Loader2, Plus, Receipt, Wallet, X,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { NavegadorDeMes } from '@/components/contas-pagar/NavegadorDeMes'
import { formatBRL } from '@/lib/format/money'
import { mesCorrente, rotuloDoMes } from '@/lib/periodo/mes-corrente'
import { fetchComTimeout } from '@/lib/http/fetch-com-timeout'
import type { CustosFixosNaTela, LinhaDoCustoFixo } from '@/lib/custos-fixos/leitura'
import type { TomDoSelo } from '@/lib/custos-fixos/situacao'
import { iconeDaCategoria } from '@/lib/custos-fixos/icones'

/** ⚠️ acima disso a lista colapsa — ordem do dono (~8) */
const LINHAS_VISIVEIS = 8

/** ⭐ o tom de cada selo sai dos tokens da família; nenhum hex novo */
const TOM: Record<TomDoSelo, { bg: string; ink: string }> = {
  verde: { bg: 'var(--fam-verde-bg)', ink: 'var(--fam-verde-ink)' },
  azul: { bg: 'var(--fam-azul-bg)', ink: 'var(--fam-azul-ink)' },
  coral: { bg: 'var(--fam-coral-bg)', ink: 'var(--fam-coral-ink)' },
  ambar: { bg: 'var(--fam-ambar-bg)', ink: 'var(--fam-ambar-ink)' },
  cinza: { bg: 'var(--fam-cinza-bg)', ink: 'var(--fam-cinza-ink)' },
}

type Estado = 'CARREGANDO' | 'FALHOU' | 'OK'

export default function CustosFixosPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [mes, setMes] = useState(mesCorrente())
  const [dados, setDados] = useState<CustosFixosNaTela | null>(null)
  /**
   * ⛔ ESTADO EXPLÍCITO (a lição da lixeira, 20/09): enquanto "ausência de dado" servir de
   * estado, o caso não previsto vira spinner eterno. Aqui `FALHOU` tem nome e tem botão.
   */
  const [estado, setEstado] = useState<Estado>('CARREGANDO')
  const [erro, setErro] = useState<string | null>(null)
  const [todas, setTodas] = useState(false)
  const [abrindoSeletor, setAbrindoSeletor] = useState(false)
  const [salvando, setSalvando] = useState<string | null>(null)

  const carregar = useCallback(async () => {
    setEstado((e) => (e === 'OK' ? 'OK' : 'CARREGANDO'))
    const r = await fetchComTimeout<CustosFixosNaTela>(`/api/empresas/${id}/custos-fixos?mes=${mes}`)
    if (!r.ok || !r.data) { setErro(r.erro ?? 'Não consegui carregar.'); setEstado('FALHOU'); return }
    setDados(r.data); setErro(null); setEstado('OK')
  }, [id, mes])

  useEffect(() => { void carregar() }, [carregar])

  /** ⭐ todo gesto devolve a TELA recalculada — o estado novo é o que o servidor aceitou */
  const gesto = useCallback(async (corpo: Record<string, unknown>, chave: string) => {
    setSalvando(chave)
    const r = await fetchComTimeout<CustosFixosNaTela>(`/api/empresas/${id}/custos-fixos`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...corpo, mes }), timeoutMs: 60_000,
    })
    setSalvando(null)
    if (!r.ok || !r.data) { setErro(r.erro ?? 'Não consegui salvar.'); return }
    setDados(r.data); setErro(null)
  }, [id, mes])

  const visiveis = useMemo(() => {
    if (!dados) return []
    return todas ? dados.linhas : dados.linhas.slice(0, LINHAS_VISIVEIS)
  }, [dados, todas])

  if (estado === 'CARREGANDO' && !dados) {
    return (
      <div className="p-6">
        <Loader2 className="h-5 w-5 animate-spin" style={{ color: 'var(--prod-muted)' }} />
      </div>
    )
  }

  if (estado === 'FALHOU' && !dados) {
    return (
      <div className="space-y-3 p-6">
        <p className="text-sm" style={{ color: 'var(--prod-coral)' }}>{erro}</p>
        <button type="button" onClick={() => void carregar()}
          className="rounded-lg px-3 py-1.5 text-sm font-medium"
          style={{ background: 'var(--prod-acao-bg)', color: 'var(--prod-acao-ink)' }}>
          tentar de novo
        </button>
      </div>
    )
  }

  if (!dados) return null

  const subTitulo = `${rotuloDoMes(mes)} — o que a casa custa antes de vender o primeiro lanche`

  return (
    <div className="space-y-5" style={{ background: 'var(--prod-bg)', minHeight: '100%' }}>
      <header>
        <div className="flex flex-wrap items-center gap-2">
          <Wallet className="h-5 w-5 shrink-0" style={{ color: 'var(--prod-accent)' }} />
          <h1 className="text-base font-semibold" style={{ color: 'var(--prod-primary)' }}>Custos fixos</h1>
        </div>
        {/* ⭐ a sublinha é SERIFADA EM ITÁLICO — o padrão v4 dos cartões de dono */}
        <p className="mt-0.5 font-serif text-[13px] italic" style={{ color: 'var(--prod-muted)' }}>
          {subTitulo}
        </p>
        <div className="mt-2">
          <NavegadorDeMes
            mes={mes}
            onMudar={setMes}
            frase="o mês recorta o planejado e o realizado; a margem sai dos últimos 30 dias até o fim deste mês"
          />
        </div>
      </header>

      {erro && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl px-3 py-2"
          style={{ background: 'var(--fam-coral-bg)' }}>
          <AlertTriangle className="h-4 w-4 shrink-0" style={{ color: 'var(--fam-coral-ink)' }} />
          <p className="min-w-0 flex-1 text-[12px]" style={{ color: 'var(--fam-coral-ink)' }}>{erro}</p>
          <button type="button" onClick={() => void carregar()} className="text-[12px] font-semibold underline"
            style={{ color: 'var(--fam-coral-ink)' }}>tentar de novo</button>
        </div>
      )}

      {/* ─────────── OS 3 NÚMEROS DE DONO ─────────── */}
      <div className="grid gap-3 sm:grid-cols-3">
        <CartaoDeDono
          familia="indigo"
          titulo="A casa custa"
          sub={`${rotuloDoMes(mes)} — o plano que você declarou`}
          valor={dados.casaCustaMes}
          sufixo="/mês"
          aApurar="declare o plano de cada custo fixo aqui embaixo"
          detalhe={dados.semPlano.n > 0
            ? `${dados.semPlano.n} ${dados.semPlano.n === 1 ? 'categoria' : 'categorias'} ainda sem plano — o realizado delas é ${formatBRL(dados.semPlano.realizado)}`
            : null}
        />
        <CartaoDeDono
          familia="azul"
          titulo="Por dia aberto"
          sub="quanto a casa come por dia, parada"
          valor={dados.porDiaAberto.valor}
          aApurar="depende do plano acima"
          detalhe={dados.porDiaAberto.rotulo}
        />
        <CartaoDeDono
          familia="verde"
          titulo="Ponto de equilíbrio"
          sub="vendendo isso por dia, a casa se paga"
          valor={dados.pontoDeEquilibrio.porDia}
          aApurar={dados.pontoDeEquilibrio.porque ?? 'a apurar'}
          detalhe={dados.pontoDeEquilibrio.conta
            ? `${dados.pontoDeEquilibrio.conta} · ${dados.margem.ressalva}`
            : dados.margem.ressalva}
        />
      </div>

      {/* ─────────── A LISTA ─────────── */}
      <Card style={{ background: 'var(--prod-surface)', borderColor: 'var(--prod-line)' }}>
        <CardContent className="p-0">
          <div className="flex flex-wrap items-center gap-2 px-4 py-3">
            <Receipt className="h-4 w-4 shrink-0" style={{ color: 'var(--prod-accent)' }} />
            <h2 className="text-sm font-semibold" style={{ color: 'var(--prod-primary)' }}>
              Planejado × realizado
            </h2>
            <p className="hidden flex-1 truncate text-[11.5px] lg:block" style={{ color: 'var(--prod-muted)' }}>
              o planejado é seu; o realizado é o que o fluxo pagou no mês
            </p>
            <button type="button" onClick={() => setAbrindoSeletor((v) => !v)}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11.5px] font-semibold"
              style={{ background: 'var(--prod-acao-bg)', color: 'var(--prod-acao-ink)' }}>
              <Plus className="h-3.5 w-3.5" /> marcar categoria como fixa
            </button>
          </div>

          {abrindoSeletor && (
            <SeletorDeCategoria
              disponiveis={dados.disponiveis}
              salvando={salvando}
              aoEscolher={(categoryId) => void gesto({ acao: 'MARCAR', categoryId }, `marcar:${categoryId}`)}
              aoFechar={() => setAbrindoSeletor(false)}
            />
          )}

          {dados.linhas.length === 0 ? (
            <p className="px-4 pb-4 text-[13px]" style={{ color: 'var(--prod-secondary)' }}>
              Nenhuma categoria marcada como custo fixo ainda. Marque as que a casa paga todo mês
              (aluguel, salários, energia, água, internet, contador, sistema) — o realizado aparece
              sozinho, vindo das contas que você já categoriza.
            </p>
          ) : (
            <>
              {/* cabeçalho só no desktop — no celular cada linha é um cartão */}
              <div className="hidden px-4 pb-1 text-[11px] uppercase tracking-wide lg:grid lg:grid-cols-[1fr_140px_140px_150px]"
                style={{ color: 'var(--prod-muted)' }}>
                <span>categoria</span>
                <span className="text-right">planejado</span>
                <span className="text-right">realizado</span>
                <span className="text-right">situação</span>
              </div>
              <ul>
                {visiveis.map((l, i) => (
                  <LinhaDaTela
                    key={l.categoryId}
                    linha={l}
                    zebra={i % 2 === 1}
                    salvando={salvando === `plano:${l.categoryId}`}
                    aoPlanejar={(valor) => void gesto({ acao: 'PLANEJAR', categoryId: l.categoryId, valor }, `plano:${l.categoryId}`)}
                    aoTirar={() => void gesto({ acao: 'TIRAR', categoryId: l.categoryId }, `tirar:${l.categoryId}`)}
                  />
                ))}
              </ul>

              {dados.linhas.length > LINHAS_VISIVEIS && (
                <button type="button" onClick={() => setTodas((v) => !v)}
                  className="flex w-full items-center justify-center gap-1.5 border-t py-2 text-[12px] font-medium"
                  style={{ borderColor: 'var(--prod-line)', color: 'var(--prod-accent)' }}>
                  <ChevronDown className={`h-3.5 w-3.5 transition-transform ${todas ? 'rotate-180' : ''}`} />
                  {todas ? 'ver só as primeiras' : `+${dados.linhas.length - LINHAS_VISIVEIS} categorias · ver todas`}
                </button>
              )}

              {/* ─────────── RODAPÉ: Σ planejado × Σ realizado × % pago ─────────── */}
              <div className="border-t px-4 py-3" style={{ borderColor: 'var(--prod-line-strong)' }}>
                <div className="flex flex-wrap items-baseline justify-end gap-x-6 gap-y-1 text-[13px]">
                  <span style={{ color: 'var(--prod-muted)' }}>
                    Σ planejado{' '}
                    <b className="tabular-nums" style={{ color: 'var(--prod-primary)' }}>
                      {dados.totalPlanejado == null ? 'a apurar' : formatBRL(dados.totalPlanejado)}
                    </b>
                  </span>
                  <span style={{ color: 'var(--prod-muted)' }}>
                    Σ realizado{' '}
                    <b className="tabular-nums" style={{ color: 'var(--prod-primary)' }}>{formatBRL(dados.totalRealizado)}</b>
                  </span>
                  <span style={{ color: 'var(--prod-muted)' }}>
                    % pago{' '}
                    <b className="tabular-nums" style={{ color: 'var(--prod-primary)' }}>
                      {/* ⚠️ sem plano NÃO é 0% — é desconhecido */}
                      {dados.pctPago == null ? 'a apurar' : `${Math.round(dados.pctPago * 100)}%`}
                    </b>
                  </span>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* ⚠️ A LACUNA, DITA: custo fixo pago no cartão não aparece no realizado deste mês */}
      {dados.comprasNoCartao && (
        <p className="px-1 text-[11.5px] leading-snug" style={{ color: 'var(--prod-muted)' }}>
          ⚠️ O realizado conta o dinheiro que saiu da conta. Este mês tem{' '}
          {dados.comprasNoCartao.n} compra{dados.comprasNoCartao.n > 1 ? 's' : ''} no cartão de
          crédito — custo fixo pago por lá entra como pagamento de fatura, sem a categoria da
          despesa, então ele não aparece na linha dele aqui.
        </p>
      )}

      {/*
        ⚠️ A CAPACIDADE QUE VIVIA AQUI NÃO MORREU, MUDOU DE LUGAR NO MENU. A tela de
        Recorrentes (agendar lançamento automático) nunca foi usada — 0 recorrências em
        TODAS as empresas, medido em prod — mas o motor roda e a porta continua aberta.
        *Remoção sem realocação é perda* (10/09).
      */}
      <p className="px-1 text-[11px]" style={{ color: 'var(--prod-muted)' }}>
        Precisa agendar um lançamento que se repete sozinho?{' '}
        <a href="/recorrentes" className="underline" style={{ color: 'var(--prod-accent)' }}>
          lançamentos recorrentes
        </a>
      </p>
    </div>
  )
}

/** ⭐ o cartão de dono v4: fundo da família, texto da família, sublinha serifada em itálico */
function CartaoDeDono({ familia, titulo, sub, valor, sufixo, aApurar, detalhe }: {
  familia: 'indigo' | 'azul' | 'verde'
  titulo: string
  sub: string
  valor: number | null
  sufixo?: string
  aApurar: string
  detalhe: string | null
}) {
  return (
    <div className="rounded-xl p-3.5" style={{ background: `var(--fam-${familia}-bg)` }}>
      <p className="text-[12px] font-semibold uppercase tracking-wide" style={{ color: `var(--fam-${familia}-ink)` }}>
        {titulo}
      </p>
      <p className="font-serif text-[11.5px] italic" style={{ color: `var(--fam-${familia}-mid)` }}>{sub}</p>
      {valor == null ? (
        <>
          <p className="mt-1.5 text-[19px] font-semibold" style={{ color: `var(--fam-${familia}-ink)` }}>a apurar</p>
          <p className="mt-0.5 text-[11px] leading-snug" style={{ color: `var(--fam-${familia}-mid)` }}>{aApurar}</p>
        </>
      ) : (
        <>
          <p className="mt-1.5 text-[22px] font-semibold tabular-nums" style={{ color: `var(--fam-${familia}-ink)` }}>
            {formatBRL(valor)}
            {sufixo && <span className="text-[12px] font-normal"> {sufixo}</span>}
          </p>
          {detalhe && (
            <p className="mt-0.5 text-[11px] leading-snug" style={{ color: `var(--fam-${familia}-mid)` }}>{detalhe}</p>
          )}
        </>
      )}
    </div>
  )
}

/** ⭐ UMA linha: ícone + nome · planejado editável · realizado · selo. Clica → as transações. */
function LinhaDaTela({ linha, zebra, salvando, aoPlanejar, aoTirar }: {
  linha: LinhaDoCustoFixo
  zebra: boolean
  salvando: boolean
  aoPlanejar: (valor: number | null) => void
  aoTirar: () => void
}) {
  const Icone = iconeDaCategoria(linha.nome)
  const tom = TOM[linha.situacao.tom]
  return (
    <li
      className="grid grid-cols-1 gap-x-3 gap-y-1.5 border-t px-4 py-2.5 lg:grid-cols-[1fr_140px_140px_150px] lg:items-center"
      style={{
        borderColor: 'var(--prod-line)',
        // ⚠️ zebrado por CLASSE seria o certo, mas aqui o chão vem de token: `style` no <li>
        // não compete com hover nenhum (a linha não tem hover próprio — o link é o nome).
        background: zebra ? 'var(--prod-surface-1)' : undefined,
      }}
    >
      <div className="flex min-w-0 items-center gap-2">
        <Icone className="h-4 w-4 shrink-0" style={{ color: 'var(--prod-muted)' }} />
        <div className="min-w-0 flex-1">
          <a href={linha.href} className="flex items-center gap-1 text-[13.5px] font-medium hover:underline"
            style={{ color: 'var(--prod-primary)' }}>
            <span className="truncate">{linha.nome}</span>
            <ArrowRight className="h-3 w-3 shrink-0" style={{ color: 'var(--prod-accent)' }} />
          </a>
          <p className="text-[11px]" style={{ color: 'var(--prod-muted)' }}>
            {/* ⚠️ o qualificador só existe quando o NOME repete no cadastro */}
            {linha.qualificador && <span>{linha.qualificador} · </span>}
            {linha.lancamentos > 0
              ? `${linha.lancamentos} lançamento${linha.lancamentos > 1 ? 's' : ''} no mês`
              : 'nenhum lançamento no mês'}
            {linha.emAbertoN > 0 && ` · ${linha.emAbertoN} em aberto (${formatBRL(linha.emAbertoValor)})`}
          </p>
        </div>
        <button type="button" onClick={aoTirar} aria-label={`tirar ${linha.nome} dos custos fixos`}
          className="shrink-0 rounded p-1" style={{ color: 'var(--prod-muted)' }}>
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <CampoDoPlano valor={linha.planejado} salvando={salvando} rastro={linha.planejadoRastro} aoSalvar={aoPlanejar} />

      <div className="flex items-baseline justify-between lg:block lg:text-right">
        <span className="text-[11px] lg:hidden" style={{ color: 'var(--prod-muted)' }}>realizado</span>
        <span className="text-[14px] font-semibold tabular-nums" style={{ color: 'var(--prod-primary)' }}>
          {formatBRL(linha.realizado)}
        </span>
      </div>

      <div className="flex items-center justify-between lg:justify-end">
        <span className="text-[11px] lg:hidden" style={{ color: 'var(--prod-muted)' }}>situação</span>
        <span className="rounded-md px-1.5 py-0.5 text-[11.5px] font-semibold"
          style={{ background: tom.bg, color: tom.ink }}>
          {linha.situacao.texto}
        </span>
      </div>
    </li>
  )
}

/**
 * ⭐ O PLANO EDITÁVEL NA PRÓPRIA LINHA.
 *
 * ⚠️ O que se DIGITA é TEXTO e fica texto enquanto se digita; o número é DERIVADO — a lição do
 * campo de quantidade do estoque (28/09): com `value={numero}`, no instante em que a vírgula é
 * digitada `"8.400,"` vira o número e a vírgula **some da tela**.
 *
 * ⚠️ E vazio APAGA o plano (volta pra "não declarei"), que é diferente de declarar ZERO.
 */
function CampoDoPlano({ valor, salvando, rastro, aoSalvar }: {
  valor: number | null
  salvando: boolean
  rastro: { quem: string | null; quando: string } | null
  aoSalvar: (v: number | null) => void
}) {
  const inicial = valor == null ? '' : valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const [txt, setTxt] = useState(inicial)
  const ultimo = useRef(inicial)

  // ⚠️ o servidor manda: quando o payload volta com outro valor, o campo acompanha — mas só se
  // o dono não estiver com algo digitado diferente (sobrescrever o que ele escreveu é pior).
  useEffect(() => {
    if (ultimo.current !== inicial) { setTxt(inicial); ultimo.current = inicial }
  }, [inicial])

  const comitar = () => {
    const limpo = txt.trim()
    if (limpo === '') { if (valor != null) aoSalvar(null); return }
    const n = Number(limpo.replace(/\./g, '').replace(',', '.'))
    if (!Number.isFinite(n) || n < 0) { setTxt(inicial); return }
    if (valor != null && Math.abs(n - valor) < 0.005) return
    aoSalvar(n)
  }

  return (
    <div className="flex items-center justify-between gap-2 lg:justify-end">
      <span className="text-[11px] lg:hidden" style={{ color: 'var(--prod-muted)' }}>planejado</span>
      <div className="flex items-center gap-1.5">
        {salvando && <Loader2 className="h-3 w-3 animate-spin" style={{ color: 'var(--prod-muted)' }} />}
        <input
          value={txt}
          onChange={(e) => setTxt(e.target.value)}
          onBlur={comitar}
          onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
          inputMode="decimal"
          placeholder="—"
          aria-label="valor planejado no mês"
          title={rastro ? `declarado por ${rastro.quem ?? 'alguém'} em ${new Date(rastro.quando).toLocaleDateString('pt-BR')}` : undefined}
          className="w-24 rounded-lg px-2 py-1 text-right text-[13.5px] tabular-nums"
          style={{
            border: '1px solid var(--prod-line-strong)',
            background: 'var(--prod-surface)',
            color: 'var(--prod-primary)',
          }}
        />
      </div>
    </div>
  )
}

/** ⭐ o gesto "marcar categoria como fixa" — só categorias de DESPESA que ainda não estão na lista */
function SeletorDeCategoria({ disponiveis, salvando, aoEscolher, aoFechar }: {
  disponiveis: { id: string; nome: string; dreGroup: string | null; qualificador: string | null }[]
  salvando: string | null
  aoEscolher: (categoryId: string) => void
  aoFechar: () => void
}) {
  const [busca, setBusca] = useState('')
  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase()
    if (!q) return disponiveis
    return disponiveis.filter((c) => c.nome.toLowerCase().includes(q))
  }, [busca, disponiveis])

  return (
    <div className="border-t px-4 py-3" style={{ borderColor: 'var(--prod-line)', background: 'var(--prod-surface-1)' }}>
      <div className="mb-2 flex items-center gap-2">
        <label className="flex-1 text-[11px]" style={{ color: 'var(--prod-muted)' }}>
          Qual categoria a casa paga todo mês?
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="aluguel"
            className="mt-1 block w-full rounded-lg px-2 py-1.5 text-[13px]"
            style={{ border: '1px solid var(--prod-line-strong)', background: 'var(--prod-surface)', color: 'var(--prod-primary)' }} />
        </label>
        <button type="button" onClick={aoFechar} className="mt-4 rounded p-1" aria-label="fechar"
          style={{ color: 'var(--prod-muted)' }}><X className="h-4 w-4" /></button>
      </div>
      {filtradas.length === 0 ? (
        <p className="text-[12px]" style={{ color: 'var(--prod-secondary)' }}>
          Nada com «{busca}» entre as categorias de despesa que ainda não são fixas.
        </p>
      ) : (
        <div className="flex max-h-56 flex-wrap gap-1.5 overflow-y-auto">
          {filtradas.map((c) => (
            <button key={c.id} type="button" onClick={() => aoEscolher(c.id)}
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[12px]"
              style={{ background: 'var(--prod-surface)', color: 'var(--prod-primary)', boxShadow: 'inset 0 0 0 1px var(--prod-line-strong)' }}>
              {salvando === `marcar:${c.id}`
                ? <Loader2 className="h-3 w-3 animate-spin" />
                : <Check className="h-3 w-3" style={{ color: 'var(--prod-accent)' }} />}
              {c.nome}
              {c.qualificador && <span style={{ color: 'var(--prod-muted)' }}>· {c.qualificador}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
