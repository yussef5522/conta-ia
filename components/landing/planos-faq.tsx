'use client'

// Sprint Landing v2 Elite (30/05/2026) — FAQ accordion premium da /planos.

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus } from 'lucide-react'
import { SectionReveal } from './section-reveal'
import { fadeUp, EASE_OUT_EXPO } from '@/lib/motion/variants'

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
    <section className="relative py-28 sm:py-36 bg-slate-50/60 border-t border-slate-200/70 overflow-hidden">
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-violet-200 to-transparent"
      />

      <div className="mx-auto max-w-3xl px-5 sm:px-8">
        <SectionReveal variants={fadeUp}>
          <div className="text-center">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-violet-600">
              FAQ
            </p>
            <h2 className="mt-4 text-4xl sm:text-5xl font-bold tracking-[-0.03em] text-slate-900 font-display leading-[1.05]">
              Dúvidas comuns sobre os{' '}
              <span className="text-gradient-violet">planos</span>
            </h2>
          </div>
        </SectionReveal>

        <div className="mt-14 space-y-3">
          {FAQS.map((faq, i) => {
            const open = openIdx === i
            return (
              <SectionReveal
                key={i}
                variants={{
                  hidden: { opacity: 0, y: 12 },
                  visible: {
                    opacity: 1,
                    y: 0,
                    transition: { duration: 0.5, delay: i * 0.04, ease: EASE_OUT_EXPO },
                  },
                }}
              >
                <div
                  className={[
                    'rounded-2xl border transition-all overflow-hidden',
                    open
                      ? 'border-violet-200 bg-white shadow-floating'
                      : 'border-slate-200/80 bg-white hover:border-slate-300 hover:shadow-md',
                  ].join(' ')}
                >
                  <button
                    type="button"
                    onClick={() => setOpenIdx(open ? null : i)}
                    className="w-full flex items-start justify-between gap-4 px-6 py-5 text-left"
                    aria-expanded={open}
                  >
                    <span className="text-base sm:text-lg font-medium text-slate-900 leading-snug pt-0.5">
                      {faq.q}
                    </span>
                    <motion.span
                      animate={{ rotate: open ? 45 : 0 }}
                      transition={{ duration: 0.3, ease: EASE_OUT_EXPO }}
                      className={[
                        'shrink-0 h-8 w-8 rounded-full flex items-center justify-center transition-colors',
                        open
                          ? 'bg-gradient-to-br from-violet-500 to-violet-700 text-white'
                          : 'bg-slate-100 text-slate-500',
                      ].join(' ')}
                    >
                      <Plus size={14} />
                    </motion.span>
                  </button>
                  <AnimatePresence initial={false}>
                    {open && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.35, ease: EASE_OUT_EXPO }}
                        className="overflow-hidden"
                      >
                        <div className="px-6 pb-6 pt-0">
                          <p className="text-base text-slate-600 leading-relaxed">
                            {faq.a}
                          </p>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </SectionReveal>
            )
          })}
        </div>
      </div>
    </section>
  )
}
