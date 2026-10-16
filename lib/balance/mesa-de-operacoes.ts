/**
 * ⭐⭐⭐ A MESA DE OPERAÇÕES — O ORQUESTRADOR (15/10/2026).
 *
 * **O que ele faz:** lê os FATOS pelas portas que já existem e entrega a mesa ① montada pelas
 * libs puras. ⛔⛔ **ELE NÃO DECIDE NADA E NÃO CALCULA DINHEIRO** — cada número que sai daqui
 * foi assinado por um dono: `lerMargem`/`montarCascata` (o placar), `whereDoStatus` (o status
 * da conta), `saldosDaEmpresa` (o saldo do item), `montarDias`/`mediaPorDiaDaSemana` (a média
 * do dia-da-semana), `filaDeConferencia`, `lerCentralDeImport`, `conclusoesVigentes`.
 *
 * ⚠️ **ZERO MOTOR NOVO é a ordem do dono, e ela é o que mantém a mesa honesta:** uma conta
 * própria aqui seria a 2ª derivação de uma pergunta que já tem tela, e as duas divergiriam na
 * primeira borda — o dono veria um número na mesa e outro na tela do assunto.
 *
 * ⛔⛔⛔ **ZERO ESCRITA.** A mesa só LÊ. Não há um `create`/`update`/`upsert` neste arquivo, e
 * há guard contando isso — dashboard que escreve é dashboard que muda o dado só por ser aberto.
 *
 * ⚠️ **O RELÓGIO ENTRA UMA VEZ, NO TOPO.** `agora` é parâmetro e o dia do BRASIL é resolvido
 * aqui, uma vez, e **passado** pras libs puras. Cada lib olhando o relógio seria N respostas
 * pra *"que dia é hoje"* — e na virada do dia elas discordariam entre si.
 */
import type { PrismaClient } from '@prisma/client'
import { prisma as defaultPrisma } from '@/lib/db'
import { hojeBrasil, janelaDoMes, mesCorrente } from '@/lib/periodo/mes-corrente'
import { horaEmSaoPaulo } from '@/lib/datas/dia-sao-paulo'

import { lerMargem } from '@/lib/margem/leitura'
import { montarCascata } from '@/lib/margem/cascata'
import { totaisDoPdvPorDia } from '@/lib/stock/vendas/total-do-pdv'
import { whereCruzaOMes } from '@/lib/vendas/janela-mes'
import { montarDias, mediaPorDiaDaSemana, type EntradaDoExtrato } from '@/lib/vendas/dia-a-dia'
import { whereDoStatus } from '@/lib/contas-pagar/escopo'
/**
 * ⛔⛔ **"DE QUEM É ESTA CONTA A PAGAR?" TEM UM DONO — e ele não é `bankAccount.companyId`.**
 * Conta a pagar nasce SEM conta bancária; filtrar por ela devolve ZERO em silêncio. Foi o
 * defeito deste arquivo em 15/10 (`CONTAS 7 DIAS` em R$ 0 com R$ 58.653,84 vencendo, e o
 * radar dizendo *"Vencem hoje · nada"* com R$ 17.701,34 vencendo HOJE). Ver o porquê inteiro
 * em `ramosDaEmpresaEmContaAPagar`.
 */
import { ramosDaEmpresaEmContaAPagar } from '@/lib/contas-pagar/list-filters'
import { saldosDaEmpresa } from '@/lib/stock/saldo'
import { filaDeConferencia } from '@/lib/stock/producao/fila-de-conferencia'
import { lerCompromissos } from '@/lib/custos-fixos/compromissos'
import { lerCentralDeImport } from '@/lib/stock/vendas/central-de-import'
import { SELOS_QUE_PEDEM_ACAO } from '@/lib/stock/vendas/razao-sabor-pizza'
import { diaAoVivo } from '@/lib/stock/producao/dia-ao-vivo'
import { conclusoesVigentes } from '@/lib/stock/producao/conclusoes-vigentes'
import { carimbosDoDia } from '@/lib/stock/producao/conferencia'
import { avisosAbertos } from '@/lib/avisos/central'

