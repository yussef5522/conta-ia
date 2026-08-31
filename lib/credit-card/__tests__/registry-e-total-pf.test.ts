// ⛔⛔ O FALLBACK SILENCIOSO — o caso Nubank (31/08/2026).
//
// O dono criou um cartão Nubank, subiu a fatura do Nubank, e o sistema aplicou os regex do
// BANRISUL no documento: o caminho PF chamava `parseBanrisulFaturaPF` direto e maquiava
// com `detectedBank ?? 'Banrisul'`. A falha saiu como *"o PDF não declarou o total (layout
// inesperado)"* — **"banco não reconhecido" vestido de "o Banrisul mudou o layout"**. Ele
// foi caçar mudança de layout que não existia.

import { describe, it, expect } from 'vitest'
import {
  reconhecerBancoPF, diagnosticarFalha, BANCOS_SUPORTADOS_PF, PARSERS_FATURA_PF,
} from '../registry-fatura-pf'
import { resolverTotalDeclarado, conferirTotal } from '../total-declarado'

/** trechos representativos, sem PII — o que importa é a MARCA do banco no texto */
const TEXTO_BANRISUL = 'BANCO BANRISUL S.A.\nFatura do cartão\nSaldo da fatura atual 18.348,72'
const TEXTO_NUBANK = 'Nu Pagamentos S.A. — Instituição de Pagamento\nRESUMO DA FATURA ATUAL\nTotal a pagar R$ 3.053,32'

describe('⛔⛔ banco não reconhecido NÃO vira parser chutado', () => {
  it('⛔⛔ o caso REAL: fatura Nubank NÃO é processada como Banrisul', () => {
    // ⚠️ este teste nasceu (31/08) exigindo `null`, porque o Nubank ainda não existia no
    // registry. Agora ele existe — então a asserção certa deixou de ser "não reconhece" e
    // passou a ser "NÃO cai no Banrisul". O que o teste protege é o mesmo: o documento de
    // um banco jamais ser processado pelo parser de outro.
    expect(reconhecerBancoPF(TEXTO_NUBANK)?.banco).toBe('Nubank')
    expect(reconhecerBancoPF(TEXTO_NUBANK)?.banco).not.toBe('Banrisul')
  })

  it('⭐ e a mensagem diz a CAUSA CERTA, com a lista do que eu sei ler', () => {
    const d = diagnosticarFalha({ banco: null, linhas: 0, temTotalDeclarado: false, fecha: false })!
    expect(d.causa).toBe('BANCO_NAO_RECONHECIDO')
    expect(d.mensagem).toContain('nenhum banco que eu saiba ler')
    expect(d.mensagem).toContain('Banrisul') // cita a lista REAL, não uma fixa
    // ⛔ não pode mais falar em "layout" — foi essa palavra que mandou o dono pro lugar errado
    expect(d.mensagem).not.toMatch(/layout/i)
  })

  it('⭐ o Banrisul continua sendo reconhecido (não quebrei o que funcionava)', () => {
    expect(reconhecerBancoPF(TEXTO_BANRISUL)?.banco).toBe('Banrisul')
  })

  it('⚠️ o match olha o CONTEÚDO do PDF, não o nome do cartão', () => {
    // cartão pode se chamar "meu cartão" — o nome do cadastro não prova de quem é o documento
    expect(reconhecerBancoPF('nome do cartão: banrisul pf')?.banco).toBe('Banrisul')
    expect(reconhecerBancoPF('documento qualquer sem marca de banco')).toBeNull()
  })

  it('⚠️⚠️ a fixture ANONIMIZADA não tem a marca — e mesmo assim é reconhecida', () => {
    // ⛔ O anonimizador raspou TODAS as marcas de marca do PDF real (o cabeçalho virou
    // "PADARIA? CAFECA"). Casar só por /banrisul/ quebraria os 12 testes do ciclo PF e,
    // pior, o único import que funciona em prod. O 2º sinal é o rótulo do resumo que o
    // parser já depende pra ler.
    const anonimizada = 'PADARIA? CAFECA\nRESTA TOTAL 18.348,72\nSaldo da fatura atual 18.348,72'
    expect(anonimizada).not.toMatch(/banrisul/i)
    expect(reconhecerBancoPF(anonimizada)?.banco).toBe('Banrisul')
  })

  it('⛔ o 2º sinal do Banrisul NÃO casa com o do Nubank ("RESUMO DA FATURA ATUAL" ≠ "Saldo da…")', () => {
    expect(reconhecerBancoPF('RESUMO DA FATURA ATUAL\nTotal a pagar R$ 3.053,32')?.banco).toBe('Nubank')
  })

  it('⛔⛔ documento sem marca de banco nenhuma continua sendo NULL', () => {
    // é este caso que produz a mensagem "não reconheci este PDF" — o coração do fix
    expect(reconhecerBancoPF('documento qualquer, sem banco, sem resumo')).toBeNull()
  })

  it('⚠️ a lista de suportados é DERIVADA do registry (não dá pra mentir na mensagem)', () => {
    expect(BANCOS_SUPORTADOS_PF).toEqual(PARSERS_FATURA_PF.map((p) => p.banco))
  })
})

