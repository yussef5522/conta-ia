// ⛔⛔⛔ PREVIEW E CONFIRM NÃO PODEM DISCORDAR SOBRE O QUE É A MESMA LINHA (17/09/2026)
//
// **O relato do dono:** *"a IA sugeriu TIPO errado em massa — as compras vieram como
// estorno, só 14 de 33 marcadas, e o rodapé diz Compras R$ 0,00 · Total a importar
// −2.749,91."*
//
// ⭐ **A classificação estava CERTA** (três totais impressos pelo banco confirmam que
// aquelas 14 são crédito). O que estava errado era a **IDENTIDADE**: o preview calculava o
// `contentHash` com `type: 'DEBIT'` cravado e o confirm com o tipo de verdade
// (`ESTORNO → CREDIT`). Reimportando a fatura, as compras batiam como já-existentes e **os
// estornos apareciam como novos** — daí "14 de 33" e o rodapé somando só os créditos.
//
// ⚠️ É a família mais cara deste projeto — *"preview e confirm discordando"* — e ela já
// custou o import de OFX inteiro. A cura é a mesma de lá: **uma função que as duas pontas
// chamam**, e um guard que impede a segunda cópia de nascer.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { identidadeDaLinha, tipoDaLinha } from '../identidade-da-linha'
import { computeIdentity } from '@/lib/import-identity/compute-identity'

const CARD = 'card-teste'
const ESTORNO = { date: '2026-08-25', description: 'NETFLIX COM SAO PAULO BRA', amount: 85.7, kind: 'ESTORNO' as const }

describe('⭐ o tipo contábil da linha tem um dono só', () => {
  it('⭐ só o estorno é crédito', () => {
    expect(tipoDaLinha('ESTORNO')).toBe('CREDIT')
    expect(tipoDaLinha('COMPRA_AVISTA')).toBe('DEBIT')
    expect(tipoDaLinha('COMPRA_PARCELADA')).toBe('DEBIT')
    expect(tipoDaLinha('ENCARGO_FINANCEIRO')).toBe('DEBIT')
  })
})

describe('⛔⛔ a identidade de um estorno depende do TIPO — era aí que as pontas divergiam', () => {
  /**
   * ⚠️ Este teste existe pra mostrar que o defeito **importava**: se o tipo não entrasse no
   * hash, a divergência seria inofensiva e não haveria bug. Ela entra, e por isso o estorno
   * gravado nunca era reconhecido na releitura.
   */
  it('⭐ o hash com CREDIT é DIFERENTE do hash com DEBIT', () => {
    const comoCredito = identidadeDaLinha(CARD, ESTORNO)
    const comoDebito = computeIdentity({
      accountId: `card:${CARD}`, fitid: null,
      date: ESTORNO.date, amount: ESTORNO.amount, type: 'DEBIT', memo: ESTORNO.description,
    }).contentHash
    expect(comoCredito).not.toBe(comoDebito)
  })

  it('⭐ e a mesma linha, pelas duas pontas, dá o MESMO hash', () => {
    // o preview manda `suggestedKind`; o confirm manda `kind` — a mesma coisa, um só cálculo
    const doPreview = identidadeDaLinha(CARD, { ...ESTORNO, kind: 'ESTORNO' })
    const doConfirm = identidadeDaLinha(CARD, { ...ESTORNO, kind: 'ESTORNO' })
    expect(doPreview).toBe(doConfirm)
  })
})

describe('⛔ GUARD — nenhuma das duas rotas calcula identidade por conta própria', () => {
  /**
   * ⛔⛔ A regra copiada nos dois arquivos foi **exatamente** como a divergência nasceu.
   * Enquanto as rotas puderem chamar `computeIdentity` direto, a segunda cópia volta na
   * primeira mudança — e volta calada, porque nada quebra: só o número da tela fica errado.
   */
  const ROTAS = [
    'app/api/empresas/[id]/cartoes/[cardId]/importar-fatura/preview/route.ts',
    'app/api/empresas/[id]/cartoes/[cardId]/importar-fatura/confirm/route.ts',
  ]

  it('⭐ preview e confirm usam `identidadeDaLinha`, nunca `computeIdentity`', () => {
    for (const rota of ROTAS) {
      const fonte = readFileSync(join(process.cwd(), rota), 'utf-8')
      const semComentario = fonte.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
      expect(
        semComentario.includes('computeIdentity('),
        `${rota} voltou a calcular a identidade por conta própria — é assim que preview e confirm divergem`,
      ).toBe(false)
      expect(semComentario).toContain('identidadeDaLinha(')
    }
  })

  /** ⭐ e o tipo contábil também não pode voltar a ser escrito à mão nas rotas */
  it('⭐ o `ESTORNO ? CREDIT : DEBIT` não se repete nas rotas', () => {
    for (const rota of ROTAS) {
      const fonte = readFileSync(join(process.cwd(), rota), 'utf-8')
      const semComentario = fonte.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
      expect(
        /=== 'ESTORNO' \? 'CREDIT'/.test(semComentario),
        `${rota} reescreveu a régua do tipo — ela mora em tipoDaLinha()`,
      ).toBe(false)
    }
  })
})
