'use client'

/**
 * ⭐⭐⭐ O PAINEL DE CONFERIR/CORRIGIR — UM COMPONENTE, DOIS LUGARES (09/10/2026, item 3).
 *
 * **Ordem do dono:** *"a mesma «corrigir com preview» se aplica a uma conclusão PASSADA, aberta
 * da página da ordem — é o caminho pra eu finalmente corrigir as 2 ordens de 22.864 e o 320% da
 * NATHALIA, caso a caso, eu decidindo na tela. Nada de correção em lote."*
 *
 * ⛔⛔ **ELE NASCEU DE UMA EXTRAÇÃO, NÃO DE UMA CÓPIA.** O painel vivia dentro da
 * «Conferência do dia»; a página da ordem precisava do MESMO gesto. Reescrever os campos lá
 * daria **duas telas de correção** — e elas divergiriam no primeiro motivo novo, no primeiro
 * ajuste de prévia, no primeiro texto do PIN. É a lição do B1 em forma de formulário: quando N
 * telas precisam da MESMA decisão, a decisão vira componente.
 *
 * ⚠️ **E ele não decide NADA sobre permissão.** Quem pode conferir é o servidor (`stock.manage`
 * + sessão pessoal + a regra dos quatro olhos); este arquivo só desenha. Esconder aqui seria
 * combinado; a trava é a rota — e ela recusa com o motivo escrito.
 *
 * ⛔⛔⛔ **O CAMPO DE PIN MORREU AQUI (correção do dono, 09/10).** Na estreia ele pedia o PIN da
 * conta do gerente — e **Yussef, marcyelle e cristian não têm PIN, nem devem ter**: PIN é
 * identidade de COLABORADOR no tablet compartilhado, onde não existe login. O carimbo assina
 * pela SESSÃO. ⚠️ E o campo não ficou opcional: o schema da rota é `.strict()`, então mandar
 * `pin` dá **400** — *PIN opcional voltaria na primeira tela copiada*.
 */
import { useState } from 'react'
import { CheckCheck, X } from 'lucide-react'
import { fetchComTimeout } from '@/lib/http/fetch-com-timeout'

export const MOTIVOS_DA_TELA = [
  { chave: 'CONTOU_ERRADO', rotulo: 'contou errado' },
  { chave: 'DIGITOU_ERRADO', rotulo: 'digitou errado' },
  { chave: 'OUTRO', rotulo: 'outro' },
] as const

export type MotivoDaTela = (typeof MOTIVOS_DA_TELA)[number]['chave']

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
  onFeito,
  onFechar,
}: {
  id: string
  alvo: AlvoDaConferencia
  modoInicial?: 'CONFIRMAR' | 'CORRIGIR'
  somenteCorrigir?: boolean
  onFeito: (frase: string) => void
  onFechar: () => void
}) {
  const [modo, setModo] = useState<'CONFIRMAR' | 'CORRIGIR'>(somenteCorrigir ? 'CORRIGIR' : modoInicial)
  const [qtd, setQtd] = useState(modo === 'CORRIGIR' ? String(alvo.declarado) : '')
  const [motivo, setMotivo] = useState<MotivoDaTela>('CONTOU_ERRADO')
  const [obs, setObs] = useState('')
  const [previa, setPrevia] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [recusa, setRecusa] = useState<string | null>(null)

  const rota = `/api/empresas/${id}/estoque/producao/conferencia`

  /** ⭐ A PRÉVIA ANTES DE GRAVAR (ordem do dono) — e ela sai do MESMO motor que vai executar */
  async function prever() {
    const n = Number(qtd.replace(',', '.'))
    if (!(n > 0)) { setPrevia(null); return }
    const r = await fetchComTimeout<{
      modo: string
      preview?: { saldoAntes: number; saldoDepois: number }
      porque?: string
    }>(rota, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ acao: 'PREVER_CORRECAO', conclusaoId: alvo.conclusaoId, qtdCerta: n }),
    })
    if (!r.ok || !r.data) { setPrevia(null); setRecusa(r.erro ?? 'não consegui prever'); return }
    setRecusa(null)
    const d = r.data
    setPrevia(
      d.modo === 'ESTORNA_E_RELANCA' && d.preview
        ? `o estoque de «${alvo.produto}» vai de ${d.preview.saldoAntes} pra ${d.preview.saldoDepois} ${alvo.unidade}`
        : `o estoque NÃO se mexe — ${d.porque ?? 'só a conclusão é corrigida'}`,
    )
  }

  async function enviar() {
    setEnviando(true); setRecusa(null)
    const corpo = modo === 'CONFIRMAR'
      ? { acao: 'CONFIRMAR', conclusaoId: alvo.conclusaoId }
      : {
          acao: 'CORRIGIR',
          conclusaoId: alvo.conclusaoId,
          qtdCerta: Number(qtd.replace(',', '.')),
          motivo,
          observacao: obs || undefined,
        }
    const r = await fetchComTimeout<{ conferidoPorNome: string }>(rota, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(corpo),
      /** ⚠️ teto de GRAVAÇÃO maior que o de leitura (14/09): a correção mexe no ledger */
      timeoutMs: 60_000,
    })
    setEnviando(false)
    if (!r.ok || !r.data) { setRecusa(r.erro ?? 'não consegui gravar'); return }
    onFeito(`✓✓ ${modo === 'CONFIRMAR' ? 'conferido' : 'corrigido e conferido'} por ${r.data.conferidoPorNome}`)
  }

  const qtdValida = Number(qtd.replace(',', '.')) > 0

  return (
    <div className="mt-3 border-t pt-3" style={{ borderColor: 'var(--prod-line)' }}>
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

      {modo === 'CORRIGIR' && (
        <div className="mb-2 flex flex-wrap items-end gap-3">
          <label className="text-[11.5px]" style={{ color: 'var(--prod-muted)' }}>
            quantas saíram de verdade
            <input value={qtd} onChange={(e) => { setQtd(e.target.value); setPrevia(null) }}
              onBlur={() => void prever()} inputMode="decimal"
              className="mt-0.5 block h-9 w-28 rounded-lg border px-2 text-[15px] tabular-nums"
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
        <p className="mb-2 rounded-lg px-2.5 py-1.5 text-[12px]"
          style={{ background: 'var(--prod-surface-1)', color: 'var(--prod-secondary)' }}>{previa}</p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" disabled={enviando || (modo === 'CORRIGIR' && !qtdValida)}
          onClick={() => void enviar()}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-[12.5px] font-semibold disabled:opacity-40"
          style={{ background: 'var(--prod-acao-bg)', color: 'var(--prod-acao-ink)' }}>
          <CheckCheck className="h-4 w-4" />
          {enviando ? 'gravando…' : modo === 'CONFIRMAR' ? 'Conferir' : 'Corrigir e conferir'}
        </button>
        {/**
          * ⚠️ A RAZÃO FICA ESCRITA, como ficava a do PIN: o gerente tem que saber que o gesto
          * é assinado — é o nome dele que vai pro selo e pro rastro, e é por isso que ele não
          * pode carimbar a produção que ele mesmo lançou.
          */}
        <p className="text-[11.5px]" style={{ color: 'var(--prod-muted)' }}>
          você assina com o seu login — e quem declarou não confere a própria produção
        </p>
      </div>

      {recusa && (
        <p className="mt-2 rounded-lg px-2.5 py-1.5 text-[12px]"
          style={{ background: 'var(--fam-coral-bg)', color: 'var(--fam-coral-ink)' }}>{recusa}</p>
      )}
    </div>
  )
}
