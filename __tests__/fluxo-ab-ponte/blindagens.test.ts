// Sprint Fluxo-A/B-Ponte (05/07/2026) — blindagens estáticas.
//
// Cobre 4 grupos:
//   (a) FASE 1 — fix duplicação: fallback fetch por ID em NovaPonteForm
//   (b) FASE 2 — backend: createBridge aceita `spend?` inline atomic
//   (c) FASE 2 — endpoint: POST /api/pontes schema opcional aceita spend
//   (d) FASE 3 — frontend: card "Onde você gastou?" com sugestão

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const root = (p: string) => join(__dirname, '..', '..', p)
const read = (p: string) => readFileSync(root(p), 'utf-8')

describe('a) FASE 1 — Fix duplicação: fallback fetch por ID', () => {
  const code = read('components/bridges/NovaPonteForm.tsx')

  it('tem useEffect que busca tx por ID quando não achou nos top 200', () => {
    // Fetch pra /api/transacoes/{initialPjTxId} quando não está em pjTxs
    expect(code).toMatch(/fetch\(`\/api\/transacoes\/\$\{initialPjTxId\}`/)
  })

  it('só dispara depois do loading terminar e quando tx não está na lista', () => {
    // Guard: !pjTxsLoading e some(id === initialPjTxId)
    expect(code).toMatch(/if\s*\(\s*pjTxsLoading\s*\)/)
    expect(code).toMatch(/pjTxs\.some\(\(tx\)\s*=>\s*tx\.id\s*===\s*initialPjTxId\)/)
  })

  it('idempotente: dedup por id ao injetar', () => {
    // setPjTxs((prev) => prev.some((x) => x.id === extra.id) ? prev : [extra, ...prev])
    expect(code).toMatch(/setPjTxs\(\(prev\)\s*=>\s*\(?prev\.some/)
  })

  it('fail-soft: catch loga mas não bloqueia UI', () => {
    // Console.error dentro do .catch(), texto identifica o log.
    expect(code).toMatch(
      /\.catch\([\s\S]{0,400}Falha ao buscar tx pré-selecionada/,
    )
  })
})

describe('b) FASE 2 — Backend: createBridge aceita spend inline atomic', () => {
  const code = read('lib/bridges/create.ts')

  it('CreateBridgeInput expõe campo spend? opcional', () => {
    expect(code).toMatch(/spend\?\s*:\s*\{/)
    expect(code).toMatch(/categoryId:\s*string/)
    expect(code).toMatch(/amount\?\s*:\s*number/)
  })

  it('CreateBridgeResult retorna spendTransactionId?', () => {
    expect(code).toMatch(/spendTransactionId\?\s*:\s*string/)
  })

  it('valida categoria EXPENSE do perfil dentro do $transaction', () => {
    // Precisa checar que a categoria é EXPENSE do profile (ou global)
    expect(code).toMatch(/spendCategory\.type\s*!==\s*['"]EXPENSE['"]/)
    // Precisa validar profileId (permite global via profileId null)
    expect(code).toMatch(/spendCategory\.profileId\s*!==\s*null/)
  })

  it('cria PersonalTransaction DEBIT dentro do MESMO $transaction', () => {
    // O bloco spend está dentro do prisma.$transaction(async (tx) => ...)
    // e usa `tx.personalTransaction.create` (não prisma.personalTransaction).
    const spendBlock = code.match(/if\s*\(\s*input\.spend\s*\)\s*\{[\s\S]+?spendTxId\s*=\s*spendTx\.id/)
    expect(spendBlock).toBeTruthy()
    expect(spendBlock![0]).toMatch(/tx\.personalTransaction\.create/)
    expect(spendBlock![0]).toMatch(/type:\s*['"]DEBIT['"]/)
    expect(spendBlock![0]).toMatch(/status:\s*['"]RECONCILED['"]/)
  })

  it('liga bridge.spendTransactionId no MESMO $transaction', () => {
    // update na pJtoPFBridge com spendTransactionId
    expect(code).toMatch(
      /tx\.pJtoPFBridge\.update\(\{[\s\S]{0,200}spendTransactionId:\s*spendTx\.id/,
    )
  })

  it('decrementa balance PF (net zero quando amount == retirada)', () => {
    // Update da personalBankAccount com decrement após criar DEBIT
    expect(code).toMatch(
      /personalBankAccount\.update[\s\S]{0,300}decrement:\s*Math\.abs\(spendAmount\)/,
    )
  })

  it('audit log inclui spendTransactionId + spendCategoryId (mesmo em fluxo A vira null)', () => {
    expect(code).toMatch(/spendTransactionId:\s*spendTxId\s*\?\?\s*null/)
    expect(code).toMatch(/spendCategoryId:\s*input\.spend\?\.categoryId\s*\?\?\s*null/)
  })

  it('default: amount, description, date da retirada PJ (fluxo B típico = net zero)', () => {
    // amount ?? pjTx.amount
    expect(code).toMatch(/input\.spend\.amount\s*\?\?\s*pjTx\.amount/)
    // date ?? pjTx.date
    expect(code).toMatch(/input\.spend\.date\s*\?\?\s*pjTx\.date/)
    // description tem fallback "<categoria> — <pjTx.description>"
    expect(code).toMatch(/spendCategory\.name[\s\S]{0,80}pjTx\.description/)
  })

  it('fluxo A intacto: spend só executa se input.spend presente', () => {
    // Guard `if (input.spend)` envolve todo o bloco
    expect(code).toMatch(/if\s*\(\s*input\.spend\s*\)\s*\{/)
  })
})

describe('c) FASE 2 — Endpoint POST /api/pontes: schema opcional', () => {
  const code = read('app/api/pontes/route.ts')

  it('schema Zod aceita spend opcional', () => {
    // Prettier pode quebrar linha entre `z` e `.object(`.
    expect(code).toMatch(/spend:\s*z\s*\.?\s*\n?\s*\.?\s*object\s*\(/)
    expect(code).toMatch(/\.optional\(\)/)
  })

  it('spend.categoryId obrigatório quando spend presente', () => {
    // Dentro do z.object do spend, categoryId: z.string().min(1)
    const spendSchema = code.match(/spend:[\s\S]+?\.optional\(\)/)
    expect(spendSchema).toBeTruthy()
    expect(spendSchema![0]).toMatch(/categoryId:\s*z\.string\(\)\.min\(1\)/)
  })

  it('passa spend pro createBridge convertendo date pra Date', () => {
    expect(code).toMatch(/spend:\s*parsed\.data\.spend[\s\S]{0,600}new Date\(parsed\.data\.spend\.date\)/)
  })

  it('backward-compat: sem spend, chamada continua idêntica', () => {
    // Uso ternário — se parsed.data.spend for undefined, passa undefined
    expect(code).toMatch(/spend:\s*parsed\.data\.spend\s*\?/)
    expect(code).toMatch(/:\s*undefined/)
  })
})

describe('d) FASE 3 — Frontend: card "Onde você gastou?" + sugestão', () => {
  const code = read('components/bridges/NovaPonteForm.tsx')

  it('importa suggestSpendCategory pra sugestão automática', () => {
    expect(code).toMatch(
      /import\s*\{\s*suggestSpendCategory\s*\}\s*from\s*['"]@\/lib\/bridges\/suggest-spend-category['"]/,
    )
  })

  it('estado spendChecked + spendCategoryId + spendCategories', () => {
    expect(code).toMatch(/const\s*\[\s*spendChecked/)
    expect(code).toMatch(/const\s*\[\s*spendCategoryId/)
    expect(code).toMatch(/const\s*\[\s*spendCategories/)
  })

  it('fetch categorias EXPENSE do perfil quando profileId muda', () => {
    expect(code).toMatch(
      /fetch\(`\/api\/perfis\/\$\{profileId\}\/categorias\?type=EXPENSE`\)/,
    )
    expect(code).toMatch(/setSpendCategories/)
  })

  it('sugestão automática ao marcar: casa suggestSpendCategory com categorias por nome', () => {
    // useEffect chama suggestSpendCategory(selectedPjTx.description)
    expect(code).toMatch(
      /suggestSpendCategory\(selectedPjTx\.description\)/,
    )
    // match case-insensitive por nome
    expect(code).toMatch(/c\.name\.toLowerCase\(\)\s*===\s*suggestion\.categoryName\.toLowerCase\(\)/)
  })

  it('checkbox "Já gastei esse dinheiro" renderizado', () => {
    expect(code).toMatch(/Já gastei esse dinheiro/)
    // Checkbox controlled via spendChecked
    expect(code).toMatch(
      /type="checkbox"[\s\S]{0,120}checked=\{spendChecked\}/,
    )
  })

  it('CategoryCombobox EXPENSE aparece só quando marcado', () => {
    // Renderização condicional: {spendChecked && (...)}
    expect(code).toMatch(/spendChecked\s*&&\s*\(/)
  })

  it('CategoryCombobox permite criar categoria EXPENSE nova', () => {
    // onCreate chama createCategoryForPF com 'EXPENSE'
    expect(code).toMatch(/createCategoryForPF\(profileId,\s*name,\s*['"]EXPENSE['"]\)/)
  })

  it('preview "Após criar" mostra a despesa quando fluxo B', () => {
    // Linha do preview com "− formatBRL" (despesa)
    expect(code).toMatch(/spendChecked\s*&&\s*spendCategoryId[\s\S]{0,200}−\{formatBRL/)
  })

  it('handleSubmit inclui spend quando checkbox marcado', () => {
    expect(code).toMatch(
      /if\s*\(\s*spendChecked\s*&&\s*spendCategoryId\s*\)\s*\{[\s\S]{0,120}payload\.spend/,
    )
  })

  it('handleSubmit bloqueia fluxo B sem categoria (não vira A silenciosamente)', () => {
    expect(code).toMatch(/spendChecked\s*&&\s*!spendCategoryId/)
    expect(code).toMatch(/Escolha a categoria da despesa/)
  })

  it('toast pós-sucesso diferencia fluxo A vs B', () => {
    // Descrição do toast usa json.spendTransactionId pra decidir mensagem
    expect(code).toMatch(
      /json\.spendTransactionId[\s\S]{0,120}Entrada \+ despesa registradas/,
    )
  })
})
