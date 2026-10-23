/**
 * ⛔⛔⛔ RT2 + RT3 — OS GRUPOS SÃO AS LISTAS DO DONO (22/10/2026), provado CONTRA BANCO.
 *
 * `docs/real-x-teorico-referencia.html` é a LEI desta tela. **RT2:** *"os grupos são as listas
 * do dono, COMPARTILHADAS (Radar · Consumo & Compras · aqui — uma verdade só, porta única):
 * renomear no lápis ✎, adicionar item, criar grupo novo. Mexeu aqui, valeu nas três telas."*
 * **RT3:** a agenda de contagem por grupo.
 *
 * ⚠️ Este arquivo roda contra o BANCO (REGRA 3) porque a pergunta é **comportamental**: "o
 * vínculo que eu criei aqui é o MESMO que as outras duas telas leem?". Um teste puro sobre a
 * tradução não prova nada sobre a membership compartilhada — ela é uma TABELA.
 *
 * ═══ ⭐⭐ AS DUAS PONTAS QUE ESTE ARQUIVO TRAVA ═══
 *
 * (a) **UMA MEMBERSHIP, TRÊS LEITORES.** `porNaLista` escreve em `stock_radar_item`; o Radar e
 *     o Consumo & Compras leem por `listasDoRadar`, a mesa por `itensPorLista`. É a mesma
 *     linha — então o vínculo vale nas três **por construção**, não por sincronização.
 * (b) **RENOMEAR NÃO TOCA MEMBERSHIP.** O slug é a identidade e o nome é roupa (a lição do
 *     `systemSlug='BRIDGE_ENTRY'`, 13/08) — e é isso que torna *"idêntico antes==depois"* uma
 *     comparação de arrays, não uma promessa.
 *
 * ═══ ⚠️⚠️ DUAS DIVERGÊNCIAS DO BRIEF, MEDIDAS ANTES DE ESCREVER ESTE ARQUIVO ═══
 *
 * O brief pedia *"renomear reflete no Radar E no Consumo & Compras"*. **Medido: hoje NÃO
 * reflete, e por duas causas distintas** — as duas registradas como débito, nenhuma
 * "consertada" por conta própria no meio deste sprint:
 *
 *   1. **o RÓTULO é CRAVADO nas outras duas telas** (`<Bloco titulo="💰 OS CAROS" …>` na
 *      página do Radar). Elas não leem `gruposDoRadar`, então o nome que o dono escolher aqui
 *      não chega lá. ⛔ É a 2ª apresentação do mesmo dado que o RT2 existe pra matar, e ela
 *      diverge **no primeiro rename**.
 *   2. **grupo NOVO não existe pra elas.** `listasDoRadar` colapsa tudo em
 *      `{caros, revenda, porcoes}` — um slug `G<hex>` é descartado na leitura. Logo o grupo
 *      criado aqui aparece na mesa e **não** no Radar nem no Compras.
 *
 * ⛔ **E eu NÃO escrevo teste afirmando esses dois estados** — teste que afirma o defeito é o
 * anti-padrão que esta casa já pagou (14/09). O que fica travado aqui é o que É verdade: a
 * membership dos três grupos de origem vale nas três telas, e o rename não a quebra.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { prisma } from '@/lib/db'
import {
  gruposDoRadar,
  criarGrupo,
  renomearGrupo,
  definirAgendaDoGrupo,
  GrupoError,
} from '../grupos'
import { porNaLista, tirarDaLista, itensPorLista, listasDoRadar } from '../watchlist'
import { seloDaAgenda, diaDaSemanaSegFirst } from '../agenda-da-contagem'

/**
 * ⚠️⚠️ O DIA VEM DO RELÓGIO, ANDANDO PRA TRÁS — nunca uma data fixa.
 *
 * `seloDaAgenda` recebe `hoje` como **dia de calendário**, e data fixa em posição de relógio é
 * bomba: verde hoje, vermelha no dia em que o calendário a alcança (a REGRA 12 de 01/09, e o
 * guard `sem-data-fixa-no-futuro` morde). ⭐ Andar pra TRÁS mantém tudo no passado — então
 * nenhuma data futura entra, e o teste vale em qualquer dia em que ele rodar.
 */
