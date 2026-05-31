'use client'

// Sprint Landing v3.1 (30/05/2026) — Botão flutuante WhatsApp suporte.
// Canto inferior ESQUERDO (Yussef pediu, oposto ao padrão da maioria
// dos sites). Sempre visível durante scroll. Hover expande pra
// "Fale conosco". Mobile: só ícone (mais discreto).
//
// ⚠️ NÚMERO PLACEHOLDER — substituir 55XXXXXXXXXXX pelo número real
// quando Yussef confirmar.

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

// TODO: substituir pelo número real do Yussef (formato E.164 sem +)
// Ex: 5511987654321 = +55 11 98765-4321
const WHATSAPP_NUMBER = '55XXXXXXXXXXX'

const MENSAGEM_PADRAO = encodeURIComponent(
  'Olá! Vim pelo site CAIXAOS e gostaria de tirar dúvidas sobre o sistema.',
)

export function WhatsAppFloat() {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    // Atrasa render 1.5s pra não competir com a entrada do hero
    const t = setTimeout(() => setMounted(true), 1500)
    return () => clearTimeout(t)
  }, [])

  return (
    <AnimatePresence>
      {mounted && (
        <motion.a
          href={`https://wa.me/${WHATSAPP_NUMBER}?text=${MENSAGEM_PADRAO}`}
          target="_blank"
          rel="noopener noreferrer"
          initial={{ opacity: 0, scale: 0.6, x: -20 }}
          animate={{ opacity: 1, scale: 1, x: 0 }}
          exit={{ opacity: 0, scale: 0.6 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="group fixed bottom-5 left-5 sm:bottom-6 sm:left-6 z-40 inline-flex items-center gap-2.5 rounded-full bg-[#25D366] px-4 py-3 text-white shadow-[0_8px_30px_rgba(37,211,102,0.45),0_0_0_4px_rgba(37,211,102,0.12)] hover:bg-[#1ebe5b] hover:shadow-[0_10px_40px_rgba(37,211,102,0.55),0_0_0_6px_rgba(37,211,102,0.16)] transition-all"
          aria-label="Falar com o suporte no WhatsApp"
        >
          {/* Ícone WhatsApp inline (sem dep externa) */}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
            className="h-5 w-5 sm:h-6 sm:w-6 shrink-0"
          >
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
          </svg>

          {/* Texto desktop only — discreto */}
          <span className="hidden sm:inline text-sm font-semibold tracking-tight">
            Suporte
          </span>

          {/* Ping pulse decorativo */}
          <span
            aria-hidden
            className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5"
          >
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-300 opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400 ring-2 ring-white" />
          </span>
        </motion.a>
      )}
    </AnimatePresence>
  )
}
