// Sprint 5.0.3.0a — 3 empty states distintos pra /contas-a-pagar.
//
//   zerada       → empresa sem nenhuma conta (CTA grande: import Excel)
//   filtroVazio  → empresa tem contas mas filtro atual não bate (botão limpar)
//   buscaVazia   → query textual sem match (mostra termo + sugestão)

import Link from 'next/link'
import { FileSpreadsheet, CheckCircle2, Search, Upload, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

interface ZeradaProps {
  kind: 'zerada'
  empresaId: string
}

interface FiltroVazioProps {
  kind: 'filtroVazio'
  onClearFilters: () => void
}

interface BuscaVaziaProps {
  kind: 'buscaVazia'
  query: string
  onClearQuery: () => void
}

type Props = ZeradaProps | FiltroVazioProps | BuscaVaziaProps

export function PayableEmptyState(props: Props) {
  switch (props.kind) {
    case 'zerada':
      return (
        <Card data-testid="empty-zerada">
          <CardContent className="py-12 text-center">
            <FileSpreadsheet
              className="mx-auto mb-3 text-primary/40"
              style={{ width: 60, height: 60 }}
            />
            <h3 className="text-lg font-medium text-foreground mb-1">
              Comece importando a planilha do seu contador
            </h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto mb-5">
              A IA cadastra fornecedores, funcionários e categorias
              automaticamente — você só revisa e confirma.
            </p>
            <div className="flex flex-col items-center gap-2">
              <Button asChild>
                <Link
                  href={`/empresas/${props.empresaId}/contas-pagar/import`}
                >
                  <Upload className="mr-1.5 h-3.5 w-3.5" />
                  Importar planilha Excel
                </Link>
              </Button>
              <Link
                href={`/contas-a-pagar/nova?empresaId=${props.empresaId}`}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                ou cadastrar conta manualmente
              </Link>
            </div>
          </CardContent>
        </Card>
      )

    case 'filtroVazio':
      return (
        <Card data-testid="empty-filtro">
          <CardContent className="py-12 text-center text-muted-foreground">
            <CheckCircle2 className="h-10 w-10 mx-auto mb-2 text-emerald-600" />
            <p className="text-sm mb-3">Nenhuma conta no filtro atual.</p>
            <Button variant="outline" size="sm" onClick={props.onClearFilters}>
              <X className="mr-1.5 h-3.5 w-3.5" />
              Limpar filtros
            </Button>
          </CardContent>
        </Card>
      )

    case 'buscaVazia':
      return (
        <Card data-testid="empty-busca">
          <CardContent className="py-12 text-center text-muted-foreground">
            <Search className="h-10 w-10 mx-auto mb-2 text-muted-foreground/40" />
            <p className="text-sm mb-1">
              Nenhuma conta encontrada para{' '}
              <strong className="text-foreground">
                &quot;{props.query}&quot;
              </strong>
            </p>
            <p className="text-xs mb-3">
              Tente outro termo ou verifique a grafia.
            </p>
            <Button variant="outline" size="sm" onClick={props.onClearQuery}>
              <X className="mr-1.5 h-3.5 w-3.5" />
              Limpar busca
            </Button>
          </CardContent>
        </Card>
      )
  }
}
