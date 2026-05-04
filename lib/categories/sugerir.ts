// Auto-sugestão de dreGroup + cor + ícone com base em nome + tipo da categoria.
// Função pura. Testável como unit. Diferencial vs concorrentes: Conta Azul
// e QuickBooks não fazem isso — usuário tem que escolher manualmente.

export type CategoryType = 'INCOME' | 'EXPENSE' | 'TRANSFER'

export interface SugestaoCategoria {
  dreGroup: string
  color: string // Tailwind class (bg-*) compatível com dre-colors.ts
  icon: string // lucide-react icon name
}

interface Regra {
  regex: RegExp
  sugestao: SugestaoCategoria
}

// Normaliza nome pra match: remove acentos + lowercase + trim.
function normalizar(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
}

const REGRAS_EXPENSE: Regra[] = [
  { regex: /aluguel|condominio|iptu/, sugestao: { dreGroup: 'DESPESAS_ADMINISTRATIVAS', color: 'bg-orange-300', icon: 'home' } },
  { regex: /energia|\bagua\b|esgoto|\bgas\b/, sugestao: { dreGroup: 'DESPESAS_ADMINISTRATIVAS', color: 'bg-orange-300', icon: 'zap' } },
  { regex: /internet|telefone|telefonia/, sugestao: { dreGroup: 'DESPESAS_ADMINISTRATIVAS', color: 'bg-orange-300', icon: 'smartphone' } },
  { regex: /salario|ferias|13/, sugestao: { dreGroup: 'DESPESAS_PESSOAL', color: 'bg-blue-500', icon: 'users' } },
  { regex: /inss|fgts|encargo/, sugestao: { dreGroup: 'DESPESAS_PESSOAL', color: 'bg-blue-500', icon: 'briefcase' } },
  { regex: /beneficio|\bvale\b|auxilio/, sugestao: { dreGroup: 'DESPESAS_PESSOAL', color: 'bg-blue-500', icon: 'gift' } },
  { regex: /marketing|publicidade|propaganda/, sugestao: { dreGroup: 'DESPESAS_COMERCIAIS', color: 'bg-orange-400', icon: 'megaphone' } },
  { regex: /google|\bmeta\b|tiktok|facebook/, sugestao: { dreGroup: 'DESPESAS_COMERCIAIS', color: 'bg-orange-400', icon: 'megaphone' } },
  { regex: /comissao|comissoes/, sugestao: { dreGroup: 'DESPESAS_COMERCIAIS', color: 'bg-orange-400', icon: 'percent' } },
  { regex: /juros|tarifa|\biof\b|multa banc/, sugestao: { dreGroup: 'DESPESAS_FINANCEIRAS', color: 'bg-red-600', icon: 'banknote' } },
  { regex: /antecipacao|recebivel/, sugestao: { dreGroup: 'DESPESAS_FINANCEIRAS', color: 'bg-red-600', icon: 'banknote' } },
  { regex: /irpj|csll|imposto sobre lucro/, sugestao: { dreGroup: 'IMPOSTOS_SOBRE_LUCRO', color: 'bg-purple-700', icon: 'scale' } },
  { regex: /custo|insumo|materia|alimento/, sugestao: { dreGroup: 'CUSTO_PRODUTO_VENDIDO', color: 'bg-orange-500', icon: 'package' } },
  { regex: /equipamento|movel|moveis|reforma/, sugestao: { dreGroup: 'INVESTIMENTOS', color: 'bg-purple-400', icon: 'wrench' } },
]

const REGRAS_INCOME: Regra[] = [
  { regex: /mensalidade|consulta|sessao/, sugestao: { dreGroup: 'RECEITA_BRUTA', color: 'bg-emerald-500', icon: 'calendar' } },
  { regex: /\bvenda\b|delivery|salao/, sugestao: { dreGroup: 'RECEITA_BRUTA', color: 'bg-emerald-500', icon: 'dollar-sign' } },
  { regex: /receita|servico|honorario/, sugestao: { dreGroup: 'RECEITA_BRUTA', color: 'bg-emerald-500', icon: 'dollar-sign' } },
  { regex: /aplicacao|rendimento|juros recebidos/, sugestao: { dreGroup: 'RECEITAS_FINANCEIRAS', color: 'bg-emerald-300', icon: 'trending-up' } },
  { regex: /indeniz|doacao|doacoes/, sugestao: { dreGroup: 'OUTRAS_RECEITAS', color: 'bg-emerald-200', icon: 'gift' } },
  { regex: /\biss\b|\bpis\b|\bcofins\b|simples nacional|\bdas\b|icms/, sugestao: { dreGroup: 'DEDUCOES', color: 'bg-red-500', icon: 'file-text' } },
]

const REGRAS_TRANSFER: Regra[] = [
  { regex: /aporte|mutuo|socio/, sugestao: { dreGroup: 'TRANSFERENCIA', color: 'bg-slate-400', icon: 'handshake' } },
  { regex: /distribuicao|pro-labore|prolabore/, sugestao: { dreGroup: 'DISTRIBUICAO_LUCROS', color: 'bg-amber-500', icon: 'trending-up' } },
]

const DEFAULTS: Record<CategoryType, SugestaoCategoria> = {
  EXPENSE: { dreGroup: 'DESPESAS_ADMINISTRATIVAS', color: 'bg-orange-300', icon: 'file-text' },
  INCOME: { dreGroup: 'RECEITA_BRUTA', color: 'bg-emerald-500', icon: 'dollar-sign' },
  TRANSFER: { dreGroup: 'TRANSFERENCIA', color: 'bg-slate-400', icon: 'arrow-left-right' },
}

export function sugerir(input: { nome: string; tipo: CategoryType }): SugestaoCategoria {
  const nome = normalizar(input.nome)
  if (!nome) return DEFAULTS[input.tipo]

  const regras =
    input.tipo === 'EXPENSE'
      ? REGRAS_EXPENSE
      : input.tipo === 'INCOME'
        ? REGRAS_INCOME
        : REGRAS_TRANSFER

  for (const { regex, sugestao } of regras) {
    if (regex.test(nome)) return sugestao
  }

  return DEFAULTS[input.tipo]
}
