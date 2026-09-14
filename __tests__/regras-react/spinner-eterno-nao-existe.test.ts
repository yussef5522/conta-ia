// ⛔⛔⛔ A TELA DE VENDAS PENDUROU EM PROD — 20 REQUISIÇÕES POR SEGUNDO (14/09/2026)
//
// **O dono:** *"com a página RECARREGADA, três fetches não resolvem — o 'Lendo…', a lista de
// receitas do seletor ('carregando…' eterno) e o POST do processar ('processando…' preso)."*
//
// **MEDIDO EM PROD, e o servidor estava SADIO:** pm2 online, 54 MB, 0,1% de CPU, sem OOM, e
// **cada rota respondendo em 72–302 ms**. Quem entupia era o CLIENTE: no nginx, **489 de 500
// requisições eram o MESMO `POST /vendas/preview`, ~20 por segundo**, cada uma reenviando o
// arquivo inteiro — do Safari dele.
//
// **A CAUSA (defeito meu, do deploy das 17h):** `carregar` tinha `recarregarExterna` nas
// dependências, e a tela pai monta essa função **nova a cada render**:
//     efeito → fetch → setState no pai → render → identidade nova → efeito → …
// Com o limite de ~6 conexões por host do browser saturado, **as outras duas chamadas
// ficaram na FILA pra sempre** — daí os três spinners.
//
// ⭐⭐ **AS DUAS RÉGUAS QUE FICAM:**
//   1. ***`useCallback`/`useEffect` que BUSCA não pode depender de função vinda de prop*** —
//      a identidade muda a cada render do pai **por construção**. É um laço armado.
//   2. ***Spinner eterno é a ausência fingindo progresso*** (palavras do dono): todo fetch
//      que alimenta um "carregando…" tem TIMEOUT e vira erro visível com saída.
//
// ⚠️ **DECLARAÇÃO HONESTA: a régua 2 NÃO teria pego este defeito** — as requisições eram 200
// e rápidas. Ela não impede o laço; impede a **mentira**: a tela diria "não consegui — tentar
// de novo" em 12 s, em vez de girar pra sempre. Quem impede o laço é a régua 1.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { readdirSync, statSync } from 'node:fs'

const raiz = process.cwd()

function arquivosTsx(dir: string, out: string[] = []): string[] {
  for (const n of readdirSync(join(raiz, dir))) {
    const rel = `${dir}/${n}`
    if (n === 'node_modules' || n === '.next' || n.startsWith('.')) continue
    if (statSync(join(raiz, rel)).isDirectory()) arquivosTsx(rel, out)
    else if (n.endsWith('.tsx')) out.push(rel)
  }
  return out
}

/** as props que são FUNÇÃO (o `onX: () => …` do destructuring tipado) */
export function propsQueSaoFuncao(src: string): string[] {
  return [...new Set([...src.matchAll(/\b(\w+)\??:\s*\([^)]*\)\s*=>/g)].map((m) => m[1]))]
}

/**
 * ⭐ O DETECTOR — e ele tem DUAS formas, porque a 1ª versão não mordeu (REGRA 11).
 *
 * **(A) DIRETA:** o hook tem `fetch(` no corpo e uma prop-função nas deps.
 *
 * **(B) INDIRETA — a que escapou:** um `useCallback` com prop-função nas deps é ele PRÓPRIO
 * dependência de um `useEffect`. ⚠️ Repondo o defeito de hoje o `fetch(` ficou num callback
 * VIZINHO (`carregarDoDia`), e o detector que só olhava o corpo passou **verde**. O laço não
 * precisa do `fetch` na mesma função — precisa da **identidade instável chegando ao efeito**.
 *
 * ⛔ E `onClose` num efeito de listener NÃO cai aqui: ele está direto no `useEffect`, não num
 * callback que vira dependência — a forma é outra e o alarme falso mataria o guard.
 */
export function lacosArmados(src: string): string[] {
  const props = new Set(propsQueSaoFuncao(src))
  const achados: string[] = []
  /** callbacks nomeados e as deps de cada um */
  const callbacks = new Map<string, string[]>()
  for (const m of src.matchAll(/const\s+(\w+)\s*=\s*useCallback\(([\s\S]*?)\}, \[([^\]]*)\]\)/g)) {
    callbacks.set(m[1], m[3].split(',').map((x) => x.trim()).filter(Boolean))
  }
  /** os nomes que o `useEffect` usa como dependência */
  const depsDeEfeito = new Set<string>()
  for (const m of src.matchAll(/useEffect\(([\s\S]*?)\}, \[([^\]]*)\]\)/g)) {
    for (const d of m[2].split(',').map((x) => x.trim())) depsDeEfeito.add(d)
    // (A) direta: o efeito busca e depende de prop-função
    if (m[1].includes('fetch(')) for (const d of m[2].split(',').map((x) => x.trim())) if (props.has(d)) achados.push(d)
  }
  for (const [nome, deps] of callbacks) {
    const usadoPorEfeito = depsDeEfeito.has(nome)
    const corpo = src.slice(src.indexOf(`const ${nome} = useCallback(`))
    const buscaDireto = corpo.slice(0, corpo.indexOf('}, [')).includes('fetch(')
    // (B) indireta: identidade instável chegando ao efeito · (A) no callback que busca
    if (!usadoPorEfeito && !buscaDireto) continue
    for (const d of deps) if (props.has(d)) achados.push(d)
  }
  return [...new Set(achados)]
}

