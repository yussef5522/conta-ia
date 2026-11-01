'use client'

// ESTOQUE — nova ficha técnica.
//
// ⚠️ ESTA PÁGINA É A PORTA DE TRÊS MUNDOS (prateleira de complementos, Vendas, Produção) e
// por isso ela NÃO decide nada: quem chama passa `?voltar=` e ela repassa. Enquanto o
// destino era fixo, salvar um sabor pela prateleira jogava o dono na lista MISTA — o gesto
// que ele ia repetir ~50 vezes numa tarde.

import { use } from 'react'
import { ArrowLeft } from 'lucide-react'
import { FichaEditor } from '@/components/estoque/ficha-editor'
import { destinoDeVolta, rotulosDaFicha, nomesDeComplementoDaUrl } from '@/lib/stock/producao/voltar-ficha'
import { ehTipoDeFicha } from '@/lib/stock/tipos-ficha'

export default function NovaFichaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const qp = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null
  // ⭐ O MESMO leitor do editor (REGRA 4): se esta página lesse `complemento` na mão, o
  // alias `mapearComplemento` daria vínculo no editor e destino/rótulo ERRADOS aqui —
  // a mesma decisão respondida em dois lugares, que é a doença que esta casa mais paga.
  const nomesDoPdv = nomesDeComplementoDaUrl(qp)
  const origem = { voltar: qp?.get('voltar'), complemento: nomesDoPdv[0] ?? null, tipo: qp?.get('tipo') }
  const voltar = destinoDeVolta(id, origem)
  const { titulo, voltarTexto } = rotulosDaFicha(origem)
  const tipo = origem.tipo && ehTipoDeFicha(origem.tipo) ? origem.tipo : undefined

  return (
    <div className="mx-auto max-w-3xl space-y-5 p-4 sm:p-6">
      <a href={voltar} className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700">
        <ArrowLeft className="h-3.5 w-3.5" /> {voltarTexto}
      </a>
      <h1 className="text-xl font-semibold text-slate-900">{titulo}</h1>
      <FichaEditor companyId={id} voltarPara={voltar} tipoTravado={tipo} />
    </div>
  )
}
