'use client'

// 6 caixas de código estilo Stripe/Vercel — Sprint 1.5.
// Auto-focus, auto-advance, paste handler.

import { useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'

interface CodeInputProps {
  value: string // 6 dígitos ou string parcial
  onChange: (value: string) => void
  onComplete?: (value: string) => void
  disabled?: boolean
  autoFocus?: boolean
  error?: boolean
}

const LENGTH = 6

export function CodeInput({
  value,
  onChange,
  onComplete,
  disabled = false,
  autoFocus = true,
  error = false,
}: CodeInputProps) {
  const inputsRef = useRef<Array<HTMLInputElement | null>>([])
  const previousValueRef = useRef<string>('')

  useEffect(() => {
    if (autoFocus && inputsRef.current[0]) {
      inputsRef.current[0].focus()
    }
  }, [autoFocus])

  useEffect(() => {
    if (value.length === LENGTH && previousValueRef.current !== value) {
      previousValueRef.current = value
      onComplete?.(value)
    }
  }, [value, onComplete])

  function setDigitAt(index: number, digit: string) {
    const chars = value.split('')
    chars[index] = digit
    // Pad com vazio até LENGTH
    while (chars.length < LENGTH) chars.push('')
    const next = chars.slice(0, LENGTH).join('')
    onChange(next)
  }

  function handleChange(index: number, raw: string) {
    const digit = raw.replace(/[^0-9]/g, '').slice(-1)
    if (!digit) {
      // Apagar: limpa a posição
      setDigitAt(index, '')
      return
    }
    setDigitAt(index, digit)
    // Avança foco
    if (index < LENGTH - 1) {
      inputsRef.current[index + 1]?.focus()
    }
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace' && !value[index] && index > 0) {
      // Volta foco + apaga digit anterior
      e.preventDefault()
      setDigitAt(index - 1, '')
      inputsRef.current[index - 1]?.focus()
    } else if (e.key === 'ArrowLeft' && index > 0) {
      inputsRef.current[index - 1]?.focus()
    } else if (e.key === 'ArrowRight' && index < LENGTH - 1) {
      inputsRef.current[index + 1]?.focus()
    }
  }

  function handlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
    e.preventDefault()
    const pasted = e.clipboardData
      .getData('text')
      .replace(/[^0-9]/g, '')
      .slice(0, LENGTH)
    if (pasted.length === 0) return
    const padded = pasted.padEnd(LENGTH, '').slice(0, LENGTH)
    onChange(padded.replace(/\s/g, ''))
    // Foca último preenchido
    const lastIdx = Math.min(pasted.length, LENGTH) - 1
    inputsRef.current[lastIdx]?.focus()
  }

  return (
    <div className="flex justify-center gap-2 sm:gap-2.5">
      {Array.from({ length: LENGTH }).map((_, i) => (
        <input
          key={i}
          ref={(el) => {
            inputsRef.current[i] = el
          }}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={1}
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          value={value[i] ?? ''}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={handlePaste}
          disabled={disabled}
          aria-label={`Dígito ${i + 1} do código`}
          className={cn(
            'w-11 h-12 sm:w-12 sm:h-14',
            'text-center text-lg sm:text-xl font-semibold tabular-nums',
            'rounded-md border bg-white',
            'focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary',
            'transition-colors',
            error
              ? 'border-rose-400 text-rose-700'
              : 'border-slate-300 text-slate-900',
            disabled && 'opacity-50 cursor-not-allowed',
          )}
        />
      ))}
    </div>
  )
}
