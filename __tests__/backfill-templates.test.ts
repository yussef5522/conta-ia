import { describe, it, expect } from 'vitest'
import {
  inferirDreGroup,
  normalizarTaxRegime,
} from '../scripts/backfill-templates'
import { getTemplate } from '../lib/categories/defaults'
import { academiaTemplate } from '../lib/categories/templates/academia'
import { restauranteTemplate } from '../lib/categories/templates/restaurante'

describe('inferirDreGroup (heurística por nome)', () => {
  // Tabela de mapping confirmada com Yussef:
  it.each([
    ['Mensalidades recebidas', 'RECEITA_BRUTA'],
    ['Mensalidades de academia', 'RECEITA_BRUTA'],
    ['Serviços prestados', 'RECEITA_BRUTA'],
    ['Consultas e avaliações', 'RECEITA_BRUTA'],
    ['Outros recebimentos', 'OUTRAS_RECEITAS'],
    ['ISS recolhido', 'DEDUCOES'],
    ['Impostos e taxas', 'DEDUCOES'],
    ['Tarifas bancárias', 'DESPESAS_FINANCEIRAS'],
    ['Salários e pró-labore', 'DESPESAS_PESSOAL'],
    ['Aluguel', 'DESPESAS_ADMINISTRATIVAS'],
    ['Água, luz e internet', 'DESPESAS_ADMINISTRATIVAS'],
    ['Material de consumo', 'DESPESAS_ADMINISTRATIVAS'],
    ['Equipamentos e manutenção', 'INVESTIMENTOS'],
    ['Marketing e publicidade', 'DESPESAS_COMERCIAIS'],
    ['Outras despesas', 'OUTRAS_DESPESAS'],
    ['Transferência', 'TRANSFERENCIA'],
  ])('"%s" → %s', (nome, esperado) => {
    expect(inferirDreGroup(nome)).toBe(esperado)
  })

  it('retorna null pra categoria desconhecida (revisão manual)', () => {
    expect(inferirDreGroup('Categoria Customizada Yussef')).toBeNull()
    expect(inferirDreGroup('XYZ')).toBeNull()
    expect(inferirDreGroup('')).toBeNull()
  })

  it('é determinístico (idempotente — rodar 2x dá o mesmo resultado)', () => {
    expect(inferirDreGroup('Aluguel')).toBe(inferirDreGroup('Aluguel'))
    expect(inferirDreGroup('Salários e pró-labore')).toBe(inferirDreGroup('Salários e pró-labore'))
  })

  it('case-insensitive', () => {
    expect(inferirDreGroup('aluguel')).toBe('DESPESAS_ADMINISTRATIVAS')
    expect(inferirDreGroup('ALUGUEL')).toBe('DESPESAS_ADMINISTRATIVAS')
    expect(inferirDreGroup('Aluguel')).toBe('DESPESAS_ADMINISTRATIVAS')
  })

  it('aplica primeira heurística que casa (ordem importa)', () => {
    // "Impostos e taxas" começa com Impostos → DEDUCOES
    expect(inferirDreGroup('Impostos e taxas')).toBe('DEDUCOES')
  })
})

describe('normalizarTaxRegime (mapping legacy → granular)', () => {
  it('SIMPLES_NACIONAL legacy → SIMPLES_NACIONAL_III', () => {
    expect(normalizarTaxRegime('SIMPLES_NACIONAL')).toBe('SIMPLES_NACIONAL_III')
  })

  it('null → SIMPLES_NACIONAL_III (default seguro)', () => {
    expect(normalizarTaxRegime(null)).toBe('SIMPLES_NACIONAL_III')
    expect(normalizarTaxRegime(undefined)).toBe('SIMPLES_NACIONAL_III')
    expect(normalizarTaxRegime('')).toBe('SIMPLES_NACIONAL_III')
  })

  it('mantém regimes já granulares', () => {
    expect(normalizarTaxRegime('SIMPLES_NACIONAL_I')).toBe('SIMPLES_NACIONAL_I')
    expect(normalizarTaxRegime('SIMPLES_NACIONAL_III')).toBe('SIMPLES_NACIONAL_III')
    expect(normalizarTaxRegime('SIMPLES_NACIONAL_IV')).toBe('SIMPLES_NACIONAL_IV')
    expect(normalizarTaxRegime('SIMPLES_NACIONAL_V')).toBe('SIMPLES_NACIONAL_V')
    expect(normalizarTaxRegime('LUCRO_PRESUMIDO')).toBe('LUCRO_PRESUMIDO')
    expect(normalizarTaxRegime('LUCRO_REAL')).toBe('LUCRO_REAL')
    expect(normalizarTaxRegime('MEI')).toBe('MEI')
  })

  it('valor desconhecido → SIMPLES_NACIONAL_III (failsafe)', () => {
    expect(normalizarTaxRegime('REGIME_INVALIDO_XPTO')).toBe('SIMPLES_NACIONAL_III')
  })

  it('é determinístico (rodar 2x dá o mesmo resultado)', () => {
    expect(normalizarTaxRegime('SIMPLES_NACIONAL')).toBe(normalizarTaxRegime('SIMPLES_NACIONAL'))
    expect(normalizarTaxRegime('LUCRO_REAL')).toBe(normalizarTaxRegime('LUCRO_REAL'))
  })
})