function ultimoDiaQueFoi(diaDaSemanaAlvo: number): string {
  const agora = new Date()
  for (let k = 0; k < 7; k++) {
    const d = new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth(), agora.getUTCDate() - k))
    const iso = d.toISOString().slice(0, 10)
    if (diaDaSemanaSegFirst(iso) === diaDaSemanaAlvo) return iso
  }
  throw new Error('impossível: toda semana tem os 7 dias')
}

const CNPJ = '95959595000195'
let companyId: string
let frango: string, queijo: string, coca: string

beforeEach(async () => {
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
  const c = await prisma.company.create({ data: { cnpj: CNPJ, name: 'GRUPOS RT2' } })
  companyId = c.id
  const mk = (nome: string, un: string, cat: string) =>
    prisma.stockItem.create({
      data: { companyId, nome, unidadeControle: un, categoria: cat, criadoVia: 'MANUAL' },
    })
  frango = (await mk('FILE DE PEITO DE FRANGO', 'KG', 'MATERIA_PRIMA')).id
  queijo = (await mk('porçao queijo 135 grama', 'UN', 'INTERMEDIARIO')).id
  coca = (await mk('COCA COLA 600ML', 'UN', 'REVENDA')).id
})

afterEach(async () => {
  for (const t of ['stockGrupoVigiado', 'stockRadarItem', 'stockContagemItem', 'stockContagem', 'stockMovement', 'stockItem'] as const) {
    // @ts-expect-error delegate dinâmico
    await prisma[t].deleteMany({ where: { companyId } })
  }
  await prisma.company.deleteMany({ where: { id: companyId } })
})

