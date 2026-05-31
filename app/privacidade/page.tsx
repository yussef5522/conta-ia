// Sprint Landing Page (30/05/2026) — Política de Privacidade (placeholder).
// Yussef deve revisar/adequar conforme LGPD com apoio jurídico antes do
// lançamento comercial.

import type { Metadata } from 'next'
import { LandingHeader } from '@/components/landing/header'
import { LandingFooter } from '@/components/landing/footer'

export const metadata: Metadata = {
  title: 'Política de Privacidade',
  description: 'Como o CAIXAOS coleta, usa e protege seus dados.',
}

export default function PrivacidadePage() {
  return (
    <main className="min-h-screen bg-white text-slate-900 antialiased">
      <LandingHeader />

      <article className="mx-auto max-w-3xl px-5 sm:px-8 pt-32 pb-20">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-violet-600">
          Legal · LGPD
        </p>
        <h1 className="mt-3 text-4xl sm:text-5xl font-semibold tracking-[-0.02em] text-slate-900">
          Política de Privacidade
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          Última atualização: maio de 2026
        </p>

        <div className="mt-10 space-y-8 text-[15px] leading-relaxed text-slate-700">
          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-3">
              1. Quem somos
            </h2>
            <p>
              O CAIXAOS é uma plataforma brasileira de gestão financeira para
              pequenas e médias empresas. Tratamos dados pessoais e
              empresariais conforme a Lei Geral de Proteção de Dados (LGPD —
              Lei 13.709/2018).
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-3">
              2. Que dados coletamos
            </h2>
            <ul className="list-disc list-outside ml-5 space-y-2">
              <li>
                <strong>Cadastro:</strong> nome, e-mail, senha (criptografada
                com bcrypt rounds 12).
              </li>
              <li>
                <strong>Empresa:</strong> razão social, CNPJ, dados contábeis
                que você cadastra.
              </li>
              <li>
                <strong>Financeiros:</strong> transações importadas de
                extratos OFX/Excel/CSV, fornecedores, categorias, contas a
                pagar/receber.
              </li>
              <li>
                <strong>Uso:</strong> logs de acesso, IPs, navegador (para
                segurança e auditoria).
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-3">
              3. Como usamos
            </h2>
            <p>
              Os dados são usados exclusivamente para prestar o serviço
              contratado: gerar seus relatórios, treinar a IA com seus padrões
              (escopo POR EMPRESA — nunca cruzamos dados entre clientes),
              enviar comunicações sobre o serviço.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-3">
              4. Compartilhamento
            </h2>
            <p>
              Não vendemos nem alugamos seus dados. Compartilhamos com
              processadores estritamente necessários ao funcionamento:
              servidor de e-mail (envios transacionais), API de inteligência
              artificial para classificação de transações (somente a descrição
              e o valor, nunca identificadores do seu cliente).
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-3">
              5. Segurança
            </h2>
            <p>
              Conexão HTTPS criptografada, banco com backup diário, isolamento
              total entre clientes (multi-tenant com chave por empresa), logs
              de auditoria de ações sensíveis, autenticação via JWT em cookie
              httpOnly.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-3">
              6. Seus direitos (LGPD)
            </h2>
            <p>
              Você tem direito a acessar, corrigir, exportar ou excluir seus
              dados a qualquer momento. Após cancelamento da conta, os dados
              ficam disponíveis para export por 30 dias e são removidos
              permanentemente em seguida (audit logs anonimizados são
              retidos por 5 anos por exigência fiscal).
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-3">
              7. Contato do encarregado (DPO)
            </h2>
            <p>
              Para exercer seus direitos LGPD ou tirar dúvidas sobre o
              tratamento de dados:{' '}
              <a
                href="mailto:privacidade@caixaos.com.br"
                className="text-violet-700 hover:text-violet-900 underline underline-offset-2"
              >
                privacidade@caixaos.com.br
              </a>
            </p>
          </section>
        </div>
      </article>

      <LandingFooter />
    </main>
  )
}
