// ⛔⛔⛔ PÁGINA QUE ABRE COM DADO QUE NÃO VEM (09/09/2026) — a QUARTA volta das "duas portas".
//
// **O dono:** *"a PÁGINA abre, o DADO não: /equipe renderiza mas mostra 'Não consegui
// carregar a equipe' + 'ninguém da cozinha cadastrado ainda' — com 5+ pessoas cadastradas."*
//
// **AS QUATRO VOLTAS, e cada uma escapou do guard da anterior:**
//   1ª (08/09) a PORTA da página era mais restrita que a AÇÃO que o servidor já autorizava
//   2ª (08/09) a página abriu pra `stock.manage`… e o MENU ficou em `user.invite`
//   3ª (09/09) guard novo: *o item do menu não pode exigir mais que a página*
//   4ª (09/09) **a ROTA DA LISTA ficou pra trás** — e o efeito foi PIOR que um 403 na cara:
//              a página abre, a chamada morre, e a tela afirma *"ninguém cadastrado"* com
//              **17 pessoas no banco**. Erro disfarçado de vazio.
//
// ⭐ **POR QUE O GUARD ANTERIOR NÃO PEGOU, e é a lição:** ele comparava MENU × PÁGINA — as
// duas portas que eu conhecia. **A terceira porta é a API que a página chama depois de
// abrir**, e status 200 da página não diz nada sobre ela. *Página que abre com dado que não
// vem é exatamente o que o teste de rota não pega.*
//
// ⛔ Este guard fecha a família: pra CADA papel que a página aceita, TODA rota que ela chama
// tem que responder — e uma rota nova na página sem entrar aqui fica vermelha.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { permissionMatches } from '@/lib/auth/permissions'

const raiz = process.cwd()
const ler = (p: string) => readFileSync(join(raiz, p), 'utf-8')

/** o `requirePermission` do server component — o que a PÁGINA aceita */
function permsDaPagina(arquivo: string): string[] {
  const m = /requirePermission:\s*(\[[^\]]*\]|'[^']*')/.exec(ler(arquivo))
  return m ? [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]) : []
}

