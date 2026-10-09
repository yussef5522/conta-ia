'use client'

/**
 * ⭐⭐⭐ O PAINEL DE CONFERIR/CORRIGIR — UM COMPONENTE, TRÊS ROUPAS (09/10/2026).
 *
 * **Ordem do dono (item 3, 09/10):** *"a mesma «corrigir com preview» se aplica a uma conclusão
 * PASSADA, aberta da página da ordem — eu decidindo na tela, caso a caso. Nada em lote."*
 * **E na reforma do placar (Parte 2):** *"o ✏️ expande o próprio cartão — campo numérico grande
 * + motivo em chips + [Salvar] — mesmo fluxo/porta de correção já provado, só a roupa muda."*
 *
 * ⛔⛔ **"SÓ A ROUPA MUDA" É LITERAL: existe UM formulário com um `compacto`.** Escrever um
 * segundo form pro cartão daria **duas telas de correção** — e elas divergiriam no primeiro
 * motivo novo, no primeiro ajuste de prévia, no primeiro texto. É a lição do B1 em forma de
 * formulário, e é exatamente o que a extração deste arquivo evitou de manhã.
 *
 * ⛔⛔⛔ **O CAMPO DE PIN MORREU AQUI (correção do dono, 09/10).** Na estreia ele pedia o PIN da
 * conta do gerente — e **Yussef, marcyelle e cristian não têm PIN, nem devem ter**: PIN é
 * identidade de COLABORADOR no tablet compartilhado, onde não existe login. O carimbo assina
 * pela SESSÃO. ⚠️ E o campo não ficou opcional: o schema da rota é `.strict()`, então mandar
 * `pin` dá **400** — *PIN opcional voltaria na primeira tela copiada*.
 *
 * ⚠️ **E ele não decide NADA sobre permissão.** Quem pode conferir é o servidor (`stock.manage`
 * + sessão pessoal + a regra dos quatro olhos); este arquivo só desenha.
 */
import { useState } from 'react'
import { CheckCheck, X } from 'lucide-react'
import {
  MOTIVOS_DA_TELA, type MotivoDaTela,
  confirmarNaRota, corrigirNaRota, preverNaRota,
} from './gesto-de-conferencia'

export { MOTIVOS_DA_TELA }
export type { MotivoDaTela }

export interface AlvoDaConferencia {
  conclusaoId: string
  produto: string
  unidade: string
  declarado: number
  declaradoTxt: string
}

