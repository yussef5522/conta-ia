/**
 * ⭐⭐⭐ A LEI DA LÍNGUA DO BALCÃO — PURA, e é ela que RECUSA aviso mudo (04/10/2026).
 *
 * **Ordem do dono, ao pé da letra:** *"título = a AÇÃO em linguagem simples ('Não cria ordem de
 * QUEIJO CHEDDAR antes de corrigir a ficha'), corpo = o porquê em 1-2 frases de gente ('se
 * alguém pedir 10, separa queijo pra 1 só'), **'O que fazer:' obrigatório** + botão que leva
 * DIRETO ao lugar. **Aviso sem ação clara NÃO PODE ser criado (guard).**"*
 *
 * ⛔⛔ **POR QUE ISSO É LEI E NÃO ESTILO:** o juiz desta casa já gritou R$ 21.968,02 em boletos
 * vencendo por 10 dias (30/08) e **ninguém agiu** — não por falta de alarme, mas porque o
 * alarme morava num e-mail e falava a língua do invariante (*"F3: parcela conferida há mais de
 * 7 dias"*). A frase que faz alguém levantar e resolver é *"o boleto do IVAN vence hoje e não
 * foi pro financeiro"*. Alarme que não diz o que fazer é o ruído que ensina o dono a parar de
 * ler — os 111 falsos positivos de 26/08 em outra roupa.
 *
 * ⚠️ **ESTE MÓDULO É PURO DE PROPÓSITO.** A checagem roda ANTES de qualquer escrita e sem
 * banco, então o teste do guard não precisa de fixture nenhuma — e, mais importante, o produtor
 * que violar a lei descobre na hora de montar o objeto, não três meses depois numa tela.
 * O CHECK do banco é a segunda rede (cinto e suspensório): a lib dá a MENSAGEM boa, o CHECK é o
 * que torna impossível alguém gravar por fora dela.
 */
import type { NovoAviso } from './tipos'
import { ehSetor, ehSeveridade } from './tipos'

export class AvisoMudoError extends Error {
  constructor(public readonly motivo: string) {
    super(`Aviso recusado — ${motivo}`)
    this.name = 'AvisoMudoError'
  }
}

/**
 * ⚠️ A lista é FECHADA e curta de propósito. Estas são as palavras que o sistema usa pra falar
 * CONSIGO MESMO — nome de invariante, de coluna, de tabela. Nenhuma delas significa coisa
 * nenhuma pra quem está no balcão às 11h com a cozinha cheia.
 *
 * ⛔ Lista ABERTA (tipo "nenhuma palavra em CAIXA ALTA") seria pior que nada: ela barraria
 * `QUEIJO CHEDDAR` e `NF`, que são exatamente como o dono escreve.
 */
const JARGAO_PROIBIDO = [
  'invariante',
  'constraint',
  'ledger',
  'payload',
  'endpoint',
  'migration',
  'upsert',
  'nullable',
  'dreGroup',
  'stableKey',
  'companyId',
  'null',
  'undefined',
]

/** ⚠️ verbo no infinitivo/imperativo — o que faz o "o que fazer" ser uma AÇÃO e não um lamento */
const SEM_VERBO = /^(o |a |os |as |um |uma |isso|aquilo|nada|talvez)/i

/**
 * O título tem que ser a AÇÃO. ⭐ O sinal que usamos é POSITIVO (achar um verbo), nunca
 * negativo — "título que não parece técnico" é regra que não dá pra checar.
 */
const VERBOS_DE_ACAO = [
  /** ⚠️ `corrig` NÃO casa `corrija` — e "Corrija a ficha" é exatamente como o dono escreve.
   *  O teste pegou isto recusando um aviso LEGÍTIMO, que é o pior tipo de guard: o que barra
   *  o certo e ensina a afrouxar a régua. O imperativo em -ja/-je precisa de raiz própria. */
  'corrig', 'corrij', 'conferi', 'confir', 'cont', 'lanç', 'lance', 'mand', 'envi', 'cri', 'cria',
  'arrum', 'ajust', 'reveja', 'rever', 'revis', 'olh', 'abr', 'fech', 'conclu', 'cancel',
  'separ', 'produz', 'compr', 'paga', 'pague', 'receb', 'escolh', 'aponta', 'aponte',
  /** ⚠️ 2ª lacuna da mesma classe que o teste pegou: `troc` NÃO casa `troque` (c × qu). O
   *  imperativo em -que/-ja precisa de raiz própria — e é como o dono fala ("Troque o
   *  certificado", "Corrija a ficha"). */
  'defin', 'troc', 'troqu', 'não cri', 'nao cri', 'não us', 'nao us', 'reconte', 'recont', 'marc',
  'importa', 'importe', 'concili', 'vincul', 'resolv', 'avis', 'verifi', 'tire', 'tira',
  'coloc', 'complet', 'acert', 'atualiz', 'está tudo certo', 'esta tudo certo',
]

