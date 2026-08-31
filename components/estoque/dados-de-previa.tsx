'use client'

// ⭐⭐ DADOS DE PRÉVIA — o que se VÊ, separado do que se SALVA (31/08/2026).
//
// ⛔ O QUE ACONTECIA: a prévia do editor usava um `EXEMPLO` fixo no código ("Porção de
// carne 100g", "Cristian", "Caçula Mix") e não havia como trocar. Quem quisesse ver como
// fica o SEU produto não tinha caminho — e, pior, o campo "Rótulo" ficava do lado da
// prévia parecendo o lugar de trocar o conteúdo. Foi exatamente o que o dono tentou: ele
// digitou "queijo" no rótulo e levou "queijoPorção de carne 100g".
//
// ⚠️ AS DUAS COISAS ESTAVAM NA MESMA TELA SEM FRONTEIRA. Agora são áreas separadas com
// papéis declarados: à esquerda a CONFIGURAÇÃO (é salva, vale pra toda etiqueta), aqui os
// DADOS DE PRÉVIA (não são salvos, servem só pra visualizar).
//
// ⚠️ E NÃO PERSISTE MESMO — nem no navegador. A tentação de guardar em localStorage é
// grande ("pra não redigitar"), mas aí um dado de teste sobreviveria à sessão e, meses
// depois, alguém abriria o editor achando que "Porção de carne" é o produto do modelo.
// Recarregou, volta ao exemplo. O botão "restaurar exemplos" cobre o meio do caminho.

import { Eye, RotateCcw } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { ESTADOS, type DadosEtiqueta, type EstadoConservacao } from '@/lib/stock/etiquetas/modelo'

/** o exemplo com que a tela abre — o mesmo de sempre, agora editável */
export function exemploDeEtiqueta(): DadosEtiqueta {
  return {
    produto: 'Porção de carne 100g',
    lote: 'A1B2C3D4',
    fabricacao: new Date(),
    validadeAte: new Date(Date.now() + 3 * 86_400_000),
    estado: 'RESFRIADO',
    quantidade: 25,
    unidade: 'UN',
    colaborador: 'Cristian',
    empresa: 'Caçula Mix',
  }
}

/** `Date` ⇄ `YYYY-MM-DDTHH:mm` do input, sem passar por UTC (a etiqueta é local) */
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

const rotuloCampo = 'text-[11px] text-slate-500'
const inputCampo = 'mt-0.5 block h-8 w-full rounded-md border border-slate-300 px-2 text-sm'

export function DadosDePrevia({ dados, onMudar, onRestaurar }: {
  dados: DadosEtiqueta
  onMudar: (patch: Partial<DadosEtiqueta>) => void
  onRestaurar: () => void
}) {
  return (
    <Card className="border-dashed border-slate-300 bg-slate-50/60">
      <CardContent className="py-3">
        <div className="mb-2 flex items-center gap-1.5">
          <Eye className="h-3.5 w-3.5 text-slate-400" />
          <h3 className="text-[13px] font-semibold text-slate-700">Dados de prévia</h3>
          <button
            onClick={onRestaurar}
            className="ml-auto inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2 py-0.5 text-[11px] text-slate-600 hover:bg-slate-50"
          >
            <RotateCcw className="h-3 w-3" /> restaurar exemplos
          </button>
        </div>

        {/* ⚠️ a frase é o contrato da área — sem ela o dono repete o erro do "queijo" */}
        <p className="mb-2.5 rounded-md bg-white px-2 py-1.5 text-[11px] leading-snug text-slate-500 ring-1 ring-slate-200">
          Serve <b>só pra visualizar</b> — <b className="text-slate-700">nada aqui é salvo no modelo</b>.
          Troque pelo produto de verdade pra ver se o nome cabe, e esvazie um campo pra ver
          a etiqueta sem ele.
        </p>

        <div className="grid gap-2 sm:grid-cols-2">
          <label className={`${rotuloCampo} sm:col-span-2`}>Nome do produto
            <input value={dados.produto} onChange={(e) => onMudar({ produto: e.target.value })}
              placeholder="(vazio — a linha some da etiqueta)" className={inputCampo} />
          </label>

          <label className={rotuloCampo}>Fabricação / manipulação
            <input type="datetime-local" value={paraInput(dados.fabricacao)}
              onChange={(e) => onMudar({ fabricacao: deInput(e.target.value) ?? dados.fabricacao })}
              className={inputCampo} />
          </label>

          <label className={rotuloCampo}>Validade
            <input type="datetime-local" value={paraInput(dados.validadeAte)}
              onChange={(e) => onMudar({ validadeAte: deInput(e.target.value) })}
              className={inputCampo} />
            {/* ⚠️ vazio aqui não é "sem linha": a etiqueta diz "A DEFINIR", que é a regra
                do módulo (data inventada numa etiqueta de alimento é obedecida). */}
            {!dados.validadeAte && <span className="text-[10px] text-amber-600">vazio → a etiqueta diz “A DEFINIR”</span>}
          </label>

          <label className={rotuloCampo}>Estado de conservação
            <select value={dados.estado} onChange={(e) => onMudar({ estado: e.target.value as EstadoConservacao })}
              className={inputCampo}>
              {ESTADOS.map((e) => <option key={e.id} value={e.id}>{e.label}</option>)}
            </select>
          </label>

          <div className="flex gap-2">
            <label className={`${rotuloCampo} flex-1`}>Quantidade
              <input value={dados.quantidade ?? ''} inputMode="decimal"
                onChange={(e) => {
                  // ⚠️ vazio = sem quantidade (a linha some). Texto inválido NÃO pode virar
                  // NaN: a etiqueta imprimiria "NaN UN" — número inventado com cara de fato.
                  const t = e.target.value.replace(',', '.').trim()
                  const n = Number(t)
                  onMudar({ quantidade: t === '' || Number.isNaN(n) ? null : n })
                }}
                placeholder="(vazio)" className={inputCampo} />
            </label>
            <label className={`${rotuloCampo} w-20`}>Unidade
              <input value={dados.unidade ?? ''} onChange={(e) => onMudar({ unidade: e.target.value })}
                className={inputCampo} />
            </label>
          </div>

          <label className={rotuloCampo}>Lote
            <input value={dados.lote} onChange={(e) => onMudar({ lote: e.target.value })}
              placeholder="(vazio)" className={inputCampo} />
          </label>

          <label className={rotuloCampo}>Quem manipulou
            <input value={dados.colaborador ?? ''} onChange={(e) => onMudar({ colaborador: e.target.value })}
              placeholder="(vazio)" className={inputCampo} />
          </label>

          <label className={rotuloCampo}>Nome da empresa
            <input value={dados.empresa ?? ''} onChange={(e) => onMudar({ empresa: e.target.value })}
              placeholder="(vazio)" className={inputCampo} />
          </label>
        </div>
      </CardContent>
    </Card>
  )
}
