'use client'

// ⭐⭐ PLACA — esta tela foi APOSENTADA em 04/09/2026 (decisão do dono).
//
// ⛔ O QUE ELA ERA: uma fila de aprovação — o estoque conferia a nota, as parcelas ficavam
// aqui esperando o dono marcar e enviar pro financeiro. Palavras dele ao aposentar:
// ***"quando eu confirmo a nota, eu JÁ aprovei — me pedir de novo em outra tela é aprovar
// duas vezes."***
//
// ⭐ O FLUXO DE HOJE é um gesto só: **Recebimento → confiro a nota → digito a data do boleto
// (ou deixo A DEFINIR) → confirmo → a conta nasce no financeiro**. Boleto enviado mora no
// Contas a Pagar; nota sem data aparece como "sem data — defina" e vai direto quando o dono
// definir. Não há mais estado intermediário pra esta tela mostrar.
//
// ⚠️ DECISÃO REGISTRADA (a razão original da fila era permissão): a fila só volta **se os
// papéis se separarem** — o dia em que a operadora conferir notas. E a resposta certa lá
// será *"a conferência dela não confirma a parte financeira"*, não uma fila que faz o dono
// aprovar tudo duas vezes.
//
// ⚠️ A ROTA CONTINUA VIVA porque link antigo não pode quebrar: ela vira placa com o caminho.

import { use } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Receipt, ChevronRight, PackageOpen } from 'lucide-react'

export default function BoletosPlacaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex flex-wrap items-center gap-2.5">
        <Receipt className="h-5 w-5 shrink-0 text-[#185FA5]" />
        <h1 className="text-base font-semibold text-slate-900">Boletos pro Contas a Pagar</h1>
      </div>

      <Card><CardContent className="space-y-3 p-4">
        <p className="text-sm text-slate-700">
          Esta fila não existe mais. Hoje o boleto vira conta a pagar <b>no mesmo gesto</b> em que
          você confirma a conferência da nota — sem segunda aprovação.
        </p>
        <div className="space-y-2">
          <a href={`/empresas/${id}/contas-a-pagar`} className="block">
            <Card className="transition hover:border-[#185FA5] hover:shadow-sm"><CardContent className="flex items-center gap-3 p-3.5">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-900">Contas a Pagar (financeiro)</p>
                <p className="text-xs text-slate-500">é onde o boleto enviado vive — vencimento, pagamento, conciliação</p>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" />
            </CardContent></Card>
          </a>
          <a href={`/empresas/${id}/estoque/recebimentos`} className="block">
            <Card className="transition hover:border-[#185FA5] hover:shadow-sm"><CardContent className="flex items-center gap-3 p-3.5">
              <PackageOpen className="h-4 w-4 shrink-0 text-slate-400" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-900">Recebimentos</p>
                <p className="text-xs text-slate-500">conferir nota, informar o vencimento do boleto e definir as que ficaram sem data</p>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" />
            </CardContent></Card>
          </a>
        </div>
      </CardContent></Card>
    </div>
  )
}
