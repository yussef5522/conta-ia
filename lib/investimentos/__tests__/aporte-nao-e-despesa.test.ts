/**
 * ⭐⭐⭐ APORTE NÃO É DESPESA — o espelho do empréstimo, do lado do ATIVO (25/09/2026).
 *
 * **Decisão do dono:** *"CAPITALIZACAO RG e PAGAMENTO CONSORCIO não são despesa nem conta a
 * pagar — são APORTES recorrentes que constroem patrimônio. Lá a parcela reduz dívida, aqui
 * aumenta ativo."*
 *
 * ⭐ **O QUE A MEDIÇÃO EM PROD MUDOU NO ESCOPO, antes de eu escrever uma linha:** as tais
 * linhas **já estavam** categorizadas como `Investimentos [INVESTIMENTOS]`, e esse dreGroup
 * **já era NÃO-DRE**. O item 3 do pedido já estava atendido — o que faltava era o CONTRATO,
 * o GESTO e a linha na lista fechada.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { sugerirAporte, type ContratoParaPalpite } from '../sugerir-aporte'
import { competenciaDaData, competenciaCurta, rastroDoAporte, ehTipoValido } from '../contratos'
import { categoriaResolveSozinha, avisoDaLinhaNaCaixa, AVISO_APORTE_SEM_CONTRATO, AVISO_CATEGORIZADA_SEM_VINCULO } from '@/lib/conciliacao/categoria-nao-quita'
import { acoesDoSentido, acaoValePraSentido } from '@/lib/conciliacao/caixa-de-entrada'
import { origemDaCategoria } from '@/lib/conciliacao/categoria-antes-do-gesto'

const ler = (p: string) => readFileSync(join(process.cwd(), p), 'utf-8')
/** ⚠️ sem comentário: o arquivo que DOCUMENTA a regra não pode ser o que a cumpre */
const semComentario = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
const d = (iso: string) => new Date(`${iso}T12:00:00.000Z`)

/** ⭐ os contratos REAIS que o dado de prod revelou */
const CONSORCIO_BANRISUL: ContratoParaPalpite = {
  id: 'c1', nome: 'Consórcio Randon', tipo: 'CONSORCIO', valorParcela: 1478.51, diaDoMes: 9, bankAccountId: 'banrisul',
}
const CONSORCIO_CAIXA: ContratoParaPalpite = {
  id: 'c2', nome: 'Consórcio Caixa', tipo: 'CONSORCIO', valorParcela: 642.95, diaDoMes: 10, bankAccountId: 'caixa',
}
const CAP_A: ContratoParaPalpite = {
  id: 'k1', nome: 'Capitalização RG 297 A', tipo: 'CAPITALIZACAO', valorParcela: 297.84, diaDoMes: 2, bankAccountId: 'banrisul',
}
const CAP_B: ContratoParaPalpite = {
  id: 'k2', nome: 'Capitalização RG 297 B', tipo: 'CAPITALIZACAO', valorParcela: 297.84, diaDoMes: 2, bankAccountId: 'banrisul',
}

describe('⭐⭐ ITEM 4 — o grupo INVESTIMENTOS não passa por contas a pagar', () => {
  it('⛔ era por não estar na lista fechada que o CONSÓRCIO ficava com o aviso', () => {
    /**
     * ⚠️ Medido em prod: **5 aportes de setembro** caíam no *"categorizada, mas sem vínculo
     * — casa com a nota ou confirma que não tem"*, cobrando uma nota que **não existe**:
     * consórcio debita direto, não emite boleto pro financeiro.
     */
    expect(categoriaResolveSozinha('INVESTIMENTOS'),
      'o aporte voltou a cobrar nota que não existe').toBe(true)
  })

  it('⛔ e a lista continua FECHADA — grupo desconhecido segue exigindo vínculo', () => {
    // ⭐ o erro seguro: pagamento de fornecedor sumindo em silêncio é o inseguro
    expect(categoriaResolveSozinha('CUSTO_PRODUTO_VENDIDO')).toBe(false)
    expect(categoriaResolveSozinha('GRUPO_QUE_NAO_EXISTE')).toBe(false)
    expect(categoriaResolveSozinha(null)).toBe(false)
  })
})

