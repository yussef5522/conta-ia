/**
 * ⭐⭐ DOSE IMPLAUSÍVEL NUNCA MAIS PASSA CALADA (12/11/2026 — raio-X da produção, ordem do dono).
 *
 * O caso real: em 06/11 as fichas ABRIR MILHO e ABRIR ERVILHA foram de 2 KG para 0,0001 KG
 * (20.000× menos) e ninguém foi avisado — era a gambiarra da equipe pra "tarefa" (abrir latas),
 * um conceito que o sistema ainda não tem. ⛔ NÃO BLOQUEIA: o dono e a equipe mandam (a
 * gambiarra continua possível); só deixa de ser SILENCIOSA — a porta pede confirmação com
 * antes → depois.
 *
 * A FAMÍLIA do histórico: a dose nova fica dentro de [menor ÷ 10, maior × 10] das doses que o
 * MESMO insumo já teve nesta ficha (todas as versões). Fora disso é outra ordem de grandeza.
 * Insumo novo na ficha (sem histórico) não tem família — passa.
 */
export const FATOR_DA_FAMILIA = 10

export interface DoseImplausivel {
  itemId: string
  nome: string
  unidade: string
  antes: number
  depois: number
}

export function dosesImplausiveis(
  historico: readonly { itemId: string; qtd: number; versao: number }[],
  novas: readonly { itemId: string; qtd: number; unidade: string }[],
  nomeDe: (itemId: string) => string,
): DoseImplausivel[] {
  const out: DoseImplausivel[] = []
  for (const n of novas) {
    const hs = historico.filter((h) => h.itemId === n.itemId && h.qtd > 0)
    if (!hs.length || !(n.qtd > 0)) continue
    const min = Math.min(...hs.map((h) => h.qtd))
    const max = Math.max(...hs.map((h) => h.qtd))
    // ⚠️ fronteira com folga de ponto flutuante: exatamente 10× é DA família (0,003 → 0,0003 passa)
    if (n.qtd < (min / FATOR_DA_FAMILIA) * (1 - 1e-9) || n.qtd > max * FATOR_DA_FAMILIA * (1 + 1e-9)) {
      const ultima = [...hs].sort((a, b) => b.versao - a.versao)[0]
      out.push({ itemId: n.itemId, nome: nomeDe(n.itemId), unidade: n.unidade, antes: ultima.qtd, depois: n.qtd })
    }
  }
  return out
}

/** a frase da pergunta — antes → depois, por insumo */
export function fraseDaDose(ds: readonly DoseImplausivel[]): string {
  const fmt = (v: number) => String(v).replace('.', ',')
  return `Dose fora do que esta ficha sempre usou: ${ds.map((d) => `${d.nome} ${fmt(d.antes)} → ${fmt(d.depois)} ${d.unidade}`).join(' · ')}. Confirme se é isso mesmo.`
}
