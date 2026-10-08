/**
 * ⭐⭐⭐ A CENTRAL DE IMPORT — A LEITURA (08/10/2026). LÊ, NUNCA GRAVA.
 *
 * ⛔⛔ O DESENHO SE CURVOU AO RETRATO, e o retrato mudou duas coisas:
 *
 *  1. **O Σ DO ARQUIVO NÃO EXISTIA.** `stock_venda_import` guarda contagem (linhas/unidades),
 *     autor e hora — nunca o nome do arquivo nem o Σ em R$; e os COMPLEMENTOS **não têm
 *     tabela de import nenhuma**. Então, pros dias antigos, a conferência diz **"Σ gravado"**
 *     e para aí — honesto. Daqui pra frente `stock_venda_arquivo` guarda o declarado e a
 *     comparação passa a poder FALHAR, que é o que a torna útil (comparar um número com ele
 *     mesmo é o invariante circular de 28/08).
 *
 *  2. **A RÉGUA DA RAZÃO JÁ TINHA DONO.** `vereditoDoDia` é a mesma que o aviso do sininho
 *     usa desde 07/10 — a central não tem como dizer *"completo ✓"* sobre o dia que o
 *     sininho acusa.
 *
 * ⚠️ E O AUTOR/HORA DE PRODUTOS É DO **PRIMEIRO** IMPORT: o `upsert` do re-import não mexe em
 * `criadoPorId`/`criadoEm`. Por isso a central prefere o de `stock_venda_arquivo` quando ele
 * existe, e marca como `aproximado` quando cai no do import — rótulo que mente sobre quem
 * importou é pior que rótulo ausente.
 */
import type { PrismaClient } from '@prisma/client'
import { prisma as defaultPrisma } from '@/lib/db'
import { ehPizza, ehSaborDeVerdade, vereditoDoDia, ROTULO_DO_SELO, SELOS_QUE_PEDEM_ACAO, type SeloDoDia } from './razao-sabor-pizza'

const ISO = (d: Date) => d.toISOString().slice(0, 10)
const round2 = (n: number) => Math.round((n + 1e-9) * 100) / 100

export type Relatorio = 'PRODUTOS' | 'COMPLEMENTOS'

export interface ArquivoDoDia {
  relatorio: Relatorio
  nomeArquivo: string
  linhasArquivo: number
  somaQuantidade: number
  /** `null` = este relatório não declara valor (complementos) */
  somaValor: number | null
  importadoPor: string | null
  importadoEm: string
}

export interface ConferenciaDoDia {
  /** Σ declarado pelo ARQUIVO de produtos — `null` nos dias anteriores a 08/10 */
  somaArquivo: number | null
  somaGravada: number
  /** `null` quando não há Σ do arquivo pra comparar — a tela diz "Σ gravado" e para aí */
  bate: boolean | null
  /** a diferença ao centavo; `null` sem o lado do arquivo */
  diferenca: number | null
  linhasProdutos: number
  ocorrenciasSabores: number
  /** produtos vendidos sem destino no mapa — venderam e não baixaram estoque */
  semDestino: number
}

export interface DiaDaCentral {
  dia: string
  selo: SeloDoDia
  seloRotulo: string
  razao: number | null
  frase: string
  unidades: number
  valor: number
  pizzas: number
  sabores: number
  /** quantos relatórios entraram neste dia (0, 1 ou 2) */
  arquivos: number
  /** os arquivos conhecidos (só a partir de 08/10) */
  detalheArquivos: ArquivoDoDia[]
  quem: string | null
  hora: string | null
  /** ⚠️ `true` = quem/hora vêm do PRIMEIRO import (o upsert não os atualiza) */
  autorAproximado: boolean
  conferencia: ConferenciaDoDia
  /** ⭐ dia de venda (pelo calendário) sem import nenhum — a faixa coral do topo */
  buraco: boolean
}

export interface CentralDeImport {
  /** mês navegado, `YYYY-MM` */
  mes: string
  dias: DiaDaCentral[]
  /** ⭐ o alerta do topo: o dia mais antigo que pede ação, pra faixa coral */
  buracos: string[]
  /** contagem por selo, pro cabeçalho */
  contagem: Record<SeloDoDia, number>
  /**
   * ⭐ CAMADA 1 DA DROPZONE: o par do dia mais recente. A tela liga o alvo em âmbar quando
   * um dos dois faltou — **antes de o dono sair da tela**.
   */
  parDoUltimoDia: { dia: string; temProdutos: boolean; temComplementos: boolean } | null
}

/**
 * ⭐ Lê a central de um MÊS. ⚠️ O mês vem do chamador (a tela navega) — e nunca do relógio
 * do servidor dentro desta função: relatório que muda de conteúdo dependendo da hora em que
 * roda é relatório que não dá pra conferir.
 */
