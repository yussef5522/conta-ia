// Sprint Redesign-Socios (01/07/2026) — testes de blindagem.
//
// Garante que a reorganização visual não regride:
// (a) Nomenclatura "Retirada" (nunca "Ponte") no que o user vê
// (b) Toast do NovaPonteForm renomeado
// (c) Lista /socios: 2 tabs principais, blocos colapsáveis rodapé
// (d) Detalhe /socios/[socioId]: hero premium, sem aba Dados/Nova ponte/Detecção
// (e) SpendInviteForm usa CategoryCombobox
// (f) Filtros no visual novo (Button, não pill preto)

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const root = (p: string) => join(__dirname, '..', '..', p)
const read = (p: string) => readFileSync(root(p), 'utf-8')

describe('a) Nomenclatura user-visible — "Retirada" (nunca "Ponte")', () => {
  it('toast "Ponte criada" virou "Retirada enviada ao PF"', () => {
    const code = read('components/bridges/NovaPonteForm.tsx')
    expect(code).toMatch(/Retirada enviada ao PF/)
    expect(code).not.toMatch(/title:\s*['"]🌉 Ponte criada['"]/)
  })

  it('sidebar item "Sócios" (não mexer) + badge âmbar continuam', () => {
    const code = read('components/sidebar/global-sidebar.tsx')
    expect(code).toMatch(/label="Sócios"/)
  })
})

describe('b) Lista /socios — 2 abas principais', () => {
  const code = read('app/(dashboard)/empresas/[id]/socios/socios-unified-client.tsx')

  it('TabsTrigger "Sócios PF" + "Retiradas pendentes" (2 abas)', () => {
    // Contar abas visíveis (TabsTrigger não é uma tag simples — usamos regex)
    const triggerMatches = code.match(/<TabsTrigger\s+value=/g) ?? []
    expect(triggerMatches.length).toBe(2)
  })

  it('SEM aba "Empresas do Grupo" nos Tabs (virou bloco colapsável)', () => {
    expect(code).not.toMatch(/TabsTrigger\s+value=["']empresas-grupo["']/)
    expect(code).not.toMatch(/TabsContent\s+value=["']empresas-grupo["']/)
  })

  it('Toast localStorage "Novidade Pessoas Vinculadas" removido', () => {
    expect(code).not.toMatch(/showMigrationToast/)
    expect(code).not.toMatch(/socios-unified-toast-seen/)
    expect(code).not.toMatch(/Novidade.*Pessoas Vinculadas/)
  })

  it('bloco colapsável "Empresas do grupo" no rodapé', () => {
    expect(code).toMatch(/showEmpresasGrupo/)
    expect(code).toMatch(/Empresas do grupo/)
    expect(code).toMatch(/aria-expanded=\{showEmpresasGrupo\}/)
  })

  it('bloco colapsável "Detecção automática de Pix" no rodapé', () => {
    expect(code).toMatch(/showPixConfig/)
    expect(code).toMatch(/Detecção automática de Pix/)
    expect(code).toMatch(/Re-analisar transações antigas/)
  })

  it('banner privacidade agora é discreto (linha, não Card)', () => {
    // Banner discreto tem "text-xs text-slate-500" + "leading-relaxed"
    expect(code).toMatch(/Cadastros \(CPF, papel, chaves Pix\) são visíveis/)
    // Não deve ter o Card antigo com border-blue-200
    expect(code).not.toMatch(/border-blue-200 bg-blue-50/)
  })

  it('tabela Sócios PF: coluna "Retiradas" (renomeada de "Suas pontes")', () => {
    expect(code).toMatch(/text-right font-medium">Retiradas</)
    expect(code).not.toMatch(/text-right">Suas pontes</)
  })

  it('tabela tem tabular-nums no CPF + valor', () => {
    expect(code).toMatch(/tabular-nums text-slate-600/)
    expect(code).toMatch(/tabular-nums font-medium text-emerald-600/)
  })
})

describe('c) Detalhe /socios/[socioId] — Hero premium substitui 3 stats cards', () => {
  const code = read(
    'app/(dashboard)/empresas/[id]/socios/[socioId]/socio-detail-client.tsx',
  )

  it('Hero premium com gradient azul + tabular-nums 4xl-5xl', () => {
    expect(code).toMatch(/from-\[#185FA5\] to-\[#0F4A8C\]/)
    expect(code).toMatch(/text-4xl.*tabular-nums.*tracking-tight/)
    expect(code).toMatch(/Total recebido deste sócio/)
  })

  it('Hero usa Framer Motion (mesmo padrão da fila)', () => {
    expect(code).toMatch(/from 'framer-motion'/)
    expect(code).toMatch(/initial=\{\{\s*opacity:\s*0,\s*y:\s*8/)
  })

  it('SEM os 3 stats cards antigos ("Suas pontes" + "Seu total" + "Por tipo")', () => {
    expect(code).not.toMatch(/uppercase text-slate-500">Suas pontes/)
    expect(code).not.toMatch(/uppercase text-slate-500">Seu total/)
    expect(code).not.toMatch(/uppercase text-slate-500">Por tipo/)
  })

  it('subtitle do hero mostra kindDominante quando único', () => {
    expect(code).toMatch(/kindDominante/)
    expect(code).toMatch(/retirada realizada/)
  })
})

describe('d) Detalhe — aba Dados removida (virou card colapsável)', () => {
  const code = read(
    'app/(dashboard)/empresas/[id]/socios/[socioId]/socio-detail-client.tsx',
  )

  it('SEM TabsTrigger "dados" e SEM TabsContent "dados"', () => {
    expect(code).not.toMatch(/<TabsTrigger\s+value=["']dados["']/)
    expect(code).not.toMatch(/<TabsContent\s+value=["']dados["']/)
  })

  it('Card "Dados do sócio" colapsável no header', () => {
    expect(code).toMatch(/showDadosSocio/)
    expect(code).toMatch(/aria-expanded=\{showDadosSocio\}/)
    expect(code).toMatch(/Dados do sócio/)
  })
})

describe('e) Detalhe — aba "+ Nova ponte" removida (virou botão + modal)', () => {
  const code = read(
    'app/(dashboard)/empresas/[id]/socios/[socioId]/socio-detail-client.tsx',
  )

  it('SEM aba "nova-ponte"', () => {
    expect(code).not.toMatch(/<TabsTrigger\s+value=["']nova-ponte["']/)
    expect(code).not.toMatch(/<TabsContent\s+value=["']nova-ponte["']/)
  })

  it('Botão "Criar retirada" no header', () => {
    expect(code).toMatch(/Criar retirada/)
    expect(code).toMatch(/setShowCriarRetirada/)
  })

  it('Modal Dialog com NovaPonteForm + onCancel', () => {
    expect(code).toMatch(/<Dialog\s+open=\{showCriarRetirada\}/)
    expect(code).toMatch(/<DialogTitle[\s\S]{0,120}Criar retirada/)
    // NovaPonteForm dentro do modal com onCancel apontando pra setShowCriarRetirada(false)
    const modalBlock = code.match(/<Dialog\s+open=\{showCriarRetirada\}[\s\S]+?<\/Dialog>/)?.[0] ?? ''
    expect(modalBlock).toMatch(/NovaPonteForm/)
    expect(modalBlock).toMatch(/setShowCriarRetirada\(false\)/)
  })

  it('URL legacy ?action=nova-ponte abre modal (não aba)', () => {
    expect(code).toMatch(
      /useState\(\s*\n\s*searchParams\.get\('action'\)\s*===\s*'nova-ponte'/,
    )
  })
})

describe('f) Detalhe — Detecção Pix vira banner condicional (só se > 0)', () => {
  const code = read(
    'app/(dashboard)/empresas/[id]/socios/[socioId]/socio-detail-client.tsx',
  )

  it('SEM TabsTrigger "deteccao"', () => {
    expect(code).not.toMatch(/<TabsTrigger\s+value=["']deteccao["']/)
    expect(code).not.toMatch(/<TabsContent\s+value=["']deteccao["']/)
  })

  it('Banner condicional txPixDetected.length > 0', () => {
    expect(code).toMatch(/txPixDetected\.length > 0/)
    // Banner mostra "detectada(s)" — texto varia com length
    expect(code).toMatch(/detectad[ao]/)
  })

  it('Endpoint /recategorize-pix continua no código (preservado)', () => {
    const listCode = read('app/(dashboard)/empresas/[id]/socios/socios-unified-client.tsx')
    expect(listCode).toMatch(/\/api\/empresas\/\$\{empresaId\}\/recategorize-pix/)
  })
})

describe('g) Detalhe — aba única "Retiradas realizadas"', () => {
  const code = read(
    'app/(dashboard)/empresas/[id]/socios/[socioId]/socio-detail-client.tsx',
  )

  it('TabsTrigger único "retiradas-realizadas"', () => {
    const matches = code.match(/<TabsTrigger\s+value=["']/g) ?? []
    expect(matches.length).toBe(1)
    expect(code).toMatch(/<TabsTrigger\s+value=["']retiradas-realizadas["']/)
  })

  it('label da aba diz "Retiradas realizadas"', () => {
    expect(code).toMatch(/💸 Retiradas realizadas/)
  })

  it('badge de count no lugar do "(N)" antigo', () => {
    // O bloco <TabsTrigger value="retiradas-realizadas"> tem um <Badge> com
    // agregados.totalCount quando > 0.
    const tabBlock = code.match(/<TabsTrigger\s+value=["']retiradas-realizadas["'][\s\S]+?<\/TabsTrigger>/)?.[0] ?? ''
    expect(tabBlock).toMatch(/<Badge/)
    expect(tabBlock).toMatch(/agregados\.totalCount/)
  })
})

describe('h) Filtros no visual novo (Button, não pill preto)', () => {
  const code = read(
    'app/(dashboard)/empresas/[id]/socios/[socioId]/socio-detail-client.tsx',
  )

  it('NÃO usa mais bg-slate-900 nos filtros', () => {
    // Estilo antigo "bg-slate-900 text-white" era o pill preto do filtro
    const antigo = code.match(/bg-slate-900 text-white/g) ?? []
    expect(antigo.length).toBe(0)
  })

  it('Button variant="secondary" ativo, "ghost" inativo', () => {
    expect(code).toMatch(/filtroTipo === 'todos' \? 'secondary' : 'ghost'/)
    expect(code).toMatch(/filtroPeriodo === p\.value.*\? 'secondary' : 'ghost'|active \? 'secondary' : 'ghost'/)
  })
})

describe('i) SpendInviteForm — CategoryCombobox no lugar de <select>', () => {
  const code = read(
    'app/(dashboard)/empresas/[id]/socios/[socioId]/socio-detail-client.tsx',
  )

  it('CategoryCombobox importado', () => {
    expect(code).toMatch(
      /import\s*\{\s*CategoryCombobox\s*\}\s*from\s+['"]@\/components\/transacoes\/category-combobox['"]/,
    )
  })

  it('CategoryCombobox usado no fluxo de despesa PF', () => {
    // Passa `spendOptions.categories` como categorias
    expect(code).toMatch(/<CategoryCombobox[\s\S]{0,500}spendOptions\.categories/)
    expect(code).toMatch(/onChange=\{\(v\)\s*=>\s*setCategoryId/)
  })
})

describe('j) Preservado — logic bridges intacta', () => {
  it('POST /api/pontes continua funcionando (rota não mexeu)', () => {
    const code = read('app/api/pontes/route.ts')
    expect(code).toMatch(/export async function POST/)
    expect(code).toMatch(/createBridge/)
  })

  it('BridgeDeleteModal ainda usado no detalhe', () => {
    const code = read(
      'app/(dashboard)/empresas/[id]/socios/[socioId]/socio-detail-client.tsx',
    )
    expect(code).toMatch(/<BridgeDeleteModal/)
    expect(code).toMatch(/handleDeleteBridge/)
  })

  it('SpendRegisteredBox/SpendDismissedBox/SpendInviteForm preservados', () => {
    const code = read(
      'app/(dashboard)/empresas/[id]/socios/[socioId]/socio-detail-client.tsx',
    )
    expect(code).toMatch(/function SpendRegisteredBox/)
    expect(code).toMatch(/function SpendDismissedBox/)
    expect(code).toMatch(/function SpendInviteForm/)
  })

  it('Aba "Retiradas pendentes" (nova) preservada — não é essa sprint', () => {
    const listCode = read(
      'app/(dashboard)/empresas/[id]/socios/socios-unified-client.tsx',
    )
    expect(listCode).toMatch(/<RetiradasPendentesTab/)
  })
})
