// Regras de hard delete de categoria. Função pura — usada tanto no backend
// (validação antes do DELETE) quanto no frontend (habilitar/desabilitar botão
// + tooltip explicativo). Garante que a UX e a API estão sincronizadas.

export interface CategoryDeleteContext {
  isSystemDefault: boolean
  transactionCount: number
  childrenCount: number
}

// Categoria pode ser hard-deletada se for custom + sem transações + sem filhos.
// Caso contrário, usuário deve usar soft delete (Desativar).
export function canHardDelete(cat: CategoryDeleteContext): boolean {
  if (cat.isSystemDefault) return false
  if (cat.transactionCount > 0) return false
  if (cat.childrenCount > 0) return false
  return true
}

// Retorna mensagem explicativa quando NÃO pode deletar. null se pode.
// Usada como tooltip no botão disabled.
export function getHardDeleteDisabledReason(cat: CategoryDeleteContext): string | null {
  if (cat.isSystemDefault) {
    return "Categoria do template padrão. Use 'Desativar' pra ocultar."
  }
  if (cat.transactionCount > 0) {
    const plural = cat.transactionCount === 1 ? 'transação vinculada' : 'transações vinculadas'
    return `${cat.transactionCount} ${plural}. Use 'Desativar' pra preservar histórico.`
  }
  if (cat.childrenCount > 0) {
    const plural = cat.childrenCount === 1 ? 'subcategoria' : 'subcategorias'
    return `${cat.childrenCount} ${plural}. Mova ou exclua os filhos primeiro.`
  }
  return null
}
