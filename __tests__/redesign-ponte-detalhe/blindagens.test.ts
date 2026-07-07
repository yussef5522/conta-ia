// Sprint Redesign-Ponte-Detalhe (06/07/2026) — blindagens estáticas.
//
// Cobre:
//   (a) Loader enriquecido: getBridgeDetailForPage com includes ricos + guard
//   (b) Route: GET usa getBridgeDetailForPage
//   (c) Page: hero gradiente + timeline 3 nós + microinteração ciclo
//   (d) Page: painel spend inline reusa POST /api/pontes/[id]/spend + sugestão
//   (e) Page: excluir vira link discreto (não botão vermelho no rodapé)

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const root = (p: string) => join(__dirname, '..', '..', p)
const read = (p: string) => readFileSync(root(p), 'utf-8')

describe('a) Loader: getBridgeDetailForPage rich includes + OWNER guard', () => {
  const code = read('lib/bridges/queries.ts')

  it('exporta getBridgeDetailForPage', () => {
    expect(code).toMatch(/export\s+async\s+function\s+getBridgeDetailForPage/)
  })

  it('include traz spendTransaction com category + bankAccount', () => {
    const block = code.match(/getBridgeDetailForPage[\s\S]+?prisma\.pJtoPFBridge\.findUnique[\s\S]+?\}\)/)
    expect(block).toBeTruthy()
    expect(block![0]).toMatch(/spendTransaction:\s*\{[\s\S]{0,400}category:/)
    expect(block![0]).toMatch(/spendTransaction:\s*\{[\s\S]{0,400}bankAccount:/)
  })

  it('include traz pjTransaction.bankAccount.company + category', () => {
    const block = code.match(/getBridgeDetailForPage[\s\S]+?prisma\.pJtoPFBridge\.findUnique[\s\S]+?\}\)/)
    expect(block![0]).toMatch(/pjTransaction:\s*\{[\s\S]{0,600}company:/)
    expect(block![0]).toMatch(/pjTransaction:\s*\{[\s\S]{0,600}category:/)
  })

  it('include traz pfTransaction.bankAccount + category', () => {
    const block = code.match(/getBridgeDetailForPage[\s\S]+?prisma\.pJtoPFBridge\.findUnique[\s\S]+?\}\)/)
    expect(block![0]).toMatch(/pfTransaction:\s*\{[\s\S]{0,400}bankAccount:/)
    expect(block![0]).toMatch(/pfTransaction:\s*\{[\s\S]{0,400}category:/)
  })

  it('include traz createdBy (autor)', () => {
    const block = code.match(/getBridgeDetailForPage[\s\S]+?prisma\.pJtoPFBridge\.findUnique[\s\S]+?\}\)/)
    expect(block![0]).toMatch(/createdBy:\s*\{[\s\S]{0,120}select/)
  })

  it('mantém guard OWNER-ou-CREATOR (privacidade)', () => {
    // Confirma no arquivo inteiro (a função é longa; regex de bloco não pega).
    expect(code).toMatch(/checkProfileAccess\(userId,\s*bridge\.profileId,\s*['"]OWNER['"]\)/)
    expect(code).toMatch(/isCreator\s*=\s*bridge\.createdById\s*===\s*userId/)
    // 404 anonimizado se nenhum
    expect(code).toMatch(/!isOwner\s*&&\s*!isCreator[\s\S]{0,240}BRIDGE_NOT_FOUND/)
  })

  it('getBridgeDetail original (backward-compat) permanece exportado', () => {
    // NÃO REMOVER — testes/callers antigos ainda dependem.
    expect(code).toMatch(/export\s+async\s+function\s+getBridgeDetail\(/)
  })
})

describe('b) Route GET /api/pontes/[id] usa loader enriquecido', () => {
  const code = read('app/api/pontes/[id]/route.ts')

  it('importa e usa getBridgeDetailForPage no GET', () => {
    expect(code).toMatch(/getBridgeDetailForPage/)
    const getBlock = code.match(/export\s+async\s+function\s+GET[\s\S]+?^\}/m)
    expect(getBlock).toBeTruthy()
    expect(getBlock![0]).toMatch(/getBridgeDetailForPage\(ctx\.user\.id,\s*id\)/)
  })
})

describe('c) Page: hero gradiente + timeline 3 nós + microinteração', () => {
  const code = read('app/(dashboard)/pontes/[id]/page.tsx')

  it('usa Framer Motion (motion + AnimatePresence)', () => {
    expect(code).toMatch(
      /import\s*\{\s*AnimatePresence,\s*motion\s*\}\s*from\s*['"]framer-motion['"]/,
    )
  })

  it('HERO com gradiente azul + valor tabular-nums grande', () => {
    // Padrão: bg-gradient-to-br from-[#1E3A8A] via-[#1E40AF] to-[#0F4A8C]
    expect(code).toMatch(
      /bg-gradient-to-br\s+from-\[#1E3A8A\][\s\S]{0,120}to-\[#0F4A8C\]/,
    )
    // Valor com text-4xl + tabular-nums + sm:text-5xl (ordem Tailwind livre)
    expect(code).toMatch(/text-4xl[\s\S]{0,120}tabular-nums[\s\S]{0,120}sm:text-5xl/)
  })

  it('renderiza 3 TimelineNode (Saiu, Entrou, Foi gasto?)', () => {
    // 3 usos do componente TimelineNode
    const matches = code.match(/<TimelineNode\s/g)
    expect(matches).not.toBeNull()
    expect(matches!.length).toBe(3)
  })

  it('microinteração cyclePulse dispara pulso quando spend criado', () => {
    expect(code).toMatch(/setCyclePulse\(true\)/)
    // Passa pulse={cyclePulse} pros nós
    expect(code).toMatch(/pulse=\{cyclePulse[\s\S]{0,40}\}/)
  })

  it('toast de "Ciclo completo" após criar spend', () => {
    expect(code).toMatch(/Ciclo completo/)
  })

  it('carrega dados via GET /api/pontes/{id} com credentials', () => {
    expect(code).toMatch(
      /fetch\(`\/api\/pontes\/\$\{id\}`,\s*\{\s*credentials:\s*['"]include['"]\s*\}\)/,
    )
  })

  it('skeleton de loading (não spinner cru)', () => {
    // 3 blocos animate-pulse
    expect(code).toMatch(/animate-pulse[\s\S]{0,300}animate-pulse[\s\S]{0,300}animate-pulse/)
  })
})

describe('d) Page: painel spend inline reusa fluxo A/B', () => {
  const code = read('app/(dashboard)/pontes/[id]/page.tsx')

  it('importa suggestSpendCategory', () => {
    expect(code).toMatch(
      /import\s*\{\s*suggestSpendCategory\s*\}\s*from\s*['"]@\/lib\/bridges\/suggest-spend-category['"]/,
    )
  })

  it('sugestão automática via useMemo pré-seleciona categoria', () => {
    expect(code).toMatch(
      /suggestSpendCategory\(bridge\.pjTransaction\.description\)/,
    )
    // Match case-insensitive por nome
    expect(code).toMatch(
      /c\.name\.toLowerCase\(\)\s*===\s*suggestion\.categoryName\.toLowerCase\(\)/,
    )
  })

  it('POST /api/pontes/{id}/spend com body correto', () => {
    expect(code).toMatch(
      /fetch\(`\/api\/pontes\/\$\{bridge\.bridge\.id\}\/spend`,[\s\S]{0,600}method:\s*['"]POST['"]/,
    )
    expect(code).toMatch(/amount:\s*valorNum/)
    expect(code).toMatch(/categoryId,/)
    expect(code).toMatch(/bankAccountId,/)
  })

  it('fetch categorias EXPENSE do perfil quando painel abre', () => {
    expect(code).toMatch(
      /fetch\(`\/api\/perfis\/\$\{pid\}\/categorias\?type=EXPENSE`/,
    )
  })

  it('fetch contas PF do perfil quando painel abre', () => {
    expect(code).toMatch(/fetch\(`\/api\/perfis\/\$\{pid\}\/contas`/)
  })

  it('sugestão marca badge "sugerido pela IA"', () => {
    expect(code).toMatch(/sugerido pela IA/)
  })

  it('painel abre/fecha via AnimatePresence (slide down elegante)', () => {
    expect(code).toMatch(
      /<AnimatePresence\s+initial=\{false\}>[\s\S]{0,800}key="spend-panel"/,
    )
  })

  it('"Agora não" chama PATCH acknowledged=true', () => {
    expect(code).toMatch(
      /method:\s*['"]PATCH['"][\s\S]{0,240}acknowledged:\s*true/,
    )
  })
})

describe('e) Page: excluir discreto (vermelho SÓ no modal)', () => {
  const code = read('app/(dashboard)/pontes/[id]/page.tsx')

  it('excluir é um <button> link discreto no rodapé (text-slate-400)', () => {
    // Padrão: className com text-slate-400 hover:text-rose-600
    expect(code).toMatch(
      /text-slate-400[\s\S]{0,240}hover:text-rose-600[\s\S]{0,300}Excluir esta ponte/,
    )
  })

  it('NÃO usa Button variant="destructive" na tela (era o botão gritante)', () => {
    // No rodapé antigo tinha <Button variant="destructive">. Não deve mais
    // aparecer no client (o vermelho fica só no BridgeDeleteModal).
    expect(code).not.toMatch(/variant="destructive"[\s\S]{0,200}Excluir/)
  })

  it('confirma via BridgeDeleteModal (reusado, vermelho SÓ ali)', () => {
    expect(code).toMatch(
      /<BridgeDeleteModal[\s\S]{0,400}onConfirm=\{handleDelete\}/,
    )
  })
})
