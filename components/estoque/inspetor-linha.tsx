'use client'

// ⭐⭐ O INSPETOR DA LINHA — onde o ensino acontece (31/08/2026).
//
// ⛔ O QUE ELE EXISTE PRA CONSERTAR: a tela anterior tinha DOIS blocos de inputs
// visualmente idênticos em lados opostos — configuração de um lado, dados de exemplo do
// outro — e **nada dizendo que "Rótulo" e o valor formam UMA linha da etiqueta**. O dono,
// dono do produto, olhou e concluiu que os dois lados faziam a mesma coisa. Comportamento
// certo, ensino errado.
//
// ⭐⭐ TRÊS COISAS AMARRADAS, e é isso que ensina:
//   1. a tira "COMO SAI NA ETIQUETA" mostra a linha MONTADA, com as duas partes pintadas
//      diferente — a linha aparece INTEIRA, não como dois campos;
//   2. as caixas de baixo repetem EXATAMENTE as mesmas cores: 🔒 azul = sai em toda
//      etiqueta (salvo) · 👁 âmbar tracejado = só pra ver (não é salvo);
//   3. focar um campo ACENDE a parte correspondente na etiqueta ao lado.
// O mapeamento vira literal: o pedaço azul de cima é editado na caixa azul de baixo.
//
// ⚠️ A LINHA DE TEXTO LIVRE tem só a caixa azul — o texto dela É salvo. A ausência da
// caixa âmbar ensina o contraste de graça, sem precisar de mais uma legenda.

import { Lock, Eye, Link2 } from 'lucide-react'
import { ESTADOS, type DadosEtiqueta, type EstadoConservacao, type CampoId } from '@/lib/stock/etiquetas/modelo'
import { entradasDaLinha, type EntradaPrevia } from '@/lib/stock/etiquetas/campos-previa'
import { juntarRotuloValor, type Bloco } from '@/lib/stock/etiquetas/blocos'
import type { ParteDaLinha } from './previa-etiqueta'
import { nomeDoBloco } from './camadas-etiqueta'

/** `Date` ⇄ `YYYY-MM-DDTHH:mm`, sem passar por UTC (a etiqueta é local) */
const paraInput = (d: Date | null) => {
  if (!d) return ''
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}
const deInput = (v: string): Date | null => {
  if (!v) return null
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? null : d
}

const inputCls = 'mt-0.5 block h-8 w-full rounded-md border border-slate-300 px-2 text-sm'

