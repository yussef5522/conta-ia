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
//
// ⚠️⚠️ A PRÉVIA FALHAVA DIFERENTE DA IMPRESSORA (31/08/2026) — e isso é pior que não
// avisar. Linha normal VAZAVA pra fora da borda da etiqueta; linha em destaque cortava com
// "…"; e a Zebra faz uma terceira coisa: **corta seco** na borda, porque o ZPL usa `^FD`
// sem `^FB` e a impressora NÃO quebra linha. Com o dado de exemplo curto ninguém via.
// Agora a caixa tem `overflow-hidden` (a impressora também não imprime fora da etiqueta) e
// a linha que pode cortar é marcada — o dono vê o problema ANTES de colar no pacote.

import { previaDosBlocos, type Bloco } from '@/lib/stock/etiquetas/blocos'
import type { DadosEtiqueta } from '@/lib/stock/etiquetas/modelo'

export function PreviaEtiqueta({ dados, blocos, lado = 260, semLegenda }: {
  dados: DadosEtiqueta
  blocos: Bloco[]
  /** lado em px na tela (a etiqueta real é 60×60 mm) */
  lado?: number
  semLegenda?: boolean
}) {
  const { campos, estourou, podeCortar } = previaDosBlocos(blocos, dados)
  const px = (pct: number) => (pct / 100) * lado

  return (
    <div className="inline-block">
      <div
        className={`relative overflow-hidden bg-white shadow-sm ${estourou || podeCortar ? 'border-2 border-rose-400' : 'border border-slate-300'}`}
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
                {c.podeCortar && <span className="ml-auto shrink-0 pl-1 text-[9px] font-normal text-rose-300">✂</span>}
              </div>
            )
          }
          return (
            <div key={c.id}
              className={`absolute whitespace-nowrap text-slate-900 ${c.negrito ? 'font-bold' : 'font-medium'} ${
                c.podeCortar ? 'border-b border-dashed border-rose-400' : ''
              }`}
              style={{ left: px(c.esquerda), top: px(c.topo), fontSize: tamanho, lineHeight: 1 }}>
              {c.texto}
            </div>
          )
        })}
      </div>
      {!semLegenda && (
        <div className="mt-1 max-w-full text-center">
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