export async function lerCentralDeImport(
  companyId: string,
  mes: string,
  db: PrismaClient = defaultPrisma,
  /**
   * ⭐⭐ O DIA DE HOJE (`YYYY-MM-DD`, no Brasil) — e ele vem por PARÂMETRO, nunca do relógio
   * dentro desta função: quem decide "que dia é hoje no Brasil" é a ROTA, que já faz esse
   * desconto pro mês default. Duas respostas pra mesma pergunta divergiriam exatamente na
   * virada do dia, que é quando o dono importa.
   *
   * ⛔ E ele existe por causa de uma coisa que a prova em prod mostrou: **o dia de HOJE
   * aparecia como BURACO CORAL** (*"dia de venda sem arquivo nenhum"*) às 20h, quando a cozinha
   * importa às 23h. A referência é explícita — o alerta é de *"ontem pra trás"* — e cobrar
   * import de um dia que ainda está vendendo é cobrar o impossível.
   */
  hoje?: string,
): Promise<CentralDeImport> {
  const [ano, m] = mes.split('-').map(Number)
  const de = new Date(Date.UTC(ano, m - 1, 1))
  const ate = new Date(Date.UTC(ano, m, 1))

  const [imports, linhas, comp, arquivos, mapa, users, vendaDiaria] = await Promise.all([
    db.stockVendaImport.findMany({ where: { companyId, data: { gte: de, lt: ate } } }),
    db.stockVendaLinha.findMany({
      where: { companyId, data: { gte: de, lt: ate } },
      select: { data: true, nomeSuitable: true, quantidade: true, valorTotal: true },
    }),
    db.stockVendaComplementoLinha.findMany({
      where: { companyId, data: { gte: de, lt: ate } },
      select: { data: true, nomeSuitable: true, ocorrencias: true, criadoEm: true },
    }),
    db.stockVendaArquivo.findMany({ where: { companyId, data: { gte: de, lt: ate } } }),
    db.stockVendaProdutoMap.findMany({ where: { companyId }, select: { nomeSuitable: true } }),
    db.user.findMany({ select: { id: true, name: true, email: true } }),
    db.vendaDiaria.findMany({
      where: { companyId, dataCompetencia: { lt: ate } },
      select: { dataCompetencia: true, dataCompetenciaFim: true },
    }),
  ])
  const nomeUser = new Map(users.map((u) => [u.id, (u.name ?? u.email).trim()]))
  const temMapa = new Set(mapa.map((x) => x.nomeSuitable))

  // ─────────── agrega por dia ───────────
  type Acc = {
    unidades: number
    valor: number
    linhas: number
    pizzas: number
    sabores: number
    ocorrencias: number
    semDestino: number
    primeiraLinhaComp: Date | null
  }
  const porDia = new Map<string, Acc>()
  const zero = (): Acc => ({ unidades: 0, valor: 0, linhas: 0, pizzas: 0, sabores: 0, ocorrencias: 0, semDestino: 0, primeiraLinhaComp: null })
  const pega = (d: string) => {
    if (!porDia.has(d)) porDia.set(d, zero())
    return porDia.get(d)!
  }

  for (const l of linhas) {
    const a = pega(ISO(l.data))
    a.unidades += l.quantidade
    a.valor += l.valorTotal
    a.linhas += 1
    if (ehPizza(l.nomeSuitable)) a.pizzas += l.quantidade
    if (!temMapa.has(l.nomeSuitable)) a.semDestino += 1
  }
  for (const c of comp) {
    const a = pega(ISO(c.data))
    a.ocorrencias += c.ocorrencias
    // ⚠️ só SABOR DE VERDADE entra na razão — `GRANDE` é tamanho vazado (decisão de 07/10)
    if (ehSaborDeVerdade(c.nomeSuitable)) a.sabores += c.ocorrencias
    if (!a.primeiraLinhaComp || c.criadoEm < a.primeiraLinhaComp) a.primeiraLinhaComp = c.criadoEm
  }

  const temProdutosNoDia = new Set(imports.map((i) => ISO(i.data)))
  const temCompNoDia = new Set(comp.map((c) => ISO(c.data)))
  const importPorDia = new Map(imports.map((i) => [ISO(i.data), i]))
  const arqPorDia = new Map<string, typeof arquivos>()
  for (const a of arquivos) {
    const k = ISO(a.data)
    if (!arqPorDia.has(k)) arqPorDia.set(k, [])
    arqPorDia.get(k)!.push(a)
  }

  /**
   * ⭐ O universo de DIAS é a união de (tem import) ∪ (tem complemento) ∪ (**dia de VENDA
   * pelo calendário**) — é a 3ª parcela que faz o BURACO existir. ⛔ Sem ela a central só
   * mostraria o que entrou, e o dia que ninguém importou seria invisível: exatamente a
   * ausência que a faixa coral existe pra denunciar.
   */
  const diasDeVenda = new Set<string>()
  for (const v of vendaDiaria) {
    const ini = v.dataCompetencia
    const fim = v.dataCompetenciaFim ?? v.dataCompetencia
    for (let t = ini.getTime(); t <= fim.getTime(); t += 86_400_000) {
      const k = ISO(new Date(t))
      if (k >= ISO(de) && k < ISO(ate)) diasDeVenda.add(k)
    }
  }

  const todos = [...new Set([...porDia.keys(), ...temProdutosNoDia, ...temCompNoDia, ...diasDeVenda])]
    .sort()
    .reverse()

  const contagem: Record<SeloDoDia, number> = {
    COMPLETO: 0,
    COMPLEMENTOS_INCOMPLETOS: 0,
    SABORES_NAO_IMPORTADOS: 0,
    SEM_IMPORTACAO: 0,
  }

  const dias: DiaDaCentral[] = todos.map((dia) => {
    const a = porDia.get(dia) ?? zero()
    const temProdutos = temProdutosNoDia.has(dia)
    const v = vereditoDoDia({ temProdutos, pizzas: a.pizzas, sabores: a.sabores })
    contagem[v.selo] += 1

    const arqs = arqPorDia.get(dia) ?? []
    const arqProd = arqs.find((x) => x.relatorio === 'PRODUTOS')
    const imp = importPorDia.get(dia)

    /**
     * ⚠️ QUEM/HORA: prefere o do ARQUIVO (reescrito a cada import, então é a verdade do que
     * está valendo). Caindo no do `stockVendaImport`, marca `autorAproximado` — porque o
     * `upsert` do re-import **não atualiza** `criadoPorId`/`criadoEm`.
     */
    const fonteAutor = arqProd ?? null
    const quem = fonteAutor
      ? (fonteAutor.importadoPorId ? (nomeUser.get(fonteAutor.importadoPorId) ?? null) : null)
      : imp?.criadoPorId
        ? (nomeUser.get(imp.criadoPorId) ?? null)
        : null
    const quando = fonteAutor?.importadoEm ?? imp?.criadoEm ?? a.primeiraLinhaComp ?? null

    const somaArquivo = arqProd?.somaValor ?? null
    const somaGravada = round2(a.valor)

    return {
      dia,
      selo: v.selo,
      seloRotulo: ROTULO_DO_SELO[v.selo],
      razao: v.razao,
      frase: v.frase,
      unidades: a.unidades,
      valor: somaGravada,
      pizzas: a.pizzas,
      sabores: a.sabores,
      arquivos: (temProdutos ? 1 : 0) + (temCompNoDia.has(dia) ? 1 : 0),
      detalheArquivos: arqs.map((x) => ({
        relatorio: x.relatorio as Relatorio,
        nomeArquivo: x.nomeArquivo,
        linhasArquivo: x.linhasArquivo,
        somaQuantidade: x.somaQuantidade,
        somaValor: x.somaValor,
        importadoPor: x.importadoPorId ? (nomeUser.get(x.importadoPorId) ?? null) : null,
        importadoEm: x.importadoEm.toISOString(),
      })),
      quem,
      hora: quando ? quando.toISOString() : null,
      autorAproximado: !fonteAutor && !!imp,
      conferencia: {
        somaArquivo,
        somaGravada,
        // ⛔ sem o lado do arquivo, NÃO inventa um veredito: `null` e a tela diz "Σ gravado"
        bate: somaArquivo == null ? null : Math.abs(round2(somaArquivo - somaGravada)) <= 0.01,
        diferenca: somaArquivo == null ? null : round2(somaGravada - somaArquivo),
        linhasProdutos: a.linhas,
        ocorrenciasSabores: a.ocorrencias,
        semDestino: a.semDestino,
      },
      /**
       * ⭐ buraco = é dia de venda pelo calendário · não tem import de produtos · **e já acabou**.
       * ⛔ O terceiro termo é o que separa "o dono esqueceu" de "o dia ainda está rodando".
       */
      buraco: !temProdutos && diasDeVenda.has(dia) && (!hoje || dia < hoje),
    }
  })

  const ultimo = dias.find((d) => d.arquivos > 0)
  return {
    mes,
    dias,
    buracos: dias.filter((d) => d.buraco).map((d) => d.dia),
    contagem,
    parDoUltimoDia: ultimo
      ? {
          dia: ultimo.dia,
          temProdutos: temProdutosNoDia.has(ultimo.dia),
          temComplementos: temCompNoDia.has(ultimo.dia),
        }
      : null,
  }
}

/** ⭐ quantos dias pedem ação — o número que o cabeçalho e o sininho contam */
export const diasQuePedemAcao = (c: CentralDeImport) =>
  SELOS_QUE_PEDEM_ACAO.reduce((s, sel) => s + c.contagem[sel], 0)
