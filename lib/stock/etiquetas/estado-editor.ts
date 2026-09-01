// ⛔⛔ SALVAR UM MODELO NOVO ESTAVA SOBRESCREVENDO O PADRÃO DA EMPRESA (01/09/2026).
//
// CASO REAL: o dono criou um modelo com nome próprio, viu **"Modelo salvo"** em verde, e
// não achou o modelo em lugar nenhum. O que existia no banco era **um** modelo — o
// "Padrão" — com `atualizadoEm` da noite anterior e **três campos mudados**, um deles a
// QUANTIDADE DESLIGADA. Toda etiqueta impressa depois saiu sem a quantidade.
//
// ⚠️⚠️ A CAUSA É DE ESTADO DE TELA, NÃO DA ROTA. A rota está certa (`modeloId ? update :
// create`). Quem errava era o cliente:
//
//     salvar() {  … POST …
//       setModeloId(j.modeloId)   // aponta pro modelo recém-salvo
//       await carregar()          // ⛔ e AQUI joga tudo fora:
//     }
//     carregar() {
//       const atual = modelos.find(m => m.padrao) ?? modelos[0]
//       setModeloId(atual.id); setNome(atual.nome); setBlocos(atual.blocos)   // ⛔
//     }
//
// Depois de salvar, a tela **pulava de volta pro Padrão em silêncio**, mostrando "Modelo
// salvo". O dono seguia editando achando que era o dele — e o próximo salvar carregava o
// `modeloId` do PADRÃO e escrevia por cima.
//
// ⛔⛔ E A MENSAGEM VERDE ERA O PIOR PEDAÇO. Palavras do dono: *"mensagem de sucesso em
// cima de uma troca silenciosa é pior que erro — eu confiei nela"*. Erro faz parar;
// sucesso mentiroso faz seguir em frente destruindo.
//
// ⚠️ É A SEGUNDA OCORRÊNCIA DA MESMA FAMÍLIA: o prefill do cardápio (28/08) também era
// refetch reescrevendo estado de formulário. A régua que ficou:
//
//     **Refetch depois de salvar pode atualizar a LISTA. Nunca o FORMULÁRIO que a
//     pessoa está editando.**
//
// ⚠️ E A DECISÃO MORA AQUI, FORA DO COMPONENTE, pela lição do prefill: regra que vive
// dentro de `useState` é regra que ninguém consegue provar (o projeto roda em
// `environment: node`, sem jsdom). Aqui ela roda em teste.

export interface ModeloResumo {
  id: string
  nome: string
  padrao: boolean
  blocos: unknown[]
}

export interface EstadoEditor {
  modeloId: string | null
  nome: string
  blocos: unknown[]
  padrao: boolean
}

/**
 * O que o formulário mostra ao ABRIR a tela: o modelo padrão da empresa (ou o primeiro).
 * ⚠️ Este é o ÚNICO momento em que o servidor manda no formulário.
 */
export function aoAbrir(modelos: ModeloResumo[]): EstadoEditor | null {
  const atual = modelos.find((m) => m.padrao) ?? modelos[0]
  if (!atual) return null
  return { modeloId: atual.id, nome: atual.nome, blocos: atual.blocos, padrao: atual.padrao }
}

/**
 * ⭐⭐ O que o formulário mostra DEPOIS de salvar: **o que o dono acabou de salvar**.
 *
 * Só o `modeloId` vem do servidor (é ele que diz qual linha nasceu). Nome, blocos e a
 * marca de padrão continuam sendo os da tela — porque são os que ele digitou, e porque
 * qualquer outra coisa aqui seria a tela trocando de modelo sem avisar.
 */
export function aposSalvar(atual: EstadoEditor, modeloIdSalvo: string): EstadoEditor {
  return { ...atual, modeloId: modeloIdSalvo }
}

/**
 * A mensagem de sucesso só é verdade se a tela FICOU no que foi salvo.
 * ⚠️ Existe pra a promessa ser verificável, e não uma frase solta na tela.
 */
export function ficouNoModeloSalvo(depois: EstadoEditor, modeloIdSalvo: string): boolean {
  return depois.modeloId === modeloIdSalvo
}
