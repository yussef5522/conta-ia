'use client'

/**
 * ⭐⭐⭐ VENDAS v4 — ABRE NO MÊS DE HOJE, PDV É A VERDADE (10/10/2026).
 *
 * **Reforma do dono:** *"abre no mês errado, cartões fracos, muita conversa"*.
 *
 * ⛔⛔⛔ O BUG QUE MOTIVOU: a tela tinha `useState('2026-08')` — um **mês LITERAL cravado**,
 * com o comentário *"o do início do sistema (agosto) — a Cacula só tem agosto"*. Em outubro
 * ela abria **dois meses no passado**, e a rota (que já tinha o default certo) era
 * sobrescrita pelo `?mes=2026-08` que a tela mandava. ***Data fixa não é default: é uma data
 * que o calendário alcança*** — a mesma classe da REGRA 12 de 01/09.
 *
 * ⭐⭐ ZERO CONTA NOVA NESTA TELA. Os 4 cartões, o calendário, os meios e o dia típico vêm
 * PRONTOS de `lib/vendas/dia-a-dia.ts`; a escolha PDV×extrato por dia mora lá. Uma régua
 * própria aqui faria a célula e o cartão discordarem do mesmo dia.
 *
 * ⚠️ A ROUPA É A DA OPÇÃO A (10/10): 4 cartões SÓLIDOS, número branco redondo ao real com o
 * centavo no tooltip, por TOKEN (zero hex) — e o chão é o `-solid`, nunca o `-mid` (branco
 * sobre ele reprova WCAG em 6 dos 8 casos).
 */
import { use, useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Store, Loader2 } from 'lucide-react'
import { valorDoCartao } from '@/lib/custos-fixos/cartao-de-dono'
import { formatBRL } from '@/lib/format/money'
import { fetchComTimeout } from '@/lib/http/fetch-com-timeout'
import { mesCorrente, mesVizinho, rotuloDoMes } from '@/lib/periodo/mes-corrente'
import { MIN_AMOSTRAS_DO_DIA } from '@/lib/vendas/dia-a-dia'
import type { CartaoDeVendas, DiaDeVenda, FatiaDoMeio, BarraDoDiaTipico } from '@/lib/vendas/dia-a-dia'

type Estado = 'CARREGANDO' | 'FALHOU' | 'OK'
type Periodo = 'DIA' | 'SEMANA' | 'MES' | 'DATAS'

interface Payload {
  recorte: { de: string; ate: string; mes: string | null; ehMesInteiro: boolean }
  hoje: string
  moduleInicio: string | null
  dias: DiaDeVenda[]
  cartoes: CartaoDeVendas[]
  meios: FatiaDoMeio[]
  diaTipico: BarraDoDiaTipico[]
  cobertura: { comPdv: number; peloExtrato: number; pedemImport: number }
}

const PERIODOS: { k: Periodo; r: string }[] = [
  { k: 'DIA', r: 'dia' },
  { k: 'SEMANA', r: 'semana' },
  { k: 'MES', r: 'mês' },
  { k: 'DATAS', r: '📅 datas' },
]

const DIA_MS = 86_400_000
const dt = (s: string) => new Date(`${s}T00:00:00.000Z`)
const ddmm = (s: string) => `${s.slice(8, 10)}/${s.slice(5, 7)}`
const DOW_CURTO = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']

const MEIO_ROTULO: Record<string, string> = {
  PIX: 'PIX', CARTAO: 'cartão', DINHEIRO: 'dinheiro', OUTRO: 'outros',
}
const MEIO_FAMILIA: Record<string, string> = {
  PIX: 'azul', CARTAO: 'indigo', DINHEIRO: 'verde', OUTRO: 'ambar',
}

