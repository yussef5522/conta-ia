// ⭐⭐ O QUE SE VÊ É O QUE SAI — a prévia e o ZPL leem o MESMO layout (30/08/2026).
//
// ⚠️ O navegador não renderiza ZPL, então são dois renderizadores por necessidade. O que
// estes testes travam é que os dois bebem da MESMA fonte: campo que some de um some do
// outro, posição que muda num muda no outro. Uma segunda lista de campos "igualzinha"
// divergiria na primeira mudança — e a prévia passaria a mentir sobre o que sai da Zebra.

import { describe, it, expect } from 'vitest'
import {
  MODELO_PADRAO, LADO_DOTS, montarZpl, camposParaPrevia, valoresDaEtiqueta,
  calcularValidade, diasAte, type DadosEtiqueta,
} from '../modelo'

// a porção de carne REAL da 1ª produção da Caçula (21/08, 25 UN, R$ 3,62/un)
const CARNE: DadosEtiqueta = {
  produto: 'Porção de carne 100g',
  lote: 'A1B2C3D4',
  fabricacao: new Date('2026-08-30T14:35:00'),
  validadeAte: new Date('2026-09-14T14:35:00'),
  estado: 'RESFRIADO',
  quantidade: 25,
  unidade: 'UN',
  colaborador: 'Cristian',
  empresa: 'Caçula Mix',
}

describe('⭐⭐ prévia e ZPL não podem divergir', () => {
  it('⭐⭐ os MESMOS campos aparecem nos dois', () => {
    const zpl = montarZpl(CARNE)
    const previa = camposParaPrevia(CARNE)
    for (const c of previa) {
      const valor = c.texto.replace(/^(VAL |FAB |LOTE )/, '')
      expect(zpl, `"${valor}" está na prévia mas não no ZPL`).toContain(valor)
    }
  })

  it('⭐⭐ campo DESLIGADO some dos dois', () => {
    const zpl = montarZpl(CARNE, MODELO_PADRAO, ['colaborador'])
    const previa = camposParaPrevia(CARNE, MODELO_PADRAO, ['colaborador'])
    expect(zpl).not.toContain('Cristian')
    expect(previa.find((c) => c.id === 'colaborador')).toBeUndefined()
  })

  it('⭐ campo SEM VALOR não ocupa espaço em nenhum dos dois', () => {
    const semColab = { ...CARNE, colaborador: null, quantidade: null }
    expect(montarZpl(semColab)).not.toContain('Cristian')
    expect(camposParaPrevia(semColab).find((c) => c.id === 'colaborador')).toBeUndefined()
    expect(camposParaPrevia(semColab).find((c) => c.id === 'quantidade')).toBeUndefined()
  })

  it('⭐ a posição da prévia é a MESMA do ZPL, em % (fiel em qualquer tela)', () => {
    const previa = camposParaPrevia(CARNE)
    const produto = previa.find((c) => c.id === 'produto')!
    const layoutProduto = MODELO_PADRAO.find((c) => c.id === 'produto')!
    expect(produto.esquerda).toBeCloseTo((layoutProduto.x / LADO_DOTS) * 100, 5)
    expect(produto.topo).toBeCloseTo((layoutProduto.y / LADO_DOTS) * 100, 5)
  })
})

describe('⭐ o ZPL sai válido pra a Zebra', () => {
  const zpl = montarZpl(CARNE)

  it('abre e fecha o formato, com UTF-8 e o tamanho 60×60', () => {
    expect(zpl.startsWith('^XA')).toBe(true)
    expect(zpl.trim().endsWith('^XZ')).toBe(true)
    expect(zpl).toContain('^CI28') // acentos ("Porção")
    expect(zpl).toContain(`^PW${LADO_DOTS}`)
  })

  it('⭐⭐ a VALIDADE sai em destaque (vídeo invertido) — é a linha que decide', () => {
    // numa câmara fria, com pressa, ninguém lê a 5ª linha. E validade lida errado vira
    // comida estragada servida.
    expect(zpl).toMatch(/\^GB\d+,\d+,\d+\^FS/) // a caixa preta
    expect(zpl).toContain('^FR^FDVAL 14/09/2026') // o texto invertido dentro dela
  })

  it('o QR carrega o LOTE (é o que o celular escaneia)', () => {
    expect(zpl).toContain('^BQN,2,5^FDLA,A1B2C3D4')
  })

  it('⚠️ nome com caractere de controle do ZPL não quebra o comando', () => {
    const z = montarZpl({ ...CARNE, produto: 'Molho ^especial~ da casa' })
    expect(z).toContain('Molho  especial  da casa')
    // e o formato continua íntegro
    expect((z.match(/\^XA/g) ?? []).length).toBe(1)
    expect((z.match(/\^XZ/g) ?? []).length).toBe(1)
  })
})

describe('⭐⭐ validade por ESTADO de conservação', () => {
  const fab = new Date('2026-08-30T10:00:00')

  it('⭐⭐ o mesmo produto tem validades diferentes por estado', () => {
    expect(calcularValidade(fab, 90)?.toISOString().slice(0, 10)).toBe('2026-11-28') // congelado
    expect(calcularValidade(fab, 3)?.toISOString().slice(0, 10)).toBe('2026-09-02') // resfriado
    expect(calcularValidade(fab, 1)?.toISOString().slice(0, 10)).toBe('2026-08-31') // ambiente
  })

  it('⭐⭐ SEM dias cadastrados a etiqueta diz "A DEFINIR" — nunca uma data chutada', () => {
    // ⚠️ número inventado numa etiqueta de alimento é o pior lugar possível pra um palpite:
    // a data errada é OBEDECIDA.
    expect(calcularValidade(fab, null)).toBeNull()
    expect(calcularValidade(fab, 0)).toBeNull()
    const v = valoresDaEtiqueta({ ...CARNE, validadeAte: null })
    expect(v.validade).toBe('A DEFINIR')
    expect(montarZpl({ ...CARNE, validadeAte: null })).toContain('A DEFINIR')
  })

  it('o estado aparece escrito na etiqueta (a pessoa vê onde guardar)', () => {
    expect(montarZpl({ ...CARNE, estado: 'CONGELADO' })).toContain('CONGELADO')
  })
})

describe('dias até vencer (o que alimenta o painel FEFO)', () => {
  const hoje = new Date('2026-08-30T23:00:00')
  it('conta por DIA, não por instante — 23h de hoje pra 1h de amanhã é 1 dia', () => {
    expect(diasAte(new Date('2026-08-31T01:00:00'), hoje)).toBe(1)
    expect(diasAte(new Date('2026-08-30T06:00:00'), hoje)).toBe(0) // vence hoje
    expect(diasAte(new Date('2026-08-29T23:00:00'), hoje)).toBe(-1) // já venceu
  })
  it('sem validade não inventa prazo', () => {
    expect(diasAte(null, hoje)).toBeNull()
  })
})