describe('⭐⭐ A SEMEADURA NOMINAL — comportamento IDÊNTICO antes==depois', () => {
  /**
   * ⭐ A prova de que semear é seguro: os três slugs semeados são **exatamente** os literais
   * que já estão gravados em `stock_radar_item.lista` desde 21/09. Então a semente **aponta
   * pros vínculos que existem** — nada é movido, nada é duplicado, e o que nasce é só o nome,
   * o emoji, a ordem e a agenda.
   */
  it('⛔ semeia os 3 e NÃO move uma linha de membership', async () => {
    await porNaLista({ companyId, lista: 'CAROS', itemId: frango }, prisma)
    await porNaLista({ companyId, lista: 'PORCOES', itemId: queijo }, prisma)
    await porNaLista({ companyId, lista: 'REVENDA', itemId: coca }, prisma)
    const antes = await listasDoRadar(companyId, prisma)

    const { grupos, semeadoAgora } = await gruposDoRadar(companyId, prisma)
    expect(semeadoAgora).toBe(true)
    expect(grupos.map((g) => g.slug)).toEqual(['REVENDA', 'CAROS', 'PORCOES'])

    const depois = await listasDoRadar(companyId, prisma)
    expect(depois.caros, 'a semeadura mexeu na membership dos CAROS').toEqual(antes.caros)
    expect(depois.porcoes).toEqual(antes.porcoes)
    expect(depois.revenda).toEqual(antes.revenda)
  })

  /**
   * ⚠️⚠️ **O SEED NÃO PODE RODAR DE NOVO — ele sobrescreveria o rename do dono**, que é
   * justamente o gesto que esta tabela existe pra permitir. É a régua do `listasDoRadar`
   * (20/09) com a aposta mais alta: lá o seed de volta repetiria uma lista; aqui ele apagaria
   * o nome que ele escolheu.
   */
  it('⛔⛔ e NÃO semeia de novo por cima do nome que o dono escolheu', async () => {
    const { grupos } = await gruposDoRadar(companyId, prisma)
    const caros = grupos.find((g) => g.slug === 'CAROS')!
    await renomearGrupo({ companyId, grupoId: caros.id, nome: 'carne e frango' }, prisma)

    const relido = await gruposDoRadar(companyId, prisma)
    expect(relido.semeadoAgora).toBe(false)
    expect(relido.grupos.find((g) => g.slug === 'CAROS')!.nome).toBe('carne e frango')
    expect(relido.grupos).toHaveLength(3)
  })

  /**
   * ⚠️⚠️ ESTE TESTE NASCEU DE UM **VERDE DE GRAÇA** NA REGRA 11, e o aperto é a lição.
   *
   * Repus o defeito (tirei o early-return, pra a semente rodar SEMPRE) e os 16 testes ficaram
   * **VERDES** — porque quem barra a reposição é o **`@@unique([companyId, slug])` do banco**: o
   * `createMany` falha, cai no `catch` e **relê**, devolvendo o nome renomeado intacto.
   * ⛔ ***Ou seja: o `if (linhas.length > 0)` é OTIMIZAÇÃO, não a trava*** — e linha que não pode
   * falhar é linha que finge ser trava (a lição do `ehVizinho`, 17/10).
   *
   * ⭐ **É a MESMA cicatriz do seed do Radar (20/09):** *"quem barrava a reposição era o índice
   * único do banco, não o early-return que eu testava — no dia em que alguém trocasse o
   * `createMany` por `upsert`, o seed reporia COM o guard verde"*.
   *
   * ⭐⭐ Então o que este teste afirma é a **INTENÇÃO**: com a tabela POVOADA, a semente não pode
   * nem ser **CONSULTADA**. Um `db` espião explode se ela for — e aí o defeito morde, em vez de
   * depender de o banco ter sorte.
   */
  it('⛔⛔⛔ com grupo já gravado, a semente não é NEM CONSULTADA (o espião explode)', async () => {
    await gruposDoRadar(companyId, prisma)

    let tentouSemear = false
    const espiao = new Proxy(prisma, {
      get(alvo, prop) {
        if (prop !== 'stockGrupoVigiado') return (alvo as never)[prop as never]
        return new Proxy((alvo as never)['stockGrupoVigiado'] as object, {
          get(delegate, metodo) {
            if (metodo === 'createMany' || metodo === 'upsert' || metodo === 'create') {
              return () => {
                tentouSemear = true
                throw new Error(`⛔ a semente foi ACIONADA (${String(metodo)}) com a tabela povoada`)
              }
            }
            return (delegate as never)[metodo as never]
          },
        })
      },
    }) as typeof prisma

    const relido = await gruposDoRadar(companyId, espiao)
    expect(tentouSemear, 'o seed tentou gravar por cima do que já existe').toBe(false)
    expect(relido.semeadoAgora).toBe(false)
    expect(relido.grupos).toHaveLength(3)
  })
})

