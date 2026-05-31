// Sprint Landing Page (30/05/2026) — Termos de Uso (placeholder).
// Texto inicial pra estar no ar. Yussef deve revisar com advogado antes
// de divulgar comercialmente.

import type { Metadata } from 'next'
import { LandingHeader } from '@/components/landing/header'
import { LandingFooter } from '@/components/landing/footer'

export const metadata: Metadata = {
  title: 'Termos de Uso',
  description: 'Termos de Uso do CAIXAOS.',
}

export default function TermosPage() {
  return (
    <main className="min-h-screen bg-white text-slate-900 antialiased">
      <LandingHeader />

      <article className="mx-auto max-w-3xl px-5 sm:px-8 pt-32 pb-20 prose-styles">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-violet-600">
          Legal
        </p>
        <h1 className="mt-3 text-4xl sm:text-5xl font-semibold tracking-[-0.02em] text-slate-900">
          Termos de Uso
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          Última atualização: maio de 2026
        </p>

        <div className="mt-10 space-y-8 text-[15px] leading-relaxed text-slate-700">
          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-3">
              1. Aceitação
            </h2>
            <p>
              Ao criar uma conta no CAIXAOS, você concorda com estes Termos de
              Uso e com a nossa Política de Privacidade. Se não concordar com
              qualquer parte, não utilize o serviço.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-3">
              2. Sobre o serviço
            </h2>
            <p>
              O CAIXAOS é uma plataforma de gestão financeira para PMEs
              brasileiras que oferece importação de extratos, categorização
              automática por IA, relatórios gerenciais (DRE, Fluxo de Caixa,
              Comparativo) e funcionalidades complementares conforme o plano
              contratado.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-3">
              3. Conta e responsabilidades do usuário
            </h2>
            <p>
              Você é responsável por manter a confidencialidade da sua senha e
              por todas as atividades realizadas na sua conta. Você concorda
              em fornecer informações verdadeiras e atualizadas. O CAIXAOS pode
              suspender ou encerrar contas que violem estes termos.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-3">
              4. Planos, cobrança e cancelamento
            </h2>
            <p>
              Os preços e funcionalidades de cada plano estão descritos na
              página de Planos. O período de teste gratuito não exige cartão de
              crédito. Após esse período, a cobrança só ocorre mediante
              assinatura ativa. O cancelamento pode ser feito a qualquer
              momento; a cobrança cessa ao fim do ciclo vigente.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-3">
              5. Propriedade dos dados
            </h2>
            <p>
              Você é dono dos dados que carrega no CAIXAOS. Garantimos
              ferramentas de exportação (CSV, PDF) por toda a vigência do
              contrato e por até 30 dias após o cancelamento.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-3">
              6. Limitação de responsabilidade
            </h2>
            <p>
              O CAIXAOS é uma ferramenta de apoio à gestão. Não substitui
              contador, advogado ou consultor. Decisões financeiras e fiscais
              tomadas com base nos relatórios são de responsabilidade
              exclusiva do usuário.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-3">
              7. Alterações
            </h2>
            <p>
              Estes termos podem ser atualizados periodicamente. Mudanças
              materiais serão comunicadas por e-mail com pelo menos 15 dias de
              antecedência.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-3">
              8. Contato
            </h2>
            <p>
              Dúvidas sobre estes termos:{' '}
              <a
                href="mailto:contato@caixaos.com.br"
                className="text-violet-700 hover:text-violet-900 underline underline-offset-2"
              >
                contato@caixaos.com.br
              </a>
            </p>
          </section>
        </div>
      </article>

      <LandingFooter />
    </main>
  )
}
