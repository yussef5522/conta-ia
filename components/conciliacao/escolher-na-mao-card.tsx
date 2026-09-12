'use client'

// ⭐⭐⭐ O CORPO DO CARD — O MOCK, AO PIXEL (`docs/mocks/conciliacao-mock.html`).
//
// **O dono:** *"o comportamento está certo — NÃO MEXE NO MOTOR. O que está errado é o
// VISUAL. Copia do arquivo, literalmente. Espaçamentos, tamanhos de fonte e raios: OS DO
// ARQUIVO, medidos nele — não 'parecidos'."*
//
// Medido no arquivo e reproduzido aqui:
//   `.linha-banco` chão FRIO #f2f6fb · padding 12px 16px · 13.5px · valor <b> 15px
//   `.instr`       padding 10px 16px 2px · 13px · cor --sub
//   `.grupo-t`     padding 10px 16px 4px · 11.5px/700 caps · ls .03em · cor --sub
//   `label.nota`   gap 12px · padding 10px 16px · borda-topo #f1efe9 · 14px
//                  input 19px accent roxo · small 12px --sub · valor 600
//                  `.sugerida` fundo #eeecfa, e o <b> do small em roxo
//   `.ajuste`      margem 0 16px 12px · padding 10px 12px · âmbar-fraco · raio 10 · 13px
//   `.dica`        idem em slate-fraco · 12.5px
//   `.rodape`      sticky · fundo branco · **borda-topo 2px** · padding 12px 16px · gap 12
//                  `.btn` raio 12px · padding 12px 18px · 14.5px/700
//                  `.btn-p` roxo sólido, **nasce opacity .35 sem pointer-events**
//                  `.btn-g` fundo nenhum, cor --sub, borda 1px --line
//
// ⛔⛔ AS TRÊS TRAVAS DO MOTOR SEGUEM INTACTAS — só a pintura mudou:
//  1. Conciliar só acende com diferença ZERO, ou nomeada dentro do teto, ou parcial aceita.
//  2. O atalho ⭐ só MARCA as caixas.
//  3. Duas combinações que fecham = sem atalho, e sem nada marcado.
//
// ⚠️ MOBILE PRIMEIRO: rodapé sticky, e a LINHA INTEIRA da nota é o alvo do dedo.

import { useState, useMemo, useCallback } from 'react'
import { Loader2 } from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'
import { formatBRL } from '@/lib/format/money'
import { JANELA_A_VENCER_DIAS } from '@/lib/conciliacao/escolher-na-mao'
import { avaliarDiferenca, TETO_QUE_O_SISTEMA_OFERECE, FECHA_AO_CENTAVO } from '@/lib/conciliacao/regua-da-diferenca'
import { MOCK, LINHA_ENTRE_NOTAS, HOVER_NOTA, chip } from './mock-tokens'

export interface NotaDoCardDTO {
  id: string
  descricao: string
  valor: number
  emAberto: number
  jaPago: number
  vencimento: string
  vencida: boolean
  sugerida: boolean
  /** ⭐ a vencer LONGE (> 30 dias): fica atrás de "mostrar mais" em vez de virar parede */
  foraDaJanela: boolean
}

export interface CardDeEscolhaDTO {
  linha: { id: string; descricao: string; valor: number; data: string; conta: string | null; categoria: string | null }
  fornecedorId: string
  fornecedorNome: string
  vencidas: NotaDoCardDTO[]
  aVencer: NotaDoCardDTO[]
  atalho: { notasIds: string[]; resumo: string; ambiguo: boolean } | null
}

/** o teto do acerto com nome — o MESMO do servidor (`escolher-na-mao.ts`) */
/**
 * ⚠️ ERA `const TETO = 25` HARDCODED AQUI (corrigido 11/09/2026) — número solto na tela é a
 * segunda régua no dia em que o teto mudar, exatamente como o `30` da janela do "a vencer"
 * já tinha ensinado. Agora vem do dono único.
 */
const TETO = TETO_QUE_O_SISTEMA_OFERECE
// ⚠️ o mesmo "fecha ao centavo" do servidor — um dono só (12/09)
const TOL = FECHA_AO_CENTAVO
const dia = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { timeZone: 'UTC' })
const diaCurto = (iso: string) =>
  new Date(iso).toLocaleDateString('pt-BR', { timeZone: 'UTC', day: '2-digit', month: '2-digit' })
const round2 = (n: number) => Math.round((n + 1e-9) * 100) / 100
/** ⚠️ o mock usa o MENOS de verdade (U+2212), não hífen */
const menos = (v: number) => `− ${formatBRL(v)}`