/**
 * ⭐ O RECORTE QUE A TELA PEDE — uma função, nunca lógica solta no `useCallback`.
 *
 * ⛔⛔ DIA e SEMANA mandam o **NOME do período**, nunca a data: quem sabe que dia é hoje é o
 * SERVIDOR (*"o cronômetro é da tela, o instante é do servidor"*). Calcular aqui faria um
 * aparelho com a hora torta pedir um dia e receber outro marcado como `hoje`.
 */
export function recorteDoChip(
  p: Periodo,
  mes: string,
  datas: { de: string; ate: string },
): Record<string, string> {
  if (p === 'MES') return { mes }
  if (p === 'DIA' || p === 'SEMANA') return { periodo: p }
  return datas.de && datas.ate ? { de: datas.de, ate: datas.ate } : {}
}

export default function VendasPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)

  /**
   * ⛔⛔ O DEFAULT É O MÊS DE HOJE, SEMPRE — nunca o último mês com dado, nunca um literal.
   * `mesCorrente()` é o dono da pergunta (e usa o fuso do Brasil, senão no dia 1º às 00h30
   * de São Paulo a tela abriria no mês anterior).
   */
  const [mes, setMes] = useState(() => mesCorrente())
  const [periodo, setPeriodo] = useState<Periodo>('MES')
  const [de, setDe] = useState('')
  const [ate, setAte] = useState('')
  const [estado, setEstado] = useState<Estado>('CARREGANDO')
  const [erro, setErro] = useState('')
  const [dados, setDados] = useState<Payload | null>(null)

  const carregar = useCallback(async () => {
    setEstado('CARREGANDO')
    // ⚠️ DATAS sem as duas pontas não chama a rota — e a tela DIZ o que falta
    if (periodo === 'DATAS' && (!de || !ate)) { setEstado('OK'); return }
    const q = new URLSearchParams(recorteDoChip(periodo, mes, { de, ate }))
    const r = await fetchComTimeout(`/api/empresas/${id}/vendas?${q}`)
    if (!r.ok) { setErro(r.erro ?? 'erro desconhecido'); setEstado('FALHOU'); return }
    setDados(r.data as Payload)
    setEstado('OK')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, mes, periodo, de, ate])

  useEffect(() => { void carregar() }, [carregar])

  const d = dados

  return (
    <div className="mx-auto max-w-[1440px] px-[28px] pt-[22px] pb-[64px] max-[700px]:px-[14px] max-[700px]:pb-[56px] max-[700px]:pt-[16px]">
      {/* ─────────── CABEÇALHO DE UMA LINHA (a dieta de 10/10) ─────────── */}
      <div className="mb-[14px] flex flex-wrap items-end justify-between gap-[10px]">
        <div className="flex items-center gap-[8px]">
          <Store className="h-5 w-5" style={{ color: 'var(--fam-indigo-mid)' }} />
          <div>
            <h1 className="text-[20px] font-semibold" style={{ color: 'var(--prod-primary)' }}>
              Vendas
            </h1>
            <p className="mt-[2px] text-[13px] tabular-nums" style={{ color: 'var(--prod-secondary)' }}>
              {d ? rotuloDaJanela(d) : '…'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-[6px]">
          {/* ‹ › continua pra passear no calendário */}
          {periodo === 'MES' && (
            <span className="flex items-center gap-[2px]">
              <Chip on={false} onClick={() => setMes(mesVizinho(mes, -1))} rotulo="mês anterior">‹</Chip>
              <span className="px-[6px] text-[12.5px] font-semibold" style={{ color: 'var(--prod-primary)' }}>
                {rotuloDoMes(mes)}
              </span>
              <Chip on={false} onClick={() => setMes(mesVizinho(mes, 1))} rotulo="mês seguinte">›</Chip>
            </span>
          )}
          {PERIODOS.map((p) => (
            <Chip key={p.k} on={periodo === p.k} onClick={() => setPeriodo(p.k)}>
              {p.r}{periodo === p.k && p.k !== 'DATAS' ? ' ✓' : ''}
            </Chip>
          ))}
          {periodo === 'DATAS' && (
            <span className="flex items-center gap-1">
              <label className="text-[11.5px]" style={{ color: 'var(--prod-muted)' }}>
                de
                <input
                  type="date" value={de} onChange={(e) => setDe(e.target.value)}
                  className="ml-1 rounded-[8px] border px-1.5 py-[3px] text-[12.5px]"
                  style={{ borderColor: 'var(--prod-line-strong)', background: 'var(--prod-surface)', color: 'var(--prod-primary)' }}
                />
              </label>
              <label className="text-[11.5px]" style={{ color: 'var(--prod-muted)' }}>
                até
                <input
                  type="date" value={ate} onChange={(e) => setAte(e.target.value)}
                  className="ml-1 rounded-[8px] border px-1.5 py-[3px] text-[12.5px]"
                  style={{ borderColor: 'var(--prod-line-strong)', background: 'var(--prod-surface)', color: 'var(--prod-primary)' }}
                />
              </label>
            </span>
          )}
        </div>
      </div>

      {estado === 'CARREGANDO' && (
        <Cartao>
          <p className="flex items-center gap-[8px] px-[18px] py-5 text-[13px]" style={{ color: 'var(--prod-muted)' }}>
            <Loader2 className="h-4 w-4 animate-spin" /> lendo o período…
          </p>
        </Cartao>
      )}

      {estado === 'FALHOU' && (
        <Cartao>
          <div className="space-y-2 px-[18px] py-5">
            <p className="text-[13px] font-medium" style={{ color: 'var(--fam-coral-ink)' }}>
              Não consegui carregar: {erro}
            </p>
            <button
              type="button" onClick={() => void carregar()}
              className="rounded-[8px] px-2.5 py-1 text-[12.5px] font-medium"
              style={{ background: 'var(--prod-acao-bg)', color: 'var(--prod-acao-ink)' }}
            >
              tentar de novo
            </button>
          </div>
        </Cartao>
      )}

      {estado === 'OK' && periodo === 'DATAS' && (!de || !ate) && (
        <Cartao>
          <p className="px-[18px] py-5 text-[13px]" style={{ color: 'var(--prod-muted)' }}>
            Escolha as duas datas acima — pode ser um dia só.
          </p>
        </Cartao>
      )}

      {estado === 'OK' && d && (
        <>
          <OsQuatroCartoes cartoes={d.cartoes} />
          <Calendario d={d} empresaId={id} />
          <Duo>
            <Meios meios={d.meios} />
            <DiaTipico barras={d.diaTipico} />
          </Duo>
        </>
      )}
    </div>
  )
}