describe('⭐⭐ ITEM 2 — o gesto 📈 existe, é de SAÍDA e pede o contrato', () => {
  it('⭐ está na fileira de caminhos da saída', () => {
    const saida = acoesDoSentido('SAIDA')
    const aporte = saida.find((a) => a.acao === 'APORTE_INVESTIMENTO')
    expect(aporte, 'o gesto do aporte sumiu da fileira').toBeTruthy()
    expect(aporte!.rotulo).toBe('aporte em investimento')
    expect(aporte!.pedeAlvo, 'o gesto ficou sem alvo — seria o chip mudo').toBe('CONTRATO_INVESTIMENTO')
  })

  it('⛔ e NÃO aparece na entrada — aporte é dinheiro que SAI', () => {
    expect(acoesDoSentido('ENTRADA').some((a) => a.acao === 'APORTE_INVESTIMENTO')).toBe(false)
    expect(acaoValePraSentido('APORTE_INVESTIMENTO', 'ENTRADA')).toBe(false)
    expect(acaoValePraSentido('APORTE_INVESTIMENTO', 'SAIDA')).toBe(true)
  })

  it('⭐ a categoria dele é ESTRUTURAL — o gesto já É a classificação', () => {
    /** ⛔ pedir categoria aqui seria cobrar duas vezes pelo mesmo fato (a régua de 20/09) */
    expect(origemDaCategoria('APORTE_INVESTIMENTO')).toBe('ESTRUTURAL')
  })
})

describe('⭐⭐ O PALPITE — valor EXATO + nome, e empate não escolhe', () => {
  it('⭐ o CONSÓRCIO real de R$ 1.478,51 é reconhecido', () => {
    const p = sugerirAporte(
      { descricao: 'PAGAMENTO CONSORCIO', valor: 1478.51, data: d('2026-09-09'), bankAccountId: 'banrisul' },
      [CONSORCIO_BANRISUL, CONSORCIO_CAIXA, CAP_A],
    )
    expect(p?.contractId).toBe('c1')
    expect(p?.competencia).toBe('2026-09')
    expect(p?.confianca).toBe('ALTA')
    expect(p?.porQue, 'sugestão sem motivo não existe (07/09)').toContain('valor exato')
  })

  it('⛔⛔ DOIS títulos iguais → NENHUM palpite (o caso REAL da Caçula)', () => {
    /**
     * ⚠️ A Caçula tem **dois** títulos de capitalização de R$ 297,84 debitados no MESMO
     * dia (medido em prod: externalId 590236 e 590237). Escolher um seria chute — e o
     * dinheiro entraria no contrato errado. ***"Não sei qual é" é resposta*** (a trava do
     * PAO DE MEL).
     */
    const p = sugerirAporte(
      { descricao: 'CAPITALIZACAO RG', valor: 297.84, data: d('2026-09-02'), bankAccountId: 'banrisul' },
      [CAP_A, CAP_B],
    )
    expect(p, 'o palpite escolheu um dos dois títulos iguais — é chute com cara de certeza').toBeNull()
  })

  it('⛔⛔ VALOR PARECIDO não basta — a lição do palpite de fatura de hoje de manhã', () => {
    /**
     * ⚠️ Aquele casava por **2% do valor** e 17 de 18 apontavam pagamento de fornecedor.
     * *Diferença de centavos não compra identidade* (11/09).
     */
    for (const v of [1478.52 + 0.02, 1500, 1450]) {
      expect(sugerirAporte(
        { descricao: 'PAGAMENTO CONSORCIO', valor: v, data: d('2026-09-09'), bankAccountId: 'banrisul' },
        [CONSORCIO_BANRISUL],
      ), `R$ ${v} não é a parcela de R$ 1.478,51`).toBeNull()
    }
    // ⭐ o centavo de arredondamento passa
    expect(sugerirAporte(
      { descricao: 'PAGAMENTO CONSORCIO', valor: 1478.52, data: d('2026-09-09'), bankAccountId: 'banrisul' },
      [CONSORCIO_BANRISUL],
    )?.contractId).toBe('c1')
  })

  it('⛔⛔ o VALOR SOZINHO nunca basta — tem que haver sinal de NOME', () => {
    /**
     * ⛔ Parcela de consórcio tem exatamente a cara de um pagamento qualquer de mesmo
     * valor. Sem o nome, o palpite ofereceria "aporte" pro fornecedor — o defeito que a
     * manhã de hoje custou.
     */
    expect(sugerirAporte(
      { descricao: 'FRIGORIFICO SILVA INDUSTRIA E COMERCIO LTDA', valor: 1478.51, data: d('2026-09-09'), bankAccountId: 'banrisul' },
      [CONSORCIO_BANRISUL],
    )).toBeNull()
  })

  it('⛔ CONTA declarada que não bate elimina o candidato', () => {
    // ⭐ é o que separa os dois consórcios da Caçula: um sai do banrisul, outro do banco caixa
    expect(sugerirAporte(
      { descricao: 'PAGAMENTO CONSORCIO', valor: 642.95, data: d('2026-09-10'), bankAccountId: 'banrisul' },
      [CONSORCIO_CAIXA],
    )).toBeNull()
    expect(sugerirAporte(
      { descricao: 'PAGAMENTO CONSORCIO', valor: 642.95, data: d('2026-09-10'), bankAccountId: 'caixa' },
      [CONSORCIO_CAIXA],
    )?.contractId).toBe('c2')
  })

  it('⭐ o DIA é o 3º sinal: decide a CONFIANÇA, nunca exclui', () => {
    /** ⚠️ o banco atrasa — o consórcio da Caçula caiu dia 9, 10 e 11 em meses diferentes */
    const p = sugerirAporte(
      { descricao: 'PAGAMENTO CONSORCIO', valor: 1478.51, data: d('2026-09-25'), bankAccountId: 'banrisul' },
      [CONSORCIO_BANRISUL],
    )
    expect(p, 'dia diferente eliminou o candidato — o banco atrasa, e isso é normal').toBeTruthy()
    expect(p!.confianca).toBe('MEDIA')
  })

  it('⭐ a competência sai da data da linha, em UTC', () => {
    // ⚠️ `getMonth()` no fuso do processo puxaria o dia 1º pro mês anterior
    expect(competenciaDaData(new Date('2026-09-01T02:00:00.000Z'))).toBe('2026-09')
    expect(competenciaDaData(new Date('2026-12-31T23:00:00.000Z'))).toBe('2026-12')
  })
})