function temVerboDeAcao(s: string): boolean {
  const t = s.toLowerCase()
  return VERBOS_DE_ACAO.some((v) => t.includes(v))
}

function achaJargao(s: string): string | null {
  const t = s.toLowerCase()
  return JARGAO_PROIBIDO.find((j) => new RegExp(`\\b${j}\\b`, 'i').test(t)) ?? null
}

/**
 * ⛔ RECUSA com o motivo escrito — e o motivo é pra MIM (quem escreveu o produtor), não pro
 * dono: é erro de programação, e tem que doer na hora de escrever o código.
 */
export function exigirLinguaDoBalcao(a: NovoAviso): void {
  if (!ehSetor(a.setor)) throw new AvisoMudoError(`setor desconhecido: ${String(a.setor)}`)
  if (!ehSeveridade(a.severidade)) throw new AvisoMudoError(`severidade desconhecida: ${String(a.severidade)}`)

  const titulo = a.titulo?.trim() ?? ''
  const corpo = a.corpo?.trim() ?? ''
  const fazer = a.oQueFazer?.trim() ?? ''

  if (!titulo) throw new AvisoMudoError('sem título — o título É a ação')
  if (!corpo) throw new AvisoMudoError('sem corpo — falta o porquê, em 1-2 frases de gente')
  /** ⛔⛔ A exigência central da ordem do dono. */
  if (!fazer) throw new AvisoMudoError('sem "o que fazer" — aviso sem ação clara não pode existir')

  /**
   * ⚠️ O título É A AÇÃO. Sem isso o campo viraria o nome do defeito (*"Rendimento fora da
   * faixa"*), que descreve e não manda — e aí o dono lê, concorda e não faz nada.
   */
  if (!temVerboDeAcao(titulo)) {
    throw new AvisoMudoError(
      `o título precisa ser a AÇÃO (um verbo), não o nome do problema: "${titulo}"`,
    )
  }
  if (!temVerboDeAcao(fazer) || SEM_VERBO.test(fazer)) {
    throw new AvisoMudoError(`"o que fazer" precisa começar por um verbo: "${fazer}"`)
  }

  for (const [campo, texto] of [['título', titulo], ['corpo', corpo], ['o que fazer', fazer]] as const) {
    const j = achaJargao(texto)
    if (j) throw new AvisoMudoError(`jargão de sistema no ${campo}: "${j}" — escreva na língua do balcão`)
  }

  /**
   * ⚠️ BOTÃO PELA METADE TAMBÉM NÃO PASSA: rótulo sem destino é a *"porta pintada na parede"*
   * de 13/09; destino sem rótulo é link invisível (a lição de 30/08 — *"ação sem afordância não
   * existe, principalmente no celular"*).
   */
  const temRotulo = !!a.acaoRotulo?.trim()
  const temHref = !!a.acaoHref?.trim()
  if (temRotulo !== temHref) {
    throw new AvisoMudoError('botão pela metade — rótulo e destino vêm juntos, ou nenhum dos dois')
  }
  /**
   * ⛔⛔ CAMINHO INTERNO — e `//evil.com` **passava** na 1ª versão porque começa com `/`.
   * É a cicatriz literal do `redirect` do convite (30/08): **`//host` é HOST pro navegador**,
   * não caminho. Um aviso do sistema com link pra fora é phishing com a nossa cara.
   */
  if (temHref && (!a.acaoHref!.startsWith('/') || a.acaoHref!.startsWith('//'))) {
    throw new AvisoMudoError(`o destino tem que ser um caminho interno: "${a.acaoHref}"`)
  }

  if (!a.origem?.trim()) throw new AvisoMudoError('sem origem — todo aviso diz QUEM falou')
  if (!a.alvo?.trim()) throw new AvisoMudoError('sem alvo — é ele que faz o mesmo problema não virar 10 avisos')
}

/** ⭐ versão que não lança — pro produtor fail-soft (juiz noturno) decidir o que fazer */
export function avaliarLinguaDoBalcao(a: NovoAviso): { ok: true } | { ok: false; motivo: string } {
  try {
    exigirLinguaDoBalcao(a)
    return { ok: true }
  } catch (e) {
    return { ok: false, motivo: e instanceof AvisoMudoError ? e.motivo : String(e) }
  }
}