import { serieDeSaldo, type SerieDeSaldo } from './serie-de-saldo'
import { montarPagaXEntra, type PagaXEntra, type ContaAgendada } from './paga-x-entra'
import { montarRadar, placarDoRadar, type LinhaDoRadar } from './radar-da-mesa'
import { montarFita, type EventoDaFita } from './fita-do-dia'
import { montarPregao, type PregaoDoMes } from './pregao-do-mes'

const DIA_MS = 86_400_000
const dia = (d: Date) => d.toISOString().slice(0, 10)
const dt = (s: string) => new Date(`${s}T00:00:00.000Z`)

/**
 * ⚠️ **8 SEMANAS DE HISTÓRIA PRA A MÉDIA POR DIA-DA-SEMANA — e o número tem motivo.** O corte
 * da casa exige **2 amostras** por dia-da-semana (`MIN_AMOSTRAS_DO_DIA`); com 8 semanas cada
 * dia tem até 8, então um feriado ou um dia fechado não derruba a média pra "a apurar". ⛔ Uma
 * janela de 2 semanas deixaria toda a mesa dizendo "a apurar" no primeiro feriado.
 */
const SEMANAS_DE_HISTORIA = 8

export interface MesaDeOperacoes {
  empresaId: string
  /** YYYY-MM-DD do dia do BRASIL — a mesa inteira foi montada contra ESTE dia */
  hoje: string
  /** módulo 1 */
  caixa: SerieDeSaldo
  /** módulo 2 */
  radar: { linhas: LinhaDoRadar[]; placar: ReturnType<typeof placarDoRadar> }
  /** módulo 3 — ⚠️ `null` quando não há margem a apurar (empresa sem venda medida) */
  pregao: PregaoDoMes | null
  /** módulo 4 */
  pagaXEntra: PagaXEntra
  /** módulo 5 */
  fita: EventoDaFita[]
  /** módulo 6a — as contas dos próximos 7 dias, top 5 + o resto contado */
  contas7Dias: { topo: ContaAgendada[]; resto: number; total: number }
  /** módulo 6b — a média por dia-da-semana, com o melhor dia marcado */
  tuaSemana: { dow: number; rotulo: string; media: number | null; amostras: number; melhor: boolean }[]
  /** módulo 6c — a cozinha agora, da porta do Hoje ao vivo */
  cozinhaAgora: { fazendo: number; naFila: number; concluidasHoje: number; unidades: number }
  /**
   * ⚠️ O QUE A MESA NÃO ALCANÇOU — nunca silencioso. Porta que falha entra aqui com o nome, e
   * a tela DIZ. **Erro disfarçado de vazio** é a doença que esta casa mais paga.
   */
  naoAlcancado: string[]
}

const DOW_CURTO = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'] as const

/**
 * ⭐⭐ CADA PORTA FALHA SOZINHA — e a mesa continua abrindo.
 *
 * ⛔ Um `Promise.all` cru derrubaria a mesa INTEIRA porque o estoque está fora do ar. ⚠️ Mas
 * **fail-soft não pode ser silencioso**: o que não veio entra em `naoAlcancado` com o nome do
 * módulo, e a tela escreve. É a régua do *"erro e vazio são estados diferentes"* (20/09).
 */
async function porta<T>(nome: string, f: () => Promise<T>, falhas: string[]): Promise<T | null> {
  try {
    return await f()
  } catch {
    falhas.push(nome)
    return null
  }
}