describe('⛔⛔ efeito que BUSCA não depende de função vinda de prop (o laço de 14/09)', () => {
  const telas = [...arquivosTsx('components'), ...arquivosTsx('app')]

  it('nenhuma tela do app tem o laço armado', () => {
    const culpados = telas
      .map((f) => ({ f, deps: lacosArmados(readFileSync(join(raiz, f), 'utf-8')) }))
      .filter((x) => x.deps.length)
      .map((x) => `${x.f} → dep ${x.deps.map((d) => `\`${d}\``).join(', ')}`)
    expect(culpados, 'efeito que busca depende de função de prop — identidade muda a cada render do pai').toEqual([])
  })

  /**
   * ⭐ A CURA ESTRUTURAL na tela que quebrou: no modo externo a lista **É a prop** — o
   * componente ESPELHA, não busca. Sem efeito que busca, não há laço possível.
   */
  it('⭐ a revisão espelha a prop em vez de buscar por ela', () => {
    const src = readFileSync(join(raiz, 'components/estoque/revisao-do-import.tsx'), 'utf-8')
    expect(src).toContain('if (externo) { setRev(revisaoExterna ?? null)')
    expect(src).toContain('recarregarRef.current')
    // ⛔ e o `recarregarExterna` não pode voltar pra dependência de efeito nenhum
    expect(lacosArmados(src)).toEqual([])
  })
})

describe('⛔⛔ spinner eterno não existe — todo "carregando" tem saída', () => {
  const COM_SPINNER = [
    'components/estoque/revisao-do-import.tsx',
    'components/estoque/seletor-de-destino.tsx',
    'app/(dashboard)/empresas/[id]/estoque/vendas/page.tsx',
  ]

  it('as três telas do relato buscam com TIMEOUT', () => {
    for (const f of COM_SPINNER) {
      const src = readFileSync(join(raiz, f), 'utf-8')
      expect(src, `${f} voltou a buscar sem teto de tempo`).toContain('fetchComTimeout')
    }
  })

  it('⭐ e o erro tem SAÍDA — "tentar de novo", não um beco', () => {
    for (const f of ['components/estoque/revisao-do-import.tsx', 'components/estoque/seletor-de-destino.tsx']) {
      expect(readFileSync(join(raiz, f), 'utf-8')).toContain('tentar de novo')
    }
  })

  it('⛔ o helper NUNCA lança — throw solto em effect vira spinner com erro no console', () => {
    const src = readFileSync(join(raiz, 'lib/http/fetch-com-timeout.ts'), 'utf-8')
    expect(src).toContain('catch')
    expect(src).not.toMatch(/^\s*throw /m)
  })
})

// ⭐⭐ REGRA 11 — os detectores têm que pegar o defeito que motivou o guard.
describe('os detectores mordem (auto-teste)', () => {
  const LACO = `
    function X({ onLoad }: { onLoad: () => Promise<void> }) {
      const carregar = useCallback(async () => { await fetch('/api/x'); await onLoad() }, [onLoad])
      useEffect(() => { void carregar() }, [carregar])
    }`
  const CURADO = `
    function X({ onLoad }: { onLoad: () => Promise<void> }) {
      const ref = useRef(onLoad); ref.current = onLoad
      const carregar = useCallback(async () => { await fetch('/api/x'); await ref.current() }, [])
      useEffect(() => { void carregar() }, [carregar])
    }`

  it('acusa o laço exato de 14/09', () => {
    expect(lacosArmados(LACO)).toEqual(['onLoad'])
  })

  it('não acusa a versão curada com ref', () => {
    expect(lacosArmados(CURADO)).toEqual([])
  })

  it('não acusa efeito que NÃO busca', () => {
    expect(lacosArmados(`function X({ onClose }: { onClose: () => void }) {
      useEffect(() => { document.addEventListener('k', onClose) }, [onClose])
    }`)).toEqual([])
  })

  it('acha as props que são função', () => {
    expect(propsQueSaoFuncao('{ a, b }: { a: string; b: (x: number) => void }')).toEqual(['b'])
  })
})
