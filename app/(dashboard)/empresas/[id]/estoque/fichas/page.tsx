'use client'

// ⭐⭐ PLACA DE FICHAS — esta rota deixou de LISTAR (03/09/2026).
//
// ⛔ O QUE ELA ERA: uma lista MISTA (produto vendido + receita de cozinha + sabor) com um
// aviso azul confessando a mistura. Com ~50 fichas de sabor a caminho, viraria lixão — e o
// dono caía nela **depois de salvar cada sabor**, por causa do destino fixo do editor.
//
// ⛔ E NÃO VIROU `redirect` SECO: aqui chegam DOIS PAPÉIS (o dono, que quer o cardápio; a
// cozinha, que quer as receitas). Redirect escolheria por quem chega e mandaria metade das
// visitas pro lugar errado. A placa responde "onde fica o quê" em um toque.
//
// ⚠️ AS ROTAS FILHAS CONTINUAM VIVAS: `/fichas/nova` e `/fichas/[id]` são as portas que as
// outras telas usam. Só a LISTA morreu.

import { use } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { ClipboardList, Settings, ChevronRight } from 'lucide-react'
import { destinosDaPlaca } from '@/lib/stock/producao/voltar-ficha'

export default function FichasPlacaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex flex-wrap items-center gap-2.5">
        <ClipboardList className="h-5 w-5 shrink-0 text-[#185FA5]" />
        <h1 className="text-base font-semibold text-slate-900">Fichas técnicas</h1>
        <p className="hidden flex-1 truncate text-xs text-slate-400 lg:block">
          cada mundo tem a sua casa — escolha por onde entrar
        </p>
        <a href={`/empresas/${id}/estoque/producao/cadastros`}
          className="ml-auto inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-slate-300 px-2.5 text-xs text-slate-600 hover:bg-slate-50">
          <Settings className="h-3.5 w-3.5" /> Setores e colaboradores
        </a>
      </div>

      <div className="space-y-2">
        {destinosDaPlaca(id).map((d) => (
          <a key={d.chave} href={d.href} className="block">
            <Card className="transition hover:border-[#185FA5] hover:shadow-sm"><CardContent className="flex items-center gap-3 p-4">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-900">{d.titulo}</p>
                <p className="text-xs text-slate-500">{d.explica}</p>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" />
            </CardContent></Card>
          </a>
        ))}
      </div>

      <p className="text-[11px] text-slate-400">
        Esta tela não lista fichas de propósito: a lista misturava os três mundos e ficava
        ilegível conforme o cardápio crescia.
      </p>
    </div>
  )
}