describe('⛔⛔⛔ RT2 — UMA MEMBERSHIP, TRÊS LEITORES', () => {
  /**
   * ⭐⭐ O CORAÇÃO DO RT2: *"adicionar item aqui vale no Radar e no Consumo & Compras"*. A
   * prova é que as três leituras saem da MESMA linha — e o teste confere as três, não uma.
   */
  it('⭐⭐ adicionar item aqui aparece nas TRÊS leituras', async () => {
    const { grupos } = await gruposDoRadar(companyId, prisma)
    await porNaLista({ companyId, lista: 'CAROS', itemId: frango, quem: 'dono' }, prisma)

    // (1) a mesa do Real × Teórico
    const porGrupo = await itensPorLista(companyId, grupos.map((g) => g.slug), prisma)
    expect(porGrupo.CAROS).toEqual([frango])
    // (2) o Radar e (3) o Consumo & Compras leem pela MESMA porta
    const listas = await listasDoRadar(companyId, prisma)
    expect(listas.caros, 'o Radar não viu o item que a mesa adicionou').toEqual([frango])
  })

  /**
   * ⛔ e TIRAR vale igual nas três — é o ✕ do Radar valendo aqui, e vice-versa.
   *
   * ⚠️ O FRANGO fica na lista de propósito: ele é o que mantém a tabela POVOADA, que é o caso
   * real (a Caçula tem 35 itens vigiados). Zerar TUDO cai na borda do seed, que o teste
   * seguinte NOMEIA com número.
   */
  it('⛔ e tirar pelo Radar tira da mesa também', async () => {
    const { grupos } = await gruposDoRadar(companyId, prisma)
    await porNaLista({ companyId, lista: 'CAROS', itemId: frango }, prisma)
    await porNaLista({ companyId, lista: 'PORCOES', itemId: queijo }, prisma)
    await tirarDaLista({ companyId, lista: 'PORCOES', itemId: queijo }, prisma)

    const porGrupo = await itensPorLista(companyId, grupos.map((g) => g.slug), prisma)
    expect(porGrupo.PORCOES).toEqual([])
    expect(porGrupo.CAROS, 'tirar de um grupo mexeu no vizinho').toEqual([frango])

    const listas = await listasDoRadar(companyId, prisma)
    expect(listas.porcoes).toEqual([])
    expect(listas.caros).toEqual([frango])
    expect(listas.semeadaAgora, 'o seed rodou com a tabela POVOADA').toBe(false)
  })

  /**
   * ⛔⛔⛔ ACHADO MEDIDO, **NÃO CONSERTADO** (decisão do dono) — O SEED RENASCE QUANDO A TABELA
   * ZERA, e desfaz a decisão de quem tirou o último item.
   *
   * A régua de 20/09 diz *"o seed só roda no PRIMEIRO acesso — rodando sempre, sobrescreveria a
   * edição do dono"*. A implementação pergunta **`linhas.length > 0`**, e ***"está vazia agora" ≠
   * "nunca foi semeada"***: tirar o último item das TRÊS listas e reabrir o Radar **GRAVA a
   * semente de novo** (medido: 0 → 1 linha).
   *
   * ⚠️ **É BORDA EXTREMA, e o número importa pra não virar alarme:** exige zerar as três listas
   * de uma vez, e o ✕ do Radar tira **um item por gesto** (a Caçula tem 35 vigiados). Nenhum
   * caminho em lote existe hoje.
   *
   * ⛔ **O conserto honesto exige uma MARCA de "já semeado"** — e marca nova é tabela/coluna, com
   * migration de estoque **CREATE-only** (o guard de CI reprova `ALTER` em migration `stock_`).
   * Isso é sprint próprio, não um `if` no meio deste. ***Este teste existe pra o dia em que
   * alguém "consertar" isso: ele vira vermelho e conta a história inteira.***
   */
  it('⚠️ A BORDA: zerar as TRÊS listas faz o seed renascer (medido, não consertado)', async () => {
    await gruposDoRadar(companyId, prisma)
    await porNaLista({ companyId, lista: 'PORCOES', itemId: queijo }, prisma)
    await tirarDaLista({ companyId, lista: 'PORCOES', itemId: queijo }, prisma)

    // ⭐ a porta da MESA é honesta: ela LÊ, nunca semeia
    expect(
      (await itensPorLista(companyId, ['PORCOES'], prisma)).PORCOES,
      'itensPorLista passou a semear — ele é LEITURA',
    ).toEqual([])
    expect(await prisma.stockRadarItem.count({ where: { companyId } })).toBe(0)

    // ⛔ e o leitor do Radar re-semeia, porque a tabela ficou vazia
    const listas = await listasDoRadar(companyId, prisma)
    expect(listas.semeadaAgora).toBe(true)
    expect(
      await prisma.stockRadarItem.count({ where: { companyId } }),
      'o seed renasceu e GRAVOU — é o achado, documentado em vez de disfarçado',
    ).toBeGreaterThan(0)
  })

  /**
   * ⭐⭐⭐ **RENOMEAR NÃO TOCA UMA LINHA DE MEMBERSHIP** — a prova do *"idêntico antes==depois"*
   * que a semeadura nominal prometeu. O slug não está em input nenhum da porta (REGRA 5:
   * impossibilidade, não disciplina), então não existe caminho pra quebrar isso.
   */
  it('⭐⭐⭐ renomear persiste e NÃO quebra a membership (slug é a identidade)', async () => {
    await porNaLista({ companyId, lista: 'CAROS', itemId: frango }, prisma)
    await porNaLista({ companyId, lista: 'PORCOES', itemId: queijo }, prisma)
    const { grupos } = await gruposDoRadar(companyId, prisma)
    const antes = await listasDoRadar(companyId, prisma)

    const caros = grupos.find((g) => g.slug === 'CAROS')!
    const salvo = await renomearGrupo(
      { companyId, grupoId: caros.id, nome: 'carne e frango', emoji: '🥩', quem: 'dono' },
      prisma,
    )
    expect(salvo.nome).toBe('carne e frango')
    expect(salvo.emoji).toBe('🥩')
    expect(salvo.slug, 'o rename trocou o SLUG — a membership inteira iria pro vazio').toBe('CAROS')

    const depois = await listasDoRadar(companyId, prisma)
    expect(depois.caros).toEqual(antes.caros)
    expect(depois.porcoes).toEqual(antes.porcoes)
    const porGrupo = await itensPorLista(companyId, ['CAROS', 'PORCOES'], prisma)
    expect(porGrupo.CAROS).toEqual([frango])
  })

  /** ⚠️ REGRA 8 — id de outra empresa NÃO renomeia o grupo do vizinho */
  it('⚠️ REGRA 8 — grupo de outra empresa é recusado', async () => {
    const { grupos } = await gruposDoRadar(companyId, prisma)
    const outra = await prisma.company.create({ data: { cnpj: '95959595000277', name: 'VIZINHA' } })
    await expect(
      renomearGrupo({ companyId: outra.id, grupoId: grupos[0].id, nome: 'roubado' }, prisma),
    ).rejects.toThrow(GrupoError)
    expect((await gruposDoRadar(companyId, prisma)).grupos[0].nome).toBe(grupos[0].nome)
    await prisma.company.deleteMany({ where: { id: outra.id } })
  })

  /** ⚠️ `'   '` nunca é escolha (o trigger `stock_texto_de_escolha` é o backstop em prod) */
  it('⚠️ nome só-espaço é recusado com a frase, nunca gravado', async () => {
    const { grupos } = await gruposDoRadar(companyId, prisma)
    await expect(
      renomearGrupo({ companyId, grupoId: grupos[0].id, nome: '   ' }, prisma),
    ).rejects.toThrow(GrupoError)
  })
})