/** ⭐ o rótulo do recorte, derivado — NUNCA um "desde 01/08" literal (a cicatriz de 25/08) */
function rotuloDaJanela(d: Payload): string {
  if (d.recorte.de === d.recorte.ate) return ddmm(d.recorte.de)
  if (d.recorte.ehMesInteiro && d.recorte.mes) return rotuloDoMes(d.recorte.mes)
  return `${ddmm(d.recorte.de)} a ${ddmm(d.recorte.ate)}`
}

/* ═══════════════════════════ OS 4 CARTÕES SÓLIDOS ═══════════════════════════ */

function OsQuatroCartoes({ cartoes }: { cartoes: CartaoDeVendas[] }) {
  return (
    <div className="mb-[12px] grid grid-cols-1 gap-[8px] sm:grid-cols-2 lg:grid-cols-4">
      {cartoes.map((c) => (
        <CartaoSolido key={c.qual} c={c} />
      ))}
    </div>
  )
}

/**
 * ⭐⭐ O CARTÃO — 3 LINHAS, chão SÓLIDO, número BRANCO redondo ao real.
 *
 * ⛔⛔ O chão é o `-solid`, NUNCA o `-mid`: branco sobre o `-mid` dá **3,51:1 no verde e
 * 3,91:1 no coral já no tema CLARO** (medido em 10/10), e a etiqueta de 11px vive no mesmo
 * chão. ⚠️ E o número vem de `valorDoCartao` — o dono único do *"redondo na frente, centavo
 * no tooltip"*; formatar na mão aqui traria os centavos de volta.
 *
 * ⛔ UM `<p>` pro número, com o TEXTO mudando — dois `<p>` em ramos exclusivos dariam 4 tags
 * e o guard do *"máximo 3 parágrafos"* teria que ser afrouxado, parando de morder o
 * parágrafo de volta, que é justamente o vermelho que ele existe pra dar.
 */
