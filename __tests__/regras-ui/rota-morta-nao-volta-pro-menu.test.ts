// ⛔⛔⛔ ROTA MORTA NÃO VOLTA PRO MENU (faxina de 15/09/2026)
//
// **A régua do dono:** *"o que era DA TELA morre; o que é DO DOMÍNIO fica. E rota morta
// que renasce em menu = vermelho."*
//
// ⛔ **O DEFEITO QUE ISTO FECHA:** a tela dos Pendentes morreu em 15/09 (virou a CAIXA DE
// ENTRADA), o `pendentes-client.tsx` foi deletado — **e o item de menu continuou lá, com
// badge âmbar**, apontando pra uma rota que só redireciona. Menu que leva a uma tela que
// não existe mais é a "porta sem maçaneta" ao contrário: a maçaneta sem a porta.
//
// ⭐ **E O GUARD PROVA OS DOIS LADOS** (a disciplina da mudança de casa, 10/09): o item
// **não pode voltar**, e o **redirect tem que continuar vivo** — link velho em e-mail ou
// no histórico do navegador não pode virar 404.

import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const raiz = process.cwd()
const SIDEBARS = [
  'components/sidebar/global-sidebar.tsx',
  'components/layout/dashboard-shell.tsx',
]

/**
 * ⭐ AS ROTAS APOSENTADAS — quem morrer daqui pra frente entra nesta lista.
 * `redirect` = a rota fica viva só como cortesia; nenhum menu pode apontar pra ela.
 */
const ROTAS_APOSENTADAS = [
  { href: '/pendentes', rotulo: 'Pendentes', virou: 'a CAIXA DE ENTRADA (/conciliacao)', redirect: 'app/(dashboard)/pendentes/page.tsx' },
] as const

/**
 * ⭐ o detector: procura o `href` num `SidebarItem` — **fora de comentário**, senão ele
 * morderia a própria documentação do defeito (a lição do `card-nao-nasce-escondido`).
 */
export function semComentario(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
}

export function menuApontaPara(src: string, href: string): boolean {
  const limpo = semComentario(src)
  // `href={`/pendentes${qs}`}` · href="/pendentes" · href={'/pendentes'}
  return new RegExp(`href=[{"']\\s*\`?['"]?${href}(?![\\w-])`).test(limpo)
}

describe('⛔ nenhum menu aponta pra tela que morreu', () => {
  for (const r of ROTAS_APOSENTADAS) {
    it(`⭐ "${r.rotulo}" não voltou pro menu — virou ${r.virou}`, () => {
      for (const arq of SIDEBARS) {
        const caminho = join(raiz, arq)
        if (!existsSync(caminho)) continue
        const src = readFileSync(caminho, 'utf-8')
        expect(
          menuApontaPara(src, r.href),
          `${arq} voltou a oferecer "${r.rotulo}" — a tela morreu, o item não pode renascer`,
        ).toBe(false)
      }
    })

    /**
     * ⛔ A OUTRA METADE. Guard que só provasse a remoção aprovaria o dia em que alguém
     * apagasse o redirect junto — e aí todo link velho viraria 404.
     */
    it(`⭐ mas a rota ${r.href} CONTINUA viva como redirect (cortesia, não lixo)`, () => {
      const p = join(raiz, r.redirect)
      expect(existsSync(p), `o redirect de ${r.href} foi apagado — link velho virou 404`).toBe(true)
      const src = readFileSync(p, 'utf-8')
      expect(src, 'a página legada deixou de redirecionar').toMatch(/redirect\(/)
      expect(src, 'faltou dizer que é rota legada — o próximo vai achar que é lixo').toMatch(/ROTA LEGADA/i)
    })
  }
})

describe('⛔ o que morreu não deixou arquivo pra alguém remontar', () => {
  const APAGADOS = [
    'app/(dashboard)/empresas/[id]/pendentes/pendentes-client.tsx',
    'components/pendentes/VincularTransferenciaModal.tsx',
    'components/pendentes/SugestaoDeVinculoBanner.tsx',
    'lib/pendentes/row-actions.ts',
    'app/api/conciliacao/sugestoes-pendentes/route.ts',
    'app/api/transferencias/candidatas/[id]/route.ts',
  ]

  for (const f of APAGADOS) {
    it(`⭐ ${f.split('/').pop()} continua fora`, () => {
      expect(existsSync(join(raiz, f)), `${f} voltou — era tela morta`).toBe(false)
    })
  }
})

/**
 * ⚠️⚠️ AS CAPACIDADES GUARDADAS — decisão do dono na faxina: *"guardar e registrar como
 * dívida"*. Elas ficam SEM CHAMADOR de propósito, e o selo no topo do arquivo é o que
 * impede a próxima faxina de as tratar como lixo. **Remoção sem realocação é perda.**
 */
describe('⚠️ capacidade guardada não pode virar lixo silencioso', () => {
  const GUARDADAS = [
    'components/pendentes/AutoCategorizePreviewModal.tsx',
    'components/pendentes/VendorSuggestionBanner.tsx',
    'components/pendentes/AprenderEAplicarModal.tsx',
    'components/pendentes/SourceBadge.tsx',
  ]

  for (const f of GUARDADAS) {
    it(`⭐ ${f.split('/').pop()} existe e diz POR QUE existe`, () => {
      const p = join(raiz, f)
      expect(existsSync(p), `${f} foi apagado — era capacidade a migrar, não lixo`).toBe(true)
      expect(readFileSync(p, 'utf-8')).toMatch(/CAPACIDADE GUARDADA/)
    })
  }
})

// ⭐⭐ REGRA 11 — o detector tem que pegar o defeito que motivou o guard.
describe('o detector morde (auto-teste)', () => {
  const COM_ITEM = 'href={`/pendentes${empresaQs}`}'
  const COM_ASPAS = '<SidebarItem href="/pendentes" label="Pendentes" />'
  const SO_COMENTARIO = '// o item href={`/pendentes`} morreu em 15/09'
  const OUTRA_ROTA = 'href={`/pendentes-de-estoque`}'

  it('acusa o item de volta (template literal)', () => {
    expect(menuApontaPara(COM_ITEM, '/pendentes')).toBe(true)
  })
  it('acusa o item de volta (aspas)', () => {
    expect(menuApontaPara(COM_ASPAS, '/pendentes')).toBe(true)
  })
  it('NÃO acusa a documentação do defeito', () => {
    expect(menuApontaPara(SO_COMENTARIO, '/pendentes')).toBe(false)
  })
  it('NÃO acusa rota de nome parecido', () => {
    expect(menuApontaPara(OUTRA_ROTA, '/pendentes')).toBe(false)
  })
})