describe('⭐⭐ RT2 — O GRUPO NOVO NASCE VAZIO', () => {
  /**
   * ⛔ Nasce **sem item e sem dia de contagem**: inventar um dia poria um selo "CONTAR HOJE"
   * numa rotina que ninguém combinou, e a ausência é a resposta honesta até ele escolher.
   */
  it('⭐ nasce vazio, no fim da mesa, sem agenda', async () => {
    await gruposDoRadar(companyId, prisma)
    const novo = await criarGrupo({ companyId, nome: 'limpeza', quem: 'dono' }, prisma)

    expect(novo.nome).toBe('limpeza')
    expect(novo.emoji, 'o grupo novo nasceu sem o emoji padrão da referência').toBe('⭐')
    expect(novo.ordem, 'grupo novo se meteu entre os que o dono já lê').toBe(3)
    expect(novo.agenda).toEqual({ todoDia: false, dias: [] })
    expect(novo.legado).toBe(false)

    const porGrupo = await itensPorLista(companyId, [novo.slug], prisma)
    expect(porGrupo[novo.slug], 'grupo novo nasceu com item').toEqual([])
  })

  /**
   * ⛔⛔ **O SLUG É MAIÚSCULO POR OBRIGAÇÃO DO BANCO** — `chk_stock_radar_item_lista` exige
   * `lista = upper(lista)` desde 21/09. Slug minúsculo seria **impossível de gravar na
   * membership**, e o grupo novo nasceria sem poder receber um item (defeito visível só em
   * prod, porque o `db push` do dev não cria CHECK).
   */
  it('⛔⛔ o slug é MAIÚSCULO e NÃO sai do nome (reservado · imutável)', async () => {
    const novo = await criarGrupo({ companyId, nome: 'os caros' }, prisma)
    expect(novo.slug).toBe(novo.slug.toUpperCase())
    expect(novo.slug, 'o slug saiu do nome e colidiu com o grupo de origem').not.toBe('CAROS')
    expect(novo.slug).toMatch(/^G[0-9A-F]{24}$/)
  })

  /** ⭐ e o grupo novo RECEBE item pela mesma porta — nenhuma 2ª tabela de membership nasceu */
  it('⭐ e recebe item pela MESMA porta da membership', async () => {
    const novo = await criarGrupo({ companyId, nome: 'limpeza' }, prisma)
    await porNaLista({ companyId, lista: novo.slug, itemId: coca }, prisma)
    const porGrupo = await itensPorLista(companyId, [novo.slug], prisma)
    expect(porGrupo[novo.slug]).toEqual([coca])
  })
})

