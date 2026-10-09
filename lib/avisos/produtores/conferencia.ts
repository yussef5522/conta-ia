/**
 * ⭐⭐⭐ O SININHO DA CONFERÊNCIA PARADA (09/10/2026, item 2d do dono).
 *
 * **Ordem:** *"conclusão >3h sem conferência = sininho do papel de gerência (anti-spam padrão,
 * uma causa um alarme)."*
 *
 * ⭐⭐ **A RÉGUA É A MESMA DA TELA, LITERALMENTE.** Quem diz *"está parada há quanto tempo"* é
 * `filaDeConferencia` → o campo `atrasado`, derivado de `HORAS_PRA_AVISAR` — **a mesma função
 * que desenha os cartões**. ⛔ Um `where criadoEm < agora - 3h` próprio aqui faria o sininho
 * gritar sobre conclusão que a tela não mostra (a estornada, a já conferida) — é a doença do B1,
 * que esta casa paga desde que o badge da Conciliação contava um número e a tela outro.
 * ***O produtor TRADUZ a fila; ele não decide o degrau.***
 *
 * ⛔⛔ **O VEREDITO DO FISCAL NÃO ENTRA NA FRASE, e isso não é descuido.** O cartão carrega
 * `fiscalFrase` (*"o material dava ~51"*) porque ele só existe atrás de `stock.manage`; o
 * aviso é texto que vai pro sininho, pro e-mail e pra qualquer leitor futuro da central. A lei
 * de 05/10 diz que *nenhum número esperado aparece na tela de quem declara* — e a forma de
 * manter isso é o número **não existir** neste arquivo, não ser filtrado depois.
 *
 * ⚠️ **E ele convive com o aviso do FISCAL sem empilhar errado:** aquele fala da RECEITA (*"o
 * declarado não cabe no material"*) e este fala do GESTO QUE FALTA (*"ninguém conferiu"*). São
 * ações diferentes, de pessoas diferentes, e suprimir um pelo outro deixaria um lote impossível
 * **sem ninguém sendo cobrado de olhar**. O anti-spam que importa é o de sempre: `origem+alvo`
 * é único, então a mesma conclusão é UM aviso por mais rodadas que o cron faça.
 */
import { prisma } from '@/lib/db'
import type { Prisma, PrismaClient } from '@prisma/client'
import { registrarAviso, reconciliarOrigem } from '../central'
import { avaliarLinguaDoBalcao } from '../lingua-do-balcao'
import { filaDeConferencia, HORAS_PRA_AVISAR, type CartaoDaConferencia } from '@/lib/stock/producao/fila-de-conferencia'
import type { NovoAviso } from '../tipos'

/** ⚠️ client por PARÂMETRO — a lição de 04/09: com o global cravado, um preview GRAVARIA */
type Db = PrismaClient | Prisma.TransactionClient

export const ORIGEM = 'CONFERENCIA_PARADA'

export interface ResumoDaConferencia {
  gravados: number
  reabertos: number
  resolvidos: number
  recusados: { motivo: string; titulo: string }[]
}

/** ⭐ "há quanto tempo" na língua do balcão — o mesmo arredondamento do cartão */
export function haQuantoTempoTxt(minutos: number): string {
  if (minutos < 90) return `${minutos} min`
  const h = Math.floor(minutos / 60)
  const m = minutos % 60
  return m ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`
}

/**
 * ⭐ A FRASE, com a CONSEQUÊNCIA dentro: *"o estoque já baixou e a etiqueta já saiu"*.
 *
 * ⚠️ Dizer só *"a conclusão está sem conferência"* não diz ao dono o que está em jogo — o lote
 * JÁ virou produto, JÁ descontou insumo e JÁ foi etiquetado com aquele número. A conferência é
 * o que separa *"alguém contou"* de *"alguém digitou"*, e é isso que a frase tem que carregar.
 */
export function fraseDaConferenciaParada(
  c: CartaoDaConferencia,
  companyId: string,
): NovoAviso {
  const tempo = haQuantoTempoTxt(c.minutosEsperando)
  const quem = c.declaradoPor ? `${c.declaradoPor} declarou` : 'a cozinha declarou'
  return {
    companyId,
    setor: 'gerencia',
    /**
     * ⚠️ **CORAL, não vermelho.** O dado não está errado — o lote foi declarado e baixou
     * normal; o que falta é o segundo par de olhos. Vermelho é pra dado impossível, e pintar
     * de vermelho o que é só "esperando gesto" é como o dono aprende a ignorar vermelho.
     */
    severidade: 'coral',
    titulo: `Confere o lote de ${c.produto}`,
    corpo:
      `${quem} ${c.declaradoTxt} de ${c.produto} e ninguém conferiu — está esperando há ${tempo}. ` +
      `O estoque já baixou e a etiqueta já saiu com esse número.`,
    /**
     * ⚠️⚠️ **AQUI DIZIA "confirme com o seu PIN" — e o PIN saiu do carimbo em 09/10.** O texto
     * sobreviveu à correção do fluxo porque ele vive no PRODUTOR, não na tela: *a varredura por
     * tela não acha a frase que mora no sininho*. Mandar o gerente procurar um PIN que ele não
     * tem é a mesma família do *"o rótulo promete mais do que entrega"*.
     */
    oQueFazer:
      'Abra a Conferência do dia na produção e confirme com o seu login — ou corrija o número, ' +
      'se a contagem foi outra.',
    acaoRotulo: 'conferir agora',
    acaoHref: `/empresas/${companyId}/estoque/producao#conferencia-do-dia`,
    origem: ORIGEM,
    /** ⭐ o alvo é a CONCLUSÃO: conferir resolve o aviso dela, e só dela */
    alvo: `conclusao:${c.conclusaoId}`,
  }
}

/**
 * ⭐ Produz os avisos das conclusões paradas.
 *
 * ⚠️ **E RECONCILIA:** o que ele deixa de reportar numa rodada é RESOLVIDO. Sem isso o gerente
 * confere o lote e o aviso dele fica no sininho pra sempre — em duas semanas ninguém abre mais.
 * É a mesma disciplina do produtor da produção.
 */
export async function produzirAvisosDeConferencia(
  companyId: string,
  agora: Date = new Date(),
  db: Db = prisma,
): Promise<ResumoDaConferencia> {
  const r: ResumoDaConferencia = { gravados: 0, reabertos: 0, resolvidos: 0, recusados: [] }

  const fila = await filaDeConferencia(companyId, db, agora)
  const vivos: string[] = []

  for (const c of fila.cartoes) {
    /** ⛔ só o que passou do degrau — conclusão de 10 minutos atrás não é pendência, é o turno */
    if (!c.atrasado) continue
    const novo = fraseDaConferenciaParada(c, companyId)
    const v = avaliarLinguaDoBalcao(novo)
    // ⚠️ texto recusado é erro MEU no produtor, nunca motivo pra derrubar o cron
    if (!v.ok) {
      r.recusados.push({ motivo: v.motivo, titulo: novo.titulo })
      continue
    }
    const { reaberto } = await registrarAviso(novo, db)
    if (reaberto) r.reabertos++
    else r.gravados++
    vivos.push(novo.alvo)
  }

  r.resolvidos = await reconciliarOrigem(companyId, ORIGEM, vivos, db)
  return r
}

/** ⭐ o degrau, reexportado pra a tela e o teste lerem do mesmo lugar */
export { HORAS_PRA_AVISAR }
