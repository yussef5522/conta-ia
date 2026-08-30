'use client'

// ⭐⭐ A PRÉVIA DA ETIQUETA EM TAMANHO REAL (30/08/2026).
//
// ⚠️ ESTE COMPONENTE NÃO DECIDE NADA sobre o layout — ele DESENHA o que
// `camposParaPrevia` devolve, que é a MESMA função que alimenta o ZPL. Se ele tivesse a
// própria lista de campos (mesmo "igualzinha"), divergiria na primeira mudança e a prévia
// passaria a mentir sobre o que sai da Zebra. Um layout, dois renderizadores.
//
// As posições vêm em % do lado da etiqueta, então a prévia é FIEL em qualquer tamanho —
// no celular do Cristian ou num monitor.

import { camposParaPrevia, MODELO_PADRAO, type DadosEtiqueta, type CampoId, type CampoLayout } from '@/lib/stock/etiquetas/modelo'

export function PreviaEtiqueta({ dados, layout = MODELO_PADRAO, desligados = [], lado = 260 }: {
  dados: DadosEtiqueta
  layout?: CampoLayout[]
  desligados?: CampoId[]
  /** lado em px na tela (a etiqueta real é 60×60 mm) */
  lado?: number
}) {
  const campos = camposParaPrevia(dados, layout, desligados)
  return (
    <div className="inline-block">
      <div
        className="relative border border-slate-300 bg-white shadow-sm"
        style={{ width: lado, height: lado }}
        aria-label="prévia da etiqueta em tamanho real"
      >
        {campos.map((c) => {
          const px = (pct: number) => (pct / 100) * lado
          if (c.tipo === 'qr') {
            // ⚠️ o QR real é gerado PELA IMPRESSORA (^BQN) — aqui é só a marca de onde ele
            // fica e quanto ocupa. Desenhar um QR "de mentira" na prévia sugeriria que o
            // conteúdo dele foi conferido; ele não foi (quem o gera é a Zebra).
            return (
              <div key={c.id}
                className="absolute flex items-center justify-center border border-dashed border-slate-400 bg-slate-50 text-[8px] text-slate-400"
                style={{ left: px(c.esquerda), top: px(c.topo), width: px(c.qrPct), height: px(c.qrPct) }}>
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
                  height: tamanho * 1.35, fontSize: tamanho, lineHeight: 1,
                  width: lado - px(c.esquerda) - px(2.5),
                }}>
                {c.texto}
              </div>
            )
          }
          return (
            <div key={c.id} className="absolute whitespace-nowrap font-semibold text-slate-900"
              style={{ left: px(c.esquerda), top: px(c.topo), fontSize: tamanho, lineHeight: 1 }}>
              {c.texto}
            </div>
          )
        })}
      </div>
      <p className="mt-1 text-center text-[10px] text-slate-400">60 × 60 mm — como sai na Zebra</p>
    </div>
  )
}