describe('⛔⛔⛔ RT3 — A AGENDA DE CONTAGEM POR GRUPO', () => {
  /** ⭐ os defaults da semente são a ROTINA DO DONO: porções todo dia · caros SEX · revenda SEG */
  it('⭐ a semente já vem com a rotina do dono', async () => {
    const { grupos } = await gruposDoRadar(companyId, prisma)
    const por = (s: string) => grupos.find((g) => g.slug === s)!.agenda
    expect(por('PORCOES')).toEqual({ todoDia: true, dias: [] })
    expect(por('CAROS')).toEqual({ todoDia: false, dias: [4] })   // SEX
    expect(por('REVENDA')).toEqual({ todoDia: false, dias: [0] }) // SEG
  })

  /**
   * ⛔⛔ `todoDia` ZERA os dias — e isso não é arrumação, é coerência: *"todo dia"* com uma
   * lista de dias ao lado seria um 3º estado, e o selo teria que ESCOLHER qual manda (duas
   * telas escolheriam diferente).
   */
  it('⛔⛔ TODO DIA zera os dias — nunca os dois juntos', async () => {
    const { grupos } = await gruposDoRadar(companyId, prisma)
    const caros = grupos.find((g) => g.slug === 'CAROS')!

    const comDias = await definirAgendaDoGrupo(
      { companyId, grupoId: caros.id, todoDia: false, dias: [1, 3, 1], quem: 'dono' },
      prisma,
    )
    expect(comDias.agenda, 'os dias não foram normalizados (único + ordenado)').toEqual({
      todoDia: false,
      dias: [1, 3],
    })

    const todoDia = await definirAgendaDoGrupo(
      { companyId, grupoId: caros.id, todoDia: true, dias: [1, 3] },
      prisma,
    )
    expect(todoDia.agenda).toEqual({ todoDia: true, dias: [] })

    // ⭐ e persiste: a releitura vê o mesmo
    const relido = await gruposDoRadar(companyId, prisma)
    expect(relido.grupos.find((g) => g.slug === 'CAROS')!.agenda).toEqual({ todoDia: true, dias: [] })
  })

  /** ⚠️ dia fora de 0..6 não vira dia inventado — ele SAI (e o CHECK do banco é o backstop) */
  it('⚠️ dia torto é descartado, nunca gravado', async () => {
    const { grupos } = await gruposDoRadar(companyId, prisma)
    const salvo = await definirAgendaDoGrupo(
      { companyId, grupoId: grupos[0].id, todoDia: false, dias: [0, 7, -1, 3.5, 6] },
      prisma,
    )
    expect(salvo.agenda.dias).toEqual([0, 6])
  })

  /**
   * ⭐⭐⭐ **E O SELO RESPONDE AO DIA** — a segunda metade do RT3. A agenda gravada aqui é a
   * entrada da régua que pinta `CONTAR HOJE` / `próxima SEX (em Nd)` / `atrasada`.
   *
   * ⚠️ **O `hoje` entra por PARÂMETRO** (a régua é pura): um relógio dentro dela seria a 2ª
   * resposta pra *"que dia é hoje"*, e ela divergiria da rota — a cicatriz do tablet que
   * mentiu zero por dois dias (08/09).
   */
  it('⭐⭐⭐ e o selo da agenda responde ao DIA gravado', async () => {
    const { grupos } = await gruposDoRadar(companyId, prisma)
    const caros = grupos.find((g) => g.slug === 'CAROS')!
    // agenda: só SEX (dia 4, SEG-first)
    const ag = (await definirAgendaDoGrupo(
      { companyId, grupoId: caros.id, todoDia: false, dias: [4] },
      prisma,
    )).agenda

    const sexta = ultimoDiaQueFoi(4)
    const quarta = ultimoDiaQueFoi(2)

    const naSexta = seloDaAgenda({ agenda: ag, hoje: sexta, ultimaContagem: null })
    expect(naSexta.estado, 'o grupo com SEX na agenda não pediu contagem na SEXTA').toBe('CONTAR_HOJE')
    expect(naSexta.ofereceContarAgora, 'pediu pra contar e não ofereceu o atalho').toBe(true)

    const naQuarta = seloDaAgenda({ agenda: ag, hoje: quarta, ultimaContagem: null })
    expect(naQuarta.estado).not.toBe('CONTAR_HOJE')
    expect(naQuarta.texto, 'o selo não disse QUANDO é a próxima').toMatch(/SEX/)

    // ⭐ grupo sem dia nenhum não inventa rotina — nem na sexta
    const novo = await criarGrupo({ companyId, nome: 'limpeza' }, prisma)
    const semDia = seloDaAgenda({ agenda: novo.agenda, hoje: sexta, ultimaContagem: null })
    expect(semDia.estado).toBe('SEM_DIA')
    expect(semDia.ofereceContarAgora).toBe(false)
  })
})

