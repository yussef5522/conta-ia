/**
 * ⭐⭐⭐ O 4º CARTÃO E A LIMPEZA DA TELA (26/09/2026) — decisão do dono.
 *
 * **Pedido:** *"Entre «A PAGAR» e «VENCIDAS» nasce o cartão VENCE HOJE (pelo dia do
 * BRASIL). «A PAGAR» passa a ser só o que vence DEPOIS de hoje (sem dupla contagem — guard:
 * Σ dos cartões de aberto = total em aberto)."*
 *
 * ⛔⛔ **E ELE NÃO É O `A VENCER (3D)` QUE MORREU EM 13/09.** Aquele era um **SUBCONJUNTO**
 * de A PAGAR escolhido a dedo (*"3 dias"* é número, não estado), então a soma dos cards
 * contava a mesma conta **2×** e o total do rodapé vinha inflado. Este é uma **PARTIÇÃO**: o
 * que vence hoje **sai** do A PAGAR. *É essa a diferença entre um card legítimo e o que
 * morreu — e é o que este arquivo prova.*
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { statusDaConta, whereDoStatus, ehFluxo, inicioDoDiaBrasil, inicioDoDiaSeguinteBrasil, type StatusDaConta } from '../escopo'
import { FAIXAS } from '../faixa-do-tempo'

const ler = (p: string) => readFileSync(join(process.cwd(), p), 'utf-8')
/** ⚠️ sem comentário: o arquivo que DOCUMENTA a remoção não pode ser o que a reprova */
const semComentario = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

const PAGINA = 'app/(dashboard)/contas-a-pagar/page.tsx'
const ROTA = 'app/api/contas-a-pagar/route.ts'

/** ⭐ 23h de São Paulo do dia 13 — o servidor em UTC já diz 14 */
const NOITE_DE_13 = new Date('2026-09-14T02:12:00.000Z')
const conta = (dueDate: string | null, extra: Record<string, unknown> = {}) => ({
  status: 'PENDING', dueDate, paymentDate: null, ...extra,
})

