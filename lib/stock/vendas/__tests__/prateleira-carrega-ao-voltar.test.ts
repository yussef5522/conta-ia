// ⛔⛔ O DESTINO CERTO QUE NÃO CARREGA — regressão minha, 03/09/2026.
//
// Eu travei um teste provando que salvar uma ficha de sabor **volta pra aba Complementos**.
// O destino estava certo e **a tela girava o spinner pra sempre**: a aba passou a abrir por
// `?aba=complementos`, mas o `carregarPrateleira()` só era chamado no **onClick da aba** —
// entrando pela URL, o fetch **nunca acontecia**.
//
// ⚠️ E não havia erro nenhum pra achar: nada quebrou, nada estourou no log do servidor.
// Requisição que NÃO COMEÇA é mais difícil de ver do que requisição que falha.
//
// ⭐ A lição que este arquivo trava: **provar o destino não é provar que o destino carrega.**

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { prisma } from '@/lib/db'
import { precisaCarregarPrateleira } from '../painel-complementos'
import { prateleiraGravada, confirmarComplementos } from '../import-complementos'
import { criarFicha } from '../../producao/fichas'

describe('⛔⛔ a carga é do ESTADO, não do gesto', () => {
  /**
   * Simula o ciclo de vida da tela nas DUAS fiações, sem DOM (o projeto roda em
   * `environment: node`): monta com a aba vinda da URL e roda o "efeito".
   */
  function montarTela(opcoes: { abaDaUrl: string | null; carregaNoCliqueApenas: boolean }) {
    let prateleira: unknown[] | null = null
    let fetches = 0
    const carregar = () => { fetches++; prateleira = [] }
    const aba = opcoes.abaDaUrl === 'complementos' ? 'complementos' : 'produtos'

    // ⭐ a fiação NOVA: um efeito que olha o estado
    if (!opcoes.carregaNoCliqueApenas && precisaCarregarPrateleira(aba, prateleira)) carregar()
    // ⛔ a fiação VELHA: só o clique carregava — entrar pela URL não é clicar

    return { aba, prateleira, fetches, spinnerEterno: aba === 'complementos' && prateleira === null }
  }

  it('⛔⛔ a fiação VELHA deixa o spinner eterno ao entrar pela URL — o bug reposto', () => {
    const tela = montarTela({ abaDaUrl: 'complementos', carregaNoCliqueApenas: true })
    expect(tela.aba).toBe('complementos')      // a navegação funcionou…
    expect(tela.fetches).toBe(0)               // …e nenhuma requisição saiu
    expect(tela.spinnerEterno, 'era exatamente o que o dono viu').toBe(true)
  })

  it('⭐⭐ a fiação NOVA carrega ao chegar pela URL', () => {
    const tela = montarTela({ abaDaUrl: 'complementos', carregaNoCliqueApenas: false })
    expect(tela.fetches).toBe(1)
    expect(tela.spinnerEterno).toBe(false)
  })

  it('⭐ chegando na aba de produtos, a prateleira NÃO é buscada à toa', () => {
    expect(montarTela({ abaDaUrl: null, carregaNoCliqueApenas: false }).fetches).toBe(0)
  })

  it('⭐ e com o dado já em mãos não busca de novo (o efeito não vira laço)', () => {
    expect(precisaCarregarPrateleira('complementos', [])).toBe(false)
    expect(precisaCarregarPrateleira('complementos', null)).toBe(true)
    expect(precisaCarregarPrateleira('produtos', null)).toBe(false)
  })
})

describe('⭐⭐ e o destino mostra a LINHA VERDE (o ciclo inteiro)', () => {
  const CNPJ = '70707070000199'
  let companyId = ''
  let itemPorcao = ''

  beforeEach(async () => {
    await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
    companyId = (await prisma.company.create({ data: { cnpj: CNPJ, name: 'VOLTA' } })).id
    const crua = await prisma.stockItem.create({ data: { companyId, nome: 'CALABRESA CRUA', unidadeControle: 'KG', categoria: 'MATERIA_PRIMA', criadoVia: 'MANUAL' } })
    const porcao = await criarFicha({
      companyId, nomeProduzido: 'porcao de calabresa 120 grama', unidadeProduzido: 'UN',
      tipoProduto: 'INTERMEDIARIO', loteBase: 10, unidadeLoteBase: 'UN',
      componentes: [{ itemId: crua.id, qtdPlanejada: 1.2, unidade: 'KG', posicao: 0 }],
    }, prisma)
    itemPorcao = porcao.itemProduzidoId
    // o nome existe na prateleira (veio de um import)
    await confirmarComplementos(companyId, '2026-08-29',
      `<table><tr><td>Descrição</td><td>Valor médio</td><td>Quantidade</td><td>Valor Total</td></tr>` +
      `<tr><td>CALABRESA</td><td>R$ 0,00</td><td>115</td><td>R$ 0,00</td></tr></table>`, undefined, prisma)
  })

  afterEach(async () => {
    for (const t of ['stockVendaComplementoMap', 'stockVendaComplementoLinha', 'stockVendaComplementoNome',
      'stockVendaComplementoGrupo', 'stockFichaComponente', 'stockFichaVersao', 'stockFicha',
      'stockMovement', 'stockSaldoCache', 'stockItem'] as const) {
      // @ts-expect-error dinâmico
      await prisma[t].deleteMany({ where: { companyId } })
    }
    await prisma.company.deleteMany({ where: { id: companyId } })
  })

  it('⭐⭐ salvar pela prateleira → o destino carrega e a linha está VERDE', async () => {
    // 1. o gesto que o dono repete 50×: criar a ficha do sabor pela aba
    const sabor = await criarFicha({
      companyId, nomeProduzido: 'CALABRESA', unidadeProduzido: 'UN',
      tipoProduto: 'SABOR', loteBase: 1, unidadeLoteBase: 'UN',
      componentes: [{ itemId: itemPorcao, qtdPlanejada: 1, unidade: 'UN', posicao: 0 }],
      mapearComplemento: 'CALABRESA',
    }, prisma)
    expect(sabor.vinculadoAoPdv).toBe(true)

    // 2. o destino: é isto que a tela busca ao chegar pela URL
    const { prateleira } = await prateleiraGravada(companyId, prisma)
    const linha = prateleira.find((l) => l.nomeSuitable === 'CALABRESA')!
    expect(linha, 'a prateleira voltou sem a linha').toBeTruthy()
    expect(linha.destino).toBe('FICHA')            // ⭐ o verde da tela
    expect(linha.nomeFicha).toBe('CALABRESA')
    expect(linha.fichaId).toBe(sabor.fichaId)
    expect(linha.ocorrencias).toBe(115)            // e o número que prioriza o trabalho
  })
})
