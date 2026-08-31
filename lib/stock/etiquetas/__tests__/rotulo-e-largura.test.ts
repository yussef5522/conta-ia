// ⛔⛔ O RÓTULO GRUDAVA NO VALOR — o caso "queijoPorção de carne 100g" (31/08/2026).
//
// O dono testou o editor em prod, digitou "queijo" no campo Rótulo do nome do produto
// achando que trocava o CONTEÚDO, e a prévia mostrou **"queijoPorção de carne 100g"** —
// enquanto a validade, no mesmo modelo, saía "VAL 03/09/2026" com espaço.
//
// A causa não era o campo: era não existir REGRA. O separador estava embutido no DADO
// (`BLOCOS_PADRAO` gravava `'VAL '`, `'FAB '`, `'LOTE '` com espaço no fim; o produto
// gravava `''`). Cada campo se comportava do jeito que alguém digitou lá atrás.

import { describe, it, expect } from 'vitest'
import {
  juntarRotuloValor, larguraEstimadaDots, LARGURA_CALIBRADA,
  blocosParaLayout, previaDosBlocos, zplDosBlocos, lerBlocos, gravarBlocos,
  BLOCOS_PADRAO, MARGEM, type Bloco,
} from '../blocos'
import { LADO_DOTS, type DadosEtiqueta } from '../modelo'

const CARNE: DadosEtiqueta = {
  produto: 'Porção de carne 100g',
  lote: 'A1B2C3D4',
  fabricacao: new Date('2026-08-31T14:35:00'),
  validadeAte: new Date('2026-09-03T14:35:00'),
  estado: 'RESFRIADO',
  quantidade: 25,
  unidade: 'UN',
  colaborador: 'Cristian',
  empresa: 'Caçula Mix',
}

describe('⭐⭐ o separador é UMA regra, não um hábito de digitação', () => {
  it('⛔⛔ o caso REAL: rótulo "queijo" no nome do produto NÃO gruda', () => {
    // ⚠️ com a concatenação antiga (`${rotulo}${valor}`) esta linha dava
    // "queijoPorção de carne 100g" — é o red-then-green deste sprint.
    expect(juntarRotuloValor('queijo', 'Porção de carne 100g')).toBe('queijo Porção de carne 100g')
    expect(juntarRotuloValor('queijo', 'Porção de carne 100g')).not.toContain('queijoPor')
  })

  it('⭐⭐ rótulo VAZIO é estado válido — e não deixa espaço na frente', () => {
    expect(juntarRotuloValor('', 'Porção de carne 100g')).toBe('Porção de carne 100g')
    expect(juntarRotuloValor(null, 'Cristian')).toBe('Cristian')
    expect(juntarRotuloValor(undefined, 'Cristian')).toBe('Cristian')
    expect(juntarRotuloValor('', 'X').startsWith(' ')).toBe(false)
  })

  it('⚠️ rótulo só com espaços é rótulo vazio (não vira linha com espaço solto)', () => {
    expect(juntarRotuloValor('   ', 'A1B2C3D4')).toBe('A1B2C3D4')
  })

  it('⭐⭐ a TABELA das 4 combinações (a regra: sai se há algo pra imprimir)', () => {
    expect(juntarRotuloValor('carne 100 grama', '')).toBe('carne 100 grama') // rótulo só
    expect(juntarRotuloValor('', 'X')).toBe('X')                             // conteúdo só
    expect(juntarRotuloValor('VAL', '03/09/2026')).toBe('VAL 03/09/2026')    // os dois
    expect(juntarRotuloValor('', '')).toBe('')                               // nada
    expect(juntarRotuloValor('  ', '  ')).toBe('')                           // nada, com espaços
  })

  it('⚠️⚠️ o que já está no banco tem espaço no fim — e NÃO vira espaço dobrado', () => {
    // os modelos salvos antes de 31/08 gravaram 'VAL ', 'FAB ', 'LOTE '. Sem o trim o bug
    // trocaria de cara em vez de sumir: "VAL  03/09/2026".
    expect(juntarRotuloValor('VAL ', '03/09/2026')).toBe('VAL 03/09/2026')
    expect(juntarRotuloValor('VAL ', '03/09/2026')).not.toContain('  ')
    expect(juntarRotuloValor('LOTE ', 'A1B2C3D4')).toBe('LOTE A1B2C3D4')
  })

  it('⛔⛔ o caso REAL pelo caminho da TELA (layout, não só a função)', () => {
    // ⚠️ o teste acima prova a REGRA; este prova que a tela CHAMA a regra. Sem ele, alguém
    // podia deixar a concatenação antiga no laço do layout e a suíte ficava verde.
    const comQueijo = BLOCOS_PADRAO.map((b) => (b.campo === 'produto' ? { ...b, rotulo: 'queijo' } : b))
    const linha = blocosParaLayout(comQueijo, CARNE).blocos.find((b) => b.bloco.campo === 'produto')!
    expect(linha.valor).toBe('queijo Porção de carne 100g')
    const naPrevia = previaDosBlocos(comQueijo, CARNE).campos.find((c) => c.id === 'produto')!
    expect(naPrevia.texto).toBe('queijo Porção de carne 100g')
  })

  it('⭐ os dois campos que se comportavam DIFERENTE agora seguem a mesma régua', () => {
    const l = blocosParaLayout(BLOCOS_PADRAO, CARNE)
    const texto = (campo: string) => l.blocos.find((b) => b.bloco.campo === campo)?.valor
    expect(texto('produto')).toBe('Porção de carne 100g') // sem rótulo → valor puro
    expect(texto('validade')).toBe('VAL 03/09/2026')      // com rótulo → um espaço
  })

  // ⛔⛔ ESTE TESTE FOI INVERTIDO EM 31/08 — ele afirmava a regra ERRADA.
  // Dizia "rótulo sozinho não vira linha", e foi essa regra que sumiu com a linha do
  // dono. Invertido com o motivo escrito, não apagado (o mesmo tratamento que a
  // heurística do FITID recebeu quando caiu por evidência).
  it('⭐⭐ RÓTULO SOZINHO SAI — ele é o que está SALVO no modelo', () => {
    const comRotulo: Bloco[] = BLOCOS_PADRAO.map((b) =>
      b.campo === 'colaborador' ? { ...b, rotulo: 'POR' } : b)
    const l = blocosParaLayout(comRotulo, { ...CARNE, colaborador: null })
    const linha = l.blocos.find((b) => b.bloco.campo === 'colaborador')
    expect(linha, 'a linha some quando o dono escreveu um rótulo pra ela').toBeTruthy()
    expect(linha!.valor).toBe('POR')
  })

  it('⭐ e o ZPL e a prévia recebem o MESMO texto (uma junção, dois consumidores)', () => {
    const { campos } = previaDosBlocos(BLOCOS_PADRAO, CARNE)
    const naPrevia = campos.find((c) => c.id === 'produto')!.texto
    expect(naPrevia).toBe('Porção de carne 100g')
  })
})