describe('⛔⛔⛔ Σ DOS CARTÕES DE ABERTO == TOTAL EM ABERTO (o guard que o dono pediu)', () => {
  it('⭐ os três estados de aberto PARTICIONAM tudo que está em aberto', () => {
    /**
     * ⚠️ Amostra com os quatro casos que importam: ontem, hoje, amanhã e sem data. ⭐ A de
     * HOJE tem que estar em **exatamente um** balde — se aparecesse em dois, a Σ dos cards
     * passaria do total e o dono veria dívida a mais.
     */
    const abertas = [
      conta('2026-09-12'), // vencida
      conta('2026-09-13'), // vence hoje
      conta('2026-09-14'), // a pagar
      conta('2026-09-30'), // a pagar
      conta(null), // a pagar (sem prazo não é atraso)
    ]
    const balde: Record<StatusDaConta, number> = { VENCIDA: 0, VENCE_HOJE: 0, A_PAGAR: 0, PAGA: 0 }
    for (const c of abertas) balde[statusDaConta(c, NOITE_DE_13)]++

    // ⛔ a soma dos três de ABERTO é o total em aberto: nada some, nada conta 2×
    expect(balde.VENCIDA + balde.VENCE_HOJE + balde.A_PAGAR).toBe(abertas.length)
    expect(balde.PAGA, 'conta em aberto caiu no balde de paga').toBe(0)
    expect(balde).toEqual({ VENCIDA: 1, VENCE_HOJE: 1, A_PAGAR: 3, PAGA: 0 })
  })

  it('⛔⛔ nenhuma conta cai em DOIS baldes — a dupla contagem do "a vencer (3d)"', () => {
    for (const d of ['2026-09-11', '2026-09-12', '2026-09-13', '2026-09-14', '2026-10-01', null]) {
      const st = statusDaConta(conta(d), NOITE_DE_13)
      const emQuantos = (['VENCIDA', 'VENCE_HOJE', 'A_PAGAR', 'PAGA'] as StatusDaConta[])
        .filter((x) => x === st).length
      expect(emQuantos, `a conta de ${d} está em ${emQuantos} baldes`).toBe(1)
    }
  })

  it('⭐⭐ e os `where` são CONTÍGUOS e disjuntos — a régua do banco bate com a da função', () => {
    const hoje = inicioDoDiaBrasil(NOITE_DE_13)
    const amanha = inicioDoDiaSeguinteBrasil(NOITE_DE_13)
    expect(hoje.toISOString().slice(0, 10)).toBe('2026-09-13')
    expect(amanha.toISOString().slice(0, 10)).toBe('2026-09-14')

    const v = whereDoStatus('VENCIDA', NOITE_DE_13) as { dueDate: { lt: Date } }
    const h = whereDoStatus('VENCE_HOJE', NOITE_DE_13) as { dueDate: { gte: Date; lt: Date } }
    const a = whereDoStatus('A_PAGAR', NOITE_DE_13) as { OR: Array<{ dueDate?: { gte?: Date } | null }> }

    // ⭐ ]-∞, hoje[ · [hoje, amanhã[ · [amanhã, +∞[ — sem buraco e sem sobreposição
    expect(v.dueDate.lt.getTime()).toBe(hoje.getTime())
    expect(h.dueDate.gte.getTime()).toBe(hoje.getTime())
    expect(h.dueDate.lt.getTime()).toBe(amanha.getTime())
    expect(a.OR.find((o) => o.dueDate?.gte)?.dueDate?.gte?.getTime(),
      'A PAGAR voltou a incluir hoje — a conta de hoje contaria nos dois cards').toBe(amanha.getTime())
    // ⛔ e a SEM VENCIMENTO continua no A PAGAR, senão a Σ não fecha
    expect(a.OR.some((o) => o.dueDate === null)).toBe(true)
  })

  it('⛔ VENCE HOJE é ESTOQUE — o mês NÃO o recorta', () => {
    /**
     * ⭐ *"Dívida aberta não expira com a virada do mês"*. ⚠️ E a decisão mora na função:
     * se dependesse de cada tela lembrar de não passar o mês, a primeira tela nova
     * esconderia dívida em silêncio.
     */
    expect(ehFluxo('VENCE_HOJE')).toBe(false)
    const comMes = whereDoStatus('VENCE_HOJE', NOITE_DE_13, '2026-01')
    expect(comMes, 'o mês vazou pro card de aberto').toEqual(whereDoStatus('VENCE_HOJE', NOITE_DE_13))
  })

  it('⭐ e PAGAS continua sendo FLUXO, recortada pelo mês', () => {
    expect(ehFluxo('PAGA')).toBe(true)
    expect(whereDoStatus('PAGA', NOITE_DE_13, '2026-09')).not.toEqual(whereDoStatus('PAGA', NOITE_DE_13))
  })
})

