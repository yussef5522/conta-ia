// Geração de templateKey — chave lógica estável que sobrevive a edições
// do nome (Sub-etapa 5.1.E).
//
// Uma categoria do template tem identidade definida pelo (setor, dreGroup,
// nome original). Mesmo se o usuário renomear "Aluguel" para "Aluguel Matriz",
// a templateKey continua "RESTAURANT:DESPESAS_ADMINISTRATIVAS:aluguel" e
// permite o algoritmo de diff identificar que é a mesma categoria editada.
//
// Categorias custom (isSystemDefault=false) NÃO têm templateKey — são
// criações independentes do template.

// Slugify pt-BR: lowercase + remove acentos + remove caracteres especiais
// + colapsa espaços/hífens em underscore.
export function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // remove combining diacritics (acentos, til, cedilha)
    .replace(/[^a-z0-9\s-]/g, '') // remove caracteres não-alfanuméricos (exceto espaço/hífen)
    .replace(/[\s-]+/g, '_') // colapsa espaços/hífens em underscore
    .replace(/^_+|_+$/g, '') // trim de underscores nas pontas
}

// Gera templateKey a partir do tripleto (setor, dreGroup, nome).
// Setor sempre uppercase pra consistência (companyType vem variado: RESTAURANT, restaurant, etc).
export function generateTemplateKey(
  setor: string,
  dreGroup: string,
  nome: string,
): string {
  const setorNorm = (setor ?? '').toUpperCase().trim()
  const dreNorm = (dreGroup ?? '').toUpperCase().trim()
  return `${setorNorm}:${dreNorm}:${slugify(nome)}`
}
