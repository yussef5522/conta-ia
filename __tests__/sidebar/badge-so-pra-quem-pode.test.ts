/**
 * ⛔⛔ O BADGE SÓ É CHAMADO POR QUEM PODE VER O NÚMERO (28/09/2026) — item 3 do check-up.
 *
 * **Medido no log do nginx:** **1.391 respostas 403 por dia** vinham do `/api/dashboard/badges`,
 * de **um IP só** — a máquina do estoque, com o `OPERADOR_ESTOQUE` logado e o polling de 60s.
 * Somando os irmãos (`retiradas-pendentes`, mesma permissão), eram **17% de todo o tráfego**.
 *
 * ⚠️ **Não travava tela** (o hook faz `if (!res.ok) return` — best-effort), mas era ~1.400
 * requisições/dia queimadas e **ruído que esconderia problema de verdade**: o R2 que nasceu
 * hoje gritaria isso todo dia, e aí o alarme morre de tanto ter razão sobre a coisa errada.
 *
 * ⛔ **É teste ESTRUTURAL e assumido como tal:** o projeto roda em `environment: node`, sem
 * jsdom — não dá pra renderizar a sidebar e contar fetches. O que ele trava é a FORMA que
 * quebrou: o hook do badge recebendo o id sem passar pelo gate de permissão.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const ler = (p: string) => readFileSync(join(process.cwd(), p), 'utf-8')
/** ⚠️ sem comentário: o arquivo que DOCUMENTA o defeito não pode ser o que o absolve */
const semComentario = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

const SIDEBAR = 'components/sidebar/global-sidebar.tsx'

describe('⛔⛔ o badge passa pelo gate de permissão', () => {
  const src = semComentario(ler(SIDEBAR))

  it('⭐ o hook do badge recebe o id JÁ filtrado pela permissão', () => {
    expect(src, 'o badge voltou a ser chamado com o id cru — 1.391 403/dia')
      .toContain('useSidebarBadges(empresaIdParaBadges)')
    expect(src, 'o gate sumiu').toMatch(/podeVerNumeroDeDinheiro\s*\?\s*empresaIdForBadges\s*:\s*null/)
  })

  it('⛔⛔ e "ainda não sei" NÃO vira "pode" — senão volta 1 403 por carregamento', () => {
    /**
     * ⭐ `permissoes === null` é o estado *enquanto carrega*. Chutar "pode" ali custaria uma
     * 403 a cada abertura de página. O badge é enfeite: aparecer 200ms depois não custa nada.
     */
    expect(src).toMatch(/permissoes\s*!==\s*null\s*&&\s*pode\('transaction\.view'\)/)
  })

  it('⭐ o contador de RETIRADAS usa o MESMO gate — a rota dele exige a MESMA permissão', () => {
    // ⚠️ eram outras 39 403/dia, pela mesma causa
    expect(src).toContain('retiradas-pendentes')
    expect(src, 'o irmão do badge ficou de fora do gate')
      .toMatch(/if\s*\(!empresaIdParaBadges\)/)
  })

  it('⛔ a permissão exigida é a MESMA que a rota cobra — senão o gate erra de porta', async () => {
    /**
     * ⚠️ Se a tela filtrar por uma chave e o servidor cobrar outra, o gate não resolve nada —
     * ou esconde de quem podia, ou deixa passar quem não pode. **Uma régua, os dois lados.**
     */
    const rota = semComentario(ler('app/api/dashboard/badges/route.ts'))
    expect(rota).toContain("requirePermission('transaction.view')")
    const rotaRetiradas = semComentario(ler('app/api/empresas/[id]/retiradas-pendentes/route.ts'))
    expect(rotaRetiradas).toContain("requirePermission('transaction.view')")
  })

  it('⛔⛔ REGRA 9 — o gate é declarado ANTES do hook que o consome', () => {
    /**
     * ⚠️ Hook só lê o que já foi declarado, e os dois precisam ficar **no topo do componente,
     * antes de qualquer `return`** — a Regra dos Hooks. Mover a permissão pra cima foi a parte
     * da mudança que mais podia quebrar a tela em silêncio (crash de CLIENTE: o servidor
     * responde 200 e o `pm2 logs` fica limpo).
     */
    const iPerm = src.indexOf('usePermissoes(empresaAtiva)')
    const iGate = src.indexOf('podeVerNumeroDeDinheiro')
    const iBadge = src.indexOf('useSidebarBadges(')
    expect(iPerm).toBeGreaterThan(-1)
    expect(iPerm, 'a permissão ficou DEPOIS do gate').toBeLessThan(iGate)
    expect(iGate, 'o gate ficou DEPOIS do hook que ele governa').toBeLessThan(iBadge)
  })

  it('⭐ e `usePermissoes` continua declarado UMA vez só', () => {
    // ⚠️ ao mover, a 1ª tentativa deixou duas declarações e o `tsc` cobrou
    const n = (src.match(/const \{ permissoes, pode \} = usePermissoes\(/g) ?? []).length
    expect(n, 'duas declarações do mesmo hook — a 2ª é a que alguém edita achando que vale')
      .toBe(1)
  })
})
