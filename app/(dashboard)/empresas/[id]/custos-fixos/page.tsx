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
 *
 * ⭐⭐⭐ **v2 (07/10) — AS 3 PRATELEIRAS LIGÁVEIS.** A ÚNICA conta que a tela faz é chamar
 * `cartoesDoTopo`, **a MESMA função pura que o servidor chamou pro primeiro paint**. O toggle
 * dos chips recalcula localmente (sem lag de rede, porque é gesto visual) e persiste em
 * segundo plano. ⛔ Aritmética própria aqui faria os 8 estados dos chips serem 8 chances de a
 * tela mostrar um número que o servidor não confirma.
 */

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { use } from 'react'
import {
  AlertTriangle, ArrowRight, ArrowRightLeft, Building2, CalendarClock, Check, ChevronDown,
  CreditCard, Landmark, Loader2, Plus, Receipt, Sparkles, Wallet, X,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { NavegadorDeMes } from '@/components/contas-pagar/NavegadorDeMes'
import { formatBRL } from '@/lib/format/money'
import { mesCorrente, mesVizinho, rotuloDoMes } from '@/lib/periodo/mes-corrente'
import { fetchComTimeout } from '@/lib/http/fetch-com-timeout'
import { filtrarPorBusca } from '@/lib/busca-texto'
import type {
  CustosFixosNaTela, LinhaDoCustoFixo, CategoriaDisponivel, PrateleiraNaTela,
} from '@/lib/custos-fixos/leitura'
import type { PreviaDaSemente } from '@/lib/custos-fixos/semear'
import type { TomDoSelo } from '@/lib/custos-fixos/situacao'
import { iconeDaCategoria } from '@/lib/custos-fixos/icones'
/**
 * ⛔⛔ **A ARITMÉTICA VEM DE `prateleira.ts`, que é PURO.** Importar `margem.ts` (onde a fórmula
 * do equilíbrio morava até 07/10) arrastaria o `prisma` pro bundle do navegador — foi por isso
 * que a conta mudou de arquivo em vez de ser copiada pra cá.
 */
import {
  cartoesDoTopo, PRATELEIRAS, type Chips, type Prateleira,
} from '@/lib/custos-fixos/prateleira'
import type { CompromissosDoMes, LinhaDeParcela, LinhaDeFatura } from '@/lib/custos-fixos/compromissos'

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

/** ⚠️ o POST devolve a tela recalculada; na semeadura ele devolve a PRÉVIA junto */
type Resposta = CustosFixosNaTela & { previa?: PreviaDaSemente | null; aplicados?: number }

export default function CustosFixosPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [mes, setMes] = useState(mesCorrente())
  const [dados, setDados] = useState<CustosFixosNaTela | null>(null)
  /** ⭐ o mês cujo realizado semeia o plano — `null` = o anterior ao visto (o default honesto) */
  const [ref, setRef] = useState<string | null>(null)
  const [previa, setPrevia] = useState<PreviaDaSemente | null>(null)
  const [incluirComPlano, setIncluirComPlano] = useState(false)
  /**
   * ⛔ ESTADO EXPLÍCITO (a lição da lixeira, 20/09): enquanto "ausência de dado" servir de
   * estado, o caso não previsto vira spinner eterno. Aqui `FALHOU` tem nome e tem botão.
   */
  const [estado, setEstado] = useState<Estado>('CARREGANDO')
  const [erro, setErro] = useState<string | null>(null)
  const [abrindoSeletor, setAbrindoSeletor] = useState(false)
  const [salvando, setSalvando] = useState<string | null>(null)
  /**
   * ⭐⭐ OS CHIPS SÃO ESTADO LOCAL, semeados pelo payload e persistidos em SEGUNDO PLANO.
   *
   * ⚠️ Esperar a resposta do servidor pra pintar daria lag de rede num gesto VISUAL — o dono
   * liga e desliga pra comparar cenário, não pra gravar. O servidor guarda pra o próximo
   * acesso (celular × notebook); o número na tela sai da função pura, na hora.
   */
  const [chips, setChips] = useState<Chips | null>(null)

  const carregar = useCallback(async () => {
    setEstado((e) => (e === 'OK' ? 'OK' : 'CARREGANDO'))
    const qs = new URLSearchParams({ mes })
    if (ref) qs.set('ref', ref)
    const r = await fetchComTimeout<CustosFixosNaTela>(`/api/empresas/${id}/custos-fixos?${qs}`)
    if (!r.ok || !r.data) { setErro(r.erro ?? 'Não consegui carregar.'); setEstado('FALHOU'); return }
    setDados(r.data); setErro(null); setEstado('OK')
    // ⚠️ só semeia na PRIMEIRA carga: recarregar o mês não pode desfazer o toggle que o dono
    // acabou de dar (ele navega entre meses com a mesma visão ligada).
    setChips((c) => c ?? r.data!.chips)
  }, [id, mes, ref])

  useEffect(() => { void carregar() }, [carregar])

  /** ⭐ todo gesto devolve a TELA recalculada — o estado novo é o que o servidor aceitou */
  const gesto = useCallback(async (corpo: Record<string, unknown>, chave: string) => {
    setSalvando(chave)
    const r = await fetchComTimeout<Resposta>(`/api/empresas/${id}/custos-fixos`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...corpo, mes }), timeoutMs: 60_000,
    })
    setSalvando(null)
    if (!r.ok || !r.data) { setErro(r.erro ?? 'Não consegui salvar.'); return }
    setDados(r.data); setErro(null)
    /**
     * ⭐ A PRÉVIA vem do SERVIDOR, e é ela que a tela desenha. ⛔ Depois de CONFIRMAR ela é
     * fechada: deixar o painel aberto mostrando "vai preencher 7" depois de já ter preenchido
     * faria o dono confirmar de novo (a família do clique que gravou em silêncio, 14/09).
     */
    setPrevia(r.data.previa && !corpo.confirmar ? r.data.previa : null)
  }, [id, mes])

  /**
   * ⭐⭐ O TOGGLE: pinta na hora (estado local) e PERSISTE em segundo plano.
   *
   * ⚠️ A persistência é fail-soft de propósito — se o POST falhar, o dono continua vendo o
   * cenário que ele escolheu; o que se perde é a lembrança no próximo acesso, não o gesto.
   */
  const alternarChip = useCallback((k: keyof Chips) => {
    setChips((c) => {
      const base = c ?? dados?.chips ?? { casa: true, banco: true, compromissos: true }
      const novo = { ...base, [k]: !base[k] }
      void fetchComTimeout(`/api/empresas/${id}/custos-fixos`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acao: 'CHIPS', mes, ...novo }),
      })
      return novo
    })
  }, [dados, id, mes])

  /**
   * ⭐⭐⭐ OS 4 CARTÕES — pela MESMA função pura que o servidor usou.
   *
   * ⛔ Nenhuma aritmética de dinheiro aqui: `cartoesDoTopo` é a régua única, e é ela que
   * garante que ligar/desligar não produza um número que o servidor não assine.
   */
  const cartoes = useMemo(() => {
    if (!dados) return null
    const c = chips ?? dados.chips
    return cartoesDoTopo(c, dados.subtotais, dados.cartaoPorDia.dias, dados.margem)
  }, [dados, chips])

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

      {/* ─────────── ⭐ OS INTERRUPTORES ─────────── */}
      <ChipsDasPrateleiras
        chips={chips ?? dados.chips}
        temBanco={dados.banco.linhas.length > 0}
        temCompromissos={dados.compromissos.parcelas.length + dados.compromissos.faturas.length > 0}
        aoAlternar={alternarChip}
      />

      {/* ─────────── OS 4 NÚMEROS DE DONO ─────────── */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <CartaoDeDono
          familia="indigo"
          titulo={cartoes!.conta.rotulo}
          sub={`${rotuloDoMes(mes)} — o plano que você declarou`}
          valor={cartoes!.conta.total}
          sufixo="/mês"
          aApurar={cartoes!.conta.porque ?? 'a apurar'}
          detalhe={dados.semPlano.n > 0
            ? `${dados.semPlano.n} ${dados.semPlano.n === 1 ? 'categoria' : 'categorias'} ainda sem plano — o realizado delas é ${formatBRL(dados.semPlano.realizado)}`
            : null}
        />
        <CartaoDeDono
          familia="azul"
          titulo="Por dia aberto"
          sub="quanto isso come por dia, parado"
          valor={cartoes!.porDia.valor}
          aApurar="depende do plano acima"
          detalhe={cartoes!.porDia.rotulo}
        />
        <CartaoDeDono
          familia="verde"
          titulo="Ponto de equilíbrio"
          sub="vendendo isso por dia, isso se paga"
          valor={cartoes!.equilibrio.porDia}
          aApurar={cartoes!.equilibrio.porque ?? 'a apurar'}
          detalhe={cartoes!.equilibrio.conta
            ? `${cartoes!.equilibrio.conta} · ${dados.margem.ressalva}`
            : dados.margem.ressalva}
        />
        {/*
          ⭐⭐ O 4º CARTÃO — e ele NÃO obedece aos chips, de propósito (ordem do dono).
          ⛔ Os três de cima servem pra ENSAIAR cenário; este responde "quanto preciso vender
          HOJE pra não afundar", e a resposta não muda porque o dono desligou um interruptor.
          Um 4º cartão que obedecesse seria o cartão do equilíbrio com outro nome.
        */}
        <CartaoDeDono
          familia="coral"
          escuro
          titulo="Pra não afundar"
          sub="cobre casa, banco e dívida; acima disso começa a sobrar de verdade"
          valor={cartoes!.afundar.porDia}
          aApurar={cartoes!.afundar.porque ?? 'a apurar'}
          detalhe={cartoes!.afundar.conta}
        />
      </div>

      {/* ⚠️ O QUE FICOU FORA DA CONTA — dito com o valor, nunca só "filtrado" */}
      {cartoes!.conta.foraDaConta && (
        <p className="px-1 text-[11.5px]" style={{ color: 'var(--prod-muted)' }}>
          {cartoes!.conta.foraDaConta}
        </p>
      )}

      {/* ─────────── AS FERRAMENTAS (marcar · semear) ─────────── */}
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
            {dados.linhas.some((l) => l.planejado == null || incluirComPlano) && (
              <button type="button"
                onClick={() => void gesto({ acao: 'SEMEAR', mesReferencia: dados.mesReferencia, incluirComPlano, confirmar: false }, 'semear')}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11.5px] font-semibold"
                style={{ background: 'var(--prod-surface-1)', color: 'var(--prod-accent)', boxShadow: 'inset 0 0 0 1px var(--prod-line-strong)' }}>
                {salvando === 'semear'
                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  : <Sparkles className="h-3.5 w-3.5" />}
                preencher todos com o realizado de {rotuloDoMes(dados.mesReferencia)}
              </button>
            )}
            <button type="button" onClick={() => setAbrindoSeletor((v) => !v)}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11.5px] font-semibold"
              style={{ background: 'var(--prod-acao-bg)', color: 'var(--prod-acao-ink)' }}>
              <Plus className="h-3.5 w-3.5" /> marcar categoria como fixa
            </button>
          </div>

          {/* ⭐ a REFERÊNCIA é escolha do dono — e o botão da linha usa a MESMA */}
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 px-4 pb-2 text-[11px]"
            style={{ color: 'var(--prod-muted)' }}>
            <span>semear o plano com o realizado de</span>
            {[mesVizinho(mes, -1), mesVizinho(mesVizinho(mes, -1), -1), mes].map((m) => (
              <button key={m} type="button" onClick={() => setRef(m)}
                className="rounded px-1.5 py-0.5 font-medium"
                style={m === dados.mesReferencia
                  ? { background: 'var(--prod-acao-bg)', color: 'var(--prod-acao-ink)' }
                  : { background: 'var(--prod-surface-1)', color: 'var(--prod-secondary)' }}>
                {rotuloDoMes(m)}
              </button>
            ))}
            {dados.referenciaEhParcial && (
              <span style={{ color: 'var(--fam-ambar-ink)' }}>
                ⚠️ {rotuloDoMes(dados.mesReferencia)} ainda está correndo — o realizado dele é parcial
              </span>
            )}
          </div>

          {previa && (
            <PainelDaSemente
              previa={previa}
              salvando={salvando === 'semear'}
              incluirComPlano={incluirComPlano}
              aoMudarIncluir={(v) => {
                setIncluirComPlano(v)
                void gesto({ acao: 'SEMEAR', mesReferencia: previa.mesReferencia, incluirComPlano: v, confirmar: false }, 'semear')
              }}
              aoConfirmar={() => void gesto({ acao: 'SEMEAR', mesReferencia: previa.mesReferencia, incluirComPlano, confirmar: true }, 'semear')}
              aoFechar={() => setPrevia(null)}
            />
          )}

          {abrindoSeletor && (
            <SeletorDeCategoria
              disponiveis={dados.disponiveis}
              salvando={salvando}
              aoMarcar={(c, prateleira) => void gesto(
                { acao: 'MARCAR', categoryId: c.id, prateleira },
                `marcar:${c.id}`,
              )}
              aoTirar={(c) => void gesto({ acao: 'TIRAR', categoryId: c.id }, `tirar:${c.id}`)}
              aoFechar={() => setAbrindoSeletor(false)}
            />
          )}

          {dados.linhas.length === 0 && (
            <p className="px-4 pb-4 text-[13px]" style={{ color: 'var(--prod-secondary)' }}>
              Nenhuma categoria marcada como custo fixo ainda. Marque as que a casa paga todo mês
              (aluguel, salários, energia, água, internet, contador, sistema) — o realizado aparece
              sozinho, vindo das contas que você já categoriza.
            </p>
          )}
        </CardContent>
      </Card>

      {/* ─────────── 🏠 A CASA ─────────── */}
      <SecaoDaPrateleira
        icone={<Building2 className="h-4 w-4 shrink-0" style={{ color: 'var(--fam-indigo-ink)' }} />}
        titulo="🏠 A casa"
        sub="os custos fixos operacionais"
        prateleira={dados.casa}
        ligada={(chips ?? dados.chips).casa}
        mesReferencia={dados.mesReferencia}
        salvando={salvando}
        aoPlanejar={(l, valor) => void gesto({ acao: 'PLANEJAR', categoryId: l.categoryId, valor }, `plano:${l.categoryId}`)}
        aoTirar={(l) => void gesto({ acao: 'TIRAR', categoryId: l.categoryId }, `tirar:${l.categoryId}`)}
        aoMover={(l, p) => void gesto({ acao: 'MARCAR', categoryId: l.categoryId, prateleira: p }, `marcar:${l.categoryId}`)}
        vazio="nenhuma categoria operacional marcada ainda."
      />

      {/* ─────────── 🏦 O BANCO ─────────── */}
      <SecaoDaPrateleira
        icone={<Landmark className="h-4 w-4 shrink-0" style={{ color: 'var(--fam-ambar-ink)' }} />}
        titulo="🏦 O banco"
        sub="os juros e tarifas recorrentes — não é a casa, é o custo do dinheiro"
        prateleira={dados.banco}
        ligada={(chips ?? dados.chips).banco}
        mesReferencia={dados.mesReferencia}
        salvando={salvando}
        aoPlanejar={(l, valor) => void gesto({ acao: 'PLANEJAR', categoryId: l.categoryId, valor }, `plano:${l.categoryId}`)}
        aoTirar={(l) => void gesto({ acao: 'TIRAR', categoryId: l.categoryId }, `tirar:${l.categoryId}`)}
        aoMover={(l, p) => void gesto({ acao: 'MARCAR', categoryId: l.categoryId, prateleira: p }, `marcar:${l.categoryId}`)}
        vazio="nenhuma categoria no banco ainda — marque os juros e as tarifas aqui pra separar o custo do dinheiro do custo da casa."
      />

      {/* ─────────── 📅 COMPROMISSOS DO MÊS ─────────── */}
      <SecaoDeCompromissos
        compromissos={dados.compromissos}
        ligada={(chips ?? dados.chips).compromissos}
        mes={mes}
      />

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