export async function lerMesaDeOperacoes(
  empresaId: string,
  agora: Date = new Date(),
  db: PrismaClient = defaultPrisma,
): Promise<MesaDeOperacoes> {
  const hoje = hojeBrasil(agora)
  const mes = mesCorrente(agora)
  const j = janelaDoMes(mes)
  const falhas: string[] = []

  /** a janela dos próximos 7 dias (contando hoje) */
  const fim7 = new Date(dt(hoje).getTime() + 7 * DIA_MS)
  /** a janela de história pra a média por dia-da-semana */
  const desdeHistoria = new Date(dt(hoje).getTime() - SEMANAS_DE_HISTORIA * 7 * DIA_MS)

  /**
   * ⚠️ A ORDEM DO DESTRUCTURING ACOMPANHA A ORDEM DO `Promise.all` — e o `tsc` cobra. Foi ele
   * que pegou, na primeira tentativa, que eu tinha inserido as portas novas no MEIO do array
   * e deixado o `diasDeVenda` recebendo o agregado das contas.
   */
  const [
    caixa, margem, agendadas, negativos, fila, compromissos,
    venceHoje, central, cozinha, lotesDeHoje, diasDeVenda,
    /** ⭐ os três baldes da fita que faltavam até 15/10 — cada um da porta do assunto */
    carimbos, pagasHoje, avisos,
  ] = await Promise.all([
      porta('o caixa', () => serieDeSaldo(empresaId, { dias: 30 }, agora, db), falhas),
      porta('o pregão do mês', () => lerMargem(empresaId, 'MES', agora, {}, db), falhas),
      /**
       * ⭐ AS CONTAS AGENDADAS VÊM DO `whereDoStatus`, o dono único do status desde 13/09 —
       * ⛔ um `dueDate < now` próprio aqui pintaria de vermelho, às 23h de São Paulo, a conta
       * que ainda tem o dia inteiro (a cicatriz do fuso).
       */
      porta(
        'as contas a pagar',
        () =>
          db.transaction.findMany({
            where: {
              AND: [
                { OR: ramosDaEmpresaEmContaAPagar(empresaId) },
                whereDoStatus('A_PAGAR', agora),
                { dueDate: { gte: dt(hoje), lt: fim7 } },
              ],
            },
            orderBy: { dueDate: 'asc' },
            select: { id: true, dueDate: true, amount: true, description: true },
          }),
        falhas,
      ),
      porta('os itens negativos', () => saldosDaEmpresa(db, empresaId), falhas),
      porta('a fila de conferência', () => filaDeConferencia(empresaId, db, agora), falhas),
      porta('os compromissos do mês', () => lerCompromissos(empresaId, mes, agora, db), falhas),
      /**
       * ⭐ CONTAS QUE VENCEM HOJE — a PARTIÇÃO `VENCE_HOJE` de 26/09, não um recorte do
       * `A_PAGAR`. ⛔ Somar as duas contaria a mesma conta 2× (foi o defeito do "a vencer 3d").
       */
      porta(
        'as contas que vencem hoje',
        () =>
          db.transaction.aggregate({
            where: {
              AND: [
                { OR: ramosDaEmpresaEmContaAPagar(empresaId) },
                whereDoStatus('VENCE_HOJE', agora),
              ],
            },
            _count: true,
            _sum: { amount: true },
          }),
        falhas,
      ),
      /**
       * ⭐⭐ OS SELOS DA IMPORTAÇÃO vêm do MESMO `vereditoDoDia` que pinta a central (08/10) —
       * o radar TRADUZ, nunca decide. ⛔ Uma régua própria faria o sininho/radar gritar sobre
       * um dia que a central mostra verde.
       */
      porta('os selos da importação', () => lerCentralDeImport(empresaId, mes, db, hoje), falhas),
      /** ⭐ A COZINHA AGORA — a porta do Hoje ao vivo, a mesma da mesa ② */
      porta('a cozinha agora', () => diaAoVivo({ companyId: empresaId, dia: hoje, agora }, db), falhas),
      /**
       * ⭐ OS LOTES DO DIA pela PORTA ÚNICA das concluídas (12/10) — ⛔ ela ignora as
       * ESTORNADAS por construção, que é o que impede a fita de mostrar o cartão duplo que o
       * dono viu no Hoje ao vivo.
       */
      porta(
        'os lotes de hoje',
        () => conclusoesVigentes(empresaId, { de: dt(hoje), ate: new Date(dt(hoje).getTime() + DIA_MS) }, db),
        falhas,
      ),
      /**
       * ⭐ OS DIAS DE VENDA pelo MESMO caminho da tela de Vendas (`totaisDoPdvPorDia` +
       * `whereCruzaOMes` + `montarDias`) — ⛔ a sobreposição é obrigatória: filtrar por
       * pertencimento esconde o bloco de fim de semana INTEIRO (foram R$ 43.106,03 invisíveis
       * em 25/08).
       */
      porta(
        'a média por dia da semana',
        async () => {
          const [pdv, vs, primeira] = await Promise.all([
            totaisDoPdvPorDia(empresaId, desdeHistoria, dt(hoje), db),
            db.vendaDiaria.findMany({
              where: { companyId: empresaId, ...whereCruzaOMes(desdeHistoria, dt(hoje)) },
              orderBy: { dataCompetencia: 'asc' },
              select: {
                dataCompetencia: true,
                dataCompetenciaFim: true,
                meio: true,
                valorLiquido: true,
              },
            }),
            db.regraRecebimento.findFirst({
              where: { companyId: empresaId },
              orderBy: { vigenteDe: 'asc' },
              select: { vigenteDe: true },
            }),
          ])
          const extrato: EntradaDoExtrato[] = vs.map((v) => ({
            dia: dia(v.dataCompetencia),
            fim: dia(v.dataCompetenciaFim),
            total: v.valorLiquido,
            meio: v.meio,
          }))
          return montarDias({
            de: dia(desdeHistoria),
            ate: dia(new Date(dt(hoje).getTime() - DIA_MS)),
            pdv: new Map(
              [...pdv].map(([k, v]) => [
                k,
                {
                  vendeu: v.vendeu,
                  unidades: v.unidades,
                  produtos: v.produtos,
                  complementos: v.complementos,
                },
              ]),
            ),
            extrato,
            hoje,
            moduleInicio: primeira ? dia(primeira.vigenteDe) : null,
          })
        },
        falhas,
      ),
      /**
       * ⭐⭐ OS CARIMBOS DE QUATRO OLHOS DE HOJE — a porta mora no módulo que conhece
       * `stock_conclusao_carimbo` (`lib/stock/producao/conferencia.ts`), nunca aqui.
       */
      porta(
        'os lotes conferidos',
        () =>
          carimbosDoDia(
            empresaId,
            { de: dt(hoje), ate: new Date(dt(hoje).getTime() + DIA_MS) },
            db,
          ),
        falhas,
      ),
      /**
       * ⭐⭐ AS CONTAS PAGAS HOJE — pelo `whereDoStatus('PAGA')`, o dono único do status
       * desde 13/09, com o recorte do DIA por cima.
       *
       * ⚠️ O `mes` do `whereDoStatus` é de propósito **não** usado aqui: aquele recorte é de
       * FLUXO (o mês que a tela de Contas a Pagar navega) e este é do DIA de hoje. O que
       * **não** pode é inventar uma 2ª definição de *"conta paga"* — e essa continua vindo
       * da porta (`paymentDate != null`).
       *
       * ⛔ E a empresa é resolvida pelo `ramosDaEmpresaEmContaAPagar`: conta a pagar NASCE
       * SEM `bankAccountId` (a ponte do estoque, 24/08), então `bankAccount.companyId`
       * devolveria ZERO em silêncio — a 4ª ocorrência dessa classe.
       */
      porta(
        'as contas pagas hoje',
        () =>
          db.transaction.findMany({
            where: {
              AND: [
                { OR: ramosDaEmpresaEmContaAPagar(empresaId) },
                whereDoStatus('PAGA', agora),
                { paymentDate: { gte: dt(hoje), lt: new Date(dt(hoje).getTime() + DIA_MS) } },
              ],
            },
            orderBy: { paymentDate: 'asc' },
            select: { id: true, description: true, amount: true, paymentDate: true },
          }),
        falhas,
      ),
      /** ⭐ os avisos do sininho — a MESMA `avisosAbertos` que o painel dele lê */
      porta('os avisos do dia', () => avisosAbertos(empresaId, db), falhas),
    ])

  const medias = diasDeVenda ? mediaPorDiaDaSemana(diasDeVenda, hoje) : []

  /** ⭐ os itens com saldo ≤ 0 — a MESMA régua da Posição, nunca um `where` novo */
  const itensNegativos = (negativos ?? []).filter((s) => s.saldo <= 0).length

  /**
   * ⭐⭐ O PREGÃO SÓ EXISTE COM A MARGEM — e ele recebe a `Casa` e a `Cascata` prontas.
   * ⛔ É isso que faz *"o pregão == o placar ao centavo"* ser verdade por CONSTRUÇÃO: não há
   * um único número de dinheiro calculado entre a leitura e a tela.
   */
  const pregao: PregaoDoMes | null = margem
    ? montarPregao({
        rotuloDoPeriodo: margem.janela.rotuloCurto,
        casa: margem.casa,
        cascata: montarCascata(margem.casa, margem.sobras, margem.cmvPorCompra),
        ontem: margem.linhaDeChegada,
        medias,
        hoje,
        dowDeHoje: dt(hoje).getUTCDay(),
        /**
         * ⛔ Os dois tipos vão SEPARADOS — somá-los aqui era o que fazia o pregão dizer
         * *"13 parcela(s)"* com 9 parcelas e 4 faturas de cartão dentro. O Σ do dinheiro
         * continua sendo o do dono único (`lerCompromissos`); o que muda é o rótulo saber
         * de que ele é feito.
         */
        emprestimosDoMes: {
          total: compromissos?.total ?? 0,
          parcelas: compromissos?.parcelas?.length ?? 0,
          faturas: compromissos?.faturas?.length ?? 0,
        },
      })
    : null

  const contas: ContaAgendada[] = (agendadas ?? []).map((c) => ({
    dia: dia(c.dueDate as Date),
    valor: c.amount,
    descricao: c.description ?? 'sem descrição',
  }))

  const pagaXEntra = montarPagaXEntra({ hoje, medias, contas, dias: 7 })

  /**
   * ⭐ A MÉDIA DA SEMANA com o MELHOR DIA marcado — ⚠️ "melhor" entre os dias que têm média;
   * dia "a apurar" nunca é coroado (prêmio que ninguém disputou).
   */
  const comMedia = medias.filter((m) => m.media != null)
  const melhorDow =
    comMedia.length > 0
      ? comMedia.reduce((a, b) => ((b.media as number) > (a.media as number) ? b : a)).dow
      : null
  const tuaSemana = medias.map((m) => ({
    dow: m.dow,
    rotulo: DOW_CURTO[m.dow],
    media: m.media,
    amostras: m.amostras,
    melhor: m.dow === melhorDow,
  }))

  /**
   * ⭐ CONTAS · 7 DIAS — top 5 pelo VALOR, e o resto **contado e dito** (*"as 22 →"*).
   * ⛔ Cortar sem dizer quantas ficaram fora é a truncagem silenciosa que esta casa já pagou
   * quatro vezes (o fermento, a ordem do ano 202, o recebimento, a lista de receitas).
   */
  const porValor = [...contas].sort((a, b) => b.valor - a.valor)
  const contas7Dias = {
    topo: porValor.slice(0, 5),
    resto: Math.max(0, porValor.length - 5),
    total: Math.round(porValor.reduce((s, c) => s + c.valor, 0) * 100) / 100,
  }

  return {
    empresaId,
    hoje,
    caixa:
      caixa ?? {
        saldoAgora: 0,
        contas: 0,
        pontos: [],
        hoje: { entrou: 0, saiu: 0 },
        janelaCompleta: false,
      },
    radar: (() => {
      const linhas = montarRadar({
        empresaId,
        venceHoje: {
          quantas: venceHoje?._count ?? 0,
          total: venceHoje?._sum?.amount ?? 0,
        },
        itensNegativos,
        aguardandoConferencia: fila?.cartoes?.length ?? 0,
        cardapio: {
          semFicha: margem?.saboresSemFicha?.length ?? 0,
          cobertura: margem?.casa?.cobertura?.pct ?? null,
        },
        /**
         * ⭐ Os dias que PEDEM AÇÃO saem da MESMA lista de selos que a central desenha, e o
         * dia de HOJE nunca entra (a cozinha importa de noite — cobrar às 10h um arquivo que
         * chega às 23h é ruído diário).
         */
        importacao: (() => {
          const pedem = (central?.dias ?? []).filter(
            (d) => d.dia !== hoje && SELOS_QUE_PEDEM_ACAO.includes(d.selo),
          )
          return {
            diasQuePedemAcao: pedem.length,
            diaMaisAntigo: pedem.length > 0 ? pedem[pedem.length - 1].dia : null,
          }
        })(),
      })
      return { linhas, placar: placarDoRadar(linhas) }
    })(),
    pregao,
    pagaXEntra,
    fita: montarFita({
      empresaId,
      /**
       * ⭐⭐ OS LOTES VÊM DA `linhaDoTempo` DO **HOJE AO VIVO** — a MESMA porta da mesa ②.
       *
       * ⚠️ Eu havia escrito isto lendo `conclusoesVigentes`, e o `tsc` cobrou: aquela porta
       * devolve ids e quantidades, **não o nome do produto nem de quem fez** — a fita sairia
       * com *"produto"* no lugar do nome. ⭐ E a escolha acabou sendo a melhor por outro
       * motivo: lendo a MESMA fonte da mesa ②, as duas mesas **não têm como divergir** sobre o
       * que aconteceu no dia, que é justamente o vermelho que o dono pediu.
       *
       * ⛔ A régua das ESTORNADAS continua de pé: o `diaAoVivo` já consome a porta única das
       * concluídas desde 12/10, então a fita herda de graça o *"uma ordem = um cartão"*.
       */
      lotesConcluidos: (cozinha?.linhaDoTempo ?? [])
        .filter((e) => e.loteFechado != null)
        .map((e, n) => ({
          id: `${e.ordemId ?? 'sem-ordem'}:${n}`,
          ordemId: e.ordemId ?? '',
          produto: e.texto,
          quantidade: e.loteFechado!.qtdGerada,
          unidade: e.loteFechado!.unidade,
          quando: e.quando,
          quem: e.quem,
        })),
      /**
       * ⭐⭐⭐ OS TRÊS BALDES QUE FALTAVAM, LIGADOS NAS PORTAS REAIS (16/10) — a pendência da
       * 2.1 que este arquivo registrava por nome em 15/10 (*"enquanto estiverem vazios, a
       * fita mostra MENOS do que o dia teve"*).
       *
       * ⛔⛔ **CADA UM VEM DA PORTA DO ASSUNTO, nunca de uma consulta própria daqui:**
       *   · `lotesConferidos` ← `carimbosDoDia` (o dono de `stock_conclusao_carimbo`);
       *   · `contasPagas`     ← `whereDoStatus('PAGA')`, o MESMO do card de Contas a Pagar;
       *   · `avisos`          ← `avisosAbertos`, a MESMA leitura do sininho.
       * ⚠️ Uma leitura própria faria a fita contar uma história que a tela do assunto não
       * confirma — e *"duas telas com números diferentes pro mesmo dia"* é a doença de sempre.
       *
       * ⚠️⚠️ **E O NOME DA TABELA DO CARIMBO ESTAVA ERRADO NO COMENTÁRIO ANTIGO** (ele dizia
       * `stock_conclusao_conferida`; a tabela é **`stock_conclusao_carimbo`**). Achado ao
       * ligar a porta — *comentário que nomeia a tabela errada manda o próximo procurar no
       * lugar errado*.
       */
      lotesConferidos: (carimbos ?? []).map((c) => ({
        id: c.id,
        ordemId: c.ordemId,
        produto: c.produto,
        quando: c.quando,
        quem: c.quem,
      })),
      /**
       * ⚠️ O INSTANTE DO FATO É O `paymentDate` — nunca o `criadoEm` da linha. A conta pode
       * ser marcada paga hoje com data de pagamento de ontem; datar pelo registro poria no
       * dia de hoje um fato de outro dia, que é exatamente o erro que a fita existe pra não
       * cometer (*"o instante do FATO, nunca o da leitura"*, no cabeçalho de `fita-do-dia`).
       */
      contasPagas: (pagasHoje ?? [])
        .filter((p) => p.paymentDate != null)
        .map((p) => ({
          id: p.id,
          descricao: p.description ?? 'conta paga',
          valor: p.amount,
          quando: p.paymentDate!,
        })),
      /** ⭐ a venda importada do dia, pelo selo que a central já decidiu */
      vendasImportadas: (central?.dias ?? [])
        .filter((d) => d.dia === hoje && d.unidades > 0)
        .map((d) => ({ dia: d.dia, unidades: d.unidades, valor: d.valor, quando: agora })),
      /**
       * ⭐ OS AVISOS QUE NASCERAM HOJE — da MESMA `avisosAbertos` do sininho.
       *
       * ⚠️⚠️ O recorte é por **`criadoEm`**, e isso tem um limite que fica DITO em vez de
       * escondido: um aviso **REABERTO** hoje (o `origem+alvo` que volta) mantém o `criadoEm`
       * antigo e **não aparece na fita**. ⛔ Não inventei um campo pra isso: `AvisoNaTela` só
       * expõe `criadoEm`, e derivar "reabriu hoje" de `atualizadoEm` seria ler por fora da
       * porta — além de confundir *"o problema voltou"* com *"o dono marcou lido"*, que
       * também toca aquele campo.
       *
       * ⛔ E o filtro de dia roda **sobre a saída da porta**, nunca como um `where` próprio:
       * *"está em aberto"* continua tendo uma régua só (`resolvidoEm: null`, no sininho).
       */
      avisos: (avisos ?? [])
        .filter((a) => a.criadoEm.slice(0, 10) === hoje)
        .map((a) => ({ id: a.id, titulo: a.titulo, setor: a.setor, quando: new Date(a.criadoEm) })),
      hora: (d) => horaBrasil(d),
    }),
    contas7Dias,
    tuaSemana,
    /**
     * ⭐ A COZINHA AGORA é a MESMA porta da mesa ② (`diaAoVivo`) — ⛔ uma contagem própria
     * faria a mesa ① dizer "3 fazendo" e a mesa ② mostrar 2, no mesmo instante.
     */
    cozinhaAgora: {
      fazendo: cozinha?.agora?.length ?? 0,
      naFila: cozinha?.pessoas?.reduce((n, p) => n + (p.naFila ?? 0), 0) ?? 0,
      concluidasHoje: (lotesDeHoje ?? []).length,
      unidades: Math.round(((lotesDeHoje ?? []).reduce((n, c) => n + c.qtdGerada, 0)) * 1000) / 1000,
    },
    naoAlcancado: falhas,
  }
}

/**
 * ⚠️ A HORA NO FUSO DO BRASIL — e ela mora NO ORQUESTRADOR, porque as libs puras não conhecem
 * relógio. ⛔ Formatar na lib faria o módulo puro depender de ambiente, e a fita passaria a
 * mostrar hora do servidor (UTC) — 3 horas à frente do balcão.
 *
 * ⭐⭐ **E AGORA ELA É CASCA DO DONO ÚNICO** (`horaEmSaoPaulo`, 15/10) — a mesa ②, esta e a tela
 * do HOJE tinham **três cópias** da mesma formatação. ⚠️ **E a unificação APERTOU:** esta versão
 * subtraía **3h fixas**, o que estaria errado em 1 hora no dia em que o horário de verão
 * voltasse; o dono único usa `timeZone: 'America/Sao_Paulo'`, que é correto por construção.
 */
export const horaBrasil = horaEmSaoPaulo