describe('⭐⭐ as três falhas têm nome próprio (alarme falso mata o alarme)', () => {
  const base = { banco: 'Banrisul', linhas: 10, temTotalDeclarado: true, fecha: true }

  it('⭐ documento sem os totais → oferece a saída de digitar', () => {
    const d = diagnosticarFalha({ ...base, temTotalDeclarado: false })!
    expect(d.causa).toBe('SEM_TOTAIS_DECLARADOS')
    expect(d.mensagem).toContain('digitar o total')
  })

  it('⭐ totais presentes mas 0 linhas → assume que a limitação é MINHA', () => {
    const d = diagnosticarFalha({ ...base, linhas: 0 })!
    expect(d.causa).toBe('LINHAS_NAO_LIDAS')
    expect(d.mensagem).toContain('limitação da minha leitura')
  })

  it('⭐ leu tudo e não bate → não importa, e mostra a diferença', () => {
    const d = diagnosticarFalha({ ...base, fecha: false, detalhe: '   diferença: R$ 12,00' })!
    expect(d.causa).toBe('NAO_FECHA')
    expect(d.mensagem).toContain('12,00')
    expect(d.mensagem).toContain('nada será importado')
  })

  it('⭐⭐ as quatro mensagens são DIFERENTES entre si', () => {
    const msgs = [
      diagnosticarFalha({ banco: null, linhas: 0, temTotalDeclarado: false, fecha: false })!,
      diagnosticarFalha({ ...base, temTotalDeclarado: false })!,
      diagnosticarFalha({ ...base, linhas: 0 })!,
      diagnosticarFalha({ ...base, fecha: false })!,
    ].map((d) => d.mensagem)
    expect(new Set(msgs).size).toBe(4) // se duas colarem, o dono volta a chutar a causa
  })

  it('⭐ tudo certo → não inventa falha', () => {
    expect(diagnosticarFalha(base)).toBeNull()
  })
})

describe('⭐⭐ o total declarado — duas fontes, UMA conferência', () => {
  it('⭐ o PDF tem precedência (é o número que o banco assinou)', () => {
    expect(resolverTotalDeclarado({ doPdf: 3053.32, digitado: 9999 })).toEqual({ valor: 3053.32, origem: 'PDF' })
  })

  it('⭐⭐ sem PDF, o dono digita — e a ORIGEM fica gravada', () => {
    expect(resolverTotalDeclarado({ doPdf: null, digitado: 3053.32 })).toEqual({ valor: 3053.32, origem: 'DIGITADO' })
  })

  it('⛔⛔ sem NENHUMA das duas fontes = não importa. Ponto.', () => {
    expect(resolverTotalDeclarado({ doPdf: null })).toBeNull()
    expect(resolverTotalDeclarado({ doPdf: null, digitado: null })).toBeNull()
    expect(resolverTotalDeclarado({ doPdf: null, digitado: 0 })).toBeNull()
  })

  it('⛔⛔ DIGITAR NÃO É ATALHO: se não fecha com as linhas, NÃO importa', () => {
    const t = resolverTotalDeclarado({ doPdf: null, digitado: 3053.32 })!
    const c = conferirTotal(3000, t)
    expect(c.fecha).toBe(false)
    expect(c.diferenca).toBe(-53.32)          // ao centavo
    expect(c.detalhe).toContain('digitado por você')
    // ⚠️ sem o 'R$ ' na asserção: o toLocaleString pt-BR usa espaço NÃO-QUEBRÁVEL
    // (U+00A0) entre o símbolo e o número — comparar com espaço comum dá falso vermelho.
    expect(c.detalhe).toContain('53,32')
  })

  it('⭐ a conferência é IDÊNTICA nas duas origens — só o rótulo muda', () => {
    const doPdf = conferirTotal(3053.32, { valor: 3053.32, origem: 'PDF' })
    const digitado = conferirTotal(3053.32, { valor: 3053.32, origem: 'DIGITADO' })
    expect(doPdf.fecha).toBe(digitado.fecha)
    expect(doPdf.diferenca).toBe(digitado.diferenca)
    expect(doPdf.detalhe).toContain('do PDF')
    expect(digitado.detalhe).toContain('digitado por você')
  })

  it('⚠️ a tolerância é UM CENTAVO — folga maior seria afrouxar o selo', () => {
    expect(conferirTotal(3053.33, { valor: 3053.32, origem: 'PDF' }).fecha).toBe(true)
    expect(conferirTotal(3053.34, { valor: 3053.32, origem: 'PDF' }).fecha).toBe(false)
  })

  it('⭐ a aritmética do resumo do Nubank fecha (o dono conferiu na fatura)', () => {
    // compras 2.692,12 + IOF 33,91 + outros lançamentos 327,29 = Total a pagar 3.053,32
    const soma = Math.round((2692.12 + 33.91 + 327.29) * 100) / 100
    expect(soma).toBe(3053.32)
    expect(conferirTotal(soma, { valor: 3053.32, origem: 'PDF' }).fecha).toBe(true)
  })
})