export function PainelDeConferencia({
  id,
  alvo,
  modoInicial = 'CONFIRMAR',
  /**
   * ⭐ `somenteCorrigir` existe pra a página da ordem: lá o gesto nasce de *"este número está
   * errado"*. ⚠️ **E o CONFIRMAR não é escondido por capricho** — na ordem o dono chega pela
   * linha da conclusão, não pela fila do dia; oferecer *"está certo"* ali competiria com a
   * Conferência do dia, que é a casa daquele gesto.
   */
  somenteCorrigir = false,
  /**
   * ⭐⭐ `compacto` é a ROUPA do cartão-placar (Parte 2): sem as abas, sem a linha da
   * assinatura (ela virou UMA linha no cabeçalho da fila — *"nunca por cartão"*, ordem do
   * dono), campo grande e [Salvar].
   *
   * ⛔ **O que NÃO muda com ele:** a porta, a prévia, os motivos, o rastro e a recusa. Se
   * mudasse, o `compacto` seria um segundo formulário com outro nome.
   */
  compacto = false,
  onFeito,
  onFechar,
}: {
  id: string
  alvo: AlvoDaConferencia
  modoInicial?: 'CONFIRMAR' | 'CORRIGIR'
  somenteCorrigir?: boolean
  compacto?: boolean
  onFeito: (frase: string) => void
  onFechar: () => void
}) {
  const [modo, setModo] = useState<'CONFIRMAR' | 'CORRIGIR'>(somenteCorrigir || compacto ? 'CORRIGIR' : modoInicial)
  const [qtd, setQtd] = useState(modo === 'CORRIGIR' ? String(alvo.declarado) : '')
  const [motivo, setMotivo] = useState<MotivoDaTela>('CONTOU_ERRADO')
  const [obs, setObs] = useState('')
  const [previa, setPrevia] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [recusa, setRecusa] = useState<string | null>(null)

  /** ⭐ A PRÉVIA ANTES DE GRAVAR (ordem do dono) — e ela sai do MESMO motor que vai executar */
  async function prever() {
    const n = Number(qtd.replace(',', '.'))
    if (!(n > 0)) { setPrevia(null); return }
    const r = await preverNaRota(id, {
      conclusaoId: alvo.conclusaoId, qtdCerta: n, produto: alvo.produto, unidade: alvo.unidade,
    })
    if (!r.ok) { setPrevia(null); setRecusa(r.erro ?? 'não consegui prever'); return }
    setRecusa(null)
    setPrevia(r.frase ?? null)
  }

  async function enviar() {
    setEnviando(true); setRecusa(null)
    /** ⛔ o corpo é montado no módulo único (`gesto-de-conferencia`) — a rota é `.strict()` */
    const r = modo === 'CONFIRMAR'
      ? await confirmarNaRota(id, alvo.conclusaoId)
      : await corrigirNaRota(id, {
          conclusaoId: alvo.conclusaoId,
          qtdCerta: Number(qtd.replace(',', '.')),
          motivo,
          observacao: obs,
        })
    setEnviando(false)
    if (!r.ok) { setRecusa(r.erro ?? 'não consegui gravar'); return }
    onFeito(`✓✓ ${modo === 'CONFIRMAR' ? 'conferido' : 'corrigido e conferido'} por ${r.conferidoPorNome}`)
  }

  const qtdValida = Number(qtd.replace(',', '.')) > 0

  return (
    <div className={compacto ? 'mt-2 border-t pt-2' : 'mt-3 border-t pt-3'} style={{ borderColor: 'var(--prod-line)' }}>
      {/**
        * ⚠️ No compacto não existe aba: o ✓ do cartão já é o "está certo", e repetir a escolha
        * aqui daria DOIS caminhos pro mesmo gesto dentro do mesmo cartão.
        */}
      {!compacto && (
        <div className="mb-2 flex gap-2">
          {!somenteCorrigir
            ? (['CONFIRMAR', 'CORRIGIR'] as const).map((m) => (
                <button key={m} type="button"
                  onClick={() => { setModo(m); setRecusa(null); if (m === 'CORRIGIR' && !qtd) setQtd(String(alvo.declarado)) }}
                  className="rounded-lg px-2.5 py-1 text-[12px]"
                  style={modo === m
                    ? { background: 'var(--fam-indigo-bg)', color: 'var(--fam-indigo-ink)', fontWeight: 600 }
                    : { color: 'var(--prod-muted)' }}>
                  {m === 'CONFIRMAR' ? `está certo: ${alvo.declaradoTxt} ${alvo.unidade}` : 'o número está errado'}
                </button>
              ))
            : (
              <p className="text-[12px]" style={{ color: 'var(--prod-muted)' }}>
                declarado: <span className="tabular-nums">{alvo.declaradoTxt} {alvo.unidade}</span>
              </p>
            )}
          <button type="button" onClick={onFechar} className="ml-auto" aria-label="fechar">
            <X className="h-4 w-4" style={{ color: 'var(--prod-muted)' }} />
          </button>
        </div>
      )}

      {modo === 'CORRIGIR' && (
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-[11.5px]" style={{ color: 'var(--prod-muted)' }}>
            quantas saíram de verdade
            {/**
              * ⭐ No compacto o campo é GRANDE (ordem do dono: *"campo numérico grande"*) — é a
              * pergunta do cartão, e no celular o dedo digita nele.
              */}
            <input value={qtd} onChange={(e) => { setQtd(e.target.value); setPrevia(null) }}
              onBlur={() => void prever()} inputMode="decimal"
              className={`mt-0.5 block rounded-lg border px-2 tabular-nums ${compacto ? 'h-[42px] w-32 text-[20px] font-semibold' : 'h-9 w-28 text-[15px]'}`}
              style={{ borderColor: 'var(--prod-line-strong)', color: 'var(--prod-primary)', background: 'var(--prod-bg)' }} />
          </label>
          <div className="text-[11.5px]" style={{ color: 'var(--prod-muted)' }}>
            por quê
            <div className="mt-0.5 flex flex-wrap gap-1.5">
              {MOTIVOS_DA_TELA.map((m) => (
                <button key={m.chave} type="button" onClick={() => setMotivo(m.chave)}
                  className="rounded-lg px-2.5 py-1.5 text-[12px]"
                  style={motivo === m.chave
                    ? { background: 'var(--fam-indigo-bg)', color: 'var(--fam-indigo-ink)', fontWeight: 600 }
                    : { border: '1px solid var(--prod-line)', color: 'var(--prod-secondary)' }}>
                  {m.rotulo}
                </button>
              ))}
            </div>
          </div>
          {/* ⛔ «outro» sem texto seria "corrigi porque quis" — o servidor recusa, e a tela pede antes */}
          {motivo === 'OUTRO' && (
            <label className="text-[11.5px]" style={{ color: 'var(--prod-muted)' }}>
              o que houve
              <input value={obs} onChange={(e) => setObs(e.target.value)}
                className="mt-0.5 block h-9 w-56 rounded-lg border px-2 text-[13px]"
                style={{ borderColor: 'var(--prod-line-strong)', color: 'var(--prod-primary)', background: 'var(--prod-bg)' }} />
            </label>
          )}
        </div>
      )}

      {modo === 'CORRIGIR' && previa && (
        <p className="mt-2 rounded-lg px-2.5 py-1.5 text-[12px]"
          style={{ background: 'var(--prod-surface-1)', color: 'var(--prod-secondary)' }}>{previa}</p>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-3">
        <button type="button" disabled={enviando || (modo === 'CORRIGIR' && !qtdValida)}
          onClick={() => void enviar()}
          className={`inline-flex items-center gap-1.5 rounded-lg px-3 text-[12.5px] font-semibold disabled:opacity-40 ${compacto ? 'h-[42px]' : 'h-9'}`}
          style={{ background: 'var(--prod-acao-bg)', color: 'var(--prod-acao-ink)' }}>
          <CheckCheck className="h-4 w-4" />
          {enviando ? 'gravando…' : compacto ? 'Salvar' : modo === 'CONFIRMAR' ? 'Conferir' : 'Corrigir e conferir'}
        </button>
        {/**
          * ⛔⛔ **A LINHA DA ASSINATURA NÃO VEM NO COMPACTO** — ela virou **UMA** linha miúda no
          * cabeçalho da fila (*"nunca por cartão"*, ordem do dono). Repetir por cartão numa
          * rajada de 10 lotes é a frase que se aprende a não ler.
          */}
        {!compacto && (
          <p className="text-[11.5px]" style={{ color: 'var(--prod-muted)' }}>
            você assina com o seu login — e quem declarou não confere a própria produção
          </p>
        )}
        {compacto && (
          <button type="button" onClick={onFechar} className="text-[12px] underline" style={{ color: 'var(--prod-muted)' }}>
            {/* ⚠️ fechar RECOLHE sem salvar — ordem do dono */}
            fechar
          </button>
        )}
      </div>

      {recusa && (
        <p className="mt-2 rounded-lg px-2.5 py-1.5 text-[12px]"
          style={{ background: 'var(--fam-coral-bg)', color: 'var(--fam-coral-ink)' }}>{recusa}</p>
      )}
    </div>
  )
}
