// ⛔⛔ A PORTA VELHA DO CADASTRO DE GENTE — AGORA É REDIRECT (06/09/2026).
//
// **O QUE ESTAVA AQUI:** "Setores e colaboradores", com o cadastro de pessoas e o PIN. E o
// único link até esta tela era a palavra **"setores"**, em cinza de 11px, **dentro do
// formulário de nova ordem** da Produção — só aparecia depois de clicar em "nova ordem" E
// ter pelo menos uma ficha. Medido em prod: o `href` **não existia** no HTML da tela de
// Produção, e o dono, com as 37 chaves do OWNER, não tinha caminho nenhum até aqui.
//
// ⭐ O CADASTRO MUDOU DE CASA: **Sistema → Equipe**, uma lista com todo mundo (quem loga e
// quem usa PIN), com o "+ adicionar pessoa" de um gesto. É o padrão de Toast/Square/7shifts:
// a tela é de PESSOAS, e o mecanismo de acesso é uma coluna.
//
// ⛔⛔ E POR QUE REDIRECT E NÃO UMA PLACA: aqui não havia dois PÚBLICOS a separar (o caso do
// `/estoque/fichas`, que atende o dono e a cozinha). Havia UMA porta escondida. Deixar a tela
// meio viva criaria a segunda porta de cadastro — e é assim que nasce bagunça.
//
// ⚠️ NADA DE DADO SE MOVEU: `stock_colaborador`, os PINs e os vínculos continuam onde estão.
// A limpeza é de TELA e ROTA, zero migration.

import { redirect } from 'next/navigation'

interface PageProps { params: Promise<{ id: string }> }

export default async function CadastrosPage({ params }: PageProps) {
  await params
  // ⚠️ `?filtro=cozinha` porque quem chega por um link da PRODUÇÃO está pensando na cozinha
  // — cai na lista já filtrada, e desmarca se quiser ver todo mundo.
  redirect('/equipe?filtro=cozinha')
}