describe('⭐ O RASTRO nomeia o contrato E a competência', () => {
  it('⭐ "aporte no Consórcio X, parcela de set/2026" — as palavras do dono', () => {
    expect(rastroDoAporte('Consórcio Randon', '2026-09')).toBe('aporte no Consórcio Randon, parcela de set/2026')
  })

  it('⛔ sem o nome, o contador volta a perguntar em qual dos cinco contratos', () => {
    const r = rastroDoAporte('Capitalização RG 297 A', '2026-01')
    expect(r).toContain('Capitalização RG 297 A')
    expect(r).toContain('jan/2026')
  })

  it('⭐ competência malformada não vira texto quebrado', () => {
    expect(competenciaCurta('2026-09')).toBe('set/2026')
    expect(competenciaCurta('torto')).toBe('torto')
  })
})

describe('⭐ o vocabulário do tipo mora no TypeScript, não num CHECK', () => {
  it('⛔ a lição do CHECK do radar: vocabulário fechado no banco envelhece mal', () => {
    expect(ehTipoValido('CONSORCIO')).toBe(true)
    expect(ehTipoValido('CAPITALIZACAO')).toBe(true)
    expect(ehTipoValido('OUTRO')).toBe(true)
    expect(ehTipoValido('CRIPTO')).toBe(false)
    // ⭐ e o SQL valida só a FORMA
    const sql = semComentario(ler('prisma/migrations/20260925180000_investimentos/migration.sql'))
    expect(sql, 'o tipo virou vocabulário fechado no banco — ALTER na próxima ideia do dono')
      .not.toMatch(/CHECK\s*\(\s*"tipo"\s+IN/i)
  })
})

describe('⛔⛔ a migration é ADITIVA PURA — zero ALTER em tabela com dado real', () => {
  const sql = ler('prisma/migrations/20260925180000_investimentos/migration.sql')

  it('⭐ só CREATE TABLE novas', () => {
    expect((sql.match(/CREATE TABLE/g) ?? []).length).toBe(2)
    for (const t of ['transactions', 'companies', 'bank_accounts', 'categories']) {
      expect(sql, `a migration ALTERA ${t} — tabela com dado real`)
        .not.toMatch(new RegExp(`ALTER TABLE "${t}"\\s+(ADD|DROP|ALTER) COLUMN`, 'i'))
    }
  })

  it('⛔ a MESMA linha não vira dois aportes — é impossível, não "checado"', () => {
    expect(sql).toMatch(/CREATE UNIQUE INDEX .*investment_contributions.*transactionId/i)
  })

  it('⭐ e o rollback está escrito', () => {
    expect(sql).toContain('DROP TABLE "investment_contributions"')
    expect(sql).toContain('DROP TABLE "investment_contracts"')
  })
})

describe('⛔⛔ o gesto tem UMA porta de gravação', () => {
  it('⭐ o resolver chama `registrarAporte`, e não grava por conta própria', () => {
    const r = semComentario(ler('lib/conciliacao/resolver-linha.ts'))
    expect(r).toContain('registrarAporte(')
    // ⛔ nenhuma criação de vínculo fora da porta única
    expect(r, 'nasceu uma segunda porta de gravação do aporte')
      .not.toContain('investmentContribution.create')
  })

  it('⛔ e o erro de domínio vira MENSAGEM, nunca 500 sem corpo (a cicatriz de 19/09)', () => {
    const r = semComentario(ler('lib/conciliacao/resolver-linha.ts'))
    expect(r).toContain('AporteError')
    expect(r).toMatch(/e instanceof AporteError/)
  })

  it('⛔⛔ e a ROTA declara os campos — o que o zod não declara SOME em silêncio', () => {
    /** ⚠️ a cicatriz do `empresaId` do lote (23/09) */
    const rota = semComentario(ler('app/api/conciliacao/resolver/route.ts'))
    expect(rota).toMatch(/contractId: z\./)
    expect(rota).toMatch(/competencia: z\./)
  })
})

describe('⛔⛔⛔ O AVISO COBRA O CONTRATO, NUNCA A NOTA', () => {
  /**
   * ⚠️⚠️ **MEDIDO EM PROD e era um defeito meu, na frase que eu acabei de pôr na tela.** Com
   * o gesto no ar, as 5 linhas de aporte voltaram pra caixa dizendo *"casa com a nota ou
   * confirma que não tem"* — e consórcio **debita direto, não emite boleto**. O aviso
   * mandava o dono caçar um documento que não existe. *É a lição de 16/09.*
   */
  const base = { categoryId: 'c', avulsaConfirmada: false, temAporteVinculado: false }

  it('⛔ o aporte SEM contrato pede o CONTRATO — e a palavra "nota" não aparece', () => {
    const a = avisoDaLinhaNaCaixa({ ...base, dreGroupDaCategoria: 'INVESTIMENTOS' })
    expect(a).toBe(AVISO_APORTE_SEM_CONTRATO)
    expect(a, 'o aviso voltou a cobrar um boleto que o consórcio nunca emite').not.toContain('nota')
    expect(a).toContain('contrato')
  })

  it('⭐ com o contrato vinculado, nada é cobrado', () => {
    expect(avisoDaLinhaNaCaixa({ ...base, dreGroupDaCategoria: 'INVESTIMENTOS', temAporteVinculado: true })).toBeNull()
  })

  it('⭐ e o FORNECEDOR continua cobrando a nota — a régua de 24/09 intacta', () => {
    expect(avisoDaLinhaNaCaixa({ ...base, dreGroupDaCategoria: 'CUSTO_PRODUTO_VENDIDO' }))
      .toBe(AVISO_CATEGORIZADA_SEM_VINCULO)
  })

  it('⭐ quem a categoria resolve sozinha não pede nada (salário, retirada)', () => {
    expect(avisoDaLinhaNaCaixa({ ...base, dreGroupDaCategoria: 'DESPESAS_PESSOAL' })).toBeNull()
  })

  it('⭐ e a decisão do dono ("avulsa confirmada") cala o aviso', () => {
    expect(avisoDaLinhaNaCaixa({ ...base, dreGroupDaCategoria: 'CUSTO_PRODUTO_VENDIDO', avulsaConfirmada: true })).toBeNull()
  })
})
