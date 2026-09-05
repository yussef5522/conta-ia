// ⛔⛔⛔ OS TRÊS BURACOS DO IMPORT DO BANRISUL (04/09/2026) — os que faziam o dono
// retrabalhar A CADA import. Fixture derivada do `Extrato_20260904.ofx` REAL: mesmos
// valores, mesmas grafias, mesmo LEDGERBAL (−8.347,67), mesma inversão de campos.
//
//   1. a caixa "Extrato não traz saldo final (LEDGERBAL ausente)" com o saldo DENTRO do arquivo
//   2. a regra que quebrava a cada grafia — e o SINAL que precisa entrar na régua junto
//   3. a inversão description × counterpartyName, anotada em 01/09 e nunca tratada

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { parseOFX } from '../parser'
import { estadoDoBanner } from '../banner-ledgerbal'
import { canonizarHistorico, corrigirInversao, ehHistoricoGenerico } from '@/lib/bank-profiles/historico-canonico'
import { buildRuleIndex, predictCategory, explicarConflitoDeSinal } from '@/lib/ai-categorizer/predict'
import { sinalCompativel } from '@/lib/ai-categorizer/sinal-da-regra'
import type { RuleSnapshot } from '@/lib/ai-categorizer/types'
import { stableKey } from '@/lib/reconciliation/stable-key'
import { REGRAS_DE_ENCARGO, padroesCurtosComoContains } from '@/lib/bank-profiles/regras-encargos-banrisul'

const OFX = readFileSync(join(__dirname, 'fixtures', 'banrisul-04-09.ofx'), 'utf8')
const COMPANY = 'empresa-teste'

/** a regra REAL do dono, como está em prod: CONTAINS, com a grafia COM espaço */
const REGRA_DA_VENDA: RuleSnapshot = {
  id: 'r1', companyId: COMPANY, tipoMatch: 'CONTAINS' as RuleSnapshot['tipoMatch'],
  padrao: 'OP. CREDITO C/GARANTIA', categoryId: 'cat-vendas', supplierId: null,
  confianca: 1, vezesAplicada: 5, isActive: true, fonte: 'MANUAL',
  dreGroupDaCategoria: 'RECEITA_BRUTA',
}
const index = buildRuleIndex(COMPANY, [REGRA_DA_VENDA])

// ────────────────────────────────────────────────────────────────
describe('⛔ 1. A CAIXA DE SALDO MENTIA — o arquivo TEM o LEDGERBAL', () => {
  it('⭐⭐ o parser lê −8.347,67 do arquivo (não regrediu)', () => {
    const p = parseOFX(OFX)
    expect(p.ledgerBalance?.amount).toBe(-8347.67)
    expect(p.transactions).toHaveLength(9)
  })

  it('⛔⛔ banco cujo saldo declarado NÃO é régua → faixa OCULTA, nunca "ausente"', () => {
    // ⚠️ era aqui que a rota mandava `available:false` pra ESCONDER, e o componente lia
    // isso como "o extrato não trouxe saldo" — afirmando o contrário do arquivo.
    expect(estadoDoBanner({ temNoArquivo: true, ehReguaNesteBanco: false, bate: false })).toBe('OCULTO')
    expect(estadoDoBanner({ temNoArquivo: true, ehReguaNesteBanco: false, bate: true })).toBe('OCULTO')
  })

  it('⭐ "AUSENTE" volta a significar UMA coisa: o arquivo não trouxe — em qualquer banco', () => {
    expect(estadoDoBanner({ temNoArquivo: false, ehReguaNesteBanco: true, bate: false })).toBe('AUSENTE')
    expect(estadoDoBanner({ temNoArquivo: true, ehReguaNesteBanco: true, bate: true })).toBe('BATE')
    expect(estadoDoBanner({ temNoArquivo: true, ehReguaNesteBanco: true, bate: false })).toBe('NAO_BATE')
  })
})

