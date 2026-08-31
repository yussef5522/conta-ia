// ⭐ OS VALORES DA ETIQUETA e a VALIDADE POR ESTADO.
//
// ⚠️ Os testes de LAYOUT (prévia × ZPL) saíram deste arquivo em 31/08: o layout por
// coordenada fixa foi apagado junto com o `montarZpl`/`camposParaPrevia`, que estavam
// mortos desde 30/08. As garantias que só existiam aqui — formato do ZPL, QR carregando o
// lote, sanitização de `^`/`~` — **migraram pra `blocos.test.ts`**, contra o renderizador
// que está VIVO. Nenhuma cobertura foi perdida no caminho; ela mudou de alvo.

import { describe, it, expect } from 'vitest'
import { valoresDaEtiqueta, calcularValidade, diasAte, type DadosEtiqueta } from '../modelo'

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
  })

  it('o estado aparece escrito na etiqueta (a pessoa vê onde guardar)', () => {
    expect(valoresDaEtiqueta({ ...CARNE, estado: 'CONGELADO' }).estado).toBe('CONGELADO')
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
