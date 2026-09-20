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

/**
 * ⚠️ **O QUE CONTA COMO "BUSCAR" — um lugar só pros dois detectores.** `fetch(` literal não
 * casa `fetchComTimeout(` nem `fetchJson(`, que são o padrão da casa: os detectores nasciam
 * **cegos justamente nas telas que fazem certo** (pego pela REGRA 11 em 20/09).
 *
 * ⚠️ E o **genérico** precisou entrar na régua na 2ª volta: a chamada real é
 * `fetchComTimeout<{ items: … }>(` — com o tipo ENTRE o nome e o parêntese. Repondo o
 * defeito no `historico-table`, o detector ainda passava verde. *Duas voltas até morder.*
 */
const BUSCA = /\bfetch\w*(<[\s\S]*?>)?\s*\(/

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
    if (BUSCA.test(m[1])) for (const d of m[2].split(',').map((x) => x.trim())) if (props.has(d)) achados.push(d)
  }
  for (const [nome, deps] of callbacks) {
    const usadoPorEfeito = depsDeEfeito.has(nome)
    const corpo = src.slice(src.indexOf(`const ${nome} = useCallback(`))
    const buscaDireto = BUSCA.test(corpo.slice(0, corpo.indexOf('}, [')))
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

// ═══════════════════════════════════════════════════════════════════════════════
// ⛔⛔⛔ A SEGUNDA FORMA DO SPINNER ETERNO: **O FETCH QUE NÃO SAI** (20/09/2026)
//
// **O dono, na estreia da lixeira:** *"abro a tela e fica «carregando…» pra sempre — nada
// aparece, nem erro. (…) O guard de família claramente não cobria a tela nova — TELA NOVA
// NASCE COM O GUARD."*
//
// **MEDIDO EM PROD, e as três hipóteses dele CAÍRAM:** a rota respondeu **200 em 104 ms com
// 19 KB e as 42 removidas**, e a página 200 nos dois viewports. Não era 500, nem payload
// grande, nem parse quebrado. ***O fetch nunca aconteceu.***
//
// A tela descobria a empresa com `document.cookie.match(/current_empresa_id=…/)` — e esse
// cookie é **`httpOnly`** desde o Sprint 4.0.5.b (provado no header real de prod:
// `Set-Cookie: current_empresa_id=…; HttpOnly`). `document.cookie` **nunca** o enxerga →
// `empresaId` ficava `''` → `if (!empresaId) return` → o estado nunca saía de `undefined`.
//
// ⚠️⚠️ **E O `fetchComTimeout` ESTAVA LÁ.** O guard de 14/09 cobre ***fetch que não
// VOLTA***; este é ***fetch que não SAI*** — e nenhum teto de tempo alcança uma requisição
// que não aconteceu. ***Estado de carregamento refém de um pré-requisito que pode nunca
// chegar é spinner eterno com outro nome.***

/** ⛔ os cookies httpOnly da casa — quem tenta lê-los no cliente lê SEMPRE vazio */
export const COOKIES_HTTPONLY = ['current_empresa_id', 'auth_token']

const semComentario = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/^\s*\/\/.*$/gm, '')

/**
 * ⭐ DETECTOR 1 — tela lendo cookie httpOnly. É **impossível por construção**, então o
 * defeito não é "às vezes falha": ele nunca funciona, e falha **em silêncio**.
 */
export function leCookieHttpOnly(src: string): string[] {
  const s = semComentario(src)
  if (!s.includes('document.cookie')) return []
  return COOKIES_HTTPONLY.filter((c) => s.includes(c))
}

/**
 * ⭐ DETECTOR 2 — carregamento REFÉM: o `useCallback` que busca **roda sozinho** (é
 * dependência de um `useEffect`) e tem um `return` ANTES do fetch que **não toca no
 * estado**. Sai da função deixando o "carregando" ligado pra sempre.
 *
 * ⛔ A restrição *"roda sozinho"* não é folga — é o que separa o defeito do **gesto**:
 * `if (!file) return` num "gerar preview" está CERTO (o dono ainda não escolheu o arquivo,
 * e não há spinner ligado). Sem ela o detector acusava 5 telas sadias, e *alarme falso no
 * dia 1 é como um guard morre*.
 */
export function carregamentoRefem(src: string): string[] {
  const s = semComentario(src)
  const rodamSozinhos = new Set<string>()
  for (const m of s.matchAll(/useEffect\(([\s\S]*?)\}, \[([^\]]*)\]\)/g))
    for (const d of m[2].split(',').map((x) => x.trim())) if (d) rodamSozinhos.add(d)

  const achados: string[] = []
  for (const m of s.matchAll(/const\s+(\w+)\s*=\s*useCallback\(([\s\S]*?)\}, \[([^\]]*)\]\)/g)) {
    if (!rodamSozinhos.has(m[1])) continue
    const i = m[2].search(BUSCA)
    if (i < 0) continue
    for (const linha of m[2].slice(0, i).split('\n'))
      // ⭐ sair SETANDO estado é legítimo — o que mata é sair calado
      if (/^\s*if\s*\(.*\)\s*return\b/.test(linha) && !/set[A-Z]/.test(linha))
        achados.push(`${m[1]}: ${linha.trim()}`)
  }
  return achados
}