// ────────────────────────────────────────────────────────────────
describe('⛔ 2. A REGRA QUEBRAVA A CADA GRAFIA', () => {
  it('⭐⭐ as TRÊS grafias do arquivo real viram a MESMA forma canônica', () => {
    const canon = 'OP CREDITO C GARANTIA'
    expect(canonizarHistorico('OP. CREDITO C/GARANTIA')).toBe(canon)
    expect(canonizarHistorico('OP.CREDITO C/GARANTIA')).toBe(canon)
    expect(canonizarHistorico('OP CRED C GARANT')).toBe(canon)
  })

  it('⭐⭐ o +5.252,06 de 04/09 casa com a regra — era o "escolha você" por UM espaço', () => {
    const p = parseOFX(OFX)
    const linha = p.transactions.find((t) => t.amount === 5252.06)!
    expect(linha.memo, 'a grafia sem espaço, como o banco mandou').toBe('OP.CREDITO C/GARANTIA')
    const pred = predictCategory({ description: linha.memo, type: linha.type }, index)
    expect(pred?.categoryId, 'a regra não mordeu — voltou o "escolha você"').toBe('cat-vendas')
  })

  it('⭐ e o +4.250,99, que vem com a grafia COM espaço, casa igual', () => {
    const p = parseOFX(OFX)
    const linha = p.transactions.find((t) => t.amount === 4250.99)!
    expect(predictCategory({ description: linha.memo, type: linha.type }, index)?.categoryId).toBe('cat-vendas')
  })

  it('⛔⛔ o −3.700 "OP CRED C GARANT" NÃO casa com a regra da venda — o sinal manda', () => {
    // ⚠️ ESTE é o teste que impede o conserto de virar bug: só a canonização faria um
    // DÉBITO de 3.700 entrar em Receita de Vendas, porque o texto casa.
    const p = parseOFX(OFX)
    const linha = p.transactions.find((t) => t.amount === 3700)!
    expect(linha.type).toBe('DEBIT')
    expect(predictCategory({ description: linha.memo, type: linha.type }, index)).toBeNull()
  })

  it('⭐⭐ e em vez de silêncio, a linha ganha a pergunta que leva a uma ação', () => {
    const aviso = explicarConflitoDeSinal({ description: 'OP CRED C GARANT', type: 'DEBIT' }, index)
    expect(aviso).toMatch(/Confira no banco/)
    expect(aviso).toMatch(/DÉBITO/)
    expect(aviso, 'a regra que motivou o aviso tem que aparecer').toMatch(/OP\. CREDITO C\/GARANTIA/)
  })

  it('⭐ a régua do sinal em si: receita só entra, despesa só sai, neutro passa', () => {
    expect(sinalCompativel('RECEITA_BRUTA', 'CREDIT')).toBe(true)
    expect(sinalCompativel('RECEITA_BRUTA', 'DEBIT')).toBe(false)
    expect(sinalCompativel('DESPESAS_FINANCEIRAS', 'DEBIT')).toBe(true)
    expect(sinalCompativel('DESPESAS_FINANCEIRAS', 'CREDIT')).toBe(false)
    // ⚠️ transferência e aporte acontecem nos dois sentidos — travar ali seria alarme falso
    expect(sinalCompativel('TRANSFERENCIA', 'DEBIT')).toBe(true)
    expect(sinalCompativel('TRANSFERENCIA', 'CREDIT')).toBe(true)
    expect(sinalCompativel(null, 'DEBIT'), 'sem saber o grupo, não se inventa trava').toBe(true)
  })

  it('⛔ e a canonização NÃO faz históricos diferentes colidirem', () => {
    expect(canonizarHistorico('PIX ENVIADO')).not.toBe(canonizarHistorico('PIX RECEBIDO'))
    expect(canonizarHistorico('ANTECIP STONE')).not.toBe(canonizarHistorico('DEBITO STONE'))
    expect(canonizarHistorico('IOF')).not.toBe(canonizarHistorico('IOF ADICIONAL'))
  })
})

