'use client'

/**
 * ⭐⭐⭐ CONFERÊNCIA v2 — **O CARTÃO VIRA PLACAR** (09/10/2026, reforma do dono).
 *
 * **Ordem:** *"números, curto, funcional"* — cartão de UMA LINHA (logo + nome + quem/há Xh |
 * número grande `declarou / pedido` | veredito CURTO com número | ✓ e ✏️ de dedo), suspeitas na
 * frente, modo RAJADA (carimbar remove o cartão e o próximo sobe), corrigir INLINE.
 *
 * ⛔⛔⛔ **O GATE É DO PAYLOAD, NÃO DESTE COMPONENTE.** A rota exige `stock.manage`; quem não
 * tem **não recebe a fila**. Esconder só aqui deixaria o veredito do fiscal (e agora o
 * **esperado com retalho**) viajando no JSON até o tablet — e a lei de 05/10 (*"nenhum número
 * esperado na tela de quem declara — é cola de prova"*) estaria a um DevTools de distância.
 *
 * ⚠️ E o fetch só sai **depois** de as permissões carregarem: disparar antes queimaria um 403
 * por carregamento de página no tablet — a cicatriz do badge que levava 1.391 403/dia (28/09).
 *
 * ⭐ REGRA 12 — **uma composição, dois viewports**: a linha quebra com `flex-wrap` e os botões
 * têm **42px** (dedo). **O gerente confere do CELULAR, com o login dele.**
 */
import { useCallback, useEffect, useState } from 'react'
import { Check, Clock, Pencil, ShieldCheck } from 'lucide-react'
import { LogoDaReceita } from './logo-da-receita'
import { PainelDeConferencia } from './painel-de-conferencia'
import { confirmarNaRota } from './gesto-de-conferencia'
import { fetchComTimeout } from '@/lib/http/fetch-com-timeout'

export interface CartaoDaFila {
  conclusaoId: string
  ordemId: string
  produto: string
  unidade: string
  declaradoPor: string | null
  declarado: number
  declaradoTxt: string
  pedido: number | null
  pedidoTxt: string | null
  origemDoPedido: 'DECLARADO' | 'DERIVADO' | null
  declaradoEm: string
  minutosEsperando: number
  atrasado: boolean
  fiscalOk: boolean | null
  /** ⭐ o veredito CURTO — *"confere"* ou *"dava ~49"*. A frase longa vive na página da ordem. */
  fiscalResumo: string | null
  /** ⭐ o esperado COM o retalho de ontem (Parte 1) — só existe na receita marcada */
  esperadoComRetalho: number | null
  esperadoTxt: string | null
  retalhoKg: number | null
}

interface Fila {
  cartoes: CartaoDaFila[]
  aguardando: number
  atrasados: number
}

/** ⚠️ "há quanto tempo" com a MESMA régua de leitura do resto da casa: minuto até 1h, hora depois */
export function haQuantoTempo(minutos: number): string {
  if (minutos < 1) return 'agora mesmo'
  if (minutos < 60) return `há ${minutos}min`
  const h = Math.floor(minutos / 60)
  const m = minutos % 60
  return m === 0 ? `há ${h}h` : `há ${h}h${String(m).padStart(2, '0')}`
}

