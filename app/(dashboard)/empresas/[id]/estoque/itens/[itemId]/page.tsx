'use client'

// ESTOQUE — A PÁGINA DO ITEM. Cabeçalho + o que o item É hoje + quem o usa + tudo que
// aconteceu com ele: entradas E saídas, cada linha com o TIPO real, QUEM fez e link pra ORIGEM.
//
// ⛔ Era "Histórico de compras" e mostrava o ledger inteiro sob esse nome (08/09/2026).
//
// ⭐⭐ v4 (06/10/2026) — **tudo que existia FICA**: converter a unidade, faixa mín/máx com
// salvar, gráfico de preço, histórico com chips + forense + clique-na-origem + o Σ do rodapé
// que bate com o saldo, e o aviso de negativo com as duas portas. O que entra é o que
// faltava: a pílula de estado, a cobertura, a BUSCA REVERSA (quem usa este item), o mínimo
// sugerido, o resumo/período/busca/CSV do histórico, a LINHA DO ZERO e o saldo no tempo.
//
// ⚠️ A roupa passou a ser por TOKEN (`var(--prod-*)`/`var(--fam-*)`): os dois temas saem de
// graça, e é o que o guard de "zero hex cravado" cobra nas telas v4.

import { useEffect, useState, use, useMemo, Fragment } from 'react'
import type { FichaItem } from '@/lib/stock/ficha-item'
import { formatarQtd } from '@/lib/stock/quantidade'
import { Card, CardContent } from '@/components/ui/card'
import {
  Loader2, ArrowLeft, TrendingUp, ChevronDown, Ruler, ExternalLink, History, AlertTriangle,
  PackagePlus, Download, Search, Activity,
} from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceArea } from 'recharts'
import { NomeEditavel } from '@/components/estoque/nome-editavel'
import { MinMaxEditor } from '@/components/estoque/min-max-editor'
import { CategoriaEditavel } from '@/components/estoque/categoria-editavel'
import { LogoDaReceita } from '@/components/estoque/logo-da-receita'
import { UsadoEmFichasCard } from '@/components/estoque/usado-em-fichas-card'
import { statusEstoque } from '@/lib/stock/status-estoque'
import type { LinhaDoHistorico, FamiliaMovimento } from '@/lib/stock/movimento-explicado'
import { resumoDoPeriodo, linhaDoZero, saldoNoTempo, aplicarRecorte, temRecorte } from '@/lib/stock/item/leitura-do-historico'
import type { TomDaPilula } from '@/lib/stock/item/pilula-do-item'
import { casaBusca } from '@/lib/busca-texto'
import { baixarCsv } from '@/lib/format/csv-cliente'

/**
 * ⭐ O TIPO VEM DA LIB (19/09) — a mesma dívida do tablet, resolvida do mesmo jeito.
 *
 * ⚠️ Era copiado à mão sobre o payload da rota: campo novo no servidor (o `encerrado`)
 * ficava invisível aqui, e campo renomeado lá passava verde no `tsc`. Derivando, o
 * compilador cobra — é o guard que a interface escrita à mão não dá.
 */
type Ficha = FichaItem

const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const num = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 6 })
const fmtDia = (iso: string | null) => (iso ? iso.slice(0, 10).split('-').reverse().join('/') : '—')

/**
 * ⭐ A COR DO CHIP É A DA FAMÍLIA — o dono reconhece o tipo de longe, sem ler.
 * ⚠️ Máx 2 pesos escuros por linha (régua da casa): o chip é claro, o peso fica no número.
 * ⭐ v4: pelos tokens de FAMÍLIA, então ele inverte no tema escuro em vez de sumir.
 */
const FAM_DO_MOVIMENTO: Record<FamiliaMovimento, string> = {
  COMPRA: 'verde', CONTAGEM: 'indigo', PRODUCAO: 'azul',
  VENDA: 'ambar', SAIDA: 'coral', ESTORNO: 'cinza', OUTRO: 'cinza',
}
const chipDaFamilia = (f: FamiliaMovimento) => ({
  background: `var(--fam-${FAM_DO_MOVIMENTO[f]}-bg)`,
  color: `var(--fam-${FAM_DO_MOVIMENTO[f]}-ink)`,
})

/** ⭐ o tom da pílula → tokens (a decisão de QUAL tom é do servidor, nunca daqui) */
const TOM: Record<TomDaPilula, { bg: string; ink: string }> = {
  verde: { bg: 'var(--fam-verde-bg)', ink: 'var(--fam-verde-ink)' },
  ambar: { bg: 'var(--fam-ambar-bg)', ink: 'var(--fam-ambar-ink)' },
  vermelho: { bg: 'var(--fam-coral-bg)', ink: 'var(--fam-coral-ink)' },
  cinza: { bg: 'var(--fam-cinza-bg)', ink: 'var(--fam-cinza-ink)' },
}