// ────────────────────────────────────────────────────────────────
describe('⛔ 3. A INVERSÃO description × counterpartyName', () => {
  it('⭐⭐ o PIX de 04/09 entra com o HISTÓRICO na descrição e o NOME na contraparte', () => {
    const p = parseOFX(OFX)
    const pix = p.transactions.find((t) => t.amount === 4000)!
    // no arquivo: <NAME>PIX ENVIADO  <MEMO>CACULA MIX  (trocados)
    expect(pix.memo, 'gravaria "CACULA MIX" como histórico').toBe('PIX ENVIADO')
    expect(pix.counterpartyName, 'e "PIX ENVIADO" como favorecido').toBe('CACULA MIX')
  })

  it('⭐ vale nos dois sentidos do PIX — o recebido tem a mesma inversão', () => {
    const p = parseOFX(OFX)
    const rec = p.transactions.find((t) => t.amount === 403.83)!
    expect(rec.memo).toBe('PIX RECEBIDO')
    expect(rec.counterpartyName).toBe('HUB INSTITUICAO DE PAGAMENTO SA')
  })

  it('⭐⭐ a decisão é pela FORMA, nunca pela posição', () => {
    // genérico no NAME + nome próprio no MEMO → inverte
    expect(corrigirInversao({ name: 'PIX ENVIADO', memo: 'CACULA MIX' }))
      .toEqual({ memo: 'PIX ENVIADO', contraparte: 'CACULA MIX', invertido: true })
    // o mesmo par na ordem CERTA → não mexe
    expect(corrigirInversao({ name: 'CACULA MIX', memo: 'PIX ENVIADO' }))
      .toEqual({ memo: 'PIX ENVIADO', contraparte: 'CACULA MIX', invertido: false })
    // NAME == MEMO (o caso comum do Banrisul) → nada a desfazer, sem contraparte inventada
    expect(corrigirInversao({ name: 'IOF', memo: 'IOF' }))
      .toEqual({ memo: 'IOF', contraparte: null, invertido: false })
    // ⚠️ dois nomes próprios: sem genérico, não há o que decidir — não inverte
    expect(corrigirInversao({ name: 'JOSE DA SILVA', memo: 'MERCADO CENTRAL' }).invertido).toBe(false)
  })

  it('⭐ o conjunto fechado reconhece o rótulo do banco e ignora nome de empresa', () => {
    expect(ehHistoricoGenerico('PIX ENVIADO')).toBe(true)
    expect(ehHistoricoGenerico('OP.CREDITO C/GARANTIA')).toBe(true)   // pelo canônico
    expect(ehHistoricoGenerico('CACULA MIX')).toBe(false)
    expect(ehHistoricoGenerico('HUB INSTITUICAO DE PAGAMENTO SA')).toBe(false)
  })

  it('⛔⛔ e as linhas NÃO invertidas mantêm a identidade — nada de duplicata por causa do fix', () => {
    // ⚠️ a `stableKey` é data|valor|memo: se o fix mudasse o memo de uma linha que NÃO está
    // invertida, ela viraria "nova" no próximo import e duplicaria.
    const p = parseOFX(OFX)
    const iof = p.transactions.find((t) => t.memo === 'IOF ADICIONAL')!
    expect(stableKey({ date: iof.datePosted, signedAmount: -71.68, memo: iof.memo }))
      .toBe('2026-09-01|-71.68|IOF ADICIONAL')
    // e as duas grafias de OP.CREDITO seguem dando a MESMA chave (o dedup nunca dependeu disso)
    const d = new Date('2026-09-01T00:00:00Z')
    expect(stableKey({ date: d, signedAmount: 4250.99, memo: 'OP. CREDITO C/GARANTIA' }))
      .toBe(stableKey({ date: d, signedAmount: 4250.99, memo: 'OP.CREDITO C/GARANTIA' }))
  })
})