describe('getTemplate (fix de normalização lowercase)', () => {
  it('cacula mix (type=RESTAURANT) recebe template restaurante (não academia)', () => {
    expect(getTemplate('RESTAURANT')).toBe(restauranteTemplate)
    expect(getTemplate('RESTAURANT')).not.toBe(academiaTemplate)
  })

  it('Demo Conta IA (type=SERVICE) recebe template academia', () => {
    expect(getTemplate('SERVICE')).toBe(academiaTemplate)
  })

  it('lowercase (já normalizado) também funciona', () => {
    expect(getTemplate('restaurant')).toBe(restauranteTemplate)
    expect(getTemplate('service')).toBe(academiaTemplate)
  })

  it('case misto também é normalizado', () => {
    expect(getTemplate('Restaurant')).toBe(restauranteTemplate)
    expect(getTemplate('rEsTaUrAnT')).toBe(restauranteTemplate)
  })

  it('null/undefined → academia (fallback seguro)', () => {
    expect(getTemplate(null)).toBe(academiaTemplate)
    expect(getTemplate(undefined)).toBe(academiaTemplate)
    expect(getTemplate('')).toBe(academiaTemplate)
  })

  it('whitespace é trimado antes da comparação', () => {
    expect(getTemplate('  RESTAURANT  ')).toBe(restauranteTemplate)
  })

  it('type desconhecido → academia (fallback)', () => {
    expect(getTemplate('FOO')).toBe(academiaTemplate)
  })
})

describe('idempotência da heurística (combinada)', () => {
  it('aplicar inferirDreGroup duas vezes na mesma categoria já mapeada → mesmo resultado', () => {
    // Cenário: categoria "Aluguel" foi mapeada uma vez. Backfill rodando de novo
    // chama inferirDreGroup novamente. Função é determinística — mesmo output.
    const primeiraExec = inferirDreGroup('Aluguel')
    const segundaExec = inferirDreGroup('Aluguel')
    expect(primeiraExec).toBe(segundaExec)
    expect(primeiraExec).toBe('DESPESAS_ADMINISTRATIVAS')
  })

  it('todas as 15 categorias antigas da Demo Conta IA têm dreGroup determinístico', () => {
    const antigas = [
      'Mensalidades recebidas',
      'Serviços prestados',
      'Consultas e avaliações',
      'Outros recebimentos',
      'ISS recolhido',
      'Impostos e taxas',
      'Tarifas bancárias',
      'Salários e pró-labore',
      'Aluguel',
      'Água, luz e internet',
      'Material de consumo',
      'Equipamentos e manutenção',
      'Marketing e publicidade',
      'Outras despesas',
      'Transferência',
    ]
    const dreGroups = antigas.map(inferirDreGroup)
    // Todas as 15 devem ter mapping (nenhuma null)
    expect(dreGroups.every((g) => g !== null)).toBe(true)
    // Idempotente: rodar de novo dá o mesmo resultado
    expect(antigas.map(inferirDreGroup)).toEqual(dreGroups)
  })
})

describe('preservação de transações (contrato do script)', () => {
  // Verificação por inspeção: o script só faz update em Company (taxRegime)
  // e Category (dreGroup, isSystemDefault, visibleInRegimes). Nunca executa
  // tx.transaction.update ou tx.transaction.delete. Logo, transações ficam
  // intactas com seus categoryIds preservados.
  it('o script NÃO faz update nem delete em transactions', async () => {
    // Lê o código-fonte do script e verifica:
    const fs = await import('fs')
    const path = await import('path')
    const scriptPath = path.resolve(__dirname, '../scripts/backfill-templates.ts')
    const source = fs.readFileSync(scriptPath, 'utf-8')

    // Não pode haver mexida em transactions (a tabela única é "transaction" no Prisma)
    expect(source).not.toMatch(/tx\.transaction\.update/)
    expect(source).not.toMatch(/tx\.transaction\.delete/)
    expect(source).not.toMatch(/tx\.transaction\.create/)
    expect(source).not.toMatch(/tx\.transaction\.upsert/)
    // Apenas leitura via _count.transactions é permitida (count, não modificar)
  })
})
