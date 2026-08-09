// Sprint Tela Contraparte (31/07/2026) — enriquece o nome do favorecido/pagador
// dos PIX em transações JÁ IMPORTADAS, a partir do PDF do extrato. O PDF SÓ
// preenche nome/documento — nunca cria/altera valor, data, categoria ou saldo.
//
// Sprint PDF-no-Import (09/08/2026): o miolo virou <EnrichContrapartePanel>
// (reusado inline no import de OFX). Esta tela continua servindo o HISTÓRICO —
// subir PDFs de meses passados, mês a mês, em tx já importadas. NÃO regride.

'use client'

import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Header } from '@/components/layout/header'
import { EnrichContrapartePanel } from '@/components/counterparty/EnrichContrapartePanel'

export default function EnriquecerContrapartePage() {
  const params = useParams<{ id: string; contaId: string }>()
  const router = useRouter()
  return (
    <div className="space-y-6">
      <Header
        title="Enriquecer contraparte (PDF)"
        description="O extrato OFX não traz o nome de quem recebeu/enviou os PIX. O PDF do mesmo período preenche os nomes — sem mexer em valor, data, categoria ou saldo. Pode rodar mês a mês pra completar o histórico."
      >
        <Link
          href={`/empresas/${params.id}/contas/${params.contaId}/transacoes`}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Voltar
        </Link>
      </Header>

      <EnrichContrapartePanel
        contaId={params.contaId}
        doneLabel="Ver transações"
        onDone={() =>
          router.push(`/empresas/${params.id}/contas/${params.contaId}/transacoes`)
        }
      />
    </div>
  )
}
