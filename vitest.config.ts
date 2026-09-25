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
    // ⭐ limpa o resíduo da rodada no fim (01/09) — o dev.db chegou a 663 empresas de teste
    globalSetup: ['./vitest.global-setup.ts'],
    // Ignora imports de CSS nos testes (não são necessários para lógica de negócio)
    css: false,
    /**
     * ⭐⭐ 25/09 — **O TETO DE 5s DO VITEST É PRA TESTE PURO, e a suíte tem 98 arquivos de
     * INTEGRAÇÃO contra banco real.**
     *
     * ⚠️ Foi a causa MEDIDA do flake que estava *"vigiado, não rotulado"* desde 24/09: o
     * `ponte/renegociacao` ficava vermelho ~1 vez a cada 5 rodadas cheias com
     * `Test timed out in 5000ms` — e **sozinho ele leva 958ms**. Não era colisão de dado
     * (a hipótese que eu carregava); era contenção de CPU/banco com os outros 838 arquivos
     * rodando em paralelo.
     *
     * ⛔ Não é afrouxar guard nenhum: nenhuma asserção muda. O que muda é parar de chamar
     * de falha o que é fila. ***Alarme falso repetido é como um alarme morre*** — e uma
     * suíte que fica vermelha sozinha ensina a ignorar o vermelho.
     *
     * ⚠️ 20s e não "sem teto": teste que trava de verdade continua sendo pego, e o custo é
     * 20s numa suíte que roda em ~50s.
     */
    testTimeout: 20_000,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
})