function CartaoSolido({ c }: { c: CartaoDeVendas }) {
  const v = valorDoCartao(c.valor)
  return (
    <div className="rounded-xl p-3.5" style={{ background: `var(--fam-${c.familia}-solid)` }}>
      <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: `var(--fam-${c.familia}-on-soft)` }}>
        {c.rotulo}
      </p>
      <p
        className={`mt-1 font-bold leading-none ${v ? 'text-[30px] tabular-nums' : 'text-[22px]'}`}
        style={{ color: `var(--fam-${c.familia}-on)` }}
        title={v ? `com os centavos: ${v.cheio}` : undefined}
      >
        {v ? v.curto : 'a apurar'}
      </p>
      {/*
        3 · UMA sub. ⭐ O `delta` ACENDE SOZINHO quando o histórico existir — sem ele a linha
        continua dizendo o recorte, nunca um "a apurar" ocupando espaço de graça.
      */}
      <p className="mt-1.5 text-[11px] leading-snug" style={{ color: `var(--fam-${c.familia}-on-soft)` }}>
        {c.delta ?? c.sub}
      </p>
    </div>
  )
}

/* ═══════════════════════════ O CALENDÁRIO MAPA DE CALOR ═══════════════════════════ */

/**
 * ⭐⭐ UMA CÉLULA POR DIA, SEMPRE — o bloco agrupado *"fim de semana 2–4"* MORREU.
 *
 * ⛔⛔ E o que sobrevive dele é a VERDADE que ele representava: quando o dia do fds não tem
 * import, o número DELE não existe (o cartão liquida sex+sáb+dom junto e o banco não diz
 * quanto é de cada). A célula aponta pro bloco em vez de mostrar um terço inventado.
 */
function Calendario({ d, empresaId }: { d: Payload; empresaId: string }) {
  const dias = d.dias
  if (dias.length === 0) return null

  /** ⚠️ semana SEG→DOM, a do calendário brasileiro */
  const off = (dt(dias[0].dia).getUTCDay() + 6) % 7
  const celulas: (DiaDeVenda | null)[] = [...Array<null>(off).fill(null), ...dias]
  const semanas: (DiaDeVenda | null)[][] = []
  for (let i = 0; i < celulas.length; i += 7) semanas.push(celulas.slice(i, i + 7))

  return (
    <Cartao>
      <CabecaDoCartao
        titulo="O calendário do período"
        dica="mais escuro = vendeu mais · ★ é o recorde · toque abre o dia"
      />
      <div className="px-[18px] pb-[6px]">
        <div className="mb-[4px] grid grid-cols-7 gap-[4px]">
          {['seg', 'ter', 'qua', 'qui', 'sex', 'sáb', 'dom'].map((x) => (
            <p key={x} className="text-center text-[10.5px] font-semibold uppercase" style={{ color: 'var(--prod-muted)' }}>
              {x}
            </p>
          ))}
        </div>
        {semanas.map((sem, i) => (
          <div key={i} className="mb-[4px] grid grid-cols-7 gap-[4px]">
            {sem.map((x, j) =>
              x == null
                ? <span key={`v${j}`} />
                : <Celula key={x.dia} x={x} empresaId={empresaId} />,
            )}
          </div>
        ))}
      </div>

      {/* ⭐ A COBERTURA numa linha miúda — é ela que explica o `~` sem gritar */}
      <LinhaDaFonte d={d} />
    </Cartao>
  )
}