/** as rotas que o CLIENTE dessa página busca (o que a Network mostraria) */
function rotasQueOClienteChama(arquivo: string): string[] {
  const src = ler(arquivo)
  const out = new Set<string>()
  for (const m of src.matchAll(/fetch\(\s*`([^`]+)`/g)) {
    // normaliza: tira template e querystring, deixa o caminho
    // ⚠️ o `${verInativos ? '?inativos=1' : ''}` do fim vira ":x" colado no caminho — tira.
    const url = m[1].replace(/\$\{[^}]*\}/g, ':x').split('?')[0].replace(/(?<=[a-zA-Z]):x$/, '')
    if (url.startsWith('/api/')) out.add(url)
  }
  return [...out]
}

/** o que a ROTA exige — `guardStock('x')`, lista, ou `requirePermission('x')` */
function permsDaRota(arquivo: string, metodo: 'GET' | 'POST'): string[] {
  const src = ler(arquivo)
  const corpo = src.split(new RegExp(`export async function ${metodo}\\b`))[1] ?? ''
  const trecho = corpo.split('export async function')[0]
  const chaves = new Set<string>()
  for (const m of trecho.matchAll(/guardStock\([^,]+,[^,]+,\s*(\[[^\]]*\]|'[^']*')/g)) {
    for (const k of m[1].matchAll(/'([^']+)'/g)) chaves.add(k[1])
  }
  for (const m of trecho.matchAll(/permissionMatches\(\[p\],\s*'([^']+)'\)/g)) chaves.add(m[1])
  for (const m of trecho.matchAll(/requirePermission\('([^']+)'\)/g)) chaves.add(m[1])
  return [...chaves]
}

/** ⚠️ as chaves REAIS dos papéis, conferidas no banco de prod em 09/09 */
const PAPEIS: Record<string, string[]> = {
  OWNER: ['*'],
  GERENTE_ESTOQUE: ['stock.executar', 'stock.manage', 'stock.operate', 'stock.view'],
  EXECUTOR_PRODUCAO: ['stock.executar'],
}

describe('⛔⛔ /equipe — quem entra pela porta consegue LER a lista', () => {
  const PAGINA = 'app/(dashboard)/equipe/page.tsx'
  const CLIENTE = 'components/equipe/equipe-client.tsx'
  const ROTA_LISTA = 'app/api/empresas/[id]/equipe/route.ts'

  it('⭐ a página aceita user.invite OU stock.manage', () => {
    expect(permsDaPagina(PAGINA).sort()).toEqual(['stock.manage', 'user.invite'])
  })

  it('⛔⛔ A ROTA DA LISTA ACEITA O MESMO CONJUNTO — era ela que estava pra trás', () => {
    expect(permsDaRota(ROTA_LISTA, 'GET').sort()).toEqual(permsDaPagina(PAGINA).sort())
  })

  it('⛔⛔ O CASO CRISTIAN: com as 4 chaves reais, a lista CARREGA', () => {
    const dele = PAPEIS.GERENTE_ESTOQUE
    const daRota = permsDaRota(ROTA_LISTA, 'GET')
    expect(daRota.some((k) => permissionMatches(dele, k)), 'a lista voltaria 403 e a tela diria "ninguém cadastrado"').toBe(true)
  })

  it('⛔ e o tablet continua fora — abrir a leitura não abriu tudo', () => {
    const tablet = PAPEIS.EXECUTOR_PRODUCAO
    expect(permsDaRota(ROTA_LISTA, 'GET').some((k) => permissionMatches(tablet, k))).toBe(false)
  })

  it('⭐ GERENCIAR ACESSO continua sendo user.invite — ler ≠ mexer', () => {
    // ⚠️ a página passa a flag e o cliente desabilita convite/papel/aparelho com o motivo.
    expect(ler(PAGINA)).toMatch(/podeGerenciarAcessos=\{permissionMatches\(access\.permissions, 'user\.invite'\)\}/)
    expect(ler(CLIENTE)).toContain('!podeGerenciarAcessos')
    expect(ler(CLIENTE)).toMatch(/disabled=\{[^}]*!podeGerenciarAcessos\}/)
  })

  it('⛔⛔ TODA rota que o cliente chama é alcançável pelos papéis da página', () => {
    // ⭐ É ESTE O GUARD DA FAMÍLIA: rota nova na tela sem trava compatível fica vermelha aqui,
    // em vez de virar "ninguém cadastrado" na cara do dono.
    const chamadas = rotasQueOClienteChama(CLIENTE)
    expect(chamadas.length, 'o teste não pode passar por não achar fetch nenhum').toBeGreaterThanOrEqual(3)

    const ROTA_POR_URL: Record<string, string> = {
      '/api/empresas/:x/equipe': ROTA_LISTA,
      '/api/empresas/:x/equipe/colaborador': 'app/api/empresas/[id]/equipe/colaborador/route.ts',
      '/api/empresas/:x/equipe/aparelho': 'app/api/empresas/[id]/equipe/aparelho/route.ts',
      '/api/empresas/:x/estoque/producao/cadastros/pin': 'app/api/empresas/[id]/estoque/producao/cadastros/pin/route.ts',
    }
    const naoMapeadas = chamadas.filter((c) => !ROTA_POR_URL[c])
    expect(naoMapeadas, `rota nova na tela sem entrar no guard: ${naoMapeadas.join(', ')}`).toEqual([])

    // a LEITURA (a lista) tem que abrir pros dois papéis da página
    for (const papel of ['OWNER', 'GERENTE_ESTOQUE']) {
      const chaves = PAPEIS[papel]
      const daLista = permsDaRota(ROTA_LISTA, 'GET')
      expect(daLista.some((k) => permissionMatches(chaves, k)), `${papel} não lê a lista`).toBe(true)
    }
  })
})

describe('⛔ erro e vazio nunca aparecem juntos', () => {
  it('⛔⛔ o estado vazio só renderiza quando NÃO houve erro', () => {
    // ⚠️ "Não consegui carregar" + "ninguém cadastrado" na mesma tela: quando a carga falha o
    // sistema NÃO SABE se está vazio, e afirmar que está é inventar.
    const src = ler('components/equipe/equipe-client.tsx')
    expect(src).toMatch(/\)\s*:\s*erro\s*\?\s*null\s*:\s*lista\.length === 0/)
  })

  it('⭐ e a mensagem distingue PERMISSÃO de falha de rede', () => {
    const src = ler('components/equipe/equipe-client.tsx')
    expect(src).toContain('Sem permissão pra ver a equipe')
    expect(src).toContain('r?.status === 403')
  })
})
