// Sprint 5.0.2 — Página metodologia tributária.

import type { Metadata } from 'next'
import Link from 'next/link'
import { ChevronLeft, BookOpen, Scale, CheckCircle2, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Header } from '@/components/layout/header'

export const metadata: Metadata = { title: 'Metodologia Tributária' }

export default function MetodologiaPage() {
  return (
    <div className="space-y-6">
      <Header
        title="Metodologia Tributária"
        description="Como o CAIXAOS calcula seus impostos"
      >
        <Button asChild variant="outline" size="sm">
          <Link href="/tributario">
            <ChevronLeft className="mr-1 h-4 w-4" />
            Voltar
          </Link>
        </Button>
      </Header>

      <Card>
        <CardContent className="py-6 space-y-6 prose prose-sm max-w-none prose-zinc">
          {/* Fontes oficiais */}
          <section>
            <h3 className="text-base font-semibold flex items-center gap-2 text-zinc-900 mt-0">
              <BookOpen className="h-4 w-4" /> Fontes oficiais
            </h3>
            <ul className="text-sm text-zinc-700 space-y-1.5 list-disc pl-5">
              <li>
                <strong>LC 123/2006</strong> — Estatuto da Microempresa e EPP
                (Simples Nacional)
              </li>
              <li>
                <strong>Lei 9.249/1995 art. 15</strong> — Margens de presunção
                IRPJ (Lucro Presumido)
              </li>
              <li>
                <strong>Lei 9.430/1996</strong> — IRPJ adicional + margens CSLL
              </li>
              <li>
                <strong>Lei 12.814/2013 + LC 187/2021</strong> — Limite Lucro
                Presumido (R$ 78M)
              </li>
              <li>
                <strong>Lei 10.637/2002 + Lei 10.833/2003</strong> — PIS/COFINS
                não-cumulativo (Lucro Real)
              </li>
              <li>
                <strong>LC 87/1996</strong> — ICMS (alíquotas internas por UF)
              </li>
              <li>
                <strong>LC 116/2003</strong> — ISS (alíquota padrão 5%)
              </li>
              <li>
                <strong>Resoluções CGSN</strong> — Atualizações periódicas das
                tabelas
              </li>
            </ul>
          </section>

          {/* Versão das tabelas */}
          <section>
            <h3 className="text-base font-semibold flex items-center gap-2 text-zinc-900">
              <Scale className="h-4 w-4" /> Versão das tabelas
            </h3>
            <p className="text-sm text-zinc-700">
              Tabelas vigentes <strong>2026</strong>. Cada cálculo é gravado com
              o campo <code className="text-xs bg-zinc-100 px-1.5 py-0.5 rounded">versaoTabela</code>
              {' '}pra auditoria — quando regras mudarem, recálculos antigos preservam o
              contexto original.
            </p>
          </section>

          {/* Cálculos por regime */}
          <section>
            <h3 className="text-base font-semibold text-zinc-900">
              Cálculos por regime
            </h3>

            <div className="space-y-4 mt-3">
              <div>
                <h4 className="text-sm font-semibold text-zinc-800">
                  Simples Nacional
                </h4>
                <p className="text-sm text-zinc-700">
                  5 anexos × 6 faixas. Aplica Fator R (corte 28%) entre Anexo III
                  e V. Alíquota efetiva calculada pela fórmula oficial:
                </p>
                <pre className="text-xs bg-zinc-50 border rounded p-2 mt-1 overflow-x-auto">
                  AlíqEfetiva = ((RBA × AlíqNominal) − Deduzir) / RBA
                </pre>
              </div>

              <div>
                <h4 className="text-sm font-semibold text-zinc-800">
                  Lucro Presumido
                </h4>
                <p className="text-sm text-zinc-700">
                  Base IRPJ/CSLL via margem por atividade (8-32% conforme CNAE).
                  PIS/COFINS cumulativos (0,65% + 3%). ICMS estadual + ISS
                  municipal opcionais.
                </p>
              </div>

              <div>
                <h4 className="text-sm font-semibold text-zinc-800">
                  Lucro Real
                </h4>
                <p className="text-sm text-zinc-700">
                  Base IRPJ/CSLL = lucro real declarado (% receita). PIS/COFINS
                  não-cumulativos (1,65% + 7,6%) com desconto de créditos.
                  Exige escrituração contábil completa.
                </p>
              </div>
            </div>
          </section>

          {/* Limitações */}
          <section>
            <h3 className="text-base font-semibold flex items-center gap-2 text-zinc-900">
              <AlertCircle className="h-4 w-4 text-amber-600" />
              Limitações importantes
            </h3>
            <p className="text-sm text-zinc-700">
              Cálculos são <strong>estimativas profissionais pra orientação</strong>.
              Pra decisões fiscais definitivas:
            </p>
            <ol className="text-sm text-zinc-700 space-y-1 list-decimal pl-5 mt-2">
              <li>Valide com seu contador</li>
              <li>Considere particularidades da sua atividade</li>
              <li>Verifique regulamentações específicas (CNAE, CFOP)</li>
              <li>Acompanhe a Reforma Tributária (EC 132/2023) — IBS/CBS</li>
            </ol>
          </section>

          {/* Garantias */}
          <section>
            <h3 className="text-base font-semibold flex items-center gap-2 text-zinc-900">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              Garantias do sistema
            </h3>
            <ul className="text-sm text-zinc-700 space-y-1 list-none pl-0">
              <li>✓ Cálculos auditáveis (log completo por cálculo)</li>
              <li>✓ Versionamento de tabelas (versaoTabela)</li>
              <li>✓ Atualização contínua conforme leis</li>
              <li>✓ Engine de cálculo open source no código</li>
              <li>✓ Transparência total: cada imposto separado no breakdown</li>
            </ul>
          </section>

          {/* Quando consultar contador */}
          <section>
            <h3 className="text-base font-semibold text-zinc-900">
              Quando consultar um contador
            </h3>
            <p className="text-sm text-zinc-700">Sempre que:</p>
            <ul className="text-sm text-zinc-700 space-y-1 list-disc pl-5">
              <li>Mudar de regime tributário</li>
              <li>Pagar DAS / impostos efetivamente</li>
              <li>Receber notificação fiscal</li>
              <li>Planejar reorganização societária</li>
              <li>Ter dúvidas sobre interpretação legal</li>
            </ul>
          </section>

          {/* Disclaimer legal */}
          <section className="border-t pt-4 mt-6">
            <p className="text-xs text-zinc-500 italic">
              CAIXAOS é uma ferramenta de gestão e análise financeira. Não substitui
              orientação contábil profissional. O cliente é responsável por validar
              cálculos antes de uso fiscal definitivo. Os valores oficiais do DAS,
              DARF e demais tributos são sempre os do sistema da Receita Federal
              (gov.br/receitafederal).
            </p>
          </section>
        </CardContent>
      </Card>
    </div>
  )
}