describe('⛔⛔⛔ ZERO CONTAGEM NASCE DESTA TELA (porta única da contagem)', () => {
  /**
   * ⭐⭐⭐ **A TRAVA MAIS IMPORTANTE DO SPRINT.** O botão *"📋 contar agora"* é **ATALHO** pra a
   * tela de contagem que já existe, filtrada no grupo — ***nenhuma contagem nasce aqui***.
   *
   * ⛔ Uma 2ª porta de contagem daria duas verdades pra *"quanto tem na prateleira"*, e a
   * segunda nasceria sem o FREIO (23/08), sem a âncora de 05/10 e sem o rastro de quem
   * contou. Por isso a prova é **contabilidade de escrita**: os quatro gestos da porta de
   * grupo rodam, e a contagem e o ledger ficam **intactos**.
   */
  it('⭐⭐⭐ os 4 gestos de grupo não criam contagem nem movimento', async () => {
    const antes = {
      contagens: await prisma.stockContagem.count({ where: { companyId } }),
      linhas: await prisma.stockContagemItem.count({ where: { companyId } }),
      movimentos: await prisma.stockMovement.count({ where: { companyId } }),
    }

    const { grupos } = await gruposDoRadar(companyId, prisma)          // semear
    const novo = await criarGrupo({ companyId, nome: 'limpeza' }, prisma) // criar
    await renomearGrupo({ companyId, grupoId: novo.id, nome: 'faxina' }, prisma) // renomear
    await definirAgendaDoGrupo(                                         // agenda
      { companyId, grupoId: grupos[0].id, todoDia: true, dias: [] },
      prisma,
    )
    await porNaLista({ companyId, lista: novo.slug, itemId: coca }, prisma) // membership

    const depois = {
      contagens: await prisma.stockContagem.count({ where: { companyId } }),
      linhas: await prisma.stockContagemItem.count({ where: { companyId } }),
      movimentos: await prisma.stockMovement.count({ where: { companyId } }),
    }
    expect(depois, 'a tela de grupos criou contagem ou movimento — 2ª porta da contagem').toEqual(antes)
    expect(depois.contagens).toBe(0)
    expect(depois.movimentos).toBe(0)
  })
})
