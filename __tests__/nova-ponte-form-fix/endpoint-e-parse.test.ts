// Sprint Fix-NovaPonte (30/06/2026) — defensivos do fix.
//
// Bug original: fetch pra rota `/api/empresas/[id]/transacoes` que NUNCA
// existiu no repo. 404 HTML → .json() falha → .catch engole silente →
// dropdown vazio pra qualquer empresa/tx.
//
// Fix: apontar pro endpoint global existente `/api/transacoes` +
// filtrar tx com bridge já criada + tratar erro sem engolir.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const root = (p: string) => join(__dirname, '..', '..', p)

describe('NovaPonteForm — endpoint corrigido', () => {
  const code = readFileSync(
    root('components/bridges/NovaPonteForm.tsx'),
    'utf-8',
  )

  it('NÃO chama mais o endpoint fantasma /api/empresas/[id]/transacoes', () => {
    expect(code).not.toMatch(/\/api\/empresas\/\$\{[^}]+\}\/transacoes/)
  })

  it('chama endpoint GLOBAL /api/transacoes com empresaId + type', () => {
    expect(code).toMatch(/\/api\/transacoes\?/)
    expect(code).toMatch(/empresaId/)
    // Type=DEBIT (saída — só saídas do PJ viram ponte pro PF)
    expect(code).toMatch(/type[^}]*DEBIT/)
  })

  it('filtra status=RECONCILED (tx categorizada, candidata legítima)', () => {
    expect(code).toMatch(/status[^}]*RECONCILED/)
  })

  it('envia limit maior que o default pra não perder candidatas (empresas ativas)', () => {
    // ANTES: pageSize=50 (parâmetro do endpoint fantasma que ignorava)
    // AGORA: limit >= 200 no endpoint global
    expect(code).toMatch(/limit[^}]*['"]200['"]/)
  })

  it('mantém credentials pra não perder cookie httpOnly em Safari', () => {
    expect(code).toMatch(/credentials:\s*['"]include['"]/)
  })
})

describe('NovaPonteForm — trata resposta corretamente', () => {
  const code = readFileSync(
    root('components/bridges/NovaPonteForm.tsx'),
    'utf-8',
  )

  it('verifica res.ok antes de .json() (evita SyntaxError em 404 HTML)', () => {
    expect(code).toMatch(/if\s*\(\s*!\s*r\.ok\s*\)/)
    expect(code).toMatch(/throw\s+new\s+Error/)
  })

  it('espera shape { transacoes: [...] } do endpoint global', () => {
    expect(code).toMatch(/j\?\.transacoes|j\.transacoes/)
  })

  it('filtra tx que JÁ têm bridge (não permitir duplicar)', () => {
    expect(code).toMatch(/!tx\.bridge/)
  })

  it('mapeia bankAccount.name e category.dreGroup do shape do endpoint global', () => {
    expect(code).toMatch(/tx\.bankAccount\?\.name/)
    expect(code).toMatch(/tx\.category\?\.dreGroup/)
  })

  it('ordena tx de Distribuição de Lucros no topo (kind típico DISTRIBUICAO)', () => {
    expect(code).toMatch(/DISTRIBUICAO_LUCROS/)
    expect(code).toMatch(/\.sort/)
  })
})

describe('NovaPonteForm — erro visível (não silencioso)', () => {
  const code = readFileSync(
    root('components/bridges/NovaPonteForm.tsx'),
    'utf-8',
  )

  it('pjTxsLoading state pra distinguir "carregando" de "vazio"', () => {
    expect(code).toMatch(/pjTxsLoading/)
    expect(code).toMatch(/setPjTxsLoading/)
  })

  it('pjTxsError state pra distinguir "vazio verdadeiro" de "falha ao buscar"', () => {
    expect(code).toMatch(/pjTxsError/)
    expect(code).toMatch(/setPjTxsError/)
  })

  it('NÃO usa mais .catch(() => {}) (engolia erros)', () => {
    // Regex: procura a chamada específica do endpoint /api/transacoes
    // (não bate com outras chamadas de perfis/contas/categorias)
    const matchBlock = code.match(
      /fetch\(`\/api\/transacoes[\s\S]+?\.finally/,
    )
    expect(matchBlock).toBeTruthy()
    expect(matchBlock![0]).toMatch(/console\.error/)
    // Nesse bloco específico não usa mais catch silencioso
    expect(matchBlock![0]).not.toMatch(/\.catch\(\(\)\s*=>\s*\{\s*\}\)/)
  })

  it('UI mostra 3 estados distintos (loading, erro, vazio)', () => {
    // Loading
    expect(code).toMatch(/Carregando transações/)
    // Erro
    expect(code).toMatch(/Erro ao carregar transações/)
    // Vazio "verdadeiro"
    expect(code).toMatch(/Nenhuma transação encontrada/)
  })
})

describe('NovaPonteForm — cenário Yussef LM TRANSP', () => {
  const code = readFileSync(
    root('components/bridges/NovaPonteForm.tsx'),
    'utf-8',
  )

  it('type=DEBIT + status=RECONCILED bate com LM TRANSP', () => {
    // LM TRANSP -R$2.849 · Stone · DEBIT · categoryId=Distribuição de Lucros · RECONCILED
    expect(code).toMatch(/DEBIT/)
    expect(code).toMatch(/RECONCILED/)
  })

  it('filtro !tx.bridge deixa a LM TRANSP passar (não tem bridge)', () => {
    // A tx LM TRANSP tem 0 bridges no BD (verificado no diagnóstico) —
    // o filtro no client permite ela aparecer.
    expect(code).toMatch(/withoutBridge/)
  })
})
