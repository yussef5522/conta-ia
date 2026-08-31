'use client'

// ⭐⭐ A ETIQUETA EM TAMANHO REAL — E, NO EDITOR, O ELEMENTO QUE SE EDITA (31/08/2026).
//
// ⚠️ ESTE COMPONENTE NÃO DECIDE NADA sobre o layout — ele DESENHA o que `previaDosBlocos`
// devolve, que é a MESMA função de layout que alimenta o ZPL. Por isso a prévia do EDITOR,
// a prévia da tela de IMPRIMIR e o que sai da ZEBRA são a mesma coisa nos três lugares.
// Se ele tivesse a própria lista de campos, divergiria na primeira mudança — e o erro só
// apareceria com a etiqueta já colada no pacote, dentro da câmara.
//
// ⚠️⚠️ A INTERAÇÃO ENTROU AQUI, e NÃO num "canvas editável" novo, exatamente por isso: um
// segundo renderizador faria o que se EDITA divergir do que se IMPRIME na primeira mudança
// de layout. Sem `onSelecionar`, este componente é o mesmo de sempre — a tela
// `/estoque/etiquetas` não mudou em nada.
//
// As posições vêm em % do lado (480 dots), então a prévia é fiel em qualquer tamanho de
// tela: no celular do Cristian ou num monitor.
//
// ⚠️ A PRÉVIA FALHA COMO A IMPRESSORA FALHA (31/08): linha comprida NÃO quebra — a Zebra
// corta (`^FD` sem `^FB`). Antes a linha normal VAZAVA pra fora da borda e a linha em
// destaque cortava com "…", que são duas maneiras que a impressora não usa. Daí o
// `overflow-hidden` e a marca na linha que pode cortar.

import { previaDosBlocos, type Bloco } from '@/lib/stock/etiquetas/blocos'
import type { DadosEtiqueta } from '@/lib/stock/etiquetas/modelo'

/** que pedaço da linha o dono clicou — leva o cursor pro campo certo do inspetor */
export type ParteDaLinha = 'rotulo' | 'conteudo' | 'linha'