function Celula({ x, empresaId }: { x: DiaDeVenda; empresaId: string }) {
  const n = Number(x.dia.slice(8, 10))

  // ⭐ dia que PEDE IMPORT: tracejado, clicável, levando à central
  if (x.pedeImport) {
    return (
      <Link
        href={`/empresas/${empresaId}/estoque/vendas?aba=processados#dia-${x.dia}`}
        className="flex min-h-[54px] flex-col justify-between rounded-[8px] border border-dashed px-[5px] py-[4px] text-left"
        style={{ borderColor: 'var(--fam-ambar-mid)', background: 'var(--fam-ambar-bg)' }}
        title={`${DOW_CURTO[x.diaDaSemana]} ${ddmm(x.dia)} — sem import do PDV`}
      >
        <span className="text-[10.5px] font-semibold tabular-nums" style={{ color: 'var(--fam-ambar-ink)' }}>{n}</span>
        <span className="text-[10px] font-semibold leading-tight" style={{ color: 'var(--fam-ambar-ink)' }}>
          importar ⚠
        </span>
      </Link>
    )
  }

  // ⭐ dia com número — PDV é liso, extrato leva `~`
  if (x.total != null) {
    const v = valorDoCartao(x.total)
    /**
     * ⚠️ A INTENSIDADE É DO PRÓPRIO RECORTE (escala relativa ao recorde), e o mínimo de 0,12
     * existe pra o dia que vendeu pouco não desaparecer: célula invisível se lê como
     * "não vendeu", que é outra coisa.
     */
    const alpha = 0.12 + x.calor * 0.88
    return (
      <Link
        href={`/empresas/${empresaId}/estoque/vendas?aba=processados#dia-${x.dia}`}
        className="flex min-h-[54px] flex-col justify-between rounded-[8px] px-[5px] py-[4px] text-left"
        style={{
          background: `color-mix(in srgb, var(--fam-indigo-solid) ${Math.round(alpha * 100)}%, var(--prod-surface-1))`,
          outline: x.hoje ? '2px solid var(--fam-azul-mid)' : undefined,
        }}
        title={`${DOW_CURTO[x.diaDaSemana]} ${ddmm(x.dia)} · ${v?.cheio ?? ''}${x.unidades != null ? ` · ${x.unidades} un` : ''}`}
      >
        <span
          className="flex items-center justify-between text-[10.5px] font-semibold tabular-nums"
          style={{ color: alpha > 0.55 ? 'var(--fam-indigo-on)' : 'var(--prod-secondary)' }}
        >
          <span>{n}</span>
          {x.recorde && <span aria-label="recorde do período">★</span>}
        </span>
        <span
          className="text-[11px] font-bold leading-tight tabular-nums"
          style={{ color: alpha > 0.55 ? 'var(--fam-indigo-on)' : 'var(--prod-primary)' }}
        >
          {x.estimado ? '~' : ''}{v?.curto ?? '—'}
        </span>
      </Link>
    )
  }

  // ⚠️ dentro de um bloco do extrato e sem import: o número do DIA não existe
  if (x.fonte === 'BLOCO') {
    return (
      <span
        className="flex min-h-[54px] flex-col justify-between rounded-[8px] border px-[5px] py-[4px]"
        style={{ borderColor: 'var(--prod-line)', background: 'var(--prod-surface-1)' }}
        title="o cartão liquidou sex+sáb+dom junto — sem o import do PDV não dá pra separar os dias"
      >
        <span className="text-[10.5px] font-semibold tabular-nums" style={{ color: 'var(--prod-muted)' }}>{n}</span>
        <span className="text-[10px] leading-tight" style={{ color: 'var(--prod-muted)' }}>no bloco</span>
      </span>
    )
  }

  /**
   * ⭐ HOJE AINDA ABERTO — o estado que nasceu da prova em prod (10/10). A célula dizia
   * *"sem dado"* no dia em que a loja está vendendo; agora ela diz o que está acontecendo.
   * ⛔ E ela NÃO pede import: o relatório do PDV entra na madrugada.
   */
  if (x.fonte === 'HOJE_ABERTO') {
    return (
      <span
        className="flex min-h-[54px] flex-col justify-between rounded-[8px] border px-[5px] py-[4px]"
        style={{ borderColor: 'var(--fam-indigo-mid)', background: 'var(--fam-indigo-bg)' }}
      >
        <span className="text-[10.5px] font-semibold tabular-nums" style={{ color: 'var(--fam-indigo-ink)' }}>{n}</span>
        <span className="text-[10px] leading-tight" style={{ color: 'var(--fam-indigo-ink)' }}>
          vendendo agora
        </span>
      </span>
    )
  }

  // futuro / antes do início do módulo
  const futuro = x.fonte === 'FUTURO'
  return (
    <span
      className="flex min-h-[54px] flex-col justify-between rounded-[8px] border px-[5px] py-[4px]"
      style={{ borderColor: futuro ? 'transparent' : 'var(--prod-line)', background: 'transparent' }}
    >
      <span className="text-[10.5px] tabular-nums" style={{ color: 'var(--prod-muted)', opacity: futuro ? 0.5 : 1 }}>{n}</span>
      {!futuro && <span className="text-[10px] leading-tight" style={{ color: 'var(--prod-muted)' }}>sem dado</span>}
    </span>
  )
}