describe('⭐⭐ O CARD EXISTE, NA ORDEM, E É O FILTRO', () => {
  const pagina = semComentario(ler(PAGINA))

  it('⭐ o estado VENCE HOJE é ALCANÇÁVEL e manda o MESMO escopo que o servidor contou', () => {
    /**
     * ⚠️⚠️ **REAPONTADO em 21/10 (fatia 1.1), não afrouxado — e ele ficou VERMELHO COM A TELA
     * CERTA.** Ele ancorava no literal `label="Vence hoje"` dos 4 `StatsCard`; a fatia 1.1
     * substituiu os quatro por **UMA família só** (`CartoesDoTempo`), em que o rótulo vem
     * **MEDIDO PELO SERVIDOR** (`m.rotulo` → *"VENCE HOJE (qua · 21/10)"*) — derivar a data no
     * cliente faria um aparelho com a hora torta imprimir a janela de um dia sobre o número de
     * outro. ***Grep não distingue "refatorei" de "quebrei"*** (a razão de existir da REGRA 3).
     *
     * ⭐ **A PERGUNTA NÃO MUDOU:** *o 4º estado está alcançável e manda o escopo que o servidor
     * contou?* — ⚠️ mas o **número de caminhos caiu de dois pra UM, em 21/10**: a régua do rodapé
     * (`StickyFooter`) foi apagada no item 2 do dono e o `applyFilterPreset` estreitou pra o único
     * recorte que NÃO é faixa (as PAGAS do mês).
     *
     * ⭐⭐ **E o caminho que sobrou é o MAIS FORTE, não o mais fraco:** o cartão filtra por
     * `faixa`, e `whereDaFaixa` **delega a `whereDoStatus` por RECURSÃO** — é o MESMO corte que o
     * preset mandava, por construção, sem a chance de as duas réguas divergirem (o defeito de
     * 13/09, em que o card dizia 34 e a tabela pintava 9).
     */
    const cartoes = semComentario(ler('components/contas-pagar/CartoesDoTempo.tsx'))
    expect(cartoes, 'o cartão do VENCE HOJE sumiu da família').toContain('cartao-faixa-')
    expect(cartoes, 'o rótulo voltou a ser derivado no cliente — dois relógios')
      .toContain('label={m.rotulo}')
    expect(pagina, 'a família de cartões saiu da tela').toContain('<CartoesDoTempo')
    // ⭐ a FAIXA existe na lib (é dela que sai o `cartao-faixa-VENCE_HOJE`) — mais forte que
    // procurar a string na página, porque é o tipo que alimenta o `.map` da família
    expect(FAIXAS, 'VENCE_HOJE saiu da família de faixas').toContain('VENCE_HOJE')
    // ⭐ e o 4º estado continua dentro do total em aberto que o invariante da tela confere
    expect(pagina).toContain('kpis.totalVenceHoje')
    // ⛔ a régua do rodapé não pode renascer (era a 3ª apresentação do mesmo número)
    expect(pagina, 'o StickyFooter voltou — 3ª forma dos mesmos totais').not.toContain('StickyFooter')
  })

  it('⭐⭐ PAGAS é o ÚLTIMO cartão — e não se confunde com faixa de aberto', () => {
    /**
     * ⚠️⚠️ **INVERTIDO em 21/10 com o motivo escrito, não apagado.** A régua antiga era
     * *"a ORDEM é PAGAS · VENCE HOJE · A PAGAR · VENCIDAS"*; o dono decidiu o contrário
     * (fatia 1.1, item 1): a família passa a ser **cronológica** (VENCIDAS → VENCE HOJE →
     * PRÓXIMOS 7 DIAS → RESTO DO MÊS → DEPOIS) e **PAGAS vira o ÚLTIMO, verde, com o detalhe
     * das conciliadas** — ele é *contexto*, não faixa de aberto.
     *
     * ⭐ **A metade que continua valendo é a que importa**, e ela fica travada aqui: PAGAS
     * **não pode voltar pra o meio das faixas de aberto** (ali ele se leria como uma delas e a
     * Σ das faixas pararia de fechar com o total em aberto na frente do dono).
     */
    const cartoes = semComentario(ler('components/contas-pagar/CartoesDoTempo.tsx'))
    expect(cartoes.indexOf('cartao-pagas'), 'o cartão das PAGAS sumiu').toBeGreaterThan(-1)
    expect(cartoes.indexOf('cartao-pagas'), 'PAGAS deixou de ser o ÚLTIMO — virou faixa de aberto')
      .toBeGreaterThan(cartoes.indexOf('cartao-faixa-'))
    // ⛔ e o rótulo NÃO pode voltar a se chamar "(sem conciliar)": ele conta as conciliadas
    expect(pagina, 'o rótulo do card promete menos do que ele entrega')
      .not.toContain('label={`${ROTULO_PAGAS}')
    expect(pagina, 'o cartão das pagas perdeu o recorte do mês').toContain('Pagas · ')
  })

  it('⛔⛔ o 4º estado conta no TOTAL EM ABERTO — a dupla contagem ao contrário', () => {
    /**
     * ⚠️⚠️ **INVERTIDO em 21/10 com o motivo escrito, não apagado.** A régua antiga era
     * *"o RODAPÉ soma os quatro — ele se declara fechado"*, e ela nasceu em 26/09 porque o 4º
     * card tinha acabado de existir e o `StickyFooter` somaria **menos** que a realidade sem ele.
     *
     * ⛔ **O rodapé MORREU no item 2 do dono** (era a 3ª apresentação dos mesmos quatro totais),
     * então não há mais soma pra conferir ali. ⭐ **A metade que importa é a mesma e continua
     * travada:** o VENCE HOJE não pode ficar fora do total em aberto — se ficasse, a Σ das faixas
     * pararia de fechar com ele e o grito do `CartoesDoTempo` acenderia na frente do dono.
     *
     * ⭐⭐ E ela agora é conferida no lugar CERTO: o total que a tela mostra, somado dos **três**
     * estados de aberto, é o MESMO denominador que o invariante `Σ(faixas) == total em aberto`
     * usa — então um estado esquecido aqui vira vermelho em DOIS testes, não em zero.
     */
    expect(pagina, 'o VENCE HOJE saiu do total em aberto que a família confere')
      .toContain('kpis.totalVenceHoje + kpis.totalPendente + kpis.totalVencido')
    expect(pagina, 'a família deixou de receber o total em aberto').toContain('totalEmAberto=')
  })

  it('⛔ a ROTA devolve o KPI — sem ele o card nasce zerado e muda', () => {
    const rota = semComentario(ler(ROTA))
    expect(rota).toContain("whereDoStatus('VENCE_HOJE', now)")
    expect(rota).toContain('totalVenceHoje')
    expect(rota).toContain('countVenceHoje')
  })

  it('⭐⭐ e a RESSALVA não morreu — ela virou o DETALHE do cartão e o recorte do dropdown', () => {
    /**
     * ⚠️⚠️ **A tensão com a régua de 13/09 continua registrada, e é ela que este teste guarda.**
     * Naquele dia o rótulo ganhou *"(sem conciliar)"* porque *"nenhum rótulo promete mais do
     * que entrega"*. O card passou a entregar TODAS — então a ressalva **desceu pra a linha
     * pequena** (a divisão honesta) e o recorte virou **opção do dropdown**.
     * ⛔ Se as duas sumirem, volta a MENTIRA, que é pior que o mistério.
     */
    expect(pagina, 'a divisão honesta saiu do cartão — o total voltaria a esconder o meio')
      .toContain('conciliadas com o banco')
    expect(pagina).toContain('sem vínculo')

    const filtros = semComentario(ler('components/contas-pagar/PayableFilters.tsx'))
    expect(filtros, 'as sub-opções do recorte das pagas sumiram do dropdown')
      .toContain('ROTULO_RECORTE.PAGA_CONCILIADA')
    expect(filtros).toContain('ROTULO_RECORTE.PAGA_SEM_VINCULO')
    // ⭐ e o rótulo honesto do STATUS continua onde ele é verdade (`status=RECONCILED`)
    expect(filtros).toContain('ROTULO_PAGAS')
  })

  it('⛔⛔ e o campo morto do "a vencer (3d)" SUMIU do tipo', () => {
    /** ⚠️ o card morreu em 13/09 e os campos ficaram no tipo, sem ninguém desenhar — e o
     *  rodapé somava `countAVencer3d` (sempre 0) achando que contava algo. */
    expect(pagina, 'o campo morto voltou — é o que alguém religa por descuido')
      .not.toContain('AVencer3d')
  })
})

