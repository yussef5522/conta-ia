// Sprint Fluxo-Unificado-Retirada (30/06/2026) — testes de blindagem.
//
// Bloqueia regressão dos contratos internos que fazem o fluxo funcionar:
// (a) endpoint /retiradas-pendentes tem a query certa
// (b) NovaPonteForm aceita as 4 props initial* aditivas
// (c) CategoryCombobox tem askIfBridge + bridgeContext opt-in
// (d) BridgeConviteModal existe e monta 3 CTAs
// (e) Aba nova está integrada na tela /empresas/[id]/socios
// (f) Badge sidebar puxa da mesma fonte
// (g) revalidateTag disparado ao criar ponte

import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'

const root = (p: string) => join(__dirname, '..', '..', p)
const read = (p: string) => readFileSync(root(p), 'utf-8')

describe('a) endpoint /retiradas-pendentes', () => {
  const p = 'app/api/empresas/[id]/retiradas-pendentes/route.ts'
  it('existe', () => {
    expect(existsSync(root(p))).toBe(true)
  })
  const code = read(p)
  it('filtra por type=DEBIT + status=RECONCILED', () => {
    expect(code).toMatch(/type:\s*['"]DEBIT['"]/)
    expect(code).toMatch(/status:\s*['"]RECONCILED['"]/)
  })
  it('exige categoryId não null (só categorizadas)', () => {
    expect(code).toMatch(/categoryId:\s*\{\s*not:\s*null\s*\}/)
  })
  it('filtra tx sem ponte (bridge: null)', () => {
    expect(code).toMatch(/bridge:\s*null/)
  })
  it('inclui DISTRIBUICAO_LUCROS E Pró-labore (DESPESAS_PESSOAL + nome)', () => {
    expect(code).toMatch(/DISTRIBUICAO_LUCROS/)
    expect(code).toMatch(/DESPESAS_PESSOAL/)
    expect(code).toMatch(/pro-labore/)
  })
  it('cache 60s com tag `retiradas-pendentes:${empresaId}`', () => {
    expect(code).toMatch(/unstable_cache/)
    expect(code).toMatch(/retiradas-pendentes:\$\{companyId\}/)
    expect(code).toMatch(/revalidate:\s*60/)
  })
  it('RBAC transaction.view exigido', () => {
    expect(code).toMatch(/requirePermission\(['"]transaction\.view['"]\)/)
  })
  it('response inclui total + totalAmount + tx[]', () => {
    expect(code).toMatch(/total:/)
    expect(code).toMatch(/totalAmount/)
  })
})

describe('b) endpoint /ultima-ponte-destino', () => {
  const p = 'app/api/empresas/[id]/socios/[socioId]/ultima-ponte-destino/route.ts'
  it('existe', () => {
    expect(existsSync(root(p))).toBe(true)
  })
  const code = read(p)
  it('filtra por socioPFId + companyId', () => {
    expect(code).toMatch(/socioPFId:\s*socioId/)
    expect(code).toMatch(/companyId,/)
  })
  it('privacidade: profileId in ownedProfileIds', () => {
    expect(code).toMatch(/getUserOwnedProfileIds/)
    expect(code).toMatch(/profileId:\s*\{\s*in:\s*ownedProfileIds/)
  })
  it('orderBy createdAt DESC + take 1 (última ponte)', () => {
    expect(code).toMatch(/orderBy:\s*\{\s*createdAt:\s*['"]desc['"]/)
    expect(code).toMatch(/findFirst/)
  })
  it('retorna 401 sem auth', () => {
    expect(code).toMatch(/AuthenticationError/)
  })
})

describe('c) NovaPonteForm — 4 props aditivas', () => {
  const code = read('components/bridges/NovaPonteForm.tsx')
  it('interface tem initialPjTxId + initialProfileId + initialAccountId + initialCategoryId', () => {
    expect(code).toMatch(/initialPjTxId\?:\s*string\s*\|\s*null/)
    expect(code).toMatch(/initialProfileId\?:\s*string\s*\|\s*null/)
    expect(code).toMatch(/initialAccountId\?:\s*string\s*\|\s*null/)
    expect(code).toMatch(/initialCategoryId\?:\s*string\s*\|\s*null/)
  })
  it('useState nasce com initial* (?? "")', () => {
    expect(code).toMatch(/useState\(initialPjTxId\s*\?\?\s*['"]{2}\)/)
    expect(code).toMatch(/useState\(initialProfileId\s*\?\?\s*['"]{2}\)/)
    expect(code).toMatch(/useState\(initialAccountId\s*\?\?\s*['"]{2}\)/)
    expect(code).toMatch(/useState\(initialCategoryId\s*\?\?\s*['"]{2}\)/)
  })
  it('prop onCancel opcional (modal fecha sem navegar)', () => {
    expect(code).toMatch(/onCancel\?:\s*\(\)\s*=>\s*void/)
    expect(code).toMatch(/if\s*\(onCancel\)\s*return\s*onCancel\(\)/)
  })
  it('prop compact esconde Card 1 quando pré-selecionada', () => {
    expect(code).toMatch(/compact\?:\s*boolean/)
    expect(code).toMatch(/hasPreselected/)
    expect(code).toMatch(/Retirada selecionada/)
  })
})

describe('d) BridgeConviteModal — 3 CTAs', () => {
  const p = 'components/bridges/BridgeConviteModal.tsx'
  it('existe', () => {
    expect(existsSync(root(p))).toBe(true)
  })
  const code = read(p)
  it('3 botões: Enviar ao PF agora / Deixar na fila / Não é retirada', () => {
    expect(code).toMatch(/Enviar ao PF agora/)
    expect(code).toMatch(/Deixar na fila/)
    expect(code).toMatch(/Não é retirada/)
  })
  it('estado de step invite→form + NovaPonteForm com initial* preenchidos', () => {
    // step alterna entre 'invite' (3 CTAs) e 'form' (NovaPonteForm)
    expect(code).toMatch(/step === ['"]invite['"]/)
    expect(code).toMatch(/setStep\(['"]form['"]\)/)
    expect(code).toMatch(/initialPjTxId=\{txContext\.txId\}/)
    expect(code).toMatch(/initialProfileId=\{sugestao\?\.profileId/)
    expect(code).toMatch(/initialAccountId=\{sugestao\?\.bankAccountId/)
    expect(code).toMatch(/initialCategoryId=\{sugestao\?\.categoryId/)
  })
  it('busca sugestão via ultima-ponte-destino ao abrir', () => {
    expect(code).toMatch(/ultima-ponte-destino/)
  })
})

describe('e) CategoryCombobox — opt-in askIfBridge', () => {
  const code = read('components/transacoes/category-combobox.tsx')
  it('props askIfBridge + bridgeContext + onBridgeCreated opcionais', () => {
    expect(code).toMatch(/askIfBridge\?:\s*boolean/)
    expect(code).toMatch(/bridgeContext\?:/)
    expect(code).toMatch(/onBridgeCreated\?:/)
  })
  it('após onChange, detecta DISTRIBUICAO_LUCROS + Pró-labore', () => {
    expect(code).toMatch(/DISTRIBUICAO_LUCROS/)
    expect(code).toMatch(/pro-labore|pro labore|prolabore/)
    expect(code).toMatch(/isRetirada/)
  })
  it('modal só abre com askIfBridge=true E bridgeContext', () => {
    expect(code).toMatch(/if\s*\(!askIfBridge\s*\|\|\s*!catId\s*\|\|\s*!bridgeContext\)/)
  })
  it('BridgeConviteModal importado', () => {
    expect(code).toMatch(/import[\s\S]*BridgeConviteModal[\s\S]*from\s+['"]@\/components\/bridges\/BridgeConviteModal['"]/)
  })
})

describe('f) Aba nova integrada em /empresas/[id]/socios', () => {
  const code = read('app/(dashboard)/empresas/[id]/socios/socios-unified-client.tsx')
  it('TabsTrigger value=retiradas-pendentes existe', () => {
    expect(code).toMatch(/TabsTrigger\s+value=['"]retiradas-pendentes['"]/)
  })
  it('TabsContent value=retiradas-pendentes renderiza RetiradasPendentesTab', () => {
    expect(code).toMatch(/TabsContent\s+value=['"]retiradas-pendentes['"]/)
    expect(code).toMatch(/<RetiradasPendentesTab/)
  })
  it('Badge com contador quando > 0 (pattern âmbar destacado)', () => {
    expect(code).toMatch(/retiradasCount/)
    expect(code).toMatch(/bg-amber-100/)
  })
  it('defaultSocioPFId auto-preenchido quando empresa tem 1 sócio', () => {
    expect(code).toMatch(/socios\.length === 1\s*\?\s*socios\[0\]\.id/)
  })
})

describe('g) Cache invalidado ao criar ponte', () => {
  const code = read('app/api/pontes/route.ts')
  it('POST importa revalidateTag', () => {
    expect(code).toMatch(/import\s*\{\s*revalidateTag\s*\}\s*from\s+['"]next\/cache['"]/)
  })
  it('POST invalida tag da fila após criar', () => {
    expect(code).toMatch(/revalidateTag\(`retiradas-pendentes:\$\{parsed\.data\.companyId\}`/)
  })
})

describe('h) Sidebar badge — item Sócios', () => {
  const code = read('components/sidebar/global-sidebar.tsx')
  it('fetch de retiradas-pendentes por empresa', () => {
    expect(code).toMatch(/retiradasPendentesCount/)
    expect(code).toMatch(/\/api\/empresas\/\$\{empresaIdForBadges\}\/retiradas-pendentes/)
  })
  it('badge âmbar no item Sócios quando > 0', () => {
    expect(code).toMatch(/label=["']Sócios["']/)
    // Badge com string do count no bloco do item Sócios
    const socioBlock = code.match(/label=["']Sócios["'][\s\S]{0,1000}\/>/)?.[0] ?? ''
    expect(socioBlock).toMatch(/badge=\{[\s\S]*retiradasPendentesCount/)
    expect(socioBlock).toMatch(/badgeTone=["']amber["']/)
  })
})

describe('i) InlineCategorySelect — passthrough opcional', () => {
  const code = read('components/transacoes/inline-category-select.tsx')
  it('bridgeContext + onBridgeCreated opcionais', () => {
    expect(code).toMatch(/bridgeContext\?:/)
    expect(code).toMatch(/onBridgeCreated\?:/)
  })
  it('passa askIfBridge + bridgeContext pro CategoryCombobox só quando passado', () => {
    expect(code).toMatch(/askIfBridge=\{!!bridgeContext\}/)
  })
})

describe('j) Ativação em /transacoes', () => {
  const code = read('app/(dashboard)/transacoes/page.tsx')
  it('passa bridgeContext no InlineCategorySelect', () => {
    expect(code).toMatch(/bridgeContext=\{/)
    expect(code).toMatch(/empresaId:\s*t\.bankAccount\.companyId/)
  })
})
