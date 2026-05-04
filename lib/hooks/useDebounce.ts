import { useEffect, useState } from 'react'

// Retorna o valor após `delay` ms sem novas atualizações.
// Útil pra busca em tempo real sem flood de re-renders.
export function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])

  return debounced
}
