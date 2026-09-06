// ESTOQUE Fase 3 Parte 1 — GUARD ESTRUTURAL: nenhuma rota de estoque sem trava.
//
// Os 50 handlers de hoje estão travados. O que NÃO está resolvido por eles é o handler
// nº 51: rota nova nasce sem lock e ninguém percebe até alguém de fora usar. Este teste é
// a barreira (REGRA 5 — disciplina vira impossibilidade): o artefato É o arquivo de rota,
// mesma justificativa do guard de isolamento das migrations.
//
// Ele NÃO substitui `enforcement-estoque.integration.test.ts`, que executa os handlers de
// verdade contra o banco — este aqui garante COBERTURA, aquele garante COMPORTAMENTO.

import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync, readdirSync, statSync } from 'fs'
import { join } from 'path'

const RAIZ = join(process.cwd(), 'app', 'api', 'empresas', '[id]', 'estoque')
const CHAVES_VALIDAS = ['stock.view', 'stock.operate', 'stock.manage', 'stock.executar']

function rotas(dir: string): string[] {
  if (!existsSync(dir)) return []
  const out: string[] = []
  for (const e of readdirSync(dir)) {
    const p = join(dir, e)
    if (statSync(p).isDirectory()) out.push(...rotas(p))
    else if (e === 'route.ts') out.push(p)
  }
  return out
}

interface Handler { arquivo: string; verbo: string; perms: string[] }

function handlers(): Handler[] {
  const out: Handler[] = []
  for (const f of rotas(RAIZ)) {
    const src = readFileSync(f, 'utf-8')
    const marcas = [...src.matchAll(/export async function (GET|POST|PATCH|PUT|DELETE)\s*\(/g)]
      .map((m) => ({ pos: m.index!, verbo: m[1] }))
    for (let i = 0; i < marcas.length; i++) {
      const corpo = src.slice(marcas[i].pos, i + 1 < marcas.length ? marcas[i + 1].pos : src.length)
      // ⚠️ entende as DUAS formas: chave única e LISTA (a janela da cozinha aceita
      // `stock.executar` OU `stock.view` — funcionário e gestor pela mesma porta).
      const perms = [...corpo.matchAll(/(?:guardStock|requireStock)\(request, companyId, (\[[^\]]*\]|'[a-z.]+')\)/g)]
        .flatMap((m) => [...m[1].matchAll(/'([a-z.]+)'/g)].map((x) => x[1]))
      out.push({ arquivo: f.slice(RAIZ.length + 1), verbo: marcas[i].verbo, perms: [...new Set(perms)] })
    }
  }
  return out
}

