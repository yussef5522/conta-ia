// ⭐⭐⭐ RETIRADA SEM PONTE É MEIA-PONTE (18/09/2026).
//
// **O dono:** *"marquei uma saída como Distribuição de Lucros na caixa e ela só gravou a
// categoria: NÃO abriu a ponte que existia no Pendentes antigo, que mandava a retirada pro
// meu perfil PF. (…) **não quero meia-ponte gravada.**"*
//
// ⚠️ **INVESTIGADO: a capacidade NÃO foi guardada na faxina de 15/09.** O `WithdrawalPanel`
// está VIVO e é usado pelo `xero-row` e pela tela do sócio; os 4 arquivos com selo
// `CAPACIDADE GUARDADA` são outros (aprender-e-aplicar, auto-categorizar, selo de fonte,
// banner de fornecedor). O que aconteceu é mais simples e mais silencioso: **a caixa de
// entrada nasceu sem o convite** — o "convite pós-categorização" morava no Pendentes, e o
// Pendentes morreu como tela.
//
// ⭐ E o estado que sobra tem nome e casa: `orphanWithdrawalWhere` chama de **órfã** a saída
// marcada como retirada **sem ponte**, e a tela `/retiradas-pendentes` a lista. Medido: a
// linha do dono (`cmu7qxrxh013g7tu92g58moyv`, R$ 350 de 16/09) **está lá** — o gesto é
// reabrível. O que faltava era a caixa **dizer isso** em vez de calar.

import { GRUPO_RETIRADA } from './categorias-do-gesto'

export interface CategoriaEscolhida {
  id: string
  name: string
  dreGroup?: string | null
}

/**
 * ⭐ A categoria escolhida é uma RETIRADA? — pelo `dreGroup`, **nunca pelo nome**.
 *
 * É a mesma régua que separa a seção 💰 no menu: uma decisão, um lugar. Casar por nome
 * faria `Seguro de lucros cessantes` abrir uma ponte pro perfil do sócio.
 */
export function ehRetirada(cat: CategoriaEscolhida | null | undefined): boolean {
  return !!cat && cat.dreGroup === GRUPO_RETIRADA
}

export type TipoDeRetirada = 'PRO_LABORE' | 'DISTRIBUICAO' | null

/**
 * ⭐ O tipo pré-selecionado no painel — **SUGESTÃO, nunca decisão**.
 *
 * ⚠️ Aqui o nome PODE ser lido, e a diferença é o desenho: isto só preenche um campo que o
 * dono confirma na tela seguinte (o painel pergunta sócio, conta e tipo). *A régua dura da
 * casa é "o sistema não CLASSIFICA por nome"* — preencher um formulário que o dono revisa é
 * outra coisa. Ambíguo (o nome diz as duas coisas) devolve `null`: ele escolhe.
 */
export function tipoSugerido(cat: CategoriaEscolhida): TipoDeRetirada {
  const n = cat.name.toLowerCase()
  const temLabore = n.includes('labore')
  const temDistrib = n.includes('distribui') || n.includes('lucro')
  if (temLabore && temDistrib) return null
  if (temLabore) return 'PRO_LABORE'
  if (temDistrib) return 'DISTRIBUICAO'
  return null
}

/**
 * ⭐⭐ O CONVITE — o que a tela oferece depois de gravar a categoria.
 *
 * ⛔ **Oferecido SEMPRE, obrigatório NUNCA** (a régua do dono: *"opcional mas oferecido
 * sempre — posso pular"*). Forçar a ponte travaria o dono que ainda não sabe de qual conta
 * da PF o dinheiro entrou; e gravar a ponte sozinho seria decidir o destino do dinheiro
 * dele — a mesma linha que o pareamento de transferência nunca cruza.
 */
export interface ConviteDaPonte {
  oferecer: boolean
  titulo: string
  /** onde o gesto continua existindo se ele pular agora */
  ondeReabrir: string
  tipo: TipoDeRetirada
}

export function conviteDaPonte(cat: CategoriaEscolhida | null | undefined): ConviteDaPonte | null {
  if (!ehRetirada(cat)) return null
  return {
    oferecer: true,
    titulo: 'Passo 2 — mandar pro perfil PF?',
    ondeReabrir: '/retiradas-pendentes',
    tipo: tipoSugerido(cat!),
  }
}
