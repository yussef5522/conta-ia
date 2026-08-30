// ⭐⭐ O MODELO EM BLOCOS — o dono desenha, e os três lugares mostram o mesmo (30/08/2026).
//
// ⚠️ O que estes testes travam é a propriedade que o sprint inteiro depende: **prévia do
// editor == prévia da tela de imprimir == ZPL que sai na Zebra**, porque os três chamam
// `blocosParaLayout`. Se alguém escrever uma segunda função de layout "só pro editor", a
// prévia passa a mentir e ninguém descobre até a etiqueta sair errada, colada no pacote.

import { describe, it, expect } from 'vitest'
import {
  BLOCOS_PADRAO, blocosParaLayout, zplDosBlocos, previaDosBlocos, avisosDoModelo,
  lerBlocos, gravarBlocos, novoBlocoTexto, MARGEM, ESPACO, type Bloco,
} from '../blocos'
import { LADO_DOTS, type DadosEtiqueta } from '../modelo'

const CARNE: DadosEtiqueta = {
  produto: 'Porção de carne 100g',
  lote: 'A1B2C3D4',
  fabricacao: new Date('2026-08-30T14:35:00'),
  validadeAte: new Date('2026-09-02T14:35:00'),
  estado: 'RESFRIADO',
  quantidade: 25,
  unidade: 'UN',
  colaborador: 'Cristian',
  empresa: 'Caçula Mix',
}

describe('⭐⭐ prévia e ZPL saem do MESMO layout', () => {
  it('⭐⭐ todo texto da prévia está no ZPL', () => {
    const zpl = zplDosBlocos(BLOCOS_PADRAO, CARNE)
    for (const c of previaDosBlocos(BLOCOS_PADRAO, CARNE).campos) {
      if (c.tipo === 'qr') continue
      expect(zpl, `"${c.texto}" na prévia mas não no ZPL`).toContain(c.texto)
    }
  })

  it('⭐⭐ REORDENAR muda os dois na mesma medida', () => {
    const invertido = [...BLOCOS_PADRAO].reverse()
    const a = previaDosBlocos(BLOCOS_PADRAO, CARNE).campos
    const b = previaDosBlocos(invertido, CARNE).campos
    // o primeiro bloco de texto muda de identidade
    expect(a[0].id).not.toBe(b[0].id)
    // e o ZPL acompanha: quem está em cima na prévia está em cima no ZPL
    const zpl = zplDosBlocos(invertido, CARNE)
    const posPrimeiro = zpl.indexOf(b[0].texto)
    const posSegundo = zpl.indexOf(b[1].texto)
    expect(posPrimeiro).toBeLessThan(posSegundo)
  })

  it('⭐ DESLIGAR um bloco tira dos dois', () => {
    const semColab = BLOCOS_PADRAO.map((b) => (b.id === 'colaborador' ? { ...b, ativo: false } : b))
    expect(zplDosBlocos(semColab, CARNE)).not.toContain('Cristian')
    expect(previaDosBlocos(semColab, CARNE).campos.find((c) => c.id === 'colaborador')).toBeUndefined()
  })
})

describe('⭐⭐ o que o dono pode desenhar', () => {
  it('⭐⭐ RENOMEAR o rótulo: "FAB" vira "FABRICAÇÃO"', () => {
    const meu = BLOCOS_PADRAO.map((b) => (b.id === 'fabricacao' ? { ...b, rotulo: 'FABRICAÇÃO ' } : b))
    const zpl = zplDosBlocos(meu, CARNE)
    expect(zpl).toContain('FABRICAÇÃO 30/08')
    expect(zpl).not.toContain('FAB 30/08')
  })

  it('⭐⭐ LINHA DE TEXTO LIVRE entra onde ele puser', () => {
    const aviso = { ...novoBlocoTexto('MANTENHA CONGELADO'), id: 'aviso', fonte: 26 }
    const meu: Bloco[] = [aviso, ...BLOCOS_PADRAO]
    const zpl = zplDosBlocos(meu, CARNE)
    expect(zpl).toContain('MANTENHA CONGELADO')
    // está em PRIMEIRO: aparece antes do nome do produto
    expect(zpl.indexOf('MANTENHA CONGELADO')).toBeLessThan(zpl.indexOf('Porção de carne'))
  })

  it('⭐ FONTE por bloco muda o tamanho no ZPL e na prévia', () => {
    const grande = BLOCOS_PADRAO.map((b) => (b.id === 'produto' ? { ...b, fonte: 60 } : b))
    expect(zplDosBlocos(grande, CARNE)).toContain('^A0N,60,60')
    const c = previaDosBlocos(grande, CARNE).campos.find((x) => x.id === 'produto')!
    expect(c.fontePct).toBeCloseTo((60 / LADO_DOTS) * 100, 5)
  })

  it('⭐ NEGRITO no ZPL é o texto impresso 2× com 1 dot de deslocamento', () => {
    // ZPL não tem flag de negrito pra fonte escalável; é o truque padrão da Zebra
    const zpl = zplDosBlocos(BLOCOS_PADRAO, CARNE)
    expect((zpl.match(/Porção de carne 100g/g) ?? []).length).toBe(2)
  })

  it('a VALIDADE em destaque sai em vídeo invertido', () => {
    const zpl = zplDosBlocos(BLOCOS_PADRAO, CARNE)
    expect(zpl).toMatch(/\^GB\d+,\d+,\d+\^FS/)
    expect(zpl).toContain('^FR^FDVAL 02/09/2026')
  })
})