describe('toda rota de estoque tem trava', () => {
  const hs = handlers()

  it('achou handlers pra checar (o teste não passa por estar vazio)', () => {
    expect(hs.length).toBeGreaterThanOrEqual(50)
  })

  it.each(hs.map((h) => [`${h.arquivo} ${h.verbo}`, h] as const))('%s exige uma chave de estoque', (_, h) => {
    expect(h.perms.length, `${h.arquivo} ${h.verbo} não chama guardStock/requireStock`).toBeGreaterThan(0)
    for (const p of h.perms) expect(CHAVES_VALIDAS, `chave inválida em ${h.arquivo} ${h.verbo}`).toContain(p)
  })

  it('o check ANTIGO (userCompany.findFirst) não voltou pra nenhuma rota de estoque', () => {
    const comCheckAntigo = rotas(RAIZ).filter((f) => readFileSync(f, 'utf-8').includes('userCompany.findFirst'))
    expect(comCheckAntigo.map((f) => f.slice(RAIZ.length + 1))).toEqual([])
  })

  // ⚠️ A REGRA CONTINUA "ler é ler" — com UMA exceção nomeada, e o motivo importa: existe
  // uma leitura que é sensível POR SI. O comparativo entre pessoas é decisão do dono
  // ("ranking só pra stock.manage — nunca na tela do funcionário nem em tela compartilhada"),
  // então ali a chave alta protege o CONTEÚDO, não a escrita. Afrouxar a regra pra todo GET
  // teria escondido isso; a exceção com motivo escrito deixa à vista.
  const LEITURA_SENSIVEL: Record<string, string> = {
    'producao/relatorio-pessoas/route.ts':
      'comparativo de desempenho entre pessoas — decisão do dono (06/09): só gerência, nunca em tela compartilhada da cozinha',
  }

  it('GET nunca exige operar/gerenciar (ler é ler), fora as leituras sensíveis nomeadas', () => {
    const LEITURA = ['stock.view', 'stock.executar']
    const errados = hs.filter((h) => h.verbo === 'GET'
      && h.perms.some((p) => !LEITURA.includes(p))
      && !LEITURA_SENSIVEL[h.arquivo])
    expect(errados.map((h) => `${h.arquivo} ${h.verbo} → ${h.perms.join(',')}`)).toEqual([])
  })

  it('⚠️ e toda leitura sensível declarada existe de verdade (a lista não vira paisagem)', () => {
    for (const arquivo of Object.keys(LEITURA_SENSIVEL)) {
      const achou = hs.some((h) => h.arquivo === arquivo && h.verbo === 'GET')
      expect(achou, `exceção declarada pra rota que não existe mais: ${arquivo}`).toBe(true)
    }
  })

  it('nenhuma escrita (POST/PATCH/PUT/DELETE) se contenta com stock.view', () => {
    const errados = hs.filter((h) => h.verbo !== 'GET' && h.perms.includes('stock.view'))
    expect(errados.map((h) => `${h.arquivo} ${h.verbo} → ${h.perms.join(',')}`)).toEqual([])
  })

  // ⛔⛔ A CERCA DA CHAVE NOVA (06/09). `stock.executar` é o papel mais fraco do sistema — o
  // tablet compartilhado da cozinha, identificado por PIN. Se um dia alguém marcar uma rota
  // qualquer com ela "porque o operador precisava", a cozinha inteira ganha aquele poder.
  // Escrita com `stock.executar` só existe onde ela nasceu: iniciar e finalizar a PRÓPRIA
  // tarefa. Rota nova fora daqui com essa chave fica VERMELHA.
  it('⛔ escrita com stock.executar existe SÓ na janela da cozinha', () => {
    const PERMITIDO = /^producao\/minhas-tarefas\//
    const fora = hs.filter((h) => h.verbo !== 'GET' && h.perms.includes('stock.executar') && !PERMITIDO.test(h.arquivo))
    expect(fora.map((h) => `${h.arquivo} ${h.verbo}`)).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// ⚠️ AS ROTAS DE ESTOQUE QUE VIVEM FORA DE /empresas/[id]/estoque (30/08/2026)
// ---------------------------------------------------------------------------
//
// O guard acima varre só `app/api/empresas/[id]/estoque`. Ao criar a rota do AGENTE de
// impressão (`app/api/estoque/agente-impressao`) percebi que ela ficaria **invisível** pra
// ele — e uma rota de estoque sem RBAC que nenhum guard enxerga é exatamente o buraco que
// o guard existe pra fechar.
//
// Aqui a exceção é ALLOWLIST com motivo escrito: o agente roda num PC de cozinha, não tem
// sessão de navegador, e se autentica por TOKEN próprio. Rota nova nesse diretório sem
// entrar na lista quebra o teste — que é o ponto.
describe('⭐ rotas de estoque FORA do caminho padrão são exceção nomeada', () => {
  const RAIZ_FORA = join(process.cwd(), 'app', 'api', 'estoque')
  /** caminho → por que não usa RBAC de sessão */
  const EXCECOES: Record<string, string> = {
    'agente-impressao/route.ts':
      'o agente da impressora roda numa máquina da cozinha, sem cookie de login; autentica por token por impressora, com escopo mínimo (só pega ZPL da fila e diz se imprimiu)',
  }

  const achadas = rotas(RAIZ_FORA).map((f) => f.slice(RAIZ_FORA.length + 1))

  it('⭐⭐ toda rota fora do padrão está na allowlist com motivo', () => {
    for (const r of achadas) {
      expect(EXCECOES[r], `rota de estoque sem trava e sem exceção nomeada: ${r}`).toBeTruthy()
    }
  })

  it('⭐ a do agente autentica por TOKEN (não fica aberta)', () => {
    const src = readFileSync(join(RAIZ_FORA, 'agente-impressao', 'route.ts'), 'utf-8')
    expect(src).toMatch(/impressoraPorToken/)
    // ⚠️ e responde 401 seco — sem diferenciar "token inexistente" de "impressora inativa"
    expect((src.match(/status: 401/g) ?? []).length).toBeGreaterThanOrEqual(2)
  })

  it('⭐⭐ está no PUBLIC_API do proxy — senão o gate de sessão a mata antes de chegar', () => {
    // ⚠️ ACHADO NA PROVA EM PROD: sem isto o proxy devolvia "Sessão expirada" (401) antes
    // de a rota rodar, e o agente NUNCA conseguiria puxar trabalho. O 401 do proxy é
    // idêntico ao 401 de token errado — dava pra passar semanas achando que era o token.
    const proxy = readFileSync(join(process.cwd(), 'proxy.ts'), 'utf-8')
    expect(proxy).toMatch(/'\/api\/estoque\/agente-impressao'/)
  })

  it('⛔⛔ e por estar no PUBLIC_API, ela É obrigada a validar o token', () => {
    // a dupla dependência: pública no proxy + sem validação própria = rota ABERTA.
    const proxy = readFileSync(join(process.cwd(), 'proxy.ts'), 'utf-8')
    const src = readFileSync(join(RAIZ_FORA, 'agente-impressao', 'route.ts'), 'utf-8')
    const ehPublica = /'\/api\/estoque\/agente-impressao'/.test(proxy)
    const validaToken = /impressoraPorToken/.test(src)
    expect(ehPublica && validaToken).toBe(true)
  })

  it('⚠️ o escopo é mínimo: o agente não lê estoque, nota nem dinheiro', () => {
    const src = readFileSync(join(RAIZ_FORA, 'agente-impressao', 'route.ts'), 'utf-8')
    for (const proibido of ['stockMovement', 'stockNfe', 'transaction.', 'stockItem']) {
      expect(src).not.toContain(proibido)
    }
  })
})
