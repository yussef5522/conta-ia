/**
 * ⭐ O ÍCONE DE CADA CUSTO FIXO — mapa ESTÁVEL (06/10/2026).
 *
 * **Ordem do dono:** *"ícone da categoria (mapa estável)"*.
 *
 * ⛔⛔ **ESTÁVEL quer dizer: a mesma categoria tem SEMPRE o mesmo ícone, e nome desconhecido
 * cai num ícone NEUTRO — nunca num hash de cor/forma.** O logo da receita (da produção) usa
 * hash porque lá o universo é aberto (toda ficha nova precisa de uma cara); aqui o universo é
 * a lista de custos da casa, e um ícone sorteado faria o aluguel mudar de cara quando o dono
 * renomeasse a categoria. **Reconhecimento vem da estabilidade.**
 *
 * ⚠️ A régua é por PALAVRA COM BORDA, nunca `includes` cru: sem a borda, `agua` casaria dentro
 * de `GUARDANAPO` e `luz` dentro de `ALUZ...` — é a cicatriz do mapa de seções do cardápio
 * (08/09), onde `AGUA` dentro de `GUARDANAPO` virou teste.
 */
import {
  Banknote, Building2, Droplets, Flame, FileText, Landmark, Laptop, Receipt, ShieldCheck,
  Trash2, Truck, Users, Wifi, Wrench, Zap, type LucideIcon,
} from 'lucide-react'

/** ⚠️ a ORDEM importa: o específico vem antes do genérico (a lição do `FRITO` × `FRANGO`) */
const MAPA: { palavras: string[]; icone: LucideIcon }[] = [
  { palavras: ['aluguel', 'locacao', 'condominio'], icone: Building2 },
  { palavras: ['salario', 'salarios', 'folha', 'fgts', 'inss', 'ferias', 'rescisao', 'pessoal', 'provisao'], icone: Users },
  { palavras: ['energia', 'eletrica', 'luz'], icone: Zap },
  { palavras: ['agua', 'esgoto'], icone: Droplets },
  { palavras: ['gas'], icone: Flame },
  { palavras: ['internet', 'telefone', 'telefonia', 'link'], icone: Wifi },
  { palavras: ['contabilidade', 'contador'], icone: FileText },
  { palavras: ['software', 'sistema', 'sistemas', 'licenca'], icone: Laptop },
  { palavras: ['seguro'], icone: ShieldCheck },
  { palavras: ['manutencao', 'reparo', 'obra', 'equipamentos'], icone: Wrench },
  { palavras: ['lixo', 'coleta'], icone: Trash2 },
  { palavras: ['frete', 'entregador', 'transporte', 'motoboy'], icone: Truck },
  { palavras: ['imposto', 'impostos', 'tributos', 'das', 'icms', 'taxas'], icone: Landmark },
  { palavras: ['tarifa', 'tarifas', 'juros', 'encargos', 'maquininha', 'banco', 'bancarias'], icone: Banknote },
]

/** ⚠️ sem caixa e sem acento — o nome da categoria é texto livre que o dono escreve como quer */
function normalizar(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

/** ⭐ o ícone de uma categoria. Nome desconhecido → NEUTRO, nunca sorteado. */
export function iconeDaCategoria(nome: string): LucideIcon {
  const n = normalizar(nome)
  for (const e of MAPA) {
    // ⚠️ BORDA DE PALAVRA: `\bagua\b` não casa dentro de `guardanapo`
    if (e.palavras.some((p) => new RegExp(`\\b${p}\\b`).test(n))) return e.icone
  }
  return Receipt
}