/**
 * ⭐ o cartão de dono v4: fundo da família, texto da família, sublinha serifada em itálico.
 *
 * ⚠️ `escuro` é o pedido do dono pro 4º cartão (*"coral-ESCURO"*): o chão passa a ser o degrau
 * `-mid` (preenchido) e a tinta vira `--prod-acao-ink`, que é a tinta sobre fundo forte e
 * **inverte nos dois temas**. Um hex cravado aqui ficaria ilegível no tema escuro.
 */
function CartaoDeDono({ familia, escuro, titulo, sub, valor, sufixo, aApurar, detalhe }: {
  familia: 'indigo' | 'azul' | 'verde' | 'coral'
  escuro?: boolean
  titulo: string
  sub: string
  valor: number | null
  sufixo?: string
  aApurar: string
  detalhe: string | null
}) {
  const chao = escuro ? `var(--fam-${familia}-mid)` : `var(--fam-${familia}-bg)`
  const tinta = escuro ? 'var(--prod-acao-ink)' : `var(--fam-${familia}-ink)`
  const apoio = escuro ? 'var(--prod-acao-ink)' : `var(--fam-${familia}-mid)`
  return (
    <div className="rounded-xl p-3.5" style={{ background: chao }}>
      <p className="text-[12px] font-semibold uppercase tracking-wide" style={{ color: tinta }}>
        {titulo}
      </p>
      <p className="font-serif text-[11.5px] italic" style={{ color: apoio, opacity: escuro ? 0.85 : 1 }}>{sub}</p>
      {valor == null ? (
        <>
          <p className="mt-1.5 text-[19px] font-semibold" style={{ color: tinta }}>a apurar</p>
          <p className="mt-0.5 text-[11px] leading-snug" style={{ color: apoio, opacity: escuro ? 0.85 : 1 }}>{aApurar}</p>
        </>
      ) : (
        <>
          <p className="mt-1.5 text-[22px] font-semibold tabular-nums" style={{ color: tinta }}>
            {formatBRL(valor)}
            {sufixo && <span className="text-[12px] font-normal"> {sufixo}</span>}
          </p>
          {detalhe && (
            <p className="mt-0.5 text-[11px] leading-snug" style={{ color: apoio, opacity: escuro ? 0.85 : 1 }}>{detalhe}</p>
          )}
        </>
      )}
    </div>
  )
}

