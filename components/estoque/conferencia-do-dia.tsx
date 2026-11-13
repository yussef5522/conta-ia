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
 * ⭐ REGRA 12 — **uma composição, dois viewports**: a grade da lei v9 (LOTE · FEZ/PED. ·
 * VEREDITO) vira 2ª linha com rótulo no celular (CSS do painel, `data-r`). **O gerente confere
 * do CELULAR, com o login dele.** As classes `pp-*` vêm do CSS da página do painel.
 */
import { useCallback, useEffect, useState } from 'react'
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
  /** ⭐ (lei v9) o ⓘ da seção — a prosa mora nele */
  const [info, setInfo] = useState(false)

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
      <section className="pp-painel pp-aviso">
        Não consegui carregar a conferência do dia — {erro}{' '}
        <button type="button" onClick={() => void carregar()} className="underline">tentar de novo</button>
      </section>
    )
  }
  /** ⛔ some quando não há nada aguardando: móvel zerado treina o dono a não olhar */
  if (!fila || fila.aguardando === 0) return null

  return (
    /** ⭐ a ÂNCORA do aviso do sininho (item 2d): `#conferencia-do-dia` cai aqui. */
    <section id="conferencia-do-dia" className="pp-painel scroll-mt-20">
      {/**
        * ⭐⭐ (lei v9 M7.b) A PROSA SAIU DA TELA — "assina no teu nome · quem fez não confere a
        * própria" mora no ⓘ, junto da regra dos dois botões e de que TAREFA não entra aqui.
        */}
      <h3>
        Conferência do dia <span className="pp-pill coral">{fila.aguardando} aguardando</span>
        {/* ⚠️ o atraso vai NOMEADO, nunca só como cor — cor sozinha não diz o degrau */}
        {fila.atrasados > 0 && <> <span className="pp-pill ambar">{fila.atrasados} parada{fila.atrasados > 1 ? 's' : ''} há mais de 3h</span></>}
        <button type="button" className="pp-i" aria-label="como funciona a conferência" aria-expanded={info}
          onClick={() => setInfo((v) => !v)}>i</button>
        {info && <span className="pp-pop" data-testid="conferencia-info">assina no teu nome · quem fez não confere a própria · ✓ confere com um toque · ✎ corrige pedindo o número certo e o motivo · tarefa não entra aqui: não tem número a conferir</span>}
      </h3>
      {feito && <span className="pp-pill verde pp-msg">{feito}</span>}
      {recusa && <span className="pp-pill coral pp-msg">{recusa}</span>}

      <div className="pp-head c4"><span>LOTE</span><span className="r">FEZ / PED.</span><span className="r">VEREDITO</span><span /></div>
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
          <div key={c.conclusaoId} className="pp-bloco" style={{ opacity: saindo === c.conclusaoId ? 0 : 1, transition: 'opacity 150ms' }}>
            <div className="pp-row c4">
              <span className="pp-nm">{c.produto}
                {/* ⚠️ sem PIN a tela NÃO inventa pessoa (a lição de 04/10) — fala do lote */}
                <span className={`pp-sub2${c.atrasado ? ' at' : ''}`}>{c.declaradoPor ?? 'sem PIN'} · {haQuantoTempo(c.minutosEsperando)}</span>
              </span>
              <span className="pp-num" data-r="fez / ped.">{c.declaradoTxt}{refTxt && <i> / {comRetalho ? '~' : ''}{refTxt}</i>}</span>
              {/* ⚠️ "não deu pra medir" NUNCA vira acusação — a régua do próprio fiscal */}
              <span className="pp-vered" data-r="veredito">
                {c.fiscalResumo == null
                  ? <span className="pp-pill mut2">sem material</span>
                  : <span className={`pp-pill ${suspeita ? 'ambar' : 'verde'}`}>{suspeita ? `⚠ ${c.fiscalResumo}` : `✓ ${c.fiscalResumo}`}</span>}
              </span>
              <span className="pp-acoes">
                <button type="button" className="pp-ok" aria-label={`conferir ${c.produto}`}
                  disabled={carimbando === c.conclusaoId} onClick={() => void carimbar(c)}>✓</button>
                <button type="button" className="pp-ed" aria-label={`corrigir ${c.produto}`}
                  onClick={() => setEditando(abertoAqui ? null : c.conclusaoId)}>✎</button>
              </span>
            </div>
            {/**
              * ⭐⭐ CORRIGIR INLINE — o ✎ expande **a própria linha**, com o MESMO painel
              * (versão nova, rastro, delta com preview). *Só a roupa muda* (`compacto`).
              */}
            {abertoAqui && (
              <div className="pb-2">
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
    </section>
  )
}