describe('⭐⭐ A LIMPEZA — a tela AGE, não se explica', () => {
  const pagina = semComentario(ler(PAGINA))

  it('⛔ a legenda de construção MORREU', () => {
    expect(pagina).not.toContain('Esta tela mostra o que está')
    expect(pagina, 'a frase das conciliadas voltou pra primeira dobra').not.toContain('NOTA_CONCILIADAS')
  })

  it('⛔⛔ o SELETOR DE MÊS do topo saiu — um controle por pergunta, não dois', () => {
    /**
     * ⭐ *"A tela SEMPRE abre no mês corrente, e quem quiser outra época usa o «Selecionar
     * período» de baixo, que já faz isso."*
     */
    expect(pagina, 'o segundo controle de período voltou pro topo').not.toContain('<NavegadorDeMes')
  })

  it('⭐ e o "Selecionar período" de baixo continua vivo — a capacidade não se perdeu', () => {
    /** ⛔ *remoção sem realocação é perda* (a régua da conferência de saldo, 10/09) */
    expect(pagina).toContain('<PayableFilters')
  })

  it('⛔ o subtítulo duplicado não existe mais em lugar nenhum', () => {
    const nav = semComentario(ler('components/contas-pagar/NavegadorDeMes.tsx'))
    expect(nav, 'o default voltou — uma frase de Contas a Pagar servindo qualquer tela')
      .not.toContain('o mês recorta as pagas')
    // ⭐ e a `frase` é OBRIGATÓRIA: tela nova tem que dizer o que o mês dela alcança
    expect(nav).toMatch(/frase: string\b/)
    expect(nav).not.toMatch(/frase\?: string/)
  })

  it('⭐⭐ a tela abre no MÊS CORRENTE, sempre', () => {
    // ⚠️ o `?mes=` da URL continua respeitado — link antigo não vira 404 silencioso
    expect(pagina).toContain("useState(searchParams.get('mes') ?? mesCorrente())")
  })
})