// ────────────────────────────────────────────────────────────────
describe('⚠️⚠️ o canônico SOMA, nunca substitui — o que já casava tem que continuar casando', () => {
  // ⛔ MEDIDO EM PROD ANTES DE ESCREVER: `"RECEBIMENTO PIX-PIX_CRE"` tem **851 aplicações**
  // e casa por substring crua com a descrição real do Sicredi. No canônico o catálogo
  // expande CRED → CREDITO e o token "CRE" deixa de existir → a regra pararia de morder.
  // Consertar o Banrisul quebrando o Sicredi, em silêncio, é o pior desfecho possível.
  const REGRA_PIX: RuleSnapshot = {
    id: 'r2', companyId: COMPANY, tipoMatch: 'CONTAINS' as RuleSnapshot['tipoMatch'],
    padrao: 'RECEBIMENTO PIX-PIX_CRE', categoryId: 'cat-vendas', supplierId: null,
    confianca: 1, vezesAplicada: 851, isActive: true, fonte: 'MANUAL',
    dreGroupDaCategoria: 'RECEITA_BRUTA',
  }
  const idx = buildRuleIndex(COMPANY, [REGRA_PIX])

  it('⛔⛔ a regra de 851 aplicações continua casando na descrição REAL do Sicredi', () => {
    const real = 'RECEBIMENTO PIX-PIX_CRED  43098655000157 TUNA PAGAMENTOS LTDA'
    expect(predictCategory({ description: real, type: 'CREDIT' }, idx)?.categoryId).toBe('cat-vendas')
  })

  it('⛔⛔ e é POR ISSO que o seed não usa CONTAINS em padrão curto', () => {
    // ⚠️ o ramo CONTAINS casa por SUBSTRING CRUA — e tem que continuar casando (o teste
    // acima). A consequência: um CONTAINS "IOF" acharia "BIOFARMA". Em vez de fingir que
    // não existe, o seed dos encargos usa EXACT no padrão curto.
    const REGRA_IOF: RuleSnapshot = {
      ...REGRA_PIX, id: 'r3', padrao: 'IOF', categoryId: 'cat-tarifas', vezesAplicada: 0,
      dreGroupDaCategoria: 'DESPESAS_FINANCEIRAS',
    }
    expect(
      predictCategory({ description: 'BIOFARMA DISTRIBUIDORA', type: 'DEBIT' }, buildRuleIndex(COMPANY, [REGRA_IOF]))?.categoryId,
      'substring crua acha "IOF" dentro de "BIOFARMA" — por isso o seed não faz isso',
    ).toBe('cat-tarifas')

    expect(padroesCurtosComoContains(), 'padrão curto voltou a ser CONTAINS no seed').toEqual([])
    expect(REGRAS_DE_ENCARGO.find((r) => r.padrao === 'IOF')?.tipoMatch).toBe('EXACT')
  })

  it('⭐ o lado CANÔNICO, esse, casa por TOKEN INTEIRO', () => {
    // "OP CREDITO" não pode casar dentro de "OP CREDITOS DIVERSOS" por acidente de prefixo
    expect(canonizarHistorico('OP. CREDITO C/GARANTIA').split(' ')).toContain('GARANTIA')
    const i3 = buildRuleIndex(COMPANY, [{ ...REGRA_PIX, id: 'r4', padrao: 'OP.CREDITO C/GARANTIA' }])
    // grafia diferente da regra, mesma rubrica → casa pelo canônico
    expect(predictCategory({ description: 'OP CRED C GARANT', type: 'CREDIT' }, i3)?.categoryId).toBe('cat-vendas')
  })

  it('⭐ e o seed dos encargos aponta pras categorias que o DONO mais usou', () => {
    const porPadrao = new Map(REGRAS_DE_ENCARGO.map((r) => [r.padrao, r]))
    expect(porPadrao.get('PACOTE SERVICOS')?.categoria).toBe('Tarifas Bancárias')
    expect(porPadrao.get('JUROS')?.categoria).toBe('Juros e Encargos')
    // ⚠️ o empate 1×1 fica MARCADO, não resolvido no escuro
    expect(porPadrao.get('TRANSF. ENCARGOS CTA UNICA')?.empateNaHistoria).toBe(true)
  })
})
