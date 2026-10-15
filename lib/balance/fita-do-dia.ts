/**
 * ⭐⭐⭐ A FITA DO DIA — o módulo 5 (15/10/2026).
 *
 * **O que ela responde:** *"o que aconteceu na casa hoje"* — conclusões carimbadas, contas
 * pagas, importação que entrou, avisos que os juízes abriram.
 *
 * ⛔⛔⛔ **EVENTO QUE NÃO EXISTE NA PORTA É PROIBIDO — e a trava é de TIPO, não de disciplina.**
 * `TipoDeEvento` é uma união FECHADA, e cada membro dela tem **uma porta nomeada** no comentário.
 * Inventar uma linha de fita ("parece que alguém mexeu em X") **não compila**. ⚠️ É a régua do
 * dono em forma de tipo: *"evento que não existe na porta = vermelho"*.
 *
 * ⛔⛔ **MÓDULO PURO, ZERO BANCO.** Ele recebe os fatos já lidos pelas portas de sempre
 * (`conclusoesVigentes` · `whereDoStatus('PAGA')` · `lerCentralDeImport` · a central de avisos)
 * e só ORDENA e TRADUZ. ⚠️ Ler aqui seria a 2ª derivação de cada um desses fatos, e a fita
 * passaria a contar uma história que a tela do assunto não confirma.
 *
 * ⚠️ **A FITA NÃO É A AUDITORIA.** Ela mostra o que o dono reconhece como acontecimento do dia,
 * na língua dele; quem guarda o rastro completo (quem, quando, de onde) é o audit log. Uma fita
 * que tentasse ser as duas coisas ficaria ilegível e mesmo assim incompleta.
 */

/**
 * ⭐ A UNIÃO FECHADA — cada membro com a PORTA que o produz escrita ao lado.
 * ⛔ Membro novo sem porta = membro que o `switch` do tradutor não compila.
 */
export type TipoDeEvento =
  /** `conclusoesVigentes` — a porta única das concluídas (12/10, a que ignora as estornadas) */
  | 'LOTE_CONCLUIDO'
  /** o carimbo de quatro olhos (`stock_conclusao_conferida`, 09/10) */
  | 'LOTE_CONFERIDO'
  /** `whereDoStatus('PAGA')` recortado pelo dia (26/09) */
  | 'CONTA_PAGA'
  /** `lerCentralDeImport` — o dia que entrou, pelo `vereditoDoDia` (08/10) */
  | 'VENDA_IMPORTADA'
  /** a central de avisos (`stock_aviso` / produtores, 04/10) */
  | 'AVISO_ABERTO'

export interface EventoDaFita {
  id: string
  tipo: TipoDeEvento
  /** instante do fato — ⚠️ o do FATO, nunca o da leitura */
  quando: Date
  /** "14:32" — ⚠️ formatado pela ROTA no fuso do Brasil, nunca aqui (módulo puro) */
  hora: string
  texto: string
  /** pra onde o clique leva — número morto é proibido */
  href: string
}

/** o que cada porta entrega, na forma mínima que a fita precisa */
export interface FatosDaFita {
  empresaId: string
  lotesConcluidos: { id: string; ordemId: string; produto: string; quantidade: number; unidade: string; quando: Date; quem: string | null }[]
  lotesConferidos: { id: string; ordemId: string; produto: string; quando: Date; quem: string }[]
  contasPagas: { id: string; descricao: string; valor: number; quando: Date }[]
  vendasImportadas: { dia: string; unidades: number; valor: number; quando: Date }[]
  avisos: { id: string; titulo: string; setor: string; quando: Date }[]
}

const brl = (n: number) =>
  n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const qtd = (n: number, u: string) =>
  `${n.toLocaleString('pt-BR', { maximumFractionDigits: 3 })} ${u}`

const ddmm = (dia: string) => `${dia.slice(8, 10)}/${dia.slice(5, 7)}`

export interface MontarFitaInput extends FatosDaFita {
  /** ⭐ a ROTA passa o formatador do fuso do Brasil — o módulo não conhece relógio */
  hora: (d: Date) => string
}

export function montarFita(i: MontarFitaInput): EventoDaFita[] {
  const base = `/empresas/${i.empresaId}`
  const ev: EventoDaFita[] = []

  for (const l of i.lotesConcluidos) {
    ev.push({
      id: `concl:${l.id}`,
      tipo: 'LOTE_CONCLUIDO',
      quando: l.quando,
      hora: i.hora(l.quando),
      // ⚠️ sem responsável a frase NÃO inventa um nome — "sem responsável" é o fato
      texto: `${l.produto} — ${qtd(l.quantidade, l.unidade)}${l.quem ? ` por ${l.quem}` : ' (sem responsável)'}`,
      href: `${base}/estoque/producao/${l.ordemId}`,
    })
  }

  for (const l of i.lotesConferidos) {
    ev.push({
      id: `conf:${l.id}`,
      tipo: 'LOTE_CONFERIDO',
      quando: l.quando,
      hora: i.hora(l.quando),
      texto: `✓✓ ${l.produto} conferido por ${l.quem}`,
      href: `${base}/estoque/producao/${l.ordemId}`,
    })
  }

  for (const c of i.contasPagas) {
    ev.push({
      id: `paga:${c.id}`,
      tipo: 'CONTA_PAGA',
      quando: c.quando,
      hora: i.hora(c.quando),
      texto: `${c.descricao} — ${brl(c.valor)}`,
      href: `${base}/contas-a-pagar?escopo=PAGA`,
    })
  }

  for (const v of i.vendasImportadas) {
    ev.push({
      id: `venda:${v.dia}`,
      tipo: 'VENDA_IMPORTADA',
      quando: v.quando,
      hora: i.hora(v.quando),
      texto: `venda de ${ddmm(v.dia)} entrou — ${v.unidades} un · ${brl(v.valor)}`,
      href: `${base}/estoque/vendas`,
    })
  }

  for (const a of i.avisos) {
    ev.push({
      id: `aviso:${a.id}`,
      tipo: 'AVISO_ABERTO',
      quando: a.quando,
      hora: i.hora(a.quando),
      texto: a.titulo,
      href: `${base}/avisos`,
    })
  }

  /**
   * ⭐ Do MAIS RECENTE pro mais antigo — a fita rola e o que acabou de acontecer fica no topo.
   * ⚠️ Desempate por `id` porque dois eventos podem cair no mesmo milissegundo: timestamp
   * sozinho **não é ordem total**, e sem o desempate a fita trocaria de ordem entre dois
   * carregamentos (a cicatriz do juiz de saldo, 28/08).
   */
  return ev.sort((a, b) => b.quando.getTime() - a.quando.getTime() || a.id.localeCompare(b.id))
}

/**
 * ⭐ A FITA VAZIA DIZ O QUE É — *"a casa ainda não registrou nada hoje"*.
 *
 * ⛔ Fita vazia e muda é indistinguível de fita que não carregou, e **erro disfarçado de vazio**
 * é a doença que esta casa mais paga (o *"nenhum cartão cadastrado"* com o cartão lá).
 */
export const fraseDaFitaVazia = 'a casa ainda não registrou nada hoje'