/**
 * ⭐⭐ OS 3 INTERRUPTORES — `[🏠 casa ✓] [🏦 banco ✓] [📅 compromissos ✓]`.
 *
 * ⚠️ **Prateleira VAZIA aparece desligável do mesmo jeito, só marcada "vazia"** — esconder o
 * chip de uma prateleira sem linha faria o dono achar que o interruptor não existe, e no dia
 * em que ele marcasse o primeiro juro o chip apareceria do nada.
 */
function ChipsDasPrateleiras({ chips, temBanco, temCompromissos, aoAlternar }: {
  chips: Chips
  temBanco: boolean
  temCompromissos: boolean
  aoAlternar: (k: keyof Chips) => void
}) {
  const itens: { k: keyof Chips; rotulo: string; vazia: boolean }[] = [
    { k: 'casa', rotulo: '🏠 casa', vazia: false },
    { k: 'banco', rotulo: '🏦 banco', vazia: !temBanco },
    { k: 'compromissos', rotulo: '📅 compromissos', vazia: !temCompromissos },
  ]
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-[11px]" style={{ color: 'var(--prod-muted)' }}>na conta:</span>
      {itens.map((i) => {
        const on = chips[i.k]
        return (
          <button key={i.k} type="button" onClick={() => aoAlternar(i.k)}
            aria-pressed={on}
            title={on ? `tirar ${i.rotulo} da conta dos cartões` : `pôr ${i.rotulo} na conta dos cartões`}
            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[12px] font-medium"
            style={on
              ? { background: 'var(--prod-acao-bg)', color: 'var(--prod-acao-ink)' }
              : { background: 'var(--prod-surface-1)', color: 'var(--prod-secondary)', boxShadow: 'inset 0 0 0 1px var(--prod-line-strong)' }}>
            {i.rotulo}
            {on ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
            {i.vazia && <span className="text-[10px]" style={{ opacity: 0.75 }}>(vazia)</span>}
          </button>
        )
      })}
    </div>
  )
}