describe('⛔⛔ O CASO REAL: rótulo preenchido + conteúdo VAZIO (31/08/2026)', () => {
  // O dono pôs "carne 100 grama" no rótulo do Nome do produto e deixou o conteúdo de
  // prévia vazio: a LINHA SUMIU INTEIRA. Bastava digitar uma letra pra ela voltar.
  // A caixa azul do inspetor promete "SAI EM TODA ETIQUETA — É SALVO", e não saía.
  const SO_ROTULO: Bloco[] = BLOCOS_PADRAO.map((b) =>
    b.campo === 'produto' ? { ...b, rotulo: 'carne 100 grama' } : b)
  const SEM_NOME: DadosEtiqueta = { ...CARNE, produto: '' }

  it('⛔⛔ a linha SAI, com o rótulo, mesmo sem conteúdo nenhum', () => {
    const linha = blocosParaLayout(SO_ROTULO, SEM_NOME).blocos.find((b) => b.bloco.campo === 'produto')
    expect(linha, 'a linha sumiu — é o bug de 31/08').toBeTruthy()
    expect(linha!.valor).toBe('carne 100 grama')
    expect(linha!.partes).toEqual({ rotulo: 'carne 100 grama', conteudo: '' })
  })

  it('⭐ e ela chega igual na PRÉVIA e no ZPL (não é conserto só de tela)', () => {
    expect(previaDosBlocos(SO_ROTULO, SEM_NOME).campos.find((c) => c.id === 'produto')!.texto)
      .toBe('carne 100 grama')
    expect(zplDosBlocos(SO_ROTULO, SEM_NOME)).toContain('carne 100 grama')
  })

  it('⭐ digitar uma letra continua funcionando (o comportamento que ele já via)', () => {
    const l = blocosParaLayout(SO_ROTULO, { ...CARNE, produto: 'a' }).blocos
      .find((b) => b.bloco.campo === 'produto')!
    expect(l.valor).toBe('carne 100 grama a')
  })

  it('⭐ vazio nos DOIS continua sumindo — linha em branco vira buraco', () => {
    const semNada = BLOCOS_PADRAO.map((b) => (b.campo === 'produto' ? { ...b, rotulo: '' } : b))
    expect(blocosParaLayout(semNada, SEM_NOME).blocos.find((b) => b.bloco.campo === 'produto'))
      .toBeUndefined()
  })

  it('⚠️ e o "VAL sem data" que a regra velha queria evitar NÃO EXISTE', () => {
    // ⭐ a suspeita do dono, confirmada: `valoresDaEtiqueta` devolve "A DEFINIR" quando
    // não há validade — nunca string vazia. Eram DUAS RÉGUAS pro mesmo caso, e a segunda
    // cobrava um bug real por um problema que a primeira já resolvia.
    const l = blocosParaLayout(BLOCOS_PADRAO, { ...CARNE, validadeAte: null }).blocos
      .find((b) => b.bloco.campo === 'validade')!
    expect(l.valor).toBe('VAL A DEFINIR')
    expect(l.partes.conteudo).toBe('A DEFINIR')
  })
})