/** ⭐ os três nomes que a diferença pequena pode ter — o "Revisar valores" da Conta Azul */
const NOMES_DA_DIFERENCA = [
  { chave: 'JUROS' as const, rotulo: 'juros/multa' },
  { chave: 'TARIFA', rotulo: 'tarifa' },
  { chave: 'DESCONTO', rotulo: 'desconto' },
] as const

interface Props {
  empresaId: string
  card: CardDeEscolhaDTO
  onConciliado: (extratoId: string) => void
  onFechar: () => void
  /** ⭐ navegação entre as linhas do mesmo fornecedor — *"uma linha por vez, da mais antiga"* */
  navegacao?: { indice: number; total: number; onIr: (i: number) => void }
}

export function EscolherNaMaoCard({ empresaId, card, onConciliado, onFechar, navegacao }: Props) {
  const { toast } = useToast()
  const [marcadas, setMarcadas] = useState<Set<string>>(
    () => new Set([...card.vencidas, ...card.aVencer].filter((n) => n.sugerida).map((n) => n.id)),
  )
  const [nomeDaDiferenca, setNomeDaDiferenca] = useState<string | null>(null)
  const [parcialAceita, setParcialAceita] = useState(false)
  const [ocupado, setOcupado] = useState(false)
  /** ⚠️ nasce ABERTO se alguma nota de fora da janela veio sugerida — senão a tela marcaria
   *  uma caixa que o dono não consegue ver. */
  const [verDistantes, setVerDistantes] = useState(
    () => card.aVencer.some((n) => n.foraDaJanela && n.sugerida),
  )

  const todas = useMemo(() => [...card.vencidas, ...card.aVencer], [card])
  const aVencerPerto = useMemo(() => card.aVencer.filter((n) => !n.foraDaJanela), [card])
  const aVencerLonge = useMemo(() => card.aVencer.filter((n) => n.foraDaJanela), [card])
  /** ⭐ lista longa ROLA dentro do card — o rodapé sticky não pode sair do polegar */
  const listaLonga = todas.length > 8

  // ⚠️ a ORDEM importa: quem recebe a baixa parcial é a ÚLTIMA marcada (vencimento mais
  // distante), e a tela DIZ qual é — o dono desmarca se quiser outra.
  const marcadasOrdenadas = useMemo(
    () => todas.filter((n) => marcadas.has(n.id)),
    [todas, marcadas],
  )
  const selecionado = round2(marcadasOrdenadas.reduce((s, n) => s + n.emAberto, 0))
  const diferenca = round2(card.linha.valor - selecionado)
  const fecha = Math.abs(diferenca) <= TOL
  const falta = diferenca > TOL
  const passou = diferenca < -TOL
  const cabeNome = falta && diferenca <= TETO
  /**
   * ⭐⭐⭐ ACIMA DO TETO AUTOMÁTICO, O GESTO É DELE (11/09/2026) — decisão do dono.
   *
   * **Caso real:** Frigorífico, linha 3.845,71 × NF de 3.800,11 paga atrasada — os **45,60
   * SÃO multa+juros**, e o teto de R$ 25 os deixava sem saída nenhuma.
   *
   * ⚠️ O NÚMERO vem de `tetoDoGestoManual` (10% da linha), não de uma conta escrita aqui:
   * a tela já duplica a montagem do rodapé (débito registrado), e duplicar também o TETO
   * faria a tela oferecer o gesto que o servidor recusa — ou o contrário.
   */
  // ⭐⭐ A RÉGUA É A MESMA DO SERVIDOR (12/09) — `avaliarDiferenca`. Antes a tela tinha a
  // dela e a rota tinha a dela (0,02), e o Conciliar acendia pra um gesto que o servidor
  // recusava com "Tolerância máxima: R$ 0,02".
  const veredicto = avaliarDiferenca(card.linha.valor, diferenca, !!nomeDaDiferenca)
  const tetoManual = veredicto.tetoDoGesto
  const cabeNoManual = veredicto.degrau === 'PERGUNTA'
  const ultima = marcadasOrdenadas[marcadasOrdenadas.length - 1]
  const sobra = round2(-diferenca)
  const parcial = passou && ultima && ultima.emAberto > sobra + TOL
    ? { nota: ultima, recebe: round2(ultima.emAberto - sobra), continuaEmAberto: sobra }
    : null

  // ⭐ o Conciliar acende pela MESMA régua que o servidor aplica — nunca mais um sem o outro
  const podeConciliar = veredicto.podeFechar || (!!parcial && parcialAceita)

  const alternar = useCallback((id: string) => {
    setParcialAceita(false)
    setMarcadas((m) => {
      const novo = new Set(m)
      if (novo.has(id)) novo.delete(id); else novo.add(id)
      return novo
    })
  }, [])

  async function conciliar() {
    if (!podeConciliar) return
    setOcupado(true)
    try {
      // ⛔ a conta da PARCIAL não vai nas inteiras — o servidor recusa se for
      const inteiras = marcadasOrdenadas.filter((n) => n.id !== parcial?.nota.id).map((n) => n.id)
      const res = await fetch('/api/conciliacao/find-and-match/reconcile', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ofxTransactionId: card.linha.id,
          candidateIds: inteiras,
          ...(parcial ? { parcial: { payableId: parcial.nota.id, valor: parcial.recebe } } : {}),
          /**
           * ⛔⛔ ISTO NÃO IA (12/09/2026) — e era o defeito inteiro. O card coletava o nome
           * da diferença, acendia o botão com ele e **mandava só os `candidateIds`**: o
           * servidor não tinha como saber que havia uma diferença confirmada, e recusava
           * com razão. A tela prometia o que não tinha como cumprir.
           */
          ...(nomeDaDiferenca && !fecha
            ? { diferencaNomeada: { valor: diferenca, natureza: nomeDaDiferenca } }
            : {}),
        }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast({ variant: 'destructive', title: 'Não deu pra conciliar', description: body?.erro ?? `HTTP ${res.status}` })
        return
      }
      toast({
        title: `${body.reconciled ?? inteiras.length} nota(s) quitada(s)`,
        description: parcial
          ? `${parcial.nota.descricao} recebeu ${formatBRL(parcial.recebe)} · ${formatBRL(parcial.continuaEmAberto)} continuam em aberto.`
          : 'Todas apontam pra a mesma linha do extrato.',
      })
      onConciliado(card.linha.id)
    } catch {
      toast({ variant: 'destructive', title: 'Falha de rede', description: 'Tenta de novo.' })
    } finally { setOcupado(false) }
  }

  /** `label.nota` — gap 12px · padding 10px 16px · borda-topo #f1efe9 · 14px */
  const Nota = ({ n }: { n: NotaDoCardDTO }) => {
    const destacada = n.sugerida && marcadas.has(n.id)
    return (
      <label
        className="flex cursor-pointer items-center gap-[12px] border-t px-[16px] py-[10px] text-[14px]"
        style={{ borderColor: LINHA_ENTRE_NOTAS, background: destacada ? MOCK.roxoFraco : undefined }}
        onMouseEnter={(e) => { if (!destacada) e.currentTarget.style.background = HOVER_NOTA }}
        onMouseLeave={(e) => { e.currentTarget.style.background = destacada ? MOCK.roxoFraco : '' }}
      >
        <input
          type="checkbox" checked={marcadas.has(n.id)} onChange={() => alternar(n.id)}
          className="shrink-0"
          style={{ width: '19px', height: '19px', accentColor: MOCK.roxo }}
        />
        <span className="min-w-0 flex-1">
          <span className="block truncate" style={{ color: MOCK.ink }}>{n.descricao}</span>
          <small className="block text-[12px]" style={{ color: MOCK.sub }}>
            venc {dia(n.vencimento)}
            {/* ⚠️ nota que já recebeu parte diz isso — o valor de face não é o que ela deve */}
            {n.jaPago > 0 && <> · de {formatBRL(n.valor)}, já baixados {formatBRL(n.jaPago)}</>}
            {n.sugerida && card.atalho && !card.atalho.ambiguo && (
              <> · <b style={{ color: MOCK.roxo }}>⭐ com essa, a soma crava</b></>
            )}
          </small>
        </span>
        <span className="shrink-0 font-semibold tabular-nums" style={{ color: MOCK.ink }}>
          {formatBRL(n.emAberto)}
        </span>
      </label>
    )
  }

  return (
    <div>
      {/* ── `.linha-banco` — chão FRIO ── */}
      <div
        className="flex items-center justify-between gap-[12px] px-[16px] py-[12px] text-[13.5px]"
        style={{ background: MOCK.frio, color: MOCK.ink }}
      >
        <span className="min-w-0 truncate">
          💳 {card.linha.conta ?? 'conta'} · {diaCurto(card.linha.data)} ·{' '}
          &quot;{card.linha.descricao}&quot;
        </span>
        <b className="shrink-0 text-[15px] tabular-nums">{menos(card.linha.valor)}</b>
      </div>

      {/* ── uma linha por vez: `.fech` do mock (padding 14px 16px · 13.5px · --sub) ── */}
      {navegacao && navegacao.total > 1 && (
        <div
          className="flex items-center justify-between gap-[12px] px-[16px] py-[14px] text-[13.5px]"
          style={{ color: MOCK.sub }}
        >
          <span>linha {navegacao.indice + 1} de {navegacao.total}</span>
          <span className="flex items-center gap-2">
            <button type="button" disabled={ocupado || navegacao.indice === 0}
              onClick={() => navegacao.onIr(navegacao.indice - 1)}
              className="disabled:opacity-35" style={chip(MOCK.slateFraco, MOCK.slate)}>
              ‹ anterior
            </button>
            {/* ⚠️ "pular" e não "próximo": decisão adiada não é decisão errada */}
            <button type="button" disabled={ocupado || navegacao.indice + 1 >= navegacao.total}
              onClick={() => navegacao.onIr(navegacao.indice + 1)}
              className="disabled:opacity-35" style={chip(MOCK.roxoFraco, MOCK.roxo)}>
              pular pra próxima ›
            </button>
          </span>
        </div>
      )}

      {/* ── `.instr` ── */}
      <p className="px-[16px] pb-[2px] pt-[10px] text-[13px]" style={{ color: MOCK.sub }}>
        Marca as notas que esse pagamento cobriu — vale misturar vencidas e a vencer:
      </p>

      {/* ⚠️ lista longa ROLA aqui dentro (a Box Paper tem 15) */}
      <div className={listaLonga ? 'max-h-[46vh] overflow-y-auto overscroll-contain' : ''}>
        {card.vencidas.length > 0 && (
          <>
            <p className="px-[16px] pb-[4px] pt-[10px] text-[11.5px] font-bold uppercase tracking-[.03em]"
              style={{ color: MOCK.sub }}>
              Vencidas
            </p>
            {card.vencidas.map((n) => <Nota key={n.id} n={n} />)}
          </>
        )}
        {card.aVencer.length > 0 && (
          <>
            <p className="px-[16px] pb-[4px] pt-[10px] text-[11.5px] font-bold uppercase tracking-[.03em]"
              style={{ color: MOCK.sub }}>
              A vencer (o pagamento pode ter levado junto)
            </p>
            {aVencerPerto.map((n) => <Nota key={n.id} n={n} />)}
            {verDistantes && aVencerLonge.map((n) => <Nota key={n.id} n={n} />)}
            {/* ⛔ nenhuma some: o dono pode adiantar parcela — só não abre a tela */}
            {aVencerLonge.length > 0 && (
              <button type="button" onClick={() => setVerDistantes((v) => !v)}
                className="w-full border-t px-[16px] py-[10px] text-left text-[13px]"
                style={{ borderColor: LINHA_ENTRE_NOTAS, color: MOCK.sub }}>
                {verDistantes
                  ? '▲ esconder as que vencem depois'
                  : `▼ mostrar mais ${aVencerLonge.length} que vencem além de ${JANELA_A_VENCER_DIAS} dias`}
              </button>
            )}
          </>
        )}
        {todas.length === 0 && (
          <p className="px-[16px] py-[12px] text-[13.5px]" style={{ color: MOCK.sub }}>
            Este fornecedor não tem nota em aberto — a linha não é pagamento de conta nossa.
          </p>
        )}
      </div>

      {/* ── `.ajuste` — a faixa âmbar do juros ── */}
      {cabeNome && (
        <div className="mx-[16px] mb-[12px] rounded-[10px] px-[12px] py-[10px] text-[13px]"
          style={{ background: MOCK.ambarFraco, color: MOCK.ambar }}>
          Sobra <b>{formatBRL(diferenca)}</b> — dá pra fechar como <b>juros/tarifa</b>, com o
          valor escrito no rastro. O que foi?
          <span className="mt-2 flex flex-wrap gap-2">
            {NOMES_DA_DIFERENCA.map((o) => (
              <button key={o.chave} type="button" onClick={() => setNomeDaDiferenca(o.chave)}
                style={nomeDaDiferenca === o.chave
                  ? chip(MOCK.ambar, '#ffffff')
                  : chip('#ffffff', MOCK.ambar)}>
                {o.rotulo}
              </button>
            ))}
          </span>
        </div>
      )}

      {/* ── ⭐⭐ O GESTO EXPLÍCITO, acima do teto automático (11/09). O valor vai em
             DESTAQUE porque é exatamente o que o dono está confirmando — e é o que fica
             escrito no rastro ("confirmada por quem conciliou"). ── */}
      {cabeNoManual && marcadas.size > 0 && (
        <label className="mx-[16px] mb-[12px] flex cursor-pointer items-start gap-[10px] rounded-[10px] px-[12px] py-[10px] text-[13px] leading-relaxed"
          style={{ background: MOCK.ambarFraco ?? '#fdf3e3', color: MOCK.ambar }}>
          <input type="checkbox" checked={nomeDaDiferenca === 'JUROS'}
            onChange={(e) => setNomeDaDiferenca(e.target.checked ? 'JUROS' : null)}
            className="mt-0.5 shrink-0" style={{ width: '19px', height: '19px', accentColor: MOCK.ambar }} />
          <span>
            A diferença de <b style={{ fontSize: '15px' }}>{formatBRL(diferenca)}</b> é
            {' '}<b>juros/multa de atraso</b> — confirmar.
            <span className="ml-1 opacity-70">(até {formatBRL(tetoManual)} nesta linha)</span>
          </span>
        </label>
      )}

      {/* ── `.dica` — faixa slate. ⛔ só depois de selecionar algo: com zero marcado,
             "faltam R$ 2.008,00" é a linha inteira e não ensina nada. ── */}
      {falta && !cabeNome && !cabeNoManual && marcadas.size > 0 && (
        <p className="mx-[16px] mb-[14px] rounded-[10px] px-[12px] py-[10px] text-[12.5px] leading-relaxed"
          style={{ background: MOCK.slateFraco, color: MOCK.slate }}>
          Faltam <b>{formatBRL(diferenca)}</b>, acima do teto de segurança ({formatBRL(tetoManual)}). Não acha a
          nota que falta? Ela pode não estar no sistema ainda — aí é baixa parcial, ou não é
          isso.
        </p>
      )}

      {/* ── BAIXA PARCIAL, na faixa roxa-fraca ── */}
      {parcial && (
        <label className="mx-[16px] mb-[12px] flex cursor-pointer items-start gap-[10px] rounded-[10px] px-[12px] py-[10px] text-[13px] leading-relaxed"
          style={{ background: MOCK.roxoFraco, color: MOCK.roxo }}>
          <input type="checkbox" checked={parcialAceita} onChange={(e) => setParcialAceita(e.target.checked)}
            className="mt-0.5 shrink-0" style={{ width: '19px', height: '19px', accentColor: MOCK.roxo }} />
          <span>
            ✂️ <b>{parcial.nota.descricao}</b> recebe <b>{formatBRL(parcial.recebe)}</b> deste
            pagamento · <b>{formatBRL(parcial.continuaEmAberto)}</b> continuam em aberto no
            Contas a Pagar.
          </span>
        </label>
      )}

      {/* ── `.rodape` — sticky, branco, borda-topo 2px ── */}
      <div
        className="sticky bottom-0 flex items-center gap-[12px] px-[16px] py-[12px]"
        style={{ background: MOCK.card, borderTop: `2px solid ${MOCK.line}` }}
      >
        <span className="flex-1 text-[13.5px]" style={{ color: MOCK.ink }}>
          selecionado {formatBRL(selecionado)} ·{' '}
          {fecha ? (
            <b style={{ color: MOCK.verde }}>✓ soma crava com o pagamento</b>
          ) : falta ? (
            <b style={{ color: MOCK.ambar }}>faltam {formatBRL(diferenca)}</b>
          ) : parcial ? (
            <b style={{ color: MOCK.coral }}>passou {formatBRL(sobra)} — a última recebe baixa parcial</b>
          ) : (
            <b style={{ color: MOCK.coral }}>passou {formatBRL(sobra)} — desmarca alguma</b>
          )}
        </span>
        {/* `.btn-g` */}
        <button type="button" disabled={ocupado} onClick={onFechar}
          className="shrink-0 rounded-[12px] border px-[18px] py-[12px] text-[14.5px] font-bold"
          style={{ background: 'none', color: MOCK.sub, borderColor: MOCK.line }}>
          não é isso
        </button>
        {/* `.btn-p` — nasce opacity .35 e sem pointer-events; acende quando a conta fecha */}
        <button type="button" onClick={conciliar} disabled={ocupado || !podeConciliar}
          className="flex shrink-0 items-center gap-[8px] rounded-[12px] px-[18px] py-[12px] text-[14.5px] font-bold"
          style={{
            background: MOCK.roxo, color: '#fff',
            opacity: podeConciliar && !ocupado ? 1 : 0.35,
            pointerEvents: podeConciliar && !ocupado ? 'auto' : 'none',
          }}>
          {ocupado && <Loader2 className="h-4 w-4 animate-spin" />}
          Conciliar
        </button>
      </div>
      <span className="hidden" data-empresa={empresaId} />
    </div>
  )
}
