'use client'

/**
 * ⭐⭐⭐ "CONFERÊNCIA DO DIA" — A SEÇÃO DO GERENTE (09/10/2026, item 2 do dono).
 *
 * ⛔⛔⛔ **O GATE É DO PAYLOAD, NÃO DESTE COMPONENTE.** A rota exige `stock.manage`; quem não
 * tem **não recebe a fila**, e aí este componente não desenha nada por não ter dado. Esconder
 * só aqui deixaria o **veredito do fiscal** viajando no JSON até o tablet da cozinha — e a lei
 * de 05/10 (*"nenhum número esperado na tela de quem declara — é cola de prova"*) estaria a um
 * DevTools de distância.
 *
 * ⚠️ E o fetch só sai **depois** de as permissões carregarem: `pode()` devolve `true` enquanto
 * carrega, e disparar antes queimaria um 403 por carregamento de página no tablet — a cicatriz
 * do badge que levava 1.391 403/dia (28/09).
 *
 * ⭐ REGRA 12 — uma composição, dois viewports: os cartões empilham com `flex-wrap` e o
 * Confirmar cabe no polegar. **O gerente confere do CELULAR, com o login dele.**
 */
import { useCallback, useEffect, useState } from 'react'
import { CheckCheck, Clock, Pencil, ShieldCheck, TriangleAlert, X } from 'lucide-react'
import { LogoDaReceita } from './logo-da-receita'
import { PainelDeConferencia } from './painel-de-conferencia'
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
  fiscalFrase: string | null
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
  const [aberto, setAberto] = useState<string | null>(null)
  /**
   * ⭐ Só o que é DESTA seção sobra aqui: qual cartão está aberto e em que aba ele abriu.
   * ⛔ O resto (PIN, número, motivo, prévia, recusa) mudou de casa pro `PainelDeConferencia`
   * junto com o formulário — deixar o estado órfão aqui seria o rastro que alguém religa.
   */
  const [modo, setModo] = useState<'CONFIRMAR' | 'CORRIGIR'>('CONFIRMAR')
  const [feito, setFeito] = useState<string | null>(null)

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

  function fechar() {
    setAberto(null); setModo('CONFIRMAR')
  }

  return (
    /** ⭐ a ÂNCORA do aviso do sininho (item 2d): `#conferencia-do-dia` cai aqui.
     *  ⚠️ Sem ela o aviso levaria pra a home e o gerente teria que PROCURAR a seção —
     *  é a lição do Bamberg (13/09): perder no caminho a informação que o sistema
     *  acabou de dar é obrigar o dono a caçar de novo. */
    <section id="conferencia-do-dia" className="mb-5 scroll-mt-20">
      <div className="mb-2 flex items-center gap-2">
        <ShieldCheck className="h-4 w-4" style={{ color: 'var(--fam-indigo-mid)' }} />
        <h2 className="text-[13px] font-semibold uppercase tracking-wide" style={{ color: 'var(--prod-primary)' }}>
          Conferência do dia
        </h2>
        <span className="rounded-full px-2 py-0.5 text-[11.5px] font-bold"
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
      {feito && (
        <p className="mb-2 rounded-lg px-3 py-2 text-[12.5px]"
          style={{ background: 'var(--fam-verde-bg)', color: 'var(--fam-verde-ink)' }}>{feito}</p>
      )}

      <div className="flex flex-col gap-2">
        {fila.cartoes.map((c) => {
          const abertoAqui = aberto === c.conclusaoId
          return (
            <div key={c.conclusaoId} className="rounded-xl p-3"
              style={{ background: 'var(--prod-surface)', boxShadow: 'var(--prod-sombra)' }}>
              <div className="flex flex-wrap items-start gap-3">
                <LogoDaReceita nome={c.produto} tamanho={38} />
                <div className="min-w-[180px] flex-1">
                  <p className="text-[14px] font-semibold" style={{ color: 'var(--prod-primary)' }}>{c.produto}</p>
                  <p className="text-[12.5px]" style={{ color: 'var(--prod-secondary)' }}>
                    {/* ⚠️ sem PIN a tela NÃO inventa pessoa (a lição de 04/10) — fala do lote */}
                    {c.declaradoPor ? `${c.declaradoPor} declarou` : 'Foram declaradas'}{' '}
                    <strong className="tabular-nums">{c.declaradoTxt} {c.unidade}</strong>
                    {c.pedidoTxt && (
                      <> · pedido <span className="tabular-nums">{c.pedidoTxt} {c.unidade}</span>
                        {c.origemDoPedido === 'DERIVADO' && <span style={{ color: 'var(--prod-muted)' }}> (pela ficha)</span>}
                      </>
                    )}
                  </p>
                  <p className="mt-0.5 flex items-center gap-1 text-[11.5px]"
                    style={{ color: c.atrasado ? 'var(--fam-coral-ink)' : 'var(--prod-muted)' }}>
                    <Clock className="h-3 w-3" />
                    {new Date(c.declaradoEm).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    {' · '}{haQuantoTempo(c.minutosEsperando)}
                  </p>
                </div>

                {/* ⭐⭐ O FISCAL FALA SÓ AQUI — na tela de quem DECLARA ele continua calado */}
                <div className="min-w-[200px] flex-1 rounded-lg p-2 text-[12px]"
                  style={{
                    background: c.fiscalOk === false ? 'var(--fam-coral-bg)' : c.fiscalOk === true ? 'var(--fam-verde-bg)' : 'var(--prod-surface-1)',
                    color: c.fiscalOk === false ? 'var(--fam-coral-ink)' : c.fiscalOk === true ? 'var(--fam-verde-ink)' : 'var(--prod-muted)',
                  }}>
                  {c.fiscalOk === true && <p className="font-semibold">material confere ✓</p>}
                  {c.fiscalOk === false && (
                    <p className="flex items-start gap-1 font-semibold">
                      <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" /> saiu mais do que o material dava
                    </p>
                  )}
                  {/* ⚠️ "não deu pra medir" NUNCA vira acusação — a régua do próprio fiscal */}
                  {c.fiscalOk === null && <p>sem material com dose declarada — não dá pra fiscalizar este lote</p>}
                  {c.fiscalFrase && <p className="mt-0.5">{c.fiscalFrase}</p>}
                </div>

                {!abertoAqui && (
                  <div className="flex gap-2">
                    <button type="button" onClick={() => { setAberto(c.conclusaoId); setModo('CONFIRMAR') }}
                      className="inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-[12.5px] font-semibold"
                      style={{ background: 'var(--prod-acao-bg)', color: 'var(--prod-acao-ink)' }}>
                      <CheckCheck className="h-4 w-4" /> Confirmar
                    </button>
                    <button type="button" /** ⚠️ o número vem pré-preenchido DENTRO do painel (ele conhece o `declarado`) — pré-preencher
                       *  daqui exigiria um 2º estado espelhando o dele, que é como os dois divergem */
                      onClick={() => { setAberto(c.conclusaoId); setModo('CORRIGIR') }}
                      className="inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-[12.5px]"
                      style={{ borderColor: 'var(--prod-line-strong)', color: 'var(--prod-primary)' }}>
                      <Pencil className="h-4 w-4" /> Corrigir
                    </button>
                  </div>
                )}
              </div>

              {abertoAqui && (
                /**
                 * ⭐⭐ O PAINEL É O MESMO DA PÁGINA DA ORDEM (item 3) — extraído, não copiado.
                 * Dois formulários de correção divergiriam no 1º motivo novo, e aí a mesma
                 * conclusão teria duas telas dizendo coisas diferentes sobre o mesmo gesto.
                 */
                <PainelDeConferencia
                  id={id}
                  alvo={{
                    conclusaoId: c.conclusaoId,
                    produto: c.produto,
                    unidade: c.unidade,
                    declarado: c.declarado,
                    declaradoTxt: c.declaradoTxt,
                  }}
                  modoInicial={modo}
                  onFeito={(frase) => { setFeito(frase); fechar(); void carregar(); onMudou?.() }}
                  onFechar={fechar}
                />
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}