export function InspetorLinha({
  bloco, indice, dados, valorNaEtiqueta,
  onMexer, onMudarDados, onFoco, onIrParaLinha,
}: {
  bloco: Bloco
  indice: number
  dados: DadosEtiqueta
  /** o conteúdo que esta linha mostra hoje (já resolvido pelo layout) */
  valorNaEtiqueta: string
  onMexer: (i: number, patch: Partial<Bloco>) => void
  onMudarDados: (patch: Partial<DadosEtiqueta>) => void
  onFoco: (parte: ParteDaLinha | null) => void
  /** o QR não tem dado próprio: manda pra linha do Lote */
  onIrParaLinha: (campo: CampoId) => void
}) {
  const entradas = bloco.tipo === 'campo' ? entradasDaLinha(bloco.campo) : []
  const rotulo = (bloco.rotulo ?? '').trim()
  const conteudo = bloco.tipo === 'texto' ? (bloco.texto ?? '') : valorNaEtiqueta

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1.5">
        <h3 className="text-[13px] font-semibold text-slate-800">{nomeDoBloco(bloco)}</h3>
        {!bloco.ativo && (
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500">desligada</span>
        )}
      </div>

      {/* ── 1. A TIRA: a linha MONTADA, com as partes pintadas ── */}
      {bloco.tipo !== 'qr' && (
        <div className="rounded-lg border border-slate-200 bg-white p-2.5">
          <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-slate-400">
            Como sai na etiqueta
          </p>
          <p className="break-words text-[15px] leading-snug">
            {rotulo && (
              <>
                <span className="rounded bg-sky-100 px-1 font-semibold text-sky-900 ring-1 ring-sky-200">{rotulo}</span>
                <span> </span>
              </>
            )}
            <span className="rounded border border-dashed border-amber-300 bg-amber-50 px-1 text-amber-900">
              {conteudo || <span className="text-slate-300">(vazio)</span>}
            </span>
          </p>
          <p className="mt-1 text-[10px] text-slate-400">
            {rotulo
              ? <><b className="text-sky-700">rótulo</b> + <b className="text-amber-700">conteúdo</b> = uma linha só</>
              : <>esta linha não tem rótulo — sai só o <b className="text-amber-700">conteúdo</b></>}
          </p>
        </div>
      )}

      {/* ── 2. O QUE É SALVO ── */}
      <div className="rounded-lg border border-sky-200 bg-sky-50/60 p-2.5">
        <p className="mb-2 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-sky-800">
          <Lock className="h-3 w-3" /> Sai em toda etiqueta — é salvo
        </p>

        {bloco.tipo === 'texto' ? (
          <label className="block text-[11px] text-slate-600">Texto
            <input value={bloco.texto ?? ''} onChange={(e) => onMexer(indice, { texto: e.target.value })}
              onFocus={() => onFoco('conteudo')} onBlur={() => onFoco(null)}
              className={inputCls} />
          </label>
        ) : bloco.tipo === 'campo' ? (
          <label className="block text-[11px] text-slate-600">
            Rótulo <span className="text-slate-400">— vem antes do conteúdo</span>
            <input value={bloco.rotulo ?? ''} onChange={(e) => onMexer(indice, { rotulo: e.target.value })}
              onFocus={() => onFoco('rotulo')} onBlur={() => onFoco(null)}
              placeholder="(sem rótulo)" className={inputCls} />
          </label>
        ) : null}

        {bloco.tipo === 'qr' ? (
          <label className="block text-[11px] text-slate-600">Tamanho do QR
            <input type="range" min={3} max={8} value={bloco.qrTamanho ?? 5}
              onChange={(e) => onMexer(indice, { qrTamanho: Number(e.target.value) })}
              className="mt-1 block w-full" />
          </label>
        ) : (
          <div className="mt-2 space-y-2">
            <label className="block text-[11px] text-slate-600">
              Tamanho da fonte <span className="tabular-nums text-slate-400">{bloco.fonte}</span>
              <input type="range" min={14} max={72} value={bloco.fonte}
                onChange={(e) => onMexer(indice, { fonte: Number(e.target.value) })}
                onFocus={() => onFoco('linha')} onBlur={() => onFoco(null)}
                className="mt-1 block w-full" />
            </label>
            <div className="flex flex-wrap gap-3">
              <label className="flex items-center gap-1 text-[11px] text-slate-600">
                <input type="checkbox" checked={!!bloco.negrito}
                  onChange={(e) => onMexer(indice, { negrito: e.target.checked })} className="h-3.5 w-3.5" /> negrito
              </label>
              <label className="flex items-center gap-1 text-[11px] text-slate-600">
                <input type="checkbox" checked={!!bloco.destaque}
                  onChange={(e) => onMexer(indice, { destaque: e.target.checked })} className="h-3.5 w-3.5" /> destaque
              </label>
            </div>
          </div>
        )}
      </div>

      {/* ── 3. O QUE **NÃO** É SALVO ── */}
      {bloco.tipo === 'campo' && entradas.length > 0 && (
        <div className="rounded-lg border border-dashed border-amber-300 bg-amber-50/50 p-2.5">
          <p className="mb-2 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-amber-800">
            <Eye className="h-3 w-3" /> Só pra ver — não é salvo no modelo
          </p>
          <div className="space-y-2">
            {entradas.map((e) => (
              <CampoDePrevia key={String(e.chave)} entrada={e} dados={dados}
                onMudar={onMudarDados} onFoco={onFoco} />
            ))}
          </div>
          <p className="mt-2 text-[10px] leading-snug text-amber-800/80">
            Troque pelo produto de verdade pra ver se o nome cabe. Vale também pro
            <b> imprimir teste</b> — e some quando você recarregar a página.
          </p>
        </div>
      )}

      {/* o QR não tem dado próprio: ele carrega o LOTE */}
      {bloco.tipo === 'qr' && (
        <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-2.5 text-[11px] text-slate-600">
          <p>O QR carrega o <b>lote</b> — não tem conteúdo próprio.</p>
          <button type="button" onClick={() => onIrParaLinha('lote')}
            className="mt-1 inline-flex items-center gap-1 text-sky-700 hover:underline">
            <Link2 className="h-3 w-3" /> editar a linha do Lote
          </button>
          <p className="mt-1.5 text-slate-400">
            Fica ancorado no canto inferior direito e não entra na ordem das linhas —
            no fluxo ele comeria um quinto da etiqueta.
          </p>
        </div>
      )}
    </div>
  )
}

