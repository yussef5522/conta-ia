'use client'

// ⭐⭐ A PRÉVIA DA ETIQUETA EM TAMANHO REAL (30/08/2026).
//
// ⚠️ ESTE COMPONENTE NÃO DECIDE NADA sobre o layout — ele DESENHA o que `previaDosBlocos`
// devolve, que é a MESMA função de layout que alimenta o ZPL. Por isso a prévia do EDITOR,
// a prévia da tela de IMPRIMIR e o que sai da ZEBRA são a mesma coisa nos três lugares.
// Se ele tivesse a própria lista de campos, divergiria na primeira mudança — e o erro só
// apareceria com a etiqueta já colada no pacote, dentro da câmara.
//
// As posições vêm em % do lado (480 dots), então a prévia é fiel em qualquer tamanho de
// tela: no celular do Cristian ou num monitor.

import { previaDosBlocos, type Bloco } from '@/lib/stock/etiquetas/blocos'
import type { DadosEtiqueta } from '@/lib/stock/etiquetas/modelo'

export function PreviaEtiqueta({ dados, blocos, lado = 260, semLegenda }: {
  dados: DadosEtiqueta
  blocos: Bloco[]
  /** lado em px na tela (a etiqueta real é 60×60 mm) */
  lado?: number
  semLegenda?: boolean
}) {
  const { campos, estourou } = previaDosBlocos(blocos, dados)
  const px = (pct: number) => (pct / 100) * lado

  return (
    <div className="inline-block">
      <div
        className={`relative bg-white shadow-sm ${estourou ? 'border-2 border-rose-400' : 'border border-slate-300'}`}
        style={{ width: lado, height: lado }}
        aria-label="prévia da etiqueta em tamanho real"
      >
        {campos.map((c) => {
          if (c.tipo === 'qr') {
            // ⚠️ o QR real é gerado PELA IMPRESSORA (^BQN). Aqui é a marca de onde ele fica
            // e quanto ocupa — desenhar um QR "de mentira" sugeriria que o conteúdo dele
            // foi conferido na tela, e não foi.
            return (
              <div key={c.id}
                className="absolute flex items-center justify-center border border-dashed border-slate-400 bg-slate-50 text-[8px] text-slate-400"
                style={{ left: px(c.esquerda), top: px(c.topo), width: px(c.alturaPct), height: px(c.alturaPct) }}>
                QR
              </div>
            )
          }
          const tamanho = px(c.fontePct)
          if (c.destaque) {
            return (
              <div key={c.id}
                className="absolute flex items-center bg-slate-900 px-1 font-bold text-white"
                style={{
                  left: px(c.esquerda) - px(1.6), top: px(c.topo) - px(1.4),
                  height: px(c.alturaPct), fontSize: tamanho, lineHeight: 1,
                  width: lado - px(c.esquerda) - px(2.5),
                }}>
                <span className="truncate">{c.texto}</span>
              </div>
            )
          }
          return (
            <div key={c.id}
              className={`absolute whitespace-nowrap text-slate-900 ${c.negrito ? 'font-bold' : 'font-medium'}`}
              style={{ left: px(c.esquerda), top: px(c.topo), fontSize: tamanho, lineHeight: 1 }}>
              {c.texto}
            </div>
          )
        })}
      </div>
      {!semLegenda && (
        <p className={`mt-1 text-center text-[10px] ${estourou ? 'text-rose-600' : 'text-slate-400'}`}>
          {estourou ? '⚠️ não cabe em 60 × 60 mm — tire uma linha ou diminua a fonte' : '60 × 60 mm — como sai na Zebra'}
        </p>
      )}
    </div>
  )
}