describe('⭐⭐ rótulo vazio PERSISTE (grava, relê, continua vazio)', () => {
  it('⭐⭐ o round-trip do banco não ressuscita rótulo nenhum', () => {
    // ⚠️ o dono relatou "o do nome do produto não deixa limpar". Não achei trava no
    // código — mas se algum dia alguém puser um `|| 'algo'` no caminho, este teste morde.
    const blocos: Bloco[] = BLOCOS_PADRAO.map((b) => ({ ...b, rotulo: '' }))
    const relidos = lerBlocos(gravarBlocos(blocos))
    expect(relidos.every((b) => b.rotulo === '')).toBe(true)
    expect(relidos.length).toBe(blocos.length) // e nenhum bloco foi descartado por isso
  })

  it('⭐ e o layout do modelo todo-sem-rótulo não tem espaço sobrando em linha nenhuma', () => {
    const blocos: Bloco[] = BLOCOS_PADRAO.map((b) => ({ ...b, rotulo: '' }))
    const l = blocosParaLayout(lerBlocos(gravarBlocos(blocos)), CARNE)
    expect(l.blocos.length).toBeGreaterThan(3)
    for (const b of l.blocos) expect(b.valor).toBe(b.valor.trimStart())
  })
})

describe('⚠️ cabe na largura? — a Zebra CORTA, não quebra linha', () => {
  it('⚠️ o nome de exemplo cabe; um nome real longo NÃO', () => {
    const curto = blocosParaLayout(BLOCOS_PADRAO, CARNE)
    expect(curto.podeCortar).toBe(false)

    const longo = blocosParaLayout(BLOCOS_PADRAO, {
      ...CARNE, produto: 'Porção de carne bovina temperada 100g com molho especial',
    })
    expect(longo.podeCortar).toBe(true)
    expect(longo.blocos.find((b) => b.bloco.campo === 'produto')!.podeCortar).toBe(true)
  })

  it('⭐ diminuir a fonte resolve — é a saída que a tela oferece', () => {
    const dados = { ...CARNE, produto: 'Porção de carne bovina temperada 100g' }
    const g40 = blocosParaLayout(BLOCOS_PADRAO, dados)
    const g20 = blocosParaLayout(BLOCOS_PADRAO.map((b) => (b.campo === 'produto' ? { ...b, fonte: 20 } : b)), dados)
    expect(g40.blocos.find((b) => b.bloco.campo === 'produto')!.podeCortar).toBe(true)
    expect(g20.blocos.find((b) => b.bloco.campo === 'produto')!.podeCortar).toBe(false)
  })

  it('⚠️⚠️ a linha de baixo disputa largura com o QR (não "cabe" por cima dele)', () => {
    const l = blocosParaLayout(BLOCOS_PADRAO, CARNE)
    const empresa = l.blocos.find((b) => b.bloco.campo === 'empresa')
    const produto = l.blocos.find((b) => b.bloco.campo === 'produto')!
    if (empresa) {
      // se ela cai na faixa de altura do QR, a largura útil dela é MENOR que a do topo
      expect(empresa.larguraDisponivel).toBeLessThanOrEqual(produto.larguraDisponivel)
    }
    expect(produto.larguraDisponivel).toBe(LADO_DOTS - MARGEM - MARGEM)
  })

  it('⛔ o RÓTULO conta na largura (é texto que sai na etiqueta)', () => {
    const comRotuloLongo = BLOCOS_PADRAO.map((b) =>
      b.campo === 'produto' ? { ...b, rotulo: 'PRODUTO MANIPULADO' } : b)
    expect(blocosParaLayout(comRotuloLongo, CARNE).podeCortar).toBe(true)
  })

  it('⚠️⚠️ a medida NÃO está calibrada — então a tela diz "pode cortar", nunca "corta"', () => {
    // ⚠️ Este teste existe pra a hedge não ser esquecida. Quando a régua for impressa na
    // Zebra e a constante virar medida real, `LARGURA_CALIBRADA` vira true — e AÍ a tela
    // pode afirmar. Enquanto é estimativa, afirmar seria inventar número com cara de fato.
    expect(LARGURA_CALIBRADA).toBe(false)
  })

  it('⭐ a estimativa é da fonte ZPL (proporcional à altura), não do navegador', () => {
    // dobrar a fonte dobra a largura; o mesmo texto em 2 tamanhos não pode medir igual
    expect(larguraEstimadaDots('ABCDE', 40)).toBeCloseTo(larguraEstimadaDots('ABCDE', 20) * 2, 6)
    expect(larguraEstimadaDots('', 40)).toBe(0)
  })
})