function CampoDePrevia({ entrada, dados, onMudar, onFoco }: {
  entrada: EntradaPrevia
  dados: DadosEtiqueta
  onMudar: (patch: Partial<DadosEtiqueta>) => void
  onFoco: (parte: ParteDaLinha | null) => void
}) {
  const foco = { onFocus: () => onFoco('conteudo'), onBlur: () => onFoco(null) }
  const bruto = dados[entrada.chave]

  return (
    <label className={`block text-[11px] text-slate-600 ${entrada.largo ? '' : 'inline-block w-[46%] align-top'}`}>
      {entrada.rotulo}
      {entrada.tipo === 'datahora' ? (
        <input type="datetime-local" value={paraInput((bruto as Date | null) ?? null)}
          onChange={(ev) => {
            const d = deInput(ev.target.value)
            // ⚠️ fabricação não aceita vazio (toda etiqueta é manipulada em algum momento);
            // validade aceita, e aí a etiqueta diz "A DEFINIR" — nunca uma data chutada.
            if (entrada.chave === 'fabricacao') onMudar({ fabricacao: d ?? (bruto as Date) })
            else onMudar({ [entrada.chave]: d } as Partial<DadosEtiqueta>)
          }}
          {...foco} className={inputCls} />
      ) : entrada.tipo === 'estado' ? (
        <select value={dados.estado} onChange={(ev) => onMudar({ estado: ev.target.value as EstadoConservacao })}
          {...foco} className={inputCls}>
          {ESTADOS.map((e) => <option key={e.id} value={e.id}>{e.label}</option>)}
        </select>
      ) : entrada.tipo === 'numero' ? (
        <input value={(bruto as number | null) ?? ''} inputMode="decimal"
          onChange={(ev) => {
            // ⚠️ texto inválido NÃO pode virar NaN: a etiqueta imprimiria "NaN UN" —
            // número inventado no pior lugar possível.
            const t = ev.target.value.replace(',', '.').trim()
            const n = Number(t)
            onMudar({ quantidade: t === '' || Number.isNaN(n) ? null : n })
          }}
          {...foco} placeholder="(vazio)" className={inputCls} />
      ) : (
        <input value={(bruto as string | null) ?? ''}
          onChange={(ev) => onMudar({ [entrada.chave]: ev.target.value } as Partial<DadosEtiqueta>)}
          {...foco} placeholder="(vazio)" className={inputCls} />
      )}
      {entrada.dica && <span className="mt-0.5 block text-[10px] text-amber-700/80">{entrada.dica}</span>}
    </label>
  )
}

/** o texto montado desta linha — a MESMA regra do layout (REGRA 4) */
export const linhaMontada = (b: Bloco, conteudo: string) => juntarRotuloValor(b.rotulo, conteudo)