/**
 * ⭐⭐ A LINHA DA FONTE — a honestidade numa linha, com o ⓘ por TOQUE.
 *
 * ⛔⛔ `<details>`, NUNCA `title`: **tooltip não existe no celular**, e é lá que o dono opera
 * (a cicatriz de 30/08). O que pode ir pro `title` é o que REPETE um número já visível (os
 * centavos da célula) — a régua completa fica a um toque.
 */
function LinhaDaFonte({ d }: { d: Payload }) {
  const c = d.cobertura
  const partes = [`${c.comPdv} dia(s) do PDV`]
  if (c.peloExtrato > 0) partes.push(`${c.peloExtrato} estimado(s) pelo extrato`)
  if (c.pedemImport > 0) partes.push(`${c.pedemImport} sem import`)

  /**
   * ⭐⭐ A COMPOSIÇÃO — e ela nasceu de uma DIVERGÊNCIA MEDIDA em prod (10/10), não de gosto:
   * esta tela soma **produtos + complementos** e a CENTRAL DE IMPORTAÇÃO mostra **só produtos**
   * (dia 06/10: R$ 17.102,63 × R$ 15.873,77). ⛔ As duas estão certas sobre a pergunta DELAS;
   * errado era nenhuma DIZER qual soma — *"número sem régua em tela de dinheiro é pior que
   * ausência"*, e duas telas com números diferentes pro mesmo dia é a doença que esta casa
   * mais paga (os 111 alarmes falsos, os três agostos).
   */
  const prod = d.dias.reduce((a, x) => a + (x.produtos ?? 0), 0)
  const comp = d.dias.reduce((a, x) => a + (x.complementos ?? 0), 0)

  return (
    <details className="border-t px-[18px] py-[9px]" style={{ borderColor: 'var(--prod-line)', background: 'var(--prod-surface-1)' }}>
      <summary className="flex cursor-pointer list-none flex-wrap items-center gap-[6px] text-[12px] tabular-nums" style={{ color: 'var(--prod-secondary)' }}>
        <span>{partes.join(' · ')}</span>
        <span className="font-semibold underline decoration-dotted" style={{ color: 'var(--fam-indigo-mid)' }}>
          de onde vem o número ⓘ
        </span>
      </summary>
      <div className="mt-[8px] space-y-[6px]">
        <p className="text-[11.5px] leading-snug" style={{ color: 'var(--prod-secondary)' }}>
          <b style={{ color: 'var(--prod-primary)' }}>o número liso:</b> veio do relatório do PDV que
          você importou naquele dia — é o que foi vendido, dia por dia.
        </p>
        <p className="text-[11.5px] leading-snug" style={{ color: 'var(--prod-secondary)' }}>
          <b style={{ color: 'var(--prod-primary)' }}>o número com ~:</b> veio do EXTRATO, pela regra de
          recebimento (quando o dinheiro cai). Ele acerta o total do período, mas o cartão liquida
          sex+sáb+dom junto — então nesses dias o valor de cada um não é separável sem o import.
        </p>
        <p className="text-[11.5px] leading-snug" style={{ color: 'var(--prod-secondary)' }}>
          <b style={{ color: 'var(--prod-primary)' }}>a composição por meio</b> vem sempre do extrato: o
          PDV diz o que foi vendido, não por onde o dinheiro entrou.
        </p>
        {comp > 0 && (
          <p className="text-[11.5px] leading-snug" style={{ color: 'var(--prod-secondary)' }}>
            <b style={{ color: 'var(--prod-primary)' }}>o que este total soma:</b>{' '}
            produtos {formatBRL(prod)} + complementos {formatBRL(comp)} ={' '}
            <b style={{ color: 'var(--prod-primary)' }}>{formatBRL(prod + comp)}</b>. Os complementos
            são os adicionais cobrados à parte (borda, bebida escolhida, upgrade de tamanho) — os
            que já vêm no preço do produto entram no relatório a R$ 0,00 e não somam.{' '}
            <b style={{ color: 'var(--prod-primary)' }}>A central de importação mostra só os
            produtos</b>, então o número dela é menor — é a mesma venda, outra pergunta.
          </p>
        )}
        {d.moduleInicio && (
          <p className="text-[11.5px] leading-snug" style={{ color: 'var(--prod-muted)' }}>
            antes de {ddmm(d.moduleInicio)} o sistema não tem dado de venda —{' '}
            <b>não é loja fechada</b>, é ausência de registro.
          </p>
        )}
      </div>
    </details>
  )
}

