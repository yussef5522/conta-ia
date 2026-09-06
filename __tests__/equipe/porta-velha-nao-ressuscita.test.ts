// ⛔⛔ A PORTA VELHA DO CADASTRO DE GENTE NÃO RESSUSCITA (06/09/2026).
//
// **O pedido do dono, textual:** *"INVENTARIA os pontos que apontam pra porta velha e liga
// todos na nova. Lista o que achou — não quero descobrir um botão órfão daqui a um mês."*
//
// ⚠️ ESTE GUARD É ESTRUTURAL E ASSUMIDO COMO TAL (o projeto roda em `environment: node`, sem
// jsdom — não dá pra clicar). Ele trava o que quebrou de fato: **um link apontando pro lugar
// morto**. A prova de COMPORTAMENTO é a navegação contra prod.
//
// ⭐ É o mesmo desenho do guard que impediu o lixão do `/estoque/fichas` de ressuscitar em
// 03/09: lá, "item de menu apontando pra `/estoque/contas-a-pagar` quebra o teste".

import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync, existsSync } from 'fs'
import { join } from 'path'

const RAIZ = process.cwd()
/**
 * ⚠️ O PADRÃO CAÇA **NAVEGAÇÃO**, não a string solta.
 *
 * A 1ª versão procurava `'producao/cadastros'` em qualquer lugar e acusou TRÊS rotas de API
 * que só importam `@/lib/stock/producao/cadastros` — a lib de setores/colaboradores, que
 * continua viva e correta. Guard que grita em import é guard que se aprende a ignorar.
 *
 * O que interessa é o que LEVA alguém até a tela morta: `href=`, `router.push`, `redirect`.
 */
const NAVEGA_PRA_PORTA_VELHA = /(href=|router\.push\(|redirect\()[^\n]{0,80}\/estoque\/producao\/cadastros(?!\/pin)/

function arquivos(dir: string, ext: RegExp): string[] {
  if (!existsSync(dir)) return []
  const out: string[] = []
  for (const e of readdirSync(dir)) {
    if (e === 'node_modules' || e === '.next' || e.startsWith('.next-build')) continue
    const p = join(dir, e)
    if (statSync(p).isDirectory()) out.push(...arquivos(p, ext))
    else if (ext.test(e)) out.push(p)
  }
  return out
}

/** todo arquivo de tela/rota do app (fora de teste) */
const FONTES = [...arquivos(join(RAIZ, 'app'), /\.tsx?$/), ...arquivos(join(RAIZ, 'components'), /\.tsx?$/)]
  .filter((f) => !f.includes('__tests__'))
  .map((f) => ({ arquivo: f.slice(RAIZ.length + 1), src: readFileSync(f, 'utf-8') }))

describe('⛔⛔ nenhum link aponta pro lugar morto', () => {
  /**
   * O que PODE citar a porta velha, e por quê. ⚠️ Allowlist com motivo — entrar aqui exige
   * dizer o porquê, senão a lista vira "o que ignorar".
   */
  const PERMITIDO: Record<string, string> = {
    'app/(dashboard)/empresas/[id]/estoque/producao/cadastros/page.tsx':
      'é a própria porta velha — hoje um redirect pra /equipe',
    // ⚠️ o `equipe-client` usa a ROTA DE API do PIN (`.../cadastros/pin`), que continua viva
    // e é a ÚNICA que grava PIN (REGRA 4) — o padrão já a exclui com `(?!\/pin)`, e a entrada
    // fica aqui como registro do porquê.
  }

  it('⭐ achou fontes pra varrer (não passa por estar vazio)', () => {
    expect(FONTES.length).toBeGreaterThan(100)
  })

  it('⛔⛔ nenhuma TELA linka pra /producao/cadastros', () => {
    const culpados = FONTES
      .filter((f) => NAVEGA_PRA_PORTA_VELHA.test(f.src) && !PERMITIDO[f.arquivo])
      .map((f) => f.arquivo)
    expect(culpados, 'botão órfão apontando pro lugar morto').toEqual([])
  })

  it('⛔ e a porta velha é REDIRECT — não uma segunda tela de cadastro', () => {
    const src = readFileSync(join(RAIZ, 'app/(dashboard)/empresas/[id]/estoque/producao/cadastros/page.tsx'), 'utf-8')
    expect(src).toMatch(/redirect\(/)
    expect(src).toMatch(/\/equipe/)
    // ⛔ e NÃO renderiza formulário nenhum: duas portas de cadastro é como nasce bagunça
    expect(src).not.toMatch(/CadastrarPessoaModal|<input|<form/)
  })

  it('⭐⭐ a Produção tem o ATALHO pra Equipe, e ele não está escondido num formulário', () => {
    const src = readFileSync(join(RAIZ, 'app/(dashboard)/empresas/[id]/estoque/producao/page.tsx'), 'utf-8')
    expect(src).toMatch(/href="\/equipe/)
    // ⛔⛔ O DEFEITO ERA A POSIÇÃO: o link antigo vivia DENTRO do `NovaOrdem`, e por isso só
    // aparecia depois de clicar em "nova ordem". O atalho tem que estar ANTES desse
    // componente no arquivo — ou seja, no cabeçalho da tela.
    const posLink = src.indexOf('href="/equipe')
    const posNovaOrdem = src.indexOf('function NovaOrdem')
    expect(posLink).toBeGreaterThan(-1)
    expect(posLink, 'o atalho voltou pra dentro do formulário de nova ordem').toBeLessThan(posNovaOrdem)
  })

  it('⭐ a sidebar leva pra Equipe (e o link antigo /usuarios não fica órfão)', () => {
    const src = readFileSync(join(RAIZ, 'components/sidebar/global-sidebar.tsx'), 'utf-8')
    expect(src).toMatch(/href="\/equipe"/)
    expect(src).toMatch(/label="Equipe"/)
    // ⚠️ `/usuarios` continua existindo como rota (link antigo não quebra) e o item de menu
    // fica ATIVO nela — senão quem chegar por um link velho vê o menu sem nada marcado.
    expect(src).toMatch(/pathname\.startsWith\('\/usuarios'\)/)
  })

  it('⛔ e a rota /usuarios ainda existe — redirect antigo não pode dar 404', () => {
    expect(existsSync(join(RAIZ, 'app/(dashboard)/usuarios/page.tsx'))).toBe(true)
  })
})