describe('⛔⛔⛔ fetch que NÃO SAI — o carregamento nunca fica refém', () => {
  const telas = [...arquivosTsx('components'), ...arquivosTsx('app')]

  it('⛔ nenhuma tela descobre a empresa por document.cookie (o cookie é httpOnly)', () => {
    const culpados = telas
      .map((f) => ({ f, c: leCookieHttpOnly(readFileSync(join(raiz, f), 'utf-8')) }))
      .filter((x) => x.c.length)
      .map((x) => `${x.f} → lê \`${x.c.join(', ')}\` (httpOnly: sempre vazio no cliente)`)
    expect(culpados, 'quem responde "qual empresa?" é o useEmpresa(), nunca o document.cookie').toEqual([])
  })

  it('⛔ nenhum carregamento automático sai calado antes do fetch', () => {
    const culpados = telas
      .map((f) => ({ f, r: carregamentoRefem(readFileSync(join(raiz, f), 'utf-8')) }))
      .filter((x) => x.r.length)
      .map((x) => `${x.f} → ${x.r.join(' · ')}`)
    expect(culpados, 'return antes do fetch sem setar estado = "carregando…" pra sempre').toEqual([])
  })

  /**
   * ⭐⭐ A CURA ESTRUTURAL DA LIXEIRA: estado EXPLÍCITO. Enquanto "ausência de dado" servir
   * de estado, o caso que ninguém previu vira spinner — aqui cada um tem nome e frase.
   */
  it('⭐ a lixeira tem os 4 estados, e os que pedem ação têm "tentar de novo"', () => {
    const src = readFileSync(join(raiz, 'app/(dashboard)/contas-a-pagar/removidas/page.tsx'), 'utf-8')
    for (const t of ['CARREGANDO', 'SEM_EMPRESA', 'FALHOU', 'OK'])
      expect(src, `o estado ${t} sumiu — ausência de dado voltou a servir de estado`).toContain(`'${t}'`)
    expect(src, 'a lixeira voltou a buscar sem teto de tempo').toContain('fetchComTimeout')
    expect((src.match(/tentar de novo/g) ?? []).length, 'erro sem saída é beco').toBeGreaterThanOrEqual(2)
    expect(src, 'voltou a inventar um segundo jeito de saber a empresa').toContain('useEmpresa()')
  })

  it('⭐ e o histórico da conciliação — a 2ª instância que o detector achou — foi junto', () => {
    const src = readFileSync(join(raiz, 'components/conciliacao/historico-table.tsx'), 'utf-8')
    expect(src).toContain('fetchComTimeout')
    expect(src, 'o erro voltou a virar lista vazia').toContain('tentar de novo')
    expect(carregamentoRefem(src)).toEqual([])
  })
})

// ⭐⭐ REGRA 11 — os dois detectores novos mordem o defeito que os motivou.
describe('os detectores do "fetch que não sai" mordem (auto-teste)', () => {
  const REFEM = `
    function X() {
      const [dados, setDados] = useState(undefined)
      const carregar = useCallback(async () => {
        if (!empresaId) return
        const r = await fetch('/api/x'); setDados(r)
      }, [empresaId])
      useEffect(() => { void carregar() }, [carregar])
    }`
  const CURADO = REFEM.replace('if (!empresaId) return', "if (!empresaId) { setDados(null); return }")
  const GESTO = `
    function X() {
      const gerar = useCallback(async () => {
        if (!file) return
        await fetch('/api/preview')
      }, [file])
      return <button onClick={gerar} />
    }`

  it('acusa o refém exato da lixeira', () => {
    expect(carregamentoRefem(REFEM)).toEqual(['carregar: if (!empresaId) return'])
  })

  it('não acusa a versão que SAI SETANDO estado', () => {
    expect(carregamentoRefem(CURADO)).toEqual([])
  })

  /**
   * ⛔⛔ O FURO QUE CUSTOU DUAS VOLTAS — o detector tem que enxergar a família INTEIRA de
   * fetch da casa, **com genérico e tudo**. `fetch(` literal aprovava quem usa a régua.
   */
  it('⛔ enxerga fetchComTimeout — inclusive com o genérico no meio', () => {
    const comHelper = REFEM.replace("await fetch('/api/x')", "await fetchComTimeout<{ a: number }>('/api/x')")
    expect(carregamentoRefem(comHelper)).toEqual(['carregar: if (!empresaId) return'])
    expect(carregamentoRefem(REFEM.replace("await fetch('/api/x')", "await fetchJson('/api/x')")))
      .toEqual(['carregar: if (!empresaId) return'])
  })

  it('⛔ e não acusa GESTO do dono (o "gerar preview" sem arquivo escolhido)', () => {
    expect(carregamentoRefem(GESTO)).toEqual([])
  })

  it('acusa a leitura do cookie httpOnly, e só dela', () => {
    expect(leCookieHttpOnly("const m = document.cookie.match(/current_empresa_id=([^;]+)/)")).toEqual(['current_empresa_id'])
    expect(leCookieHttpOnly("document.cookie = 'tema=escuro'")).toEqual([])
    expect(leCookieHttpOnly('const x = useEmpresa()')).toEqual([])
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