/**
 * ⭐⭐ UMA PRATELEIRA DE CATEGORIA — e é **UM componente pros DOIS** (casa e banco).
 *
 * ⛔⛔ Duas listas copiadas divergiriam no primeiro rótulo novo, e o dono veria a mesma
 * pergunta desenhada de dois jeitos na MESMA página — a doença que o sprint de 23/09 ("uma
 * lista só") matou na Conciliação. O que muda entre as duas é o TÍTULO e a cor do ícone.
 *
 * ⚠️ **O SUBTOTAL É A Σ DAS LINHAS QUE ESTA SEÇÃO DESENHA** (vem do servidor, reduzido da
 * mesma lista) — é o guard que o dono pediu: *"Σ(linhas de cada prateleira) == subtotal dela"*.
 *
 * ⚠️ **Prateleira DESLIGADA não desaparece: ela fica apagada, dizendo que está fora da conta.**
 * Sumir faria o dono procurar as linhas que ele acabou de tirar do cálculo.
 */
function SecaoDaPrateleira({
  icone, titulo, sub, prateleira, ligada, mesReferencia, salvando, aoPlanejar, aoTirar, aoMover, vazio,
}: {
  icone: ReactNode
  titulo: string
  sub: string
  prateleira: PrateleiraNaTela
  ligada: boolean
  mesReferencia: string
  salvando: string | null
  aoPlanejar: (l: LinhaDoCustoFixo, valor: number | null) => void
  aoTirar: (l: LinhaDoCustoFixo) => void
  aoMover: (l: LinhaDoCustoFixo, p: Prateleira) => void
  vazio: string
}) {
  const [todas, setTodas] = useState(false)
  const visiveis = todas ? prateleira.linhas : prateleira.linhas.slice(0, LINHAS_VISIVEIS)
  const outra: Prateleira = prateleira.prateleira === 'CASA' ? 'BANCO' : 'CASA'

  return (
    <Card style={{ background: 'var(--prod-surface)', borderColor: 'var(--prod-line)', opacity: ligada ? 1 : 0.6 }}>
      <CardContent className="p-0">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 px-4 py-3">
          {icone}
          <h2 className="text-sm font-semibold" style={{ color: 'var(--prod-primary)' }}>{titulo}</h2>
          <p className="font-serif text-[11.5px] italic" style={{ color: 'var(--prod-muted)' }}>{sub}</p>
          {!ligada && (
            <span className="rounded px-1.5 py-0.5 text-[10.5px] font-semibold"
              style={{ background: 'var(--fam-cinza-bg)', color: 'var(--fam-cinza-ink)' }}>
              fora da conta dos cartões
            </span>
          )}
        </div>

        {prateleira.linhas.length === 0 ? (
          <p className="px-4 pb-4 text-[13px]" style={{ color: 'var(--prod-secondary)' }}>{vazio}</p>
        ) : (
          <>
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
                  mesReferencia={mesReferencia}
                  outraPrateleira={outra}
                  aoPlanejar={(valor) => aoPlanejar(l, valor)}
                  aoTirar={() => aoTirar(l)}
                  aoMover={() => aoMover(l, outra)}
                />
              ))}
            </ul>

            {prateleira.linhas.length > LINHAS_VISIVEIS && (
              <button type="button" onClick={() => setTodas((v) => !v)}
                className="flex w-full items-center justify-center gap-1.5 border-t py-2 text-[12px] font-medium"
                style={{ borderColor: 'var(--prod-line)', color: 'var(--prod-accent)' }}>
                <ChevronDown className={`h-3.5 w-3.5 transition-transform ${todas ? 'rotate-180' : ''}`} />
                {todas ? 'ver só as primeiras' : `+${prateleira.linhas.length - LINHAS_VISIVEIS} categorias · ver todas`}
              </button>
            )}

            <div className="border-t px-4 py-3" style={{ borderColor: 'var(--prod-line-strong)' }}>
              <div className="flex flex-wrap items-baseline justify-end gap-x-6 gap-y-1 text-[13px]">
                <span style={{ color: 'var(--prod-muted)' }}>
                  Σ planejado{' '}
                  <b className="tabular-nums" style={{ color: 'var(--prod-primary)' }}>
                    {prateleira.planejado == null ? 'a apurar' : formatBRL(prateleira.planejado)}
                  </b>
                </span>
                <span style={{ color: 'var(--prod-muted)' }}>
                  Σ realizado{' '}
                  <b className="tabular-nums" style={{ color: 'var(--prod-primary)' }}>{formatBRL(prateleira.realizado)}</b>
                </span>
                <span style={{ color: 'var(--prod-muted)' }}>
                  % pago{' '}
                  <b className="tabular-nums" style={{ color: 'var(--prod-primary)' }}>
                    {/* ⚠️ sem plano NÃO é 0% — é desconhecido */}
                    {prateleira.pctPago == null ? 'a apurar' : `${Math.round(prateleira.pctPago * 100)}%`}
                  </b>
                </span>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}

/**
 * ⭐⭐⭐ 📅 COMPROMISSOS DO MÊS — "não são custo, são caixa que certamente sai".
 *
 * ⛔ **ZERO CONTA AQUI.** Valor, selo, "faltam N parcelas" e as somas vêm do servidor
 * (`lerCompromissos`), que por sua vez delega pro `estadoDaParcela`, `forecastProxima`,
 * `faturaNetTotal` e `estadoDaFatura`. A tela desenha.
 *
 * ⚠️ **Linha FORA da Σ aparece marcada, com o porquê** — a parcela do mútuo flexível e a
 * fatura não importada. Exclusão escondida é tão ruim quanto exclusão nenhuma.
 */