export function ConferenciaDoDia({ id, podeGerenciar, carregandoPerm, onMudou }: {
  id: string
  podeGerenciar: boolean
  carregandoPerm: boolean
  /** a lista de concluídas recarrega junto — o selo tem que mudar na frente dele */
  onMudou?: () => void
}) {
  const [fila, setFila] = useState<Fila | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  /** qual cartão está com o ✏️ aberto (correção inline) */
  const [editando, setEditando] = useState<string | null>(null)
  /** ⭐ o cartão que está SAINDO — é o que dá a transição curta do modo rajada */
  const [saindo, setSaindo] = useState<string | null>(null)
  const [carimbando, setCarimbando] = useState<string | null>(null)
  const [feito, setFeito] = useState<string | null>(null)
  const [recusa, setRecusa] = useState<string | null>(null)

  const carregar = useCallback(async () => {
    const r = await fetchComTimeout<Fila>(`/api/empresas/${id}/estoque/producao/conferencia`)
    if (!r.ok) { setErro(r.erro ?? 'não consegui carregar'); return }
    setErro(null)
    setFila(r.data)
  }, [id])

  useEffect(() => {
    if (carregandoPerm || !podeGerenciar) return
    void carregar()
  }, [carregandoPerm, podeGerenciar, carregar])

  /**
   * ⭐⭐ MODO RAJADA — **o cartão sai da lista LOCALMENTE e o próximo sobe.**
   *
   * ⛔⛔ **Sem recarregar a fila, e isso é o ponto do modo.** Um `carregar()` depois de cada
   * carimbo remontaria a lista inteira: o scroll pula, o cartão que o dedo já estava mirando
   * troca de lugar, e numa rajada de 10 lotes o gerente erra o alvo. ⚠️ O preço está
   * registrado: conclusão NOVA que chegar durante a rajada só aparece no próximo carregamento
   * da página — e isso é melhor que a lista se mexer embaixo do dedo.
   *
   * ⚠️ O `onMudou` CONTINUA: a lista de concluídas (o selo ✓✓) é outra tela e tem que andar.
   */
  function removerDaFila(conclusaoId: string, frase: string) {
    setFeito(frase)
    setSaindo(conclusaoId)
    setTimeout(() => {
      setFila((f) => {
        if (!f) return f
        const cartoes = f.cartoes.filter((c) => c.conclusaoId !== conclusaoId)
        const sai = f.cartoes.find((c) => c.conclusaoId === conclusaoId)
        return {
          cartoes,
          aguardando: cartoes.length,
          /** ⚠️ o badge desce JUNTO — contador que fica atrás da lista é o B1 em miniatura */
          atrasados: Math.max(0, f.atrasados - (sai?.atrasado ? 1 : 0)),
        }
      })
      setSaindo(null)
      setEditando(null)
    }, 180)
    onMudou?.()
  }

  /** ⭐ o ✓ de UM TOQUE — pela porta única (`confirmarNaRota`), a mesma do painel */
  async function carimbar(c: CartaoDaFila) {
    setCarimbando(c.conclusaoId); setRecusa(null)
    const r = await confirmarNaRota(id, c.conclusaoId)
    setCarimbando(null)
    if (!r.ok) { setRecusa(`${c.produto}: ${r.erro}`); return }
    removerDaFila(c.conclusaoId, `✓✓ ${c.produto} conferido por ${r.conferidoPorNome}`)
  }

  /** ⛔ sem permissão ou sem fila carregada: NADA — a ausência é o gate funcionando */
  if (carregandoPerm || !podeGerenciar) return null
  if (erro) {
    return (
      <section className="mb-4 rounded-xl p-3 text-[12.5px]"
        style={{ background: 'var(--fam-ambar-bg)', color: 'var(--fam-ambar-ink)' }}>
        Não consegui carregar a conferência do dia — {erro}{' '}
        <button type="button" onClick={() => void carregar()} className="underline">tentar de novo</button>
      </section>
    )
  }
  /** ⛔ some quando não há nada aguardando: móvel zerado treina o dono a não olhar */
  if (!fila || fila.aguardando === 0) return null

  return (
    /** ⭐ a ÂNCORA do aviso do sininho (item 2d): `#conferencia-do-dia` cai aqui. */
    <section id="conferencia-do-dia" className="mb-5 scroll-mt-20">
      <div className="mb-1 flex items-center gap-2">
        <ShieldCheck className="h-4 w-4" style={{ color: 'var(--fam-indigo-mid)' }} />
        <h2 className="text-[13px] font-semibold uppercase tracking-wide" style={{ color: 'var(--prod-primary)' }}>
          Conferência do dia
        </h2>
        <span className="rounded-full px-2 py-0.5 text-[11.5px] font-bold tabular-nums"
          style={{
            background: fila.atrasados > 0 ? 'var(--fam-coral-bg)' : 'var(--fam-indigo-bg)',
            color: fila.atrasados > 0 ? 'var(--fam-coral-ink)' : 'var(--fam-indigo-ink)',
          }}>
          {fila.aguardando} aguardando
        </span>
        {/* ⚠️ o atraso vai NOMEADO, nunca só como cor — cor sozinha não diz o degrau */}
        {fila.atrasados > 0 && (
          <span className="text-[11.5px]" style={{ color: 'var(--fam-coral-ink)' }}>
            {fila.atrasados} parada{fila.atrasados > 1 ? 's' : ''} há mais de 3h
          </span>
        )}
      </div>
      {/**
        * ⭐⭐ A LINHA DA ASSINATURA — **UMA, no cabeçalho** (ordem do dono: *"nunca por cartão"*).
        * ⚠️ Ela era repetida em cada cartão; numa rajada de 10 lotes isso é a frase que se
        * aprende a não ler. Aqui ela é a regra da seção, dita uma vez.
        */}
      <p className="mb-2 text-[11px]" style={{ color: 'var(--prod-muted)' }}>
        assina no teu nome · quem fez não confere a própria
      </p>
      {feito && (
        <p className="mb-2 rounded-lg px-3 py-2 text-[12.5px]"
          style={{ background: 'var(--fam-verde-bg)', color: 'var(--fam-verde-ink)' }}>{feito}</p>
      )}
      {recusa && (
        <p className="mb-2 rounded-lg px-3 py-2 text-[12.5px]"
          style={{ background: 'var(--fam-coral-bg)', color: 'var(--fam-coral-ink)' }}>{recusa}</p>
      )}

      <div className="flex flex-col gap-1.5">
        {fila.cartoes.map((c) => {
          const suspeita = c.fiscalOk === false
          const abertoAqui = editando === c.conclusaoId
          /**
           * ⭐ o DENOMINADOR que a tela mostra: com retalho é o esperado (`~`), senão é o
           * pedido. ⚠️ Os dois saem do SERVIDOR já formatados (`fmtPedido`) — um `Math.round`
           * aqui seria o 5º arredondamento do pedido nesta casa.
           */
          const refTxt = c.esperadoTxt ?? c.pedidoTxt
          const comRetalho = c.esperadoTxt != null
          return (
            <div key={c.conclusaoId}
              className="rounded-xl transition-opacity duration-150"
              style={{
                background: 'var(--prod-surface)',
                boxShadow: 'var(--prod-sombra)',
                /** ⭐ a borda coral de 3px da suspeita (ordem do dono) */
                borderLeft: suspeita ? '3px solid var(--fam-coral-mid)' : '3px solid transparent',
                opacity: saindo === c.conclusaoId ? 0 : 1,
              }}>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2">
                <LogoDaReceita nome={c.produto} tamanho={34} />
                {/* ── nome + quem · há Xh ── */}
                <div className="min-w-[150px] flex-1">
                  <p className="text-[13.5px] font-semibold leading-tight" style={{ color: 'var(--prod-primary)' }}>
                    {c.produto}
                  </p>
                  <p className="flex items-center gap-1 text-[11.5px]"
                    style={{ color: c.atrasado ? 'var(--fam-coral-ink)' : 'var(--prod-muted)' }}>
                    {/* ⚠️ sem PIN a tela NÃO inventa pessoa (a lição de 04/10) — fala do lote */}
                    {c.declaradoPor ?? 'sem PIN'}
                    <Clock className="h-3 w-3" />
                    {haQuantoTempo(c.minutosEsperando)}
                  </p>
                </div>

                {/* ── O NÚMERO GRANDE: declarou / pedido ── */}
                <p className="tabular-nums leading-none" style={{ color: 'var(--prod-primary)' }}>
                  <span className="text-[22px] font-bold">{c.declaradoTxt}</span>
                  {refTxt && (
                    <span className="text-[13px] font-medium" style={{ color: 'var(--prod-muted)' }}>
                      {' / '}{comRetalho ? '~' : ''}{refTxt}{comRetalho ? '' : ' ped.'}
                    </span>
                  )}
                </p>

                {/* ── O VEREDITO CURTO, COM NÚMERO ── */}
                <p className="rounded-lg px-2 py-1 text-[12px] font-semibold tabular-nums"
                  style={{
                    background: suspeita ? 'var(--fam-coral-bg)' : c.fiscalOk === true ? 'var(--fam-verde-bg)' : 'var(--prod-surface-1)',
                    color: suspeita ? 'var(--fam-coral-ink)' : c.fiscalOk === true ? 'var(--fam-verde-ink)' : 'var(--prod-muted)',
                  }}>
                  {/* ⚠️ "não deu pra medir" NUNCA vira acusação — a régua do próprio fiscal */}
                  {c.fiscalResumo == null ? 'sem material' : suspeita ? `⚠ ${c.fiscalResumo}` : `✓ ${c.fiscalResumo}`}
                </p>

                {/* ── OS DOIS BOTÕES DE DEDO (42px) ── */}
                <div className="ml-auto flex gap-1.5">
                  <button type="button" aria-label={`conferir ${c.produto}`}
                    disabled={carimbando === c.conclusaoId}
                    onClick={() => void carimbar(c)}
                    className="inline-flex h-[42px] w-[42px] items-center justify-center rounded-lg disabled:opacity-40"
                    style={{ background: 'var(--prod-acao-bg)', color: 'var(--prod-acao-ink)' }}>
                    <Check className="h-5 w-5" />
                  </button>
                  <button type="button" aria-label={`corrigir ${c.produto}`}
                    onClick={() => setEditando(abertoAqui ? null : c.conclusaoId)}
                    className="inline-flex h-[42px] w-[42px] items-center justify-center rounded-lg border"
                    style={{ borderColor: 'var(--prod-line-strong)', color: 'var(--prod-primary)' }}>
                    <Pencil className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/**
                * ⭐⭐ CORRIGIR INLINE — o ✏️ expande **o próprio cartão**, com o MESMO painel
                * (versão nova, rastro, delta com preview). *Só a roupa muda* (`compacto`).
                */}
              {abertoAqui && (
                <div className="px-3 pb-2">
                  <PainelDeConferencia
                    id={id}
                    alvo={{
                      conclusaoId: c.conclusaoId,
                      produto: c.produto,
                      unidade: c.unidade,
                      declarado: c.declarado,
                      declaradoTxt: c.declaradoTxt,
                    }}
                    compacto
                    onFeito={(frase) => removerDaFila(c.conclusaoId, frase)}
                    onFechar={() => setEditando(null)}
                  />
                </div>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}