/* ═══════════════════════════ AS SEÇÕES DE BAIXO ═══════════════════════════ */

/** ⭐ UMA barra — PIX · cartão · dinheiro, Σ = 100% por construção, pctBR com vírgula */
function Meios({ meios }: { meios: FatiaDoMeio[] }) {
  if (meios.length === 0) {
    return (
      <Cartao>
        <CabecaDoCartao titulo="Como entrou o dinheiro" dica="do extrato" />
        <p className="px-[18px] pb-[14px] text-[12px]" style={{ color: 'var(--prod-muted)' }}>
          nenhuma entrada no período
        </p>
      </Cartao>
    )
  }
  return (
    <Cartao>
      <CabecaDoCartao titulo="Como entrou o dinheiro" dica="do extrato · o PDV não diz o meio" />
      <div
        className="mx-[18px] flex h-[16px] overflow-hidden rounded-full border"
        style={{ borderColor: 'var(--prod-line)' }}
        role="img"
        aria-label={meios.map((m) => `${MEIO_ROTULO[m.meio] ?? m.meio} ${m.rotulo}`).join(', ')}
      >
        {meios.map((m) => (
          <div
            key={m.meio}
            style={{ width: `${m.pct * 100}%`, background: `var(--fam-${MEIO_FAMILIA[m.meio] ?? 'ambar'}-mid)` }}
          />
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-[10px] px-[18px] pb-[14px] pt-[6px] text-[11.5px]">
        {meios.map((m) => (
          <span key={m.meio} className="flex items-center gap-[4px] tabular-nums">
            <span className="h-[8px] w-[8px] rounded-full" style={{ background: `var(--fam-${MEIO_FAMILIA[m.meio] ?? 'ambar'}-mid)` }} />
            <b style={{ color: 'var(--prod-primary)' }}>{m.rotulo}</b>
            <span style={{ color: 'var(--prod-secondary)' }}>{MEIO_ROTULO[m.meio] ?? m.meio}</span>
          </span>
        ))}
      </div>
    </Cartao>
  )
}

/** ⭐ O DIA TÍPICO — barras horizontais; "a apurar" honesto abaixo de 2 semanas de amostra */
function DiaTipico({ barras }: { barras: BarraDoDiaTipico[] }) {
  return (
    <Cartao>
      <CabecaDoCartao titulo="O dia típico" dica={`média por dia da semana · mínimo ${MIN_AMOSTRAS_DO_DIA} semanas`} />
      <div className="space-y-[7px] px-[18px] pb-[14px]">
        {barras.map((b) => {
          const v = valorDoCartao(b.media)
          return (
            <div key={b.rotulo} className="flex items-center gap-[8px]">
              <span className="w-[86px] shrink-0 text-[12px]" style={{ color: 'var(--prod-secondary)' }}>{b.rotulo}</span>
              <span className="h-[12px] flex-1 overflow-hidden rounded-full" style={{ background: 'var(--prod-surface-1)' }}>
                {v && <span className="block h-full rounded-full" style={{ width: `${Math.max(2, b.fracao * 100)}%`, background: 'var(--fam-indigo-mid)' }} />}
              </span>
              <span
                className="w-[104px] shrink-0 text-right text-[12px] font-semibold tabular-nums"
                style={{ color: v ? 'var(--prod-primary)' : 'var(--prod-muted)' }}
                title={v ? `com os centavos: ${v.cheio}` : undefined}
              >
                {v ? v.curto : 'a apurar'}
              </span>
            </div>
          )
        })}
        {/* ⚠️ a amostra é DITA — média de 1 semana não é média, e esconder isso seria pior */}
        <p className="pt-[2px] text-[11px]" style={{ color: 'var(--prod-muted)' }}>
          {barras.map((b) => `${b.rotulo}: ${b.amostras}`).join(' · ')} ·{' '}
          {barras.some((b) => b.media == null)
            ? 'os "a apurar" esperam mais semanas de histórico'
            : 'histórico suficiente em todos'}
        </p>
      </div>
    </Cartao>
  )
}

/* ═══════════════════════════ CASCA ═══════════════════════════ */

function Cartao({ children }: { children: React.ReactNode }) {
  return (
    <section
      className="mb-[12px] overflow-hidden rounded-[16px] border"
      style={{ borderColor: 'var(--prod-line)', background: 'var(--prod-surface)', boxShadow: 'var(--prod-sombra)' }}
    >
      {children}
    </section>
  )
}

function CabecaDoCartao({ titulo, dica }: { titulo: string; dica?: string }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-[8px] px-[18px] pb-[8px] pt-[14px]">
      <h2 className="text-[15px] font-semibold" style={{ color: 'var(--prod-primary)' }}>{titulo}</h2>
      {dica && <span className="text-[11.5px]" style={{ color: 'var(--prod-muted)' }}>{dica}</span>}
    </div>
  )
}

/** ⭐ a dupla lado a lado em ≥1024px — o molde da casa (a lei de layout de 08/10) */
function Duo({ children }: { children: React.ReactNode }) {
  return (
    <div className="lg:grid lg:grid-cols-2 lg:items-start lg:gap-[14px] lg:[&>section]:mb-0">
      {children}
    </div>
  )
}

function Chip({ on, onClick, children, rotulo }: {
  on: boolean
  onClick: () => void
  children: React.ReactNode
  rotulo?: string
}) {
  return (
    <button
      type="button" onClick={onClick} aria-label={rotulo}
      className="rounded-full px-[12px] py-[5px] text-[12.5px] font-medium"
      style={on
        ? { background: 'var(--fam-indigo-mid)', color: 'var(--prod-acao-ink)' }
        : { background: 'var(--prod-surface-1)', color: 'var(--prod-secondary)' }}
    >
      {children}
    </button>
  )
}
