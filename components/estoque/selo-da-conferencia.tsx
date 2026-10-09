/**
 * ⭐⭐ O SELO DA CONFERÊNCIA — UM COMPONENTE, DUAS TELAS (09/10/2026, item 2c).
 *
 * **Ordem do dono:** *"selos na lista de concluídas e na página da ordem: «aguardando
 * conferência · Xmin» âmbar · «✓✓ conferido · nome» verde · «✓✓ corrigido e conferido (era X)»
 * indigo."*
 *
 * ⛔⛔ **Ele mora aqui porque DUAS telas o desenham.** A lista de concluídas (home da produção)
 * e a linha da conclusão (página da ordem) respondem a MESMA pergunta — *"este número já
 * passou por quatro olhos?"*. Dois selos escritos à mão divergiriam no primeiro estado novo, e
 * aí a mesma conclusão apareceria conferida numa tela e aguardando na outra. É a lição do B1 em
 * forma de pílula.
 *
 * ⚠️ **E o selo DIZ ESTADO, nunca o veredito do fiscal.** O *"o material dava ~51"* vive só na
 * fila do gerente, atrás de `stock.manage`: a lei de 05/10 (*nenhum número esperado na tela de
 * quem declara*) é o que separa o selo da cola de prova. O `era X` **não é** número esperado —
 * é o que a cozinha declarou, e esconder isso faria a linha corrigida mostrar um número que
 * ninguém digitou, perdendo o rastro de vista.
 *
 * ⚠️ Os três tons saem das FAMÍLIAS de token (nada de hex): âmbar é o *"pede ação"* da casa,
 * verde é *"fechado"*, e o ÍNDIGO distingue **corrigido** de **confirmado** — são fatos
 * diferentes, e colapsá-los num verde só esconderia que o número mudou.
 */
import { fmtPedido } from '@/lib/stock/producao/pedido-na-tela'

export interface CarimboNaTela {
  estado: 'AGUARDANDO_CONFERENCIA' | 'CONFERIDA' | 'CORRIGIDA_E_CONFERIDA'
  conferidoPorNome: string | null
  corrigiuDe: number | null
}

const BASE = 'mt-1 inline-flex w-fit items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold'

export function SeloDaConferencia({ c, unidade }: { c: CarimboNaTela; unidade: string }) {
  if (c.estado === 'AGUARDANDO_CONFERENCIA') {
    return (
      <span className={BASE} style={{ background: 'var(--fam-ambar-bg)', color: 'var(--fam-ambar-ink)' }}>
        aguardando conferência
      </span>
    )
  }
  if (c.estado === 'CORRIGIDA_E_CONFERIDA') {
    return (
      <span className={BASE} style={{ background: 'var(--fam-indigo-bg)', color: 'var(--fam-indigo-ink)' }}>
        ✓✓ corrigido e conferido
        {c.corrigiuDe != null ? ` (era ${fmtPedido(c.corrigiuDe, unidade) ?? c.corrigiuDe})` : ''}
        {c.conferidoPorNome ? ` · ${c.conferidoPorNome}` : ''}
      </span>
    )
  }
  return (
    <span className={BASE} style={{ background: 'var(--fam-verde-bg)', color: 'var(--fam-verde-ink)' }}>
      ✓✓ conferido{c.conferidoPorNome ? ` · ${c.conferidoPorNome}` : ''}
    </span>
  )
}