export function PreviaEtiqueta({
  dados, blocos, lado = 260, semLegenda,
  selecionadoId, onSelecionar, realce,
}: {
  dados: DadosEtiqueta
  blocos: Bloco[]
  /** lado em px na tela (a etiqueta real é 60×60 mm) */
  lado?: number
  semLegenda?: boolean
  /** ── modo editor (opcional): sem isto, o componente é só leitura ── */
  selecionadoId?: string | null
  onSelecionar?: (id: string, parte: ParteDaLinha) => void
  /** acende a parte correspondente quando o foco está no campo do inspetor */
  realce?: { id: string; parte: ParteDaLinha } | null
}) {
  const { campos, estourou, podeCortar } = previaDosBlocos(blocos, dados)
  const px = (pct: number) => (pct / 100) * lado
  const editavel = typeof onSelecionar === 'function'

  const aceso = (id: string, parte: ParteDaLinha) =>
    realce?.id === id && (realce.parte === parte || realce.parte === 'linha')

  return (
    <div className="inline-block">
      <div
        className={`relative overflow-hidden bg-white shadow-sm ${
          estourou || podeCortar ? 'border-2 border-rose-400' : 'border border-slate-300'
        }`}
        style={{ width: lado, height: lado }}
        aria-label="prévia da etiqueta em tamanho real"
      >
        {/* ⭐ FAIXA DE CLIQUE DA LARGURA INTEIRA (pedido do dono): clicar no vazio à
            direita de "25 UN" seleciona a linha da Quantidade. O alvo é a FAIXA, não o
            glifo — texto de 20 dots dá ~12px, que é alvo ruim no dedo. Fica ATRÁS do
            texto (z-0) pra o clique por PARTE continuar funcionando por cima. */}
        {editavel && campos.filter((c) => c.tipo !== 'qr').map((c) => (
          <button
            key={`faixa-${c.id}`}
            type="button"
            onClick={() => onSelecionar!(c.id, 'linha')}
            aria-label={`selecionar a linha: ${c.texto}`}
            className={`absolute left-0 z-0 w-full transition-colors ${
              selecionadoId === c.id ? 'bg-sky-100/70' : 'hover:bg-slate-100/70'
            }`}
            style={{ top: px(c.topoPct) - px(1), height: px(c.alturaPct) + px(2) }}
          />
        ))}

        {campos.map((c) => {
          if (c.tipo === 'qr') {
            // ⚠️ o QR real é gerado PELA IMPRESSORA (^BQN). Aqui é a marca de onde ele fica
            // e quanto ocupa — desenhar um QR "de mentira" sugeriria que o conteúdo dele
            // foi conferido na tela, e não foi.
            return (
              <button key={c.id} type="button" disabled={!editavel}
                onClick={() => onSelecionar?.(c.id, 'linha')}
                className={`absolute z-10 flex items-center justify-center border border-dashed bg-slate-50 text-[8px] text-slate-400 ${
                  selecionadoId === c.id ? 'border-sky-500 ring-2 ring-sky-300' : 'border-slate-400'
                } ${editavel ? 'cursor-pointer hover:border-sky-400' : ''}`}
                style={{ left: px(c.esquerda), top: px(c.topo), width: px(c.alturaPct), height: px(c.alturaPct) }}>
                QR
              </button>
            )
          }

          const tamanho = px(c.fontePct)
          // ⭐⭐ AS DUAS PARTES DESENHADAS SEPARADAS — é o que faz "VAL" e "03/09/2026"
          // serem clicáveis uma de cada vez, e é o ENSINO que faltava: elas aparecem como
          // pedaços de UMA linha, não como dois campos em lados opostos da tela.
          // São `<span>` inline no MESMO bloco → a posição do texto não muda em nada.
          const partes = (
            <>
              {c.partes.rotulo && (
                <>
                  <span
                    onClick={editavel ? (e) => { e.stopPropagation(); onSelecionar!(c.id, 'rotulo') } : undefined}
                    className={`${editavel ? 'cursor-pointer' : ''} ${aceso(c.id, 'rotulo') ? 'rounded-sm bg-sky-300/70' : ''}`}
                  >{c.partes.rotulo}</span>
                  {' '}
                </>
              )}
              <span
                onClick={editavel ? (e) => { e.stopPropagation(); onSelecionar!(c.id, 'conteudo') } : undefined}
                className={`${editavel ? 'cursor-pointer' : ''} ${aceso(c.id, 'conteudo') ? 'rounded-sm bg-amber-300/70' : ''}`}
              >{c.partes.conteudo}</span>
            </>
          )

          if (c.destaque) {
            return (
              <div key={c.id}
                onClick={editavel ? () => onSelecionar!(c.id, 'linha') : undefined}
                className={`absolute z-10 flex items-center bg-slate-900 px-1 font-bold text-white ${editavel ? 'cursor-pointer' : ''}`}
                style={{
                  left: px(c.esquerda) - px(1.6), top: px(c.topo) - px(1.4),
                  height: px(c.alturaPct), fontSize: tamanho, lineHeight: 1,
                  width: lado - px(c.esquerda) - px(2.5),
                }}>
                <span className="truncate">{partes}</span>
                {c.podeCortar && <span className="ml-auto shrink-0 pl-1 text-[9px] font-normal text-rose-300">✂</span>}
              </div>
            )
          }
          return (
            <div key={c.id}
              onClick={editavel ? () => onSelecionar!(c.id, 'linha') : undefined}
              className={`absolute z-10 whitespace-nowrap text-slate-900 ${c.negrito ? 'font-bold' : 'font-medium'} ${
                c.podeCortar ? 'border-b border-dashed border-rose-400' : ''
              } ${editavel ? 'cursor-pointer' : ''}`}
              style={{ left: px(c.esquerda), top: px(c.topo), fontSize: tamanho, lineHeight: 1 }}>
              {partes}
            </div>
          )
        })}
      </div>

      {!semLegenda && (
        <div className="mt-1 text-center" style={{ width: lado }}>
          {estourou && (
            <p className="text-[10px] text-rose-600">⚠️ não cabe na ALTURA de 60 × 60 mm — tire uma linha ou diminua a fonte</p>
          )}
          {/* ⚠️ "PODE cortar", nunca "corta": a razão largura/altura da fonte do ZPL ainda
              não foi medida contra a Zebra física (`LARGURA_CALIBRADA`). Afirmar seria
              inventar número com cara de fato — e alarme falso repetido mata o alarme. */}
          {podeCortar && (
            <p className="text-[10px] text-rose-600">
              ⚠️ a linha marcada <b>pode sair cortada</b> na largura — a Zebra corta, não quebra linha.
              Diminua a fonte ou encurte o rótulo.
            </p>
          )}
          {!estourou && !podeCortar && (
            <p className="text-[10px] text-slate-400">60 × 60 mm — como sai na Zebra</p>
          )}
        </div>
      )}
    </div>
  )
}