describe('⭐ o empilhamento (a ordem É o layout)', () => {
  it('o 1º bloco começa na margem e cada um empurra o próximo', () => {
    const l = blocosParaLayout(BLOCOS_PADRAO, CARNE)
    expect(l.blocos[0].y).toBe(MARGEM)
    expect(l.blocos[1].y).toBe(MARGEM + l.blocos[0].altura + ESPACO)
  })

  it('⚠️ campo SEM VALOR não deixa buraco (não ocupa linha)', () => {
    const semQtd = { ...CARNE, quantidade: null, colaborador: null }
    const l = blocosParaLayout(BLOCOS_PADRAO, semQtd)
    expect(l.blocos.find((b) => b.bloco.id === 'quantidade')).toBeUndefined()
    // e o bloco seguinte subiu
    const lote = l.blocos.find((b) => b.bloco.id === 'lote')!
    const cheio = blocosParaLayout(BLOCOS_PADRAO, CARNE).blocos.find((b) => b.bloco.id === 'lote')!
    expect(lote.y).toBeLessThan(cheio.y)
  })

  it('⭐⭐ AVISA quando não cabe na etiqueta (o dono vai exagerar nas linhas)', () => {
    const demais: Bloco[] = [
      ...BLOCOS_PADRAO,
      ...Array.from({ length: 6 }, (_, i) => ({ ...novoBlocoTexto(`linha extra ${i}`), id: `x${i}`, fonte: 30 })),
    ]
    expect(blocosParaLayout(demais, CARNE).estourou).toBe(true)
    expect(previaDosBlocos(demais, CARNE).estourou).toBe(true)
    expect(blocosParaLayout(BLOCOS_PADRAO, CARNE).estourou).toBe(false)
  })

  it('⚠️ o QR fica ancorado no canto, fora do fluxo (senão comeria 1/5 da etiqueta)', () => {
    const l = blocosParaLayout(BLOCOS_PADRAO, CARNE)
    expect(l.qr).not.toBeNull()
    expect(l.qr!.x).toBeGreaterThan(LADO_DOTS / 2)
    expect(l.qr!.y).toBeGreaterThan(LADO_DOTS / 2)
    // e não empurrou nenhum bloco de texto
    expect(l.blocos.every((b) => b.y < LADO_DOTS)).toBe(true)
  })
})

describe('⚠️⚠️ o mínimo sanitário AVISA e não trava', () => {
  it('⭐⭐ desligar a VALIDADE avisa da Vigilância — mas o modelo continua válido', () => {
    const semVal = BLOCOS_PADRAO.map((b) => (b.id === 'validade' ? { ...b, ativo: false } : b))
    const avisos = avisosDoModelo(semVal)
    expect(avisos.join(' ')).toMatch(/Vigilância/i)
    // ⚠️ e o ZPL SAI do mesmo jeito: a decisão é do dono (travar o empurraria pra fita crepe)
    expect(zplDosBlocos(semVal, CARNE)).toContain('^XA')
  })

  it('desligar FAB, nome ou o rastro (lote+QR) também avisa', () => {
    const semFab = BLOCOS_PADRAO.map((b) => (b.id === 'fabricacao' ? { ...b, ativo: false } : b))
    expect(avisosDoModelo(semFab).join(' ')).toMatch(/FABRICAÇÃO/i)

    const semRastro = BLOCOS_PADRAO.map((b) => (b.id === 'lote' || b.id === 'qr' ? { ...b, ativo: false } : b))
    expect(avisosDoModelo(semRastro).join(' ')).toMatch(/rastro/i)
  })

  it('⭐ lote desligado mas QR ligado NÃO avisa de rastro (o QR carrega o lote)', () => {
    const soQr = BLOCOS_PADRAO.map((b) => (b.id === 'lote' ? { ...b, ativo: false } : b))
    expect(avisosDoModelo(soQr).join(' ')).not.toMatch(/rastro/i)
  })

  it('o modelo padrão não tem aviso nenhum', () => {
    expect(avisosDoModelo(BLOCOS_PADRAO)).toEqual([])
  })
})

describe('⚠️ ler do banco com desconfiança', () => {
  it('JSON válido volta igual', () => {
    const meu = [...BLOCOS_PADRAO, novoBlocoTexto('oi')]
    expect(lerBlocos(gravarBlocos(meu))).toHaveLength(meu.length)
  })
  it('⚠️ JSON quebrado NÃO derruba a etiqueta — cai no padrão', () => {
    expect(lerBlocos('{isso não é json')).toEqual(BLOCOS_PADRAO)
    expect(lerBlocos('null')).toEqual(BLOCOS_PADRAO)
    expect(lerBlocos(null)).toEqual(BLOCOS_PADRAO)
  })
  it('⚠️ bloco inválido é DESCARTADO, o resto imprime (melhor sem uma linha que sem etiqueta)', () => {
    const misto = JSON.stringify([
      { id: 'produto', tipo: 'campo', campo: 'produto', rotulo: '', fonte: 40, ativo: true },
      { id: 'lixo', tipo: 'campo', campo: 'campo_que_nao_existe', rotulo: '', fonte: 20, ativo: true },
      { id: 'fonte-absurda', tipo: 'texto', texto: 'x', rotulo: '', fonte: 9999, ativo: true },
    ])
    const b = lerBlocos(misto)
    expect(b).toHaveLength(1)
    expect(b[0].id).toBe('produto')
  })
})