function SecaoDeCompromissos({ compromissos, ligada, mes }: {
  compromissos: CompromissosDoMes
  ligada: boolean
  mes: string
}) {
  const c = compromissos
  const vazio = c.parcelas.length === 0 && c.faturas.length === 0
  return (
    <Card style={{ background: 'var(--prod-surface)', borderColor: 'var(--prod-line)', opacity: ligada ? 1 : 0.6 }}>
      <CardContent className="p-0">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 px-4 py-3">
          <CalendarClock className="h-4 w-4 shrink-0" style={{ color: 'var(--fam-teal-ink)' }} />
          <h2 className="text-sm font-semibold" style={{ color: 'var(--prod-primary)' }}>📅 Compromissos do mês</h2>
          <p className="font-serif text-[11.5px] italic" style={{ color: 'var(--prod-muted)' }}>
            não são custo — é caixa que certamente sai
          </p>
          {!ligada && (
            <span className="rounded px-1.5 py-0.5 text-[10.5px] font-semibold"
              style={{ background: 'var(--fam-cinza-bg)', color: 'var(--fam-cinza-ink)' }}>
              fora da conta dos cartões
            </span>
          )}
        </div>

        {/* ⭐ a 1 linha que o dono pediu — e ela só aparece quando a CONDIÇÃO é verdadeira */}
        {c.jurosJaNoBanco && (
          <p className="mx-4 mb-2 rounded-lg px-2 py-1.5 text-[11.5px] leading-snug"
            style={{ background: 'var(--fam-ambar-bg)', color: 'var(--fam-ambar-ink)' }}>
            ⚠️ {c.jurosJaNoBanco}
          </p>
        )}

        {vazio ? (
          <p className="px-4 pb-4 text-[13px]" style={{ color: 'var(--prod-secondary)' }}>
            Nada vence neste mês — nenhuma parcela de empréstimo e nenhum cartão com fatura.
          </p>
        ) : (
          <>
            {c.parcelas.length > 0 && (
              <div className="border-t" style={{ borderColor: 'var(--prod-line)' }}>
                <p className="px-4 pt-2 text-[10.5px] uppercase tracking-wide" style={{ color: 'var(--prod-muted)' }}>
                  parcelas de empréstimo ({c.parcelas.length})
                </p>
                <ul>{c.parcelas.map((p, i) => <LinhaDeParcelaNaTela key={`${p.loanId}-${p.numero}`} p={p} zebra={i % 2 === 1} />)}</ul>
                <div className="px-4 pb-2 pt-1 text-right text-[12.5px]" style={{ color: 'var(--prod-muted)' }}>
                  Σ parcelas{' '}
                  <b className="tabular-nums" style={{ color: 'var(--prod-primary)' }}>{formatBRL(c.somaParcelas)}</b>
                </div>
              </div>
            )}

            {c.faturas.length > 0 && (
              <div className="border-t" style={{ borderColor: 'var(--prod-line)' }}>
                <p className="px-4 pt-2 text-[10.5px] uppercase tracking-wide" style={{ color: 'var(--prod-muted)' }}>
                  faturas de cartão ({c.faturas.length})
                </p>
                <ul>{c.faturas.map((f, i) => <LinhaDeFaturaNaTela key={f.cardId} f={f} zebra={i % 2 === 1} mes={mes} />)}</ul>
                <div className="px-4 pb-2 pt-1 text-right text-[12.5px]" style={{ color: 'var(--prod-muted)' }}>
                  Σ faturas{' '}
                  <b className="tabular-nums" style={{ color: 'var(--prod-primary)' }}>{formatBRL(c.somaFaturas)}</b>
                </div>
              </div>
            )}

            <div className="border-t px-4 py-3" style={{ borderColor: 'var(--prod-line-strong)' }}>
              <div className="flex flex-wrap items-baseline justify-between gap-2 text-[13px]">
                {/* ⚠️ o que ficou FORA da Σ, contado e explicado */}
                {c.foraDaSoma.n > 0 ? (
                  <details className="min-w-0 flex-1">
                    <summary className="cursor-pointer text-[11.5px]" style={{ color: 'var(--prod-muted)' }}>
                      {c.foraDaSoma.n} {c.foraDaSoma.n === 1 ? 'linha fica' : 'linhas ficam'} fora da soma — ver o porquê
                    </summary>
                    <ul className="mt-1 space-y-0.5">
                      {c.foraDaSoma.porque.map((t, i) => (
                        <li key={i} className="text-[11.5px]" style={{ color: 'var(--prod-muted)' }}>{t}</li>
                      ))}
                    </ul>
                  </details>
                ) : <span />}
                <span style={{ color: 'var(--prod-muted)' }}>
                  Σ compromissos{' '}
                  <b className="tabular-nums" style={{ color: 'var(--prod-primary)' }}>{formatBRL(c.total)}</b>
                </span>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}

/** ⭐ a linha da parcela — e clicar abre O CONTRATO (a fonte) */
function LinhaDeParcelaNaTela({ p, zebra }: { p: LinhaDeParcela; zebra: boolean }) {
  const tom = p.estado === 'PAGA' ? TOM.verde
    : p.estado === 'ATRASADA' ? TOM.coral
    : p.estado === 'PARCIAL' ? TOM.ambar
    : p.estado === 'VENCE_HOJE' ? TOM.ambar
    : TOM.azul
  return (
    <li className="grid grid-cols-1 gap-x-3 gap-y-1 border-t px-4 py-2.5 lg:grid-cols-[1fr_160px_170px] lg:items-center"
      style={{ borderColor: 'var(--prod-line)', background: zebra ? 'var(--prod-surface-1)' : undefined }}>
      <div className="min-w-0">
        <a href={p.href} className="flex items-center gap-1 text-[13.5px] font-medium hover:underline"
          style={{ color: 'var(--prod-primary)' }}>
          <span className="truncate">{p.contrato}</span>
          <ArrowRight className="h-3 w-3 shrink-0" style={{ color: 'var(--prod-accent)' }} />
        </a>
        <p className="text-[11px]" style={{ color: 'var(--prod-muted)' }}>
          parcela {p.numero} · vence dia {p.diaDoVencimento} · {p.faltam}
          {!p.contaNaSoma && ' · fora da soma'}
        </p>
      </div>
      <div className="flex items-baseline justify-between lg:block lg:text-right">
        <span className="text-[11px] lg:hidden" style={{ color: 'var(--prod-muted)' }}>parcela</span>
        <div>
          <span className="text-[14px] font-semibold tabular-nums" style={{ color: 'var(--prod-primary)' }}>
            {/* ⚠️ "a apurar" NUNCA vira R$ 0,00 */}
            {p.valor == null ? 'a apurar' : `${p.valorEhPrevisto ? '~' : ''}${formatBRL(p.valor)}`}
          </span>
          {p.valorPorque && (
            <p className="text-[10.5px] leading-snug" style={{ color: 'var(--prod-muted)' }}>{p.valorPorque}</p>
          )}
        </div>
      </div>
      <div className="flex items-center justify-between lg:justify-end">
        <span className="text-[11px] lg:hidden" style={{ color: 'var(--prod-muted)' }}>situação</span>
        <span className="rounded-md px-1.5 py-0.5 text-[11.5px] font-semibold"
          style={{ background: tom.bg, color: tom.ink }}>{p.selo}</span>
      </div>
    </li>
  )
}

/** ⭐ a linha da fatura — e clicar abre O CARTÃO (a fonte) */
function LinhaDeFaturaNaTela({ f, zebra, mes }: { f: LinhaDeFatura; zebra: boolean; mes: string }) {
  const tom = f.naoImportada ? TOM.cinza
    : f.estado === 'PAGA' ? TOM.verde
    : f.estado === 'VENCIDA' ? TOM.coral
    : f.estado === 'PARCIAL' ? TOM.ambar
    : f.estado === 'FECHADA' ? TOM.ambar
    : TOM.azul
  return (
    <li className="grid grid-cols-1 gap-x-3 gap-y-1 border-t px-4 py-2.5 lg:grid-cols-[1fr_160px_170px] lg:items-center"
      style={{ borderColor: 'var(--prod-line)', background: zebra ? 'var(--prod-surface-1)' : undefined }}>
      <div className="flex min-w-0 items-center gap-2">
        <CreditCard className="h-4 w-4 shrink-0" style={{ color: 'var(--prod-muted)' }} />
        <div className="min-w-0 flex-1">
          <a href={f.href} className="flex items-center gap-1 text-[13.5px] font-medium hover:underline"
            style={{ color: 'var(--prod-primary)' }}>
            <span className="truncate">{f.nome}{f.ultimos4 ? ` ****${f.ultimos4}` : ''}</span>
            <ArrowRight className="h-3 w-3 shrink-0" style={{ color: 'var(--prod-accent)' }} />
          </a>
          <p className="text-[11px]" style={{ color: 'var(--prod-muted)' }}>
            fatura {mes} · {f.nCompras} compra{f.nCompras === 1 ? '' : 's'} · vence dia {f.diaDoVencimento}
            {f.estornos > 0 && ` · ${formatBRL(f.estornos)} de estorno`}
            {f.pago && ` · pago ${formatBRL(f.pago.valor)}`}
          </p>
        </div>
      </div>
      <div className="flex items-baseline justify-between lg:block lg:text-right">
        <span className="text-[11px] lg:hidden" style={{ color: 'var(--prod-muted)' }}>fatura</span>
        <span className="text-[14px] font-semibold tabular-nums" style={{ color: 'var(--prod-primary)' }}>
          {/* ⛔ fatura NÃO IMPORTADA é estado PRÓPRIO, nunca R$ 0,00 */}
          {f.net == null ? 'a apurar' : formatBRL(f.net)}
        </span>
      </div>
      <div className="flex items-center justify-between lg:justify-end">
        <span className="text-[11px] lg:hidden" style={{ color: 'var(--prod-muted)' }}>situação</span>
        <span className="rounded-md px-1.5 py-0.5 text-right text-[11px] font-semibold"
          style={{ background: tom.bg, color: tom.ink }}>{f.selo}</span>
      </div>
    </li>
  )
}

/** ⭐ UMA linha: ícone + nome · planejado editável · realizado · selo. Clica → as transações. */
function LinhaDaTela({ linha, zebra, salvando, mesReferencia, outraPrateleira, aoPlanejar, aoTirar, aoMover }: {
  linha: LinhaDoCustoFixo
  zebra: boolean
  salvando: boolean
  mesReferencia: string
  /** ⭐ pra onde o botão de mover leva — "pra casa" ou "pro banco" */
  outraPrateleira: Prateleira
  aoPlanejar: (valor: number | null) => void
  aoTirar: () => void
  aoMover: () => void
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
        {/*
          ⭐⭐ MOVER DE PRATELEIRA NA PRÓPRIA LINHA — é por aqui que as 3 categorias de juros
          migram pro banco. ⛔ E ele chama o MESMO `MARCAR` do seletor: marcar e mover são o
          mesmo gesto por desenho, então a trava e o rastro valem nos dois sem ninguém lembrar.
        */}
        <button type="button" onClick={aoMover}
          title={`mover ${linha.nome} pra prateleira ${outraPrateleira === 'BANCO' ? 'do banco' : 'da casa'}`}
          aria-label={`mover ${linha.nome} pra ${outraPrateleira === 'BANCO' ? 'o banco' : 'a casa'}`}
          className="shrink-0 rounded p-1" style={{ color: 'var(--prod-accent)' }}>
          <ArrowRightLeft className="h-3.5 w-3.5" />
        </button>
        <button type="button" onClick={aoTirar} aria-label={`tirar ${linha.nome} dos custos fixos`}
          className="shrink-0 rounded p-1" style={{ color: 'var(--prod-muted)' }}>
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <CampoDoPlano
        valor={linha.planejado}
        salvando={salvando}
        rastro={linha.planejadoRastro}
        semente={linha.realizadoReferencia}
        mesReferencia={mesReferencia}
        aoSalvar={aoPlanejar}
      />

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
function CampoDoPlano({ valor, salvando, rastro, semente, mesReferencia, aoSalvar }: {
  valor: number | null
  salvando: boolean
  rastro: { quem: string | null; quando: string } | null
  /** ⭐ o realizado do mês de referência — o número que o botão PREENCHE */
  semente: number
  mesReferencia: string
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

  const fmtCampo = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  return (
    <div className="flex items-center justify-between gap-2 lg:justify-end">
      <span className="text-[11px] lg:hidden" style={{ color: 'var(--prod-muted)' }}>planejado</span>
      <div className="flex items-center gap-1.5">
        {/*
          ⭐⭐ O BOTÃO **SÓ PREENCHE O CAMPO** — ordem do dono: *"eu confirmo/edito e salvo"*.
          ⛔⛔ Ele NUNCA chama `aoSalvar`, e isso é a mesma disciplina do mínimo sugerido do
          estoque (*"o campo é meu"*): gravar sozinho poria no plano um número que o dono não
          escolheu, e o plano é justamente a AFIRMAÇÃO dele. Salvar continua sendo o blur/Enter.
          ⚠️ Só aparece onde FALTA plano e onde há número pra semear — botão que preenche com
          R$ 0,00 ensinaria a ignorar o botão.
        */}
        {valor == null && semente > 0 && (
          <button type="button" onClick={() => setTxt(fmtCampo(semente))}
            title={`preenche com o que saiu nesta categoria em ${rotuloDoMes(mesReferencia)} — você confere e salva`}
            className="shrink-0 rounded-md px-1.5 py-0.5 text-[10.5px] font-medium"
            style={{ background: 'var(--fam-indigo-bg)', color: 'var(--fam-indigo-ink)' }}>
            usar o realizado de {rotuloDoMes(mesReferencia)}
          </button>
        )}
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

/**
 * ⭐⭐ O SELETOR — A VISÃO COMPLETA, com ✓ em quem já é fixa (06/10).
 *
 * **Ordem do dono:** *"o seletor ganha busca e mostra as já marcadas com ✓ (pra desmarcar
 * fácil também)."*
 *
 * ⛔ **E CONTINUA UMA PORTA SÓ:** marcar e desmarcar caem no MESMO `POST` (`MARCAR`/`TIRAR`),
 * que é o mesmo que o X da linha usa. O ✓ aqui é outra MAÇANETA pro mesmo gesto, nunca uma
 * segunda régua — e por isso as duas não têm como discordar.
 *
 * ⚠️⚠️ **A BUSCA É A `casaBusca` DA CASA, e isso não é preciosismo:** com `includes` cru,
 * digitar *"agua"* **não acharia "Água e Esgoto"** — é literalmente o bug de 08/09 (`contains`
 * case-sensitive no Postgres e o acento por cima). Palavra em qualquer ordem, sem caixa e sem
 * acento, sobre a MESMA lista que a tela desenha.
 */
function SeletorDeCategoria({ disponiveis, salvando, aoMarcar, aoTirar, aoFechar }: {
  disponiveis: CategoriaDisponivel[]
  salvando: string | null
  aoMarcar: (c: CategoriaDisponivel, prateleira: Prateleira) => void
  aoTirar: (c: CategoriaDisponivel) => void
  aoFechar: () => void
}) {
  const [busca, setBusca] = useState('')
  /**
   * ⭐ EM QUAL PRATELEIRA A PRÓXIMA MARCAÇÃO CAI — ordem do dono (*"o seletor ganha a escolha
   * da prateleira, casa|banco"*).
   *
   * ⚠️ Nasce em CASA porque é o caso comum; a escolha é explícita e fica à vista, então marcar
   * no banco nunca acontece por acidente.
   */
  const [alvo, setAlvo] = useState<Prateleira>('CASA')
  const filtradas = useMemo(
    // ⭐ busca pelo nome E pelo qualificador: com dois "Frete", o grupo é o que distingue
    () => filtrarPorBusca(disponiveis, busca, (c) => `${c.nome} ${c.qualificador ?? ''}`),
    [busca, disponiveis],
  )
  const fixas = filtradas.filter((c) => c.jaFixa)
  const livres = filtradas.filter((c) => !c.jaFixa)

  const chip = (c: CategoriaDisponivel) => {
    const ocupado = salvando === `marcar:${c.id}` || salvando === `tirar:${c.id}`
    /**
     * ⭐ O ✓ DIZ **ONDE** A CATEGORIA ESTÁ, não só que ela é fixa. Sem o ícone da prateleira o
     * ✓ esconderia em qual das duas ela caiu — e aí o dono não teria como conferir a migração
     * dos juros.
     */
    const onde = c.prateleira === 'BANCO' ? '🏦' : '🏠'
    const outra: Prateleira = c.prateleira === 'BANCO' ? 'CASA' : 'BANCO'
    if (c.jaFixa) {
      return (
        <span key={c.id} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[12px]"
          style={{ background: 'var(--fam-verde-bg)', color: 'var(--fam-verde-ink)', boxShadow: 'inset 0 0 0 1px var(--fam-verde-mid)' }}>
          {ocupado ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
          <span>{onde} {c.nome}</span>
          {c.qualificador && <span style={{ color: 'var(--prod-muted)' }}>· {c.qualificador}</span>}
          {/* ⭐ mover de prateleira — o MESMO `MARCAR`, nunca uma 2ª porta de gravação */}
          <button type="button" onClick={() => aoMarcar(c, outra)}
            title={`mover ${c.nome} pra prateleira ${outra === 'BANCO' ? 'do banco' : 'da casa'}`}
            aria-label={`mover ${c.nome} pra ${outra === 'BANCO' ? 'o banco' : 'a casa'}`}
            className="rounded p-0.5" style={{ color: 'var(--prod-accent)' }}>
            <ArrowRightLeft className="h-3 w-3" />
          </button>
          <button type="button" onClick={() => aoTirar(c)}
            title={`tirar ${c.nome} dos custos fixos`} aria-label={`tirar ${c.nome} dos custos fixos`}
            className="rounded p-0.5" style={{ color: 'var(--fam-verde-ink)' }}>
            <X className="h-3 w-3" />
          </button>
        </span>
      )
    }
    return (
      <button key={c.id} type="button" onClick={() => aoMarcar(c, alvo)}
        aria-pressed={false}
        title={`marcar ${c.nome} como custo fixo ${alvo === 'BANCO' ? 'do banco' : 'da casa'}`}
        className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[12px]"
        style={{ background: 'var(--prod-surface)', color: 'var(--prod-primary)', boxShadow: 'inset 0 0 0 1px var(--prod-line-strong)' }}>
        {ocupado
          ? <Loader2 className="h-3 w-3 animate-spin" />
          : <Plus className="h-3 w-3" style={{ color: 'var(--prod-accent)' }} />}
        {c.nome}
        {c.qualificador && <span style={{ color: 'var(--prod-muted)' }}>· {c.qualificador}</span>}
      </button>
    )
  }

  return (
    <div className="border-t px-4 py-3" style={{ borderColor: 'var(--prod-line)', background: 'var(--prod-surface-1)' }}>
      {/* ⭐ a escolha da prateleira — e ela fica À VISTA antes do clique, nunca depois */}
      <div className="mb-2 flex flex-wrap items-center gap-2 text-[11px]" style={{ color: 'var(--prod-muted)' }}>
        <span>marcar na prateleira:</span>
        {PRATELEIRAS.map((p) => (
          <button key={p} type="button" onClick={() => setAlvo(p)} aria-pressed={alvo === p}
            className="rounded px-2 py-0.5 font-medium"
            style={alvo === p
              ? { background: 'var(--prod-acao-bg)', color: 'var(--prod-acao-ink)' }
              : { background: 'var(--prod-surface)', color: 'var(--prod-secondary)', boxShadow: 'inset 0 0 0 1px var(--prod-line-strong)' }}>
            {p === 'CASA' ? '🏠 casa' : '🏦 banco'}
          </button>
        ))}
        <span style={{ opacity: 0.8 }}>
          {alvo === 'BANCO'
            ? '— juro e tarifa: o custo do dinheiro, não da casa'
            : '— o que a casa paga pra funcionar'}
        </span>
      </div>

      <div className="mb-2 flex items-center gap-2">
        <label className="flex-1 text-[11px]" style={{ color: 'var(--prod-muted)' }}>
          Qual categoria a casa paga todo mês? (clique no ✓ pra tirar da lista)
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="aluguel"
            className="mt-1 block w-full rounded-lg px-2 py-1.5 text-[13px]"
            style={{ border: '1px solid var(--prod-line-strong)', background: 'var(--prod-surface)', color: 'var(--prod-primary)' }} />
        </label>
        <button type="button" onClick={aoFechar} className="mt-4 rounded p-1" aria-label="fechar"
          style={{ color: 'var(--prod-muted)' }}><X className="h-4 w-4" /></button>
      </div>

      {filtradas.length === 0 ? (
        <p className="text-[12px]" style={{ color: 'var(--prod-secondary)' }}>
          {/* ⚠️ o vazio DIZ o recorte — "nenhuma encontrada" faria o dono achar que a categoria não existe */}
          Nada com «{busca}» entre as {disponiveis.length} categorias de despesa da empresa.
        </p>
      ) : (
        <div className="max-h-64 space-y-2 overflow-y-auto">
          {fixas.length > 0 && (
            <div>
              <p className="mb-1 text-[10.5px] uppercase tracking-wide" style={{ color: 'var(--prod-muted)' }}>
                já são fixas ({fixas.length})
              </p>
              <div className="flex flex-wrap gap-1.5">{fixas.map(chip)}</div>
            </div>
          )}
          <div>
            <p className="mb-1 text-[10.5px] uppercase tracking-wide" style={{ color: 'var(--prod-muted)' }}>
              marcar como fixa ({livres.length})
            </p>
            {livres.length === 0
              ? <p className="text-[12px]" style={{ color: 'var(--prod-secondary)' }}>todas as que casam com a busca já estão na lista.</p>
              : <div className="flex flex-wrap gap-1.5">{livres.map(chip)}</div>}
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * ⭐⭐ A PRÉVIA DA SEMEADURA — o que acontece se eu confirmar, numa tela.
 *
 * ⛔⛔ **ELA VEM DO SERVIDOR, e é a MESMA lista que a gravação executa.** A tela não decide
 * quem entra: se decidisse, mostraria uma lista e o servidor gravaria outra — a cicatriz do
 * preview × confirm do import de OFX (17/08), que custou o módulo inteiro.
 *
 * ⚠️ E o que fica DE FORA aparece com o PORQUÊ. Exclusão silenciosa num gesto em lote é como
 * o dono descobre semanas depois que metade não entrou.
 */
function PainelDaSemente({ previa, salvando, incluirComPlano, aoMudarIncluir, aoConfirmar, aoFechar }: {
  previa: PreviaDaSemente
  salvando: boolean
  incluirComPlano: boolean
  aoMudarIncluir: (v: boolean) => void
  aoConfirmar: () => void
  aoFechar: () => void
}) {
  const fora = previa.linhas.filter((l) => !l.vai)
  return (
    <div className="border-t px-4 py-3" style={{ borderColor: 'var(--prod-line)', background: 'var(--prod-surface-1)' }}>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <Sparkles className="h-4 w-4 shrink-0" style={{ color: 'var(--prod-accent)' }} />
        <p className="min-w-0 flex-1 text-[13px] font-semibold" style={{ color: 'var(--prod-primary)' }}>
          Preencher o plano de {rotuloDoMes(previa.mesDestino)} com o realizado de {rotuloDoMes(previa.mesReferencia)}
        </p>
        <button type="button" onClick={aoFechar} className="rounded p-1" aria-label="fechar"
          style={{ color: 'var(--prod-muted)' }}><X className="h-4 w-4" /></button>
      </div>

      {previa.referenciaEhParcial && (
        <p className="mb-2 rounded-lg px-2 py-1.5 text-[11.5px] leading-snug"
          style={{ background: 'var(--fam-ambar-bg)', color: 'var(--fam-ambar-ink)' }}>
          ⚠️ {rotuloDoMes(previa.mesReferencia)} ainda está correndo — o realizado dele é parcial,
          então o plano sai menor do que o mês inteiro vai custar.
        </p>
      )}

      {previa.quantas === 0 ? (
        <p className="text-[12.5px]" style={{ color: 'var(--prod-secondary)' }}>
          Nada a preencher com esta referência.
          {previa.jaTemPlano > 0 && ` ${previa.jaTemPlano} ${previa.jaTemPlano === 1 ? 'categoria já tem' : 'categorias já têm'} plano.`}
          {previa.semRealizado > 0 && ` ${previa.semRealizado} não ${previa.semRealizado === 1 ? 'teve' : 'tiveram'} lançamento em ${rotuloDoMes(previa.mesReferencia)}.`}
        </p>
      ) : (
        <>
          <ul className="mb-2 max-h-56 overflow-y-auto">
            {previa.linhas.filter((l) => l.vai).map((l) => (
              <li key={l.categoryId} className="flex items-baseline justify-between gap-3 border-b py-1 text-[12.5px]"
                style={{ borderColor: 'var(--prod-line)' }}>
                <span className="min-w-0 truncate" style={{ color: 'var(--prod-primary)' }}>
                  {l.nome}
                  {l.qualificador && <span style={{ color: 'var(--prod-muted)' }}> · {l.qualificador}</span>}
                </span>
                <span className="shrink-0 tabular-nums" style={{ color: 'var(--prod-muted)' }}>
                  {/* ⭐ o ANTES e o DEPOIS, pra o dono ver o que está trocando */}
                  {l.planoAtual == null ? '—' : formatBRL(l.planoAtual)}
                  {' → '}
                  <b style={{ color: 'var(--prod-primary)' }}>{formatBRL(l.valor)}</b>
                </span>
              </li>
            ))}
          </ul>
          <p className="mb-2 text-[12.5px]" style={{ color: 'var(--prod-secondary)' }}>
            {previa.quantas} {previa.quantas === 1 ? 'categoria' : 'categorias'} ·{' '}
            <b className="tabular-nums" style={{ color: 'var(--prod-primary)' }}>{formatBRL(previa.soma)}</b> no total
          </p>
        </>
      )}

      {fora.length > 0 && (
        <details className="mb-2">
          <summary className="cursor-pointer text-[11.5px]" style={{ color: 'var(--prod-muted)' }}>
            {fora.length} {fora.length === 1 ? 'fica' : 'ficam'} de fora — ver o porquê
          </summary>
          <ul className="mt-1 space-y-0.5">
            {fora.map((l) => (
              <li key={l.categoryId} className="text-[11.5px]" style={{ color: 'var(--prod-muted)' }}>
                <b style={{ color: 'var(--prod-secondary)' }}>{l.nome}</b> — {l.porque}
              </li>
            ))}
          </ul>
        </details>
      )}

      <div className="flex flex-wrap items-center gap-3">
        {/*
          ⛔⛔ NASCE DESMARCADO: o plano é afirmação do dono, e um lote que passa por cima
          apagaria uma decisão sem avisar (a régua do rename em lote, 09/09).
        */}
        <label className="flex items-center gap-1.5 text-[11.5px]" style={{ color: 'var(--prod-secondary)' }}>
          <input type="checkbox" checked={incluirComPlano} onChange={(e) => aoMudarIncluir(e.target.checked)} />
          substituir também os que já têm plano
        </label>
        <button type="button" onClick={aoConfirmar} disabled={salvando || previa.quantas === 0}
          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12.5px] font-semibold disabled:opacity-50"
          style={{ background: 'var(--prod-acao-bg)', color: 'var(--prod-acao-ink)' }}>
          {salvando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
          preencher {previa.quantas > 0 ? `${previa.quantas} ` : ''}e salvar
        </button>
        <span className="text-[11px]" style={{ color: 'var(--prod-muted)' }}>
          dá pra editar cada linha depois — o número é seu
        </span>
      </div>
    </div>
  )
}
