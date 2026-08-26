import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    globals: true,
    // ⛔ TRAVA: recusa rodar se o DATABASE_URL não for de um banco de teste.
    // Ver lib/testing/guard-banco-de-teste.ts (incidente de 08/08/2026).
    setupFiles: ['./vitest.setup.ts'],
    // Ignora imports de CSS nos testes (não são necessários para lógica de negócio)
    css: false,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
})
