'use client'

// ⭐ AS CAMADAS — uma linha de 28px por campo, as 9 cabem sem rolagem.
//
// ⚠️ Substitui os 9 cards empilhados de configuração. O card antigo trazia TODOS os
// controles de TODAS as linhas ao mesmo tempo: pra chegar no QR o dono rolava por 8
// blocos de inputs. Aqui a lista só liga/desliga e ordena; o resto vive no inspetor da
// linha selecionada.
//
// ⚠️⚠️ ARRASTAR **E** SETAS, NOS DOIS (regra do dono, 31/08): ter arrastar só no desktop
// e setas só no celular seria dois comportamentos pra a mesma decisão — o "N caminhos, 1
// esquecido" que já mordeu este sistema mais de cinco vezes. Os dois gestos chamam a
// MESMA `moverBloco`. E como as setas são botões de verdade, o teclado vem de brinde.
//
// ⚠️ O arrastar do HTML5 não funciona em touch — por isso as setas não são "a versão
// mobile", são o caminho que funciona em todo lugar.

import { useState } from 'react'
import { ChevronUp, ChevronDown, GripVertical, Trash2, Plus, Type } from 'lucide-react'
import type { Bloco } from '@/lib/stock/etiquetas/blocos'

const NOME_BLOCO: Record<string, string> = {
  produto: 'Nome do produto', validade: 'Validade', estado: 'Estado',
  fabricacao: 'Fabricação', quantidade: 'Quantidade', lote: 'Lote',
  colaborador: 'Quem manipulou', empresa: 'Nome da empresa',
}

export const nomeDoBloco = (b: Bloco) =>
  b.tipo === 'qr' ? 'QR do lote'
    : b.tipo === 'texto' ? (b.texto?.trim() || 'Texto livre')
      : NOME_BLOCO[b.campo ?? ''] ?? b.campo ?? '—'

export function CamadasEtiqueta({
  blocos, selecionadoId, onSelecionar, onAlternarAtivo, onMover, onRemover, onAdicionarTexto,
}: {
  blocos: Bloco[]
  selecionadoId: string | null
  onSelecionar: (id: string) => void
  onAlternarAtivo: (i: number, ativo: boolean) => void
  onMover: (de: number, para: number) => void
  onRemover: (i: number) => void
  onAdicionarTexto: () => void
}) {
  const [arrastando, setArrastando] = useState<number | null>(null)
  const [alvo, setAlvo] = useState<number | null>(null)

  return (
    <div>
      <p className="mb-1.5 px-1 text-[11px] font-medium uppercase tracking-wide text-slate-400">
        Linhas da etiqueta
      </p>

      <ul className="space-y-px">
        {blocos.map((b, i) => {
          const sel = selecionadoId === b.id
          return (
            <li
              key={b.id}
              draggable
              onDragStart={() => setArrastando(i)}
              onDragOver={(e) => { e.preventDefault(); setAlvo(i) }}
              onDragEnd={() => { setArrastando(null); setAlvo(null) }}
              onDrop={(e) => {
                e.preventDefault()
                if (arrastando !== null) onMover(arrastando, i)
                setArrastando(null); setAlvo(null)
              }}
              className={`flex h-7 items-center gap-1 rounded-md pl-0.5 pr-0.5 text-[12px] ${
                sel ? 'bg-sky-50 ring-1 ring-sky-300' : 'hover:bg-slate-50'
              } ${alvo === i && arrastando !== null && arrastando !== i ? 'ring-1 ring-dashed ring-sky-400' : ''} ${
                arrastando === i ? 'opacity-40' : ''
              }`}
            >
              <GripVertical className="h-3.5 w-3.5 shrink-0 cursor-grab text-slate-300" aria-hidden />

              <input
                type="checkbox"
                checked={b.ativo}
                onChange={(e) => onAlternarAtivo(i, e.target.checked)}
                aria-label={`${b.ativo ? 'desligar' : 'ligar'} ${nomeDoBloco(b)}`}
                className="h-3.5 w-3.5 shrink-0"
              />

              <button
                type="button"
                onClick={() => onSelecionar(b.id)}
                className={`min-w-0 flex-1 truncate text-left ${b.ativo ? 'text-slate-700' : 'text-slate-400 line-through decoration-slate-300'}`}
              >
                {b.tipo === 'texto' && <Type className="mr-1 inline h-3 w-3 text-slate-400" />}
                {nomeDoBloco(b)}
              </button>

              {/* ⚠️ setas SEMPRE presentes — no desktop e no celular, mesma lista */}
              <button type="button" onClick={() => onMover(i, i - 1)} disabled={i === 0}
                aria-label={`mover ${nomeDoBloco(b)} pra cima`}
                className="shrink-0 rounded p-0.5 text-slate-400 hover:bg-slate-200 disabled:opacity-20">
                <ChevronUp className="h-3.5 w-3.5" />
              </button>
              <button type="button" onClick={() => onMover(i, i + 1)} disabled={i === blocos.length - 1}
                aria-label={`mover ${nomeDoBloco(b)} pra baixo`}
                className="shrink-0 rounded p-0.5 text-slate-400 hover:bg-slate-200 disabled:opacity-20">
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
              {b.tipo === 'texto' && (
                <button type="button" onClick={() => onRemover(i)}
                  aria-label={`remover ${nomeDoBloco(b)}`}
                  className="shrink-0 rounded p-0.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </li>
          )
        })}
      </ul>

      <button type="button" onClick={onAdicionarTexto}
        className="mt-2 inline-flex h-7 w-full items-center justify-center gap-1 rounded-md border border-dashed border-slate-300 text-[11px] text-slate-500 hover:bg-slate-50">
        <Plus className="h-3 w-3" /> linha de texto livre
      </button>
      <p className="mt-1 px-1 text-[10px] leading-snug text-slate-400">
        ex: “Mantenha congelado”, telefone, CNPJ. Arraste ou use ↑↓ pra ordenar.
      </p>
    </div>
  )
}
