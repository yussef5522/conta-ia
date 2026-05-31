'use client'

// Sprint Landing Page (30/05/2026) — FAQ accordion da página /planos.

import { useState } from 'react'
import { Plus, Minus } from 'lucide-react'

const FAQS = [
  {
    q: 'Posso trocar de plano a qualquer momento?',
    a: 'Sim. Upgrade entra em vigor imediatamente; downgrade entra no próximo ciclo. Sem multa, sem burocracia.',
  },
  {
    q: 'Tem fidelidade ou multa de cancelamento?',
    a: 'Zero. Você cancela com um clique e a cobrança para no fim do ciclo atual. Os dados ficam disponíveis pra export por 30 dias.',
  },
  {
    q: 'Como funciona o teste grátis?',
    a: 'Você cria a conta sem cartão de crédito, importa seus extratos e usa o CAIXAOS por 14 dias com todas as funcionalidades do plano que escolher. Sem cobrança automática no fim do teste — você decide se assina.',
  },
  {
    q: 'Os meus dados ficam seguros?',
    a: 'Sim. Conexão criptografada (HTTPS), banco com backup diário, isolamento total entre clientes. Você é dono dos seus dados e pode exportar tudo em CSV/PDF a qualquer momento.',
  },
  {
    q: 'A IA precisa de configuração?',
    a: 'Não. Ela começa a aprender no seu primeiro import. Você confirma 20-30 categorizações manualmente e a partir daí o sistema vai automatizando — quanto mais você usa, melhor fica.',
  },
  {
    q: 'Suporta múltiplos CNPJs (filiais ou holding)?',
    a: 'Sim, desde o plano Controle. Cada empresa fica com dados isolados, e no plano Performance você ainda tem o painel CONSOLIDADO que soma tudo numa visão única.',
  },
  {
    q: 'Quais bancos são suportados na importação?',
    a: 'Qualquer banco que exporta OFX/Excel/CSV (praticamente todos). Já validamos: Banrisul, Sicredi, Sicoob, Bradesco, Itaú, Santander, Caixa, Nubank PJ, BTG, Inter, C6, Safra e mais.',
  },
  {
    q: 'Posso emitir notas fiscais pelo CAIXAOS?',
    a: 'Não. O CAIXAOS é focado em gestão financeira e contábil — DRE, fluxo de caixa, análise. Pra emissão de NF-e/NFS-e recomendamos integração com seu emissor atual.',
  },
] as const

export function PlanosFAQ() {
  const [openIdx, setOpenIdx] = useState<number | null>(0)

  return (
    <section className="py-20 sm:py-28 bg-slate-50/50 border-t border-slate-200/70">
      <div className="mx-auto max-w-3xl px-5 sm:px-8">
        <div className="text-center">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-violet-600">
            Perguntas frequentes
          </p>
          <h2 className="mt-3 text-3xl sm:text-4xl font-semibold tracking-[-0.02em] text-slate-900">
            Dúvidas comuns sobre os planos
          </h2>
        </div>

        <div className="mt-12 space-y-3">
          {FAQS.map((faq, i) => {
            const open = openIdx === i
            return (
              <div
                key={i}
                className={[
                  'rounded-xl border transition-all overflow-hidden',
                  open ? 'border-violet-200 bg-white shadow-sm' : 'border-slate-200 bg-white',
                ].join(' ')}
              >
                <button
                  type="button"
                  onClick={() => setOpenIdx(open ? null : i)}
                  className="w-full flex items-start justify-between gap-4 px-5 py-4 text-left"
                  aria-expanded={open}
                >
                  <span className="text-sm sm:text-base font-medium text-slate-900 leading-snug pt-0.5">
                    {faq.q}
                  </span>
                  <span
                    className={[
                      'shrink-0 h-7 w-7 rounded-full flex items-center justify-center transition-all',
                      open ? 'bg-violet-100 text-violet-700' : 'bg-slate-100 text-slate-500',
                    ].join(' ')}
                  >
                    {open ? <Minus size={14} /> : <Plus size={14} />}
                  </span>
                </button>
                {open && (
                  <div className="px-5 pb-5 pt-0">
                    <p className="text-sm text-slate-600 leading-relaxed">{faq.a}</p>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
