// ⭐⭐ A RÉGUA DO NOME É UMA SÓ (16/11/2026) — `lib/nomes/regua-do-nome.ts`.
//
// ⛔ O CASO: cada caminho que cria/compara nome de item tinha a sua régua (nome exato, `trim().toLowerCase()`,
// `normalizarBusca` com pontuação) e cada uma deixava passar um tipo de gêmeo — 13 grupos no estoque.
// Este guard prova duas coisas, lendo os arquivos SEM comentário (o arquivo que documenta não absolve):
//   1. cada ponto que compara nome de item USA a porta (`reguaDoNome` / `itemComMesmoNome`);
//   2. nenhuma régua local NOVA (`normalize('NFD')`) nasce nos domínios de estoque/vendas/Suit — as
//      legadas estão NOMEADAS abaixo, com o que comparam (nenhuma compara nome de ITEM).
// O comportamento (gêmeo não nasce, unificação com prova) é provado por EXECUÇÃO em
// lib/stock/itens/__tests__/gemeos.integration.test.ts.
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const ler = (rel: string) => readFileSync(join(process.cwd(), rel), 'utf8')
const semComentario = (src: string) =>
  src.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '').replace(/\s\/\/ .*$/gm, '')

const USOS: [string, string, RegExp][] = [
  ['busca de item', 'lib/busca-texto.ts', /reguaDoNome\(termo\)[\s\S]*reguaDoNome\(texto\)/],
  ['entrada manual', 'lib/stock/entrada-manual.ts', /reguaDoNome\(i\.nome\) === reguaDoNome\(nome\)/],
  ['ficha (item de prateleira)', 'lib/stock/producao/fichas.ts', /const alvo = reguaDoNome\(nome\)/],
  ['receita que já existe', 'lib/stock/producao/receita-ja-existe.ts', /const alvo = reguaDoNome\(nome\)/],
  ['renomear em lote', 'lib/stock/nomes/renomear-em-lote.ts', /ocupados\.get\(reguaDoNome\(para\)\)/],
  ['nota fiscal (conferência)', 'lib/stock/confirmar-conferencia.ts', /await itemComMesmoNome\(tx, companyId, it\.mapeado\.nome/],
  ['cadastro (POST /itens)', 'app/api/empresas/[id]/estoque/itens/route.ts', /await itemComMesmoNome\(prisma, companyId, nome, parsed\.data\.categoria\)/],
  ['trava (sanidade)', 'lib/stock/vendas/sanidade-do-import.ts', /canonicoDaGrafia\(/],
  ['vendas (grafia canônica)', 'lib/stock/vendas/grafia-canonica.ts', /return reguaDoNome\(n\)/],
]

describe('1 · cada ponto que compara nome de item USA a régua oficial', () => {
  it.each(USOS)('%s', (_n, arq, uso) => {
    expect(semComentario(ler(arq))).toMatch(uso)
  })
})

/** ⚠️ as réguas LEGADAS dos domínios vigiados — nenhuma compara nome de ITEM (cada uma diz o quê) */
const LEGADAS: Record<string, string> = {
  'lib/nomes/regua-do-nome.ts': 'a DONA da régua',
  'lib/busca-texto.ts': '`normalizarBusca`: chave GRAVADA do nome de fornecedor (xProdNormalizado) — mudar desligaria os mapas',
  'lib/stock/cardapio/secoes.ts': 'palavra-chave de SEÇÃO do cardápio',
  'lib/stock/producao/cara-da-receita.ts': 'palavra-chave da cara da receita',
  'lib/stock/sugestoes.ts': 'palavra-chave de CATEGORIA sugerida pela nota',
  'lib/stock/vendas/grupo-complemento.ts': '`normalizarNome`: grupo do complemento do PDV (vendas)',
  'lib/stock/vendas/razao-sabor-pizza.ts': 'sabor de pizza do PDV (vendas)',
  'lib/stock/vendas/volta-da-revisao.ts': 'âncora da linha revisada do relatório de vendas',
}
const VIGIADOS = ['lib/stock', 'lib/suit', 'lib/nomes', 'components/estoque', 'app/api/empresas/[id]/estoque', 'app/(dashboard)/empresas/[id]/estoque']

function arquivos(dir: string): string[] {
  const abs = join(process.cwd(), dir)
  return readdirSync(abs).flatMap((n) => {
    const rel = `${dir}/${n}`
    if (n === '__tests__' || n === '__fixtures__') return []
    if (statSync(join(abs, n)).isDirectory()) return arquivos(rel)
    return /\.(ts|tsx)$/.test(n) ? [rel] : []
  })
}

describe('2 · ⛔ régua local NOVA não nasce', () => {
  it('nenhum arquivo dos domínios de estoque/vendas/Suit normaliza nome por conta própria fora das legadas nomeadas', () => {
    const fora = [...VIGIADOS.flatMap(arquivos), 'lib/busca-texto.ts']
      .filter((f) => !(f in LEGADAS))
      .filter((f) => /\.normalize\(\s*['"]NFD['"]\s*\)/.test(semComentario(ler(f))))
    expect(fora, 'use reguaDoNome de lib/nomes/regua-do-nome.ts').toEqual([])
  })
  it('as legadas nomeadas existem de verdade (a lista não vira paisagem)', () => {
    for (const f of Object.keys(LEGADAS)) expect(semComentario(ler(f)), f).toMatch(/\.normalize\(\s*['"]NFD['"]\s*\)/)
  })
})