export default function FichaItemPage({ params }: { params: Promise<{ id: string; itemId: string }> }) {
  const { id, itemId } = use(params)
  const [ficha, setFicha] = useState<Ficha | null | undefined>(undefined)
  /** 'TUDO' · 'COMPRAS' (a aba pra comparar preço de fornecedor) · ou um tipo específico */
  const [filtro, setFiltro] = useState<string>('TUDO')
  /**
   * ⭐⭐ MODO CLEAN É O PADRÃO (11/09) — par movimento+estorno que se anula vira UMA linha
   * fina. ⛔ O forense abre os pares: o rastro é o que provou o desastre de 10/09, e some
   * da LISTA, nunca do DADO.
   */
  const [forense, setForense] = useState(false)
  /** qual linha anulada o dono abriu (o par inteiro, dentro da própria tabela) */
  const [parAberto, setParAberto] = useState<string | null>(null)
  /** ⭐ o recorte novo do histórico: período livre + busca por texto */
  const [de, setDe] = useState('')
  const [ate, setAte] = useState('')
  const [busca, setBusca] = useState('')
  /** ⭐ qual gráfico está na frente — preço pago × saldo no tempo */
  const [grafico, setGrafico] = useState<'PRECO' | 'SALDO'>('PRECO')

  useEffect(() => {
    fetch(`/api/empresas/${id}/estoque/itens/${itemId}${forense ? '?forense=1' : ''}`).then((r) => r.json()).then((j) => setFicha(j.ficha ?? null)).catch(() => setFicha(null))
  }, [id, itemId, forense])

  // ⚠️ REGRA 9: os hooks ficam ANTES do early return, com `?? []` — a ordem deles não pode
  // depender de dado carregado.
  const recorte = useMemo(() => ({ filtro, de: de || null, ate: ate || null, busca }), [filtro, de, ate, busca])
  /** ⛔ o recorte vem da LIB (pura e testada), nunca de um `filter` escrito no JSX */
  const linhas = useMemo(() => aplicarRecorte(ficha?.historico ?? [], recorte, casaBusca), [ficha, recorte])
  /** ⭐ o resumo recalcula com o recorte ativo — é o que o dono está vendo */
  const resumo = useMemo(() => resumoDoPeriodo(linhas), [linhas])
  /**
   * ⭐⭐ A LINHA DO ZERO sai da lista INTEIRA, não do recorte: o cruzamento pro negativo é um
   * fato do ledger, e não muda porque o dono filtrou a tela.
   */
  const zero = useMemo(() => linhaDoZero(ficha?.historico ?? []), [ficha])
  const serieSaldo = useMemo(() => saldoNoTempo(ficha?.historico ?? []), [ficha])
  /** ⭐ a última compra — é o que a tela mostra quando o custo médio não existe */
  const ultimaCompra = useMemo(
    () => (ficha?.historico ?? []).find((l) => l.ehCompra && l.precoEhDeCompra && l.custoUnitario > 0) ?? null,
    [ficha],
  )

  if (ficha === undefined) return <div className="p-6"><Loader2 className="h-5 w-5 animate-spin" style={{ color: 'var(--prod-muted)' }} /></div>
  if (!ficha) return <div className="p-6 text-sm" style={{ color: 'var(--prod-secondary)' }}>Item não encontrado.</div>

  const un = ficha.item.unidadeControle
  const nCompras = ficha.historico.filter((l) => l.ehCompra).length
  const recorteAtivo = temRecorte(recorte)
  const tom = TOM[ficha.pilula.tom]
  const negativo = ficha.saldo < 0

  const baixar = () => {
    baixarCsv(
      `item-${ficha.item.nome.replace(/\W+/g, '-').toLowerCase()}`,
      ['Data', 'O que foi', 'De onde veio', 'Quem', `Qtd (${un})`, 'Custo un.', 'Total', `Saldo (${un})`],
      linhas.map((l) => [
        l.data.slice(0, 10), l.chip, l.detalhe, l.quem ?? '',
        l.quantidade, l.custoUnitario, l.movePrateleira ? l.custoTotal : '', l.saldoApos ?? '',
      ]),
    )
  }

  return (
    <div className="space-y-5" style={{ background: 'var(--prod-bg)', minHeight: '100%' }}>
      <a href={`/empresas/${id}/estoque/posicao`} className="flex items-center gap-1 text-xs" style={{ color: 'var(--prod-muted)' }}><ArrowLeft className="h-3.5 w-3.5" /> voltar pra posição</a>

      {/*
        ⛔⛔⛔ A PORTA QUE FALTAVA (24/09) — a **maçaneta**, não a placa.

        A recusa do item negativo manda o dono pra cá dizendo *"ver o histórico deste item e
        corrigir a entrada que faltou"* — e esta tela **não oferecia gesto nenhum**. Porta
        sem maçaneta, a mesma família que esta casa já pagou nove vezes.

        ⚠️ Botão de VERDADE (borda + ícone + verbo), nunca texto cinza com hover: *"ação
        escondida sem afordância não existe, principalmente no celular"* (30/08) — e é no
        celular que o dono opera.

        ⭐⭐ E DESDE 05/10 SÃO **DUAS PORTAS**: a compra que faltou **OU** a contagem, porque
        *"a contagem é a âncora"* — ela sempre entra, mesmo sobre saldo negativo. Oferecer só
        a nota era mandar o dono esperar um documento que pode não existir.
      */}
      {negativo && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl px-3.5 py-3"
          style={{ background: 'var(--fam-ambar-bg)', boxShadow: 'inset 0 0 0 1px var(--fam-ambar-mid)' }}>
          <AlertTriangle className="h-4 w-4 shrink-0" style={{ color: 'var(--fam-ambar-mid)' }} />
          <p className="min-w-0 flex-1 text-[12px] leading-snug" style={{ color: 'var(--fam-ambar-ink)' }}>
            <b>{num(ficha.saldo)} {un}</b> — saiu mais do que entrou.
            Se foi compra que não chegou por nota, lance a entrada com a <b>quantidade e o valor
            verdadeiros</b>; se tudo já foi lançado, <b>conte o que está na prateleira</b> — a
            contagem corrige o saldo e o sistema registra o ajuste.
          </p>
          <a href={`/empresas/${id}/estoque/entrada-manual?item=${itemId}`}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold"
            style={{ background: 'var(--prod-surface)', color: 'var(--fam-ambar-ink)', boxShadow: 'inset 0 0 0 1px var(--fam-ambar-mid)' }}>
            <PackagePlus className="h-3.5 w-3.5" /> lançar a entrada que faltou
          </a>
          <a href={`/empresas/${id}/estoque/contagem`}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold"
            style={{ background: 'var(--prod-acao-bg)', color: 'var(--prod-acao-ink)' }}>
            contar este item
          </a>
        </div>
      )}

      {/* ══════ 1. CABEÇALHO v4 + STATUS ══════ */}
      <div>
        <div className="flex items-start gap-3">
          {/* ⭐ o logo sai do MAPA ÚNICO (o mesmo da receita) — e o pontinho é o do negativo */}
          <LogoDaReceita nome={ficha.item.nome} tamanho={48} alerta={negativo ? { titulo: 'saldo negativo' } : null} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <div className="text-[19px]">
                <NomeEditavel companyId={id} itemId={itemId} nome={ficha.item.nome} className="text-[19px] font-semibold"
                  onSalvo={(n) => setFicha({ ...ficha, item: { ...ficha.item, nome: n } })} />
              </div>
              {/* ⭐⭐ A PÍLULA DE ESTADO — a decisão vem do servidor; aqui só a tinta */}
              <span className="rounded-full px-2 py-0.5 text-[11.5px] font-semibold" style={{ background: tom.bg, color: tom.ink }}>
                {ficha.pilula.label}
              </span>
            </div>
            {/* ⭐ a CATEGORIA é editável AQUI desde 12/09 (o caso do vinagre "uso interno") */}
            <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[13px]" style={{ color: 'var(--prod-secondary)' }}>
              <CategoriaEditavel
                companyId={id} itemId={itemId} categoria={ficha.item.categoria}
                onSalvo={(nova) => setFicha({ ...ficha, item: { ...ficha.item, categoria: nova } })}
              />
              · controle em {un}
            </p>
            {ficha.pilula.porque && (
              <p className="mt-0.5 text-[11.5px]" style={{ color: 'var(--prod-muted)' }}>{ficha.pilula.porque}</p>
            )}
            {/* ⭐ o rastro da troca de categoria — a tabela guardava e ninguém mostrava */}
            {ficha.categoriaRastro && (
              <p className="mt-0.5 text-[11px]" style={{ color: 'var(--prod-muted)' }}>
                classificação trocada de <b>{ficha.categoriaRastro.de}</b> pra <b>{ficha.categoriaRastro.para}</b>
                {ficha.categoriaRastro.quem ? ` por ${ficha.categoriaRastro.quem}` : ''} em {fmtDia(ficha.categoriaRastro.quando)}
              </p>
            )}
          </div>
        </div>

        {/* ⭐ 4 cartões: saldo · custo médio · valor · COBERTURA (o novo) */}
        <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Cartao titulo="Saldo atual">
            <p className="text-[19px] font-semibold tabular-nums" style={{ color: negativo ? 'var(--prod-coral)' : 'var(--prod-primary)' }}>
              {num(ficha.saldo)} <span className="text-[12px] font-normal" style={{ color: 'var(--prod-muted)' }}>{un}</span>
            </p>
            {negativo && <p className="mt-0.5 text-[11px]" style={{ color: 'var(--prod-coral)' }}>contar resolve — a contagem é a âncora</p>}
          </Cartao>

          <Cartao titulo="Custo médio">
            <p className="text-[19px] font-semibold tabular-nums" style={{ color: 'var(--prod-primary)' }}>
              {ficha.custoMedio != null ? brl(ficha.custoMedio) : '—'}
            </p>
            {/*
              ⭐ CUSTO MÉDIO "—" NÃO É AUSÊNCIA DE INFORMAÇÃO: a última compra existe e é o
              número que o dono usa pra decidir. ⚠️ E ela vem marcada como última COMPRA, nunca
              como custo médio — são coisas diferentes, e misturá-las faria o dono comparar
              fornecedor contra a média do próprio estoque.
            */}
            {ficha.custoMedio == null && ultimaCompra && (
              <p className="mt-0.5 text-[11px]" style={{ color: 'var(--prod-muted)' }}>
                última compra {brl(ultimaCompra.custoUnitario)} · {fmtDia(ultimaCompra.data)}
              </p>
            )}
          </Cartao>

          <Cartao titulo="Valor em estoque">
            <p className="text-[19px] font-semibold tabular-nums" style={{ color: 'var(--prod-primary)' }}>{brl(ficha.valor)}</p>
          </Cartao>

          {/*
            ⭐⭐ COBERTURA — "dá pra ~N dias".
            ⛔ Saldo negativo/zerado ou sem consumo medido mostra **"—" com o motivo**: dizer
            "dá pra 0 dias" seria uma previsão sobre um dado impossível.
          */}
          <Cartao titulo="Cobertura">
            <p className="text-[19px] font-semibold tabular-nums" style={{ color: 'var(--prod-primary)' }}>
              {ficha.cobertura.dias != null ? `~${ficha.cobertura.dias} dias` : '—'}
            </p>
            <p className="mt-0.5 text-[11px]" style={{ color: 'var(--prod-muted)' }}>
              {ficha.cobertura.dias != null
                ? `no ritmo de ${num(ficha.consumo.porDia ?? 0)} ${un}/dia (últimos ${ficha.consumo.diasDaJanela}d)`
                : ficha.cobertura.porque === 'SEM_CONSUMO'
                  ? `nada saiu nos últimos ${ficha.consumo.diasDaJanela} dias`
                  : 'sem saldo positivo pra projetar'}
            </p>
          </Cartao>
        </div>
      </div>

      {/* ⭐⭐ ITEM ENCERRADO (19/09) — a faixa vem ANTES dos gestos: quem abre a ficha
          precisa saber que este item não volta pra operação antes de tentar mexer nele. */}
      {ficha.encerrado && (
        <div className="rounded-xl px-3.5 py-2.5" style={{ background: 'var(--prod-surface-1)', boxShadow: 'inset 0 0 0 1px var(--prod-line-strong)' }}>
          <p className="text-[13px] font-semibold" style={{ color: 'var(--prod-primary)' }}>⊘ {ficha.encerrado}</p>
          <p className="mt-0.5 text-[11.5px] leading-snug" style={{ color: 'var(--prod-muted)' }}>
            Ele não aparece em nenhuma lista de trabalho — posição, contagem, receitas, produção.
            O histórico abaixo continua inteiro: as produções antigas usaram este item, e apagá-las
            reescreveria o custo do que já foi vendido.
          </p>
        </div>
      )}

      {/* ══════ 3. USADO EM N FICHAS — a busca reversa ══════ */}
      <UsadoEmFichasCard uso={ficha.usoEmFichas} nomeDoItem={ficha.item.nome} />

      {/* trocar a régua do item (unidade de compra → unidade de consumo) */}
      <ReunitizarBloco companyId={id} itemId={itemId} nome={ficha.item.nome} unidade={un} saldo={ficha.saldo} custoMedio={ficha.custoMedio} />

      {/* ══════ 4. faixa de estoque (mín/máx) + status + a SUGESTÃO ══════ */}
      <MinMaxEditor
        companyId={id} itemId={itemId} unidade={un}
        estoqueMin={ficha.item.estoqueMin} estoqueMax={ficha.item.estoqueMax} status={ficha.status}
        sugestao={ficha.sugestaoMinimo}
        onSalvo={(min, max) => setFicha({ ...ficha, item: { ...ficha.item, estoqueMin: min, estoqueMax: max }, status: statusEstoque(ficha.saldo, min, max) })}
      />

      {/* ══════ 6. GRÁFICOS: preço pago × saldo no tempo ══════ */}
      {(ficha.precoTempo.length >= 2 || serieSaldo.length >= 2) && (
        <Card style={{ background: 'var(--prod-surface)', borderColor: 'var(--prod-line)' }}><CardContent className="p-4">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            {grafico === 'PRECO'
              ? <TrendingUp className="h-4 w-4" style={{ color: 'var(--prod-accent)' }} />
              : <Activity className="h-4 w-4" style={{ color: 'var(--prod-accent)' }} />}
            <p className="text-sm font-semibold" style={{ color: 'var(--prod-primary)' }}>
              {grafico === 'PRECO' ? 'Preço unitário no tempo' : 'Saldo no tempo'}
            </p>
            {/* ⭐ toggle, não duas telas: é a MESMA pergunta ("como este item andou") em dois eixos */}
            <div className="ml-auto flex gap-1">
              {([['PRECO', 'preço'], ['SALDO', 'saldo']] as const).map(([k, rot]) => (
                <button key={k} onClick={() => setGrafico(k)}
                  disabled={k === 'PRECO' ? ficha.precoTempo.length < 2 : serieSaldo.length < 2}
                  className="h-7 rounded-lg px-2.5 text-[12px] font-medium disabled:opacity-40"
                  style={grafico === k
                    ? { background: 'var(--prod-acao-bg)', color: 'var(--prod-acao-ink)' }
                    : { background: 'var(--prod-surface-1)', color: 'var(--prod-secondary)' }}>
                  {rot}
                </button>
              ))}
            </div>
          </div>
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              {grafico === 'PRECO' ? (
                <LineChart data={ficha.precoTempo} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                  <XAxis dataKey="data" tickFormatter={fmtDia} tick={{ fontSize: 11 }} stroke="var(--prod-muted)" />
                  <YAxis tick={{ fontSize: 11 }} stroke="var(--prod-muted)" width={56} tickFormatter={(v) => brl(v)} />
                  <Tooltip formatter={(v) => brl(Number(v))} labelFormatter={(l) => fmtDia(String(l))} />
                  <Line type="monotone" dataKey="preco" stroke="var(--prod-accent)" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              ) : (
                <LineChart data={serieSaldo} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                  <XAxis dataKey="data" tickFormatter={fmtDia} tick={{ fontSize: 11 }} stroke="var(--prod-muted)" />
                  <YAxis tick={{ fontSize: 11 }} stroke="var(--prod-muted)" width={56} tickFormatter={(v) => num(Number(v))} />
                  <Tooltip formatter={(v) => `${num(Number(v))} ${un}`} labelFormatter={(l) => fmtDia(String(l))} />
                  {/*
                    ⭐⭐ A ZONA NEGATIVA PINTADA — *"o desenho do buraco da ervilha vira visível
                    num olhar"* (ordem do dono). ⚠️ Só aparece quando o item REALMENTE esteve
                    negativo: pintar uma faixa que ninguém alcançou seria decoração.
                  */}
                  {serieSaldo.some((p) => p.saldo < 0) && (
                    <ReferenceArea y1={Math.min(...serieSaldo.map((p) => p.saldo))} y2={0}
                      fill="var(--fam-coral-mid)" fillOpacity={0.12} />
                  )}
                  <Line type="monotone" dataKey="saldo" stroke="var(--prod-accent)" strokeWidth={2} dot={{ r: 2 }} />
                </LineChart>
              )}
            </ResponsiveContainer>
          </div>
        </CardContent></Card>
      )}

      {/* ══════ 5. HISTÓRICO DO ITEM — entradas E saídas, cada linha com tipo/quem/origem ══════ */}
      <div>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <History className="h-4 w-4 shrink-0" style={{ color: 'var(--prod-accent)' }} />
          <h2 className="text-sm font-semibold" style={{ color: 'var(--prod-primary)' }}>Histórico do item</h2>
          <p className="hidden flex-1 truncate text-xs lg:block" style={{ color: 'var(--prod-muted)' }}>tudo que entrou e saiu — clique na origem pra chegar na fonte</p>
          {/* ⭐ CSV do que está FILTRADO (botão discreto, como o dono pediu) */}
          <button onClick={baixar} className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-xs"
            style={{ boxShadow: 'inset 0 0 0 1px var(--prod-line-strong)', color: 'var(--prod-secondary)' }}>
            <Download className="h-3.5 w-3.5" /> CSV
          </button>
        </div>

        {/* ⭐ o filtro só oferece o que EXISTE neste item — opção vazia é convite a beco sem saída */}
        <div className="mb-2 flex flex-wrap items-center gap-1.5">
          {[
            { k: 'TUDO', label: `Tudo (${ficha.historico.length})` },
            ...(nCompras ? [{ k: 'COMPRAS', label: `Só compras (${nCompras})` }] : []),
            ...ficha.tipos.map((t) => ({ k: t.tipo, label: `${t.chip} (${t.n})` })),
          ].map((o) => (
            <button
              key={o.k}
              onClick={() => setFiltro(o.k)}
              className="h-7 rounded-lg px-2.5 text-[12px] font-medium transition"
              style={filtro === o.k
                ? { background: 'var(--prod-acao-bg)', color: 'var(--prod-acao-ink)' }
                : { background: 'var(--prod-surface-1)', color: 'var(--prod-secondary)' }}
            >
              {o.label}
            </button>
          ))}
          {/* ⭐ o toggle só existe quando há par colapsado — botão que não faz nada é ruído.
              ⚠️ no forense o contador some (a lista já está crua), então a régua é `anulados > 0`
              OU estar ligado, senão desligar esconderia o próprio botão. */}
          {(ficha.anulados > 0 || forense) && (
            <button
              onClick={() => { setForense((v) => !v); setParAberto(null) }}
              className="ml-auto h-7 rounded-lg px-2.5 text-[12px] font-medium transition"
              style={forense
                ? { background: 'var(--prod-mudo)', color: 'var(--prod-acao-ink)' }
                : { background: 'var(--prod-surface)', color: 'var(--prod-muted)', boxShadow: 'inset 0 0 0 1px var(--prod-line-strong)' }}
              title="abre os pares lançamento+estorno que se anulam"
            >
              {forense ? 'voltar ao modo limpo' : 'mostrar tudo (forense)'}
            </button>
          )}
        </div>

        {/* ⭐ PERÍODO LIVRE + BUSCA (o padrão do Real×Teórico) */}
        <div className="mb-2 flex flex-wrap items-end gap-2">
          <label className="text-[11px]" style={{ color: 'var(--prod-muted)' }}>de
            <input type="date" value={de} onChange={(e) => setDe(e.target.value)}
              className="mt-0.5 block h-8 rounded-lg px-2 text-[12px]"
              style={{ boxShadow: 'inset 0 0 0 1px var(--prod-line-strong)', background: 'var(--prod-surface)', color: 'var(--prod-primary)' }} />
          </label>
          <label className="text-[11px]" style={{ color: 'var(--prod-muted)' }}>até
            <input type="date" value={ate} onChange={(e) => setAte(e.target.value)}
              className="mt-0.5 block h-8 rounded-lg px-2 text-[12px]"
              style={{ boxShadow: 'inset 0 0 0 1px var(--prod-line-strong)', background: 'var(--prod-surface)', color: 'var(--prod-primary)' }} />
          </label>
          <label className="min-w-[180px] flex-1 text-[11px]" style={{ color: 'var(--prod-muted)' }}>buscar na origem, no tipo ou em quem fez
            <span className="mt-0.5 flex h-8 items-center gap-1.5 rounded-lg px-2"
              style={{ boxShadow: 'inset 0 0 0 1px var(--prod-line-strong)', background: 'var(--prod-surface)' }}>
              <Search className="h-3.5 w-3.5 shrink-0" style={{ color: 'var(--prod-muted)' }} />
              <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="ex: 1234, frigorífico, marcyelle"
                className="w-full bg-transparent text-[12px] outline-none" style={{ color: 'var(--prod-primary)' }} />
            </span>
          </label>
          {recorteAtivo && (
            <button onClick={() => { setDe(''); setAte(''); setBusca(''); setFiltro('TUDO') }}
              className="h-8 rounded-lg px-2.5 text-[12px]" style={{ color: 'var(--prod-accent)' }}>
              limpar o recorte
            </button>
          )}
        </div>

        {/*
          ⭐⭐ O RESUMO DO RECORTE, no topo da tabela — *"entrou X · saiu Y · Δ Z · N
          movimentos"*, recalculando com os filtros ativos.
          ⚠️ E ele DIZ quantas linhas ficaram fora da conta (consumo de produção, par anulado):
          exclusão escondida é tão ruim quanto exclusão nenhuma.
        */}
        <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg px-3 py-2 text-[12px]"
          style={{ background: 'var(--prod-surface-1)', color: 'var(--prod-secondary)' }}>
          <span>entrou <b className="tabular-nums" style={{ color: 'var(--prod-verde)' }}>{num(resumo.entrou)} {un}</b></span>
          <span>saiu <b className="tabular-nums" style={{ color: 'var(--prod-coral)' }}>{num(resumo.saiu)} {un}</b></span>
          <span>Δ <b className="tabular-nums" style={{ color: 'var(--prod-primary)' }}>{resumo.delta > 0 ? '+' : ''}{num(resumo.delta)} {un}</b></span>
          <span className="tabular-nums">{brl(resumo.deltaValor)}</span>
          <span style={{ color: 'var(--prod-muted)' }}>{resumo.movimentos} movimento(s)</span>
          {resumo.foraDaConta > 0 && (
            <span style={{ color: 'var(--prod-muted)' }} title="consumo de produção e pares anulados não movem a prateleira">
              · {resumo.foraDaConta} fora da conta
            </span>
          )}
        </div>

        {linhas.length === 0 ? (
          <Card style={{ background: 'var(--prod-surface)', borderColor: 'var(--prod-line)' }}><CardContent className="p-6 text-center text-sm" style={{ color: 'var(--prod-secondary)' }}>
            {ficha.historico.length === 0
              ? 'Nada aconteceu com este item ainda. Cada recebimento, contagem, produção ou venda aparece aqui.'
              : 'Nenhuma linha neste recorte.'}
          </CardContent></Card>
        ) : (
          <Card style={{ background: 'var(--prod-surface)', borderColor: 'var(--prod-line)' }}><CardContent className="p-0 overflow-x-auto">
            <table className="density-normal w-full min-w-[720px]">
              <thead><tr className="text-left text-[11px] uppercase tracking-wide" style={{ color: 'var(--prod-muted)', borderBottom: '1px solid var(--prod-line-strong)' }}>
                <th className="px-3 py-2 font-medium">Data</th>
                <th className="px-3 py-2 font-medium">O que foi</th>
                <th className="px-3 py-2 font-medium">De onde veio</th>
                <th className="px-3 py-2 font-medium">Quem</th>
                <th className="px-3 py-2 text-right font-medium">Qtd</th>
                {/* ⚠️ o rótulo é GENÉRICO na coluna porque a natureza muda por linha; cada
                    célula diz qual é a sua (preço de compra × custo médio da baixa). */}
                {/* ⚠️ CUSTO UN. muda raro — é segundo olhar. Some no celular pra o SALDO caber. */}
                <th className="hidden px-3 py-2 text-right font-normal sm:table-cell" style={{ color: 'var(--prod-muted)' }}>Custo un.</th>
                <th className="px-3 py-2 text-right font-medium">Total</th>
                {/* ⭐⭐ O EXTRATO BANCÁRIO DO ITEM: quanto ele tinha DEPOIS de cada linha */}
                <th className="px-3 py-2 text-right font-medium">Saldo</th>
              </tr></thead>
              <tbody>
                {linhas.map((l, i) => (
                  <Fragment key={l.movimentoId}>
                    {/*
                      ⭐⭐ A LINHA DO ZERO (06/10) — *"o momento em que o saldo cruzou pro
                      negativo"*. ⛔ Ela aparece ACIMA da linha que cruzou, porque a tabela desce
                      do recente pro antigo: tudo que está acima desta divisória já estava no
                      buraco. É o que acha a origem do negativo de bate-olho.
                    */}
                    {zero?.movimentoId === l.movimentoId && (
                      <tr>
                        <td colSpan={8} className="px-3 py-1">
                          <span className="flex items-center gap-2 text-[11px] font-semibold" style={{ color: 'var(--prod-coral)' }}>
                            <span className="h-px flex-1" style={{ background: 'var(--fam-coral-mid)' }} />
                            ficou negativo aqui ({fmtDia(l.data)})
                            <span className="h-px flex-1" style={{ background: 'var(--fam-coral-mid)' }} />
                          </span>
                        </td>
                      </tr>
                    )}
                    {l.anulado ? (
                    /* ⭐⭐ O PAR QUE SE ANULA: UMA linha fina, apagada, SEM valor somando —
                       líquido zero. ⛔ Expansível: o par inteiro está aqui dentro, nada
                       foi apagado. */
                    <>
                      <tr style={{ borderBottom: '1px solid var(--prod-line)' }}>
                        <td colSpan={8} className="px-3 py-1">
                          <button onClick={() => setParAberto((v) => (v === l.movimentoId ? null : l.movimentoId))} className="flex w-full items-center gap-1.5 text-left text-[11.5px]" style={{ color: 'var(--prod-muted)' }}>
                            <span className="shrink-0">⊘</span>
                            <span className="truncate">{l.anulado.frase}</span>
                            <span className="ml-auto shrink-0" style={{ color: 'var(--prod-accent)' }}>{parAberto === l.movimentoId ? 'ocultar' : 'ver detalhe'}</span>
                          </button>
                        </td>
                      </tr>
                      {parAberto === l.movimentoId && [l.anulado.original, ...l.anulado.estornos].map((d) => (
                        <tr key={d.movimentoId} style={{ borderBottom: '1px solid var(--prod-line)', background: 'var(--prod-surface-1)' }}>
                          <td className="px-3 py-1 pl-6 text-[12px] tabular-nums" style={{ color: 'var(--prod-muted)' }}>{fmtDia(d.data)}</td>
                          <td className="px-3 py-1 text-[12px]" style={{ color: 'var(--prod-muted)' }}>{d.chip}</td>
                          <td className="px-3 py-1 text-[12px]" style={{ color: 'var(--prod-muted)' }}>{d.detalhe}</td>
                          <td className="px-3 py-1 text-[12px]" style={{ color: 'var(--prod-muted)' }}>{d.quem ?? '—'}</td>
                          <td className="px-3 py-1 text-right text-[12px] tabular-nums" style={{ color: 'var(--prod-muted)' }}>{d.quantidade > 0 ? '+' : ''}{formatarQtd(d.quantidade, un)}</td>
                          <td className="hidden px-3 py-1 text-right text-[12px] tabular-nums sm:table-cell" style={{ color: 'var(--prod-muted)' }}>{brl(d.custoUnitario)}</td>
                          <td className="px-3 py-1 text-right text-[12px] tabular-nums" style={{ color: 'var(--prod-muted)' }}>{brl(d.custoTotal)}</td>
                          {/* ⛔ o par não mexeu no saldo — a célula fica vazia de propósito */}
                          <td className="px-3 py-1" />
                        </tr>
                      ))}
                    </>
                  ) : (
                  <tr style={{
                    borderBottom: '1px solid var(--prod-line)',
                    // ⭐ zebrado v4 por CLASSE de linha (nunca `style` que vença o hover —
                    //   a lição de 05/10 na lista de concluídas)
                    background: l.familia === 'ESTORNO' ? 'var(--prod-surface-1)' : i % 2 ? 'var(--prod-surface-1)' : undefined,
                  }}>
                    <td className="px-3 py-0 text-[13px] tabular-nums" style={{ color: 'var(--prod-secondary)' }}>{fmtDia(l.data)}</td>
                    <td className="px-3 py-0">
                      <span className="inline-flex items-center rounded-md px-1.5 py-0.5 text-[11.5px] font-medium" style={chipDaFamilia(l.familia)}>
                        {l.chip}
                      </span>
                      {/* ⭐ o estorno DIZ o que estornou — antes era só uma linha vermelha */}
                      {l.estornoDe && (
                        <span className="ml-1.5 text-[11.5px]" style={{ color: 'var(--prod-muted)' }}>
                          do {l.estornoDe.chip.toLowerCase()} de {fmtDia(l.estornoDe.data)}
                        </span>
                      )}
                      {/* ⭐⭐ A HISTÓRIA DO QUE SAIU PRA PRODUÇÃO, dentro da linha que baixou.
                          ⛔ Sem valor na coluna TOTAL: o consumo NÃO move a prateleira (o
                          insumo já saiu aqui), e mostrá-lo como 2ª linha foi o que fez o dono
                          suspeitar de baixa dupla. */}
                      {l.dentroDaProducao && (
                        <div className="mt-0.5 text-[11px] leading-tight" style={{ color: 'var(--prod-muted)' }}>
                          separado {num(l.dentroDaProducao.separado)} · consumido {num(l.dentroDaProducao.consumido)}
                          {l.dentroDaProducao.devolvido > 0 && <> · devolvido {num(l.dentroDaProducao.devolvido)}</>}
                          {l.dentroDaProducao.emProducao > 0 && <> · <span style={{ color: 'var(--fam-azul-mid)' }}>em produção {num(l.dentroDaProducao.emProducao)}</span></>}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-0 text-[13px]" style={{ color: 'var(--prod-secondary)' }}>
                      {l.href ? (
                        <a href={l.href} className="inline-flex items-center gap-1 hover:underline" style={{ color: 'var(--prod-accent)' }}>
                          {l.detalhe}<ExternalLink className="h-3 w-3 shrink-0 opacity-60" />
                        </a>
                      ) : l.detalhe}
                    </td>
                    <td className="px-3 py-0 text-[13px]" style={{ color: 'var(--prod-secondary)' }}>{l.quem ?? <span style={{ color: 'var(--prod-muted)' }}>—</span>}</td>
                    <td className="px-3 py-0 text-right text-[13px] tabular-nums" style={{ color: l.quantidade < 0 ? 'var(--prod-coral)' : 'var(--prod-secondary)' }}>
                      {l.quantidade > 0 ? '+' : ''}{formatarQtd(l.quantidade, un)}
                    </td>
                    <td className="hidden px-3 py-0 text-right text-[12px] tabular-nums sm:table-cell" style={{ color: 'var(--prod-muted)' }}>
                      {/*
                        ⛔⛔ "R$ 0,00 MÉDIO" NÃO É DINHEIRO (06/10) — é **custo indisponível**: a
                        baixa saiu num instante em que o item estava negativo, e aí não existe
                        custo médio (o `saldo.ts` se recusa a dividir negativo por negativo).
                        ⚠️ Impresso como valor normal, ele parece preço real e entra na leitura
                        do dono como se a mercadoria tivesse saído de graça.
                      */}
                      {!l.precoEhDeCompra && l.custoUnitario === 0 ? (
                        <span className="opacity-50" title="custo indisponível — o item estava negativo quando esta linha saiu">
                          {brl(0)} <span className="text-[10.5px] font-normal">médio</span>
                        </span>
                      ) : (
                        <>
                          {brl(l.custoUnitario)}
                          {/* ⛔ SAÍDA NÃO É PREÇO DE COMPRA: dizer "preço un." num consumo faria o
                              dono comparar fornecedor contra a média interna do próprio estoque. */}
                          {!l.precoEhDeCompra && <span className="ml-1 text-[10.5px] font-normal">médio</span>}
                        </>
                      )}
                    </td>
                    {/* ⛔ linha que não move o saldo NÃO exibe valor no total: ou entra na
                        conta, ou não aparece somando (regra do dono, 09/09). */}
                    <td className="px-3 py-0 text-right text-[13px] font-medium tabular-nums"
                      style={{ color: !l.movePrateleira ? 'var(--prod-muted)' : l.custoTotal < 0 ? 'var(--prod-coral)' : 'var(--prod-primary)' }}>
                      {l.movePrateleira ? brl(l.custoTotal) : <span title="não mexe no saldo">—</span>}
                    </td>
                    {/* ⭐⭐ SALDO DEPOIS DESTA LINHA — derivado do ledger na ordem, nunca gravado.
                        ⛔ "—" quando não dá pra AFIRMAR (recorte parcial): número de estoque
                        plausível e errado é a mentira mais cara que esta tela poderia contar. */}
                    <td className="px-3 py-0 text-right text-[13px] font-semibold tabular-nums"
                      style={{ color: l.saldoApos != null && l.saldoApos < 0 ? 'var(--prod-coral)' : 'var(--prod-secondary)' }}>
                      {l.saldoApos == null
                        ? <span className="font-normal" style={{ color: 'var(--prod-muted)' }} title="o recorte não permite afirmar o saldo deste instante">—</span>
                        : <>{num(l.saldoApos)} <span className="text-[10.5px] font-normal" style={{ color: 'var(--prod-muted)' }}>{un}</span></>}
                    </td>
                  </tr>
                  )}
                  </Fragment>
                ))}
              </tbody>
              {/* ⭐⭐ O TESTE DA TELA, à vista: a soma da coluna TOTAL É o saldo. Sem isto o
                  dono não tem como saber se a tabela fecha — e foi a dúvida dele que abriu
                  esta frente. ⚠️ só aparece SEM RECORTE: filtrado, a soma é do recorte (e o
                  resumo do topo é quem fala dele). */}
              {!recorteAtivo && (
                <tfoot>
                  <tr style={{ borderTop: '1px solid var(--prod-line-strong)', background: 'var(--prod-surface-1)' }}>
                    <td className="px-3 py-2 text-[11.5px] font-medium uppercase tracking-wide" style={{ color: 'var(--prod-muted)' }} colSpan={4}>
                      soma das linhas
                    </td>
                    <td className="px-3 py-2 text-right text-[13px] font-semibold tabular-nums" style={{ color: 'var(--prod-primary)' }}>
                      {num(ficha.conferencia.somaQuantidade)} {un}
                    </td>
                    <td className="hidden px-3 py-2 sm:table-cell" />
                    <td className="px-3 py-2 text-right text-[13px] font-semibold tabular-nums" style={{ color: 'var(--prod-primary)' }}>{brl(ficha.conferencia.somaValor)}</td>
                    {/* ⭐⭐ O FECHO DA PROVA: o rodapé repete o saldo que a coluna vem descendo
                        linha a linha — e é o MESMO número da Posição. Três leitores, uma régua. */}
                    <td className="px-3 py-2 text-right text-[13px] font-semibold tabular-nums" style={{ color: 'var(--prod-primary)' }}>
                      {num(ficha.conferencia.saldo)} <span className="text-[10.5px] font-normal" style={{ color: 'var(--prod-muted)' }}>{un}</span>
                    </td>
                  </tr>
                  <tr style={{ background: 'var(--prod-surface-1)' }}>
                    <td className="px-3 pb-2 text-[11.5px]" style={{ color: ficha.conferencia.confere ? 'var(--prod-verde)' : 'var(--prod-coral)' }} colSpan={8}>
                      {ficha.conferencia.confere
                        ? `✓ bate com o saldo em estoque (${num(ficha.conferencia.saldo)} ${un} · ${brl(ficha.conferencia.valor)})`
                        : `⚠ NÃO bate com o saldo (${num(ficha.conferencia.saldo)} ${un} · ${brl(ficha.conferencia.valor)}) — a tabela está somando algo que o saldo não conta`}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </CardContent></Card>
        )}
      </div>
    </div>
  )
}

/** ⭐ o cartão do cabeçalho — um componente, 4 usos (nunca 4 blocos iguais escritos à mão) */
function Cartao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <Card style={{ background: 'var(--prod-surface)', borderColor: 'var(--prod-line)' }}>
      <CardContent className="p-3.5">
        <p className="text-[11px] uppercase tracking-wide" style={{ color: 'var(--prod-muted)' }}>{titulo}</p>
        <div className="mt-1">{children}</div>
      </CardContent>
    </Card>
  )
}


// ⭐ TROCAR A RÉGUA DO ITEM (27/08) — unidade de COMPRA → unidade de CONSUMO.
//
// O caso que pediu isto: o pão entrou controlado em PACOTE (12 pães, R$ 27,75) e a receita
// usa 1 PÃO (R$ 2,31). Pôr `1` na ficha baixaria um pacote inteiro por lanche — 12× a mais.
// Fica AQUI porque é aqui que o dono percebe (olhando saldo e custo médio do item).
//
// A prévia é obrigatória de propósito: mexe no ledger (estorno + movimento novo) e no fator
// aprendido das notas. Ver os dois lados antes de confirmar é o padrão do módulo.
function ReunitizarBloco({ companyId, itemId, nome, unidade, saldo, custoMedio }: {
  companyId: string; itemId: string; nome: string; unidade: string; saldo: number; custoMedio: number | null
}) {
  const [aberto, setAberto] = useState(false)
  const [fator, setFator] = useState('')
  const [novoNome, setNovoNome] = useState(nome)
  const [prev, setPrev] = useState<{ antes: { saldo: number; custoMedio: number | null; valor: number }; depois: { saldo: number; custoMedio: number | null; valor: number }; movimentos: number; mapas: { cProd: string; xProd: string | null; unidadeNota: string | null; fatorAntes: number; fatorDepois: number }[]; unidadeNova?: string; fichas?: { fichaNome: string; qtdAntes: number; qtdDepois: number; unidadeAntes: string }[]; bloqueios?: string[] } | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const [unidadeNova, setUnidadeNova] = useState(unidade)
  const f = Number((fator || '').replace(',', '.'))
  /**
   * ⭐ FATOR 1 É VÁLIDO QUANDO A UNIDADE MUDA (11/09/2026) — o caso do `OLEO DE SOJA`:
   * controle em **UN** virando **LT** com `1 UN = 1 L`. É a troca que faz o item aceitar
   * decimal (LT é fracionável), que era metade do motivo do dono.
   */
  const trocaUnidade = unidadeNova !== unidade
  const valido = Number.isFinite(f) && f > 0 && (f !== 1 || trocaUnidade)

  const campo = 'mt-1 block rounded-lg py-2 px-3 text-sm'
  const estiloCampo = { border: '1px solid var(--prod-line-strong)', background: 'var(--prod-surface)', color: 'var(--prod-primary)' }

  const verPrevia = async () => {
    setBusy(true); setErro(null); setPrev(null)
    try {
      const r = await fetch(`/api/empresas/${companyId}/estoque/itens/${itemId}/reunitizar?fator=${f}&unidade=${unidadeNova}`)
      const j = await r.json().catch(() => null)
      if (!r.ok) { setErro(j?.erro ?? 'Não consegui calcular a prévia.'); return }
      setPrev(j)
    } finally { setBusy(false) }
  }

  const aplicar = async () => {
    setBusy(true); setErro(null)
    try {
      const r = await fetch(`/api/empresas/${companyId}/estoque/itens/${itemId}/reunitizar`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fator: f,
          novoNome: novoNome.trim() !== nome ? novoNome.trim() : undefined,
          ...(trocaUnidade ? { unidadeControle: unidadeNova } : {}),
        }),
      })
      const j = await r.json().catch(() => null)
      if (!r.ok) { setErro(j?.erro ?? 'Não consegui trocar a unidade.'); return }
      window.location.reload()
    } finally { setBusy(false) }
  }

  if (!aberto) {
    // ⚠️⚠️ ISTO ERA TEXTO MORTO NA PRÁTICA (30/08/2026). O `onClick` sempre esteve aqui e
    // a API sempre respondeu — mas o gatilho era `text-xs text-slate-400` sem borda, sem
    // ícone, com sublinhado só no `hover` (que no CELULAR não existe). O dono olhou e leu
    // como legenda: *"aparece mas não é clicável, não tem botão"*. E ele está certo:
    // **controle que ninguém reconhece como controle é controle morto** — o defeito é de
    // afordância, não de código, e o efeito pro dono é o mesmo (não consegue converter).
    //
    // Agora é uma linha com borda, chevron e verbo no rótulo. `aria-expanded` porque isto
    // é um disclosure de verdade, não um link decorativo.
    return (
      <button
        onClick={() => setAberto(true)}
        aria-expanded={false}
        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs"
        style={{ border: '1px dashed var(--prod-line-strong)', color: 'var(--prod-secondary)' }}
      >
        <Ruler className="h-3.5 w-3.5 shrink-0" style={{ color: 'var(--prod-muted)' }} />
        <span className="flex-1">
          <b className="font-medium">Converter a unidade</b>
          <span className="block text-[11px]" style={{ color: 'var(--prod-muted)' }}>
            está em {unidade} de compra e você usa por unidade menor? (ex: 1 cartela = 30 ovos)
          </span>
        </span>
        <ChevronDown className="h-4 w-4 shrink-0" style={{ color: 'var(--prod-muted)' }} />
      </button>
    )
  }

  return (
    <Card style={{ background: 'var(--prod-surface)', borderColor: 'var(--fam-ambar-mid)' }}><CardContent className="space-y-3 p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold" style={{ color: 'var(--prod-primary)' }}>Trocar a unidade de controle</p>
          <p className="text-xs" style={{ color: 'var(--prod-muted)' }}>
            Hoje: <b>{num(saldo)} {unidade}</b> a {custoMedio != null ? brl(custoMedio) : '—'} cada.
            Se 1 {unidade} na verdade contém várias unidades de uso, informe quantas.
          </p>
        </div>
        <button onClick={() => { setAberto(false); setPrev(null); setErro(null) }} className="text-xs" style={{ color: 'var(--prod-muted)' }}>fechar</button>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        {/* ⭐ A UNIDADE NOVA (11/09/2026): sem ela o gesto só sabia "quantas cabem em 1",
            e o caso do óleo (UN → LT com fator 1) era recusado como "não muda nada". */}
        <label className="text-xs" style={{ color: 'var(--prod-muted)' }}>controlar em
          <select value={unidadeNova} onChange={(e) => { setUnidadeNova(e.target.value); setPrev(null) }}
            className={`${campo} w-24`} style={estiloCampo}>
            <option value="UN">UN</option>
            <option value="KG">KG</option>
            <option value="LT">LT</option>
          </select>
        </label>
        <label className="text-xs" style={{ color: 'var(--prod-muted)' }}>1 {unidade} contém
          <input value={fator} onChange={(e) => { setFator(e.target.value); setPrev(null) }} inputMode="decimal" placeholder="ex: 12"
            className={`${campo} w-24 tabular-nums`} style={estiloCampo} />
        </label>
        <label className="min-w-[220px] flex-1 text-xs" style={{ color: 'var(--prod-muted)' }}>Novo nome (o antigo passa a mentir)
          <input value={novoNome} onChange={(e) => setNovoNome(e.target.value)} className={`${campo} w-full`} style={estiloCampo} />
        </label>
        <button onClick={verPrevia} disabled={!valido || busy}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-xs disabled:opacity-40"
          style={{ boxShadow: 'inset 0 0 0 1px var(--prod-line-strong)', color: 'var(--prod-secondary)' }}>
          {busy && !prev ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null} ver a prévia
        </button>
      </div>

      {prev && (
        <div className="space-y-2 rounded-lg p-3" style={{ background: 'var(--prod-surface-1)' }}>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <p style={{ color: 'var(--prod-muted)' }}>Hoje</p>
              <p className="tabular-nums" style={{ color: 'var(--prod-secondary)' }}>{num(prev.antes.saldo)} {unidade} × {prev.antes.custoMedio != null ? brl(prev.antes.custoMedio) : '—'}</p>
            </div>
            <div>
              <p style={{ color: 'var(--prod-muted)' }}>Depois</p>
              <p className="font-medium tabular-nums" style={{ color: 'var(--prod-primary)' }}>{num(prev.depois.saldo)} × {prev.depois.custoMedio != null ? brl(prev.depois.custoMedio) : '—'}</p>
            </div>
          </div>
          {/* a âncora que prova que a conta só mudou de régua */}
          <p className="text-[11px]" style={{ color: 'var(--prod-verde)' }}>
            ✓ O valor em estoque não muda: <b>{brl(prev.antes.valor)}</b> antes e depois.
          </p>
          <p className="text-[11px]" style={{ color: 'var(--prod-muted)' }}>
            {prev.movimentos} movimento(s) do histórico são reescritos na régua nova (estorno + linha nova — o ledger não se apaga).
          </p>
          {/* ⭐⭐ AS FICHAS AFETADAS, À VISTA ANTES (11/09/2026, pedido do dono). Antes o
              gesto RECUSAVA item usado em ficha; agora converte junto — e converter em
              silêncio seria pior que recusar, então a lista vem primeiro. */}
          {(prev.fichas ?? []).length > 0 && (
            <div className="mt-2 rounded-lg px-3 py-2 text-[11.5px]" style={{ background: 'var(--fam-ambar-bg)', color: 'var(--fam-ambar-ink)' }}>
              <b>{(prev.fichas ?? []).length} receita(s) usam este item — as quantidades convertem junto:</b>
              {(prev.fichas ?? []).map((fi: { fichaNome: string; qtdAntes: number; qtdDepois: number; unidadeAntes: string }, i: number) => (
                <p key={i} className="tabular-nums">
                  {fi.fichaNome}: {num(fi.qtdAntes)} {fi.unidadeAntes} → {num(fi.qtdDepois)} {prev.unidadeNova ?? unidade}
                </p>
              ))}
            </div>
          )}
          {/* ⛔ o que IMPEDE a troca aparece ANTES do botão, não como erro depois do clique */}
          {(prev.bloqueios ?? []).length > 0 && (
            <div className="mt-2 rounded-lg px-3 py-2 text-[11.5px]" style={{ background: 'var(--fam-coral-bg)', color: 'var(--fam-coral-ink)' }}>
              {(prev.bloqueios ?? []).map((b: string, i: number) => <p key={i}>⛔ {b}</p>)}
            </div>
          )}
          {prev.mapas.map((m) => (
            <p key={m.cProd} className="text-[11px]" style={{ color: 'var(--prod-muted)' }}>
              Fator da nota “{m.xProd ?? m.cProd}” ({m.unidadeNota}): <b>{m.fatorAntes} → {m.fatorDepois}</b> — a próxima nota já entra convertida.
            </p>
          ))}
          <button onClick={aplicar} disabled={busy}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold disabled:opacity-50"
            style={{ background: 'var(--fam-ambar-mid)', color: 'var(--prod-acao-ink)' }}>
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null} confirmar a troca
          </button>
        </div>
      )}

      {erro && <p className="text-xs" style={{ color: 'var(--prod-coral)' }}>{erro}</p>}
    </CardContent></Card>
  )
}
